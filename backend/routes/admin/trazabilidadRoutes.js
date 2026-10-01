const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const TrazabilidadController = require('../../controllers/admin/trazabilidadController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const roleMiddleware = require('../../middlewares/roleMiddleware');

// Middleware para todas las rutas - requiere autenticación
router.use(authenticateToken);
// Nota: El middleware de rol se aplica individualmente en cada ruta

/**
 * @route GET /api/admin/trazabilidad
 * @desc Obtener trazabilidad completa de todos los prospectos
 * @access Admin only
 * @query {string} estado - Filtrar por estado del prospecto
 * @query {number} vendedor_id - Filtrar por ID del vendedor
 * @query {string} fecha_desde - Filtrar desde fecha (YYYY-MM-DD)
 * @query {string} fecha_hasta - Filtrar hasta fecha (YYYY-MM-DD)
 * @query {number} supervisor_id - Filtrar por ID del supervisor
 * @query {boolean} activo_solamente - Solo vendedores activos
 */
router.get('/', [
    roleMiddleware([3]), // Solo administradores
    query('estado').optional().isIn(['Lead', 'Venta', 'No contactado', 'Perdido', 'Seguimiento'])
        .withMessage('Estado debe ser: Lead, Venta, No contactado, Perdido o Seguimiento'),
    query('vendedor_id').optional().isInt({ min: 1 })
        .withMessage('vendedor_id debe ser un número entero positivo'),
    query('fecha_desde').optional().isDate()
        .withMessage('fecha_desde debe tener formato YYYY-MM-DD'),
    query('fecha_hasta').optional().isDate()
        .withMessage('fecha_hasta debe tener formato YYYY-MM-DD'),
    query('supervisor_id').optional().isInt({ min: 1 })
        .withMessage('supervisor_id debe ser un número entero positivo'),
    query('activo_solamente').optional().isBoolean()
        .withMessage('activo_solamente debe ser true o false')
], TrazabilidadController.obtenerTrazabilidadCompleta);

/**
 * @route GET /api/admin/trazabilidad/estadisticas
 * @desc Obtener estadísticas generales de trazabilidad
 * @access Admin only
 */
router.get('/estadisticas', [
    roleMiddleware([3]) // Solo administradores
], TrazabilidadController.obtenerEstadisticas);

/**
 * @route GET /api/admin/trazabilidad/vendedores
 * @desc Obtener lista de vendedores para filtros
 * @access Admin only
 */
router.get('/vendedores', [
    roleMiddleware([3]) // Solo administradores
], TrazabilidadController.obtenerVendedores);

/**
 * @route GET /api/admin/trazabilidad/supervisores
 * @desc Obtener lista de supervisores para filtros
 * @access Admin only
 */
router.get('/supervisores', [
    roleMiddleware([3]) // Solo administradores
], TrazabilidadController.obtenerSupervisores);

/**
 * @route GET /api/admin/trazabilidad/prospecto/:prospectoId
 * @desc Obtener historial detallado de un prospecto específico
 * @access Admin only
 * @param {number} prospectoId - ID del prospecto
 */
router.get('/prospecto/:prospectoId', [
    roleMiddleware([3]), // Solo administradores
    param('prospectoId').isInt({ min: 1 })
        .withMessage('prospectoId debe ser un número entero positivo')
], TrazabilidadController.obtenerHistorialProspecto);

/**
 * @route GET /api/admin/trazabilidad/vendedor/:vendedorId/sesion
 * @desc Verificar estado de sesión de un vendedor específico
 * @access Admin only
 * @param {number} vendedorId - ID del vendedor
 */
router.get('/vendedor/:vendedorId/sesion', [
    roleMiddleware([3]), // Solo administradores
    param('vendedorId').isInt({ min: 1 })
        .withMessage('vendedorId debe ser un número entero positivo')
], TrazabilidadController.verificarEstadoSesion);

/**
 * @route GET /api/admin/trazabilidad/exportar
 * @desc Exportar datos de trazabilidad (futura implementación)
 * @access Admin only
 * @query Mismos filtros que la ruta principal
 */
router.get('/exportar', [
    roleMiddleware([3]), // Solo administradores
    query('estado').optional().isIn(['Lead', 'Venta', 'No contactado', 'Perdido', 'Seguimiento'])
        .withMessage('Estado debe ser: Lead, Venta, No contactado, Perdido o Seguimiento'),
    query('vendedor_id').optional().isInt({ min: 1 })
        .withMessage('vendedor_id debe ser un número entero positivo'),
    query('fecha_desde').optional().isDate()
        .withMessage('fecha_desde debe tener formato YYYY-MM-DD'),
    query('fecha_hasta').optional().isDate()
        .withMessage('fecha_hasta debe tener formato YYYY-MM-DD'),
    query('supervisor_id').optional().isInt({ min: 1 })
        .withMessage('supervisor_id debe ser un número entero positivo')
], TrazabilidadController.exportarTrazabilidad);

module.exports = router;