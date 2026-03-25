/**
 * Integración Telegram: webhook para recibir mensajes, registro por NIT/cédula,
 * creación de conversaciones con canal TELEGRAM y guardado en mensajes.
 * Los asesores responden desde el CRM; el envío a Telegram se hace en mensajes.ts.
 *
 * Varios chat_id pueden compartir el mismo contacto (mismo NIT/cédula): varias filas en telegram_contactos.
 * Un segundo dispositivo no puede completar el registro mientras exista otro chat vinculado al mismo contacto
 * y una conversación de soporte activa (EN_COLA/ASIGNADA/ACTIVA, excl. IA360_DOC); al quedar CERRADA, sí.
 * Si el vínculo existe pero no hay conversación de soporte activa (p. ej. cerrada en el CRM), se exige de nuevo
 * NIT + cédula del director (validación de licencia) antes de aceptar mensajes.
 * Comandos /registrar o /cambiar: borran el vínculo de ESTE chat y reinician el flujo NIT → cédula
 * (misma cuenta puede asociarse a otra empresa/persona).
 */
import express from 'express';
import { db } from '../database/connection.js';
import { getIO } from '../socket.js';
import { validarLicencia, type ContratoVigente, type ContactoCliente } from '../services/licenciaService.js';
import { sendTelegramMessage, isTelegramConfigured, getTelegramBotMe } from '../services/telegramService.js';
import { findConversacionActivaSoporte } from '../services/conversacionActivaUnica.js';

const router = express.Router();

/** Igual que el widget: espacios → guion bajo, mayúsculas (webhook / CRM). */
function formatearNombreLicencia(nombre: string): string {
  return nombre.trim().replace(/\s+/g, '_').toUpperCase();
}

const PREFIJO_MENSAJE_SERVICIO_SOLO_ASESOR = 'Solicito soporte para el servicio:';

const REGISTRO_WEBHOOK_URL =
  process.env.ISA_REGISTRO_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/1986379d-e2f5-4eb3-b925-146875342724';

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

