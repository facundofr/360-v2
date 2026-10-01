const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const categoriaConfigController = require('../../controllers/admin/categoriaConfigController');

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// Rutas para gestión de categorías
router.get('/', categoriaConfigController.getCategorias);
router.get('/estadisticas', categoriaConfigController.getEstadisticasDistribucion);
router.get('/carga-vendedores', categoriaConfigController.getCargaVendedores);

// 🆕 RUTAS PARA DISTRIBUCIÓN 3-2-1
router.get('/distribucion/estado', categoriaConfigController.getEstadoDistribucion3_2_1);
router.post('/distribucion/resetear-ronda', categoriaConfigController.resetearDistribucion3_2_1);

router.get('/:id', categoriaConfigController.getCategoria);
router.post('/', categoriaConfigController.createCategoria);
router.put('/:id', categoriaConfigController.updateCategoria);
router.delete('/:id', categoriaConfigController.deleteCategoria);
router.post('/:id/reset-round-robin', categoriaConfigController.resetRoundRobin);
router.put('/vendedor/:vendedorId/categoria', categoriaConfigController.asignarCategoriaVendedor);

module.exports = router;
