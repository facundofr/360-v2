const express = require('express');
const router = express.Router();
const localidadesController = require('../../controllers/vendedor/localidadesController');

// Puedes proteger la ruta con autenticación si lo deseas
// const { authenticateToken } = require('../../middlewares/authMiddleware');

// router.get('/buenos-aires', authenticateToken, localidadesController.getLocalidadesBuenosAires);
router.get('/buenos-aires', localidadesController.getLocalidadesBuenosAires);

module.exports = router;