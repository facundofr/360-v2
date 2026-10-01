const express = require('express');
const router = express.Router();
const chatbotVendedorController = require('../../controllers/chatbot/chatbotVendedorController');
const { authenticateToken } = require('../../middlewares/authMiddleware');

// Middleware para verificar que es vendedor
const authenticateVendedor = (req, res, next) => {
  if (req.user.role !== 1) { // Asumiendo que role 1 = vendedor
    return res.status(403).json({ message: "Acceso denegado. Solo vendedores." });
  }
  next();
};

// Rutas del chatbot para vendedores
router.post('/mensaje', 
  authenticateToken, 
  authenticateVendedor, 
  chatbotVendedorController.procesarMensajeVendedor
);

router.get('/conversaciones', 
  authenticateToken, 
  authenticateVendedor, 
  chatbotVendedorController.obtenerConversacionesVendedor
);

router.get('/conversacion/:conversacionId', 
  authenticateToken, 
  authenticateVendedor, 
  chatbotVendedorController.obtenerHistorialVendedor
);

module.exports = router;