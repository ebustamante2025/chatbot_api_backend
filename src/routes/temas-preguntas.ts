import { Router } from 'express';
import { db } from '../database/connection.js';

const router = Router();

// GET /api/temas-preguntas — Listar todos los temas
router.get('/', async (_req, res) => {
  try {
    const temas = await db('temas_preguntas')
      .orderBy('orden', 'asc')
      .orderBy('id', 'asc');

    res.json({ temas, total: temas.length });
  } catch (error) {
    console.error('Error al listar temas:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudieron obtener los temas' });
  }
});

// GET /api/temas-preguntas/:id — Obtener un tema por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tema = await db('temas_preguntas').where({ id: Number(id) }).first();

    if (!tema) {
      return res.status(404).json({ error: 'Tema no encontrado', message: 'El tema especificado no existe' });
    }

    res.json({ tema });
  } catch (error) {
    console.error('Error al obtener tema:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo obtener el tema' });
  }
});

// POST /api/temas-preguntas — Crear nuevo tema
router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, orden, estado } = req.body;

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'Nombre requerido', message: 'El nombre del tema es obligatorio' });
    }

    const [nuevoTema] = await db('temas_preguntas')
      .insert({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        orden: orden ?? 1,
        estado: estado ?? true,
      })
      .returning('*');

    res.status(201).json({ message: 'Tema creado exitosamente', tema: nuevoTema });
  } catch (error) {
    console.error('Error al crear tema:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo crear el tema' });
  }
});

// PUT /api/temas-preguntas/:id — Actualizar tema
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, orden, estado } = req.body;

    const existe = await db('temas_preguntas').where({ id: Number(id) }).first();
    if (!existe) {
      return res.status(404).json({ error: 'Tema no encontrado', message: 'El tema especificado no existe' });
    }

    const campos: Record<string, unknown> = { updated_at: db.fn.now() };
    if (nombre !== undefined) campos.nombre = nombre.trim();
    if (descripcion !== undefined) campos.descripcion = descripcion?.trim() || null;
    if (orden !== undefined) campos.orden = orden;
    if (estado !== undefined) campos.estado = estado;

    const [actualizado] = await db('temas_preguntas')
      .where({ id: Number(id) })
      .update(campos)
      .returning('*');

    res.json({ message: 'Tema actualizado exitosamente', tema: actualizado });
  } catch (error) {
    console.error('Error al actualizar tema:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo actualizar el tema' });
  }
});

// DELETE /api/temas-preguntas/:id — Eliminar tema (y sus preguntas por CASCADE)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const eliminado = await db('temas_preguntas').where({ id: Number(id) }).del();

    if (!eliminado) {
      return res.status(404).json({ error: 'Tema no encontrado', message: 'El tema especificado no existe' });
    }

    res.json({ message: 'Tema eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar tema:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo eliminar el tema' });
  }
});

export default router;
