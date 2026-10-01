/**
 * Rutas para integración VaFirma
 */

const express = require('express');
const router = express.Router();
const vafirmaController = require('../controllers/vafirmaController');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * POST /api/vafirma/enviar-poliza
 * Enviar póliza a firma
 */
router.post(
  '/enviar-poliza',
  authenticateToken,
  vafirmaController.enviarPolizaFirma
);

/**
 * GET /api/vafirma/estado/:polizaId
 * Consultar estado de firma
 */
router.get(
  '/estado/:polizaId',
  authenticateToken,
  vafirmaController.consultarEstadoFirma
);

/**
 * GET /api/vafirma/estado-doc/:docUUID
 * Consultar/sincronizar estado por docUUID específico
 */
router.get(
  '/estado-doc/:docUUID',
  authenticateToken,
  vafirmaController.consultarEstadoPorDocUUID
);

/**
 * GET /api/vafirma/descargar-firmada/:polizaId
 * Descargar póliza firmada
 */
router.get(
  '/descargar-firmada/:polizaId',
  authenticateToken,
  vafirmaController.descargarPolizaFirmada
);

/**
 * POST /api/vafirma/webhook
 * Webhook de notificación de VaFirma (sin autenticación)
 */
router.post(
  '/webhook',
  vafirmaController.webhookVaFirma
);

/**
 * DELETE /api/vafirma/solicitud/:polizaId
 * Eliminar solicitud de firma (para reenviar a firmar)
 */
router.delete(
  '/solicitud/:polizaId',
  authenticateToken,
  vafirmaController.eliminarSolicitudFirma
);

/**
 * DELETE /api/vafirma/documento-firmado/:polizaId
 * Eliminar documento firmado de VaFirma + BD
 * Query params: docUUID o docOriginId
 */
router.delete(
  '/documento-firmado/:polizaId',
  authenticateToken,
  vafirmaController.eliminarDocumentoFirmado
);

module.exports = router;
