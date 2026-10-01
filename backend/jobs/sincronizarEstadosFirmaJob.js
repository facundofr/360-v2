/**
 * Job: Sincronizar estados de firma pendientes con VaFirma
 * Fallback del webhook en tiempo real (websocket): el webhook es la vía
 * principal de actualización, este polling solo cubre casos donde el
 * webhook no llegó (caída puntual, reintento fallido, etc).
 */

const db = require('../config/db');
const vaFirmaService = require('../services/vaFirmaService');

const INTERVALO_MINUTOS = parseInt(process.env.VAFIRMA_SYNC_INTERVAL || '20'); // Fallback: cada 20 minutos por defecto
const HABILITADO = process.env.VAFIRMA_SYNC_ENABLED !== 'false'; // Habilitado por defecto
const MAX_REINTENTOS = 3;
const TIMEOUT_MS = 30000; // 30 segundos por consulta a VaFirma
const VENTANA_DIAS = parseInt(process.env.VAFIRMA_SYNC_VENTANA_DIAS || '7'); // Solo priorizar envíos de la última semana

let syncEnProgreso = false;

/**
 * Sincronizar un docUUID específico con VaFirma
 */
async function sincronizarDocUUID(docUUID, polizaId, intento = 1) {
  try {
    console.log(`  📋 Sincronizando docUUID: ${docUUID} (póliza ${polizaId}, intento ${intento}/${MAX_REINTENTOS})`);

    // Consultar estado en VaFirma con timeout
    const promiseEstado = vaFirmaService.consultarEstado(docUUID);
    const promiseTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout consultando VaFirma')), TIMEOUT_MS)
    );

    const estado = await Promise.race([promiseEstado, promiseTimeout]);

    if (!estado.success) {
      console.warn(`    ⚠️  Error consultando VaFirma: ${estado.error}`);
      if (intento < MAX_REINTENTOS) {
        // Reintentar después de 2 segundos
        await new Promise(r => setTimeout(r, 2000));
        return sincronizarDocUUID(docUUID, polizaId, intento + 1);
      }
      return { sincronizado: false, razon: estado.error };
    }

    // Extraer estado de VaFirma (puede estar en diferentes campos)
    let estadoVaFirma = null;
    const data = estado.data;

    if (typeof data === 'string') {
      estadoVaFirma = data;
    } else if (data?.status) {
      estadoVaFirma = data.status;
    } else if (data?.state) {
      estadoVaFirma = data.state;
    } else if (data?.estadoLocal) {
      estadoVaFirma = data.estadoLocal;
    }

    // Mapeo de estados VaFirma a nuestro format
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

    if (!estadoNormalizado) {
      console.warn(`    ⚠️  No se pudo normalizar estado: ${estadoVaFirma}`);
      return { sincronizado: false, razon: 'Estado no reconocido' };
    }

    console.log(`    ✅ Estado en VaFirma: ${estadoVaFirma} → ${estadoNormalizado}`);

    // Actualizar BD si el estado cambió
    const updateQuery = `
      UPDATE polizas_vafirma_envios
      SET estado_firma = ?,
          actualizado_en = NOW(),
          firmado_en = CASE WHEN ? = 'signed' THEN COALESCE(firmado_en, NOW()) ELSE firmado_en END
      WHERE doc_uuid = ? AND estado_firma != ?
    `;

    const [result] = await db.execute(updateQuery, [estadoNormalizado, estadoNormalizado, docUUID, estadoNormalizado]);

    if (result.affectedRows > 0) {
      console.log(`    ✅ Actualizado en BD: poliza ${polizaId}, nuevo estado: ${estadoNormalizado}`);
      return { sincronizado: true, estadoAnterior: 'pending', estadoNuevo: estadoNormalizado };
    } else {
      console.log(`    ℹ️  Estado ya era ${estadoNormalizado}, no hay cambios`);
      return { sincronizado: true, cambio: false };
    }

  } catch (error) {
    console.error(`    ❌ Error sincronizando ${docUUID}:`, error.message);
    if (intento < MAX_REINTENTOS) {
      await new Promise(r => setTimeout(r, 2000));
      return sincronizarDocUUID(docUUID, polizaId, intento + 1);
    }
    return { sincronizado: false, razon: error.message };
  }
}

/**
 * Función principal: sincronizar TODOS los pendientes
 */
