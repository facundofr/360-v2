const express = require('express');
const router = express.Router();
const VendedorPolizasController = require('../../controllers/vendedor/polizasController');
const { authenticateToken, authenticateRoles } = require('../../middlewares/authMiddleware');

// ✅ Todas las rutas requieren autenticación y rol de vendedor (role = 1)

// Enviar póliza a supervisor para revisión
router.patch('/:id/enviar-supervisor',
  authenticateToken,
  authenticateRoles(1), // Solo vendedores
  VendedorPolizasController.enviarAlSupervisor
);

module.exports = router;
