import type { Knex } from 'knex';

/**
 * Una sola conversación activa por (empresa_id, contacto_id), sin importar el canal.
 * Cierra duplicados activos (deja la de mayor ultima_actividad_en) y sustituye el índice
 * uq_conversacion_activa_por_contacto_canal por uno global por contacto.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uq_conversacion_activa_por_contacto_canal');

  /** Mover mensajes de hilos duplicados al conversacion_id que se conserva (rn = 1). */
  await knex.raw(`
    WITH ranked AS (
      SELECT id_conversacion,
             empresa_id,
             contacto_id,
             ROW_NUMBER() OVER (
               PARTITION BY empresa_id, contacto_id
               ORDER BY ultima_actividad_en DESC NULLS LAST, id_conversacion DESC
             ) AS rn
      FROM conversaciones
      WHERE estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA')
    ),
    keeper AS (
      SELECT id_conversacion, empresa_id, contacto_id FROM ranked WHERE rn = 1
    ),
    mover AS (
      SELECT m.id_mensaje, k.id_conversacion AS id_conversacion_destino
      FROM mensajes m
      INNER JOIN ranked r ON r.id_conversacion = m.conversacion_id AND r.rn > 1
      INNER JOIN keeper k ON k.empresa_id = r.empresa_id AND k.contacto_id = r.contacto_id
    )
    UPDATE mensajes m
    SET conversacion_id = mover.id_conversacion_destino
    FROM mover
    WHERE m.id_mensaje = mover.id_mensaje
  `);

  await knex.raw(`
    WITH ranked AS (
      SELECT id_conversacion,
             ROW_NUMBER() OVER (
               PARTITION BY empresa_id, contacto_id
               ORDER BY ultima_actividad_en DESC NULLS LAST, id_conversacion DESC
             ) AS rn
      FROM conversaciones
      WHERE estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA')
    )
    UPDATE conversaciones c
    SET estado = 'CERRADA',
        cerrada_en = NOW(),
        ultima_actividad_en = NOW()
    FROM ranked r
    WHERE c.id_conversacion = r.id_conversacion AND r.rn > 1
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX uq_conversacion_activa_por_contacto
    ON conversaciones (empresa_id, contacto_id)
    WHERE estado IN ('EN_COLA', 'ASIGNADA', 'ACTIVA')
  `);
}

export async function down(knex: Knex): Promise<void> {
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
