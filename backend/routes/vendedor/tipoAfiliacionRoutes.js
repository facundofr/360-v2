const express = require('express');
const router = express.Router();
const { getTiposAfiliacion } = require('../../controllers/vendedor/tipoAfiliacionController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/', getTiposAfiliacion);

module.exports = router;