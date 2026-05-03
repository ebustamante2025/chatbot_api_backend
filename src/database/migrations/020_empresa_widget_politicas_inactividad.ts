import type { Knex } from 'knex';

/**
 * Políticas de inactividad del contacto en el widget (avisos en tercios del tiempo total + cierre).
 * Nota: la migración 021 sustituye empresa_widget_politicas por widget_politicas_inactividad (regla global).
 *
 * conversaciones: ultima_actividad_cliente_en se actualiza al enviar mensaje CONTACTO;
 * inactividad_fase evita duplicar avisos (0 ninguno, 1 primer aviso, 2 segundo, 3 cerrada por inactividad).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('empresa_widget_politicas', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('empresa_id').notNullable().unique();
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');

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

  await knex.schema.table('conversaciones', (table) => {
    table.timestamp('ultima_actividad_cliente_en', { useTz: true }).nullable();
    table.specificType('inactividad_fase', 'smallint').notNullable().defaultTo(0);
  });

  await knex.raw(`
    CREATE INDEX ix_conversaciones_inactividad_cola
    ON conversaciones (estado, ultima_actividad_cliente_en)
    WHERE estado IN ('ASIGNADA', 'ACTIVA')
      AND ultima_actividad_cliente_en IS NOT NULL
  `);

  // Una fila por empresa ya existente (textos y minutos editables en esta tabla; CRM futuro).
  await knex.raw(`
    INSERT INTO empresa_widget_politicas (empresa_id)
    SELECT id_empresa FROM empresas
    ON CONFLICT (empresa_id) DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS ix_conversaciones_inactividad_cola');

  await knex.schema.table('conversaciones', (table) => {
    table.dropColumn('ultima_actividad_cliente_en');
    table.dropColumn('inactividad_fase');
  });

  await knex.raw('ALTER TABLE empresa_widget_politicas DROP CONSTRAINT IF EXISTS chk_inactividad_total_minutos');
  await knex.schema.dropTableIfExists('empresa_widget_politicas');
}
