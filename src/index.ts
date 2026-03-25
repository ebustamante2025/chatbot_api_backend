import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { testConnection, closeConnection, db } from './database/connection.js';
import { isTelegramConfigured, getTelegramBotMe } from './services/telegramService.js';
import empresasRouter from './routes/empresas.js';
import contactosRouter from './routes/contactos.js';
import conversacionesRouter from './routes/conversaciones.js';
import mensajesRouter from './routes/mensajes.js';
import usuariosSoporteRouter from './routes/usuarios-soporte.js';
import authRouter from './routes/auth.js';
import temasPreguntasRouter from './routes/temas-preguntas.js';
import preguntasFrecuentesRouter from './routes/preguntas-frecuentes.js';
import faqAccesoRouter from './routes/faq-acceso.js';
import ia360DocRouter from './routes/ia360-doc.js';
import dashboardRouter from './routes/dashboard.js';
import webhookProxyRouter from './routes/webhook-proxy.js';
import telegramRouter from './routes/telegram.js';
import { authMiddleware } from './middleware/auth.js';
import { initSocket } from './socket.js';

// Cargar .env desde la raíz del backend (donde está package.json), sin depender del cwd
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);
console.log('[dotenv] Ruta .env:', envPath, '| Existe:', envExists, '| CWD:', process.cwd());
const loaded = dotenv.config({ path: envPath });
if (loaded.error && process.env.NODE_ENV !== 'production') {
  console.warn('[dotenv] Error:', loaded.error.message);
}
const hasToken = !!(loaded.parsed && loaded.parsed.TELEGRAM_BOT_TOKEN);
if (process.env.TELEGRAM_BOT_TOKEN) {
  console.log('[Telegram] TELEGRAM_BOT_TOKEN cargado (longitud:', process.env.TELEGRAM_BOT_TOKEN.length, ')');
} else {
  console.log('[Telegram] TELEGRAM_BOT_TOKEN no definido. parsed.TELEGRAM_BOT_TOKEN:', hasToken);
}

const app = express();
const PORT = process.env.PORT || 3004;

// CORS: en producción usar CORS_ORIGINS (lista separada por comas). Si no está definido, permitir todos (desarrollo).
const corsOrigin = process.env.CORS_ORIGINS;
const corsOptions = {
  origin: corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: false,
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Asegurar que las respuestas JSON se envíen como UTF-8 (evitar ?? en tildes/ñ en el CRM)
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(body);
  };
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'error',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.get('/api', (req, res) => {
  res.json({
    message: 'API Backend CRM ChatBot',
    version: '1.0.0',
  });
});

// Estado Telegram (ruta en index para que siempre exista aunque falle el router)
// Sirve para comprobar si TELEGRAM_BOT_TOKEN está definido y es válido (llamada a getMe).
app.get('/api/telegram/status', async (_req, res) => {
  try {
    const configured = isTelegramConfigured();
    let bot: { username?: string; first_name?: string } | null = null;
    let tokenValid: boolean | null = null;
    let tokenError: string | null = null;
    let telegramContactosRegistrados = 0;
    let ultimaConversacionTelegram: Record<string, unknown> | null = null;
    if (configured) {
      const me = await getTelegramBotMe();
      tokenValid = me.ok === true;
      if (me.ok && me.result) {
        bot = { username: me.result.username, first_name: me.result.first_name };
      } else if (!me.ok && me.description) {
        tokenError = me.description; // ej. "Unauthorized" si el token es incorrecto
      }
      const count = await db('telegram_contactos').count('* as total').first();
      telegramContactosRegistrados = Number((count as any)?.total ?? 0);
      const ultima = await db('conversaciones')
        .where('canal', 'TELEGRAM')
        .orderBy('ultima_actividad_en', 'desc')
        .select('id_conversacion', 'estado', 'ultima_actividad_en', 'creada_en')
        .first();
      ultimaConversacionTelegram = (ultima as Record<string, unknown>) || null;
    }
    res.json({
      ok: true,
      telegram_configured: configured,
      token_valid: tokenValid,
      ...(tokenError && { token_error: tokenError }),
      bot,
      telegram_contactos_registrados: telegramContactosRegistrados,
      ultima_conversacion_telegram: ultimaConversacionTelegram,
    });
  } catch (e) {
    console.error('[Telegram] Error en GET /api/telegram/status:', e);
    res.status(500).json({ ok: false, error: 'Error al obtener estado' });
  }
});

// Rutas de empresas
app.use('/api/empresas', empresasRouter);

// Rutas de contactos
app.use('/api/contactos', contactosRouter);

// Auth (público)
app.use('/api/auth', authRouter);

// Rutas de conversaciones: POST a / (crear) es público (widget); el resto requiere token
app.use('/api/conversaciones', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.method === 'POST' && req.path === '/') return next();
  return authMiddleware(req, res, next);
}, conversacionesRouter);

// Rutas de mensajes: POST público (widget); PUT/DELETE a /contacto/:id público (widget edita/elimina); resto requiere token
app.use('/api/mensajes', (req, res, next) => {
  if (req.method === 'POST') return next();
  if ((req.method === 'PUT' || req.method === 'DELETE') && /^\/contacto\/\d+$/.test(req.path)) return next();
  return authMiddleware(req, res, next);
}, mensajesRouter);

