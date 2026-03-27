/**

 * IA360 — asistente de documentación (Streamlit): contexto empresa/contacto y persistencia de mensajes.

 * Autenticación: por defecto mismo JWT FAQ (purpose: faq) que emite POST /api/faq-acceso.

 * Opcional (solo entornos controlados): IA360_ALLOW_WITHOUT_TOKEN=true y empresaId + contactoId en body o query.

 *

 * Hilo **IA360_DOC** separado del soporte humano (web/Telegram): su propia conversación activa e historial.

 * Mensajes: `conversaciones` + **`mensajes`** — CONTACTO / **IA360**

 */

import express from 'express';

import jwt, { type JwtPayload } from 'jsonwebtoken';

import { db } from '../database/connection.js';

import { getIO } from '../socket.js';

import {
  runIa360Chat,
  isOpenAIConfigured,
  type Ia360ChatHistoryItem,
} from '../services/ia360OpenAIChatService.js';

import { isNotionConfigured } from '../services/ia360NotionService.js';

import {
  inlineNotionImagesInMarkdown,
  stripMarkdownImages,
} from '../services/ia360InlineImagesService.js';

import { findConversacionActivaIa360 } from '../services/conversacionActivaUnica.js';



const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'crm-chatbot-secret-change-in-production';



/** Valor de `canal` para el hilo exclusivo de documentación (no mezclar con soporte). */

const CANAL_IA360 = 'IA360_DOC';



interface FaqTokenPayload {

  empresaId: number;

  contactoId: number;

  purpose: string;

  servicio?: string;

}



function getToken(req: express.Request): string | null {

  const q = req.query.token;

  if (typeof q === 'string' && q.trim()) return q.trim();

  const auth = req.headers.authorization;

  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();

  const body = req.body as { token?: string };

  if (body?.token && typeof body.token === 'string') return body.token.trim();

  return null;

}



function verifyFaqToken(token: string): FaqTokenPayload | null {

  try {

    const decoded = jwt.verify(token.trim(), JWT_SECRET) as FaqTokenPayload & JwtPayload;

    if (decoded.purpose !== 'faq') return null;

    if (decoded.empresaId == null || decoded.contactoId == null) return null;

    return decoded as FaqTokenPayload;

  } catch {

    return null;

  }

}



interface Ia360ResolvedSession {

  empresaId: number;

  contactoId: number;

  servicioFromToken?: string;

}



function ia360AllowWithoutToken(): boolean {

  return process.env.IA360_ALLOW_WITHOUT_TOKEN?.trim().toLowerCase() === 'true';

}



/**

 * JWT FAQ si hay token; si IA360_ALLOW_WITHOUT_TOKEN=true, empresaId + contactoId en body o query.

 */

function resolveIa360Session(

  req: express.Request,

  body: Record<string, unknown>

): { ok: true; session: Ia360ResolvedSession } | { ok: false; status: number; message: string } {

  const token = getToken(req);

  if (token) {

    const decoded = verifyFaqToken(token);

    if (!decoded) {

      return { ok: false, status: 401, message: 'Token inválido o expirado' };

    }

    return {

      ok: true,

      session: {

        empresaId: Number(decoded.empresaId),

        contactoId: Number(decoded.contactoId),

        servicioFromToken: decoded.servicio,

      },

    };

  }

  if (!ia360AllowWithoutToken()) {

    return { ok: false, status: 401, message: 'Token requerido' };

  }

  const q = req.query as Record<string, unknown>;

  const eRaw = body.empresaId ?? body.empresa_id ?? q.empresaId ?? q.empresa_id;

  const cRaw = body.contactoId ?? body.contacto_id ?? q.contactoId ?? q.contacto_id;

  const empresaId = eRaw != null && String(eRaw).trim() !== '' ? Number(eRaw) : NaN;

  const contactoId = cRaw != null && String(cRaw).trim() !== '' ? Number(cRaw) : NaN;

  if (!Number.isFinite(empresaId) || empresaId < 1 || !Number.isFinite(contactoId) || contactoId < 1) {

    return {

      ok: false,

      status: 400,

      message:

        'Sin token: defina IA360_ALLOW_WITHOUT_TOKEN=true y envíe empresaId y contactoId (body o query).',

    };

  }

  return { ok: true, session: { empresaId, contactoId } };

}



/**

 * Solo conversaciones con canal IA360_DOC; el soporte humano usa otro id_conversacion.

 */

