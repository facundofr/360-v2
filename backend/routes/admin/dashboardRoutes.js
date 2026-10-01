const express = require('express');
const router = express.Router();
const DashboardController = require('../../controllers/admin/DashboardController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const roleMiddleware = require('../../middlewares/roleMiddleware');
const ROLES = require('../../constants/roles');

// Middleware para verificar rol admin
const isAdmin = roleMiddleware([ROLES.ADMIN]);

/**
 * ✅ RUTA: GET /admin/dashboard/completo
 * Obtiene el dashboard completo con todos los datos
 */
router.get('/completo', authenticateToken, isAdmin, DashboardController.obtenerDashboardCompleto);

/**
 * ✅ RUTA: GET /admin/dashboard/resumen
 * Obtiene solo el resumen general del dashboard
 */
router.get('/resumen', authenticateToken, isAdmin, DashboardController.obtenerResumen);

/**
 * ✅ RUTA: GET /admin/dashboard/actividad
 * Obtiene la actividad reciente
 */
router.get('/actividad', authenticateToken, isAdmin, DashboardController.obtenerActividad);

/**
 * ✅ RUTA: GET /admin/dashboard/vendedores
 * Obtiene estadísticas de vendedores
 */
router.get('/vendedores', authenticateToken, isAdmin, DashboardController.obtenerVendedores);

/**
 * ✅ RUTA: GET /admin/dashboard/tendencias
 * Obtiene tendencias de prospectos
 */
router.get('/tendencias', authenticateToken, isAdmin, DashboardController.obtenerTendencias);

/**
 * ✅ RUTA: GET /admin/dashboard/distribucion
 * Obtiene distribución de pólizas
 */
router.get('/distribucion', authenticateToken, isAdmin, DashboardController.obtenerDistribucion);

/**
 * ✅ RUTA: GET /admin/dashboard/alertas
 * Obtiene alertas activas
 */
router.get('/alertas', authenticateToken, isAdmin, DashboardController.obtenerAlertas);

module.exports = router;
