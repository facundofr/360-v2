const express = require("express");
const router = express.Router();
const { listarCotizaciones, listarTodasLasCotizaciones, aplicarLey19032, recalcularCotizacion } = require("../../controllers/cotizaciones/cotizacionesController");
const { authenticateToken } = require("../../middlewares/authMiddleware");

// Controladores para los nuevos endpoints
const { listarPlanes, listarCategorias, listarTiposFamilia } = require("../../controllers/cotizaciones/opcionesCotizacionesController");

// Rutas existentes
router.get("/", listarCotizaciones);
router.get("/todas", listarTodasLasCotizaciones);

// Ruta para aplicar Ley 19032
router.post("/:cotizacionId/aplicar-ley19032", authenticateToken, aplicarLey19032);

// ✅ NUEVA: Ruta para recalcular cotización con precios actuales
router.post("/:cotizacionId/recalcular", authenticateToken, recalcularCotizacion);

// Nuevas rutas para opciones
router.get("/planes", listarPlanes);
router.get("/categorias", listarCategorias);
router.get("/tipos-familia", listarTiposFamilia);

module.exports = router;