/**
 * Integración Telegram: webhook para recibir mensajes, registro por NIT/cédula,
 * creación de conversaciones con canal TELEGRAM y guardado en mensajes.
 * Los asesores responden desde el CRM; el envío a Telegram se hace en mensajes.ts.
 *
 * Varios chat_id pueden compartir el mismo contacto (mismo NIT/cédula): varias filas en telegram_contactos.
 * Un segundo dispositivo no puede completar el registro mientras exista otro chat vinculado al mismo contacto
 * y una conversación de soporte activa (EN_COLA/ASIGNADA/ACTIVA, excl. IA360_DOC); al quedar CERRADA, sí.
 * Comandos /registrar o /cambiar: borran el vínculo de ESTE chat y reinician el flujo NIT → cédula
 * (misma cuenta puede asociarse a otra empresa/persona).
 */
import express from 'express';
import { db } from '../database/connection.js';
import { getIO } from '../socket.js';
import { validarLicencia } from '../services/licenciaService.js';
import { sendTelegramMessage, isTelegramConfigured, getTelegramBotMe } from '../services/telegramService.js';
import { findConversacionActivaSoporte } from '../services/conversacionActivaUnica.js';

const router = express.Router();

/** GET /api/telegram/status — Verificar si Telegram está configurado y ver estado (para depuración). */
router.get('/status', async (_req, res) => {
  console.log('[Telegram] GET /api/telegram/status solicitado');
  try {
    const configured = isTelegramConfigured();
    let bot = null;
    let contactosCount = 0;
    let ultimaConversacion = null;
    if (configured) {
      const me = await getTelegramBotMe();
      if (me.ok && me.result) bot = { username: me.result.username, first_name: me.result.first_name };
      const count = await db('telegram_contactos').count('* as total').first();
      contactosCount = Number((count as any)?.total ?? 0);
      const ultima = await db('conversaciones')
        .where('canal', 'TELEGRAM')
        .orderBy('ultima_actividad_en', 'desc')
        .select('id_conversacion', 'estado', 'ultima_actividad_en', 'creada_en')
        .first();
      ultimaConversacion = ultima || null;
    }
    res.json({
      ok: true,
      telegram_configured: configured,
      bot,
      telegram_contactos_registrados: contactosCount,
      ultima_conversacion_telegram: ultimaConversacion,
    });
  } catch (e) {
    console.error('[Telegram] Error en /status:', e);
    res.status(500).json({ ok: false, error: 'Error al obtener estado' });
  }
});

type PendingStep = 'nit' | 'documento';
interface PendingRegistration {
  step: PendingStep;
  nit?: string;
  empresa_id?: number;
  nombre_telegram?: string;
  telegram_username?: string;
  telegram_user_id?: string;
}
const pendingRegistration = new Map<string, PendingRegistration>();

function extractMessage(update: Record<string, any>): { chatId: string; text: string; from?: any; messageId?: number } | null {
  const message = update?.message;
  if (!message?.chat?.id) return null;
  return {
    chatId: String(message.chat.id),
    text: String(message.text || '').trim(),
    from: message.from,
    messageId: message.message_id,
  };
}

/** /registrar, /cambiar o /reiniciar (admite sufijo @NombreBot). */
function isRegistrarCommand(raw: string): boolean {
  const first = raw.trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (!first.startsWith('/')) return false;
  const cmd = first.split('@')[0];
  return cmd === '/registrar' || cmd === '/cambiar' || cmd === '/reiniciar';
}

async function ensureEmpresaByNit(nit: string): Promise<{ id_empresa: number; nombre_empresa: string } | { error: string }> {
  const validacion = await validarLicencia(nit);
  if (!validacion.valida) {
    return { error: validacion.mensaje || 'Licencia no válida para este NIT' };
  }
  let empresa = await db('empresas').where({ nit }).first();
  const nombreEmpresa = validacion.clienteNombre?.trim() || empresa?.nombre_empresa || `Empresa NIT ${nit}`;
  if (!empresa) {
    const [inserted] = await db('empresas')
      .insert({ nit, nombre_empresa: nombreEmpresa, estado: true })
      .returning(['id_empresa', 'nombre_empresa']);
    empresa = inserted;
  }
  return { id_empresa: empresa.id_empresa, nombre_empresa: empresa.nombre_empresa };
}

