const express = require('express');
const router = express.Router();
const ReasignacionService = require('../services/ReasignacionService');
const { authenticateToken, authenticateAdmin } = require('../middlewares/authMiddleware');
const Holidays = require('../utils/holidays');

// Obtener prospectos candidatos a reasignación
router.get('/candidatos', authenticateToken, async (req, res) => {
  try {
    const resultado = await ReasignacionService.obtenerCandidatos();
    res.json(resultado);
  } catch (error) {
    console.error('Error en GET candidatos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener vendedores disponibles
router.get('/vendedores-disponibles', authenticateToken, async (req, res) => {
  try {
    const excluirId = req.query.excluir_id || null;
    const resultado = await ReasignacionService.obtenerVendedoresDisponibles(excluirId);
    res.json(resultado);
  } catch (error) {
    console.error('Error en GET vendedores disponibles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reasignar prospecto manualmente
router.post('/reasignar', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { id_prospecto, id_vendedor_nuevo, id_vendedor_anterior, motivo } = req.body;

    if (!id_prospecto || !id_vendedor_nuevo || !id_vendedor_anterior) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos'
      });
    }

    const resultado = await ReasignacionService.reasignarManual(
      id_prospecto,
      id_vendedor_nuevo,
      id_vendedor_anterior,
      motivo
    );

    res.json(resultado);
  } catch (error) {
    console.error('Error en POST reasignar:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener historial de reasignaciones
router.get('/historial', authenticateToken, async (req, res) => {
  try {
    const limite = req.query.limite || 20;
    const resultado = await ReasignacionService.obtenerHistorial(limite);
    res.json(resultado);
  } catch (error) {
    console.error('Error en GET historial:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener estadísticas
router.get('/estadisticas', authenticateToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const resultado = await ReasignacionService.obtenerEstadisticas(fecha_inicio, fecha_fin);
    res.json(resultado);
  } catch (error) {
    console.error('Error en GET estadísticas:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ejecutar reasignaciones manuales (solo admin/supervisor)
router.post('/ejecutar-manual', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const ReasignacionAutomaticaJob = require('../jobs/ReasignacionAutomaticaJob');
    const resultado = await ReasignacionAutomaticaJob.ejecutarManual();
    
    res.json({
      success: true,
      message: 'Reasignaciones manuales ejecutadas',
      resultado
    });
  } catch (error) {
    console.error('Error ejecutando reasignaciones manuales:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener estadísticas de antigüedad de prospectos reasignados
router.get('/estadisticas-antiguedad', authenticateToken, async (req, res) => {
  try {
    const resultado = await ReasignacionService.obtenerEstadisticasAntiguedad();
    res.json(resultado);
  } catch (error) {
    console.error('Error en GET estadísticas antigüedad:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener estadísticas de efectividad de reasignaciones
router.get('/estadisticas-efectividad', authenticateToken, async (req, res) => {
  try {
    const resultado = await ReasignacionService.obtenerEstadisticasEfectividad();
    res.json(resultado);
  } catch (error) {
    console.error('Error en GET estadísticas efectividad:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Feriados nacionales (Argentina)
router.get('/feriados', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const result = await Holidays.getHolidays(anio, { forceRefresh: refresh });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error en GET feriados:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
