import type { Knex } from 'knex';

/**
 * Una conversación activa por (empresa_id, contacto_id, canal).
 * Permite hilos separados: Isa (WEB_ISA), agente humano (WEB_AGENTE), documentación (IA360_DOC), etc.
 * Sustituye el índice único solo (empresa_id, contacto_id).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uq_conversacion_activa_por_contacto');

  const duplicados = await knex('conversaciones')
    .select('empresa_id', 'contacto_id', 'canal')
    .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
    .groupBy('empresa_id', 'contacto_id', 'canal')
    .havingRaw('count(*) > 1');

  for (const d of duplicados) {
    const idsAMantener = await knex('conversaciones')
      .where({
        empresa_id: d.empresa_id,
        contacto_id: d.contacto_id,
        canal: d.canal,
      })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
      .orderBy('creada_en', 'desc')
      .limit(1)
      .pluck('id_conversacion');

    await knex('conversaciones')
      .where({
        empresa_id: d.empresa_id,
        contacto_id: d.contacto_id,
        canal: d.canal,
      })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
      .whereNotIn('id_conversacion', idsAMantener)
      .update({
        estado: 'CERRADA',
        cerrada_en: knex.fn.now(),
        ultima_actividad_en: knex.fn.now(),
      });
  }

  await knex.raw(`
    CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto_canal
    ON conversaciones (empresa_id, contacto_id, canal)
    WHERE estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA')
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uq_conversacion_activa_por_contacto_canal');

  const duplicados = await knex('conversaciones')
    .select('empresa_id', 'contacto_id')
    .whereIn('estado', ['EN_COLA', 'ASIGNADA'])
    .groupBy('empresa_id', 'contacto_id')
    .havingRaw('count(*) > 1');

  for (const d of duplicados) {
    const idsAMantener = await knex('conversaciones')
      .where({
        empresa_id: d.empresa_id,
        contacto_id: d.contacto_id,
      })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA'])
      .orderBy('creada_en', 'desc')
      .limit(1)
      .pluck('id_conversacion');

    await knex('conversaciones')
      .where({
        empresa_id: d.empresa_id,
        contacto_id: d.contacto_id,
      })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA'])
      .whereNotIn('id_conversacion', idsAMantener)
      .update({
        estado: 'CERRADA',
        cerrada_en: knex.fn.now(),
        ultima_actividad_en: knex.fn.now(),
      });
  }

  await knex.raw(`
    CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto
    ON conversaciones (empresa_id, contacto_id)
    WHERE estado IN ('EN_COLA', 'ASIGNADA')
  `);
}