async function ensureContacto(empresaId: number, documento: string, nombre: string): Promise<{ id_contacto: number } | { error: string }> {
  let contacto = await db('contactos').where({ empresa_id: empresaId, documento }).first();
  if (!contacto) {
    try {
      const [inserted] = await db('contactos')
        .insert({
          empresa_id: empresaId,
          tipo: 'CLIENTE',
          nombre: nombre || `Contacto ${documento}`,
          documento,
        })
        .returning(['id_contacto']);
      contacto = inserted;
    } catch (e: any) {
      if (e.code === '23505') {
        contacto = await db('contactos').where({ empresa_id: empresaId, documento }).first();
      } else throw e;
    }
  }
  if (!contacto) return { error: 'No se pudo crear o obtener el contacto' };
  return { id_contacto: contacto.id_contacto };
}

async function findOrCreateConversacionTelegram(empresaId: number, contactoId: number): Promise<{ id_conversacion: number; created: boolean }> {
  const existente = await findConversacionActivaSoporte(empresaId, contactoId);

  if (existente) {
    return { id_conversacion: existente.id_conversacion, created: false };
  }

  const [conv] = await db('conversaciones')
    .insert({
      empresa_id: empresaId,
      contacto_id: contactoId,
      canal: 'TELEGRAM',
      tema: 'SOPORTE',
      estado: 'EN_COLA',
      prioridad: 'MEDIA',
    })
    .returning(['id_conversacion']);
  return { id_conversacion: conv.id_conversacion, created: true };
}

async function processIncomingTelegramMessage(
  chatId: string,
  text: string,
  from: { first_name?: string; last_name?: string; username?: string; id?: number }
): Promise<void> {
  const nombreTelegram = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
  const telegramUsername = from?.username ? String(from.username) : '';
  const telegramUserId = from?.id != null ? String(from.id) : '';

  const link = await db('telegram_contactos').where('chat_id', chatId).first();
  if (!link) {
    await sendTelegramMessage(
      chatId,
      'Hola, gracias por escribir. Para atenderle, por favor ingrese el NIT de su empresa (solo números).'
    );
    pendingRegistration.set(chatId, {
      step: 'nit',
      nombre_telegram: nombreTelegram || undefined,
      telegram_username: telegramUsername || undefined,
      telegram_user_id: telegramUserId || undefined,
    });
    return;
  }

  const empresaId = Number(link.empresa_id);
  const contactoId = Number(link.contacto_id);

  const { id_conversacion, created } = await findOrCreateConversacionTelegram(empresaId, contactoId);

  await db('mensajes').insert({
    empresa_id: empresaId,
    conversacion_id: id_conversacion,
    tipo_emisor: 'CONTACTO',
    contacto_id: contactoId,
    contenido: text || '(mensaje vacío)',
  });

  await db('conversaciones').where('id_conversacion', id_conversacion).update({ ultima_actividad_en: db.raw('now()') });
  await db('telegram_contactos').where('chat_id', chatId).update({ ultima_actividad_en: db.raw('now()') });

  const socketIO = getIO();
  if (socketIO) {
    const mensajes = await db('mensajes')
      .select('mensajes.*')
      .where('mensajes.conversacion_id', id_conversacion)
      .orderBy('mensajes.creado_en', 'asc');
    const lastMsg = mensajes[mensajes.length - 1];
    if (lastMsg) {
      socketIO.to(`conversation:${id_conversacion}`).emit('new_message', lastMsg);
    }
    if (created) {
      const conv = await db('conversaciones')
        .select('conversaciones.*')
        .where('id_conversacion', id_conversacion)
        .first();
      if (conv) socketIO.to('crm').emit('new_conversation', { ...conv, mensajes });
    }
    socketIO.to('crm').emit('crm_activity', { id_conversacion, tipo_emisor: 'CONTACTO' });
  }

  if (created) {
    await sendTelegramMessage(chatId, 'Tu mensaje fue recibido. Un asesor te responderá en breve.');
  }
}

