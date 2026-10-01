const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const { resetRateLimit, getRateLimitInfo } = require('../../middlewares/rateLimiters');

// 🛡️ Middleware para verificar permisos de admin
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 3) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requieren permisos de administrador.'
        });
    }
    next();
};

// 📊 GET - Obtener información de rate limit para una IP
router.get('/info/:ip', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { ip } = req.params;
        const { type = 'login' } = req.query;
        
        const info = await getRateLimitInfo(ip, type);
        
        if (!info) {
            return res.status(404).json({
                success: false,
                message: 'No se pudo obtener información de rate limit para esta IP'
            });
        }
        
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        console.error('Error al obtener info de rate limit:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// 🔄 POST - Resetear rate limit para una IP específica
router.post('/reset/:ip', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { ip } = req.params;
        const { type = 'login' } = req.body;
        
        const success = await resetRateLimit(ip, type);
        
        if (success) {
            console.log(`🔄 Rate limit reseteado por admin ${req.user.email} para IP: ${ip}`);
            res.json({
                success: true,
                message: `Rate limit reseteado exitosamente para IP: ${ip}`,
                ip,
                type,
                resetBy: req.user.email,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error al resetear rate limit'
            });
        }
    } catch (error) {
        console.error('Error al resetear rate limit:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// 🔄 POST - Resetear rate limit para múltiples IPs
router.post('/reset-bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { ips, type = 'login' } = req.body;
        
        if (!Array.isArray(ips) || ips.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de IPs válido'
            });
        }
        
        const results = [];
        
        for (const ip of ips) {
            const success = await resetRateLimit(ip, type);
            results.push({
                ip,
                success,
                timestamp: new Date().toISOString()
            });
        }
        
        const successCount = results.filter(r => r.success).length;
        
        console.log(`🔄 Rate limits reseteados por admin ${req.user.email} - ${successCount}/${ips.length} exitosos`);
        
        res.json({
            success: true,
            message: `Rate limits reseteados: ${successCount}/${ips.length} exitosos`,
            results,
            type,
            resetBy: req.user.email
        });
    } catch (error) {
        console.error('Error al resetear rate limits en bulk:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;
