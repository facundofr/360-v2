const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const fcmController = require('../controllers/fcmController');

/**
 * POST /api/fcm/register
 * Registrar token FCM
 * Headers: Authorization: Bearer <token>
 * Body: { token: string, deviceInfo?: { device, platform, appVersion } }
 */
router.post('/register', authenticateToken, fcmController.registrarTokenFCM);

/**
 * POST /api/fcm/unregister
 * Desregistrar token FCM
 * Headers: Authorization: Bearer <token>
 * Body: { token: string }
 */
router.post('/unregister', authenticateToken, fcmController.desregistrarTokenFCM);

/**
 * GET /api/fcm/tokens
 * Obtener tokens activos del usuario
 * Headers: Authorization: Bearer <token>
 */
router.get('/tokens', authenticateToken, fcmController.obtenerTokens);

/**
 * POST /api/fcm/test
 * Enviar notificación de prueba
 * Headers: Authorization: Bearer <token>
 */
router.post('/test', authenticateToken, fcmController.enviarNotificacionPrueba);

module.exports = router;