router.post('/webhook', async (req, res) => {
  if (!isTelegramConfigured()) {
    return res.status(503).json({ ok: false, error: 'Telegram no configurado' });
  }
  res.status(200).send(); // Responder rápido a Telegram

  const msg = extractMessage(req.body);
  if (msg?.chatId) {
    console.log('[Telegram] Mensaje recibido — chat_id:', msg.chatId, 'texto:', (msg.text || '').slice(0, 80));
  }
  if (!msg || !msg.chatId) return;

  const from = msg.from || {};
  const chatId = msg.chatId;
  const text = msg.text;

  if (text && isRegistrarCommand(text)) {
    pendingRegistration.delete(chatId);
    const removed = await db('telegram_contactos').where('chat_id', chatId).del();
    const nombreTelegram = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
    const telegramUsername = from?.username ? String(from.username) : '';
    const telegramUserId = from?.id != null ? String(from.id) : '';
    pendingRegistration.set(chatId, {
      step: 'nit',
      nombre_telegram: nombreTelegram || undefined,
      telegram_username: telegramUsername || undefined,
      telegram_user_id: telegramUserId || undefined,
    });
    await sendTelegramMessage(
      chatId,
      removed
        ? 'Registro de este chat reiniciado. Ingrese el NIT de su empresa (solo números).'
        : 'Ingrese el NIT de su empresa (solo números).'
    );
    return;
  }

  const pending = pendingRegistration.get(chatId);
  if (pending) {
    if (pending.step === 'nit') {
      if (!text) {
        await sendTelegramMessage(chatId, 'Por favor envía el NIT de tu empresa (solo números).');
        return;
      }
      const nit = text.replace(/\D/g, '');
      if (!nit) {
        await sendTelegramMessage(chatId, 'El NIT debe contener números. Intenta de nuevo.');
        return;
      }
      const emp = await ensureEmpresaByNit(nit);
      if ('error' in emp) {
        await sendTelegramMessage(chatId, `No se pudo validar el NIT: ${emp.error}`);
        return;
      }
      pendingRegistration.set(chatId, {
        step: 'documento',
        nit,
        empresa_id: emp.id_empresa,
        nombre_telegram: pending.nombre_telegram,
        telegram_username: pending.telegram_username,
        telegram_user_id: pending.telegram_user_id,
      });
      await sendTelegramMessage(chatId, 'NIT registrado. Ahora envía tu número de cédula (documento).');
      return;
    }

    if (pending.step === 'documento') {
      if (!text) {
        await sendTelegramMessage(chatId, 'Por favor envía tu número de cédula (documento).');
        return;
      }
      const documento = text.replace(/\s/g, '').trim();
      if (!documento) {
        await sendTelegramMessage(chatId, 'El documento no puede estar vacío. Intenta de nuevo.');
        return;
      }
      const empresaId = pending.empresa_id!;
      const con = await ensureContacto(empresaId, documento, pending.nombre_telegram || 'Contacto Telegram');
      if ('error' in con) {
        await sendTelegramMessage(chatId, `No se pudo registrar: ${con.error}`);
        return;
      }
      const otroChat = await db('telegram_contactos')
        .where({ empresa_id: empresaId, contacto_id: con.id_contacto })
        .whereNot('chat_id', chatId)
        .first();
      if (otroChat) {
        const convActiva = await findConversacionActivaSoporte(empresaId, con.id_contacto);
        if (convActiva) {
          await sendTelegramMessage(
            chatId,
            'Ya hay otro número de Telegram vinculado a este NIT y cédula con la conversación de soporte abierta. Cuando el asesor cierre el caso en el CRM, podrá completar el registro desde este dispositivo. Si necesita cambiar de número, use /registrar en el Telegram que ya está vinculado.'
          );
          pendingRegistration.delete(chatId);
          return;
        }
      }
      await db('telegram_contactos').insert({
        chat_id: chatId,
        contacto_id: con.id_contacto,
        empresa_id: empresaId,
        telegram_user_id: pending.telegram_user_id || null,
        telegram_username: pending.telegram_username || null,
        nombre_telegram: pending.nombre_telegram || null,
      });
      pendingRegistration.delete(chatId);
      await sendTelegramMessage(chatId, 'Registro completado. Ya puedes escribir tu consulta y un asesor te atenderá.');
      if (text && text !== documento) {
        await processIncomingTelegramMessage(chatId, text, from);
      }
      return;
    }
  }

  if (text) {
    await processIncomingTelegramMessage(chatId, text, from);
  }
});

export default router;
