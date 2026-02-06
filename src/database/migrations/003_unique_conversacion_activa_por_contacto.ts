import type { Knex } from 'knex';

/**
 * Índice único parcial: un contacto solo puede tener una conversación activa
 * (EN_COLA o ASIGNADA) por empresa. Evita duplicados por condición de carrera.
 * Antes se cierran conversaciones duplicadas existentes (se deja la más reciente).
 */
export async function up(knex: Knex): Promise<void> {
  // Cerrar duplicados: por cada (empresa_id, contacto_id) con más de una activa, dejar solo la más reciente
  const duplicados = await knex('conversaciones')
    .select('empresa_id', 'contacto_id')
    .whereIn('estado', ['EN_COLA', 'ASIGNADA'])
    .groupBy('empresa_id', 'contacto_id')
    .havingRaw('count(*) > 1');

  for (const d of duplicados) {
    const idsAMantener = await knex('conversaciones')
      .where({ empresa_id: d.empresa_id, contacto_id: d.contacto_id })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA'])
      .orderBy('creada_en', 'desc')
      .limit(1)
      .pluck('id_conversacion');

    await knex('conversaciones')
      .where({ empresa_id: d.empresa_id, contacto_id: d.contacto_id })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA'])
      .whereNotIn('id_conversacion', idsAMantener)
      .update({ estado: 'CERRADA', cerrada_en: knex.fn.now(), ultima_actividad_en: knex.fn.now() });
  }

  await knex.raw(`
    CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto
    ON conversaciones (empresa_id, contacto_id)
    WHERE estado IN ('EN_COLA', 'ASIGNADA')
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uq_conversacion_activa_por_contacto');
}
