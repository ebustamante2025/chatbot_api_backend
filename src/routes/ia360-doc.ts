/**

 * IA360 — asistente de documentación (Streamlit): contexto empresa/contacto y persistencia de mensajes.

 * Autenticación: mismo JWT FAQ (purpose: faq) que emite POST /api/faq-acceso.

 *

 * Solo tablas estándar **`conversaciones`** + **`mensajes`** (canal **IA360_DOC**):

 * - preguntas del usuario → `tipo_emisor` = **CONTACTO**

 * - respuestas del asistente → `tipo_emisor` = **IA360**

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

import { stripMarkdownImagesForCrm } from '../utils/ia360CrmText.js';



const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'crm-chatbot-secret-change-in-production';



/** Canal dedicado: no mezcla con WEB/TELEGRAM ni sustituye conversaciones BOT */

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



/**

 * Una conversación por (empresa, contacto) para el hilo IA360 en la tabla estándar `mensajes`.

 */

async function findOrCreateConversacionIa360(empresaId: number, contactoId: number): Promise<number> {

  const existente = await db('conversaciones')

    .where({

      empresa_id: empresaId,

      contacto_id: contactoId,

      canal: CANAL_IA360,

    })

    .first();



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

  /** Respuestas IA360: guardar texto sin markdown de imágenes (URLs Notion no se persisten). */
  const contenidoDb =

    tipoEmisor === 'IA360'

      ? stripMarkdownImagesForCrm(contenido)

      : contenido.trim();



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

    const token = getToken(req);

    if (!token) {

      return res.status(401).json({

        success: false,

        message: 'Token requerido',

      });

    }

    const decoded = verifyFaqToken(token);

    if (!decoded) {

      return res.status(401).json({

        success: false,

        message: 'Token inválido o expirado',

      });

    }



    const empresa = await db('empresas').where({ id_empresa: Number(decoded.empresaId) }).first();

    const contacto = await db('contactos')

      .where({ id_contacto: Number(decoded.contactoId), empresa_id: Number(decoded.empresaId) })

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

    const token = getToken(req);

    const { rol, contenido, servicio } = req.body as {

      rol?: string;

      contenido?: string;

      servicio?: string;

    };



    if (!token) {

      return res.status(401).json({ success: false, message: 'Token requerido' });

    }

    const decoded = verifyFaqToken(token);

    if (!decoded) {

      return res.status(401).json({ success: false, message: 'Token inválido o expirado' });

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



    const empresaId = Number(decoded.empresaId);

    const contactoId = Number(decoded.contactoId);



    const existe = await db('contactos')

      .where({ id_contacto: contactoId, empresa_id: empresaId })

      .first();

    if (!existe) {

      return res.status(403).json({

        success: false,

        message: 'Contacto no pertenece a la empresa del token',

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

    const token = getToken(req);

    if (!token) {

      return res.status(401).json({ success: false, message: 'Token requerido' });

    }

    const decoded = verifyFaqToken(token);

    if (!decoded) {

      return res.status(401).json({ success: false, message: 'Token inválido o expirado' });

    }



    const empresaId = Number(decoded.empresaId);

    const contactoId = Number(decoded.contactoId);



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

        message: 'Contacto no pertenece a la empresa del token',

      });

    }



    const conv = await db('conversaciones')

      .where({

        empresa_id: empresaId,

        contacto_id: contactoId,

        canal: CANAL_IA360,

      })

      .first();



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



    return res.json({

      success: true,

      empresa_id: empresaId,

      contacto_id: contactoId,

      conversacion_id: convId,

      canal: CANAL_IA360,

      total: filas.length,

      mensajes: filas.map((r) => {

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

 * Body: { token, message, history?: { role, content }[], servicio?: string }

 * Valida JWT, guarda mensaje usuario + respuesta IA360 en CRM, devuelve { reply }.

 * Misma lógica de negocio que chatbot_Agente (Streamlit), para usar desde chatbot_widget.

 */

router.post('/ia360-doc/chat', async (req, res) => {

  try {

    const token = getToken(req);

    const body = req.body as {

      message?: string;

      history?: Ia360ChatHistoryItem[];

      servicio?: string;

    };



    if (!token) {

      return res.status(401).json({ success: false, message: 'Token requerido' });

    }

    const decoded = verifyFaqToken(token);

    if (!decoded) {

      return res.status(401).json({ success: false, message: 'Token inválido o expirado' });

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

    if (decoded.servicio && servicioBody && decoded.servicio !== servicioBody) {

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



    const empresaId = Number(decoded.empresaId);

    const contactoId = Number(decoded.contactoId);



    const existe = await db('contactos')

      .where({ id_contacto: contactoId, empresa_id: empresaId })

      .first();

    if (!existe) {

      return res.status(403).json({

        success: false,

        message: 'Contacto no pertenece a la empresa del token',

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



    const reply = chatResult.reply ?? '';

    if (!reply.trim()) {

      return res.status(502).json({

        success: false,

        message: 'El modelo no devolvió respuesta.',

      });

    }



    const asstSaved = await guardarEnMensajesCrm(

      empresaId,

      contactoId,

      convId,

      'asistente',

      reply,

    );

    if (!asstSaved) {

      return res.json({

        success: true,

        reply,

        warning: 'Respuesta generada pero no se pudo guardar en CRM',

        conversacion_id: convId,

      });

    }



    return res.json({

      success: true,

      reply,

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

 * GET /api/ia360-doc/proxy-image?url=https%3A%2F%2F...

 * Sirve imágenes de Notion/S3 desde el servidor para evitar bloqueo por referrer/CORP en el widget.

 * No guarda la imagen en BD; solo reenvía bytes. Lista blanca de hostnames.

 */

router.get('/ia360-doc/proxy-image', async (req, res) => {

  const raw = req.query.url;

  const urlStr = typeof raw === 'string' ? raw.trim() : '';

  if (!urlStr || !urlStr.startsWith('https://')) {

    return res.status(400).type('text/plain').send('url https requerida');

  }

  let parsed: URL;

  try {

    parsed = new URL(urlStr);

  } catch {

    return res.status(400).type('text/plain').send('url invalida');

  }

  if (parsed.protocol !== 'https:') {

    return res.status(400).type('text/plain').send('solo https');

  }

  const h = parsed.hostname.toLowerCase();

  const allowed =

    h.endsWith('.amazonaws.com') ||

    h.endsWith('notion.so') ||

    h.endsWith('notion.site') ||

    h === 'notionusercontent.com' ||

    h.endsWith('notionusercontent.com');

  if (!allowed) {

    return res.status(403).type('text/plain').send('host no permitido');

  }

  try {

    /** Notion/S3 a veces responden 403 al fetch sin cabeceras de navegador (firma + política del bucket). */
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

      return res

        .status(502)

        .type('text/plain')

        .send(

          st === 403 || st === 401

            ? 'acceso denegado o URL caducada (Notion ~1h); vuelva a pedir la respuesta al asistente'

            : 'origen no disponible',

        );

    }

    const buf = Buffer.from(await r.arrayBuffer());

    const ctHdr = r.headers.get('content-type') || 'application/octet-stream';

    const outType = ctHdr.split(';')[0].trim();

    res.setHeader('Content-Type', outType);

    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).send(buf);

  } catch (e) {

    console.error('proxy-image:', e);

    return res.status(502).type('text/plain').send('error al obtener imagen');

  }

});



export default router;


