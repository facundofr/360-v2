const express = require('express');
const router = express.Router();
const VendedoresAdminController = require('../../controllers/admin/vendedoresAdminController');
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
    VendedoresAdminController.getMetricasGenerales
);

// 👥 RUTAS DE VENDEDORES
router.get('/', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.getVendedores
);

router.get('/:id', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.getDetallesVendedor
);

router.get('/:id/metricas', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.getMetricasVendedor
);

router.get('/:id/prospectos', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.getProspectosVendedor
);

// 🔄 RUTAS DE ACCIONES
router.patch('/:id/toggle-status', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.toggleVendedorStatus
);

router.delete('/:id', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.eliminarVendedor
);

router.post('/reasignar-prospectos', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.reasignarProspectos
);

router.post('/asignar-categoria', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.asignarCategoria
);

router.post('/asignar-supervisor', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.asignarSupervisor
);

// Alias de compatibilidad: /asignar
router.post('/asignar', 
    authenticateToken, 
    authenticateAdmin, 
    VendedoresAdminController.asignarSupervisor
);

module.exports = router;
