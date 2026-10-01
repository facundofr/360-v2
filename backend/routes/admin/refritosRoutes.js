const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const RefritosController = require('../../controllers/admin/refritosController');
const { authenticateToken, authenticateAdmin } = require('../../middlewares/authMiddleware');
const { adminLimiter } = require('../../middlewares/rateLimiters');

// Middleware de autenticación y admin
const adminOnly = [authenticateToken, authenticateAdmin];

// 🛡️ APLICAR RATE LIMITING
router.use(adminLimiter);

/**
 * 📥 GET /admin/refritos/descargar-ejemplo
 * Descargar archivo CSV de ejemplo para refritos
 */
router.get('/descargar-ejemplo', adminOnly, (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../..', 'frontend', 'public', 'ejemplo_refritos.csv');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo de ejemplo no encontrado' });
    }

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ejemplo_refritos.csv"');
    
    // Enviar archivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error descargando archivo de ejemplo:', error);
    res.status(500).json({ 
      message: 'Error al descargar el archivo de ejemplo',
      error: error.message 
    });
  }
});

/**
 * 📤 POST /admin/refritos/cargar
 * Cargar archivo CSV/XLSX con refritos
 * Body: FormData con campo 'archivo'
 */
router.post(
  '/cargar',
  adminOnly,
  RefritosController.subirArchivoRefritos
);

/**
 * 📊 GET /admin/refritos/cargar/en-curso
 * Carga en segundo plano que se está procesando ({ carga: null } si no hay ninguna)
 */
router.get('/cargar/en-curso', adminOnly, RefritosController.obtenerCargaEnCurso);

/**
 * 📊 GET /admin/refritos/cargar/:cargaId
 * Estado de una carga en segundo plano (incluye el resultado cuando terminó)
 */
router.get('/cargar/:cargaId', adminOnly, RefritosController.obtenerEstadoCarga);

/**
 * 🔄 POST /admin/refritos/reasignar
 * Reasignar refrito a otro vendedor (cuando "No contesta")
 * Body: { prospectoId }
 */
router.post(
  '/reasignar',
  adminOnly,
  RefritosController.reasignarRefritoNoContactado
);

/**
 * ❌ POST /admin/refritos/eliminar-flujo
 * Eliminar refrito del flujo (marcarlo como "No contesta")
 * Body: { prospectoId }
 */
router.post(
  '/eliminar-flujo',
  adminOnly,
  RefritosController.eliminarRefritoDeFlujo
);

/**
 * 📋 GET /admin/refritos/historial/:prospectoId
 * Obtener historial de asignaciones de un refrito
 */
router.get(
  '/historial/:prospectoId',
  adminOnly,
  RefritosController.obtenerHistorialRefrito
);

/**
 * 📊 GET /admin/refritos/estadisticas
 * Obtener estadísticas de refritos
 */
router.get(
  '/estadisticas',
  adminOnly,
  RefritosController.obtenerEstadisticas
);

/**
 * 📊 GET /admin/refritos/reporte-vendedores
 * Obtener reporte de asignaciones por vendedor
 */
router.get(
  '/reporte-vendedores',
  adminOnly,
  RefritosController.obtenerReportePorVendedor
);

/**
 * 🏆 GET /admin/refritos/vendedor/:vendedorId
 * Obtener refritos asignados a un vendedor específico
 */
router.get(
  '/vendedor/:vendedorId',
  adminOnly,
  RefritosController.obtenerRefritosVendedor
);

/**
 * 📋 GET /admin/refritos/listar
 * Listar todos los refritos con vendedor asignado actual
 */
router.get(
  '/listar',
  adminOnly,
  RefritosController.listarTodos
);

/**
 * 👁️ GET /admin/refritos/visible/:vendedorId
 * Obtener el refrito visible actual para un vendedor
 */
router.get(
  '/visible/:vendedorId',
  adminOnly,
  RefritosController.obtenerRefritoVisible
);

/**
 * 📊 GET /admin/refritos/cola/:vendedorId
 * Obtener cantidad de refritos en cola para un vendedor
 */
router.get(
  '/cola/:vendedorId',
  adminOnly,
  RefritosController.obtenerRefritosEnCola
);

module.exports = router;
