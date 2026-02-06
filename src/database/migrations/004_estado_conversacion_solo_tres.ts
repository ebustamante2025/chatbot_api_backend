import type { Knex } from 'knex';

const ESTADOS_PERMITIDOS = ['EN_COLA', 'ASIGNADA', 'CERRADA'];

/**
 * El estado de una conversación solo puede ser: EN_COLA, ASIGNADA o CERRADA.
 */
export async function up(knex: Knex): Promise<void> {
  // Normalizar estados existentes que no sean los permitidos (p. ej. EN_BOT → EN_COLA)
  await knex('conversaciones')
    .whereNotIn('estado', ESTADOS_PERMITIDOS)
    .update({ estado: 'EN_COLA' });

  await knex.raw(`
    ALTER TABLE conversaciones
    ADD CONSTRAINT chk_conversaciones_estado
    CHECK (estado IN ('EN_COLA', 'ASIGNADA', 'CERRADA'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS chk_conversaciones_estado');
}
