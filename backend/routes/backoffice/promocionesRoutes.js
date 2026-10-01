const express = require("express");
const router = express.Router();
const { authenticateToken, authenticateRoles } = require("../../middlewares/authMiddleware");
const promocionesController = require("../../controllers/backoffice/promocionesController");

// Roles: 2=Supervisor(lectura), 4=BackOffice(completo)
// GET - Disponible para Backoffice (4) y Supervisor (2)
router.get("/", authenticateToken, authenticateRoles(2, 4), promocionesController.list);
router.get("/activas", authenticateToken, authenticateRoles(2, 4), promocionesController.activas);
router.get("/:id", authenticateToken, authenticateRoles(2, 4), promocionesController.getById);

// POST, PUT, DELETE - Solo para Backoffice (4) - Supervisor no tiene acceso
router.post("/", authenticateToken, authenticateRoles(4), promocionesController.create);
router.put("/:id", authenticateToken, authenticateRoles(4), promocionesController.update);
router.delete("/:id", authenticateToken, authenticateRoles(4), promocionesController.remove);

module.exports = router;
