import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('contactos', (table) => {
    table.string('cargo', 100).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('contactos', (table) => {
    table.dropColumn('cargo');
  });
}
