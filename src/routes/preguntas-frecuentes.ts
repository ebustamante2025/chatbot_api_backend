import { Router } from 'express';
import { db } from '../database/connection.js';

const router = Router();

// GET /api/preguntas-frecuentes — Listar preguntas (opcionalmente filtrar por tema_id)
router.get('/', async (req, res) => {
  try {
    const { tema_id } = req.query;

    let query = db('preguntas_frecuentes')
      .select('preguntas_frecuentes.*', 'temas_preguntas.nombre as tema_nombre')
      .leftJoin('temas_preguntas', 'preguntas_frecuentes.tema_id', 'temas_preguntas.id')
      .orderBy('preguntas_frecuentes.orden', 'asc')
      .orderBy('preguntas_frecuentes.id', 'asc');

    if (tema_id) {
      query = query.where('preguntas_frecuentes.tema_id', Number(tema_id));
    }

    const preguntas = await query;

    res.json({ preguntas, total: preguntas.length });
  } catch (error) {
    console.error('Error al listar preguntas:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudieron obtener las preguntas' });
  }
});

// GET /api/preguntas-frecuentes/:id — Obtener pregunta por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pregunta = await db('preguntas_frecuentes')
      .select('preguntas_frecuentes.*', 'temas_preguntas.nombre as tema_nombre')
      .leftJoin('temas_preguntas', 'preguntas_frecuentes.tema_id', 'temas_preguntas.id')
      .where('preguntas_frecuentes.id', Number(id))
      .first();

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada', message: 'La pregunta especificada no existe' });
    }

    res.json({ pregunta });
  } catch (error) {
    console.error('Error al obtener pregunta:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo obtener la pregunta' });
  }
});

// POST /api/preguntas-frecuentes — Crear nueva pregunta
router.post('/', async (req, res) => {
  try {
    const { tema_id, pregunta, respuesta, orden, estado } = req.body;

    if (!tema_id) {
      return res.status(400).json({ error: 'Tema requerido', message: 'Debe seleccionar un tema' });
    }
    if (!pregunta || pregunta.trim() === '') {
      return res.status(400).json({ error: 'Pregunta requerida', message: 'La pregunta es obligatoria' });
    }
    if (!respuesta || respuesta.trim() === '') {
      return res.status(400).json({ error: 'Respuesta requerida', message: 'La respuesta es obligatoria' });
    }

    // Verificar que el tema existe
    const tema = await db('temas_preguntas').where({ id: Number(tema_id) }).first();
    if (!tema) {
      return res.status(404).json({ error: 'Tema no encontrado', message: 'El tema especificado no existe' });
    }

    const [nuevaPregunta] = await db('preguntas_frecuentes')
      .insert({
        tema_id: Number(tema_id),
        pregunta: pregunta.trim(),
        respuesta: respuesta.trim(),
        orden: orden ?? 1,
        estado: estado ?? true,
      })
      .returning('*');

    res.status(201).json({ message: 'Pregunta creada exitosamente', pregunta: nuevaPregunta });
  } catch (error) {
    console.error('Error al crear pregunta:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo crear la pregunta' });
  }
});

// PUT /api/preguntas-frecuentes/:id — Actualizar pregunta
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tema_id, pregunta, respuesta, orden, estado } = req.body;

    const existe = await db('preguntas_frecuentes').where({ id: Number(id) }).first();
    if (!existe) {
      return res.status(404).json({ error: 'Pregunta no encontrada', message: 'La pregunta especificada no existe' });
    }

    if (tema_id) {
      const tema = await db('temas_preguntas').where({ id: Number(tema_id) }).first();
      if (!tema) {
        return res.status(404).json({ error: 'Tema no encontrado', message: 'El tema especificado no existe' });
      }
    }

    const campos: Record<string, unknown> = { updated_at: db.fn.now() };
    if (tema_id !== undefined) campos.tema_id = Number(tema_id);
    if (pregunta !== undefined) campos.pregunta = pregunta.trim();
    if (respuesta !== undefined) campos.respuesta = respuesta.trim();
    if (orden !== undefined) campos.orden = orden;
    if (estado !== undefined) campos.estado = estado;

    const [actualizada] = await db('preguntas_frecuentes')
      .where({ id: Number(id) })
      .update(campos)
      .returning('*');

    res.json({ message: 'Pregunta actualizada exitosamente', pregunta: actualizada });
  } catch (error) {
    console.error('Error al actualizar pregunta:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo actualizar la pregunta' });
  }
});

// DELETE /api/preguntas-frecuentes/:id — Eliminar pregunta
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const eliminada = await db('preguntas_frecuentes').where({ id: Number(id) }).del();

    if (!eliminada) {
      return res.status(404).json({ error: 'Pregunta no encontrada', message: 'La pregunta especificada no existe' });
    }

    res.json({ message: 'Pregunta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar pregunta:', error);
    res.status(500).json({ error: 'Error interno del servidor', message: 'No se pudo eliminar la pregunta' });
  }
});

export default router;
