import type { Knex } from 'knex';

/**
 * El servicio elegido no se persiste en telegram_contactos: se notifica vía webhook
 * y mensaje en la conversación al completar el registro.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('telegram_contactos', 'servicio_soporte');
  if (has) {
    await knex.schema.table('telegram_contactos', (table) => {
      table.dropColumn('servicio_soporte');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('telegram_contactos', (table) => {
    table.string('servicio_soporte', 255).nullable();
  });
}
