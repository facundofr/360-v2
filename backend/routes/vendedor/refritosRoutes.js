const express = require('express');
const router = express.Router();
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');
const { authenticateToken } = require('../../middlewares/authMiddleware');

/**
 * 👁️ GET /vendedor/refritos/visible
 * Obtener el refrito visible actual para el vendedor logueado
 */
router.get('/visible', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;

    await RefritosVisibilityService.asegurarRefritoVisible(vendedorId);
    const refrito = await RefritosVisibilityService.obtenerRefritoVisible(vendedorId);
    
    res.status(200).json({
      vendedorId,
      tieneVisible: !!refrito,
      refrito: refrito
    });
  } catch (error) {
    console.error("Error al obtener refrito visible:", error);
    res.status(500).json({
      message: "Error al obtener el refrito visible",
      error: error.message
    });
  }
});

/**
 * 📊 GET /vendedor/refritos/cola
 * Obtener cantidad de refritos en cola para el vendedor logueado
 */
router.get('/cola', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;
    
    const cantidad = await RefritosVisibilityService.contarRefritosEnCola(vendedorId);
    
    res.status(200).json({
      vendedorId,
      enCola: cantidad
    });
  } catch (error) {
    console.error("Error al contar refritos en cola:", error);
    res.status(500).json({
      message: "Error al contar refritos en cola",
      error: error.message
    });
  }
});

module.exports = router;
