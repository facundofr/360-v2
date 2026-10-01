const cron = require('node-cron');
const db = require('../config/db');
const ValidacionWhatsappService = require('../services/validacionWhatsappService');

const HORAS_SIN_RESPUESTA = 1;

class ValidacionFallbackJob {
  static iniciar() {
    // Corre cada 15 minutos, sin restricción de horario/día — un lead puede haber
    // sido derivado a validación en cualquier momento y no debe quedar colgado.
    const job = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.ejecutar();
      } catch (error) {
        console.error('❌ Error en job de fallback de validación:', error);
      }
    });

    console.log(`✅ Job de fallback de validación iniciado (cada 15 min, umbral ${HORAS_SIN_RESPUESTA}hs)`);
    return job;
  }

  static async ejecutar() {
    const [prospectos] = await db.query(
      `SELECT id FROM prospectos
       WHERE validado = 0
         AND validacion_enviada_at IS NOT NULL
         AND estado IN (?, ?)
         AND TIMESTAMPDIFF(HOUR, validacion_enviada_at, NOW()) >= ?`,
      [
        ValidacionWhatsappService.ESTADO_ESPERANDO_APERTURA,
        ValidacionWhatsappService.ESTADO_ESPERANDO_CONFIRMACION,
        HORAS_SIN_RESPUESTA,
      ]
    );

    if (prospectos.length === 0) return;

    console.log(`📊 Fallback de validación: ${prospectos.length} prospecto(s) sin respuesta ≥${HORAS_SIN_RESPUESTA}hs, asignando igual`);

    for (const prospecto of prospectos) {
      try {
        await ValidacionWhatsappService.finalizarValidacion(prospecto.id, {
          status: 'timeout',
          comentario: `Asignado automáticamente: sin respuesta al validador WhatsApp tras ${HORAS_SIN_RESPUESTA}hs`,
        });
        console.log(`✅ Prospecto ${prospecto.id} asignado por fallback de validación`);
      } catch (error) {
        console.error(`❌ Error en fallback de validación para prospecto ${prospecto.id}:`, error.message);
      }
    }
  }

  static async ejecutarManual() {
    console.log('🔄 Ejecutando fallback de validación manualmente...');
    return this.ejecutar();
  }
}

module.exports = ValidacionFallbackJob;
