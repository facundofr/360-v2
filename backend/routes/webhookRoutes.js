const express = require('express');
const router = express.Router();
const cuponPagoController = require('../controllers/cuponPagoController');
const whatsappWebhookController = require('../controllers/whatsappWebhookController'); // ✅ NUEVO

/**
 * @route POST /api/webhooks/mercadopago
 * @desc Webhook para recibir notificaciones de MercadoPago
 * @access Public (usado por MercadoPago)
 */
router.post('/mercadopago', cuponPagoController.webhookMercadoPago);

/**
 * @route GET /api/webhooks/whatsapp
 * @desc Verificación del webhook de WhatsApp (Twilio)
 * @access Public (usado por Twilio)
 */
router.get('/whatsapp', whatsappWebhookController.verificarWebhook);

/**
 * @route POST /api/webhooks/whatsapp
 * @desc Recibir mensajes entrantes de WhatsApp
 * @access Public (usado por Twilio)
 */
router.post('/whatsapp', whatsappWebhookController.recibirMensaje);

/**
 * @route POST /api/webhooks/whatsapp-status
 * @desc Recibir actualizaciones de estado de mensajes de WhatsApp
 * @access Public (usado por Twilio)
 */
router.post('/whatsapp-status', whatsappWebhookController.actualizarEstado);

/**
 * @route GET /api/webhooks/inbound
 * @desc Verificación del webhook de WhatsApp - Endpoint alternativo configurado en Twilio
 * @access Public (usado por Twilio)
 */
router.get('/inbound', whatsappWebhookController.verificarWebhook);

/**
 * @route POST /api/webhooks/inbound
 * @desc Recibir mensajes entrantes de WhatsApp - Endpoint alternativo configurado en Twilio
 * @access Public (usado por Twilio)
 */
router.post('/inbound', whatsappWebhookController.recibirMensaje);

module.exports = router;
