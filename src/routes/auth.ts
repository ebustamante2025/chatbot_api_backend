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

    const validPassword = await bcrypt.compare(password, usuario.password_hash);
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

    res.json({
      message: 'Inicio de sesión correcto',
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        username: usuario.username,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo iniciar sesión',
    });
  }
});

// POST /api/auth/register - Registro de nuevo usuario de soporte
router.post('/register', async (req, res) => {
  try {
    const { username, password, rol, tipo_documento, documento } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({
        error: 'Datos requeridos',
        message: 'Usuario y contraseña son obligatorios',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Contraseña inválida',
        message: 'La contraseña debe tener al menos 6 caracteres',
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
        password_hash: passwordHash,
        rol: rolFinal,
        nivel: rolFinal === 'ADMIN' ? 10 : 5,
        estado: true,
        tipo_documento: tipo_documento?.trim() || null,
        documento: documento?.trim() || null,
      })
      .returning(['id_usuario', 'username', 'rol', 'creado_en']);

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

// GET /api/auth/me - Obtener usuario actual (requiere token)
router.get('/me', authMiddleware, async (req: Request & { user?: { id_usuario: number; username: string; rol: string } }, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const usuario = await db('usuarios_soporte')
      .where({ id_usuario: user.id_usuario, estado: true })
      .select('id_usuario', 'username', 'rol')
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
