import type { Knex } from 'knex';

/**
 * Horario global del widget para "chatear con agente" (Colombia / festivos Nager / excepciones admin).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('widget_horario_agente_config', (table) => {
    table.increments('id').primary();
    table.string('zona_horaria', 64).notNullable().defaultTo('America/Bogota');
    table.boolean('lunes').notNullable().defaultTo(true);
    table.boolean('martes').notNullable().defaultTo(true);
    table.boolean('miercoles').notNullable().defaultTo(true);
    table.boolean('jueves').notNullable().defaultTo(true);
    table.boolean('viernes').notNullable().defaultTo(true);
    table.boolean('sabado').notNullable().defaultTo(true);
    table.boolean('domingo').notNullable().defaultTo(false);
    table.time('hora_inicio').notNullable().defaultTo('08:00:00');
    table.time('hora_fin').notNullable().defaultTo('17:30:00');
    table.text('tooltip_fuera_horario').nullable();
    table.text('mensaje_fuera_horario').nullable();
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex('widget_horario_agente_config').insert({
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

  await knex.schema.createTable('widget_horario_excepciones', (table) => {
    table.increments('id').primary();
    table.date('fecha').notNullable();
    table.string('tipo', 24).notNullable(); // cerrado | horario_especial
    table.time('hora_inicio').nullable();
    table.time('hora_fin').nullable();
    table.text('nota').nullable();
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamp('creado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('actualizado_en', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['fecha'], 'ux_widget_horario_excepciones_fecha');
  });

  await knex.raw(`
    ALTER TABLE widget_horario_excepciones
    ADD CONSTRAINT chk_widget_horario_excepciones_tipo
    CHECK (tipo IN ('cerrado', 'horario_especial'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'ALTER TABLE widget_horario_excepciones DROP CONSTRAINT IF EXISTS chk_widget_horario_excepciones_tipo',
  );
  await knex.schema.dropTableIfExists('widget_horario_excepciones');
  await knex.schema.dropTableIfExists('widget_horario_agente_config');
}
