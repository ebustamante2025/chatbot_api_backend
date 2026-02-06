import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Limpiar tablas antes de insertar datos de ejemplo (en orden inverso de dependencias)
  await knex('mensajes_salas').del();
  await knex('miembros_salas').del();
  await knex('salas').del();
  await knex('participantes_llamada').del();
  await knex('llamadas').del();
  await knex('agentes_en_linea').del();
  await knex('seguimiento_atenciones').del();
  await knex('asignaciones').del();
  await knex('adjuntos').del();
  await knex('mensajes').del();
  await knex('conversaciones').del();
  await knex('contactos').del();
  await knex('usuarios_soporte').del();
  await knex('empresas').del();

  // 1. Insertar empresa de ejemplo
  const [empresa] = await knex('empresas')
    .insert({
      nit: '900123456-1',
      nombre_empresa: 'Empresa Demo S.A.S',
      estado: true,
    })
    .returning('id_empresa');

  const empresaId = empresa.id_empresa;

  // 2. Insertar usuarios de soporte (agentes)
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const [adminUser] = await knex('usuarios_soporte')
    .insert({
      username: 'admin',
      tipo_documento: 'CC',
      documento: '1234567890',
      password_hash: passwordHash,
      rol: 'ADMIN',
      nivel: 10,
      estado: true,
    })
    .returning('id_usuario');

  const [agenteUser] = await knex('usuarios_soporte')
    .insert({
      username: 'agente1',
      tipo_documento: 'CC',
      documento: '0987654321',
      password_hash: passwordHash,
      rol: 'AGENTE',
      nivel: 5,
      estado: true,
    })
    .returning('id_usuario');

  // 3. Insertar contactos (clientes)
  const [contacto1] = await knex('contactos')
    .insert({
      empresa_id: empresaId,
      tipo: 'CLIENTE',
      nombre: 'Juan Pérez',
      email: 'juan.perez@example.com',
      telefono: '+57 300 1234567',
      tipo_documento: 'CC',
      documento: '1001234567',
      tags: 'VIP,ACTIVO',
    })
    .returning('id_contacto');

  const [contacto2] = await knex('contactos')
    .insert({
      empresa_id: empresaId,
      tipo: 'PROSPECTO',
      nombre: 'María García',
      email: 'maria.garcia@example.com',
      telefono: '+57 300 9876543',
      tipo_documento: 'CC',
      documento: '2009876543',
    })
    .returning('id_contacto');

  // 4. Insertar conversaciones
  const [conversacion1] = await knex('conversaciones')
    .insert({
      empresa_id: empresaId,
      contacto_id: contacto1.id_contacto,
      canal: 'WEB',
      tema: 'SOPORTE',
      estado: 'ASIGNADA',
      prioridad: 'ALTA',
      asignada_a_usuario_id: agenteUser.id_usuario,
      asignada_en: new Date(),
      ultima_actividad_en: new Date(),
    })
    .returning('id_conversacion');

  const [conversacion2] = await knex('conversaciones')
    .insert({
      empresa_id: empresaId,
      contacto_id: contacto2.id_contacto,
      canal: 'WEB',
      tema: 'VENTAS',
      estado: 'EN_COLA',
      prioridad: 'MEDIA',
      ultima_actividad_en: new Date(),
    })
    .returning('id_conversacion');

  // 5. Insertar mensajes
  await knex('mensajes').insert([
    {
      empresa_id: empresaId,
      conversacion_id: conversacion1.id_conversacion,
      tipo_emisor: 'BOT',
      contenido: 'Hola, soy Isa. ¿En qué puedo ayudarte hoy?',
      creado_en: new Date(Date.now() - 3600000), // 1 hora atrás
    },
    {
      empresa_id: empresaId,
      conversacion_id: conversacion1.id_conversacion,
      tipo_emisor: 'CONTACTO',
      contacto_id: contacto1.id_contacto,
      contenido: 'Necesito ayuda con mi pedido',
      creado_en: new Date(Date.now() - 3300000), // 55 minutos atrás
    },
    {
      empresa_id: empresaId,
      conversacion_id: conversacion1.id_conversacion,
      tipo_emisor: 'AGENTE',
      usuario_id: agenteUser.id_usuario,
      contenido: 'Hola Juan, con gusto te ayudo. ¿Cuál es el número de tu pedido?',
      creado_en: new Date(Date.now() - 3000000), // 50 minutos atrás
    },
    {
      empresa_id: empresaId,
      conversacion_id: conversacion2.id_conversacion,
      tipo_emisor: 'BOT',
      contenido: 'Bienvenido, ¿cómo puedo ayudarte?',
      creado_en: new Date(Date.now() - 1800000), // 30 minutos atrás
    },
    {
      empresa_id: empresaId,
      conversacion_id: conversacion2.id_conversacion,
      tipo_emisor: 'CONTACTO',
      contacto_id: contacto2.id_contacto,
      contenido: 'Quiero información sobre sus productos',
      creado_en: new Date(Date.now() - 1500000), // 25 minutos atrás
    },
  ]);

  // 6. Insertar asignaciones
  await knex('asignaciones').insert({
    empresa_id: empresaId,
    conversacion_id: conversacion1.id_conversacion,
    usuario_id: agenteUser.id_usuario,
    accion: 'ASIGNAR',
    razon: 'Asignación inicial',
    creado_en: new Date(),
  });

  // 7. Insertar seguimiento de atenciones
  await knex('seguimiento_atenciones').insert([
    {
      empresa_id: empresaId,
      usuario_id: agenteUser.id_usuario,
      contacto_id: contacto1.id_contacto,
      conversacion_id: conversacion1.id_conversacion,
      accion: 'ASIGNAR',
      detalle: 'Conversación asignada al agente',
      creado_en: new Date(),
    },
    {
      empresa_id: empresaId,
      usuario_id: agenteUser.id_usuario,
      contacto_id: contacto1.id_contacto,
      conversacion_id: conversacion1.id_conversacion,
      accion: 'RESPONDER',
      detalle: 'Agente respondió al contacto',
      creado_en: new Date(),
    },
  ]);

  // 8. Insertar agente en línea
  await knex('agentes_en_linea').insert({
    empresa_id: empresaId,
    usuario_id: agenteUser.id_usuario,
    estado: 'DISPONIBLE',
    capacidad_max: 5,
    ultima_actividad_en: new Date(),
  });

  console.log('✅ Datos de ejemplo insertados correctamente');
  console.log(`   - Empresa: ${empresaId}`);
  console.log(`   - Usuarios: admin (${adminUser.id_usuario}), agente1 (${agenteUser.id_usuario})`);
  console.log(`   - Contactos: ${contacto1.id_contacto}, ${contacto2.id_contacto}`);
  console.log(`   - Conversaciones: ${conversacion1.id_conversacion}, ${conversacion2.id_conversacion}`);
}
