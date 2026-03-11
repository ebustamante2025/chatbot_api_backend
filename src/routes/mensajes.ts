import express from 'express';
import { db } from '../database/connection.js';
import { getIO } from '../socket.js';
import type { JwtPayload } from '../middleware/auth.js';

const router = express.Router();
const EDICION_MENSAJE_MAX_MINUTOS = 3;

// Obtener mensajes de una conversación
router.get('/conversacion/:conversacion_id', async (req, res) => {
  try {
    const { conversacion_id } = req.params;

    const mensajes = await db('mensajes')
      .select(
        'mensajes.*',
        'contactos.nombre as contacto_nombre',
        'usuarios_soporte.username as agente_username',
        'usuarios_soporte.nombre_completo as agente_nombre_completo'
      )
      .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
      .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
      .where('mensajes.conversacion_id', conversacion_id)
      .orderBy('mensajes.creado_en', 'asc');

    res.json({ mensajes });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los mensajes',
    });
  }
});

// Crear mensaje (CONTACTO, AGENTE, BOT o SISTEMA)
router.post('/', async (req, res) => {
  try {
    const {
      empresa_id,
      conversacion_id,
      tipo_emisor,
      usuario_id,
      contacto_id,
      contenido,
    } = req.body;

    if (!empresa_id || !conversacion_id || !tipo_emisor || !contenido?.trim()) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'empresa_id, conversacion_id, tipo_emisor y contenido son obligatorios',
      });
    }

    const validEmisores = ['CONTACTO', 'AGENTE', 'BOT', 'SISTEMA'];
    if (!validEmisores.includes(tipo_emisor)) {
      return res.status(400).json({
        error: 'tipo_emisor inválido',
        message: `Debe ser uno de: ${validEmisores.join(', ')}`,
      });
    }

    const conversacionIdNum = Number(conversacion_id);
    const conversacion = await db('conversaciones')
      .where({ id_conversacion: conversacionIdNum })
      .first();

    if (!conversacion) {
      return res.status(404).json({
        error: 'Conversación no encontrada',
        message: 'La conversación no existe',
      });
    }

    const empresaIdNum = Number(empresa_id);
    const conversacionEmpresaId = Number(conversacion.empresa_id);
    if (empresaIdNum !== conversacionEmpresaId) {
      return res.status(403).json({
        error: 'Empresa no coincide',
        message: 'La conversación no pertenece a esta empresa',
      });
    }

    if (tipo_emisor === 'CONTACTO') {
      if (!contacto_id) {
        return res.status(400).json({
          error: 'contacto_id requerido',
          message: 'Para mensajes del contacto se requiere contacto_id',
        });
      }
      const contactoIdNum = Number(contacto_id);
      const conversacionContactoId = Number(conversacion.contacto_id);
      if (contactoIdNum !== conversacionContactoId) {
        return res.status(403).json({
          error: 'Contacto no autorizado',
          message: 'Solo el contacto registrado en esta conversación puede enviar mensajes. Verifica tu registro en el widget.',
        });
      }
      const contactoExiste = await db('contactos')
        .where({ id_contacto: contactoIdNum, empresa_id: conversacionEmpresaId })
        .first();
      if (!contactoExiste) {
        return res.status(403).json({
          error: 'Contacto no registrado',
          message: 'Debes estar registrado como contacto para enviar mensajes.',
        });
      }
    }

    // Si es el primer mensaje del agente en esta conversación (chat con agente), insertar presentación automática antes
    let mensajePresentacion: Record<string, unknown> | null = null;
    if (tipo_emisor === 'AGENTE' && usuario_id) {
      const cuentaMensajesAgente = await db('mensajes')
        .where({ conversacion_id: conversacionIdNum, tipo_emisor: 'AGENTE' })
        .count('id_mensaje as total')
        .first();
      const esPrimerMensajeAgente = Number(cuentaMensajesAgente?.total ?? 0) === 0;
      if (esPrimerMensajeAgente) {
        const agente = await db('usuarios_soporte')
          .where({ id_usuario: Number(usuario_id) })
          .select('nombre_completo', 'username')
          .first();
        const nombreAgente = agente?.nombre_completo?.trim() || agente?.username || 'Soporte';
        const textoPresentacion = `Hola, soy ${nombreAgente}, ¿en qué puedo ayudarte?`;
        const [intro] = await db('mensajes')
          .insert({
            empresa_id: Number(empresa_id),
            conversacion_id: Number(conversacion_id),
            tipo_emisor: 'AGENTE',
            usuario_id: Number(usuario_id),
            contenido: textoPresentacion,
          })
          .returning('*');
        mensajePresentacion = intro as Record<string, unknown>;
      }
    }

    const insertData: Record<string, unknown> = {
      empresa_id: Number(empresa_id),
      conversacion_id: Number(conversacion_id),
      tipo_emisor,
      contenido: contenido.trim(),
    };

    if (usuario_id) insertData.usuario_id = Number(usuario_id);
    if (contacto_id) insertData.contacto_id = Number(contacto_id);

    const [mensaje] = await db('mensajes')
      .insert(insertData)
      .returning('*');

    // Actualizar última actividad de la conversación
    await db('conversaciones')
      .where('id_conversacion', conversacion_id)
      .update({ ultima_actividad_en: db.raw('now()') });

    // Si el agente envía un mensaje y la conversación está ASIGNADA, pasar a ACTIVA
    if (tipo_emisor === 'AGENTE' && conversacion.estado === 'ASIGNADA') {
      await db('conversaciones')
        .where('id_conversacion', conversacionIdNum)
        .update({ estado: 'ACTIVA' });

      // Notificar a todos los clientes del cambio de estado
      const socketIO = getIO();
      if (socketIO) {
        socketIO.emit('conversation_updated', {
          id_conversacion: conversacionIdNum,
          estado: 'ACTIVA',
        });
      }
    }

    // Si hubo mensaje de presentación, obtenerlo con detalle para respuesta y WebSocket
    let mensajePresentacionParaRespuesta: Record<string, unknown> | null = null;
    if (mensajePresentacion && typeof mensajePresentacion.id_mensaje === 'number') {
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
      mensajePresentacionParaRespuesta = (presentacionConDetalle || mensajePresentacion) as Record<string, unknown>;
    }

    // Emitir mensaje en tiempo real vía WebSocket (presentación primero, luego el mensaje del agente)
    const socketIO = getIO();
    if (socketIO) {
      if (mensajePresentacionParaRespuesta) {
        socketIO.to(`conversation:${conversacionIdNum}`).emit('new_message', mensajePresentacionParaRespuesta);
      }
      const mensajeConDetalle = await db('mensajes')
        .select(
          'mensajes.*',
          'contactos.nombre as contacto_nombre',
          'usuarios_soporte.username as agente_username',
          'usuarios_soporte.nombre_completo as agente_nombre_completo'
        )
        .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
        .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
        .where('mensajes.id_mensaje', mensaje.id_mensaje)
        .first();
      const payload = mensajeConDetalle || mensaje;
      socketIO.to(`conversation:${conversacionIdNum}`).emit('new_message', payload);

      // Notificar al agente asignado para que vea la actualización en su sidebar
      if (conversacion.asignada_a_usuario_id) {
        socketIO.to(`agent:${conversacion.asignada_a_usuario_id}`).emit('conversation_new_activity', {
          id_conversacion: conversacionIdNum,
        });
      }

      // Emitir evento global para dashboards (bot, admin) cuando llegan mensajes BOT o CONTACTO
      if (tipo_emisor === 'BOT' || tipo_emisor === 'CONTACTO') {
        socketIO.emit('bot_conversation_activity', {
          id_conversacion: conversacionIdNum,
          tipo_emisor,
        });
      }

      // Notificar a TODOS los usuarios del CRM para que refresquen su sidebar
      socketIO.to('crm').emit('crm_activity', {
        id_conversacion: conversacionIdNum,
        tipo_emisor,
      });

      console.log(`[WebSocket] Mensaje emitido a conversación ${conversacion_id}`);
    }

    res.status(201).json({
      message: 'Mensaje creado',
      mensaje,
      ...(mensajePresentacionParaRespuesta && { mensajePresentacion: mensajePresentacionParaRespuesta }),
    });
  } catch (error: unknown) {
    console.error('Error al crear mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear el mensaje',
    });
  }
});

