/**
 * Reconciliación puntual (una sola pasada) de estados de firma con VaFirma.
 * Cubre el backlog de pendientes/expirados que quedó sin sincronizar
 * al desactivar el polling periódico (server.js) a favor del webhook.
 *
 * Uso (desde backend/, con permisos para leer .env):
 *   sudo node scripts/reconciliar_firma_once.js
 */

const { sincronizarTodosPendientes } = require('../jobs/sincronizarEstadosFirmaJob');

sincronizarTodosPendientes()
  .then(() => {
    console.log('Reconciliación finalizada.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error en reconciliación:', error);
    process.exit(1);
  });
