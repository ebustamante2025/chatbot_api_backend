import express from 'express';
import { evaluarDisponibilidadAgenteHumano } from '../services/horarioAgenteWidget.js';

const router = express.Router();

/** GET /disponibilidad — público (widget): estado atención agente humano */
router.get('/disponibilidad', async (_req, res) => {
  try {
    const r = await evaluarDisponibilidadAgenteHumano();
    res.json({
      disponible: r.disponible,
      codigo: r.codigo,
      razon: r.razon,
      tooltip: r.tooltip,
      resumen_horario_linea: r.resumen_horario_linea,
      mensaje: r.mensaje,
      es_festivo: r.es_festivo,
      nombre_festivo: r.nombre_festivo,
      proximo_resumen: r.proximo_resumen,
    });
  } catch (e) {
    console.error('[widget horario-agente] disponibilidad:', e);
    res.status(500).json({ error: 'No se pudo evaluar disponibilidad' });
  }
});

export default router;
