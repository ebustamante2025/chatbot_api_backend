import express from 'express';
import { db } from '../database/connection.js';
import { validarLicencia } from '../services/licenciaService.js';

const router = express.Router();

// Verificar si una empresa existe por NIT y validar licencia
router.get('/verificar/:nit', async (req, res) => {
  try {
    const { nit } = req.params;

    if (!nit || nit.trim() === '') {
      return res.status(400).json({
        error: 'NIT requerido',
        message: 'El NIT es obligatorio',
      });
    }

    // Validar licencia primero
    const validacionLicencia = await validarLicencia(nit.trim());

    if (!validacionLicencia.valida) {
      return res.status(403).json({
        error: 'Licencia inválida',
        message: validacionLicencia.mensaje || 'Licencia vencida',
        licenciaValida: false,
      });
    }

    // Si la licencia es válida, verificar si la empresa existe en la BD
    const empresa = await db('empresas')
      .where({ nit: nit.trim() })
      .first();

    if (empresa) {
      return res.json({
        existe: true,
        licenciaValida: true,
        empresa: {
          id_empresa: empresa.id_empresa,
          nit: empresa.nit,
          nombre_empresa: empresa.nombre_empresa,
          estado: empresa.estado,
        },
      });
    }

    return res.json({
      existe: false,
      licenciaValida: true,
    });
  } catch (error) {
    console.error('Error al verificar empresa:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo verificar la empresa',
    });
  }
});

// Crear nueva empresa
router.post('/', async (req, res) => {
  try {
    const { nit, nombre_empresa } = req.body;

    // Validaciones
    if (!nit || nit.trim() === '') {
      return res.status(400).json({
        error: 'NIT requerido',
        message: 'El NIT es obligatorio',
      });
    }

    if (!nombre_empresa || nombre_empresa.trim() === '') {
      return res.status(400).json({
        error: 'Nombre de empresa requerido',
        message: 'El nombre de la empresa es obligatorio',
      });
    }

    // Validar licencia antes de crear la empresa
    const validacionLicencia = await validarLicencia(nit.trim());

    if (!validacionLicencia.valida) {
      return res.status(403).json({
        error: 'Licencia inválida',
        message: validacionLicencia.mensaje || 'Licencia vencida',
        licenciaValida: false,
      });
    }

    // Verificar si ya existe
    const empresaExistente = await db('empresas')
      .where({ nit: nit.trim() })
      .first();

    if (empresaExistente) {
      return res.status(409).json({
        error: 'Empresa ya existe',
        message: 'Ya existe una empresa con este NIT',
        empresa: {
          id_empresa: empresaExistente.id_empresa,
          nit: empresaExistente.nit,
          nombre_empresa: empresaExistente.nombre_empresa,
        },
      });
    }

    // Crear empresa
    const [nuevaEmpresa] = await db('empresas')
      .insert({
        nit: nit.trim(),
        nombre_empresa: nombre_empresa.trim(),
        estado: true,
      })
      .returning(['id_empresa', 'nit', 'nombre_empresa', 'estado', 'creado_en']);

    res.status(201).json({
      message: 'Empresa creada exitosamente',
      empresa: nuevaEmpresa,
    });
  } catch (error: any) {
    console.error('Error al crear empresa:', error);
    
    // Error de constraint único
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Empresa ya existe',
        message: 'Ya existe una empresa con este NIT',
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo crear la empresa',
    });
  }
});

export default router;
