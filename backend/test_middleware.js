const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');

console.log('authenticateToken:', typeof authenticateToken);
console.log('es función:', typeof authenticateToken === 'function');

const router = express.Router();

try {
  router.use(authenticateToken);
  console.log('✅ Middleware aplicado correctamente');
} catch (error) {
  console.error('❌ Error aplicando middleware:', error.message);
}

module.exports = router;
