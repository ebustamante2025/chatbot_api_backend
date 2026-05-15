import express from 'express';
import type { Request } from 'express';
import { db } from '../database/connection.js';
import {
  evaluarDisponibilidadAgenteHumano,
  type HorarioAgenteConfigRow,
  type HorarioExcepcionRow,
} from '../services/horarioAgenteWidget.js';

const router = express.Router();
const TABLA_CFG = 'widget_horario_agente_config';
const TABLA_EXC = 'widget_horario_excepciones';

type UserJwt = { id_usuario: number; username: string; rol: string };

function requireAdmin(req: Request & { user?: UserJwt }, res: express.Response): boolean {
  if (!req.user || req.user.rol !== 'ADMIN') {
    res.status(403).json({
      error: 'Acceso denegado',
      message: 'Solo administradores pueden gestionar el horario del widget',
    });
    return false;
  }
  return true;
}

async function ensureConfig(): Promise<HorarioAgenteConfigRow> {
  let row = (await db(TABLA_CFG).orderBy('id', 'asc').first()) as HorarioAgenteConfigRow | undefined;
  if (!row) {
    await db(TABLA_CFG).insert({
      zona_horaria: 'America/Bogota',
      lunes: true,
      martes: true,
      miercoles: true,
      jueves: true,
      viernes: true,
      sabado: true,
      domingo: false,
      hora_inicio: '08:00:00',
      hora_fin: '17:30:00',
      tooltip_fuera_horario:
        'En este momento nos encontramos fuera de horario laboral. Nuestro horario de atención es de lunes a sábado de 8:00 AM a 5:30 PM.',
      mensaje_fuera_horario:
        'Hola 👋 En este momento nuestro servicio de atención no está disponible.\n\nNuestro horario de atención es **lunes a sábado de 8:00 AM a 5:30 PM** (hora Colombia).\n\nPuedes dejarnos tu mensaje y te responderemos en el próximo horario hábil.',
    });
    row = (await db(TABLA_CFG).orderBy('id', 'asc').first()) as HorarioAgenteConfigRow;
  }
  return row;
}

/** GET /config */
router.get('/config', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const config = await ensureConfig();
    res.json({ config });
  } catch (e) {
    console.error('[admin horario agente] GET config:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

/** PUT /config */
router.put('/config', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const fila = await ensureConfig();
    const b = req.body as Record<string, unknown>;
    const campos: Record<string, unknown> = { actualizado_en: new Date() };

    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
    for (const d of days) {
      if (b[d] !== undefined) campos[d] = Boolean(b[d]);
    }
    if (b.hora_inicio !== undefined) {
      const t = String(b.hora_inicio).trim();
      if (!/^\d{1,2}:\d{2}/.test(t)) {
        return res.status(400).json({ error: 'hora_inicio inválida (use HH:MM)' });
      }
      campos.hora_inicio = t.length === 5 ? `${t}:00` : t;
    }
    if (b.hora_fin !== undefined) {
      const t = String(b.hora_fin).trim();
      if (!/^\d{1,2}:\d{2}/.test(t)) {
        return res.status(400).json({ error: 'hora_fin inválida (use HH:MM)' });
      }
      campos.hora_fin = t.length === 5 ? `${t}:00` : t;
    }
    if (b.tooltip_fuera_horario !== undefined) {
      campos.tooltip_fuera_horario = String(b.tooltip_fuera_horario).trim() || null;
    }
    if (b.mensaje_fuera_horario !== undefined) {
      campos.mensaje_fuera_horario = String(b.mensaje_fuera_horario).trim() || null;
    }

    await db(TABLA_CFG).where('id', fila.id).update(campos);
    const config = await ensureConfig();
    res.json({ config, message: 'Guardado' });
  } catch (e) {
    console.error('[admin horario agente] PUT config:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

/** GET /excepciones */
router.get('/excepciones', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const lista = (await db(TABLA_EXC).orderBy('fecha', 'desc').select('*')) as HorarioExcepcionRow[];
    res.json({ excepciones: lista });
  } catch (e) {
    console.error('[admin horario agente] GET excepciones:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

/** POST /excepciones */
router.post('/excepciones', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { fecha, tipo, hora_inicio, hora_fin, nota, activo } = req.body as Record<string, unknown>;
    if (!fecha || typeof fecha !== 'string') {
      return res.status(400).json({ error: 'fecha requerida (YYYY-MM-DD)' });
    }
    const tipoS = String(tipo);
    if (tipoS !== 'cerrado' && tipoS !== 'horario_especial') {
      return res.status(400).json({ error: 'tipo debe ser cerrado o horario_especial' });
    }
    if (tipoS === 'horario_especial') {
      if (!hora_inicio || !hora_fin) {
        return res.status(400).json({ error: 'horario_especial requiere hora_inicio y hora_fin' });
      }
    }
    const hi =
      hora_inicio && String(hora_inicio).trim()
        ? String(hora_inicio).trim().length === 5
          ? `${String(hora_inicio).trim()}:00`
          : String(hora_inicio).trim()
        : null;
    const hf =
      hora_fin && String(hora_fin).trim()
        ? String(hora_fin).trim().length === 5
          ? `${String(hora_fin).trim()}:00`
          : String(hora_fin).trim()
        : null;

    const fechaStr = String(fecha).slice(0, 10);
    const existing = await db(TABLA_EXC).where({ fecha: fechaStr }).first();
    const payload = {
      fecha: fechaStr,
      tipo: tipoS,
      hora_inicio: tipoS === 'horario_especial' ? hi : null,
      hora_fin: tipoS === 'horario_especial' ? hf : null,
      nota: nota != null ? String(nota).trim() || null : null,
      activo: activo !== undefined ? Boolean(activo) : true,
      actualizado_en: new Date(),
    };
    if (existing) {
      await db(TABLA_EXC).where('id', (existing as { id: number }).id).update(payload);
    } else {
      await db(TABLA_EXC).insert({
        ...payload,
        creado_en: new Date(),
      });
    }

    const lista = (await db(TABLA_EXC).orderBy('fecha', 'desc').select('*')) as HorarioExcepcionRow[];
    res.json({ excepciones: lista, message: 'Guardado' });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? (e as { code?: string }).code : undefined;
    console.error('[admin horario agente] POST excepciones:', e);
    if (code === '42P01') {
      return res.status(503).json({ error: 'Ejecute migraciones: npm run migrate:latest' });
    }
    res.status(500).json({ error: 'Error al guardar excepción' });
  }
});

/** DELETE /excepciones/:id */
router.delete('/excepciones/:id', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await db(TABLA_EXC).where('id', id).delete();
    const lista = (await db(TABLA_EXC).orderBy('fecha', 'desc').select('*')) as HorarioExcepcionRow[];
    res.json({ excepciones: lista, message: 'Eliminado' });
  } catch (e) {
    console.error('[admin horario agente] DELETE:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

/** GET /estado-actual */
router.get('/estado-actual', async (req: Request & { user?: UserJwt }, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const r = await evaluarDisponibilidadAgenteHumano();
    res.json({
      disponible: r.disponible,
      codigo: r.codigo,
      razon: r.razon,
      proximo_resumen: r.proximo_resumen,
      es_festivo: r.es_festivo,
      nombre_festivo: r.nombre_festivo,
    });
  } catch (e) {
    console.error('[admin horario agente] estado:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
