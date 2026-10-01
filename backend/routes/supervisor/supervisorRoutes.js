const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const supervisorController = require('../../controllers/supervisor/supervisorController');
const { getResumen, getMetricasPorVendedor, getCotizacionesPorProspecto } = require('../../controllers/supervisor/supervisorResumenController');
const vendedoresController = require('../../controllers/supervisor/vendedoresController');
const vendedorGestionController = require('../../controllers/supervisor/vendedorGestionController');
const PolizasSupervisorController = require('../../controllers/supervisor/polizasController');
const SupervisorChatController = require('../../controllers/supervisor/chatController');
const promocionesRoutes = require('./promocionesRoutes');

// Middleware para verificar rol de supervisor
function authenticateSupervisor(req, res, next) {
    console.log('🔐 Verificando acceso de supervisor:', req.user?.role);
    if (req.user && req.user.role === 2) { // 2 = SUPERVISOR
        return next();
    }
    return res.status(403).json({ message: "Acceso denegado. Solo para supervisores." });
}

// ✅ RUTAS EXISTENTES
router.get('/prospectos', authenticateToken, authenticateSupervisor, supervisorController.listAllProspectos);
router.get('/estadisticas', authenticateToken, authenticateSupervisor, supervisorController.getEstadisticas);
router.get('/datos-grafica', authenticateToken, authenticateSupervisor, supervisorController.getDatosGrafica);
router.get('/resumen', authenticateToken, authenticateSupervisor, getResumen);
router.get('/metricas-vendedor', authenticateToken, authenticateSupervisor, getMetricasPorVendedor);
router.get('/cotizaciones/:prospectoId', authenticateToken, authenticateSupervisor, getCotizacionesPorProspecto);
router.get('/vendedores', authenticateToken, authenticateSupervisor, vendedoresController.getVendedores);
router.get('/vendedores/:id/metricas', authenticateToken, authenticateSupervisor, vendedoresController.getVendedorMetricas);
router.put('/enable-vendedor/:id', authenticateToken, authenticateSupervisor, vendedoresController.enableVendedor);

// ✅ NUEVAS RUTAS PARA GESTIÓN DE VENDEDORES
router.get('/vendedores/:vendedorId/prospectos', authenticateToken, authenticateSupervisor, vendedorGestionController.getProspectosVendedor);
router.put('/disable-vendedor/:vendedorId', authenticateToken, authenticateSupervisor, vendedorGestionController.disableVendedor);
router.delete('/vendedores/:vendedorId', authenticateToken, authenticateSupervisor, vendedorGestionController.deleteVendedor);
router.post('/reasignar-prospectos', authenticateToken, authenticateSupervisor, vendedorGestionController.reasignarProspectos);

// ✅ RUTAS DE PÓLIZAS
router.get('/polizas', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerPolizas);
router.get('/polizas/estadisticas', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerEstadisticas);
router.get('/polizas/filtros', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerFiltros);

// ✅ RUTAS DE DOCUMENTOS
router.get('/polizas/:id/documentos', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerDocumentosPoliza);
router.get('/documentos/:documentoId/download', authenticateToken, authenticateSupervisor, PolizasSupervisorController.descargarDocumento);
router.put('/documentos/:documentoId/actualizar', authenticateToken, authenticateSupervisor, PolizasSupervisorController.actualizarDocumento);
router.delete('/documentos/:documentoId', authenticateToken, authenticateSupervisor, PolizasSupervisorController.eliminarDocumento);

// ✅ NUEVAS RUTAS: Carga múltiple de documentos
router.post('/cargar-multiples-documentos', authenticateToken, authenticateSupervisor, PolizasSupervisorController.cargarMultiplesDocumentos);
router.get('/obtener-tipos-documentos', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerTiposDocumentos);
router.get('/previsualizar-documento/:documentoId', authenticateToken, authenticateSupervisor, PolizasSupervisorController.previsualizarDocumento);
router.get('/estadisticas-documentos', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerEstadisticasDocumentos);

// ✅ RUTAS DE GESTIÓN DE PÓLIZAS
router.get('/polizas/:id/editar', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerPolizaParaEdicion);
router.put('/polizas/:id/actualizar', authenticateToken, authenticateSupervisor, PolizasSupervisorController.actualizarPoliza);

// ✅ RUTAS PARA CAMBIO DE ESTADO - SIMPLIFICAR MIDDLEWARE
router.patch('/polizas/:id/estado', authenticateToken, authenticateSupervisor, PolizasSupervisorController.cambiarEstado);
router.get('/polizas/:id/historial-estados', authenticateToken, authenticateSupervisor, PolizasSupervisorController.obtenerHistorialEstados);
router.delete('/polizas/:id', authenticateToken, authenticateSupervisor, PolizasSupervisorController.eliminarPoliza);

// ✅ NUEVA RUTA: Cambiar estado de prospectos (si es diferente del cambio de estado de pólizas)
router.patch('/prospectos/:id/estado', authenticateToken, authenticateSupervisor, supervisorController.cambiarEstadoProspecto);

// ✅ NUEVAS RUTAS: Chat y conversaciones WhatsApp para supervisores
router.get('/chat/conversaciones/prospecto/:prospecto_id', authenticateToken, authenticateSupervisor, SupervisorChatController.obtenerConversacionesPorProspecto);
router.get('/chat/conversaciones/:conversacion_id/mensajes', authenticateToken, authenticateSupervisor, SupervisorChatController.obtenerMensajes);
router.get('/chat/mensajes/:conversacion_id', authenticateToken, authenticateSupervisor, SupervisorChatController.obtenerMensajes);
router.post('/chat/conversaciones', authenticateToken, authenticateSupervisor, SupervisorChatController.crearConversacion);

// ✅ RUTAS DE PROMOCIONES (Solo lectura para supervisores)
router.use('/promociones', promocionesRoutes);

module.exports = router;