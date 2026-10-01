const express = require('express');
const router = express.Router();
const listaPreciosController = require('../../controllers/admin/listaPreciosController');
const { authenticateToken, authenticateAdmin } = require('../../middlewares/authMiddleware');

// ✅ Middleware para admin
const adminOnly = [authenticateToken, authenticateAdmin];

// Rutas existentes
router.get('/', adminOnly, listaPreciosController.getAll);
router.post('/', adminOnly, listaPreciosController.create);
router.put('/:id', adminOnly, listaPreciosController.update);
router.delete('/:id', adminOnly, listaPreciosController.delete);

// Rutas de modificación masiva
router.put('/aumentar/todos', adminOnly, listaPreciosController.updateAllByPercentage);
router.put('/disminuir/todos', adminOnly, listaPreciosController.decreaseAllByPercentage);

// ✅ RUTAS DE EXPORTACIÓN/IMPORTACIÓN
router.get('/exportar', adminOnly, listaPreciosController.exportarCSV);
router.get('/template', adminOnly, listaPreciosController.descargarTemplateCSV);

module.exports = router;