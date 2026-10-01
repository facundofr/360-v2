const express = require('express');
const router = express.Router();
const SupervisoresAdminController = require('../../controllers/admin/supervisoresAdminController');
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

// 📊 RUTAS DE MÉTRICAS
router.get('/metricas', 
    authenticateToken, 
    authenticateAdmin, 
    SupervisoresAdminController.getMetricasGenerales
);

// 👥 RUTAS DE SUPERVISORES
router.get('/', 
    authenticateToken, 
    authenticateAdmin, 
    SupervisoresAdminController.getSupervisores
);

router.get('/sin-asignar', 
    authenticateToken, 
    authenticateAdmin, 
    SupervisoresAdminController.getVendedoresSinSupervisor
);

router.get('/:id', 
    authenticateToken, 
    authenticateAdmin, 
    SupervisoresAdminController.getDetallesSupervisor
);

// 🔄 RUTAS DE ACCIONES
router.post('/asignar-vendedor', 
    authenticateToken, 
    authenticateAdmin, 
    SupervisoresAdminController.asignarVendedor
);

router.patch('/:id/toggle-status', 
    authenticateToken, 
    authenticateAdmin, 
    SupervisoresAdminController.toggleSupervisorStatus
);

module.exports = router;
