const express = require('express');
const router = express.Router();
const { param, body } = require('express-validator');
const SessionStatusController = require('../controllers/sessionStatusController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Middleware para todas las rutas - requiere autenticación
router.use(authenticateToken);

/**
 * @route GET /api/session-status/user/:userId
 * @desc Verificar estado de sesión de un usuario específico
 * @access Supervisores y Administradores
 * @param {number} userId - ID del usuario
 */
router.get('/user/:userId', [
    roleMiddleware([2, 3]), // Supervisores y administradores
    param('userId').isInt({ min: 1 })
        .withMessage('userId debe ser un número entero positivo')
], SessionStatusController.checkUserSession);

/**
 * @route GET /api/session-status/active-users
 * @desc Obtener lista de usuarios activos en este momento
 * @access Supervisores y Administradores
 */
router.get('/active-users', [
    roleMiddleware([2, 3]) // Supervisores y administradores
], SessionStatusController.getActiveUsers);

/**
 * @route GET /api/session-status/stats
 * @desc Obtener estadísticas generales de sesiones
 * @access Supervisores y Administradores
 */
router.get('/stats', [
    roleMiddleware([2, 3]) // Supervisores y administradores
], SessionStatusController.getSessionStats);

/**
 * @route GET /api/session-status/vendedor/:vendedorId/disponibilidad
 * @desc Verificar si un vendedor está disponible para asignaciones
 * @access Supervisores y Administradores
 * @param {number} vendedorId - ID del vendedor
 */
router.get('/vendedor/:vendedorId/disponibilidad', [
    roleMiddleware([2, 3]), // Supervisores y administradores
    param('vendedorId').isInt({ min: 1 })
        .withMessage('vendedorId debe ser un número entero positivo')
], SessionStatusController.checkVendedorDisponibilidad);

/**
 * @route POST /api/session-status/multiple-users
 * @desc Verificar estado de sesión de múltiples usuarios
 * @access Supervisores y Administradores
 * @body {Array<number>} userIds - Array de IDs de usuarios
 */
router.post('/multiple-users', [
    roleMiddleware([2, 3]), // Supervisores y administradores
    body('userIds').isArray({ min: 1 })
        .withMessage('userIds debe ser un array con al menos un elemento'),
    body('userIds.*').isInt({ min: 1 })
        .withMessage('Cada ID de usuario debe ser un número entero positivo')
], SessionStatusController.checkMultipleUsers);

/**
 * @route GET /api/session-status/dashboard-summary
 * @desc Obtener resumen completo para dashboard de administración
 * @access Solo Administradores
 */
router.get('/dashboard-summary', [
    roleMiddleware([3]) // Solo administradores
], SessionStatusController.getDashboardSummary);

module.exports = router;