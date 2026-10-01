const express = require('express');
const router = express.Router();
const ProspectosBackOfficeController = require('../../controllers/backoffice/prospectosBackOfficeController');
const { authenticateToken, requireBackOfficeRole } = require('../../middlewares/authMiddleware');

// ✅ Middleware para todas las rutas - requiere autenticación y rol BackOffice
router.use(authenticateToken);
router.use(requireBackOfficeRole);

// ✅ RUTAS PRINCIPALES

/**
 * @route GET /api/backoffice/prospectos
 * @desc Obtener lista de prospectos con filtros y paginación
 * @access BackOffice
 * @query {number} page - Página actual (default: 1)
 * @query {number} limit - Elementos por página (default: 50, max: 100)
 * @query {number} id - Filtrar por ID de prospecto exacto
 * @query {string} search - Término de búsqueda (nombre, apellido, email, teléfono)
 * @query {string} estado - Filtrar por estado específico
 * @query {number} vendedor_id - Filtrar por vendedor específico
 * @query {number} supervisor_id - Filtrar por supervisor específico
 * @query {string} fecha_desde - Filtrar desde fecha (YYYY-MM-DD)
 * @query {string} fecha_hasta - Filtrar hasta fecha (YYYY-MM-DD)
 */
router.get('/', ProspectosBackOfficeController.getProspectos);

/**
 * @route GET /api/backoffice/prospectos/estadisticas
 * @desc Obtener estadísticas generales de prospectos
 * @access BackOffice
 */
router.get('/estadisticas', ProspectosBackOfficeController.getEstadisticas);

/**
 * @route GET /api/backoffice/prospectos/filtros
 * @desc Obtener opciones disponibles para filtros (vendedores, supervisores, estados)
 * @access BackOffice
 */
router.get('/filtros', ProspectosBackOfficeController.getFiltros);

/**
 * @route GET /api/backoffice/prospectos/exportar
 * @desc Exportar prospectos a CSV o Excel
 * @access BackOffice
 * @query {string} formato - Formato de exportación: 'csv' o 'excel' (default: csv)
 * @query {string} search - Término de búsqueda para filtrar
 * @query {string} estado - Filtrar por estado específico
 * @query {number} vendedor_id - Filtrar por vendedor específico
 * @query {number} supervisor_id - Filtrar por supervisor específico
 * @query {string} fecha_desde - Filtrar desde fecha (YYYY-MM-DD)
 * @query {string} fecha_hasta - Filtrar hasta fecha (YYYY-MM-DD)
 */
router.get('/exportar', ProspectosBackOfficeController.exportarProspectos);

/**
 * @route GET /api/backoffice/prospectos/:id
 * @desc Obtener detalles completos de un prospecto específico
 * @access BackOffice
 * @param {number} id - ID del prospecto
 */
router.get('/:id', ProspectosBackOfficeController.getProspectoById);

/**
 * @route GET /api/backoffice/prospectos/:id/historial
 * @desc Obtener historial (acciones) de un prospecto
 * @access BackOffice
 */
router.get('/:id/historial', ProspectosBackOfficeController.getProspectoHistorial);

/**
 * @route GET /api/backoffice/prospectos/:id/cotizaciones
 * @desc Obtener cotizaciones del prospecto (con detalles)
 * @access BackOffice
 */
router.get('/:id/cotizaciones', ProspectosBackOfficeController.getProspectoCotizaciones);

/**
 * @route PUT /api/backoffice/prospectos/:id/asignar-vendedor
 * @desc Reasignar un prospecto a un vendedor diferente
 * @access BackOffice
 * @param {number} id - ID del prospecto
 * @body {number} vendedor_id - ID del nuevo vendedor
 */
router.put('/:id/asignar-vendedor', ProspectosBackOfficeController.asignarVendedor);

/**
 * @route PUT /api/backoffice/prospectos/:id/estado
 * @desc Cambiar el estado del prospecto (y notas)
 * @access BackOffice
 */
router.put('/:id/estado', ProspectosBackOfficeController.cambiarEstadoProspecto);

/**
 * @route GET /api/backoffice/prospectos/whatsapp/telefono/:telefono
 * @desc Obtener conversaciones de WhatsApp por teléfono
 * @access BackOffice
 */
router.get('/whatsapp/telefono/:telefono', ProspectosBackOfficeController.getConversacionesPorTelefono);

/**
 * @route GET /api/backoffice/prospectos/whatsapp/conversaciones/:conversacionId/mensajes
 * @desc Obtener mensajes de una conversación de WhatsApp
 * @access BackOffice
 */
router.get('/whatsapp/conversaciones/:conversacionId/mensajes', ProspectosBackOfficeController.getMensajesConversacion);

module.exports = router;
