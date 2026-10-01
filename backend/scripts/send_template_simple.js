#!/usr/bin/env node

/**
 * Script simple para enviar template de WhatsApp
 * Uso: node scripts/send_template_simple.js
 */

require('dotenv').config();
const twilio = require('twilio');

// Configuración
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Template y números específicos para tu prueba
const TEMPLATE_SID = 'HXe46b973a1db69ce4bce764e9af322348';
const NUMEROS = [
  '1151773516',
  '1125315884', 
  '1135725178',
  '2974039623',
  '1166722613',
  '1155965549',
  '1138935664'
];

// Variables para el template
// Nota: "Hola bienvenido a Cober!" parece ser un template sin variables
const VARIABLES = {};

async function enviarTemplate() {
  console.log('🚀 Iniciando envío de template WhatsApp...');
  
  if (!ACCOUNT_SID || !AUTH_TOKEN || !WHATSAPP_NUMBER) {
    console.error('❌ Faltan credenciales de Twilio en las variables de entorno');
    return;
  }

  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  
  console.log(`📋 Template: ${TEMPLATE_SID} - "Hola bienvenido a Cober!"`);
  console.log(`📱 Desde: ${WHATSAPP_NUMBER}`);
  console.log(`📞 A ${NUMEROS.length} números`);
  if (Object.keys(VARIABLES).length > 0) {
    console.log(`📝 Variables:`, VARIABLES);
  } else {
    console.log(`📝 Template sin variables (mensaje fijo)`);
  }
  console.log('-'.repeat(50));

  for (let i = 0; i < NUMEROS.length; i++) {
    const numero = NUMEROS[i];
    const numeroFormateado = `+549${numero}`;
    
    try {
      console.log(`\n[${i + 1}/${NUMEROS.length}] Enviando a ${numero}...`);
      
      const message = await client.messages.create({
        from: `whatsapp:${WHATSAPP_NUMBER}`,
        to: `whatsapp:${numeroFormateado}`,
        contentSid: TEMPLATE_SID,
        // Solo incluir contentVariables si hay variables
        ...(Object.keys(VARIABLES).length > 0 && {
          contentVariables: JSON.stringify(VARIABLES)
        })
      });

      console.log(`✅ Enviado - SID: ${message.sid}`);
      
    } catch (error) {
      console.error(`❌ Error para ${numero}:`, error.message);
    }
    
    // Pausa entre envíos
    if (i < NUMEROS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n🏁 Envío completado');
}

// Ejecutar
enviarTemplate().catch(console.error);
