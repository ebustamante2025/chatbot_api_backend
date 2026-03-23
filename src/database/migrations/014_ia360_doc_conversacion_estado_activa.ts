import type { Knex } from 'knex';

/**
 * Las conversaciones IA360_DOC deben usar el mismo modelo de estados que el resto.
 * Antes se insertaban como CERRADA para no aparecer en cola; se unifica a ACTIVA + prioridad.
 */
export async function up(knex: Knex): Promise<void> {
  await knex('conversaciones')
    .where('canal', 'IA360_DOC')
    .where('estado', 'CERRADA')
    .update({
      estado: 'ACTIVA',
      prioridad: 'MEDIA',
      ultima_actividad_en: knex.fn.now(),
    });
}

export async function down(knex: Knex): Promise<void> {
  // No revertimos a CERRADA: podría mezclar hilos ya tratados como ACTIVA por negocio.
  await knex.raw('SELECT 1');
}
