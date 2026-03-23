import type { Knex } from 'knex';

/**
 * Tabla telegram_contactos: vincula chat_id de Telegram con contacto_id y empresa_id
 * para recibir y enviar mensajes por Telegram y guardarlos en conversaciones/mensajes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('telegram_contactos', (table) => {
    table.bigIncrements('id').primary();
    table.string('chat_id', 64).notNullable().unique();
    table.bigInteger('contacto_id').notNullable();
    table.bigInteger('empresa_id').notNullable();
    table.string('telegram_user_id', 64).nullable();
    table.string('telegram_username', 120).nullable();
    table.string('nombre_telegram', 200).nullable();
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());
    table.timestamp('ultima_actividad_en').notNullable().defaultTo(knex.fn.now());

    table
      .foreign('contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('CASCADE');
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
  });

  await knex.schema.table('telegram_contactos', (table) => {
    table.index(['contacto_id', 'empresa_id'], 'ix_telegram_contactos_contacto_empresa');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('telegram_contactos');
}
