import type { Knex } from 'knex';

/**
 * Mensajes del asistente de documentación (IA360 / Streamlit), vinculados a empresa y contacto del token FAQ.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ia360_doc_mensajes', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('contacto_id').notNullable();
    table.string('servicio', 120);
    table.string('rol', 20).notNullable(); // usuario | asistente
    table.text('contenido').notNullable();
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('CASCADE');

    table.index(['empresa_id', 'contacto_id', 'creado_en'], 'ix_ia360_doc_empresa_contacto_fecha');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ia360_doc_mensajes');
}