async function findOrCreateConversacionIa360(empresaId: number, contactoId: number): Promise<number> {

  const existente = await findConversacionActivaIa360(empresaId, contactoId);

  if (existente?.id_conversacion != null) {

    return Number(existente.id_conversacion);

  }

  const inserted = await db('conversaciones')

    .insert({

      empresa_id: empresaId,

      contacto_id: contactoId,

      canal: CANAL_IA360,

      tema: 'SOPORTE',

      estado: 'ACTIVA',

      prioridad: 'MEDIA',

    })

    .returning('id_conversacion');

  const row = Array.isArray(inserted) ? inserted[0] : inserted;

  if (row && typeof row === 'object' && 'id_conversacion' in row) {

    return Number((row as { id_conversacion: number }).id_conversacion);

  }

  return Number(row);

}



async function emitirMensajeCrm(conversacionId: number, idMensaje: number, tipoEmisor: string): Promise<void> {

  const socketIO = getIO();

  if (!socketIO) return;



  const mensajeConDetalle = await db('mensajes')

    .select(

      'mensajes.*',

      'contactos.nombre as contacto_nombre',

      'usuarios_soporte.username as agente_username',

      'usuarios_soporte.nombre_completo as agente_nombre_completo',

    )

    .leftJoin('contactos', 'mensajes.contacto_id', 'contactos.id_contacto')

    .leftJoin('usuarios_soporte', 'mensajes.usuario_id', 'usuarios_soporte.id_usuario')

    .where('mensajes.id_mensaje', idMensaje)

    .first();



  if (!mensajeConDetalle) return;



  socketIO.to(`conversation:${conversacionId}`).emit('new_message', mensajeConDetalle);



  const te = String(tipoEmisor || '').toUpperCase();

  if (te === 'BOT' || te === 'IA360' || te === 'CONTACTO') {

    socketIO.emit('bot_conversation_activity', {

      id_conversacion: conversacionId,

      tipo_emisor: te,

    });

  }

  socketIO.to('crm').emit('crm_activity', {

    id_conversacion: conversacionId,

    tipo_emisor: te,

  });

}



/**

 * INSERT en `mensajes`: CONTACTO (usuario) o IA360 (asistente documentación).

 */

async function guardarEnMensajesCrm(

  empresaId: number,

  contactoId: number,

  conversacionId: number,

  rol: 'usuario' | 'asistente',

  contenido: string,

): Promise<{ id_mensaje: number; creado_en: string | null } | null> {

  const tipoEmisor = rol === 'usuario' ? 'CONTACTO' : 'IA360';

  /** Incluye ![alt](url) para que el widget/historial pueda mostrar imágenes vía proxy (URLs Notion/S3 pueden caducar). */
  const contenidoDb = contenido.trim();



  const insertData: Record<string, unknown> = {

    empresa_id: empresaId,

    conversacion_id: conversacionId,

    tipo_emisor: tipoEmisor,

    contenido: contenidoDb,

  };



  if (tipoEmisor === 'CONTACTO') {

    insertData.contacto_id = contactoId;

  }



  const [mensaje] = await db('mensajes').insert(insertData).returning('*');

  const row = mensaje as { id_mensaje?: number; creado_en?: string };

  const idMensaje = Number(row?.id_mensaje);

  if (!idMensaje) return null;



  await db('conversaciones')

    .where('id_conversacion', conversacionId)

    .update({ ultima_actividad_en: db.raw('now()') });



  await emitirMensajeCrm(conversacionId, idMensaje, tipoEmisor);



  return {

    id_mensaje: idMensaje,

    creado_en: row.creado_en != null ? String(row.creado_en) : null,

  };

}



/**

 * GET /api/ia360-doc/contexto?token=...

 * Nombre de empresa y director (contacto) para mostrar en el asistente.

 */

router.get('/ia360-doc/contexto', async (req, res) => {

  try {

    const resolved = resolveIa360Session(req, {});

    if (!resolved.ok) {

      return res.status(resolved.status).json({

        success: false,

        message: resolved.message,

      });

    }

    const { empresaId, contactoId } = resolved.session;

    const empresa = await db('empresas').where({ id_empresa: empresaId }).first();

    const contacto = await db('contactos')

      .where({ id_contacto: contactoId, empresa_id: empresaId })

      .first();



    return res.json({

      success: true,

      empresa_nombre: empresa?.nombre_empresa ?? '—',

      empresa_nit: empresa?.nit ?? null,

      contacto_nombre: contacto?.nombre ?? '—',

      /** Cédula / documento del contacto (segundo “NIT” en la vista unificada si aplica) */
      contacto_documento: contacto?.documento != null ? String(contacto.documento).trim() || null : null,

      contacto_cargo: contacto?.cargo ?? null,

    });

  } catch (error) {

    console.error('Error ia360 contexto:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al obtener contexto',

    });

  }

});



