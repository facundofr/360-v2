#!/usr/bin/env node

/**
 * Script para verificar el estado de una póliza en VaFirma
 * Uso: node verificar-estado-poliza.js <doc_uuid>
 * Ejemplo: node verificar-estado-poliza.js d5a3f15f-c23c-488a-9840-1966937984ec
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const vaFirmaService = require('../services/vaFirmaService');

async function verificarEstadoPoliza(docUUID) {
  try {
    console.log(`\n🔍 Buscando póliza con docUUID: ${docUUID}\n`);

    // 1️⃣ BUSCAR EN LA BASE DE DATOS
    const query = `
      SELECT 
        pve.id,
        pve.poliza_id,
        pve.doc_uuid,
        pve.estado_firma,
        pve.email_firmante,
        pve.requiere_biometria,
        pve.enviado_en,
        pve.firmado_en,
        pve.actualizado_en,
        pve.usuario_id,
        p.numero_poliza,
        p.estado as estado_poliza
      FROM polizas_vafirma_envios pve
      LEFT JOIN polizas p ON pve.poliza_id = p.id
      WHERE pve.doc_uuid = ?
      ORDER BY pve.enviado_en DESC
      LIMIT 1
    `;

    const [rows] = await db.query(query, [docUUID]);
    
    if (!rows || rows.length === 0) {
      console.error('❌ No se encontró registro con ese docUUID\n');
      process.exit(1);
    }

    const registro = rows[0];
    console.log('✅ INFORMACIÓN EN BASE DE DATOS:');
    console.log('─'.repeat(60));
    console.log(`  ID Registro:        ${registro.id}`);
    console.log(`  Póliza ID:          ${registro.poliza_id}`);
    console.log(`  Póliza Número:      ${registro.numero_poliza || 'N/A'}`);
    console.log(`  DocUUID:            ${registro.doc_uuid}`);
    console.log(`  Estado Actual:      ${registro.estado_firma}`);
    console.log(`  Estado Póliza:      ${registro.estado_poliza}`);
    console.log(`  Email Firmante:     ${registro.email_firmante}`);
    console.log(`  Requiere Biometría: ${registro.requiere_biometria ? 'Sí' : 'No'}`);
    console.log(`  Enviado En:         ${registro.enviado_en}`);
    console.log(`  Firmado En:         ${registro.firmado_en || 'Pendiente'}`);
    console.log(`  Actualizado En:     ${registro.actualizado_en}`);
    console.log(`  Usuario ID:         ${registro.usuario_id}`);
    console.log('─'.repeat(60));

    // 2️⃣ CONSULTAR ESTADO EN VAFIRMA
    console.log('\n🔄 Consultando estado en VaFirma...\n');
    
    const estadoVaFirma = await vaFirmaService.consultarEstado(docUUID);

    console.log('✅ RESPUESTA DE VAFIRMA:');
    console.log('─'.repeat(60));
    
    if (estadoVaFirma.success) {
      console.log(`  Success:  ${estadoVaFirma.success}`);
      console.log(`  Data:     ${JSON.stringify(estadoVaFirma.data, null, 2)}`);
      
      // Extraer y mapear el estado
      let estadoExtraido = null;
      if (typeof estadoVaFirma.data === 'string') {
        estadoExtraido = estadoVaFirma.data;
      } else if (estadoVaFirma.data?.status) {
        estadoExtraido = estadoVaFirma.data.status;
      } else if (estadoVaFirma.data?.state) {
        estadoExtraido = estadoVaFirma.data.state;
      } else if (estadoVaFirma.data?.estadoLocal) {
        estadoExtraido = estadoVaFirma.data.estadoLocal;
      }

      if (estadoExtraido) {
        const mapeo = {
          'SIGNED': 'signed', 'signed': 'signed', 'Signed': 'signed',
          'PENDING': 'pending', 'pending': 'pending', 'Pending': 'pending',
          'REJECTED': 'rejected', 'rejected': 'rejected', 'Rejected': 'rejected',
          'EXPIRED': 'expired', 'expired': 'expired', 'Expired': 'expired'
        };
        
        const estadoMapeado = mapeo[estadoExtraido] || estadoExtraido.toLowerCase();
        console.log(`\n  Estado Extraído:    ${estadoExtraido}`);
        console.log(`  Estado Mapeado:     ${estadoMapeado}`);
        console.log(`  BD Actual:          ${registro.estado_firma}`);
        
        // Verificar si hay diferencia
        if (estadoMapeado !== registro.estado_firma) {
          console.log(`\n  ⚠️  DIFERENCIA DETECTADA: BD=${registro.estado_firma}, VaFirma=${estadoMapeado}`);
          console.log(`  → Necesita actualización en BD`);
        } else {
          console.log(`\n  ✅ Estados sincronizados correctamente`);
        }
      }
    } else {
      console.log(`  Success:  false`);
      console.log(`  Error:    ${estadoVaFirma.error}`);
    }
    console.log('─'.repeat(60));

    // 3️⃣ RESUMEN Y RECOMENDACIONES
    console.log('\n📋 RESUMEN:');
    console.log('─'.repeat(60));
    
    if (registro.estado_firma === 'signed') {
      console.log('  ✅ Póliza FIRMADA (estado actual en BD)');
    } else if (registro.estado_firma === 'pending') {
      console.log('  ⏳ Póliza PENDIENTE (esperando firma)');
    } else if (registro.estado_firma === 'rejected') {
      console.log('  ❌ Póliza RECHAZADA');
    } else if (registro.estado_firma === 'expired') {
      console.log('  ⏰ Link EXPIRADO');
    } else {
      console.log(`  ❓ Estado desconocido: ${registro.estado_firma}`);
    }
    
    console.log('\n💡 PRÓXIMOS PASOS:');
    if (registro.estado_firma !== 'signed') {
      console.log('  1. Verifica que el usuario haya completado el proceso de firma en VaFirma');
      console.log('  2. Recarga la página en el navegador para ver actualizaciones');
      console.log('  3. Intenta enviar nuevamente si el link ha expirado');
    } else {
      console.log('  1. ✅ La póliza ya está firmada');
      console.log('  2. Puedes descargarla usando el botón "Descargar Firmada"');
    }
    console.log('─'.repeat(60) + '\n');

    await db.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
    await db.end();
    process.exit(1);
  }
}

// Obtener docUUID de argumentos
const docUUID = process.argv[2];

if (!docUUID) {
  console.log('❌ Uso: node verificar-estado-poliza.js <doc_uuid>');
  console.log('Ejemplo: node verificar-estado-poliza.js d5a3f15f-c23c-488a-9840-1966937984ec\n');
  process.exit(1);
}

verificarEstadoPoliza(docUUID);
