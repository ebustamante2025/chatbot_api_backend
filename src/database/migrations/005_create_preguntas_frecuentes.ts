import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // =========================
  // TEMAS / CATEGORÍAS
  // =========================
  await knex.schema.createTable('temas_preguntas', (table) => {
    table.increments('id').primary();
    table.string('nombre', 150).notNullable();
    table.text('descripcion');
    table.integer('orden').defaultTo(1);
    table.boolean('estado').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Índice para ordenar temas
  await knex.schema.table('temas_preguntas', (table) => {
    table.index('orden', 'idx_temas_orden');
  });

  // =========================
  // PREGUNTAS FRECUENTES
  // =========================
  await knex.schema.createTable('preguntas_frecuentes', (table) => {
    table.increments('id').primary();
    table.integer('tema_id').notNullable();
    table.string('pregunta', 500).notNullable();
    table.text('respuesta').notNullable();
    table.integer('orden').defaultTo(1);
    table.boolean('estado').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Foreign key
    table
      .foreign('tema_id')
      .references('id')
      .inTable('temas_preguntas')
      .onDelete('CASCADE');
  });

  // Índices
  await knex.schema.table('preguntas_frecuentes', (table) => {
    table.index('tema_id', 'idx_preguntas_tema');
    table.index('orden', 'idx_preguntas_orden');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('preguntas_frecuentes');
  await knex.schema.dropTableIfExists('temas_preguntas');
}