/**

 * POST /api/ia360-doc/mensaje

 * Body: { token, rol: 'usuario' | 'asistente', contenido, servicio? } (servicio ignorado en BD; solo CRM)

 * Guarda solo en `mensajes` + conversación canal IA360_DOC: CONTACTO / IA360.

 */

router.post('/ia360-doc/mensaje', async (req, res) => {

  try {

    const { rol, contenido, servicio } = req.body as {

      rol?: string;

      contenido?: string;

      servicio?: string;

      empresaId?: number;

      contactoId?: number;

    };



    const resolved = resolveIa360Session(req, req.body as Record<string, unknown>);

    if (!resolved.ok) {

      return res.status(resolved.status).json({ success: false, message: resolved.message });

    }



    if (!rol || !['usuario', 'asistente'].includes(rol)) {

      return res.status(400).json({

        success: false,

        message: 'rol debe ser usuario o asistente',

      });

    }

    if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {

      return res.status(400).json({

        success: false,

        message: 'contenido es obligatorio',

      });

    }



    const empresaId = resolved.session.empresaId;

    const contactoId = resolved.session.contactoId;



    const existe = await db('contactos')

      .where({ id_contacto: contactoId, empresa_id: empresaId })

      .first();

    if (!existe) {

      return res.status(403).json({

        success: false,

        message: 'Contacto no pertenece a la empresa indicada',

      });

    }



    const convId = await findOrCreateConversacionIa360(empresaId, contactoId);

    const crm = await guardarEnMensajesCrm(

      empresaId,

      contactoId,

      convId,

      rol as 'usuario' | 'asistente',

      contenido.trim(),

    );

    if (!crm) {

      return res.status(500).json({

        success: false,

        message: 'No se pudo guardar el mensaje en CRM',

      });

    }



    return res.status(201).json({

      success: true,

      id: crm.id_mensaje,

      creado_en: crm.creado_en,

      conversacion_id: convId,

      id_mensaje_crm: crm.id_mensaje,

    });

  } catch (error: unknown) {

    console.error('Error ia360 mensaje:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al guardar mensaje',

    });

  }

});



/**

 * GET /api/ia360-doc/historial?token=...&limite=500

 * Lista todas las interacciones IA360 del contacto (empresa + contacto del JWT).

 * Misma autenticación que contexto/mensaje. Opcional: limite 1–2000 (por defecto 500).

 */

