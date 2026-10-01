const express = require('express');
const router = express.Router();
const prestadorController = require('../../controllers/admin/prestadorController');
const { authenticateToken, authenticateAdmin } = require('../../middlewares/authMiddleware');

// Rutas básicas CRUD
router.get('/', authenticateToken, authenticateAdmin, prestadorController.getAll);
router.get('/:id', authenticateToken, authenticateAdmin, prestadorController.getById);
router.post('/', authenticateToken, authenticateAdmin, prestadorController.create);
router.put('/:id', authenticateToken, authenticateAdmin, prestadorController.update);
router.delete('/:id', authenticateToken, authenticateAdmin, prestadorController.delete);

// Cambiar estado
router.put('/:id/estado', authenticateToken, authenticateAdmin, prestadorController.changeStatus);

// Gestión de planes
router.post('/:prestadorId/planes/:planId', authenticateToken, authenticateAdmin, prestadorController.asignarPlan);
router.delete('/:prestadorId/planes/:planId', authenticateToken, authenticateAdmin, prestadorController.desasignarPlan);

module.exports = router;