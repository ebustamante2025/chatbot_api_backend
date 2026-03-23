import express from 'express';
import { db } from '../database/connection.js';
import { getIO } from '../socket.js';

const router = express.Router();

/** Estados permitidos: EN_COLA, ASIGNADA, ACTIVA, CERRADA */
const ESTADOS_CONVERSACION = ['EN_COLA', 'ASIGNADA', 'ACTIVA', 'CERRADA'] as const;

// Listar conversaciones
// ADMIN/SUPERVISOR ven todas. Otros usuarios ven EN_COLA + las ASIGNADAS a ellos.
router.get('/', async (req: any, res) => {
  try {
    const { estado, empresa_id, canal } = req.query;
    const user = req.user as { id_usuario: number; username: string; rol: string } | undefined;

    let query = db('conversaciones')
      .select(
        'conversaciones.*',
        'empresas.nombre_empresa as empresa_nombre',
        'empresas.nit as empresa_nit',
        'contactos.nombre as contacto_nombre',
        'contactos.email as contacto_email',
        'contactos.telefono as contacto_telefono',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo',
        db.raw(
          '(SELECT MIN(m.creado_en) FROM mensajes m WHERE m.conversacion_id = conversaciones.id_conversacion) AS primer_mensaje_en'
        )
      )
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'conversaciones.asignada_a_usuario_id', 'usuarios_soporte.id_usuario')
      // Cola por orden de llegada del primer mensaje; si no hay mensajes, por creada_en
      .orderByRaw("CASE WHEN conversaciones.estado = 'EN_COLA' THEN 0 ELSE 1 END ASC")
      .orderByRaw(
        "CASE WHEN conversaciones.estado = 'EN_COLA' THEN COALESCE(" +
          "(SELECT MIN(m.creado_en) FROM mensajes m WHERE m.conversacion_id = conversaciones.id_conversacion)," +
          " conversaciones.creada_en) END ASC NULLS LAST"
      )
      .orderBy('conversaciones.ultima_actividad_en', 'desc');

    if (estado && typeof estado === 'string') {
      if (!ESTADOS_CONVERSACION.includes(estado as (typeof ESTADOS_CONVERSACION)[number])) {
        return res.status(400).json({
          error: 'Estado no válido',
          message: 'El estado debe ser uno de: EN_COLA, ASIGNADA, ACTIVA, CERRADA',
        });
      }
      query = query.where('conversaciones.estado', estado);
    } else {
      // Por defecto no mostrar conversaciones cerradas en la lista del CRM
      query = query.whereNot('conversaciones.estado', 'CERRADA');
    }
    if (empresa_id && typeof empresa_id === 'string') {
      query = query.where('conversaciones.empresa_id', Number(empresa_id));
    }

    if (canal && typeof canal === 'string' && canal.trim()) {
      query = query.where('conversaciones.canal', canal.trim().slice(0, 30));
    }

    // Filtro por rol: ADMIN y SUPERVISOR ven todo, los demás solo EN_COLA + sus propias asignadas
    if (user && user.rol !== 'ADMIN' && user.rol !== 'SUPERVISOR') {
      const userId = user.id_usuario;
      query = query.andWhereRaw(
        '(conversaciones.estado = ? OR conversaciones.asignada_a_usuario_id = ?)',
        ['EN_COLA', userId]
      );
    }

    const conversaciones = await query;

    res.json({
      conversaciones,
      total: conversaciones.length,
    });
  } catch (error) {
    console.error('Error al listar conversaciones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las conversaciones',
    });
  }
});

// Historial cerradas: una entrada por contacto (agrupa por empresa_id + contacto_id)
router.get('/historial-cerradas', async (req: any, res) => {
  try {
    const user = req.user as { id_usuario: number; rol: string } | undefined;
    let query = db('conversaciones')
      .select(
        'conversaciones.id_conversacion',
        'conversaciones.empresa_id',
        'conversaciones.contacto_id',
        'conversaciones.cerrada_en',
        'conversaciones.ultima_actividad_en',
        'conversaciones.creada_en',
        'empresas.nombre_empresa as empresa_nombre',
        'empresas.nit as empresa_nit',
        'contactos.nombre as contacto_nombre',
        'contactos.email as contacto_email',
        'contactos.telefono as contacto_telefono',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'conversaciones.asignada_a_usuario_id', 'usuarios_soporte.id_usuario')
      .where('conversaciones.estado', 'CERRADA')
      .orderBy('conversaciones.cerrada_en', 'desc');

    if (user && user.rol !== 'ADMIN' && user.rol !== 'SUPERVISOR') {
      query = query.where('conversaciones.asignada_a_usuario_id', user.id_usuario);
    }

    const filas = await query;
    const porContacto = new Map<string, typeof filas[0]>();
    for (const row of filas) {
      const key = `${row.empresa_id}|${row.contacto_id}`;
      if (!porContacto.has(key)) porContacto.set(key, row);
    }
    const conversaciones = Array.from(porContacto.values());
    res.json({ conversaciones });
  } catch (error) {
    console.error('Error al listar historial cerradas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener el historial',
    });
  }
});

