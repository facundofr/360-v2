const cron = require('node-cron');
const { ejecutarBackup } = require('../services/googleDriveBackupService');

class GoogleDriveBackupJob {
  static iniciar() {
    // Ejecutar todos los días a las 20:00 hora Argentina (el servidor está en UTC-3)
    const job = cron.schedule('0 20 * * *', async () => {
      console.log('🔔 CRON TRIGGER - Iniciando backup diario a Google Drive');
      console.log(`   Hora: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
      try {
        await ejecutarBackup();
      } catch (error) {
        console.error('❌ Error en job de backup Google Drive:', error);
      }
    });

    console.log('✅ Job de backup a Google Drive programado (diario 20:00 ARG)');
    return job;
  }
}

module.exports = GoogleDriveBackupJob;
