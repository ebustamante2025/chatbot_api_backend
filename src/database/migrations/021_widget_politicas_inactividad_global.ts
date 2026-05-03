import type { Knex } from 'knex';

/**
 * Una sola política de inactividad del widget para todo el sistema (todas las empresas).
 * Migra datos desde empresa_widget_politicas (primera empresa por id) si existía.
 */
export async function up(knex: Knex): Promise<void> {
  const tieneEmpresaPoliticas = await knex.schema.hasTable('empresa_widget_politicas');

  await knex.schema.createTable('widget_politicas_inactividad', (table) => {
    table.bigIncrements('id').primary();
    table.integer('inactividad_total_minutos').notNullable().defaultTo(15);
    table
      .text('mensaje_aviso_1')
      .notNullable()
      .defaultTo(
        'Lleva un tiempo sin escribir. Recuerde que el chat puede cerrarse por inactividad si no envía un mensaje.'
      );
    table
      .text('mensaje_aviso_2')
      .notNullable()
      .defaultTo(
        'Sigue sin actividad por su parte. Si no escribe pronto, la conversación se cerrará automáticamente.'
      );
    table
      .text('mensaje_cierre')
      .notNullable()
      .defaultTo('La conversación se ha cerrado por inactividad. Si necesita ayuda, puede iniciar un nuevo contacto.');
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE widget_politicas_inactividad
    ADD CONSTRAINT chk_widget_inactividad_total_minutos
    CHECK (inactividad_total_minutos > 0)
  `);

  if (tieneEmpresaPoliticas) {
    const fila = await knex('empresa_widget_politicas').select('*').orderBy('empresa_id', 'asc').first();
    if (fila) {
      await knex('widget_politicas_inactividad').insert({
        inactividad_total_minutos: fila.inactividad_total_minutos,
        mensaje_aviso_1: fila.mensaje_aviso_1,
        mensaje_aviso_2: fila.mensaje_aviso_2,
        mensaje_cierre: fila.mensaje_cierre,
        activo: fila.activo,
      });
    } else {
      await knex.raw('INSERT INTO widget_politicas_inactividad DEFAULT VALUES');
    }
    await knex.schema.dropTable('empresa_widget_politicas');
  } else {
    await knex.raw('INSERT INTO widget_politicas_inactividad DEFAULT VALUES');
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE widget_politicas_inactividad DROP CONSTRAINT IF EXISTS chk_widget_inactividad_total_minutos');
  await knex.schema.dropTableIfExists('widget_politicas_inactividad');

  await knex.schema.createTable('empresa_widget_politicas', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('empresa_id').notNullable().unique();
    table.foreign('empresa_id').references('id_empresa').inTable('empresas').onDelete('CASCADE');
    table.integer('inactividad_total_minutos').notNullable().defaultTo(15);
    table
      .text('mensaje_aviso_1')
      .notNullable()
      .defaultTo(
        'Lleva un tiempo sin escribir. Recuerde que el chat puede cerrarse por inactividad si no envía un mensaje.'
      );
    table
      .text('mensaje_aviso_2')
      .notNullable()
      .defaultTo(
        'Sigue sin actividad por su parte. Si no escribe pronto, la conversación se cerrará automáticamente.'
      );
    table
      .text('mensaje_cierre')
      .notNullable()
      .defaultTo('La conversación se ha cerrado por inactividad. Si necesita ayuda, puede iniciar un nuevo contacto.');
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE empresa_widget_politicas
    ADD CONSTRAINT chk_inactividad_total_minutos
    CHECK (inactividad_total_minutos > 0)
  `);

  await knex.raw(`
    INSERT INTO empresa_widget_politicas (empresa_id)
    SELECT id_empresa FROM empresas
    ON CONFLICT (empresa_id) DO NOTHING
  `);
}
