const express = require('express');
const router = express.Router();
const NacionalidadController = require('../../controllers/utils/nacionalidadController');

router.get('/', NacionalidadController.listar);

module.exports = router;