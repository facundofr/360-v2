const express = require('express');
const router = express.Router();
const PublicListaPreciosController = require('../../controllers/publicListaPreciosController');
const { publicReadLimiter } = require('../../middlewares/rateLimiters');

/**
 * 🌐 RUTAS PÚBLICAS DE LISTA DE PRECIOS (SOLO LECTURA)
 * Sin autenticación requerida, pero con rate limiting
 * Todas las rutas están protegidas por rate limiting para endpoints públicos
 */

// 📋 Obtener lista de precios con filtros opcionales
router.get('/', publicReadLimiter, PublicListaPreciosController.getListaPrecios);

// 📊 Obtener años disponibles
router.get('/years', publicReadLimiter, PublicListaPreciosController.getAvailableYears);

// 💰 Obtener precio específico
router.get('/precio', publicReadLimiter, PublicListaPreciosController.getPrecio);

// 📈 Obtener estadísticas de precios
router.get('/stats', publicReadLimiter, PublicListaPreciosController.getStats);

module.exports = router;
