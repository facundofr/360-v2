#!/usr/bin/env node

/**
 * Script para actualizar manualmente el estado de una póliza en BD
 * Sincroniza el estado desde VaFirma a la BD
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const vaFirmaService = require('../services/vaFirmaService');

async function actualizarEstadoPoliza(docUUID, nuevoEstado = null) {
  try {
    console.log(`\n🔄 Sincronizando estado para docUUID: ${docUUID}\n`);

    // 1️⃣ OBTENER INFORMACIÓN ACTUAL
    const query = `
      SELECT 
        id,
        poliza_id,
        doc_uuid,
        estado_firma,
        enviado_en,
        firmado_en
      FROM polizas_vafirma_envios
      WHERE doc_uuid = ?
      LIMIT 1
    `;

    const [rows] = await db.query(query, [docUUID]);
    
    if (!rows || rows.length === 0) {
      console.error('❌ No se encontró registro con ese docUUID\n');
      await db.end();
      process.exit(1);
    }

    const registro = rows[0];
    console.log('📋 ESTADO ACTUAL EN BD:');
    console.log(`  Estado: ${registro.estado_firma}`);
    console.log(`  Firmado En: ${registro.firmado_en || 'Null'}`);

    // 2️⃣ DETERMINAR NUEVO ESTADO
    let estadoParaActualizar = nuevoEstado;
    
    if (!estadoParaActualizar) {
      console.log('\n🔍 Consultando estado actual en VaFirma...');
      const respuesta = await vaFirmaService.consultarEstado(docUUID);
      
      if (respuesta.success && respuesta.data) {
        // Extraer estado
        let estadoVaFirma = null;
        if (typeof respuesta.data === 'string') {
          estadoVaFirma = respuesta.data;
        } else if (respuesta.data.status) {
          estadoVaFirma = respuesta.data.status;
        } else if (respuesta.data.state) {
          estadoVaFirma = respuesta.data.state;
        }

        // Mapear estado
        const mapeo = {
          'SIGNED': 'signed', 'signed': 'signed', 'Signed': 'signed',
          'PENDING': 'pending', 'pending': 'pending', 'Pending': 'pending',
          'REJECTED': 'rejected', 'rejected': 'rejected', 'Rejected': 'rejected',
          'EXPIRED': 'expired', 'expired': 'expired', 'Expired': 'expired'
        };
        
        estadoParaActualizar = mapeo[estadoVaFirma] || estadoVaFirma.toLowerCase();
        console.log(`✅ Estado en VaFirma: ${estadoVaFirma} → ${estadoParaActualizar}`);
      } else {
        console.error('❌ Error consultando VaFirma:', respuesta.error);
        await db.end();
        process.exit(1);
      }
    }

    // 3️⃣ VERIFICAR SI HAY CAMBIO
    if (estadoParaActualizar === registro.estado_firma) {
      console.log(`\n✅ El estado ya es "${estadoParaActualizar}", no requiere actualización\n`);
      await db.end();
      process.exit(0);
    }

    // 4️⃣ ACTUALIZAR EN BD
    console.log(`\n⚡ ACTUALIZANDO BD...`);
    console.log(`  ${registro.estado_firma} → ${estadoParaActualizar}`);

    const updateQuery = `
      UPDATE polizas_vafirma_envios 
      SET estado_firma = ?, 
          actualizado_en = NOW(),
          firmado_en = CASE WHEN ? = 'signed' THEN NOW() ELSE firmado_en END
      WHERE id = ?
    `;

    const [result] = await db.query(updateQuery, [estadoParaActualizar, estadoParaActualizar, registro.id]);

    if (result.affectedRows > 0) {
      console.log(`\n✅ BD ACTUALIZADA EXITOSAMENTE`);
      console.log(`  Registros afectados: ${result.affectedRows}`);
      console.log(`  Nuevo estado: ${estadoParaActualizar}`);
      
      if (estadoParaActualizar === 'signed') {
        console.log(`  Fecha de firma: NOW()`);
      }
    } else {
      console.log(`\n⚠️  No se realizó ningún cambio`);
    }

    // 5️⃣ VERIFICAR CAMBIO
    const [verificar] = await db.query('SELECT estado_firma, firmado_en FROM polizas_vafirma_envios WHERE id = ?', [registro.id]);
    if (verificar && verificar.length > 0) {
      console.log(`\n📊 VERIFICACIÓN FINAL:`);
      console.log(`  Estado actual: ${verificar[0].estado_firma}`);
      console.log(`  Firmado en: ${verificar[0].firmado_en || 'Null'}`);
    }

    console.log('\n─'.repeat(60));
    if (estadoParaActualizar === 'signed') {
      console.log('🎉 ¡La póliza ya puede ser descargada!');
    } else if (estadoParaActualizar === 'rejected') {
      console.log('❌ La póliza fue rechazada');
    } else if (estadoParaActualizar === 'expired') {
      console.log('⏰ El link de firma expiró');
    }
    console.log('─'.repeat(60) + '\n');

    await db.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    await db.end();
    process.exit(1);
  }
}

// Argumentos: doc_uuid [nuevo_estado]
const docUUID = process.argv[2];
const nuevoEstado = process.argv[3];

if (!docUUID) {
  console.log('\n❌ Uso: node actualizar-estado-poliza.js <doc_uuid> [nuevo_estado]');
  console.log('\nEjemplos:');
  console.log('  # Sincronizar desde VaFirma (automático):');
  console.log('  node actualizar-estado-poliza.js d5a3f15f-c23c-488a-9840-1966937984ec');
  console.log('\n  # Actualizar manualmente a un estado específico:');
  console.log('  node actualizar-estado-poliza.js d5a3f15f-c23c-488a-9840-1966937984ec signed');
  console.log('  node actualizar-estado-poliza.js d5a3f15f-c23c-488a-9840-1966937984ec rejected');
  console.log('  node actualizar-estado-poliza.js d5a3f15f-c23c-488a-9840-1966937984ec expired\n');
  process.exit(1);
}

actualizarEstadoPoliza(docUUID, nuevoEstado);
