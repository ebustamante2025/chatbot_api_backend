import type { Knex } from 'knex';

/**
 * Permite hasta dos conversaciones activas por contacto:
 * - una de soporte humano (cualquier canal distinto de IA360_DOC: WEB, TELEGRAM, …)
 * - una exclusiva de documentación IA360 (canal IA360_DOC)
 *
 * Sustituye uq_conversacion_activa_por_contacto por índice único en
 * (empresa_id, contacto_id, bucket) con bucket 0 = soporte, 1 = IA360_DOC.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uq_conversacion_activa_por_contacto');

  await knex.raw(`
    CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto_bucket
    ON conversaciones (
      empresa_id,
      contacto_id,
      (CASE WHEN COALESCE(TRIM(canal), '') = 'IA360_DOC' THEN 1 ELSE 0 END)
    )
    WHERE estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA')
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uq_conversacion_activa_por_contacto_bucket');

  await knex.raw(`
    CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto
    ON conversaciones (empresa_id, contacto_id)
    WHERE estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA')
  `);
}
