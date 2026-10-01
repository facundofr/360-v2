const express = require('express');
const router = express.Router();
const compensadorController = require('../../controllers/admin/compensadorController');
const { authenticateToken, authenticateAdmin } = require('../../middlewares/authMiddleware');

// Todo lo que llegue acá (GET/POST/PUT/DELETE) se reenvía tal cual al Lead
// Router — ver controllers/admin/compensadorController.js. No se listan las
// ~15 sub-rutas del compensador (unidades, vendedores, métricas, validador)
// una por una porque cambiarían en los dos lados cada vez que el router
// agregue un endpoint nuevo.
router.all('/*', authenticateToken, authenticateAdmin, compensadorController.proxy);

module.exports = router;
