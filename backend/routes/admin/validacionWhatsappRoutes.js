const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const validacionWhatsappConfigController = require('../../controllers/admin/validacionWhatsappConfigController');

router.use(authenticateToken);

router.get('/', validacionWhatsappConfigController.getConfig);
router.put('/', validacionWhatsappConfigController.actualizarConfig);
router.get('/metricas', validacionWhatsappConfigController.getMetricas);
router.get('/prospectos', validacionWhatsappConfigController.getProspectos);
router.get('/prospectos/:id/conversacion', validacionWhatsappConfigController.getConversacion);

module.exports = router;
