const express = require('express');
const router = express.Router();
const sessionController = require('../../controllers/session/sessionController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const { sessionValidators, handleValidationErrors } = require('../../middlewares/validators');
const { sessionLimiter } = require('../../middlewares/rateLimiters'); // 🔥 NUEVO: Rate limiter específico

// 🛡️ Rutas con validación específica para sesiones
router.post('/start', 
    authenticateToken, 
    sessionLimiter, // 🔥 APLICAR rate limiter específico
    sessionValidators.createSession, 
    handleValidationErrors, 
    sessionController.createSession
);

router.post('/end', 
    authenticateToken, 
    sessionLimiter, // 🔥 APLICAR rate limiter específico
    sessionValidators.closeSession, 
    handleValidationErrors, 
    sessionController.closeSession
);

// 🔍 Verificar estado de sesión (CON rate limiter muy permisivo)
router.get('/status', 
    authenticateToken, 
    sessionLimiter, // 🔥 APLICAR rate limiter específico y permisivo
    sessionController.getSessionStatus
);

// 🔄 Renovar sesión (CON rate limiter específico)
router.post('/renew', 
    authenticateToken, 
    sessionLimiter, // 🔥 APLICAR rate limiter específico
    sessionController.renewSession
);

module.exports = router;