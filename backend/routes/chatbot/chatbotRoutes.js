const express = require('express');
const router = express.Router();
const chatbotController = require('../../controllers/chatbot/chatbotController');
const { authenticateToken } = require('../../middlewares/authMiddleware');

// Rutas del chatbot
router.post('/mensaje', authenticateToken, chatbotController.procesarMensaje);
router.get('/conversacion/:conversacionId', authenticateToken, chatbotController.obtenerHistorial);

module.exports = router;