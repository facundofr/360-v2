const express = require('express');
const router = express.Router();
const upload = require('../../config/multer');
const PolizaDocumentosController = require('../../controllers/poliza/polizaDocumentosController');
const PolizasSupervisorController = require('../../controllers/supervisor/polizasController');
const { authenticateToken } = require('../../middlewares/authMiddleware');

// ⚠️ IMPORTANTE: Las rutas más específicas DEBEN ir ANTES que las genéricas

// ✅ RUTA PÚBLICA - Sin autenticación, debe ir PRIMERO
router.get('/public/:hash', (req, res, next) => {
  console.log('🔓 [RUTA PÚBLICA] Hash recibido:', req.params.hash);
  next();
}, PolizaDocumentosController.descargarPorHash);

// Subir documento
router.post('/upload', 
  authenticateToken, 
  upload.single('documento'), 
  PolizaDocumentosController.subirDocumento
);

// ✅ Cargar póliza firmada (POST específico)
router.post('/firmada/cargar',
  authenticateToken,
  upload.single('poliza_firmada'),
  PolizaDocumentosController.cargarPolizaFirmada
);

// ✅ RUTAS ESPECÍFICAS (POST)
router.post('/:id/multiple', 
  authenticateToken, 
  PolizasSupervisorController.cargarMultiplesDocumentos
);

// ✅ RUTAS ESPECÍFICAS (GET) - Ir ANTES de /:id
router.get('/poliza/:poliza_id', 
  authenticateToken, 
  PolizaDocumentosController.obtenerDocumentos
);

router.get('/:id/tipos', 
  authenticateToken, 
  async (req, res) => {
    try {
      const tiposDocumento = [
        { valor: 'poliza_firmada', etiqueta: '📄 Póliza Firmada' },
        { valor: 'auditoria_medica', etiqueta: '🏥 Auditoría Médica' },
        { valor: 'documento_identidad_adicional', etiqueta: '🆔 Documento de Identidad Adicional' },
        { valor: 'comprobante_ingresos', etiqueta: '💰 Comprobante de Ingresos' },
        { valor: 'autorizacion_debito', etiqueta: '💳 Autorización de Débito' },
        { valor: 'documento_adicional', etiqueta: '📎 Documento Adicional' }
      ];
      res.json({ success: true, data: tiposDocumento });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.get('/:id/estadisticas', 
  authenticateToken, 
  PolizasSupervisorController.obtenerEstadisticasDocumentos
);

router.get('/:id/download', 
  authenticateToken, 
  (req, res) => {
    req.params.documento_id = req.params.id;
    PolizaDocumentosController.descargarDocumento(req, res);
  }
);

router.get('/:id/preview', 
  authenticateToken, 
  PolizasSupervisorController.previsualizarDocumento
);

// ✅ RUTAS GENÉRICAS (GET) - Ir AL FINAL
router.get('/:id', 
  authenticateToken, 
  (req, res) => {
    // Redirigir al método correcto
    req.params.poliza_id = req.params.id;
    PolizaDocumentosController.obtenerDocumentos(req, res);
  }
);

// ✅ RUTAS GENÉRICAS (DELETE)
router.delete('/:documento_id', 
  authenticateToken, 
  PolizaDocumentosController.eliminarDocumento
);

// LEGADO: Rutas antiguas
router.get('/download/:documento_id', 
  authenticateToken, 
  PolizaDocumentosController.descargarDocumento
);

module.exports = router;