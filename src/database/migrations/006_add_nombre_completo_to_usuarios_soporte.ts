import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('usuarios_soporte', (table) => {
    table.string('nombre_completo', 200).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('usuarios_soporte', (table) => {
    table.dropColumn('nombre_completo');
  });
}
