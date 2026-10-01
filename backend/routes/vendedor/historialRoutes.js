const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const { getHistorial } = require('../../controllers/vendedor/historialController');

router.get('/:id/historial', authenticateToken, getHistorial);

module.exports = router;