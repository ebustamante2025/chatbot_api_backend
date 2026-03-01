import express from 'express';
import { db } from '../database/connection.js';
import { validarLicencia } from '../services/licenciaService.js';
import { MENSAJES_VALIDACION } from '../data/mensajesValidacion.js';

const router = express.Router();

// Verificar si una empresa existe por NIT y validar licencia
router.get('/verificar/:nit', async (req, res) => {
  try {
    const { nit } = req.params;

    if (!nit || nit.trim() === '') {
      return res.status(400).json({
        error: 'NIT requerido',
        message: MENSAJES_VALIDACION.nitObligatorio,
      });
    }

    // Validar licencia con la API HGInet (ValidarLicencia?IdentificacionEmpresa=nit)
    const validacionLicencia = await validarLicencia(nit.trim());

    if (!validacionLicencia.valida) {
      const body: Record<string, unknown> = {
        error: 'Licencia inválida',
        message: validacionLicencia.mensaje || MENSAJES_VALIDACION.clienteSinLicencia,
        licenciaValida: false,
      };
      if (process.env.NODE_ENV !== 'production' && validacionLicencia.detalleError) {
        body.detalleError = validacionLicencia.detalleError;
      }
      return res.status(403).json(body);
    }

    // Si la licencia es válida, verificar si la empresa existe en la BD
    const empresa = await db('empresas')
      .where({ nit: nit.trim() })
      .first();

    const nitTrim = nit.trim();
    const nombreEmpresa =
      validacionLicencia.clienteNombre?.trim() ||
      empresa?.nombre_empresa ||
      `Empresa NIT ${nitTrim}`;

    const payload: any = {
      existe: !!empresa,
      licenciaValida: true,
      nit: nitTrim,
      nombre_empresa: nombreEmpresa,
      contratosVigentes: validacionLicencia.contratosVigentes ?? [],
      contactosClientes: validacionLicencia.contactosClientes ?? [],
    };
    if (empresa) {
      payload.empresa = {
        id_empresa: empresa.id_empresa,
        nit: empresa.nit,
        nombre_empresa: empresa.nombre_empresa,
        estado: empresa.estado,
      };
    }
    return res.json(payload);
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
        message: MENSAJES_VALIDACION.nitObligatorio,
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

// GET / — Listar todas las empresas (admin)
router.get('/', async (req, res) => {
  try {
    const empresas = await db('empresas')
      .select('id_empresa', 'nit', 'nombre_empresa', 'estado', 'creado_en')
      .orderBy('id_empresa', 'asc');

    res.json({ empresas, total: empresas.length });
  } catch (error) {
    console.error('Error al listar empresas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /:id — Actualizar empresa
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_empresa, estado } = req.body;

    const existe = await db('empresas').where({ id_empresa: Number(id) }).first();
    if (!existe) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const campos: Record<string, unknown> = {};
    if (nombre_empresa !== undefined) campos.nombre_empresa = nombre_empresa.trim();
    if (estado !== undefined) campos.estado = estado;

    const [actualizada] = await db('empresas')
      .where({ id_empresa: Number(id) })
      .update(campos)
      .returning('*');

    res.json({ message: 'Empresa actualizada', empresa: actualizada });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
