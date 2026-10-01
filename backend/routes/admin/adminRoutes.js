const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin/adminController');
const VendedoresAdminController = require('../../controllers/admin/vendedoresAdminController');
const SupervisoresAdminController = require('../../controllers/admin/supervisoresAdminController');
const PolizasAdminController = require('../../controllers/admin/polizasAdminController');
const ROLES = require('../../constants/roles');
const { authenticateToken, authenticateAdmin } = require('../../middlewares/authMiddleware');
const { adminValidators, handleValidationErrors } = require('../../middlewares/validators');
const { adminLimiter } = require('../../middlewares/rateLimiters');
const { 
    activeUsersLimiter, 
    activityStatsLimiter, 
    heartbeatLimiter,
    preventSimultaneousRequests 
} = require('../../middlewares/activeUsersLimiter');
const SecurityTasks = require('../../jobs/securityTasks');
const TokenBlacklist = require('../../utils/tokenBlacklist');

// ✅ DEFINIR adminOnly CORRECTAMENTE
const adminOnly = [authenticateToken, authenticateAdmin];

// 🛡️ APLICAR RATE LIMITING A TODAS LAS RUTAS ADMIN
router.use(adminLimiter);

// 🛡️ ENDPOINT DE SEGURIDAD PARA ADMIN
router.get('/security/status', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const securityStatus = await SecurityTasks.healthCheck();
        const blacklistStats = await TokenBlacklist.getStats();
        
        res.json({
            security_status: securityStatus,
            blacklist_statistics: blacklistStats,
            admin_user: {
                id: req.user.id,
                role: req.user.role,
                check_time: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error obteniendo status de seguridad:', error);
        res.status(500).json({ 
            error: 'Error obteniendo información de seguridad',
            code: 'SECURITY_STATUS_ERROR'
        });
    }
});

// Rutas existentes de usuarios con validación mejorada
router.get('/list-users', authenticateToken, authenticateAdmin, adminController.listUsersByRoles);

router.post('/create-user', 
    authenticateToken, 
    authenticateAdmin, 
    adminValidators.createUser, 
    handleValidationErrors,
    adminController.createUser
);

router.put('/update-user/:id', 
    authenticateToken, 
    authenticateAdmin, 
    adminValidators.updateUser, 
    handleValidationErrors,
    adminController.updateUser
);
router.delete('/delete-user/:id', authenticateToken, authenticateAdmin, adminController.deleteUser);
router.put('/disable-user/:id', authenticateToken, authenticateAdmin, adminController.disableUser);
router.put('/enable-user/:id', authenticateToken, authenticateAdmin, adminController.enableUser);
router.post('/resend-verification/:id', authenticateToken, authenticateAdmin, adminController.resendVerification);

// ✅ RUTAS DE PÓLIZAS PARA ADMIN
router.get('/polizas', adminOnly, PolizasAdminController.obtenerPolizas);
router.get('/polizas/estadisticas', adminOnly, PolizasAdminController.obtenerEstadisticasAvanzadas);
router.get('/polizas/filtros', adminOnly, PolizasAdminController.obtenerFiltrosAvanzados);

// ✅ RUTAS ESPECÍFICAS DE ADMIN
router.delete('/polizas/:id', adminOnly, PolizasAdminController.eliminarPoliza);
router.patch('/polizas/:id/restaurar', adminOnly, PolizasAdminController.restaurarPoliza);
router.get('/polizas/:id/auditoria', adminOnly, PolizasAdminController.obtenerAuditoriaCompleta);

// ✅ NUEVAS RUTAS DE DOCUMENTOS PARA ADMIN
router.get('/polizas/:polizaId/documentos', adminOnly, PolizasAdminController.obtenerDocumentosPoliza);
router.get('/documentos/:documentoId/download', adminOnly, PolizasAdminController.descargarDocumento);
router.get('/documentos/:documentoId/preview', adminOnly, PolizasAdminController.previewDocumento);
router.delete('/documentos/:documentoId', adminOnly, PolizasAdminController.eliminarDocumento);
router.get('/documentos/estadisticas', adminOnly, PolizasAdminController.obtenerEstadisticasDocumentos);

// ✅ RUTAS HEREDADAS DEL SUPERVISOR
router.patch('/polizas/:id/estado', adminOnly, PolizasAdminController.cambiarEstado);
router.get('/polizas/:id/historial', adminOnly, PolizasAdminController.obtenerHistorialEstados);

// ✅ RUTAS DE VENDEDORES Y SUPERVISORES PARA ADMIN
router.get('/vendedores', adminOnly, VendedoresAdminController.getVendedores);
router.get('/supervisores', adminOnly, SupervisoresAdminController.getSupervisores);

// ✅ NUEVAS RUTAS DE PROSPECTOS PARA ADMIN
router.get('/prospectos/all', adminOnly, adminController.getAllProspectos);
router.get('/prospectos/estadisticas', adminOnly, adminController.getProspectosEstadisticas);
router.put('/prospectos/:id/reasignar', adminOnly, adminController.reasignarProspecto);
router.patch('/prospectos/:id/estado', adminOnly, adminController.cambiarEstadoProspecto);
router.get('/prospectos/:id/historial', adminOnly, adminController.getProspectoHistorial);
router.get('/prospectos/:id/cotizaciones', adminOnly, adminController.getProspectoCotizaciones);

// ✅ RUTAS DE CONVERSACIONES WHATSAPP PARA ADMIN
router.get('/whatsapp/conversaciones/:telefono', adminOnly, adminController.getConversacionesPorTelefono);
router.get('/whatsapp/conversacion/:conversacionId/mensajes', adminOnly, adminController.getMensajesConversacion);


// ✅ RUTAS DE MONITOREO EN TIEMPO REAL - CON RATE LIMITING ESPECÍFICO Y PREVENCIÓN DE MÚLTIPLES SOLICITUDES
router.get('/users/active', 
    adminOnly, 
    preventSimultaneousRequests,
    activeUsersLimiter, 
    adminController.getActiveUsers
);

router.get('/users/activity-stats', 
    adminOnly, 
    preventSimultaneousRequests,
    activityStatsLimiter, 
    adminController.getUserActivityStats
);

router.post('/users/heartbeat', 
    authenticateToken, 
    heartbeatLimiter,
    adminController.updateUserActivity
);

router.post('/users/logout-activity', 
    authenticateToken, 
    adminController.logoutUserActivity
);

// 🏥 HEALTH CHECK PARA RATE LIMITING
router.get('/health/rate-limits', authenticateToken, authenticateAdmin, (req, res) => {
    res.json({
        success: true,
        data: {
            timestamp: new Date().toISOString(),
            rate_limits: {
                admin: "OK",
                activity_stats: "OK"
            },
            server_status: "healthy",
            uptime: process.uptime()
        },
        message: 'Rate limiting funcionando correctamente'
    });
});

module.exports = router;