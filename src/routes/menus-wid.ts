import express from 'express';
import { db } from '../database/connection.js';
import { authMiddleware as requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/menus-wid
 * Público: devuelve las 4 opciones de menú globales desde la BD.
 * Si la tabla está vacía devuelve todos activos (compatibilidad).
 */
router.get('/', async (_req, res) => {
  try {
    const filas = await db('menus_wid').orderBy('orden', 'asc');
    if (filas.length === 0) {
      return res.json({
        menus: [
          { id: 1, clave: 'frecuentes', nombre: 'Preguntas frecuentes', descripcion: 'Consulta respuestas rápidas',      activo: true, orden: 1 },
          { id: 2, clave: 'bot',        nombre: 'Hablar con Isa',        descripcion: 'Isa · Asistente virtual 24/7',     activo: true, orden: 2 },
          { id: 3, clave: 'agente',     nombre: 'Chatear con un agente', descripcion: 'Atención humana en vivo',          activo: true, orden: 3 },
          { id: 4, clave: 'prueba',     nombre: 'Prueba',                descripcion: 'Opción de prueba',                 activo: true, orden: 4 },
        ],
      });
    }
    res.json({ menus: filas });
  } catch (error) {
    console.error('[menus-wid] Error al obtener menús:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/menus-wid/:id
 * Admin: activa o desactiva una opción de menú en la BD.
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { activo } = req.body;

    const fila = await db('menus_wid').where({ id }).first();
    if (!fila) return res.status(404).json({ error: 'Menú no encontrado' });

    const [actualizado] = await db('menus_wid')
      .where({ id })
      .update({ activo: Boolean(activo), actualizado_en: db.fn.now() })
      .returning('*');

    res.json({ message: 'Menú actualizado', menu: actualizado });
  } catch (error) {
    console.error('[menus-wid] Error al actualizar menú:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
