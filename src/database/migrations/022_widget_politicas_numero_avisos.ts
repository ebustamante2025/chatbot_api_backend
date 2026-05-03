import type { Knex } from 'knex';

/**
 * Cuántos mensajes de aviso se envían antes del cierre (0 = solo cierre al vencer el tiempo total).
 * Los instantes se reparten en (N+1) intervalos iguales sobre inactividad_total_minutos.
 */
export async function up(knex: Knex): Promise<void> {
  const existe = await knex.schema.hasColumn('widget_politicas_inactividad', 'numero_avisos_inactividad');
  if (existe) return;

  await knex.schema.alterTable('widget_politicas_inactividad', (table) => {
    table.integer('numero_avisos_inactividad').notNullable().defaultTo(2);
  });

  await knex.raw(`
    ALTER TABLE widget_politicas_inactividad
    ADD CONSTRAINT chk_numero_avisos_inactividad
    CHECK (numero_avisos_inactividad >= 0 AND numero_avisos_inactividad <= 30)
  `);
}

export async function down(knex: Knex): Promise<void> {
  const existe = await knex.schema.hasColumn('widget_politicas_inactividad', 'numero_avisos_inactividad');
  if (!existe) return;

  await knex.raw(
    'ALTER TABLE widget_politicas_inactividad DROP CONSTRAINT IF EXISTS chk_numero_avisos_inactividad'
  );
  await knex.schema.alterTable('widget_politicas_inactividad', (table) => {
    table.dropColumn('numero_avisos_inactividad');
  });
}
