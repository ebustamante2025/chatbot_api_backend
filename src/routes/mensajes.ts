import express from 'express';
import { db } from '../database/connection.js';
import { getIO } from '../socket.js';

const router = express.Router();

// Obtener mensajes de una conversación
router.get('/conversacion/:conversacion_id', async (req, res) => {
  try {
    const { conversacion_id } = req.params;

    const mensajes = await db('mensajes')
      .select(
        'mensajes.*',
        'contactos.nombre as contacto_nombre',
        'usuarios_soporte.username as agente_username'
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

    // Emitir mensaje en tiempo real vía WebSocket
    const socketIO = getIO();
    if (socketIO) {
      const mensajeConDetalle = await db('mensajes')
        .select(
          'mensajes.*',
          'contactos.nombre as contacto_nombre',
          'usuarios_soporte.username as agente_username'
        )
        .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')
        .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')
        .where('mensajes.id_mensaje', mensaje.id_mensaje)
        .first();
      const payload = mensajeConDetalle || mensaje;
      socketIO.to(`conversation:${conversacion_id}`).emit('new_message', payload);
      console.log(`[WebSocket] Mensaje emitido a conversación ${conversacion_id}`);
    }

    res.status(201).json({
      message: 'Mensaje creado',
      mensaje,
    });
  } catch (error: unknown) {
    console.error('Error al crear mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear el mensaje',
    });
  }
});

export default router;
