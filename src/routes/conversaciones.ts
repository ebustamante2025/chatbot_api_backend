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
    const { estado, empresa_id } = req.query;
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
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('empresas', 'conversaciones.empresa_id', 'empresas.id_empresa')
      .leftJoin('contactos', 'conversaciones.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'conversaciones.asignada_a_usuario_id', 'usuarios_soporte.id_usuario')
      .orderBy('conversaciones.ultima_actividad_en', 'desc');

    if (estado && typeof estado === 'string') {
      if (!ESTADOS_CONVERSACION.includes(estado as (typeof ESTADOS_CONVERSACION)[number])) {
        return res.status(400).json({
          error: 'Estado no válido',
          message: 'El estado debe ser uno de: EN_COLA, ASIGNADA, ACTIVA, CERRADA',
        });
      }
      query = query.where('conversaciones.estado', estado);
    }
    if (empresa_id && typeof empresa_id === 'string') {
      query = query.where('conversaciones.empresa_id', Number(empresa_id));
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

// Crear conversación (cuando contacto elige "Chatear con agente")
// Un contacto solo puede tener una conversación activa (EN_COLA o ASIGNADA) a la vez; si ya existe, se devuelve esa.
router.post('/', async (req, res) => {
  try {
    const { empresa_id, contacto_id, canal = 'WEB', tema = 'SOPORTE' } = req.body;

    if (!empresa_id || !contacto_id) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'empresa_id y contacto_id son obligatorios',
      });
    }

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

    // Evitar duplicados: si el contacto ya tiene una conversación activa, devolverla
    const existente = await db('conversaciones')
      .where({
        empresa_id: Number(empresa_id),
        contacto_id: Number(contacto_id),
      })
      .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
      .orderBy('creada_en', 'desc')
      .first();

    if (existente) {
      return res.status(200).json({
        message: 'Conversación existente',
        conversacion: existente,
      });
    }

    let conversacion: Record<string, unknown> | undefined;
    try {
      [conversacion] = await db('conversaciones')
        .insert({
          empresa_id: Number(empresa_id),
          contacto_id: Number(contacto_id),
          canal: canal || 'WEB',
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
          })
          .whereIn('estado', ['EN_COLA', 'ASIGNADA', 'ACTIVA'])
          .orderBy('creada_en', 'desc')
          .first();
        if (existente2) {
          return res.status(200).json({
            message: 'Conversación existente',
            conversacion: existente2,
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
      conversacion,
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

    // Notificar por WebSocket a todos los clientes
    const socketIO = getIO();
    if (socketIO) {
      socketIO.emit('conversation_updated', {
        id_conversacion: Number(id),
        estado: 'ASIGNADA',
      });
    }

    res.json({
      message: 'Conversación asignada',
      conversacion,
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

    // Si tiene motivo/notas, guardar como mensaje de sistema
    if (motivo || notas) {
      const textoSistema = `🔒 Caso cerrado${motivo ? ` — Motivo: ${motivo}` : ''}${notas ? `\nNotas: ${notas}` : ''}`;
      await db('mensajes').insert({
        empresa_id: conversacion.empresa_id,
        conversacion_id: Number(id),
        tipo_emisor: 'SISTEMA',
        contenido: textoSistema,
      });
    }

    // Notificar por WebSocket que la conversación se cerró
    const socketIO = getIO();
    if (socketIO) {
      socketIO.to(`conversation:${id}`).emit('conversation_closed', {
        id_conversacion: Number(id),
        estado: 'CERRADA',
      });
      // Notificar globalmente para actualizar dashboards
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