router.get('/ia360-doc/historial', async (req, res) => {

  try {

    const resolved = resolveIa360Session(req, {});

    if (!resolved.ok) {

      return res.status(resolved.status).json({ success: false, message: resolved.message });

    }

    const empresaId = resolved.session.empresaId;

    const contactoId = resolved.session.contactoId;



    const limiteRaw = req.query.limite;

    let limite = 500;

    if (typeof limiteRaw === 'string' && /^\d+$/.test(limiteRaw)) {

      limite = Math.min(2000, Math.max(1, parseInt(limiteRaw, 10)));

    }



    const existe = await db('contactos')

      .where({ id_contacto: contactoId, empresa_id: empresaId })

      .first();

    if (!existe) {

      return res.status(403).json({

        success: false,

        message: 'Contacto no pertenece a la empresa indicada',

      });

    }



    const conv = await findConversacionActivaIa360(empresaId, contactoId);

    if (!conv?.id_conversacion) {

      return res.json({

        success: true,

        empresa_id: empresaId,

        contacto_id: contactoId,

        conversacion_id: null,

        canal: CANAL_IA360,

        total: 0,

        mensajes: [],

      });

    }

    const convId = Number(conv.id_conversacion);

    const filas = await db('mensajes')

      .where({ conversacion_id: convId })

      .orderBy([{ column: 'creado_en', order: 'asc' }, { column: 'id_mensaje', order: 'asc' }])

      .limit(limite)

      .select('id_mensaje', 'tipo_emisor', 'contenido', 'creado_en');

    /** Reintenta descargar imágenes Notion/S3 al cargar historial (solo respuesta; no escribe BD). */
    const rows = filas.map((r) => ({ ...r }));
    const histInlineOff =
      process.env.IA360_HISTORIAL_INLINE_IMAGES?.trim().toLowerCase() === 'false' ||
      process.env.IA360_HISTORIAL_INLINE_IMAGES?.trim().toLowerCase() === '0';
    if (!histInlineOff) {
      const rawMax = process.env.IA360_HISTORIAL_INLINE_MAX_MESSAGES?.trim();
      const maxMsgs = Math.min(
        200,
        Math.max(1, rawMax ? parseInt(rawMax, 10) || 35 : 35),
      );
      const indices: number[] = [];
      for (let i = rows.length - 1; i >= 0 && indices.length < maxMsgs; i--) {
        const te = String(rows[i].tipo_emisor || '').toUpperCase();
        if (te !== 'IA360') continue;
        const c = String(rows[i].contenido ?? '');
        if (!c.includes('https://')) continue;
        if (c.includes('data:image/')) continue;
        indices.push(i);
      }
      for (const i of indices) {
        try {
          rows[i].contenido = await inlineNotionImagesInMarkdown(String(rows[i].contenido));
        } catch (e) {
          console.warn('[ia360-doc/historial] inline imágenes omitido mensaje', rows[i].id_mensaje, e);
        }
      }
    }

    return res.json({

      success: true,

      empresa_id: empresaId,

      contacto_id: contactoId,

      conversacion_id: convId,

      canal: String(conv.canal || CANAL_IA360),

      total: rows.length,

      mensajes: rows.map((r) => {

        const te = String(r.tipo_emisor || '').toUpperCase();

        const rol = te === 'CONTACTO' ? 'usuario' : 'asistente';

        return {

          id: r.id_mensaje,

          rol,

          tipo_emisor_equivalente: r.tipo_emisor,

          servicio: null,

          contenido: r.contenido,

          creado_en: r.creado_en,

        };

      }),

    });

  } catch (error) {

    console.error('Error ia360 historial:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al obtener historial',

    });

  }

});



/**

 * POST /api/ia360-doc/chat

 * Body: { token?, message, history?, servicio?, empresaId?, contactoId? }

 * Con token JWT FAQ; o sin token si IA360_ALLOW_WITHOUT_TOKEN=true y empresaId + contactoId.

 * Guarda mensaje usuario + respuesta IA360 en CRM, devuelve { reply }.

 * Misma lógica de negocio que chatbot_Agente (Streamlit), para usar desde chatbot_widget.

 */

