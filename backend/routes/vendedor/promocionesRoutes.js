const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const promocionesController = require('../../controllers/vendedor/promocionesController');

router.get('/promociones', authenticateToken, promocionesController.getPromociones);
router.post('/prospectos/:id/aplicar-promocion', authenticateToken, promocionesController.aplicarPromocion);
router.get('/prospectos/:prospectoId/promocion-actual', authenticateToken, promocionesController.getPromocionActual);

module.exports = router;