type PendingStep = 'nit' | 'documento' | 'licencia';
interface PendingRegistration {
  step: PendingStep;
  nit?: string;
  empresa_id?: number;
  /** Texto para webhook (ej. NIT 900… — Razón social) */
  nombre_empresa_display?: string;
  contactosClientes?: ContactoCliente[];
  contratosVigentes?: ContratoVigente[];
  director_cedula?: string;
  director_nombre?: string;
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

async function ensureEmpresaPorNitConLicencia(
  nit: string
): Promise<
  | {
      id_empresa: number;
      nombre_empresa: string;
      contactosClientes: ContactoCliente[];
      contratosVigentes: ContratoVigente[];
    }
  | { error: string }
> {
  const validacion = await validarLicencia(nit);
  if (!validacion.valida) {
    return { error: validacion.mensaje || 'Licencia no válida para este NIT' };
  }
  const contratos = validacion.contratosVigentes ?? [];
  if (contratos.length === 0) {
    return {
      error:
        'No hay contratos o licencias vigentes para este NIT. Para activar el soporte en línea, contacte a Servicio al Cliente.',
    };
  }
  const contactos = validacion.contactosClientes ?? [];
  if (contactos.length === 0) {
    return {
      error:
        'La licencia no devolvió contactos autorizados. No se puede validar la cédula del director de proyecto.',
    };
  }
  let empresa = await db('empresas').where({ nit }).first();
  const nombreEmpresa = validacion.clienteNombre?.trim() || empresa?.nombre_empresa || `Empresa NIT ${nit}`;
  if (!empresa) {
    const [inserted] = await db('empresas')
      .insert({ nit, nombre_empresa: nombreEmpresa, estado: true })
      .returning(['id_empresa', 'nombre_empresa']);
    empresa = inserted;
  }
  return {
    id_empresa: empresa.id_empresa,
    nombre_empresa: empresa.nombre_empresa,
    contactosClientes: contactos,
    contratosVigentes: contratos,
  };
}

function buscarContactoPorCedula(contactos: ContactoCliente[], documento: string): ContactoCliente | undefined {
  const docTrim = documento.trim();
  const docDigits = documento.replace(/\D/g, '');
  return contactos.find((c) => {
    const idStr = String(c.Identificacion).trim();
    if (idStr === docTrim) return true;
    if (docDigits.length > 0 && idStr.replace(/\D/g, '') === docDigits) return true;
    return false;
  });
}

async function enviarWebhookRegistroTelegram(body: {
  nit: string;
  razon_social: string;
  director: string;
  director_cedula: string;
  licencia: string;
}): Promise<void> {
  try {
    await fetch(REGISTRO_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn('[Telegram] Webhook registro:', e);
  }
}

type CtxRegistroTelegram = {
  nit: string;
  empresa_id: number;
  nombre_empresa_display: string;
  director_cedula: string;
  director_nombre: string;
  nombre_telegram?: string;
  telegram_username?: string;
  telegram_user_id?: string;
};

/** Mensaje solo para el CRM (mismo prefijo que el widget); no se guarda la licencia en telegram_contactos. */
async function insertarMensajeServicioEnCrmSiConversacionVacia(
  empresaId: number,
  contactoId: number,
  licenciaFmt: string
): Promise<void> {
  const { id_conversacion, created } = await findOrCreateConversacionTelegram(empresaId, contactoId);
  const countRow = await db('mensajes').where('conversacion_id', id_conversacion).count('* as c').first();
  const n = Number((countRow as { c?: string })?.c ?? 0);
  if (n > 0) return;

  await db('mensajes').insert({
    empresa_id: empresaId,
    conversacion_id: id_conversacion,
    tipo_emisor: 'CONTACTO',
    contacto_id: contactoId,
    contenido: `${PREFIJO_MENSAJE_SERVICIO_SOLO_ASESOR} ${licenciaFmt}`,
  });

  await db('conversaciones').where('id_conversacion', id_conversacion).update({ ultima_actividad_en: db.raw('now()') });

  const socketIO = getIO();
  if (!socketIO) return;

  const msgServ = await db('mensajes')
    .where('conversacion_id', id_conversacion)
    .orderBy('id_mensaje', 'desc')
    .first();
  if (msgServ) socketIO.to(`conversation:${id_conversacion}`).emit('new_message', msgServ);

  const mensajes = await db('mensajes').where('conversacion_id', id_conversacion).orderBy('creado_en', 'asc');
  if (created) {
    const conv = await db('conversaciones').where('id_conversacion', id_conversacion).first();
    if (conv) socketIO.to('crm').emit('new_conversation', { ...conv, mensajes });
  }
  socketIO.to('crm').emit('crm_activity', { id_conversacion, tipo_emisor: 'CONTACTO' });
}

async function completarRegistroTelegram(
  chatId: string,
  from: { first_name?: string; last_name?: string; username?: string; id?: number },
  ctx: CtxRegistroTelegram,
  descripcionContrato: string
): Promise<void> {
  const empresaId = ctx.empresa_id;
  const documento = ctx.director_cedula;
  const nombre = ctx.director_nombre;

  const con = await ensureContacto(empresaId, documento, nombre);
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

  const licenciaFmt = formatearNombreLicencia(descripcionContrato);
  await enviarWebhookRegistroTelegram({
    nit: ctx.nit,
    razon_social: ctx.nombre_empresa_display,
    director: ctx.director_nombre,
    director_cedula: ctx.director_cedula,
    licencia: licenciaFmt,
  });

  await db('telegram_contactos').insert({
    chat_id: chatId,
    contacto_id: con.id_contacto,
    empresa_id: empresaId,
    telegram_user_id: ctx.telegram_user_id || null,
    telegram_username: ctx.telegram_username || null,
    nombre_telegram: ctx.nombre_telegram || null,
  });

  await insertarMensajeServicioEnCrmSiConversacionVacia(empresaId, con.id_contacto, licenciaFmt);

  pendingRegistration.delete(chatId);
  await sendTelegramMessage(
    chatId,
    'Registro completado. Ya puede escribir su consulta y un asesor le atenderá.'
  );
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
      'Hola, gracias por escribir. Para atenderle, envíe el **NIT** de su empresa (solo números). Luego se validará la **cédula del director de proyecto** y elegirá el **servicio/licencia** para el que requiere soporte.'
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
      const emp = await ensureEmpresaPorNitConLicencia(nit);
      if ('error' in emp) {
        await sendTelegramMessage(chatId, `No se pudo validar el NIT: ${emp.error}`);
        return;
      }
      const textoEmpresa = `NIT ${nit} — ${emp.nombre_empresa}`;
      pendingRegistration.set(chatId, {
        step: 'documento',
        nit,
        empresa_id: emp.id_empresa,
        nombre_empresa_display: textoEmpresa,
        contactosClientes: emp.contactosClientes,
        contratosVigentes: emp.contratosVigentes,
        nombre_telegram: pending.nombre_telegram,
        telegram_username: pending.telegram_username,
        telegram_user_id: pending.telegram_user_id,
      });
      await sendTelegramMessage(
        chatId,
        `NIT validado (${textoEmpresa}). Envíe la **cédula del director de proyecto** (debe figurar en los datos de la licencia).`
      );
      return;
    }

    if (pending.step === 'documento') {
      if (!text) {
        await sendTelegramMessage(chatId, 'Por favor envíe la cédula del director de proyecto.');
        return;
      }
      const documento = text.trim();
      if (!documento) {
        await sendTelegramMessage(chatId, 'El documento no puede estar vacío. Intente de nuevo.');
        return;
      }
      const contactos = pending.contactosClientes ?? [];
      const contratos = pending.contratosVigentes ?? [];
      const contactoValido = buscarContactoPorCedula(contactos, documento);
      if (!contactoValido) {
        await sendTelegramMessage(
          chatId,
          'La cédula no está registrada como director de proyecto para esta empresa según la licencia. Verifique el número o contacte al administrador de su empresa.'
        );
        return;
      }
      const nombreCompleto =
        [contactoValido.Nombres, contactoValido.Apellidos].filter(Boolean).join(' ').trim() ||
        String(contactoValido.Identificacion).trim();
      const cedulaCanon = String(contactoValido.Identificacion).trim();
      const nombreEmpresaDisplay = pending.nombre_empresa_display || `NIT ${pending.nit} — Empresa`;

      const ctxBase: CtxRegistroTelegram = {
        nit: pending.nit!,
        empresa_id: pending.empresa_id!,
        nombre_empresa_display: nombreEmpresaDisplay,
        director_cedula: cedulaCanon,
        director_nombre: nombreCompleto,
        nombre_telegram: pending.nombre_telegram,
        telegram_username: pending.telegram_username,
        telegram_user_id: pending.telegram_user_id,
      };

      if (contratos.length === 1) {
        const desc = contratos[0].Descripcion?.trim() || contratos[0].Codigo || 'Servicio';
        await completarRegistroTelegram(chatId, from, ctxBase, desc);
        return;
      }

      const lines = contratos.map((c, i) => `${i + 1}. ${c.Descripcion || c.Codigo || 'Servicio'}`).join('\n');
      pendingRegistration.set(chatId, {
        ...pending,
        step: 'licencia',
        director_cedula: cedulaCanon,
        director_nombre: nombreCompleto,
      });
      await sendTelegramMessage(
        chatId,
        `Contacto verificado: ${nombreCompleto}.\n\nSeleccione el producto o servicio para el que requiere **soporte** (responda solo con el número):\n\n${lines}`
      );
      return;
    }

    if (pending.step === 'licencia') {
      if (!text) {
        await sendTelegramMessage(chatId, 'Responda con el número de la lista (1, 2, …).');
        return;
      }
      const opts = pending.contratosVigentes ?? [];
      const raw = text.trim();
      const num = parseInt(raw, 10);
      let elegido: ContratoVigente | undefined;
      if (!Number.isNaN(num) && num >= 1 && num <= opts.length) {
        elegido = opts[num - 1];
      } else {
        const rawLower = raw.toLowerCase();
        elegido = opts.find((c) => (c.Descripcion || '').trim().toLowerCase() === rawLower);
      }
      if (!elegido) {
        await sendTelegramMessage(chatId, 'Número o servicio no válido. Envíe solo el número de la lista (1, 2, …).');
        return;
      }
      const desc = elegido.Descripcion?.trim() || elegido.Codigo || 'Servicio';
      const nombreEmpresaDisplay = pending.nombre_empresa_display || `NIT ${pending.nit} — Empresa`;
      await completarRegistroTelegram(chatId, from, {
        nit: pending.nit!,
        empresa_id: pending.empresa_id!,
        nombre_empresa_display: nombreEmpresaDisplay,
        director_cedula: pending.director_cedula!,
        director_nombre: pending.director_nombre!,
        nombre_telegram: pending.nombre_telegram,
        telegram_username: pending.telegram_username,
        telegram_user_id: pending.telegram_user_id,
      }, desc);
      return;
    }
  }

  const linkRegistrado = await db('telegram_contactos').where('chat_id', chatId).first();
  if (linkRegistrado) {
    const eid = Number(linkRegistrado.empresa_id);
    const cid = Number(linkRegistrado.contacto_id);
    const soporteActiva = await findConversacionActivaSoporte(eid, cid);
    if (!soporteActiva) {
      await db('telegram_contactos').where('chat_id', chatId).del();
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
        'La conversación de soporte anterior está cerrada en el CRM. Para una nueva consulta debe validar de nuevo: envíe el **NIT**, luego la **cédula del director de proyecto** y elija el **servicio** en la lista. Puede usar datos distintos a la vez anterior.'
      );
      return;
    }
  }

  if (text) {
    await processIncomingTelegramMessage(chatId, text, from);
  }
});

export default router;
