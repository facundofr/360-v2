const express = require('express');
const router = express.Router();
const GoogleSheetsController = require('../../controllers/googleSheets/googleSheetsController');
const { authMiddleware, roleMiddleware } = require('../../middlewares/authMiddleware');

// 🧪 Probar conexión (solo administradores)
router.get('/test', 
  authMiddleware, 
  roleMiddleware(['admin']), 
  GoogleSheetsController.testConexion
);

// 🆕 Inicializar hoja con headers (solo administradores)
router.post('/init', 
  authMiddleware, 
  roleMiddleware(['admin']), 
  GoogleSheetsController.inicializarHoja
);

// 🔄 Sincronizar todos los prospectos (solo administradores)
router.post('/sync-all', 
  authMiddleware, 
  roleMiddleware(['admin']), 
  GoogleSheetsController.sincronizarTodos
);

// ➕ Sincronizar un prospecto específico (admin y vendedores)
router.post('/sync/:id', 
  authMiddleware, 
  roleMiddleware(['admin', 'vendedor']), 
  GoogleSheetsController.sincronizarProspecto
);

// 🔄 Actualizar estado de un prospecto (admin y vendedores)
router.put('/update-estado/:id', 
  authMiddleware, 
  roleMiddleware(['admin', 'vendedor']), 
  GoogleSheetsController.actualizarEstado
);

module.exports = router;
