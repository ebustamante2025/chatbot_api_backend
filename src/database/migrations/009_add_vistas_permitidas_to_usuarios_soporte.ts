import type { Knex } from 'knex';

/**
 * vistas_permitidas: array JSON de códigos de vistas que el usuario puede ver.
 * Si es null o vacío, se usa la lógica por rol (TABS_POR_ROL y todas las secciones del admin).
 *
 * Códigos de tabs: asesor, administrador, supervisor, ventas, admin_faq
 * Códigos de secciones dentro del panel Administrador: dashboard, dashboard-bot, transferencias, usuarios, empresas
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('usuarios_soporte', (table) => {
    table.json('vistas_permitidas').nullable(); // array de strings: códigos de tabs y secciones admin
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('usuarios_soporte', (table) => {
    table.dropColumn('vistas_permitidas');
  });
}
