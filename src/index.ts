import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { testConnection, closeConnection } from './database/connection.js';
import empresasRouter from './routes/empresas.js';
import contactosRouter from './routes/contactos.js';
import conversacionesRouter from './routes/conversaciones.js';
import mensajesRouter from './routes/mensajes.js';
import usuariosSoporteRouter from './routes/usuarios-soporte.js';
import authRouter from './routes/auth.js';
import temasPreguntasRouter from './routes/temas-preguntas.js';
import preguntasFrecuentesRouter from './routes/preguntas-frecuentes.js';
import dashboardRouter from './routes/dashboard.js';
import { authMiddleware } from './middleware/auth.js';
import { initSocket } from './socket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// CORS - Debe estar ANTES de otros middlewares
app.use(cors({
  origin: '*', // En producción, especifica los orígenes permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: false
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Rutas de mensajes: POST público (widget envía mensajes), GET requiere token
app.use('/api/mensajes', (req, res, next) => {
  if (req.method === 'POST') return next();
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
    },
  });
});

// Manejo de rutas no encontradas (404)
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.method} ${req.path} no existe`,
    availableRoutes: {
      health: 'GET /health',
      api: 'GET /api',
      root: 'GET /',
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
