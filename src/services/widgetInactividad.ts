import type { Knex } from 'knex';
import { db } from '../database/connection.js';
import { getIO } from '../socket.js';

/** Canal del widget “Chatear con agente” (debe coincidir con el front). */
export const CANAL_WIDGET_AGENTE = 'WEB_AGENTE';

/** Prefijo para mensajes visibles solo en el CRM (el widget los filtra por este marcador). */
export const PREFIJO_SOLO_ASESOR = '[solo-asesor]';

/** Instrucciones al asesor cuando la conversación se cierra por inactividad. */
const MENSAJE_INTERNO_CIERRE_INACTIVIDAD =
  `${PREFIJO_SOLO_ASESOR}\n` +
  `⏱️ La conversación fue cerrada automáticamente por inactividad del cliente.\n\n` +
  `✅ Acción requerida:\n` +
  `   1. Abrir el menú de esta conversación.\n` +
  `   2. Seleccionar "Finalizar la conversación".\n\n` +
  `ℹ️ Una vez finalizada, el cliente podrá solicitar soporte nuevamente realizando una nueva validación con sus datos de acceso.`;

type PoliticaRow = {
  activo: boolean;
  inactividad_total_minutos: number;
  numero_avisos_inactividad?: number | null;
  mensaje_aviso_1: string;
  mensaje_aviso_2: string;
  mensaje_cierre: string;
};

type ConversacionRow = {
  id_conversacion: number;
  empresa_id: number;
  estado: string;
  canal?: string | null;
  asignada_a_usuario_id?: number | null;
  ultima_actividad_cliente_en: string | Date;
  inactividad_fase?: number | null;
};

async function cargarPolitica(): Promise<PoliticaRow | null> {
  try {
    const p = await db('widget_politicas_inactividad').orderBy('id', 'asc').first();
    if (!p || !p.activo) return null;
    return p as PoliticaRow;
  } catch {
    return null;
  }
}

async function mensajeConDetalle(idMensaje: number) {
  return db('mensajes')
    .select(
      'mensajes.*',
      'contactos.nombre as contacto_nombre',
      'usuarios_soporte.username as agente_username',
      'usuarios_soporte.nombre_completo as agente_nombre_completo'
    )
    .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
    .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
    .where('mensajes.id_mensaje', idMensaje)
    .first();
}

function textoAviso(indice0: number, m1: string, m2: string): string {
  return indice0 === 0 ? m1 : m2;
}

function segundosInactividad(ref: Date, nowMs: number): number {
  return Math.max(0, (nowMs - ref.getTime()) / 1000);
}

function umbralesAvisos(totalMinutos: number, N: number): { umbralesSec: number[]; cierreSec: number } {
  const Tsec = Math.max(1, totalMinutos) * 60;
  if (N <= 0) return { umbralesSec: [], cierreSec: Tsec };
  const umbralesSec: number[] = [];
  for (let k = 1; k <= N; k++) {
    umbralesSec.push((k * Tsec) / (N + 1));
  }
  return { umbralesSec, cierreSec: Tsec };
}

async function insertarSistema(trx: Knex.Transaction, empresaId: number, conversacionId: number, contenido: string) {
  const [row] = await trx('mensajes')
    .insert({
      empresa_id: empresaId,
      conversacion_id: conversacionId,
      tipo_emisor: 'SISTEMA',
      contenido,
    })
    .returning('*');
  return Number((row as { id_mensaje: number }).id_mensaje);
}

function emitirNuevoMensaje(
  conversacionId: number,
  detalle: Record<string, unknown>,
  asignadaA: number | null | undefined
) {
  const socketIO = getIO();
  if (!socketIO) return;
  socketIO.to(`conversation:${conversacionId}`).emit('new_message', detalle);
  if (asignadaA) {
    socketIO.to(`agent:${asignadaA}`).emit('conversation_new_activity', {
      id_conversacion: conversacionId,
    });
  }
  socketIO.to('crm').emit('crm_activity', {
    id_conversacion: conversacionId,
    tipo_emisor: 'SISTEMA',
  });
}

