import type { Knex } from 'knex';

/**
 * @deprecated La columna se elimina en 019; se conserva esta migración por si ya se aplicó en algún entorno.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('telegram_contactos', 'servicio_soporte');
  if (!has) {
    await knex.schema.table('telegram_contactos', (table) => {
      table.string('servicio_soporte', 255).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('telegram_contactos', 'servicio_soporte');
  if (has) {
    await knex.schema.table('telegram_contactos', (table) => {
      table.dropColumn('servicio_soporte');
    });
  }
}
