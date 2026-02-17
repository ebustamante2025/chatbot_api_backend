import type { Knex } from 'knex';

/**
 * Actualizar el CHECK constraint para incluir el estado ACTIVA.
 * Estados permitidos: EN_COLA, ASIGNADA, ACTIVA, CERRADA
 */
export async function up(knex: Knex): Promise<void> {
  // Eliminar el constraint anterior
  await knex.raw('ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS chk_conversaciones_estado');

  // Crear el nuevo constraint con ACTIVA incluido
  await knex.raw(`
    ALTER TABLE conversaciones
    ADD CONSTRAINT chk_conversaciones_estado
    CHECK (estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA', 'CERRADA'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Volver al constraint original sin ACTIVA
  await knex.raw('ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS chk_conversaciones_estado');

  // Convertir cualquier ACTIVA a ASIGNADA antes de restaurar
  await knex('conversaciones')
    .where('estado', 'ACTIVA')
    .update({ estado: 'ASIGNADA' });

  await knex.raw(`
    ALTER TABLE conversaciones
    ADD CONSTRAINT chk_conversaciones_estado
    CHECK (estado IN ('EN_COLA', 'ASIGNADA', 'CERRADA'))
  `);
}