async function emitirCierreWidget(
  conversacionId: number,
  textoCierre: string,
  idMensajeCierre: number,
  asignadaA: number | null | undefined
) {
  const socketIO = getIO();
  if (!socketIO) return;
  const detalle = (await mensajeConDetalle(idMensajeCierre)) || (await db('mensajes').where('id_mensaje', idMensajeCierre).first());
  if (detalle) {
    socketIO.to(`conversation:${conversacionId}`).emit('new_message', detalle);
  }
  socketIO.to(`conversation:${conversacionId}`).emit('conversation_closed', {
    id_conversacion: conversacionId,
    estado: 'CERRADA',
    mensaje_cierre: textoCierre.trim(),
  });
  socketIO.emit('conversation_updated', {
    id_conversacion: conversacionId,
    estado: 'CERRADA',
  });
  if (asignadaA) {
    socketIO.to(`agent:${asignadaA}`).emit('conversation_new_activity', { id_conversacion: conversacionId });
  }
  socketIO.to('crm').emit('crm_activity', {
    id_conversacion: conversacionId,
    tipo_emisor: 'SISTEMA',
  });
}

type ResultadoTrx = {
  asignadaA: number | null;
  avisosMsgIds: number[];
  cierre?: { convId: number; msgId: number; texto: string; asignadaA: number | null; msgIdInterno?: number };
};

async function procesarEnTransaccion(
  trx: Knex.Transaction,
  conv: ConversacionRow,
  politica: PoliticaRow,
  nowMs: number
): Promise<ResultadoTrx | null> {
  const ref = new Date(conv.ultima_actividad_cliente_en);
  if (Number.isNaN(ref.getTime())) return null;

  const T = Math.max(1, Math.floor(Number(politica.inactividad_total_minutos) || 15));
  const N = Math.min(30, Math.max(0, Math.floor(Number(politica.numero_avisos_inactividad ?? 2))));
  const elapsed = segundosInactividad(ref, nowMs);
  const { umbralesSec, cierreSec } = umbralesAvisos(T, N);

  // Centinela 99: el cliente solicitó cierre explícitamente; no aplicar avisos ni cierre automático por inactividad.
  if (Number(conv.inactividad_fase) >= 99) return null;

  let fase = Math.min(30, Math.max(0, Math.floor(Number(conv.inactividad_fase ?? 0))));
  const id = Number(conv.id_conversacion);
  const empresaId = Number(conv.empresa_id);
  const asignada = conv.asignada_a_usuario_id != null ? Number(conv.asignada_a_usuario_id) : null;

  const avisosMsgIds: number[] = [];

  while (fase < N && umbralesSec.length > 0) {
    const umbral = umbralesSec[fase];
    if (elapsed < umbral) break;
    const texto = textoAviso(fase, politica.mensaje_aviso_1, politica.mensaje_aviso_2);
    const mid = await insertarSistema(trx, empresaId, id, texto);
    avisosMsgIds.push(mid);
    fase += 1;
    await trx('conversaciones').where('id_conversacion', id).update({ inactividad_fase: fase });
  }

  if (elapsed < cierreSec) {
    return avisosMsgIds.length > 0 ? { asignadaA: asignada, avisosMsgIds } : null;
  }

  const rows = await trx('conversaciones')
    .where('id_conversacion', id)
    .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
    .update({
      estado: 'CERRADA',
      cerrada_en: trx.raw('now()'),
      ultima_actividad_en: trx.raw('now()'),
    })
    .returning('id_conversacion');

  if (!rows || rows.length === 0) {
    return avisosMsgIds.length > 0 ? { asignadaA: asignada, avisosMsgIds } : null;
  }

  const textoCierre = politica.mensaje_cierre.trim();
  const cierreMsgId = await insertarSistema(trx, empresaId, id, textoCierre);
  // Mensaje interno solo visible para el asesor en el CRM (el widget lo filtra por el prefijo).
  const internoMsgId = await insertarSistema(trx, empresaId, id, MENSAJE_INTERNO_CIERRE_INACTIVIDAD);

  return {
    asignadaA: asignada,
    avisosMsgIds,
    cierre: { convId: id, msgId: cierreMsgId, texto: textoCierre, asignadaA: asignada, msgIdInterno: internoMsgId },
  };
}

