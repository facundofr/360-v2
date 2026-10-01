const NotificationsService = require('../services/notificationsService');
const db = require('../config/db');

/**
 * POST /api/fcm/register
 * Registrar o actualizar token FCM del usuario
 */
const registrarTokenFCM = async (req, res) => {
  try {
    const { token, deviceInfo } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        message: 'Usuario no autenticado' 
      });
    }

    if (!token) {
      return res.status(400).json({ 
        message: 'Token FCM requerido' 
      });
    }

    const resultado = await NotificationsService.guardarTokenFCM(
      userId,
      token,
      deviceInfo || {}
    );

    res.status(200).json({
      message: resultado.nuevo ? 'Token registrado correctamente' : 'Token actualizado',
      nuevo: resultado.nuevo,
      token: resultado.token
    });
  } catch (error) {
    console.error('Error registrando token FCM:', error);
    res.status(500).json({ 
      message: 'Error al registrar token FCM',
      error: error.message 
    });
  }
};

/**
 * POST /api/fcm/unregister
 * Desregistrar token FCM (el usuario cerró sesión o desactualización)
 */
const desregistrarTokenFCM = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        message: 'Usuario no autenticado' 
      });
    }

    if (!token) {
      return res.status(400).json({ 
        message: 'Token FCM requerido' 
      });
    }

    await NotificationsService.eliminarToken(token);

    res.status(200).json({
      message: 'Token desregistrado correctamente'
    });
  } catch (error) {
    console.error('Error desregistrando token FCM:', error);
    res.status(500).json({ 
      message: 'Error al desregistrar token FCM',
      error: error.message 
    });
  }
};

/**
 * GET /api/fcm/tokens
 * Obtener todos los tokens activos del usuario autenticado
 */
const obtenerTokens = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        message: 'Usuario no autenticado' 
      });
    }

    const tokens = await NotificationsService.obtenerTokensUsuario(userId);

    res.status(200).json({
      message: 'Tokens obtenidos correctamente',
      cantidad: tokens.length,
      tokens
    });
  } catch (error) {
    console.error('Error obteniendo tokens:', error);
    res.status(500).json({ 
      message: 'Error al obtener tokens',
      error: error.message 
    });
  }
};

/**
 * POST /api/fcm/test
 * Enviar notificación de prueba al usuario autenticado
 */
const enviarNotificacionPrueba = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        message: 'Usuario no autenticado' 
      });
    }

    const resultado = await NotificationsService.enviarNotificacionUsuario(
      userId,
      '🧪 Notificación de Prueba',
      'Las notificaciones push están funcionando correctamente',
      {
        tipo: 'prueba',
        timestamp: new Date().toISOString()
      }
    );

    res.status(200).json({
      message: 'Notificación de prueba enviada',
      resultado
    });
  } catch (error) {
    console.error('Error enviando notificación de prueba:', error);
    res.status(500).json({ 
      message: 'Error al enviar notificación de prueba',
      error: error.message 
    });
  }
};

module.exports = {
  registrarTokenFCM,
  desregistrarTokenFCM,
  obtenerTokens,
  enviarNotificacionPrueba
};
