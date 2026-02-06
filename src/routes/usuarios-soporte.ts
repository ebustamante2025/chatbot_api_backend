import express from 'express';
import { db } from '../database/connection.js';

const router = express.Router();

// Listar agentes (usuarios de soporte activos)
router.get('/', async (req, res) => {
  try {
    const usuarios = await db('usuarios_soporte')
      .select('id_usuario', 'username', 'rol', 'estado')
      .where({ estado: true })
      .orderBy('id_usuario', 'asc');

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

export default router;