router.post('/ia360-doc/chat', async (req, res) => {

  try {

    const body = req.body as {

      message?: string;

      history?: Ia360ChatHistoryItem[];

      servicio?: string;

      empresaId?: number;

      contactoId?: number;

    };



    const resolved = resolveIa360Session(req, req.body as Record<string, unknown>);

    if (!resolved.ok) {

      return res.status(resolved.status).json({ success: false, message: resolved.message });

    }



    if (!isOpenAIConfigured() || !isNotionConfigured()) {

      return res.status(503).json({

        success: false,

        message:

          'IA360 no está configurado en el API: defina OPENAI_API_KEY y NOTION_API_KEY en el .env del backend.',

      });

    }



    const msg = typeof body.message === 'string' ? body.message.trim() : '';

    if (!msg) {

      return res.status(400).json({ success: false, message: 'message es obligatorio' });

    }



    const servicioBody = typeof body.servicio === 'string' ? body.servicio.trim() : '';

    const servicioToken = resolved.session.servicioFromToken;

    if (servicioToken && servicioBody && servicioToken !== servicioBody) {

      return res.status(403).json({

        success: false,

        message: 'El servicio no coincide con el acceso autorizado.',

      });

    }



    const historyRaw = Array.isArray(body.history) ? body.history : [];

    const history: Ia360ChatHistoryItem[] = [];

    for (const h of historyRaw) {

      if (

        h &&

        (h.role === 'user' || h.role === 'assistant') &&

        typeof h.content === 'string'

      ) {

        history.push({ role: h.role, content: h.content });

      }

    }



    const empresaId = resolved.session.empresaId;

    const contactoId = resolved.session.contactoId;



    const existe = await db('contactos')

      .where({ id_contacto: contactoId, empresa_id: empresaId })

      .first();

    if (!existe) {

      return res.status(403).json({

        success: false,

        message: 'Contacto no pertenece a la empresa indicada',

      });

    }



    const convId = await findOrCreateConversacionIa360(empresaId, contactoId);



    const userSaved = await guardarEnMensajesCrm(

      empresaId,

      contactoId,

      convId,

      'usuario',

      msg,

    );

    if (!userSaved) {

      return res.status(500).json({

        success: false,

        message: 'No se pudo guardar el mensaje del usuario en CRM',

      });

    }



    const chatResult = await runIa360Chat({

      userMessage: msg,

      history,

    });



    if (chatResult.error) {

      return res.status(502).json({

        success: false,

        message: chatResult.error,

      });

    }



    const replyRaw = chatResult.reply ?? '';

    if (!replyRaw.trim()) {

      return res.status(502).json({

        success: false,

        message: 'El modelo no devolvió respuesta.',

      });

    }

    /** Respuesta HTTP: imágenes en data:. En BD: solo texto, sin ![...](url) ni rutas. */
    const replyForClient = await inlineNotionImagesInMarkdown(replyRaw);
    let replyForDb = stripMarkdownImages(replyRaw);
    if (!replyForDb.trim()) {
      replyForDb =
        '(El asistente respondió con capturas; las ilustraciones solo se muestran en el chat en vivo.)';
    }

    const asstSaved = await guardarEnMensajesCrm(empresaId, contactoId, convId, 'asistente', replyForDb);

    if (!asstSaved) {
      return res.json({
        success: true,
        reply: replyForClient,
        warning: 'Respuesta generada pero no se pudo guardar en CRM',
        conversacion_id: convId,
      });
    }

    return res.json({
      success: true,
      reply: replyForClient,
      conversacion_id: convId,
    });

  } catch (error) {

    console.error('Error ia360-doc chat:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al procesar el chat IA360',

    });

  }

});



/**

 * POST /api/ia360-doc/chat-query

 * Solo consulta OpenAI + Notion: sin JWT, sin empresa/contacto, sin guardar en BD (sin NIT/cédula).

 * Activo únicamente si IA360_PUBLIC_QUERY_CHAT=true (pruebas de rendimiento / red cerrada).

 */

router.post('/ia360-doc/chat-query', async (req, res) => {

  try {

    if (process.env.IA360_PUBLIC_QUERY_CHAT?.trim().toLowerCase() !== 'true') {

      return res.status(404).json({

        success: false,

        message: 'Ruta no disponible. Para pruebas: IA360_PUBLIC_QUERY_CHAT=true (solo entornos de confianza).',

      });

    }



    if (!isOpenAIConfigured() || !isNotionConfigured()) {

      return res.status(503).json({

        success: false,

        message:

          'IA360 no está configurado: defina OPENAI_API_KEY y NOTION_API_KEY en el .env del backend.',

      });

    }



    const body = req.body as {

      message?: string;

      history?: Ia360ChatHistoryItem[];

    };



    const msg = typeof body.message === 'string' ? body.message.trim() : '';

    if (!msg) {

      return res.status(400).json({ success: false, message: 'message es obligatorio' });

    }



    const historyRaw = Array.isArray(body.history) ? body.history : [];

    const history: Ia360ChatHistoryItem[] = [];

    for (const h of historyRaw) {

      if (

        h &&

        (h.role === 'user' || h.role === 'assistant') &&

        typeof h.content === 'string'

      ) {

        history.push({ role: h.role, content: h.content });

      }

    }



    const chatResult = await runIa360Chat({ userMessage: msg, history });



    if (chatResult.error) {

      return res.status(502).json({ success: false, message: chatResult.error });

    }



    let reply = chatResult.reply ?? '';

    if (!reply.trim()) {

      return res.status(502).json({ success: false, message: 'El modelo no devolvió respuesta.' });

    }

    reply = await inlineNotionImagesInMarkdown(reply);

    return res.json({

      success: true,

      reply,

      note: 'Modo solo consulta: no se persistió en CRM ni se validó identidad.',

    });

  } catch (error) {

    console.error('Error ia360-doc chat-query:', error);

    return res.status(500).json({

      success: false,

      message: 'Error al procesar la consulta IA360',

    });

  }

});



