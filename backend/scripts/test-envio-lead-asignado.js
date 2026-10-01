// Script de prueba temporal: envía el mail de "lead asignado" con el countdown
// de mailtimer.io embebido.
// Uso: node test-envio-lead-asignado.js
// Borrar este archivo después de la prueba.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const emailService = require('../services/emailService');

(async () => {
  try {
    const info = await emailService.enviarNotificacionLeadAsignado({
      to: 'franciscomarinoni36@gmail.com, at@grupocober.com.ar',
      vendedorNombre: 'Juan Pérez',
      leadNombre: 'María Gómez',
      leadOrigen: 'Formulario Web',
      prospectoId: 12345
    });
    console.log('✅ Enviado:', info.messageId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enviando:', error.message);
    process.exit(1);
  }
})();
