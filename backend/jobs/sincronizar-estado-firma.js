/**
 * Job: Sincronizar estado de firmas pendientes con VaFirma
 * Ejecuta cada 5 minutos y busca docUUIDs en estado 'pending'
 * para consultar VaFirma y actualizar a 'signed' si corresponde
 */

const db = require('../config/db');
const vaFirmaService = require('../services/vaFirmaService');

const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

async function sincronizarEstadosFirma() {
  try {
    console.log('🔄 [Sync Firma] Iniciando sincronización de estados pendientes con VaFirma...');

    // Obtener todos los pendientes en los últimos 7 días (evitar sincronizar antiguos para siempre)
    const [pendientes] = await db.query(`
      SELECT id, poliza_id, doc_uuid, estado_firma, enviado_en
      FROM polizas_vafirma_envios
      WHERE estado_firma = 'pending'
        AND enviado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY enviado_en DESC
      LIMIT 50
    `);

    if (!pendientes || pendientes.length === 0) {
      console.log('✅ [Sync Firma] Sin pendientes para sincronizar');
      return;
    }

    console.log(`📋 [Sync Firma] Encontrados ${pendientes.length} registros pendientes. Consultando VaFirma...`);

    let actualizados = 0;
    let errores = 0;

    for (const pve of pendientes) {
      try {
        const { id, poliza_id, doc_uuid, enviado_en } = pve;

        // Consultar estado en VaFirma
        const respuesta = await vaFirmaService.consultarEstado(doc_uuid);

        if (!respuesta.success) {
          console.warn(`⚠️  [Sync Firma] Error consultando VaFirma para docUUID ${doc_uuid}: ${respuesta.error}`);
          errores++;
          continue;
        }

        // Extraer estado
        let estadoVaFirma = null;
        const data = respuesta.data;

        if (typeof data === 'string') {
          estadoVaFirma = data;
        } else if (data?.status) {
          estadoVaFirma = data.status;
        } else if (data?.state) {
          estadoVaFirma = data.state;
        } else if (data?.estadoLocal) {
          estadoVaFirma = data.estadoLocal;
        }

        // Normalizar estado
        const mapeo = {
          'SIGNED': 'signed',
          'signed': 'signed',
          'Signed': 'signed',
          'firmado': 'signed',
          'FIRMADO': 'signed',
          'completed': 'signed',
          'COMPLETED': 'signed',
          'completado': 'signed',
          'COMPLETADO': 'signed',
          'PENDING': 'pending',
          'pending': 'pending',
          'Pending': 'pending',
          'REJECTED': 'rejected',
          'rejected': 'rejected',
          'Rejected': 'rejected',
          'EXPIRED': 'expired',
          'expired': 'expired',
          'Expired': 'expired'
        };

        const estadoNormalizado = mapeo[estadoVaFirma] || (estadoVaFirma ? estadoVaFirma.toLowerCase().trim() : null);

        // Si cambió de pending a signed/rejected/expired, actualizar
        if (estadoNormalizado && estadoNormalizado !== 'pending') {
          const [updateResult] = await db.query(`
            UPDATE polizas_vafirma_envios
            SET estado_firma = ?,
                actualizado_en = NOW(),
                firmado_en = CASE WHEN ? = 'signed' THEN NOW() ELSE firmado_en END
            WHERE id = ?
          `, [estadoNormalizado, estadoNormalizado, id]);

          if (updateResult.affectedRows > 0) {
            console.log(`✅ [Sync Firma] Actualizado: póliza ${poliza_id}, docUUID ${doc_uuid} → ${estadoNormalizado}`);
            actualizados++;
          }
        } else {
          console.log(`⏸️  [Sync Firma] Sin cambio: póliza ${poliza_id}, docUUID ${doc_uuid} sigue ${estadoNormalizado}`);
        }
      } catch (itemErr) {
        console.error(`❌ [Sync Firma] Error procesando ${pve.doc_uuid}:`, itemErr.message);
        errores++;
      }

      // Pequeña pausa entre consultas a VaFirma
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`📊 [Sync Firma] Sincronización completada: ${actualizados} actualizados, ${errores} errores`);
  } catch (error) {
    console.error('❌ [Sync Firma] Error crítico en sincronización:', error);
  }
}

// Ejecutar cada 5 minutos
let jobActive = true;

function iniciarJob() {
  console.log('🚀 [Sync Firma] Job iniciado. Se sincronizará cada 5 minutos.');

  // Ejecutar inmediatamente la primera vez
  sincronizarEstadosFirma();

  // Luego cada 5 minutos
  setInterval(() => {
    if (jobActive) {
      sincronizarEstadosFirma();
    }
  }, INTERVALO_MS);
}

function detenerJob() {
  jobActive = false;
  console.log('⛔ [Sync Firma] Job detenido.');
}

// Exportar para PM2
module.exports = {
  iniciarJob,
  detenerJob,
  sincronizarEstadosFirma
};

// Si se ejecuta directamente (node sincronizar-estado-firma.js)
if (require.main === module) {
  iniciarJob();
  process.on('SIGTERM', () => {
    detenerJob();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    detenerJob();
    process.exit(0);
  });
}
