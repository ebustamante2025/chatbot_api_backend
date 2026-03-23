import express from 'express';
import { randomBytes } from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { db } from '../database/connection.js';

const router = express.Router();

/** Handoff de un solo uso: el widget envía el JWT al servidor y abre la app solo con ?otk=... (sin JWT en la URL). */
const handoffStore = new Map<string, { token: string; exp: number }>();
const HANDOFF_TTL_MS = 120_000;

function cleanupHandoffStore(): void {
  const now = Date.now();
  for (const [k, v] of handoffStore.entries()) {
    if (v.exp < now) handoffStore.delete(k);
  }
}
const JWT_SECRET = process.env.JWT_SECRET || 'crm-chatbot-secret-change-in-production';
const FAQ_TOKEN_EXPIRY = '10m'; // 10 minutos

/** Payload del token de acceso a FAQ (NIT + usuario validados en el widget) */
interface FaqTokenPayload {
  empresaId: number;
  contactoId: number;
  purpose: 'faq';
  /** Si se envía (p. ej. botón Prueba → asistente docs), queda firmado y debe coincidir con la URL */
  servicio?: string;
  /** Nombres para mostrar en el asistente Streamlit (IA360), sin sustituir validación por id */
  empresaNombre?: string;
  contactoNombre?: string;
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
    const { empresaId, contactoId, servicio: servicioBody } = req.body;

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
      empresaNombre: String(empresa.nombre_empresa ?? '').trim() || undefined,
      contactoNombre: String(contacto.nombre ?? '').trim() || undefined,
    };

    if (
      servicioBody != null &&
      typeof servicioBody === 'string' &&
      servicioBody.trim().length > 0
    ) {
      payload.servicio = servicioBody.trim();
    }

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

/**
 * POST /api/faq-acceso/handoff
 * Registra un JWT válido y devuelve un id de un solo uso para abrir FAQ/asistente sin poner el token en la URL.
 * Body: { token: string }
 * Respuesta: { success: true, handoffId: string }
 */
router.post('/handoff', (req, res) => {
  try {
    cleanupHandoffStore();
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'token es obligatorio',
      });
    }
    let decoded: FaqTokenPayload & JwtPayload;
    try {
      decoded = jwt.verify(token.trim(), JWT_SECRET) as FaqTokenPayload & JwtPayload;
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
      });
    }
    if (decoded.purpose !== 'faq') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }
    const handoffId = randomBytes(18).toString('base64url');
    handoffStore.set(handoffId, {
      token: token.trim(),
      exp: Date.now() + HANDOFF_TTL_MS,
    });
    return res.json({ success: true, handoffId });
  } catch (error) {
    console.error('Error al crear handoff FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo preparar el acceso.',
    });
  }
});

/**
 * GET /api/faq-acceso/handoff/:id
 * Canjea el id de un solo uso por el JWT (la entrada se elimina; no reutilizable).
 */
router.get('/handoff/:id', (req, res) => {
  try {
    cleanupHandoffStore();
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(404).json({
        success: false,
        message: 'Enlace inválido',
      });
    }
    const entry = handoffStore.get(id);
    if (!entry || entry.exp < Date.now()) {
      return res.status(404).json({
        success: false,
        message: 'Enlace de acceso inválido, caducado o ya usado',
      });
    }
    handoffStore.delete(id);
    return res.json({ success: true, token: entry.token });
  } catch (error) {
    console.error('Error al canjear handoff FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al canjear el acceso.',
    });
  }
});

/**
 * POST /api/faq-acceso/renovar
 * Renueva el JWT si el token anterior tiene firma válida (aunque haya caducado)
 * y empresa/contacto siguen existiendo en BD. Sirve para el portal del botón
 * **Prueba** (asistente de documentación), que no depende de una conversación CRM abierta.
 * Body: { token: string, servicio?: string } (servicio opcional si el token no lo trae, p. ej. mismo token que FAQ)
 */
router.post('/renovar', async (req, res) => {
  try {
    const body = req.body as { token?: string; servicio?: string };
    const { token } = body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Token requerido',
        message: 'Envíe el token anterior (aunque haya caducado) para renovar el acceso.',
      });
    }

    let decoded: FaqTokenPayload & JwtPayload;
    try {
      decoded = jwt.verify(token.trim(), JWT_SECRET, {
        ignoreExpiration: true,
      }) as FaqTokenPayload & JwtPayload;
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        message: 'No se pudo validar el acceso. Abra de nuevo desde el chatbot (botón Prueba).',
      });
    }

    if (decoded.purpose !== 'faq') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        message: 'Token no válido para este portal.',
      });
    }

    const empresaId = Number(decoded.empresaId);
    const contactoId = Number(decoded.contactoId);

    const servicioFromBody =
      typeof body.servicio === 'string' ? body.servicio.trim() : '';
    const servicioFromToken =
      decoded.servicio != null && typeof decoded.servicio === 'string'
        ? decoded.servicio.trim()
        : '';
    const servicio = servicioFromToken || servicioFromBody;

    if (!empresaId || !contactoId) {
      return res.status(400).json({
        success: false,
        error: 'Datos incompletos',
        message: 'El token no contiene empresa o contacto válidos.',
      });
    }

    const empresa = await db('empresas').where({ id_empresa: empresaId }).first();
    if (!empresa) {
      return res.status(403).json({
        success: false,
        error: 'Empresa no válida',
        message: 'No se encontró la empresa.',
      });
    }

    const contacto = await db('contactos')
      .where({ id_contacto: contactoId, empresa_id: empresaId })
      .first();

    if (!contacto) {
      return res.status(403).json({
        success: false,
        error: 'Usuario no válido',
        message: 'El usuario no está registrado para esta empresa.',
      });
    }

    const payload: FaqTokenPayload = {
      empresaId,
      contactoId,
      purpose: 'faq',
      empresaNombre: String(empresa.nombre_empresa ?? '').trim() || undefined,
      contactoNombre: String(contacto.nombre ?? '').trim() || undefined,
    };
    if (servicio) {
      payload.servicio = servicio;
    }

    const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: FAQ_TOKEN_EXPIRY });

    return res.json({ success: true, token: newToken });
  } catch (error) {
    console.error('Error al renovar token FAQ/agente:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno',
      message: 'No se pudo renovar el acceso. Intente de nuevo.',
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
