import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import type { Request } from 'express';

const router = express.Router();

// POST /api/auth/login - Inicio de sesión con usuarios_soporte
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Usuario y contraseña son obligatorios',
      });
    }

    const usuario = await db('usuarios_soporte')
      .where({ username: username.trim(), estado: true })
      .select('id_usuario', 'username', 'rol', 'password_hash')
      .first();

    if (!usuario) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos',
      });
    }

    // Detectar si la contraseña es temporal (prefijo TEMP:)
    const esTemporal = usuario.password_hash.startsWith('TEMP:');
    const hashReal = esTemporal ? usuario.password_hash.substring(5) : usuario.password_hash;

    const validPassword = await bcrypt.compare(password, hashReal);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Usuario o contraseña incorrectos',
      });
    }

    const token = signToken({
      id_usuario: usuario.id_usuario,
      username: usuario.username,
      rol: usuario.rol,
    });

    // Guardar el token activo en la BD → solo una sesión por usuario
    try {
      await db('usuarios_soporte')
        .where({ id_usuario: usuario.id_usuario })
        .update({ sesion_token: token });
    } catch (err) {
      // Si la columna sesion_token aún no existe (migración pendiente), no bloquear el login
      console.warn('No se pudo guardar sesion_token (migración pendiente?):', (err as Error).message);
    }

    res.json({
      message: 'Inicio de sesión correcto',
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        username: usuario.username,
        rol: usuario.rol,
      },
      debe_cambiar_password: esTemporal,
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo iniciar sesión',
    });
  }
});

// POST /api/auth/register - Registro de nuevo usuario (solo ADMIN autenticado)
router.post('/register', authMiddleware, async (req: Request & { user?: { id_usuario: number; username: string; rol: string } }, res) => {
  try {
    // Solo administradores pueden crear usuarios
    if (!req.user || req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Solo los administradores pueden crear usuarios',
      });
    }

    const { username, password, rol, nombre_completo, tipo_documento, documento } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Usuario y contraseña son obligatorios',
      });
    }

    // Política de contraseña: mínimo 12 caracteres
    if (password.length < 12) {
      return res.status(400).json({
        error: 'Contraseña inválida',
        message: 'La contraseña debe tener al menos 12 caracteres',
      });
    }

    const existente = await db('usuarios_soporte')
      .where({ username: username.trim() })
      .first();

    if (existente) {
      return res.status(409).json({
        error: 'Usuario ya existe',
        message: 'El nombre de usuario ya está registrado',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const rolValido = rol?.trim() || 'ASESOR';
    const rolesPermitidos = ['ADMIN', 'ASESOR', 'SUPERVISOR', 'VENTAS', 'AGENTE'];
    const rolFinal = rolesPermitidos.includes(rolValido.toUpperCase()) ? rolValido.toUpperCase() : 'ASESOR';

    const [usuario] = await db('usuarios_soporte')
      .insert({
        username: username.trim(),
        nombre_completo: nombre_completo?.trim() || null,
        password_hash: passwordHash,
        rol: rolFinal,
        nivel: rolFinal === 'ADMIN' ? 10 : 5,
        estado: true,
        tipo_documento: tipo_documento?.trim() || null,
        documento: documento?.trim() || null,
      })
      .returning(['id_usuario', 'username', 'nombre_completo', 'rol', 'creado_en']);

    res.status(201).json({
      message: 'Usuario registrado correctamente',
      usuario: {
        id_usuario: usuario.id_usuario,
        username: usuario.username,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo registrar el usuario',
    });
  }
});

// PUT /api/auth/cambiar-password - El usuario actualiza su contraseña (tras login con temporal)
router.put('/cambiar-password', authMiddleware, async (req: Request & { user?: { id_usuario: number; username: string; rol: string } }, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { password_nueva } = req.body;

    if (!password_nueva) {
      return res.status(400).json({ error: 'La nueva contraseña es obligatoria' });
    }

    if (password_nueva.length < 12) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 12 caracteres' });
    }

    // Hash normal sin prefijo TEMP: — contraseña definitiva
    const password_hash = await bcrypt.hash(password_nueva, 10);
    await db('usuarios_soporte')
      .where({ id_usuario: req.user.id_usuario })
      .update({ password_hash });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me - Obtener usuario actual (requiere token)
router.get('/me', authMiddleware, async (req: Request & { user?: { id_usuario: number; username: string; rol: string } }, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const usuario = await db('usuarios_soporte')
      .where({ id_usuario: user.id_usuario, estado: true })
      .select('id_usuario', 'username', 'nombre_completo', 'rol', 'vistas_permitidas')
      .first();
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }
    res.json({ usuario });
  } catch (error) {
    console.error('Error en /me:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
