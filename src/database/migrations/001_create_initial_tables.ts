import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // =========================
  // EMPRESAS
  // =========================
  await knex.schema.createTable('empresas', (table) => {
    table.bigIncrements('id_empresa').primary();
    table.string('nit', 20).unique().notNullable();
    table.string('nombre_empresa', 200).notNullable();
    table.boolean('estado').notNullable().defaultTo(true);
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());
  });

  // =========================
  // USUARIOS SOPORTE (CRM)
  // =========================
  await knex.schema.createTable('usuarios_soporte', (table) => {
    table.bigIncrements('id_usuario').primary();
    table.string('username', 120).unique().notNullable();
    table.string('tipo_documento', 10);
    table.string('documento', 30);
    table.text('password_hash').notNullable();
    table.string('rol', 30).notNullable();
    table.integer('nivel').notNullable().defaultTo(5);
    table.boolean('estado').notNullable().defaultTo(true);
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());
  });

  // =========================
  // CONTACTOS (clientes)
  // =========================
  await knex.schema.createTable('contactos', (table) => {
    table.bigIncrements('id_contacto').primary();
    table.bigInteger('empresa_id').notNullable();
    table.string('tipo', 20).notNullable(); // CLIENTE/PROSPECTO
    table.string('nombre', 200).notNullable();
    table.string('email', 150);
    table.string('telefono', 30);
    table.string('tipo_documento', 10);
    table.string('documento', 30);
    table.text('tags');
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign key
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
  });

  // Índice único para documento por empresa
  await knex.raw(`
    CREATE UNIQUE INDEX ux_contactos_empresa_documento
    ON contactos(empresa_id, documento)
    WHERE documento IS NOT NULL
  `);

  // =========================
  // CONVERSACIONES
  // =========================
  await knex.schema.createTable('conversaciones', (table) => {
    table.bigIncrements('id_conversacion').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('contacto_id').notNullable();
    table.string('canal', 30).notNullable();
    table.string('tema', 30).notNullable();
    table.string('estado', 20).notNullable(); // EN_COLA, ASIGNADA, CERRADA (ver migración 004)
    table.string('prioridad', 20);
    table.bigInteger('asignada_a_usuario_id');
    table.timestamp('asignada_en');
    table.timestamp('bloqueada_hasta');
    table.timestamp('ultima_actividad_en').notNullable().defaultTo(knex.fn.now());
    table.timestamp('creada_en').notNullable().defaultTo(knex.fn.now());
    table.timestamp('cerrada_en');

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('CASCADE');
    table
      .foreign('asignada_a_usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('SET NULL');
  });

  // Índice para bandejas (cola de conversaciones)
  await knex.schema.table('conversaciones', (table) => {
    table.index(['empresa_id', 'estado', 'creada_en'], 'ix_conversaciones_cola');
  });

  // =========================
  // MENSAJES
  // =========================
  await knex.schema.createTable('mensajes', (table) => {
    table.bigIncrements('id_mensaje').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('conversacion_id').notNullable();
    table.string('tipo_emisor', 20).notNullable(); // CONTACTO/AGENTE/BOT/SISTEMA
    table.bigInteger('usuario_id');
    table.bigInteger('contacto_id');
    table.text('contenido').notNullable();
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('conversacion_id')
      .references('id_conversacion')
      .inTable('conversaciones')
      .onDelete('CASCADE');
    table
      .foreign('usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('SET NULL');
    table
      .foreign('contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('SET NULL');
  });

  // Índice para mensajes por conversación
  await knex.schema.table('mensajes', (table) => {
    table.index(['conversacion_id', 'creado_en'], 'ix_mensajes_conversacion_fecha');
  });

  // =========================
  // ADJUNTOS
  // =========================
  await knex.schema.createTable('adjuntos', (table) => {
    table.bigIncrements('id_adjunto').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('conversacion_id').notNullable();
    table.bigInteger('mensaje_id');
    table.string('subido_por_tipo', 20).notNullable();
    table.bigInteger('subido_por_usuario_id');
    table.bigInteger('subido_por_contacto_id');
    table.string('nombre_original', 255).notNullable();
    table.string('mime_type', 120).notNullable();
    table.bigInteger('tamano_bytes').notNullable();
    table.text('url').notNullable();
    table.string('hash_sha256', 64);
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('conversacion_id')
      .references('id_conversacion')
      .inTable('conversaciones')
      .onDelete('CASCADE');
    table
      .foreign('mensaje_id')
      .references('id_mensaje')
      .inTable('mensajes')
      .onDelete('SET NULL');
    table
      .foreign('subido_por_usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('SET NULL');
    table
      .foreign('subido_por_contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('SET NULL');
  });

  // Índice para adjuntos por mensaje
  await knex.schema.table('adjuntos', (table) => {
    table.index('mensaje_id', 'ix_adjuntos_mensaje');
  });

  // =========================
  // ASIGNACIONES (eventos operativos)
  // =========================
  await knex.schema.createTable('asignaciones', (table) => {
    table.bigIncrements('id_asignacion').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('conversacion_id').notNullable();
    table.bigInteger('usuario_id').notNullable();
    table.string('accion', 20).notNullable(); // ASIGNAR/TRANSFERIR/CERRAR/LIBERAR
    table.text('razon');
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('conversacion_id')
      .references('id_conversacion')
      .inTable('conversaciones')
      .onDelete('CASCADE');
    table
      .foreign('usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('CASCADE');
  });

  // =========================
  // SEGUIMIENTO (auditoría real)
  // =========================
  await knex.schema.createTable('seguimiento_atenciones', (table) => {
    table.bigIncrements('id_seguimiento').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('usuario_id').notNullable();
    table.bigInteger('contacto_id').notNullable();
    table.bigInteger('conversacion_id').notNullable();
    table.string('accion', 20).notNullable(); // ASIGNAR/RESPONDER/TRANSFERIR/CERRAR
    table.text('detalle');
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('CASCADE');
    table
      .foreign('contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('CASCADE');
    table
      .foreign('conversacion_id')
      .references('id_conversacion')
      .inTable('conversaciones')
      .onDelete('CASCADE');
  });

  // Índice para seguimiento por empresa/usuario/fecha
  await knex.schema.table('seguimiento_atenciones', (table) => {
    table.index(['empresa_id', 'usuario_id', 'creado_en'], 'ix_seguimiento_empresa_usuario_fecha');
  });

  // =========================
  // AGENTES EN LINEA
  // =========================
  await knex.schema.createTable('agentes_en_linea', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('usuario_id').notNullable();
    table.string('estado', 20).notNullable(); // DISPONIBLE/OCUPADO/AUSENTE/OFFLINE
    table.integer('capacidad_max').notNullable().defaultTo(3);
    table.timestamp('ultima_actividad_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('CASCADE');
  });

  // Índice único para empresa + usuario
  await knex.schema.table('agentes_en_linea', (table) => {
    table.unique(['empresa_id', 'usuario_id'], 'ux_agentes_en_linea');
  });

  // =========================
  // LLAMADAS
  // =========================
  await knex.schema.createTable('llamadas', (table) => {
    table.bigIncrements('id_llamada').primary();
    table.bigInteger('empresa_id').notNullable();
    table.bigInteger('conversacion_id').notNullable();
    table.string('tipo', 10).notNullable(); // AUDIO/VIDEO
    table.string('estado', 20).notNullable();
    table.string('iniciada_por_tipo', 20).notNullable();
    table.bigInteger('iniciada_por_usuario_id');
    table.bigInteger('iniciada_por_contacto_id');
    table.bigInteger('agente_asignado_id');
    table.string('webrtc_room_id', 120).notNullable();
    table.timestamp('inicio_en');
    table.timestamp('fin_en');
    table.integer('duracion_seg');
    table.text('motivo_fin');
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('conversacion_id')
      .references('id_conversacion')
      .inTable('conversaciones')
      .onDelete('CASCADE');
    table
      .foreign('iniciada_por_usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('SET NULL');
    table
      .foreign('iniciada_por_contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('SET NULL');
    table
      .foreign('agente_asignado_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('SET NULL');
  });

  // =========================
  // PARTICIPANTES LLAMADA
  // =========================
  await knex.schema.createTable('participantes_llamada', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('llamada_id').notNullable();
    table.string('tipo_participante', 20).notNullable();
    table.bigInteger('usuario_id');
    table.bigInteger('contacto_id');
    table.string('estado', 20).notNullable();
    table.timestamp('join_en');
    table.timestamp('leave_en');

    // Foreign keys
    table
      .foreign('llamada_id')
      .references('id_llamada')
      .inTable('llamadas')
      .onDelete('CASCADE');
    table
      .foreign('usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('SET NULL');
    table
      .foreign('contacto_id')
      .references('id_contacto')
      .inTable('contactos')
      .onDelete('SET NULL');
  });

  // =========================
  // CHAT INTERNO (opcional)
  // =========================
  await knex.schema.createTable('salas', (table) => {
    table.bigIncrements('id_sala').primary();
    table.bigInteger('empresa_id').notNullable();
    table.string('name', 120).notNullable();
    table.bigInteger('creado_por_usuario_id').notNullable();
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('empresa_id')
      .references('id_empresa')
      .inTable('empresas')
      .onDelete('CASCADE');
    table
      .foreign('creado_por_usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('miembros_salas', (table) => {
    table.bigInteger('sala_id').notNullable();
    table.bigInteger('usuario_id').notNullable();
    table.string('rol_en_sala', 20);
    table.timestamp('agregado_en').notNullable().defaultTo(knex.fn.now());

    // Primary key compuesta
    table.primary(['sala_id', 'usuario_id']);

    // Foreign keys
    table
      .foreign('sala_id')
      .references('id_sala')
      .inTable('salas')
      .onDelete('CASCADE');
    table
      .foreign('usuario_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('mensajes_salas', (table) => {
    table.bigIncrements('id_mensaje_sala').primary();
    table.bigInteger('sala_id').notNullable();
    table.bigInteger('usuario_envia_id').notNullable();
    table.text('contenido').notNullable();
    table.timestamp('creado_en').notNullable().defaultTo(knex.fn.now());

    // Foreign keys
    table
      .foreign('sala_id')
      .references('id_sala')
      .inTable('salas')
      .onDelete('CASCADE');
    table
      .foreign('usuario_envia_id')
      .references('id_usuario')
      .inTable('usuarios_soporte')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Eliminar en orden inverso (respetando dependencias)
  await knex.schema.dropTableIfExists('mensajes_salas');
  await knex.schema.dropTableIfExists('miembros_salas');
  await knex.schema.dropTableIfExists('salas');
  await knex.schema.dropTableIfExists('participantes_llamada');
  await knex.schema.dropTableIfExists('llamadas');
  await knex.schema.dropTableIfExists('agentes_en_linea');
  await knex.schema.dropTableIfExists('seguimiento_atenciones');
  await knex.schema.dropTableIfExists('asignaciones');
  await knex.schema.dropTableIfExists('adjuntos');
  await knex.schema.dropTableIfExists('mensajes');
  await knex.schema.dropTableIfExists('conversaciones');
  await knex.schema.dropTableIfExists('contactos');
  await knex.schema.dropTableIfExists('usuarios_soporte');
  await knex.schema.dropTableIfExists('empresas');
}
