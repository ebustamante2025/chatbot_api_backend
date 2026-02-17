import { Router } from 'express';
import { db } from '../database/connection.js';

const router = Router();

// GET /api/dashboard/stats — Estadísticas generales
router.get('/stats', async (_req, res) => {
  try {
    // Ejecutar todas las consultas en paralelo
    const [
      totalUsuarios,
      totalEmpresas,
      totalContactos,
      conversacionesPorEstado,
      totalMensajes,
      agentesEnLinea,
      conversacionesHoy,
    ] = await Promise.all([
      db('usuarios_soporte').count('id_usuario as total').first(),
      db('empresas').count('id_empresa as total').first(),
      db('contactos').count('id_contacto as total').first(),
      db('conversaciones')
        .select('estado')
        .count('id_conversacion as total')
        .groupBy('estado'),
      db('mensajes').count('id_mensaje as total').first(),
      db('agentes_en_linea')
        .where('estado', '!=', 'OFFLINE')
        .count('id as total')
        .first(),
      db('conversaciones')
        .whereRaw("creada_en::date = CURRENT_DATE")
        .count('id_conversacion as total')
        .first(),
    ]);

    // Convertir conversaciones por estado a objeto
    const conversaciones: Record<string, number> = {};
    let totalConversaciones = 0;
    for (const row of conversacionesPorEstado) {
      conversaciones[row.estado] = Number(row.total);
      totalConversaciones += Number(row.total);
    }

    res.json({
      usuarios: Number(totalUsuarios?.total || 0),
      empresas: Number(totalEmpresas?.total || 0),
      contactos: Number(totalContactos?.total || 0),
      mensajes: Number(totalMensajes?.total || 0),
      agentesEnLinea: Number(agentesEnLinea?.total || 0),
      conversacionesHoy: Number(conversacionesHoy?.total || 0),
      conversaciones: {
        total: totalConversaciones,
        en_cola: conversaciones['EN_COLA'] || 0,
        asignadas: conversaciones['ASIGNADA'] || 0,
        activas: conversaciones['ACTIVA'] || 0,
        cerradas: conversaciones['CERRADA'] || 0,
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/dashboard/actividad-reciente — Últimas conversaciones y asignaciones
router.get('/actividad-reciente', async (_req, res) => {
  try {
    const ultimasConversaciones = await db('conversaciones')
      .select(
        'conversaciones.id_conversacion',
        'conversaciones.estado',
        'conversaciones.creada_en',
        'contactos.nombre as contacto_nombre',
        'empresas.nombre_empresa',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .leftJoin('usuarios_soporte', 'conversaciones.asignada_a_usuario_id', 'usuarios_soporte.id_usuario')
      .orderBy('conversaciones.creada_en', 'desc')
      .limit(10);

    res.json({ actividad: ultimasConversaciones });
  } catch (error) {
    console.error('Error al obtener actividad reciente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/dashboard/conversaciones-activas — Conversaciones ASIGNADAS y ACTIVAS con tiempo transcurrido
router.get('/conversaciones-activas', async (_req, res) => {
  try {
    const activas = await db('conversaciones')
      .select(
        'conversaciones.id_conversacion',
        'conversaciones.estado',
        'conversaciones.asignada_en',
        'conversaciones.creada_en',
        'conversaciones.canal',
        'conversaciones.tema',
        'contactos.nombre as contacto_nombre',
        'contactos.email as contacto_email',
        'contactos.telefono as contacto_telefono',
        'empresas.nombre_empresa',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo',
        db.raw("EXTRACT(EPOCH FROM (now() - conversaciones.asignada_en))::int AS segundos_asignada")
      )
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .leftJoin('usuarios_soporte', 'conversaciones.asignada_a_usuario_id', 'usuarios_soporte.id_usuario')
      .whereIn('conversaciones.estado', ['ASIGNADA', 'ACTIVA'])
      .orderBy('conversaciones.asignada_en', 'asc');

    res.json({ conversaciones: activas });
  } catch (error) {
    console.error('Error al obtener conversaciones activas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/dashboard/conversaciones-bot — Conversaciones con Bot Isa
// Query param: ?periodo=24h (default) | todo
router.get('/conversaciones-bot', async (req, res) => {
  try {
    const periodo = req.query.periodo === 'todo' ? 'todo' : '24h';

    let query = db('conversaciones')
      .select(
        'conversaciones.id_conversacion',
        'conversaciones.estado',
        'conversaciones.creada_en',
        'conversaciones.ultima_actividad_en',
        'contactos.nombre as contacto_nombre',
        'contactos.documento as contacto_documento',
        'empresas.nombre_empresa',
        'empresas.nit as empresa_nit',
        db.raw("EXTRACT(EPOCH FROM (now() - conversaciones.creada_en))::int AS segundos_desde_inicio"),
        db.raw("EXTRACT(EPOCH FROM (now() - conversaciones.ultima_actividad_en))::int AS segundos_sin_actividad"),
        db.raw("(SELECT COUNT(*) FROM mensajes WHERE mensajes.conversacion_id = conversaciones.id_conversacion AND mensajes.tipo_emisor = 'BOT')::int AS total_mensajes_bot"),
        db.raw("(SELECT COUNT(*) FROM mensajes WHERE mensajes.conversacion_id = conversaciones.id_conversacion AND mensajes.tipo_emisor = 'CONTACTO')::int AS total_mensajes_contacto"),
        db.raw("(SELECT COUNT(*) FROM mensajes WHERE mensajes.conversacion_id = conversaciones.id_conversacion)::int AS total_mensajes")
      )
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .whereExists(
        db('mensajes')
          .whereRaw('mensajes.conversacion_id = conversaciones.id_conversacion')
          .where('mensajes.tipo_emisor', 'BOT')
      )
      .orderBy('conversaciones.ultima_actividad_en', 'desc');

    // Solo filtrar por 24h si no es "todo"
    if (periodo === '24h') {
      query = query.whereRaw("conversaciones.creada_en >= now() - interval '24 hours'");
    }

    const conversacionesBot = await query;

    // Considerar "en línea" a las que tienen actividad en los últimos 10 minutos
    const enLinea = conversacionesBot.filter(
      (c: any) => c.estado !== 'CERRADA' && c.segundos_sin_actividad < 600
    ).length;

    const total = conversacionesBot.length;
    const activas = conversacionesBot.filter((c: any) => c.estado !== 'CERRADA').length;
    const cerradas = conversacionesBot.filter((c: any) => c.estado === 'CERRADA').length;

    // Total de mensajes del periodo
    const totalMensajes = conversacionesBot.reduce((sum: number, c: any) => sum + (c.total_mensajes || 0), 0);

    res.json({
      periodo,
      resumen: {
        total,
        en_linea: enLinea,
        activas,
        cerradas,
        total_mensajes: totalMensajes,
      },
      conversaciones: conversacionesBot,
    });
  } catch (error) {
    console.error('Error al obtener conversaciones bot:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/dashboard/historial-transferencias — Historial de transferencias de conversaciones
// Query params: ?periodo=24h (default) | 7d | 30d | todo
router.get('/historial-transferencias', async (req, res) => {
  try {
    const periodo = (req.query.periodo as string) || '24h';

    let query = db('asignaciones')
      .select(
        'asignaciones.id_asignacion',
        'asignaciones.conversacion_id',
        'asignaciones.accion',
        'asignaciones.razon',
        'asignaciones.creado_en',
        'asignaciones.usuario_id as destino_usuario_id',
        'destino.username as destino_username',
        'destino.nombre_completo as destino_nombre_completo',
        'contactos.nombre as contacto_nombre',
        'empresas.nombre_empresa',
        'conversaciones.estado as estado_conversacion'
      )
      .leftJoin('usuarios_soporte as destino', 'asignaciones.usuario_id', 'destino.id_usuario')
      .leftJoin('conversaciones', 'asignaciones.conversacion_id', 'conversaciones.id_conversacion')
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .where('asignaciones.accion', 'TRANSFERIR')
      .orderBy('asignaciones.creado_en', 'desc');

    // Filtrar por periodo
    if (periodo === '24h') {
      query = query.whereRaw("asignaciones.creado_en >= now() - interval '24 hours'");
    } else if (periodo === '7d') {
      query = query.whereRaw("asignaciones.creado_en >= now() - interval '7 days'");
    } else if (periodo === '30d') {
      query = query.whereRaw("asignaciones.creado_en >= now() - interval '30 days'");
    }
    // 'todo' = sin filtro de fecha

    const transferencias = await query;

    // Para cada transferencia, buscar quién tenía la conversación ANTES (la asignación previa)
    const resultado = [];
    for (const t of transferencias) {
      // Buscar la asignación anterior a esta (por conversacion_id y creado_en < t.creado_en)
      const asignacionAnterior = await db('asignaciones')
        .select(
          'asignaciones.usuario_id as origen_usuario_id',
          'usuarios_soporte.username as origen_username',
          'usuarios_soporte.nombre_completo as origen_nombre_completo'
        )
        .leftJoin('usuarios_soporte', 'asignaciones.usuario_id', 'usuarios_soporte.id_usuario')
        .where('asignaciones.conversacion_id', t.conversacion_id)
        .where('asignaciones.creado_en', '<', t.creado_en)
        .orderBy('asignaciones.creado_en', 'desc')
        .first();

      resultado.push({
        ...t,
        origen_usuario_id: asignacionAnterior?.origen_usuario_id || null,
        origen_username: asignacionAnterior?.origen_username || null,
        origen_nombre_completo: asignacionAnterior?.origen_nombre_completo || null,
      });
    }

    res.json({
      periodo,
      total: resultado.length,
      transferencias: resultado,
    });
  } catch (error) {
    console.error('Error al obtener historial de transferencias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
