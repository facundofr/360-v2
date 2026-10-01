const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/exportController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Rutas de exportación
router.get('/prospectos', authenticateToken, ExportController.exportarProspectos);
router.get('/estadisticas', authenticateToken, ExportController.obtenerEstadisticasExportacion);

module.exports = router;
