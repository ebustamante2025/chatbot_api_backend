import type { Knex } from 'knex';

/**
 * La persistencia del asistente IA360 documentación pasa solo por `mensajes` + `conversaciones` (canal IA360_DOC).
 * Elimina la tabla auxiliar si existía (migración 011).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ia360_doc_mensajes');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable('ia360_doc_mensajes', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('contacto_id').notNullable();
    table.string('servicio', 120);
    table.string('rol', 20).notNullable();
    table.text('contenido').notNullable();
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());
    table.foreign('empresa_id').references('id_empresa').inTable('empresas').onDelete('CASCADE');
    table.foreign('contacto_id').references('id_contacto').inTable('contactos').onDelete('CASCADE');
    table.index(['empresa_id', 'contacto_id', 'creado_en'], 'ix_ia360_doc_empresa_contacto_fecha');
  });
}
