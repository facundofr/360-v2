const express = require('express');
const router = express.Router();
// ✅ USAR CONTROLADOR ESPECÍFICO DE BACK OFFICE SIN RESTRICCIONES
const PolizasBackOfficeController = require('../../controllers/backoffice/polizasBackOfficeController');
const BackOfficeChatController = require('../../controllers/backoffice/chatController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const ROLES = require('../../constants/roles');

// Middleware para verificar rol de backoffice (también permite admin)
function authenticateBackOfficeOrAdmin(req, res, next) {
    console.log('🔐 Verificando acceso de backoffice:', req.user?.role);
    console.log('📋 Roles permitidos - BACK_OFFICE:', ROLES.BACK_OFFICE, 'ADMIN:', ROLES.ADMIN);
    if (req.user && (req.user.role === ROLES.BACK_OFFICE || req.user.role === ROLES.ADMIN)) {
        console.log('✅ Acceso autorizado para rol backoffice/admin:', req.user.role);
        return next();
    }
    console.log('❌ Acceso denegado para rol:', req.user?.role);
    return res.status(403).json({ 
        message: "Acceso denegado. Solo para personal de backoffice y administradores." 
    });
}

// ✅ RUTAS ESPECÍFICAS - Declaradas primero para evitar conflictos de routing
// 📄 RUTAS DE DOCUMENTOS CON RUTAS ESPECÍFICAS (PRIMERO - MÁS EXACTAS)
router.get('/documentos/tipos', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerTiposDocumentos);
router.get('/documentos/:documentoId/preview', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.previsualizarDocumento);
router.get('/documentos/:documentoId/download', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.descargarDocumento);
router.put('/documentos/:documentoId/actualizar', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.actualizarDocumento);
router.delete('/documentos/:documentoId', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.eliminarDocumento);

// � RUTAS DE CONVERSACIONES - DECLARADAS ANTES QUE LAS GENÉRICAS CON :ID
router.get('/conversaciones', authenticateToken, authenticateBackOfficeOrAdmin, BackOfficeChatController.obtenerTodasLasConversaciones);
router.get('/conversaciones/estadisticas', authenticateToken, authenticateBackOfficeOrAdmin, BackOfficeChatController.obtenerEstadisticasConversaciones);
router.get('/prospectos/:prospecto_id/conversaciones', authenticateToken, authenticateBackOfficeOrAdmin, BackOfficeChatController.obtenerConversacionesPorProspecto);
router.get('/conversaciones/:conversacion_id/mensajes', authenticateToken, authenticateBackOfficeOrAdmin, BackOfficeChatController.obtenerMensajes);
router.post('/conversaciones', authenticateToken, authenticateBackOfficeOrAdmin, BackOfficeChatController.crearConversacion);

// ✅ RUTAS SIN RESTRICCIONES - RUTAS GLOBALES
router.get('/', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerPolizas);
router.get('/estadisticas', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerEstadisticas);
router.get('/estadisticas/meses', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerMesesDisponibles);
router.get('/filtros', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerFiltros);

// 📋 RUTAS DE PÓLIZAS CON :ID - DECLARADAS DESPUÉS DE RUTAS ESPECÍFICAS
// IMPORTANTE: POST y PATCH/PUT/DELETE antes que GET para evitar conflictos
router.post('/:id/documentos/multiple', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.cargarMultiplesDocumentos);
router.patch('/:id/estado', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.cambiarEstado);
router.put('/:id/actualizar', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.actualizarPoliza);
router.delete('/:id', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.eliminarPoliza);

// GET :id routes - Al final
router.get('/:id/documentos', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerDocumentosPoliza);
router.get('/:id/documentos/estadisticas', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerEstadisticasDocumentos);
router.get('/:id/editar', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerPolizaParaEdicion);
router.get('/:id/historial', authenticateToken, authenticateBackOfficeOrAdmin, PolizasBackOfficeController.obtenerHistorialEstados);

module.exports = router;
