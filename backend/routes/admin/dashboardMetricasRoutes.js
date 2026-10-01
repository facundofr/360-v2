const express = require('express');
const router = express.Router();
const dashboardMetricasController = require('../../controllers/admin/dashboardMetricasController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const ROLES = require('../../constants/roles');

// Middleware para verificar rol de administrador
function authenticateAdmin(req, res, next) {
    console.log('🔐 Verificando acceso de administrador para métricas:', req.user?.role);
    if (req.user && req.user.role === ROLES.ADMIN) {
        console.log('✅ Acceso autorizado para administrador - Dashboard Métricas');
        return next();
    }
    console.log('❌ Acceso denegado - Se requiere rol de administrador');
    return res.status(403).json({ 
        message: "Acceso denegado. Solo para administradores." 
    });
}

// 📊 RUTAS DE DASHBOARD DE MÉTRICAS

/**
 * GET /api/admin/dashboard/metricas
 * Obtiene todos los datos del dashboard de métricas de prospectos
 */
router.get('/metricas', 
    authenticateToken, 
    authenticateAdmin, 
    dashboardMetricasController.getDashboardMetricas
);

/**
 * GET /api/admin/dashboard/metricas/kpis
 * Obtiene solo los KPIs principales
 */
router.get('/metricas/kpis', 
    authenticateToken, 
    authenticateAdmin, 
    dashboardMetricasController.getKPIs
);

/**
 * GET /api/admin/dashboard/metricas/prospectos-por-dia
 * Obtiene datos de prospectos ingresados por día (últimos 12 días)
 */
router.get('/metricas/prospectos-por-dia', 
    authenticateToken, 
    authenticateAdmin, 
    dashboardMetricasController.getProspectosPorDia
);

/**
 * GET /api/admin/dashboard/metricas/funnel
 * Obtiene datos del embudo de ventas
 */
router.get('/metricas/funnel', 
    authenticateToken, 
    authenticateAdmin, 
    dashboardMetricasController.getFunnelData
);

/**
 * GET /api/admin/dashboard/metricas/prospectos-por-canal
 * Obtiene distribución de prospectos por canal de origen
 */
router.get('/metricas/prospectos-por-canal', 
    authenticateToken, 
    authenticateAdmin, 
    dashboardMetricasController.getProspectosPorCanal
);

/**
 * GET /api/admin/dashboard/metricas/ultimos-prospectos
 * Obtiene lista de últimos prospectos
 * Query params: limit (opcional, default: 5)
 */
router.get('/metricas/ultimos-prospectos', 
    authenticateToken, 
    authenticateAdmin, 
    dashboardMetricasController.getUltimosProspectos
);

module.exports = router;
