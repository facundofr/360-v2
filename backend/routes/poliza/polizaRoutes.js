const express = require('express');
const router = express.Router();

// ✅ IMPORTAR TODOS LOS CONTROLADORES MODULARES
const PolizaController = require('../../controllers/poliza/polizaController');
// const PolizaTemporalController = require('../../controllers/poliza/polizaTemporalController');
const PolizaPDFController = require('../../controllers/poliza/polizaPDFController');
const PolizaWhatsAppController = require('../../controllers/poliza/polizaWhatsAppController');
const PolizaVendedorController = require('../../controllers/poliza/polizaVendedorController');
const PolizaDocumentosController = require('../../controllers/poliza/polizaDocumentosController');
const PolizasSupervisorController = require('../../controllers/supervisor/polizasController');

const { authenticateToken } = require('../../middlewares/authMiddleware');

// ===============================
// 🔥 RUTAS ESPECÍFICAS PRIMERO (antes que las rutas con parámetros)
// ===============================

// 📋 RUTAS DEL VENDEDOR
router.get('/vendedor/mis-polizas', authenticateToken, PolizaVendedorController.obtenerPolizas);
router.get('/vendedor/estadisticas', authenticateToken, PolizaVendedorController.obtenerEstadisticas);
router.get('/vendedor/verificar-numero-poliza', authenticateToken, PolizaVendedorController.verificarNumeroPoliza);
router.get('/vendedor/:id/editar', authenticateToken, PolizaVendedorController.obtenerParaEditar);
router.put('/vendedor/:id/actualizar', authenticateToken, PolizaVendedorController.actualizarPoliza);
router.patch('/vendedor/:id/enviar-supervisor', authenticateToken, PolizaVendedorController.enviarASupervisor);
router.get('/vendedor/:id', authenticateToken, PolizaVendedorController.obtenerPoliza);
router.patch('/vendedor/:id/estado', authenticateToken, PolizaVendedorController.cambiarEstado);

// 🔍 RUTAS DE CONSULTA POR PROSPECTO
router.get('/prospecto/:prospecto_id', authenticateToken, PolizaController.obtenerPorProspecto);

// 📄 RUTAS DE DOCUMENTOS
router.post('/:id/documentos', authenticateToken, PolizaDocumentosController.subirDocumento);
router.get('/:id/documentos', authenticateToken, PolizaDocumentosController.obtenerDocumentos);
router.get('/documentos/:documento_id/descargar', authenticateToken, PolizaDocumentosController.descargarDocumento);
router.put('/documentos/:documentoId/actualizar', authenticateToken, PolizaDocumentosController.actualizarDocumento);
router.delete('/documentos/:documento_id', authenticateToken, PolizaDocumentosController.eliminarDocumento);
// Las rutas públicas de documentos se exponen en /poliza-documentos/public/:hash

// 🏗️ RUTAS DE PÓLIZAS TEMPORALES
// router.post('/temporal', authenticateToken, PolizaTemporalController.crear);
// router.put('/temporal/:id', authenticateToken, PolizaTemporalController.actualizar);
// router.post('/temporal/:id/finalizar', authenticateToken, PolizaTemporalController.finalizar);
// router.delete('/temporal/:id', authenticateToken, PolizaTemporalController.eliminar);

// 📱 RUTAS DE ENVÍO (WhatsApp/Email)
router.post('/:id/enviar-whatsapp', authenticateToken, PolizaWhatsAppController.enviar);
router.post('/:id/enviar-email', authenticateToken, PolizaWhatsAppController.enviarEmail);
router.get('/:id/envios', authenticateToken, PolizaWhatsAppController.obtenerHistorialEnvios);
router.post('/:id/reenviar', authenticateToken, PolizaWhatsAppController.reenviar);

// 📄 RUTAS DE PDF (SIN AUTENTICACIÓN para WhatsApp)
router.get('/:id/pdf', PolizaPDFController.descargar);
router.get('/:id/pdf/public', PolizaPDFController.descargar);
router.get('/pdf/:hash', PolizaPDFController.descargarPorHash); // Nueva ruta con hash

// ===============================
// 🔥 RUTAS PRINCIPALES DE PÓLIZAS
// ===============================

// Crear póliza definitiva
router.post('/', authenticateToken, PolizaController.crear);

// Listar pólizas (admin/vendedor)
router.get('/', authenticateToken, PolizaController.listar);

// Actualizar estado de póliza
router.patch('/:id/estado', authenticateToken, PolizaController.actualizarEstado);

// ===============================
// 🔥 RUTAS CON PARÁMETROS AL FINAL
// ===============================

// Obtener póliza específica (DEBE IR AL FINAL)
router.get('/:id', authenticateToken, PolizaController.obtenerCompleta);
router.get('/:id/historial-estados', authenticateToken, PolizaController.obtenerHistorialEstados);

module.exports = router;