/** Solo el usuario de soporte puede editar/eliminar mensajes del CONTACTO y solo dentro de 2 minutos */
function puedeEditarEliminarMensaje(creadoEn: string | Date): boolean {
  const creado = new Date(creadoEn).getTime();
  const limite = Date.now() - EDICION_MENSAJE_MAX_MINUTOS * 60 * 1000;
  return creado > limite;
}

// --- Editar / eliminar mensaje por el contacto (widget, sin JWT) ---
// PUT /mensajes/contacto/:id - body: { empresa_id, conversacion_id, contacto_id, contenido }
router.put('/contacto/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de mensaje inválido' });

    const { empresa_id, conversacion_id, contacto_id, contenido } = req.body;
    if (!empresa_id || !conversacion_id || !contacto_id || typeof contenido !== 'string' || !contenido.trim()) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'empresa_id, conversacion_id, contacto_id y contenido son obligatorios',
      });
    }

    const mensaje = await db('mensajes').where({ id_mensaje: id }).first();
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado', message: 'El mensaje no existe' });
    }
    if (mensaje.tipo_emisor !== 'CONTACTO') {
      return res.status(403).json({
        error: 'No permitido',
        message: 'Solo se pueden editar mensajes enviados por el contacto.',
      });
    }
    if (Number(mensaje.contacto_id) !== Number(contacto_id) || Number(mensaje.conversacion_id) !== Number(conversacion_id) || Number(mensaje.empresa_id) !== Number(empresa_id)) {
      return res.status(403).json({
        error: 'No autorizado',
        message: 'No puedes editar este mensaje.',
      });
    }
    if (!puedeEditarEliminarMensaje(mensaje.creado_en)) {
      return res.status(403).json({
        error: 'Tiempo excedido',
        message: `Solo puedes editar el mensaje durante ${EDICION_MENSAJE_MAX_MINUTOS} minutos después de enviarlo.`,
      });
    }

    const [actualizado] = await db('mensajes')
      .where({ id_mensaje: id })
      .update({ contenido: contenido.trim() })
      .returning('*');

    const socketIO = getIO();
    if (socketIO) {
      const mensajeConDetalle = await db('mensajes')
        .select(
          'mensajes.*',
          'contactos.nombre as contacto_nombre',
          'usuarios_soporte.username as agente_username',
          'usuarios_soporte.nombre_completo as agente_nombre_completo'
        )
        .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
        .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
        .where('mensajes.id_mensaje', actualizado.id_mensaje)
        .first();
      socketIO.to(`conversation:${mensaje.conversacion_id}`).emit('message_updated', mensajeConDetalle || actualizado);
    }

    return res.json({ message: 'Mensaje actualizado', mensaje: actualizado });
  } catch (error: unknown) {
    console.error('Error al actualizar mensaje (contacto):', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo actualizar el mensaje',
    });
  }
});

