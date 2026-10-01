const cron = require('node-cron');
const NutricionLeadsService = require('../services/nutricionLeadsService');

class NutricionLeadsJob {
  static iniciar() {
    // Cada 15 min, igual cadencia que ValidacionFallbackJob — msg 1 sale
    // inmediato (fuera del cron, en iniciarNutricion), esto cubre 2, 3 y 4.
    const job = cron.schedule('*/15 * * * *', async () => {
      try {
        await NutricionLeadsService.procesarPendientes();
      } catch (error) {
        console.error('❌ Error en job de nutrición de leads:', error);
      }
    });

    console.log('✅ Job de nutrición de leads iniciado (cada 15 min)');
    return job;
  }

  static async ejecutarManual() {
    console.log('🔄 Ejecutando nutrición de leads manualmente...');
    return NutricionLeadsService.procesarPendientes();
  }
}

module.exports = NutricionLeadsJob;
