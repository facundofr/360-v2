#!/usr/bin/env node

/**
 * Script para enviar mensaje de prueba con template a números específicos
 * Uso: node scripts/test_whatsapp_template.js
 */

require('dotenv').config();
const whatsappService = require('../services/whatsappService');

// Template SID que quieres probar
const TEMPLATE_SID = 'HXe46b973a1db69ce4bce764e9af322348';

// Lista de números de teléfono para enviar el mensaje de prueba
const NUMEROS_PRUEBA = [
  '1151773516',
  '1125315884', 
  '1135725178',
  '2974039623',
  '1166722613',
  '1155965549', // Corregido: removido el espacio
  '1138935664'
];

// Variables de ejemplo para el template
// Nota: El template "Hola bienvenido a Cober!" parece ser simple sin variables
// Si no tiene variables, usar objeto vacío
const VARIABLES_TEMPLATE = {};

/**
 * Función para enviar mensaje a un número específico
 */
async function enviarMensajePrueba(telefono, index, total) {
  try {
    console.log(`\n📱 [${index + 1}/${total}] Enviando a: ${telefono}`);
    
    const resultado = await whatsappService.client.messages.create({
      from: `whatsapp:${whatsappService.whatsappNumber}`,
      to: `whatsapp:+549${telefono}`, // Formato argentino
      contentSid: TEMPLATE_SID,
      // Solo incluir contentVariables si hay variables
      ...(Object.keys(VARIABLES_TEMPLATE).length > 0 && {
        contentVariables: JSON.stringify(VARIABLES_TEMPLATE)
      })
    });

    console.log(`✅ Enviado exitosamente`);
    console.log(`   SID: ${resultado.sid}`);
    console.log(`   Status: ${resultado.status}`);
    
    return {
      telefono,
      success: true,
      sid: resultado.sid,
      status: resultado.status
    };
    
  } catch (error) {
    console.error(`❌ Error enviando a ${telefono}:`, error.message);
    
    // Mostrar detalles específicos del error
    if (error.code) {
      console.error(`   Código de error: ${error.code}`);
    }
    
    return {
      telefono,
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Función principal del script
 */
async function main() {
  console.log('🚀 Iniciando script de prueba de WhatsApp Template');
  console.log('=' .repeat(60));
  console.log(`📋 Template SID: ${TEMPLATE_SID}`);
  console.log(`📱 WhatsApp Business: ${whatsappService.whatsappNumber}`);
  console.log(`📞 Números a contactar: ${NUMEROS_PRUEBA.length}`);
  console.log('=' .repeat(60));

  // Verificar que el servicio esté configurado
  if (!whatsappService.isServiceAvailable()) {
    console.error('❌ Servicio de WhatsApp no está configurado correctamente');
    console.error('   Verifica las variables de entorno TWILIO_*');
    process.exit(1);
  }

  // Mostrar variables del template
  console.log('\n📝 Template: "Hola bienvenido a Cober!"');
  if (Object.keys(VARIABLES_TEMPLATE).length > 0) {
    console.log('Variables del template:');
    Object.entries(VARIABLES_TEMPLATE).forEach(([key, value]) => {
      console.log(`   {{${key}}}: ${value}`);
    });
  } else {
    console.log('Template sin variables (mensaje fijo)');
  }

  // Confirmar antes de enviar
  console.log('\n⚠️  ¿Continuar con el envío? (Ctrl+C para cancelar)');
  await new Promise(resolve => {
    setTimeout(resolve, 3000); // Pausa de 3 segundos
  });

  const resultados = [];
  let exitosos = 0;
  let fallidos = 0;

  // Enviar mensajes con delays para evitar rate limiting
  for (let i = 0; i < NUMEROS_PRUEBA.length; i++) {
    const telefono = NUMEROS_PRUEBA[i];
    
    const resultado = await enviarMensajePrueba(telefono, i, NUMEROS_PRUEBA.length);
    resultados.push(resultado);
    
    if (resultado.success) {
      exitosos++;
    } else {
      fallidos++;
    }
    
    // Delay de 2 segundos entre envíos para evitar rate limiting
    if (i < NUMEROS_PRUEBA.length - 1) {
      console.log('   ⏳ Esperando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Mostrar resumen final
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMEN DE ENVÍOS');
  console.log('=' .repeat(60));
  console.log(`✅ Exitosos: ${exitosos}`);
  console.log(`❌ Fallidos: ${fallidos}`);
  console.log(`📱 Total: ${resultados.length}`);

  // Mostrar detalles de envíos fallidos
  const fallidos_detalle = resultados.filter(r => !r.success);
  if (fallidos_detalle.length > 0) {
    console.log('\n❌ ENVÍOS FALLIDOS:');
    fallidos_detalle.forEach(r => {
      console.log(`   ${r.telefono}: ${r.error} ${r.code ? `(${r.code})` : ''}`);
    });
  }

  // Mostrar envíos exitosos
  const exitosos_detalle = resultados.filter(r => r.success);
  if (exitosos_detalle.length > 0) {
    console.log('\n✅ ENVÍOS EXITOSOS:');
    exitosos_detalle.forEach(r => {
      console.log(`   ${r.telefono}: ${r.sid}`);
    });
  }

  console.log('\n🏁 Script completado');
  process.exit(exitosos > 0 ? 0 : 1);
}

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Script cancelado por el usuario');
  process.exit(1);
});

// Ejecutar el script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { main, enviarMensajePrueba };