// Usuarios de soporte: GET sin parámetro es público (listado de agentes), el resto requiere token
app.use('/api/usuarios-soporte', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // GET / (listar agentes activos) es público para el chat
  if (req.method === 'GET' && req.path === '/') return next();
  return authMiddleware(req, res, next);
}, usuariosSoporteRouter);

// Dashboard admin: requiere token
app.use('/api/dashboard', authMiddleware, dashboardRouter);

// Temas de preguntas frecuentes: GET público (frontend FAQ), POST/PUT/DELETE requiere token
app.use('/api/temas-preguntas', (req, res, next) => {
  if (req.method === 'GET') return next();
  return authMiddleware(req, res, next);
}, temasPreguntasRouter);

// Preguntas frecuentes: GET público (frontend FAQ), POST/PUT/DELETE requiere token
app.use('/api/preguntas-frecuentes', (req, res, next) => {
  if (req.method === 'GET') return next();
  return authMiddleware(req, res, next);
}, preguntasFrecuentesRouter);

// Acceso a FAQ: validación NIT + usuario (widget obtiene token, front FAQ valida)
app.use('/api/faq-acceso', faqAccesoRouter);

// IA360 (asistente documentación Streamlit): contexto empresa/director y mensajes en BD
app.use('/api', ia360DocRouter);

// Proxy de webhooks externos (agente Isa): evita CORS desde el widget
app.use('/api/webhook-proxy', webhookProxyRouter);

// Telegram: webhook público para recibir mensajes (envío a Telegram se hace en mensajes.ts)
app.use('/api/telegram', telegramRouter);
console.log('[API] Rutas Telegram registradas: GET /api/telegram/status, POST /api/telegram/webhook');

// Ruta raíz - muestra rutas disponibles
app.get('/', (req, res) => {
  res.json({
    message: 'API Backend CRM ChatBot',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health - Verifica estado del servidor y BD',
      api: 'GET /api - Información de la API',
      empresas: {
        verificar: 'GET /api/empresas/verificar/:nit - Verificar si empresa existe',
        crear: 'POST /api/empresas - Crear nueva empresa',
      },
      contactos: {
        verificar: 'GET /api/contactos/verificar/:empresa_id/:documento - Verificar si contacto existe por cédula',
        crear: 'POST /api/contactos - Crear nuevo contacto',
        listar: 'GET /api/contactos/empresa/:empresa_id - Listar contactos de una empresa',
      },
      faqAcceso: {
        emitirToken: 'POST /api/faq-acceso - Body: { empresaId, contactoId }. Emite token para acceso a FAQ',
        handoffPost:
          'POST /api/faq-acceso/handoff - Body: { token }. Devuelve handoffId para abrir FAQ/asistente sin JWT en la URL (?otk=)',
        handoffGet: 'GET /api/faq-acceso/handoff/:id - Canje de un solo uso por el JWT',
        renovar:
          'POST /api/faq-acceso/renovar - Body: { token }. Renueva JWT (firma + empresa/contacto válidos; token puede estar caducado)',
        validar: 'GET /api/faq-acceso/validar?token=xxx - Valida token de acceso FAQ',
      },
      ia360Doc: {
        contexto:
          'GET /api/ia360-doc/contexto?token=xxx — Empresa, NIT y directo (contacto) para el asistente IA360 (Streamlit)',
        historial:
          'GET /api/ia360-doc/historial?token=xxx&limite=500 — Todas las interacciones IA360 de ese contacto (cliente)',
        mensaje:
          'POST /api/ia360-doc/mensaje — Body: { token, rol: usuario|asistente, contenido, servicio? }. Solo tabla mensajes (CONTACTO / IA360), canal IA360_DOC',
        chat: 'POST /api/ia360-doc/chat — Body: { token, message, history?, servicio? }. OpenAI + Notion (widget IA360)',
        chatQuery:
          'POST /api/ia360-doc/chat-query — Solo si IA360_PUBLIC_QUERY_CHAT=true: { message, history? }. Sin JWT ni CRM (pruebas de latencia)',
        proxyImage:
          'GET /api/ia360-doc/proxy-image?url= — Reenvía imagen Notion/S3 para el widget (sin guardar en BD)',
      },
    },
  });
});

// Manejo de rutas no encontradas (404)
app.use((req: express.Request, res: express.Response) => {
  console.log('[API] 404:', req.method, req.path);
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.method} ${req.path} no existe`,
    availableRoutes: {
      health: 'GET /health',
      api: 'GET /api',
      root: 'GET /',
      telegramStatus: 'GET /api/telegram/status',
    },
  });
});

// Manejo de errores
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Iniciar servidor
const server = app.listen(PORT, async () => {
  initSocket(server);
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔌 WebSocket habilitado en ws://localhost:${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
  await testConnection();
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido, cerrando servidor...');
  server.close(async () => {
    await closeConnection();
    process.exit(0);
  });
});