/** Una pasada del job: conversaciones WEB_AGENTE con reloj del contacto. */
export async function ejecutarTickInactividadWidget(): Promise<void> {
  const politica = await cargarPolitica();
  if (!politica) return;

  // Solo chats ya tomados por un asesor: en EN_COLA el contacto aún no “está en sesión” y no debe recibir avisos/cierre por inactividad.
  // Conversaciones antiguas sin reloj: iniciar a partir de “ahora” para no cerrar por datos viejos
  await db('conversaciones')
    .where({ canal: CANAL_WIDGET_AGENTE })
    .whereIn('estado', ['ASIGNADA', 'ACTIVA'])
    .whereNull('ultima_actividad_cliente_en')
    .update({
      ultima_actividad_cliente_en: db.raw('now()'),
      inactividad_fase: 0,
    });

  const ids = (await db('conversaciones')
    .where({ canal: CANAL_WIDGET_AGENTE })
    .whereIn('estado', ['ASIGNADA', 'ACTIVA'])
    .whereNotNull('ultima_actividad_cliente_en')
    .select('id_conversacion')) as { id_conversacion: number }[];

  const nowMs = Date.now();

  for (const row of ids) {
    const id = Number(row.id_conversacion);
    try {
      const resultado = await db.transaction(async (trx) => {
        const conv = (await trx('conversaciones').where('id_conversacion', id).forUpdate().first()) as
          | ConversacionRow
          | undefined;
        if (!conv) return null;
        if (String(conv.canal || '').trim() !== CANAL_WIDGET_AGENTE) return null;
        if (!['ASIGNADA', 'ACTIVA'].includes(String(conv.estado))) return null;
        if (!conv.ultima_actividad_cliente_en) return null;

        return procesarEnTransaccion(trx, conv, politica, nowMs);
      });

      if (!resultado) continue;

      for (const mid of resultado.avisosMsgIds) {
        const detalle = (await mensajeConDetalle(mid)) || (await db('mensajes').where('id_mensaje', mid).first());
        if (detalle) emitirNuevoMensaje(id, detalle as Record<string, unknown>, resultado.asignadaA);
      }

      if (resultado.cierre) {
        await emitirCierreWidget(
          resultado.cierre.convId,
          resultado.cierre.texto,
          resultado.cierre.msgId,
          resultado.cierre.asignadaA
        );
        // Emitir el mensaje interno (solo-asesor) al CRM tras el cierre.
        if (resultado.cierre.msgIdInterno) {
          const detalleInterno = (await mensajeConDetalle(resultado.cierre.msgIdInterno))
            || (await db('mensajes').where('id_mensaje', resultado.cierre.msgIdInterno).first());
          if (detalleInterno) emitirNuevoMensaje(resultado.cierre.convId, detalleInterno as Record<string, unknown>, resultado.cierre.asignadaA);
        }
      }
    } catch (e) {
      console.error('[inactividad widget] conversación', id, e);
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startWidgetInactividadTicker(): void {
  if (intervalId) return;
  if (String(process.env.INACTIVIDAD_WIDGET_ENABLED || '').toLowerCase() === 'false') {
    console.log('[inactividad widget] Ticker desactivado (INACTIVIDAD_WIDGET_ENABLED=false)');
    return;
  }
  const rawMs = Number(process.env.INACTIVIDAD_WIDGET_INTERVAL_MS);
  const ms = Math.max(5000, Math.min(300_000, Number.isFinite(rawMs) && rawMs > 0 ? rawMs : 30_000));
  intervalId = setInterval(() => {
    void ejecutarTickInactividadWidget().catch((e) => console.error('[inactividad widget] tick:', e));
  }, ms);
  console.log(`[inactividad widget] Ticker cada ${ms} ms`);
}

export function stopWidgetInactividadTicker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