async function sincronizarTodosPendientes() {
  if (syncEnProgreso) {
    console.log('[VaFirma Sync] ⏸️  Sincronización anterior aún en progreso, saltando...');
    return;
  }

  syncEnProgreso = true;
  const startTime = Date.now();

  try {
    console.log(`\n[VaFirma Sync] 🔄 Iniciando sincronización de estados pendientes (ventana: últimos ${VENTANA_DIAS} días)...`);

    // Obtener pendientes, priorizando siempre los últimos VENTANA_DIAS días
    // (evita que envíos recientes queden sin sincronizar detrás de un backlog de pendientes viejos)
    const queryPendientes = `
      SELECT id, poliza_id, doc_uuid, estado_firma
      FROM polizas_vafirma_envios
      WHERE TRIM(LOWER(estado_firma)) IN ('pending')
        AND enviado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY enviado_en ASC
      LIMIT 100
    `;

    // También obtener expired de pólizas que NO tienen ningún envío signed ni pending
    // (puede que el cliente firmó el doc antes de que se reenvíe)
    const queryExpiredSinFirmar = `
      SELECT id, poliza_id, doc_uuid, estado_firma
      FROM polizas_vafirma_envios pve
      WHERE TRIM(LOWER(estado_firma)) = 'expired'
        AND enviado_en >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND NOT EXISTS (
          SELECT 1 FROM polizas_vafirma_envios pve2
          WHERE pve2.poliza_id = pve.poliza_id
            AND TRIM(LOWER(pve2.estado_firma)) IN ('signed','firmado','completed')
        )
      ORDER BY enviado_en ASC
      LIMIT 50
    `;

    const [pendientes] = await db.execute(queryPendientes, [VENTANA_DIAS]);
    const [expiredSinFirmar] = await db.execute(queryExpiredSinFirmar, [VENTANA_DIAS]);
    const [[{ totalPendientesSinVentana }]] = await db.execute(
      `SELECT COUNT(*) AS totalPendientesSinVentana FROM polizas_vafirma_envios WHERE TRIM(LOWER(estado_firma)) IN ('pending')`
    );

    if ((!pendientes || pendientes.length === 0) && (!expiredSinFirmar || expiredSinFirmar.length === 0)) {
      console.log('[VaFirma Sync] ℹ️  No hay envíos pendientes para sincronizar dentro de la ventana');
      if (totalPendientesSinVentana > 0) {
        console.warn(`[VaFirma Sync] ⚠️  Hay ${totalPendientesSinVentana} pendientes de más de ${VENTANA_DIAS} días fuera de la ventana, sin sincronizar`);
      }
      syncEnProgreso = false;
      return;
    }

    console.log(`[VaFirma Sync] 📋 Encontrados ${pendientes.length} envíos pendientes dentro de la ventana`);
    const fueraDeVentana = totalPendientesSinVentana - pendientes.length;
    if (fueraDeVentana > 0) {
      console.warn(`[VaFirma Sync] ⚠️  ${fueraDeVentana} pendientes de más de ${VENTANA_DIAS} días quedan fuera de la ventana, sin sincronizar`);
    }
    if (expiredSinFirmar.length > 0) {
      console.log(`[VaFirma Sync] 🔍 Verificando ${expiredSinFirmar.length} envíos expirados (por si fueron firmados)`);
    }

    let sincronizados = 0;
    let actualizados = 0;
    let errores = 0;

    // Sincronizar en secuencia (no paralelo para evitar overload VaFirma)
    for (const pendiente of pendientes) {
      const resultado = await sincronizarDocUUID(pendiente.doc_uuid, pendiente.poliza_id);

      sincronizados++;

      if (resultado.sincronizado) {
        if (resultado.cambio !== false) {
          actualizados++;
        }
      } else {
        errores++;
        console.warn(`    ⚠️  Fallo: ${pendiente.doc_uuid} - ${resultado.razon}`);
      }

      // Pequeña pausa entre consultas
      await new Promise(r => setTimeout(r, 500));
    }

    // Verificar expired que pudieron haber sido firmados antes del reenvío
    for (const expirado of expiredSinFirmar) {
      const resultado = await sincronizarDocUUID(expirado.doc_uuid, expirado.poliza_id);

      sincronizados++;

      if (resultado.sincronizado) {
        if (resultado.cambio !== false && resultado.estadoNuevo === 'signed') {
          actualizados++;
          console.log(`    ✅ Expirado que resultó firmado: poliza ${expirado.poliza_id}`);
        }
      } else {
        errores++;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const duracion = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[VaFirma Sync] ✅ Sincronización completada en ${duracion}s`);
    console.log(`[VaFirma Sync]    - Procesados: ${sincronizados}`);
    console.log(`[VaFirma Sync]    - Actualizados: ${actualizados}`);
    console.log(`[VaFirma Sync]    - Errores: ${errores}\n`);

  } catch (error) {
    console.error('[VaFirma Sync] ❌ Error general en sincronización:', error.message);
  } finally {
    syncEnProgreso = false;
  }
}

/**
 * Iniciar el job con cron
 */
function iniciarJob() {
  if (!HABILITADO) {
    console.log('[VaFirma Sync] ⏹️  Sincronización deshabilitada (VAFIRMA_SYNC_ENABLED=false)');
    return null;
  }

  console.log(`[VaFirma Sync] ⏱️  Job iniciado - Sincronizará cada ${INTERVALO_MINUTOS} minuto(s)`);
  console.log(`[VaFirma Sync] 📝 Variables de entorno:`);
  console.log(`[VaFirma Sync]    - VAFIRMA_SYNC_ENABLED: ${HABILITADO}`);
  console.log(`[VaFirma Sync]    - VAFIRMA_SYNC_INTERVAL: ${INTERVALO_MINUTOS} minutos`);

  // Ejecutar inmediatamente al iniciar
  sincronizarTodosPendientes();

  // Luego repetir cada INTERVALO_MINUTOS
  const intervalId = setInterval(sincronizarTodosPendientes, INTERVALO_MINUTOS * 60 * 1000);

  return intervalId;
}

module.exports = {
  iniciarJob,
  sincronizarTodosPendientes,
  sincronizarDocUUID
};
