import express from 'express';
import { db } from '../database/connection.js';

const router = express.Router();

// Verificar si ya existe un contacto por empresa_id y documento (cédula)
router.get('/verificar/:empresa_id/:documento', async (req, res) => {
  try {
    const { empresa_id, documento } = req.params;

    if (!empresa_id || !documento || documento.trim() === '') {
      return res.status(400).json({
        error: 'Parámetros requeridos',
        message: 'empresa_id y documento son obligatorios',
      });
    }

    const contacto = await db('contactos')
      .where({
        empresa_id: Number(empresa_id),
        documento: documento.trim(),
      })
      .first();

    if (contacto) {
      return res.json({
        existe: true,
        contacto: {
          id_contacto: contacto.id_contacto,
          empresa_id: contacto.empresa_id,
          tipo: contacto.tipo,
          nombre: contacto.nombre,
          email: contacto.email,
          telefono: contacto.telefono,
          cargo: contacto.cargo,
          documento: contacto.documento,
          creado_en: contacto.creado_en,
        },
      });
    }

    return res.json({ existe: false });
  } catch (error) {
    console.error('Error al verificar contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo verificar el contacto',
    });
  }
});

// Crear nuevo contacto
router.post('/', async (req, res) => {
  try {
    const { empresa_id, nombre, email, telefono, tipo_documento, documento, cargo } = req.body;

    // Validaciones
    if (!empresa_id) {
      return res.status(400).json({
        error: 'ID de empresa requerido',
        message: 'El ID de empresa es obligatorio',
      });
    }

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        error: 'Nombre requerido',
        message: 'El nombre del contacto es obligatorio',
      });
    }

    // Verificar que la empresa existe
    const empresa = await db('empresas')
      .where({ id_empresa: empresa_id })
      .first();

    if (!empresa) {
      return res.status(404).json({
        error: 'Empresa no encontrada',
        message: 'La empresa especificada no existe',
      });
    }

    // Crear contacto
    const [nuevoContacto] = await db('contactos')
      .insert({
        empresa_id,
        tipo: 'CLIENTE',
        nombre: nombre.trim(),
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        tipo_documento: tipo_documento?.trim() || null,
        documento: documento?.trim() || null,
        cargo: cargo?.trim() || null,
      })
      .returning([
        'id_contacto',
        'empresa_id',
        'tipo',
        'nombre',
        'email',
        'telefono',
        'cargo',
        'creado_en',
      ]);

    res.status(201).json({
      message: 'Contacto creado exitosamente',
      contacto: nuevoContacto,
    });
  } catch (error: any) {
    console.error('Error al crear contacto:', error);
    
    // Error de constraint único
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Contacto ya existe',
        message: 'Ya existe un contacto con este documento en esta empresa',
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear el contacto',
    });
  }
});

// Obtener contactos de una empresa
router.get('/empresa/:empresa_id', async (req, res) => {
  try {
    const { empresa_id } = req.params;

    const contactos = await db('contactos')
      .where({ empresa_id })
      .orderBy('creado_en', 'desc');

    res.json({
      contactos,
      total: contactos.length,
    });
  } catch (error) {
    console.error('Error al obtener contactos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener los contactos',
    });
  }
});

export default router;
