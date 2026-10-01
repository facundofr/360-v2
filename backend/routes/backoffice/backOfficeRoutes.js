const express = require('express');
const router = express.Router();
const backOfficeController = require('../../controllers/backoffice/backOfficeController');
const { authenticateToken, authenticateBackOffice } = require('../../middlewares/authMiddleware');
const ROLES = require('../../constants/roles');

// Importar rutas de pólizas, prospectos y promociones
const polizasRoutes = require('./polizasRoutes');
const prospectosRoutes = require('./prospectosBackOfficeRoutes');
const promocionesRoutes = require('./promocionesRoutes');

// Aplicar middleware de autenticación y verificación de rol a todas las rutas
router.use(authenticateToken);
router.use(authenticateBackOffice);

// === DASHBOARD Y MÉTRICAS PRINCIPALES ===
// Dashboard principal con estadísticas generales
router.get('/dashboard', backOfficeController.getDashboard);

// Análisis de embudo de ventas
router.get('/embudo', backOfficeController.getAnalisisEmbudo);

// Rendimiento de vendedores (con filtros opcionales)
router.get('/vendedores/rendimiento', backOfficeController.getRendimientoVendedores);

// Tendencias temporales
router.get('/tendencias', backOfficeController.getTendenciasTemporales);

// Alertas y notificaciones
router.get('/alertas', backOfficeController.getAlertas);

// === GESTIÓN DE SUPERVISORES ===
// Obtener todos los supervisores con sus equipos
router.get('/supervisores', backOfficeController.getSupervisores);

// Obtener detalles específicos de un supervisor
router.get('/supervisores/:id', backOfficeController.getDetallesSupervisor);

// Habilitar/deshabilitar supervisor
router.patch('/supervisores/:id/toggle-status', backOfficeController.toggleSupervisorStatus);

// === GESTIÓN DE VENDEDORES ===
// IMPORTANTE: Las rutas específicas deben ir antes de las rutas con parámetros dinámicos

// Obtener vendedores sin supervisor asignado (debe ir antes de /vendedores/:id)
router.get('/vendedores-sin-supervisor', backOfficeController.getVendedoresSinSupervisor);

// Asignar vendedor a supervisor
router.post('/vendedores/asignar', backOfficeController.asignarVendedor);

// Reasignar prospectos
router.post('/reasignar-prospectos', backOfficeController.reasignarProspectos);

// Obtener todos los vendedores
router.get('/vendedores', backOfficeController.getVendedores);

// Obtener detalles específicos de un vendedor
router.get('/vendedores/:id', backOfficeController.getDetallesVendedor);

// Obtener métricas de un vendedor específico
router.get('/vendedores/:id/metricas', backOfficeController.getMetricasVendedor);

// Obtener prospectos de un vendedor específico
router.get('/vendedores/:id/prospectos', backOfficeController.getProspectosVendedor);

// Habilitar/deshabilitar vendedor
router.patch('/vendedores/:id/toggle-status', backOfficeController.toggleVendedorStatus);

// Eliminar vendedor
router.delete('/vendedores/:id', backOfficeController.eliminarVendedor);

// === REPORTES Y ANÁLISIS ===
// Métricas de rendimiento por período específico
router.get('/metricas/rendimiento', backOfficeController.getMetricasRendimiento);

// === GESTIÓN DE PÓLIZAS ===
// Usar rutas de pólizas específicas para backoffice
router.use('/polizas', polizasRoutes);

// === GESTIÓN DE PROSPECTOS ===
// Usar rutas de prospectos específicas para backoffice
router.use('/prospectos', prospectosRoutes);

// === GESTIÓN DE PROMOCIONES ===
// Usar rutas de promociones
router.use('/promociones', promocionesRoutes);

// === RUTAS LEGACY (mantener por compatibilidad) ===
router.get('/supervisores/:supervisorId', backOfficeController.getDetallesSupervisor);
router.get('/vendedores-sin-supervisor', backOfficeController.getVendedoresSinSupervisor);
router.get('/metricas', backOfficeController.getMetricasRendimiento);

module.exports = router;