// Historial completo de un contacto: todos los mensajes en lista plana (sin bloques)
router.get('/historial-contacto/:empresaId/:contactoId', async (req, res) => {
  try {
    const empresaId = Number(req.params.empresaId);
    const contactoId = Number(req.params.contactoId);
    if (!empresaId || !contactoId) {
      return res.status(400).json({ error: 'empresaId y contactoId son requeridos' });
    }

    const conversaciones = await db('conversaciones')
      .select('conversaciones.id_conversacion')
      .where('conversaciones.estado', 'CERRADA')
      .where('conversaciones.empresa_id', empresaId)
      .where('conversaciones.contacto_id', contactoId);

    if (conversaciones.length === 0) {
      const [contacto] = await db('contactos').select('nombre as contacto_nombre').where('id_contacto', contactoId).limit(1);
      const [empresa] = await db('empresas').select('nombre_empresa as empresa_nombre', 'nit as empresa_nit').where('id_empresa', empresaId).limit(1);
      return res.json({
        contacto_nombre: contacto?.contacto_nombre ?? 'Contacto',
        empresa_nombre: empresa?.empresa_nombre ?? '—',
        empresa_nit: empresa?.empresa_nit ?? null,
        mensajes: [],
      });
    }

    const ids = conversaciones.map((c) => c.id_conversacion);
    const mensajes = await db('mensajes')
      .select(
        'mensajes.id_mensaje',
        'mensajes.conversacion_id',
        'mensajes.tipo_emisor',
        'mensajes.contenido',
        'mensajes.creado_en',
        'contactos.nombre as contacto_nombre',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
      .whereIn('mensajes.conversacion_id', ids)
      .orderBy('mensajes.creado_en', 'asc');

    const [contacto] = await db('contactos').select('nombre as contacto_nombre', 'email as contacto_email', 'telefono as contacto_telefono').where('id_contacto', contactoId).limit(1);
    const [empresa] = await db('empresas').select('nombre_empresa as empresa_nombre', 'nit as empresa_nit').where('id_empresa', empresaId).limit(1);

    res.json({
      contacto_nombre: contacto?.contacto_nombre ?? 'Contacto',
      contacto_email: contacto?.contacto_email ?? null,
      contacto_telefono: contacto?.contacto_telefono ?? null,
      empresa_nombre: empresa?.empresa_nombre ?? '—',
      empresa_nit: empresa?.empresa_nit ?? null,
      mensajes,
    });
  } catch (error) {
    console.error('Error al obtener historial contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener el historial del contacto',
    });
  }
});

// Obtener una conversación con sus mensajes
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const conversacion = await db('conversaciones')
      .select(
        'conversaciones.*',
        'contactos.nombre as contacto_nombre',
        'contactos.email as contacto_email',
        'contactos.telefono as contacto_telefono',
        'empresas.nit as empresa_nit',
        'empresas.nombre_empresa as empresa_nombre',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'conversaciones.asignada_a_usuario_id', 'usuarios_soporte.id_usuario')
      .where('conversaciones.id_conversacion', id)
      .first();

    if (!conversacion) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación especificada no existe',
      });
    }

    const mensajes = await db('mensajes')
      .select(
        'mensajes.*',
        'contactos.nombre as contacto_nombre',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
      .where('mensajes.conversacion_id', id)
      .orderBy('mensajes.creado_en', 'asc');

    res.json({
      ...conversacion,
      mensajes,
    });
  } catch (error) {
    console.error('Error al obtener conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la conversación',
    });
  }
});

