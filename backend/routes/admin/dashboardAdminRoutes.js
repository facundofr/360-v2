const express = require('express');
const router = express.Router();
const DashboardAdminController = require('../../controllers/admin/dashboardAdminController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const ROLES = require('../../constants/roles');

// Middleware para verificar rol de administrador
function authenticateAdmin(req, res, next) {
    console.log('🔐 Verificando acceso de administrador:', req.user?.role);
    if (req.user && req.user.role === ROLES.ADMIN) {
        console.log('✅ Acceso autorizado para administrador');
        return next();
    }
    console.log('❌ Acceso denegado - Se requiere rol de administrador');
    return res.status(403).json({ 
        message: "Acceso denegado. Solo para administradores." 
    });
}

// 📊 RUTAS DE DASHBOARD
router.get('/dashboard', 
    authenticateToken, 
    authenticateAdmin, 
    DashboardAdminController.getDashboard
);

router.get('/vendedores-sin-supervisor', 
    authenticateToken, 
    authenticateAdmin, 
    DashboardAdminController.getVendedoresSinSupervisor
);

module.exports = router;
