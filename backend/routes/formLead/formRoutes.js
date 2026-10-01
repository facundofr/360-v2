const express = require('express');
const router = express.Router();
const { createLead, getCotizaciones, registrarPreferenciaEntrega } = require('../../controllers/formLead/formController');
const { 
    preventDuplicateSubmission, 
    leadCreationLimiter, 
    validateLeadDuplicates 
} = require('../../middlewares/duplicatePreventionMiddleware');

// 🚀 Ruta para crear un nuevo lead - CON PREVENCIÓN DE DUPLICADOS
router.post('/', 
    leadCreationLimiter,           // 🔒 Rate limiting específico para leads
    preventDuplicateSubmission(),   // 🛡️ Prevenir requests duplicadas (30s)
    validateLeadDuplicates,        // 🔍 Validar duplicados en BD
    createLead                     // ✅ Crear lead si pasa todas las validaciones
);

// Ruta para obtener cotizaciones de un lead
router.get('/:id/cotizaciones', getCotizaciones);

// 📞 Ruta para registrar preferencia de entrega de cotización
router.post('/:id/preferencia-entrega', registrarPreferenciaEntrega);

module.exports = router;