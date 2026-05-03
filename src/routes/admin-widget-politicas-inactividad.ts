import express from 'express';
import type { Request } from 'express';
import { db } from '../database/connection.js';

const router = express.Router();

type UserJwt = { id_usuario: number; username: string; rol: string };

function requireAdmin(req: Request & { user?: UserJwt }, res: express.Response): boolean {
  if (!req.user || req.user.rol !== 'ADMIN') {
    res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo administradores pueden gestionar esta configuración',
    });
    return false;
  }
  return true;
}

const TABLA = 'widget_politicas_inactividad';

const M1 =
  'Lleva un tiempo sin escribir. Recuerde que el chat puede cerrarse por inactividad si no envía un mensaje.';
const M2 =
  'Sigue sin actividad por su parte. Si no escribe pronto, la conversación se cerrará automáticamente.';
const MC =
  'La conversación se ha cerrado por inactividad. Si necesita ayuda, puede iniciar un nuevo contacto.';

function pgErrCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === 'string' ? c : undefined;
  }
  return undefined;
}

function mapDbError(res: express.Response, error: unknown, context: string): void {
  const code = pgErrCode(error);
  console.error(`[admin widget-politicas-inactividad] ${context}:`, error);
  if (code === '42P01') {
    res.status(503).json({
      error: 'Tabla no encontrada',
      message: 'Aplique las migraciones en el backend: npm run migrate:latest',
    });
    return;
  }
  const detail =
    process.env.NODE_ENV !== 'production' && error instanceof Error ? error.message : undefined;
  res.status(500).json({
    error: 'Error interno del servidor',
    ...(detail ? { detail } : {}),
  });
}

async function ensurePoliticaRow() {
  let politica = await db(TABLA).orderBy('id', 'asc').first();
  if (!politica) {
    await db(TABLA).insert({
      inactividad_total_minutos: 15,
      mensaje_aviso_1: M1,
      mensaje_aviso_2: M2,
      mensaje_cierre: MC,
      activo: true,
    });
    politica = await db(TABLA).orderBy('id', 'asc').first();
  }
  return politica;
}

/** GET / — política global de inactividad del widget */
router.get('/', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const politica = await ensurePoliticaRow();
    res.json({ politica });
  } catch (error) {
    return mapDbError(res, error, 'GET');
  }
});

/** PUT / — actualizar política global */
router.put('/', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await ensurePoliticaRow();

    const {
      inactividad_total_minutos,
      numero_avisos_inactividad,
      mensaje_aviso_1,
      mensaje_aviso_2,
      mensaje_cierre,
      activo,
    } = req.body as Record<string, unknown>;

    const campos: Record<string, unknown> = {
      actualizado_en: new Date(),
    };

    if (inactividad_total_minutos !== undefined) {
      const n = Number(inactividad_total_minutos);
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({ error: 'inactividad_total_minutos debe ser un entero ≥ 1' });
      }
      campos.inactividad_total_minutos = Math.floor(n);
    }
    if (numero_avisos_inactividad !== undefined) {
      const n = Number(numero_avisos_inactividad);
      if (!Number.isFinite(n) || n < 0 || n > 30 || Math.floor(n) !== n) {
        return res.status(400).json({ error: 'numero_avisos_inactividad debe ser un entero entre 0 y 30' });
      }
      campos.numero_avisos_inactividad = n;
    }
    if (mensaje_aviso_1 !== undefined) {
      const t = String(mensaje_aviso_1).trim();
      if (!t) return res.status(400).json({ error: 'mensaje_aviso_1 no puede estar vacío' });
      campos.mensaje_aviso_1 = t;
    }
    if (mensaje_aviso_2 !== undefined) {
      const t = String(mensaje_aviso_2).trim();
      if (!t) return res.status(400).json({ error: 'mensaje_aviso_2 no puede estar vacío' });
      campos.mensaje_aviso_2 = t;
    }
    if (mensaje_cierre !== undefined) {
      const t = String(mensaje_cierre).trim();
      if (!t) return res.status(400).json({ error: 'mensaje_cierre no puede estar vacío' });
      campos.mensaje_cierre = t;
    }
    if (activo !== undefined) {
      campos.activo = Boolean(activo);
    }

    const primera = await db(TABLA).orderBy('id', 'asc').first();
    if (!primera) {
      return res.status(500).json({ error: 'No se encontró fila de política' });
    }

    await db(TABLA).where({ id: primera.id }).update(campos);

    const politica = await db(TABLA).where({ id: primera.id }).first();
    res.json({ message: 'Política actualizada', politica });
  } catch (error) {
    return mapDbError(res, error, 'PUT');
  }
});

export default router;
