const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middlewares/authMiddleware");
const promocionesController = require("../../controllers/supervisor/promocionesController");

// Todas las rutas de lectura para supervisores
router.get("/", authenticateToken, promocionesController.list);
router.get("/activas", authenticateToken, promocionesController.activas);
router.get("/:id", authenticateToken, promocionesController.getById);

module.exports = router;
