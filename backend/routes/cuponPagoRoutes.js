const express = require('express');
const router = express.Router();
const cuponPagoController = require('../controllers/cuponPagoController');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * @route POST /api/cupones-pago/cotizacion/:cotizacion_id
 * @desc Generar cupón de pago para una cotización
 * @access Private (Vendedor, Admin)
 */
router.post('/cotizacion/:cotizacion_id', authenticateToken, cuponPagoController.generarCuponPago);

/**
 * @route POST /api/cupones-pago/:cupon_id/reenviar-whatsapp
 * @desc Reenviar cupón de pago por WhatsApp
 * @access Private (Vendedor, Admin)
 */
router.post('/:cupon_id/reenviar-whatsapp', authenticateToken, cuponPagoController.reenviarCuponWhatsApp);

/**
 * @route GET /api/cupones-pago/prospecto/:prospecto_id
 * @desc Obtener historial de cupones de pago de un prospecto
 * @access Private (Vendedor, Admin)
 */
router.get('/prospecto/:prospecto_id', authenticateToken, cuponPagoController.obtenerCuponesPorProspecto);

module.exports = router;
