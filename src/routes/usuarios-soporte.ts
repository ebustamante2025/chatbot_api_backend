import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection.js';

const router = express.Router();

// GET / — Listar usuarios (con filtro opcional: ?todos=true para incluir inactivos)
router.get('/', async (req, res) => {
  try {
    const { todos } = req.query;

    let query = db('usuarios_soporte')
      .select('id_usuario', 'username', 'nombre_completo', 'rol', 'nivel', 'estado', 'tipo_documento', 'documento', 'creado_en')
      .orderBy('id_usuario', 'asc');

    if (!todos) {
      query = query.where({ estado: true });
    }

    const usuarios = await query;

    res.json({
      usuarios,
      total: usuarios.length,
    });
  } catch (error) {
    console.error('Error al listar usuarios soporte:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los agentes',
    });
  }
});

// GET /:id — Obtener usuario por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await db('usuarios_soporte')
      .select('id_usuario', 'username', 'nombre_completo', 'rol', 'nivel', 'estado', 'tipo_documento', 'documento', 'creado_en')
      .where({ id_usuario: Number(id) })
      .first();

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ usuario });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /:id — Actualizar usuario (rol, nivel, estado)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, nombre_completo, rol, nivel, estado, tipo_documento, documento } = req.body;

    const existe = await db('usuarios_soporte').where({ id_usuario: Number(id) }).first();
    if (!existe) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const campos: Record<string, unknown> = {};
    if (username !== undefined) campos.username = username.trim();
    if (nombre_completo !== undefined) campos.nombre_completo = nombre_completo.trim();
    if (rol !== undefined) campos.rol = rol;
    if (nivel !== undefined) campos.nivel = nivel;
    if (estado !== undefined) campos.estado = estado;
    if (tipo_documento !== undefined) campos.tipo_documento = tipo_documento;
    if (documento !== undefined) campos.documento = documento;

    const [actualizado] = await db('usuarios_soporte')
      .where({ id_usuario: Number(id) })
      .update(campos)
      .returning(['id_usuario', 'username', 'nombre_completo', 'rol', 'nivel', 'estado', 'tipo_documento', 'documento', 'creado_en']);

    res.json({ message: 'Usuario actualizado', usuario: actualizado });
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese username' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /:id/password — Asignar contraseña temporal (admin)
// Se guarda con prefijo TEMP: para forzar cambio en el próximo login
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'La contraseña temporal debe tener al menos 4 caracteres' });
    }

    const existe = await db('usuarios_soporte').where({ id_usuario: Number(id) }).first();
    if (!existe) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Prefijo TEMP: indica que es temporal y debe cambiarse
    const hash = await bcrypt.hash(password, 10);
    const password_hash = `TEMP:${hash}`;

    await db('usuarios_soporte')
      .where({ id_usuario: Number(id) })
      .update({ password_hash });

    res.json({ message: 'Contraseña temporal asignada. El usuario deberá cambiarla al iniciar sesión.' });
  } catch (error) {
    console.error('Error al asignar contraseña temporal:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /:id — Desactivar usuario (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db('usuarios_soporte').where({ id_usuario: Number(id) }).first();
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await db('usuarios_soporte')
      .where({ id_usuario: Number(id) })
      .update({ estado: false });

    res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /:id/permanente — Eliminar usuario definitivamente
router.delete('/:id/permanente', async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db('usuarios_soporte').where({ id_usuario: Number(id) }).first();
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await db('usuarios_soporte')
      .where({ id_usuario: Number(id) })
      .del();

    res.json({ message: 'Usuario eliminado permanentemente' });
  } catch (error: any) {
    console.error('Error al eliminar usuario:', error);
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el usuario tiene registros asociados. Desactívelo en su lugar.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
