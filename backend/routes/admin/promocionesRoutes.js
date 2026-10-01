const express = require("express");
const router = express.Router();
const { authenticateToken, authenticateRoles } = require("../../middlewares/authMiddleware");
const promocionesController = require("../../controllers/admin/promocionesController");

// ✅ Permitir acceso a Admin (3) y Supervisor (2)
const adminOrSupervisor = authenticateRoles(2, 3);

router.get("/", authenticateToken, adminOrSupervisor, promocionesController.list);
router.post("/", authenticateToken, adminOrSupervisor, promocionesController.create);
router.put("/:id", authenticateToken, adminOrSupervisor, promocionesController.update);
router.delete("/:id", authenticateToken, adminOrSupervisor, promocionesController.remove);

module.exports = router;