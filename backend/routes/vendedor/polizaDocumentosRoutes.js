const express = require('express');
const router = express.Router();
const VendedorPolizaDocumentosController = require('../../controllers/vendedor/polizaDocumentosController');
const PolizaVendedorController = require('../../controllers/poliza/polizaVendedorController');
const { authenticateToken, authenticateRoles } = require('../../middlewares/authMiddleware');

// ✅ Todas las rutas requieren autenticación y rol de vendedor (role = 1)

// Obtener tipos de documentos disponibles
router.get('/documentos/tipos', 
  authenticateToken,
  authenticateRoles(1), // Solo vendedores
  VendedorPolizaDocumentosController.obtenerTiposDocumentos
);

// Cargar múltiples documentos
router.post('/:id/documentos/multiple', 
  authenticateToken,
  authenticateRoles(1),
  VendedorPolizaDocumentosController.cargarMultiplesDocumentos
);

// Obtener estadísticas de documentos de una póliza
router.get('/:id/documentos/estadisticas', 
  authenticateToken,
  authenticateRoles(1),
  VendedorPolizaDocumentosController.obtenerEstadisticasDocumentos
);

// Previsualizar documento
router.get('/documentos/:documentoId/preview', 
  authenticateToken,
  authenticateRoles(1),
  (req, res, next) => {
    console.log(`[VENDEDOR ROUTE] Preview llamado - documentoId: ${req.params.documentoId}`);
    next();
  },
  VendedorPolizaDocumentosController.previsualizarDocumento
);

// Descargar documento
router.get('/documentos/:documentoId/download', 
  authenticateToken,
  authenticateRoles(1),
  (req, res, next) => {
    console.log(`[VENDEDOR ROUTE] Download llamado - documentoId: ${req.params.documentoId}`);
    next();
  },
  VendedorPolizaDocumentosController.descargarDocumento
);

// Obtener todos los documentos de una póliza
router.get('/:id/documentos', 
  authenticateToken,
  authenticateRoles(1),
  VendedorPolizaDocumentosController.obtenerDocumentosPoliza
);

// ✅ Actualizar documento (reemplazar archivo)
router.put('/documentos/:documentoId/actualizar',
  authenticateToken,
  authenticateRoles(1),
  VendedorPolizaDocumentosController.actualizarDocumento
);

// ✅ Eliminar documento
router.delete('/documentos/:documentoId',
  authenticateToken,
  authenticateRoles(1),
  VendedorPolizaDocumentosController.eliminarDocumento
);

// ✅ Obtener datos de póliza para edición (EditarPolizaModal)
router.get('/:id/editar',
  authenticateToken,
  authenticateRoles(1),
  PolizaVendedorController.obtenerParaEditar
);

// ✅ Actualizar póliza (EditarPolizaModal)
router.put('/:id/actualizar',
  authenticateToken,
  authenticateRoles(1),
  PolizaVendedorController.actualizarPoliza
);

module.exports = router;