// Helper: obtener mensajes de una conversación (para incluir historial en respuestas al widget)
async function obtenerMensajesConversacion(conversacionId: number) {
  return db('mensajes')
    .select(
      'mensajes.id_mensaje',
      'mensajes.contenido',
      'mensajes.tipo_emisor',
      'mensajes.creado_en'
    )
    .where('mensajes.conversacion_id', conversacionId)
    .orderBy('mensajes.creado_en', 'asc');
}

// Crear conversación (widget: Isa WEB_ISA, agente WEB_AGENTE, etc.)
// Una conversación activa por (empresa, contacto, canal); si ya existe para ese canal, se devuelve con historial.
// Se incluyen mensajes para que el widget muestre el historial mientras la conversación esté activa.
router.post('/', async (req, res) => {
  try {
    const { empresa_id, contacto_id, canal = 'WEB', tema = 'SOPORTE' } = req.body;

    if (!empresa_id || !contacto_id) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'empresa_id y contacto_id son obligatorios',
      });
    }

    /** Normalizado; hilos distintos: WEB_ISA (Isa), WEB_AGENTE (humano), IA360_DOC (doc), WEB legacy, TELEGRAM… */
    const canalNorm = String(canal || 'WEB').trim().slice(0, 30) || 'WEB';

    const contacto = await db('contactos')
      .where({
        id_contacto: Number(contacto_id),
        empresa_id: Number(empresa_id),
      })
      .first();

    if (!contacto) {
      return res.status(403).json({
        error: 'Contacto no registrado',
        message: 'Debes estar registrado como contacto de la empresa para iniciar una conversación. Completa el registro en el widget.',
      });
    }

    // Evitar duplicados: una activa por (empresa, contacto, canal)
    const existente = await db('conversaciones')
      .where({
        empresa_id: Number(empresa_id),
        contacto_id: Number(contacto_id),
        canal: canalNorm,
      })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
      .orderBy('creada_en', 'desc')
      .first();

    if (existente) {
      const mensajes = await obtenerMensajesConversacion(existente.id_conversacion);
      return res.status(200).json({
        message: 'Conversación existente',
        conversacion: { ...existente, mensajes },
      });
    }

    let conversacion: Record<string, unknown> | undefined;
    try {
      [conversacion] = await db('conversaciones')
        .insert({
          empresa_id: Number(empresa_id),
          contacto_id: Number(contacto_id),
          canal: canalNorm,
          tema: tema || 'SOPORTE',
          estado: 'EN_COLA',
          prioridad: 'MEDIA',
        })
        .returning('*');
    } catch (insertError: unknown) {
      // Condición de carrera: otro request insertó primero (índice único)
      const code = (insertError as { code?: string })?.code;
      if (code === '23505') {
        const existente2 = await db('conversaciones')
          .where({
            empresa_id: Number(empresa_id),
            contacto_id: Number(contacto_id),
            canal: canalNorm,
          })
          .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
          .orderBy('creada_en', 'desc')
          .first();
        if (existente2) {
          const mensajes2 = await obtenerMensajesConversacion(existente2.id_conversacion);
          return res.status(200).json({
            message: 'Conversación existente',
            conversacion: { ...existente2, mensajes: mensajes2 },
          });
        }
      }
      throw insertError;
    }

    // Emitir nueva conversación en tiempo real al CRM
    const socketIO = getIO();
    if (socketIO && conversacion) {
      socketIO.to('crm').emit('new_conversation', conversacion);
    }

    res.status(201).json({
      message: 'Conversación creada',
      conversacion: { ...conversacion, mensajes: [] },
    });
  } catch (error: unknown) {
    console.error('Error al crear conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear la conversación',
    });
  }
});

