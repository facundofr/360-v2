const express = require("express");
const router = express.Router();
const monotributoController = require("../controllers/monotributoController");
const { authenticateToken, authenticateAdmin } = require("../middlewares/authMiddleware");

// Middleware para admin
const adminOnly = [authenticateToken, authenticateAdmin];

// Obtener todas las categorías
router.get("/", adminOnly, monotributoController.obtenerCategorias);

// Obtener una categoría por ID
router.get("/:id", adminOnly, monotributoController.obtenerCategoriaPorId);

// Crear nueva categoría
router.post("/", adminOnly, monotributoController.crearCategoria);

// Actualizar categoría
router.put("/:id", adminOnly, monotributoController.actualizarCategoria);

// Eliminar categoría
router.delete("/:id", adminOnly, monotributoController.eliminarCategoria);

// Aplicar aumento porcentual
router.post("/aumentar", adminOnly, monotributoController.aplicarAumento);

module.exports = router;
