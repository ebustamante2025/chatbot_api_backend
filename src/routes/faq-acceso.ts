import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'crm-chatbot-secret-change-in-production';
const FAQ_TOKEN_EXPIRY = '10m'; // 10 minutos

/** Payload del token de acceso a FAQ (NIT + usuario validados en el widget) */
interface FaqTokenPayload {
  empresaId: number;
  contactoId: number;
  purpose: 'faq';
  iat?: number;
  exp?: number;
}

/**
 * POST /api/faq-acceso
 * Emite un token de acceso a preguntas frecuentes.
 * Body: { empresaId: number, contactoId: number }
 * Requiere que la empresa y el contacto existan y que el contacto pertenezca a la empresa (validación NIT + usuario).
 */
router.post('/', async (req, res) => {
  try {
    const { empresaId, contactoId } = req.body;

    if (!empresaId || !contactoId) {
      return res.status(400).json({
        success: false,
        error: 'Datos requeridos',
        message: 'empresaId y contactoId son obligatorios. Debe completar el registro (NIT y usuario) en el chat.',
      });
    }

    const empresa = await db('empresas').where({ id_empresa: Number(empresaId) }).first();
    if (!empresa) {
      return res.status(403).json({
        success: false,
        error: 'Empresa no válida',
        message: 'No se encontró la empresa. Complete el registro con su NIT en el chat.',
      });
    }

    const contacto = await db('contactos')
      .where({ id_contacto: Number(contactoId), empresa_id: Number(empresaId) })
      .first();

    if (!contacto) {
      return res.status(403).json({
        success: false,
        error: 'Usuario no válido',
        message: 'El usuario no está registrado para esta empresa. Complete el registro en el chat.',
      });
    }

    const payload: FaqTokenPayload = {
      empresaId: Number(empresaId),
      contactoId: Number(contactoId),
      purpose: 'faq',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: FAQ_TOKEN_EXPIRY });

    return res.json({ success: true, token });
  } catch (error) {
    console.error('Error al emitir token FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno',
      message: 'No se pudo generar el acceso. Intente de nuevo.',
    });
  }
});

/** Normaliza para comparar nombres de servicio: guiones bajos → espacios, sin tildes, minúsculas */
function normalizeForMatch(value: string): string {
  if (!value || typeof value !== 'string') return '';
  const sinTildes = value.normalize('NFD').replace(/\p{M}/gu, '');
  return sinTildes.replace(/\s+/g, ' ').replace(/_/g, ' ').trim().toLowerCase();
}

/**
 * GET /api/faq-acceso/verificar-servicio?servicio=XXX
 * Indica si el servicio existe en temas de FAQ y si tiene preguntas.
 * Respuesta: { existe: boolean, tienePreguntas: boolean }
 */
router.get('/verificar-servicio', async (_req, res) => {
  try {
    const servicio = (typeof _req.query.servicio === 'string' ? _req.query.servicio : '').trim();
    const norm = normalizeForMatch(servicio);

    if (!norm) {
      return res.json({ existe: false, tienePreguntas: false });
    }

    const temas = await db('temas_preguntas')
      .where({ estado: true })
      .orderBy('orden', 'asc')
      .orderBy('id', 'asc');

    const preguntas = await db('preguntas_frecuentes')
      .where({ estado: true })
      .select('tema_id');

    const countByTema: Record<number, number> = {};
    for (const p of preguntas) {
      const tid = Number(p.tema_id);
      countByTema[tid] = (countByTema[tid] || 0) + 1;
    }

    let temaCoincidente: { id: number; nombre: string } | null = null;
    for (const t of temas) {
      const nombreNorm = normalizeForMatch(t.nombre);
      const esIgual = nombreNorm === norm;
      const incluye =
        nombreNorm.includes(norm) || norm.includes(nombreNorm);
      if (esIgual || incluye) {
        temaCoincidente = { id: t.id, nombre: t.nombre };
        break;
      }
    }

    if (!temaCoincidente) {
      return res.json({ existe: false, tienePreguntas: false });
    }

    const cantidad = countByTema[temaCoincidente.id] ?? 0;
    return res.json({ existe: true, tienePreguntas: cantidad > 0 });
  } catch (error) {
    console.error('Error al verificar servicio FAQ:', error);
    return res.status(500).json({
      existe: false,
      tienePreguntas: false,
      error: 'Error al verificar el servicio.',
    });
  }
});

/**
 * GET /api/faq-acceso/validar?token=xxx
 * Valida el token de acceso a FAQ. Si es válido, responde { ok: true }.
 */
router.get('/validar', (req, res) => {
  try {
    const token =
      (req.query.token as string) ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (!token || !token.trim()) {
      return res.status(401).json({
        ok: false,
        error: 'Acceso no autorizado',
        message: 'Para ver las preguntas frecuentes debe ingresar desde el chat y completar el registro con su NIT y usuario.',
      });
    }

    const decoded = jwt.verify(token.trim(), JWT_SECRET) as FaqTokenPayload;

    if (decoded.purpose !== 'faq') {
      return res.status(401).json({
        ok: false,
        error: 'Token inválido',
        message: 'Debe completar el registro en el chat para acceder.',
      });
    }

    return res.json({ ok: true });
  } catch {
    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado',
      message: 'Para ver las preguntas frecuentes debe ingresar desde el chat y completar el registro con su NIT y usuario.',
    });
  }
});

export default router;
