const express = require('express');
const router = express.Router();
const PolizasSupervisorController = require('../../controllers/supervisor/polizasController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const ROLES = require('../../constants/roles');

// Middleware para verificar rol de supervisor o backoffice
function authenticateSupervisorOrBackOffice(req, res, next) {
    console.log('🔐 Verificando acceso de supervisor/backoffice:', req.user?.role);
    console.log('📋 Roles permitidos - SUPERVISOR:', ROLES.SUPERVISOR, 'BACK_OFFICE:', ROLES.BACK_OFFICE);
    if (req.user && (req.user.role === ROLES.SUPERVISOR || req.user.role === ROLES.BACK_OFFICE)) {
        console.log('✅ Acceso autorizado para rol:', req.user.role);
        return next();
    }
    console.log('❌ Acceso denegado para rol:', req.user?.role);
    return res.status(403).json({ 
        message: "Acceso denegado. Solo para supervisores y personal de backoffice." 
    });
}

// Todas las rutas del supervisor con autenticación completa (también permite backoffice)
router.get('/', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerPolizas);
router.get('/estadisticas', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerEstadisticas);
router.get('/estadisticas/meses', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerMesesDisponibles);
router.get('/filtros', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerFiltros);

// 📄 RUTAS DE DOCUMENTOS
router.get('/:id/documentos', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerDocumentosPoliza);
router.get('/:id/documentos/estadisticas', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerEstadisticasDocumentos);
router.post('/:id/documentos/multiple', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.cargarMultiplesDocumentos);
router.get('/documentos/tipos', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerTiposDocumentos);
router.get('/documentos/:documentoId/preview', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.previsualizarDocumento);
router.get('/documentos/:documentoId/download', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.descargarDocumento);
router.put('/documentos/:documentoId/actualizar', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.actualizarDocumento);
router.delete('/documentos/:documentoId', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.eliminarDocumento);

// 📋 RUTAS DE PÓLIZAS
router.get('/:id/editar', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerPolizaParaEdicion);
router.put('/:id/actualizar', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.actualizarPoliza);
router.patch('/:id/estado', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.cambiarEstado);
router.get('/:id/historial', authenticateToken, authenticateSupervisorOrBackOffice, PolizasSupervisorController.obtenerHistorialEstados);

module.exports = router;