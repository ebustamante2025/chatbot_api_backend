import { db } from '../database/connection.js';

const ESTADOS_ACTIVOS = ['EN_COLA', 'ASIGNADA', 'ACTIVA'] as const;

/** Canal reservado al asistente de documentación (historial y hilo separados del soporte humano). */
export const CANAL_IA360_DOC = 'IA360_DOC';

export type ConversacionRow = Record<string, unknown> & { id_conversacion: number; canal?: string };

/**
 * Única conversación activa de soporte humano (web, Telegram, etc.), excluye IA360_DOC.
 */
export async function findConversacionActivaSoporte(
  empresaId: number,
  contactoId: number
): Promise<ConversacionRow | undefined> {
  const row = await db('conversaciones')
    .where({ empresa_id: empresaId, contacto_id: contactoId })
    .whereIn('estado', [...ESTADOS_ACTIVOS])
    .whereRaw("COALESCE(TRIM(canal), '') <> ?", [CANAL_IA360_DOC])
    .orderBy('ultima_actividad_en', 'desc')
    .orderBy('id_conversacion', 'desc')
    .first();
  return row as ConversacionRow | undefined;
}

/**
 * Única conversación activa del hilo IA360 (documentación) para el contacto.
 */
export async function findConversacionActivaIa360(
  empresaId: number,
  contactoId: number
): Promise<ConversacionRow | undefined> {
  const row = await db('conversaciones')
    .where({
      empresa_id: empresaId,
      contacto_id: contactoId,
      canal: CANAL_IA360_DOC,
    })
    .whereIn('estado', [...ESTADOS_ACTIVOS])
    .orderBy('ultima_actividad_en', 'desc')
    .orderBy('id_conversacion', 'desc')
    .first();
  return row as ConversacionRow | undefined;
}