// DELETE /mensajes/contacto/:id - body: { empresa_id, conversacion_id, contacto_id }
router.delete('/contacto/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de mensaje inválido' });

    const { empresa_id, conversacion_id, contacto_id } = req.body;
    if (!empresa_id || !conversacion_id || !contacto_id) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'empresa_id, conversacion_id y contacto_id son obligatorios',
      });
    }

    const mensaje = await db('mensajes').where({ id_mensaje: id }).first();
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado', message: 'El mensaje no existe' });
    }
    if (mensaje.tipo_emisor !== 'CONTACTO') {
      return res.status(403).json({
        error: 'No permitido',
        message: 'Solo se pueden eliminar mensajes enviados por el contacto.',
      });
    }
    if (Number(mensaje.contacto_id) !== Number(contacto_id) || Number(mensaje.conversacion_id) !== Number(conversacion_id) || Number(mensaje.empresa_id) !== Number(empresa_id)) {
      return res.status(403).json({
        error: 'No autorizado',
        message: 'No puedes eliminar este mensaje.',
      });
    }
    if (!puedeEditarEliminarMensaje(mensaje.creado_en)) {
      return res.status(403).json({
        error: 'Tiempo excedido',
        message: `Solo puedes eliminar el mensaje durante ${EDICION_MENSAJE_MAX_MINUTOS} minutos después de enviarlo.`,
      });
    }

    const conversacionId = Number(mensaje.conversacion_id);
    await db('mensajes').where({ id_mensaje: id }).del();

    const socketIO = getIO();
    if (socketIO) {
      socketIO.to(`conversation:${conversacionId}`).emit('message_deleted', { id_mensaje: id, conversacion_id: conversacionId });
    }

    return res.json({ message: 'Mensaje eliminado' });
  } catch (error: unknown) {
    console.error('Error al eliminar mensaje (contacto):', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo eliminar el mensaje',
    });
  }
});

