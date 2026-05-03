import type { Knex } from 'knex';

/**
 * Tabla menus_wid: configuración global de visibilidad del menú del widget.
 * No es por empresa: aplica a todos los usuarios del widget.
 * Solo hay 4 filas fijas (una por cada opción del menú).
 */
export async function up(knex: Knex): Promise<void> {
  const existe = await knex.schema.hasTable('menus_wid');
  if (existe) return;

  await knex.schema.createTable('menus_wid', (table) => {
    table.bigIncrements('id').primary();
    table.string('clave', 50).notNullable().unique();
    table.string('nombre', 120).notNullable();
    table.string('descripcion', 255);
    table.boolean('activo').notNullable().defaultTo(true);
    table.integer('orden').notNullable().defaultTo(0);
    table.timestamp('actualizado_en').notNullable().defaultTo(knex.fn.now());
  });

  // Insertar las 4 opciones por defecto (todas activas)
  await knex('menus_wid').insert([
    { clave: 'frecuentes', nombre: 'Preguntas frecuentes', descripcion: 'Consulta respuestas rápidas',      activo: true, orden: 1 },
    { clave: 'bot',        nombre: 'Hablar con Isa',        descripcion: 'Isa · Asistente virtual 24/7',     activo: true, orden: 2 },
    { clave: 'agente',     nombre: 'Chatear con un agente', descripcion: 'Atención humana en vivo',          activo: true, orden: 3 },
    { clave: 'prueba',     nombre: 'Prueba',                descripcion: 'Opción de prueba',                 activo: true, orden: 4 },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('menus_wid');
}
