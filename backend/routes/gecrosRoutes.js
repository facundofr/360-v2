const express = require('express');
const router = express.Router();
const gecrosController = require('../controllers/gecrosController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Consultar por DNI
router.get('/consultar/dni/:dni', gecrosController.consultarPorDni);

// Consultar por CUIL
router.get('/consultar/cuil/:cuil', gecrosController.consultarPorCuil);

// Búsqueda flexible
router.get('/buscar', gecrosController.buscarAfiliados);

// Descargar credencial
router.get('/credencial/:benId', gecrosController.descargarCredencial);

module.exports = router;