/**

 * GET ?url=… o POST JSON { url } — mismo comportamiento.

 * POST evita límites de longitud de la línea de petición en Nginx (URLs firmadas Notion/S3 muy largas → 502).

 * Sirve imágenes de Notion/S3 desde el servidor (referrer/CORP). Lista blanca de hostnames.

 */

function parseAllowedProxyImageUrl(raw: unknown): { ok: true; urlStr: string } | { ok: false; status: number; body: string } {

  let urlStr = typeof raw === 'string' ? raw.trim() : '';

  if (urlStr.includes('%25')) {

    try {

      urlStr = decodeURIComponent(urlStr);

    } catch {

      /* mantener urlStr */

    }

  }

  if (!urlStr || !urlStr.startsWith('https://')) {

    return { ok: false, status: 400, body: 'url https requerida' };

  }

  let parsed: URL;

  try {

    parsed = new URL(urlStr);

  } catch {

    return { ok: false, status: 400, body: 'url invalida' };

  }

  if (parsed.protocol !== 'https:') {

    return { ok: false, status: 400, body: 'solo https' };

  }

  const h = parsed.hostname.toLowerCase();

  const allowed =

    h.endsWith('.amazonaws.com') ||

    h.endsWith('notion.so') ||

    h.endsWith('notion.site') ||

    h === 'notionusercontent.com' ||

    h.endsWith('notionusercontent.com') ||

    h.endsWith('.notion-static.com') ||

    h === 'notion-static.com' ||

    h.endsWith('.cloudfront.net');

  if (!allowed) {

    return { ok: false, status: 403, body: 'host no permitido' };

  }

  return { ok: true, urlStr };

}

/** Notion/S3 a veces responden 403 al fetch sin cabeceras de navegador (firma + política del bucket). */
async function fetchUpstreamImageBuffer(urlStr: string): Promise<
  | { ok: true; buf: Buffer; contentType: string }
  | { ok: false; status: number; message: string }
> {

  const attempts: Array<Record<string, string>> = [
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.notion.so/',
    },
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/*,*/*;q=0.8',
      Referer: 'https://notion.so/',
    },
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/*,*/*;q=0.8',
    },
  ];

  let r: Response | null = null;

  for (const headers of attempts) {

    r = await fetch(urlStr, {

      redirect: 'follow',

      headers,

      signal: AbortSignal.timeout(45_000),

    });

    if (r.ok) break;

    if (r.status !== 403 && r.status !== 401) break;

  }

  if (!r?.ok) {

    const st = r?.status ?? 0;

    console.warn('[ia360-doc/proxy-image] upstream', st, urlStr.slice(0, 140));

    return {

      ok: false,

      status: 502,

      message:

        st === 403 || st === 401

          ? 'acceso denegado o URL caducada (Notion ~1h); vuelva a pedir la respuesta al asistente'

          : 'origen no disponible',

    };

  }

  const buf = Buffer.from(await r.arrayBuffer());

  const ctHdr = r.headers.get('content-type') || 'application/octet-stream';

  const outType = ctHdr.split(';')[0].trim();

  return { ok: true, buf, contentType: outType };

}

router.get('/ia360-doc/proxy-image', async (req, res) => {

  const parsed = parseAllowedProxyImageUrl(req.query.url);

  if (!parsed.ok) {

    return res.status(parsed.status).type('text/plain').send(parsed.body);

  }

  try {

    const out = await fetchUpstreamImageBuffer(parsed.urlStr);

    if (!out.ok) {

      return res.status(out.status).type('text/plain').send(out.message);

    }

    res.setHeader('Content-Type', out.contentType);

    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).send(out.buf);

  } catch (e) {

    console.error('proxy-image GET:', e);

    return res.status(502).type('text/plain').send('error al obtener imagen');

  }

});

router.post('/ia360-doc/proxy-image', async (req, res) => {

  const parsed = parseAllowedProxyImageUrl(req.body?.url);

  if (!parsed.ok) {

    return res.status(parsed.status).type('text/plain').send(parsed.body);

  }

  try {

    const out = await fetchUpstreamImageBuffer(parsed.urlStr);

    if (!out.ok) {

      return res.status(out.status).type('text/plain').send(out.message);

    }

    res.setHeader('Content-Type', out.contentType);

    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).send(out.buf);

  } catch (e) {

    console.error('proxy-image POST:', e);

    return res.status(502).type('text/plain').send('error al obtener imagen');

  }

});



export default router;


