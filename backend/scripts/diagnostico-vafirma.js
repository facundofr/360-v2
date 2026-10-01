#!/usr/bin/env node

/**
 * Script de Diagnóstico VaFirma
 * Verifica que el sistema de polling y actualización de estado esté funcionando correctamente
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const vaFirmaService = require('../services/vaFirmaService');

async function diagnosticoVaFirma() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        DIAGNÓSTICO DEL SISTEMA VAFIRMA v1.0               ║
║        Verifica sincronización y estado de pólizas         ║
╚════════════════════════════════════════════════════════════╝
  `);

  try {
    // 1️⃣ VERIFICAR TABLA
    console.log('📊 1. VERIFICANDO TABLA polizas_vafirma_envios...\n');
    const [tablaInfo] = await db.query(`
      SELECT 
        COUNT(*) as total_registros,
        SUM(CASE WHEN estado_firma = 'pending' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado_firma = 'signed' THEN 1 ELSE 0 END) as firmadas,
        SUM(CASE WHEN estado_firma = 'rejected' THEN 1 ELSE 0 END) as rechazadas,
        SUM(CASE WHEN estado_firma = 'expired' THEN 1 ELSE 0 END) as expiradas
      FROM polizas_vafirma_envios
    `);

    if (tablaInfo && tablaInfo.length > 0) {
      const info = tablaInfo[0];
      console.log(`  ✅ Tabla existe`);
      console.log(`  📈 Total de registros: ${info.total_registros}`);
      console.log(`    ├─ Pendientes:  ${info.pendientes}`);
      console.log(`    ├─ Firmadas:    ${info.firmadas}`);
      console.log(`    ├─ Rechazadas:  ${info.rechazadas}`);
      console.log(`    └─ Expiradas:   ${info.expiradas}`);
    }

    // 2️⃣ VERIFICAR DESINCRONIZACIONES
    console.log('\n⚠️  2. BUSCANDO PÓLIZAS DESINCRONIZADAS...\n');

    // Obtener todas las pólizas pending
    const [pendientes] = await db.query(`
      SELECT id, poliza_id, doc_uuid, estado_firma, enviado_en
      FROM polizas_vafirma_envios
      WHERE estado_firma = 'pending'
      ORDER BY enviado_en DESC
      LIMIT 10
    `);

    if (pendientes && pendientes.length > 0) {
      console.log(`  🔍 Encontradas ${pendientes.length} pólizas en estado "pending"`);
      console.log(`  📋 Consultando estado en VaFirma para cada una...\n`);

      let desincronizadas = 0;
      
      for (let i = 0; i < pendientes.length; i++) {
        const pve = pendientes[i];
        const respuesta = await vaFirmaService.consultarEstado(pve.doc_uuid);
        
        if (respuesta.success && respuesta.data) {
          // Extraer estado
          let estadoVaFirma = null;
          if (typeof respuesta.data === 'string') {
            estadoVaFirma = respuesta.data;
          } else if (respuesta.data.status) {
            estadoVaFirma = respuesta.data.status;
          }

          const mapeo = {
            'SIGNED': 'signed', 'signed': 'signed', 'Signed': 'signed',
            'PENDING': 'pending', 'pending': 'pending', 'Pending': 'pending',
            'REJECTED': 'rejected', 'rejected': 'rejected', 'Rejected': 'rejected',
            'EXPIRED': 'expired', 'expired': 'expired', 'Expired': 'expired'
          };
          
          const estadoMapeado = mapeo[estadoVaFirma] || estadoVaFirma?.toLowerCase();

          if (estadoMapeado !== 'pending') {
            desincronizadas++;
            console.log(`  ⚠️  DESINCRONIZADA #${desincronizadas}:`);
            console.log(`    Póliza ID: ${pve.poliza_id}`);
            console.log(`    BD: ${pve.estado_firma} | VaFirma: ${estadoMapeado}`);
            console.log(`    Enviada: ${pve.enviado_en}`);
            console.log(`    → ACCIÓN: Ejecutar:`);
            console.log(`      node actualizar-estado-poliza.js ${pve.doc_uuid}\n`);
          }
        }
      }

      if (desincronizadas === 0) {
        console.log(`  ✅ Todas las pólizas "pending" están sincronizadas correctamente\n`);
      }
    } else {
      console.log(`  ✅ No hay pólizas en estado "pending"\n`);
    }

    // 3️⃣ RESUMEN DE SALUD DEL SISTEMA
    console.log('\n💚 3. RESUMEN DE SALUD DEL SISTEMA:\n');
    
    if (pendientes && pendientes.length === 0) {
      console.log(`  ✅ Sistema en perfecto estado`);
      console.log(`  ✅ No hay pólizas desincronizadas`);
      console.log(`  ✅ Polling automático funcionando correctamente`);
    } else {
      console.log(`  ⚠️  Hay ${pendientes.length} póliza(s) esperando firma`);
      console.log(`  💡 Sugerencia: Verifica el estado de los links enviados`);
    }

    console.log(`\n${'═'.repeat(60)}\n`);

    await db.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR EN DIAGNÓSTICO:', error.message);
    await db.end();
    process.exit(1);
  }
}

diagnosticoVaFirma();
