const express = require('express');
const MetricasController = require('../controllers/MetricasController');
const { authenticateToken, authenticateAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Middleware combinado para admin
const adminOnly = [authenticateToken, authenticateAdmin];

/**
 * GET /api/admin/metricas-avanzadas
 * Obtener métricas avanzadas de leads (por hora, edad, sexo, tendencias)
 */
router.get('/metricas-avanzadas', adminOnly, MetricasController.obtenerMetricasAvanzadas);

/**
 * GET /api/admin/metricas-comparativas
 * Comparar métricas entre períodos
 */
router.get('/metricas-comparativas', adminOnly, MetricasController.obtenerMetricasComparativas);

/**
 * GET /api/admin/metricas-rendimiento-vendedores
 * Métricas de rendimiento por vendedor
 */
router.get('/metricas-rendimiento-vendedores', adminOnly, MetricasController.obtenerRendimientoVendedores);

/**
 * GET /api/admin/metricas-por-fuente
 * Métricas de conversión por fuente de leads
 */
router.get('/metricas-por-fuente', adminOnly, MetricasController.obtenerMetricasPorFuente);

/**
 * GET /api/admin/metricas-evolucion-temporal
 * Evolución temporal de métricas
 */
router.get('/metricas-evolucion-temporal', adminOnly, MetricasController.obtenerEvolucionTemporal);

/**
 * GET /api/admin/resumen-ejecutivo
 * Resumen ejecutivo consolidado de métricas
 */
router.get('/resumen-ejecutivo', adminOnly, MetricasController.obtenerResumenEjecutivo);

module.exports = router;