// Editar mensaje: del contacto (cualquier asesor) o propio del asesor (AGENTE), solo dentro de 3 min
router.put('/:id', async (req, res) => {
  try {
    const user = (req as express.Request & { user?: JwtPayload }).user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado', message: 'Debe iniciar sesión como usuario de soporte' });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de mensaje inválido' });

    const { contenido } = req.body;
    if (typeof contenido !== 'string' || !contenido.trim()) {
      return res.status(400).json({ error: 'contenido requerido', message: 'El contenido del mensaje es obligatorio' });
    }

    const mensaje = await db('mensajes').where({ id_mensaje: id }).first();
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado', message: 'El mensaje no existe' });
    }
    const tipoEmisor = String(mensaje.tipo_emisor || '').toUpperCase();
    if (tipoEmisor !== 'AGENTE') {
      return res.status(403).json({
        error: 'No permitido',
        message: 'Solo puedes editar tus propios mensajes (los que envías tú como agente). No se pueden editar los mensajes que llegan del widget.',
      });
    }
    if (Number(mensaje.usuario_id) !== Number(user.id_usuario)) {
      return res.status(403).json({
        error: 'No permitido',
        message: 'Solo puedes editar tus propios mensajes.',
      });
    }
    if (!puedeEditarEliminarMensaje(mensaje.creado_en)) {
      return res.status(403).json({
        error: 'Tiempo excedido',
        message: `Pasados ${EDICION_MENSAJE_MAX_MINUTOS} minutos no se puede editar ni eliminar este mensaje.`,
      });
    }

    const [actualizado] = await db('mensajes')
      .where({ id_mensaje: id })
      .update({ contenido: contenido.trim() })
      .returning('*');

    const socketIO = getIO();
    if (socketIO) {
      const mensajeConDetalle = await db('mensajes')
        .select(
          'mensajes.*',
          'contactos.nombre as contacto_nombre',
          'usuarios_soporte.username as agente_username',
          'usuarios_soporte.nombre_completo as agente_nombre_completo'
        )
        .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
        .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
        .where('mensajes.id_mensaje', actualizado.id_mensaje)
        .first();
      socketIO.to(`conversation:${mensaje.conversacion_id}`).emit('message_updated', mensajeConDetalle || actualizado);
    }

    return res.json({ message: 'Mensaje actualizado', mensaje: actualizado });
  } catch (error: unknown) {
    console.error('Error al actualizar mensaje:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo actualizar el mensaje',
    });
  }
});

// Eliminar mensaje: del contacto (cualquier asesor) o propio del asesor (AGENTE), solo dentro de 3 min
router.delete('/:id', async (req, res) => {
  try {
    const user = (req as express.Request & { user?: JwtPayload }).user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado', message: 'Debe iniciar sesión como usuario de soporte' });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de mensaje inválido' });

    const mensaje = await db('mensajes').where({ id_mensaje: id }).first();
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado', message: 'El mensaje no existe' });
    }
    const tipoEmisor = String(mensaje.tipo_emisor || '').toUpperCase();
    if (tipoEmisor !== 'AGENTE') {
      return res.status(403).json({
        error: 'No permitido',
        message: 'Solo puedes eliminar tus propios mensajes (los que envías tú como agente). No se pueden eliminar los mensajes que llegan del widget.',
      });
    }
    if (Number(mensaje.usuario_id) !== Number(user.id_usuario)) {
      return res.status(403).json({
        error: 'No permitido',
        message: 'Solo puedes eliminar tus propios mensajes.',
      });
    }
    if (!puedeEditarEliminarMensaje(mensaje.creado_en)) {
      return res.status(403).json({
        error: 'Tiempo excedido',
        message: `Pasados ${EDICION_MENSAJE_MAX_MINUTOS} minutos no se puede editar ni eliminar este mensaje.`,
      });
    }

    const conversacionId = Number(mensaje.conversacion_id);
    await db('mensajes').where({ id_mensaje: id }).del();

    const socketIO = getIO();
    if (socketIO) {
      socketIO.to(`conversation:${conversacionId}`).emit('message_deleted', { id_mensaje: id, conversacion_id: conversacionId });
    }

    return res.json({ message: 'Mensaje eliminado' });
  } catch (error: unknown) {
    console.error('Error al eliminar mensaje:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo eliminar el mensaje',
    });
  }
});

export default router;
