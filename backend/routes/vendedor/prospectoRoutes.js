const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const prospectoController = require('../../controllers/vendedor/prospectoController');
const CotizacionController = require('../../controllers/vendedor/enviarCotizacionController');

router.post('/', authenticateToken, prospectoController.createProspecto);
router.get('/', authenticateToken, prospectoController.getProspectos);
router.get('/:id', authenticateToken, prospectoController.getProspectoById);
router.put('/:id', authenticateToken, prospectoController.updateProspecto);
router.delete('/:id', authenticateToken, prospectoController.deleteProspecto);

// Ruta para enviar cotización por WhatsApp
router.post('/enviar-whatsapp', authenticateToken, CotizacionController.enviarPorWhatsApp);

// Ruta para enviar primer contacto por WhatsApp
router.post('/:id/primer-contacto-whatsapp', authenticateToken, prospectoController.enviarPrimerContactoWhatsApp);

// Ruta para recotizar prospecto
router.post('/:id/recotizar', authenticateToken, prospectoController.recotizarProspecto);

// ☎️ NUEVA: Ruta para registrar llamada telefónica
router.post('/:id/registrar-llamada', authenticateToken, prospectoController.registrarLlamada);

module.exports = router;