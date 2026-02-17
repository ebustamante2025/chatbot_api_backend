import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('usuarios_soporte', (table) => {
    table.string('sesion_token', 500).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('usuarios_soporte', (table) => {
    table.dropColumn('sesion_token');
  });
}