// Asignar conversación a agente (solo una persona puede tener el chat; validado en BD)
router.post('/:id/asignar', async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) {
      return res.status(400).json({
        error: 'usuario_id requerido',
        message: 'El ID del agente es obligatorio',
      });
    }

    const agente = await db('usuarios_soporte')
      .where({ id_usuario: Number(usuario_id), estado: true })
      .first();

    if (!agente) {
      return res.status(400).json({
        error: 'Agente no encontrado',
        message: 'El usuario indicado no existe o no está activo.',
      });
    }

    // Solo se asigna si la conversación está EN_COLA (nadie la ha tomado).
    // Así solo un asesor puede tener el chat; si otro intenta, la BD no actualiza.
    const actualizadas = await db('conversaciones')
      .where({
        id_conversacion: id,
        estado: 'EN_COLA',
      })
      .update({
        estado: 'ASIGNADA',
        asignada_a_usuario_id: Number(usuario_id),
        asignada_en: db.raw('now()'),
        ultima_actividad_en: db.raw('now()'),
      })
      .returning('*');

    const conversacion = actualizadas?.[0];

    if (!conversacion) {
      const existe = await db('conversaciones').where('id_conversacion', id).first();
      if (!existe) {
        return res.status(404).json({
          error: 'Conversación no encontrada',
          message: 'La conversación no existe.',
        });
      }
      return res.status(409).json({
        error: 'Conversación no disponible',
        message: 'La conversación ya fue tomada por otro asesor. Actualiza la lista.',
      });
    }

    await db('asignaciones').insert({
      empresa_id: conversacion.empresa_id,
      conversacion_id: conversacion.id_conversacion,
      usuario_id: Number(usuario_id),
      accion: 'ASIGNAR',
      razon: 'Asignación desde CRM',
    });

    // Enviar mensaje de presentación automático al chat (solo en "Chatear con un agente")
    const nombreAgente = agente.nombre_completo?.trim() || agente.username || 'Soporte';
    const textoPresentacion = `Hola, soy ${nombreAgente}, ¿en qué puedo ayudarte?`;
    const [mensajePresentacion] = await db('mensajes')
      .insert({
        empresa_id: conversacion.empresa_id,
        conversacion_id: conversacion.id_conversacion,
        tipo_emisor: 'AGENTE',
        usuario_id: Number(usuario_id),
        contenido: textoPresentacion,
      })
      .returning('*');

    // Notificar por WebSocket a todos los clientes
    const socketIO = getIO();
    if (socketIO) {
      socketIO.emit('conversation_updated', {
        id_conversacion: Number(id),
        estado: 'ASIGNADA',
      });
      // Emitir el mensaje de presentación para que aparezca en el widget y en el CRM
      if (mensajePresentacion) {
        const presentacionConDetalle = await db('mensajes')
          .select(
            'mensajes.*',
            'contactos.nombre as contacto_nombre',
            'usuarios_soporte.username as agente_username',
            'usuarios_soporte.nombre_completo as agente_nombre_completo'
          )
          .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
          .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
          .where('mensajes.id_mensaje', mensajePresentacion.id_mensaje)
          .first();
        socketIO.to(`conversation:${Number(id)}`).emit('new_message', presentacionConDetalle || mensajePresentacion);
        socketIO.to('crm').emit('crm_activity', { id_conversacion: Number(id), tipo_emisor: 'AGENTE' });
      }
    }

    res.json({
      message: 'Conversación asignada',
      conversacion,
      mensajePresentacion: mensajePresentacion ?? undefined,
    });
  } catch (error) {
    console.error('Error al asignar conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Transferir conversación a otro agente
router.post('/:id/transferir', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { usuario_destino_id, motivo } = req.body || {};
    const user = req.user as { id_usuario: number; username: string; rol: string } | undefined;

    if (!usuario_destino_id) {
      return res.status(400).json({
        error: 'usuario_destino_id requerido',
        message: 'Debe indicar el agente destino para la transferencia.',
      });
    }

    // Verificar que el agente destino existe y está activo
    const agenteDestino = await db('usuarios_soporte')
      .where({ id_usuario: Number(usuario_destino_id), estado: true })
      .first();

    if (!agenteDestino) {
      return res.status(400).json({
        error: 'Agente destino no encontrado',
        message: 'El usuario destino no existe o no está activo.',
      });
    }

    // Verificar que la conversación está ASIGNADA o ACTIVA
    const conversacionActual = await db('conversaciones')
      .where('id_conversacion', id)
      .first();

    if (!conversacionActual) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    if (!['ASIGNADA', 'ACTIVA'].includes(conversacionActual.estado)) {
      return res.status(400).json({
        error: 'No se puede transferir',
        message: 'Solo se pueden transferir conversaciones asignadas o activas.',
      });
    }

    // No transferir a sí mismo
    if (conversacionActual.asignada_a_usuario_id === Number(usuario_destino_id)) {
      return res.status(400).json({
        error: 'Transferencia no válida',
        message: 'La conversación ya está asignada a este agente.',
      });
    }

    // Actualizar la conversación: cambiar agente, volver a ASIGNADA, actualizar timestamp
    const [conversacion] = await db('conversaciones')
      .where('id_conversacion', id)
      .update({
        asignada_a_usuario_id: Number(usuario_destino_id),
        estado: 'ASIGNADA',
        asignada_en: db.raw('now()'),
        ultima_actividad_en: db.raw('now()'),
      })
      .returning('*');

    // Registrar en asignaciones
    await db('asignaciones').insert({
      empresa_id: conversacion.empresa_id,
      conversacion_id: conversacion.id_conversacion,
      usuario_id: Number(usuario_destino_id),
      accion: 'TRANSFERIR',
      razon: motivo || `Transferida por ${user?.username || 'agente'}`,
    });

    // Agregar mensaje de sistema indicando la transferencia
    const agenteOrigen = user?.username || 'Agente';
    const textoSistema = `🔄 Conversación transferida de ${agenteOrigen} a ${agenteDestino.nombre_completo || agenteDestino.username}${motivo ? ` — Motivo: ${motivo}` : ''}`;
    await db('mensajes').insert({
      empresa_id: conversacion.empresa_id,
      conversacion_id: Number(id),
      tipo_emisor: 'SISTEMA',
      contenido: textoSistema,
    });

    // Notificar por WebSocket
    const socketIO = getIO();
    if (socketIO) {
      // Notificar globalmente el cambio de estado
      socketIO.emit('conversation_updated', {
        id_conversacion: Number(id),
        estado: 'ASIGNADA',
        transferida: true,
        agente_destino_id: Number(usuario_destino_id),
        agente_origen_id: user?.id_usuario,
      });

      // Enviar mensaje de sistema a la sala de la conversación
      socketIO.to(`conversation:${id}`).emit('new_message', {
        id_mensaje: Date.now(),
        conversacion_id: Number(id),
        tipo_emisor: 'SISTEMA',
        contenido: textoSistema,
        creado_en: new Date().toISOString(),
      });

      // Notificar directamente al agente destino para que recargue sus conversaciones
      socketIO.to(`agent:${usuario_destino_id}`).emit('conversation_assigned', {
        id_conversacion: Number(id),
      });
    }

    res.json({
      message: 'Conversación transferida',
      conversacion,
    });
  } catch (error) {
    console.error('Error al transferir conversación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const MENSAJE_CIERRE_SOPORTE =
  'Muchas gracias por haberse comunicado con el área de soporte de HGI. Fue un gusto atenderle. Hasta una próxima oportunidad.';

// Cerrar conversación (simple)
router.post('/:id/cerrar', async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, notas } = req.body || {};

    const [conversacion] = await db('conversaciones')
      .where('id_conversacion', id)
      .update({
        estado: 'CERRADA',
        cerrada_en: db.raw('now()'),
        ultima_actividad_en: db.raw('now()'),
      })
      .returning('*');

    if (!conversacion) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
      });
    }

    // Mensaje de despedida al cliente (siempre)
    const [mensajeDespedida] = await db('mensajes')
      .insert({
        empresa_id: conversacion.empresa_id,
        conversacion_id: Number(id),
        tipo_emisor: 'SISTEMA',
        contenido: MENSAJE_CIERRE_SOPORTE,
      })
      .returning('*');

    // Si tiene motivo/notas, guardar como mensaje de sistema interno
    if (motivo || notas) {
      const textoSistema = `🔒 Caso cerrado${motivo ? ` — Motivo: ${motivo}` : ''}${notas ? `\nNotas: ${notas}` : ''}`;
      await db('mensajes').insert({
        empresa_id: conversacion.empresa_id,
        conversacion_id: Number(id),
        tipo_emisor: 'SISTEMA',
        contenido: textoSistema,
      });
    }

    // Notificar por WebSocket: primero el mensaje de despedida para que el widget lo muestre
    const socketIO = getIO();
    if (socketIO) {
      if (mensajeDespedida) {
        socketIO.to(`conversation:${id}`).emit('new_message', {
          ...mensajeDespedida,
          tipo_emisor: 'SISTEMA',
        });
      }
      socketIO.to(`conversation:${id}`).emit('conversation_closed', {
        id_conversacion: Number(id),
        estado: 'CERRADA',
        mensaje_cierre: MENSAJE_CIERRE_SOPORTE,
      });
      socketIO.emit('conversation_updated', {
        id_conversacion: Number(id),
        estado: 'CERRADA',
      });
    }

    res.json({
      message: 'Conversación cerrada',
      conversacion,
    });
  } catch (error) {
    console.error('Error al cerrar conversación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

export default router;
