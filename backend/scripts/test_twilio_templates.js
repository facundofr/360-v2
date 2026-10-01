/**
 * Script de diagnóstico para plantillas de Twilio/WhatsApp
 * Uso: node backend/scripts/test_twilio_templates.js [numero_destino]
 * Ejemplo: node backend/scripts/test_twilio_templates.js 1138935664
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const twilio = require('twilio');

const ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER   = process.env.TWILIO_WHATSAPP_NUMBER;

// SIDs hardcodeadas en whatsappService.js (COTIZACION actualizado al SID vigente)
const KNOWN_TEMPLATES = {
  COTIZACION   : 'HX70d33e4bd86cc9704ff51ffe5ee21c35',
  POLIZA       : 'HX8fb1275dfade61ec754f6f1879954140',
  INICIO       : 'HX7c5d36e1b72e30d011422151bd8f954a',
  SALUDO_INICIAL: 'HX33558d1b6ee3b18c06658db13068a6e3',
};

// Número de prueba recibido por argumento (prefijo AR) o fallback
const rawDest = process.argv[2] || '1138935664';
const destino = rawDest.replace(/[^0-9]/g, '');
const destE164 = destino.startsWith('54')
  ? `+${destino}`
  : `+549${destino}`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function statusIcon(approval) {
  if (!approval) return '❓';
  switch (approval.toLowerCase()) {
    case 'approved': return '✅';
    case 'pending':  return '⏳';
    case 'rejected': return '❌';
    default:         return '❓';
  }
}

function banner(text) {
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

// ─────────────────────────────────────────────
// 1. Listar TODAS las Content Templates
// ─────────────────────────────────────────────
async function listarTemplates(client) {
  banner('📋 PLANTILLAS EN LA CUENTA TWILIO');

  let templates;
  try {
    templates = await client.content.v1.contents.list({ limit: 50 });
  } catch (err) {
    console.error('❌ No se pudieron obtener las plantillas:', err.message);
    return [];
  }

  if (!templates.length) {
    console.log('⚠️  No se encontraron plantillas en la cuenta.');
    return [];
  }

  const knownSids = new Set(Object.values(KNOWN_TEMPLATES));

  for (const t of templates) {
    const used = knownSids.has(t.sid) ? ' ← USADO EN CÓDIGO' : '';
    const approval = t.approvalRequests?.status;
    console.log(`\n  SID  : ${t.sid}${used}`);
    console.log(`  Nombre: ${t.friendlyName}`);
    console.log(`  Estado: ${statusIcon(approval)} ${approval || 'sin estado'}`);
    console.log(`  Variables: ${JSON.stringify(t.variables || {})}`);
    if (t.types) {
      const bodyKey = Object.keys(t.types)[0];
      const bodyVal = bodyKey ? t.types[bodyKey] : null;
      if (bodyVal?.body) console.log(`  Body preview: ${String(bodyVal.body).substring(0, 120)}`);
    }
  }

  // Verificar si los SIDs del código siguen existiendo
  banner('🔍 REVISIÓN DE SIDS USADOS EN CÓDIGO');
  const existingSids = new Set(templates.map(t => t.sid));
  for (const [nombre, sid] of Object.entries(KNOWN_TEMPLATES)) {
    const found = existingSids.has(sid);
    const tpl   = templates.find(t => t.sid === sid);
    const approval = tpl?.approvalRequests?.status;
    console.log(`  ${statusIcon(found ? approval : null)} ${nombre.padEnd(16)} ${sid}  ${found ? approval || 'sin estado' : '⛔ NO ENCONTRADO'}`);
  }

  return templates;
}

// ─────────────────────────────────────────────
// 2. Probar envío con la plantilla COTIZACIÓN
// ─────────────────────────────────────────────
async function testCotizacion(client) {
  banner(`📤 TEST ENVÍO – COTIZACIÓN → ${destE164}`);

  // Variables de ejemplo (sin nulls ni vacíos)
  const variables = {
    "1": "Juan Perez",
    "2": "Plan Básico",
    "3": "2 personas",
    "4": "Particular",
    "5": "$ 12.500,00",
    "6": "$ 1.250,00",
    "7": "$ 0,00",
    "8": "$ 11.250,00"
  };

  console.log('  contentVariables:', JSON.stringify(variables));
  console.log('  contentSid      :', KNOWN_TEMPLATES.COTIZACION);

  try {
    const msg = await client.messages.create({
      from: `whatsapp:${FROM_NUMBER}`,
      to  : `whatsapp:${destE164}`,
      contentSid      : KNOWN_TEMPLATES.COTIZACION,
      contentVariables: JSON.stringify(variables),
    });
    console.log(`\n  ✅ Enviado OK  SID=${msg.sid}  status=${msg.status}`);
    return true;
  } catch (err) {
    console.error(`\n  ❌ Error ${err.code}: ${err.message}`);
    if (err.moreInfo) console.error(`     Más info: ${err.moreInfo}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// 3. Probar envío con la plantilla SALUDO INICIAL
//    (suele ser más simple, sin variables o con pocas)
// ─────────────────────────────────────────────
async function testSaludoInicial(client) {
  banner(`📤 TEST ENVÍO – SALUDO INICIAL → ${destE164}`);

  try {
    const msg = await client.messages.create({
      from: `whatsapp:${FROM_NUMBER}`,
      to  : `whatsapp:${destE164}`,
      contentSid: KNOWN_TEMPLATES.SALUDO_INICIAL,
    });
    console.log(`\n  ✅ Enviado OK  SID=${msg.sid}  status=${msg.status}`);
    return true;
  } catch (err) {
    console.error(`\n  ❌ Error ${err.code}: ${err.message}`);
    if (err.moreInfo) console.error(`     Más info: ${err.moreInfo}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// 4. Probar plantilla de INICIO
// ─────────────────────────────────────────────
async function testInicio(client) {
  banner(`📤 TEST ENVÍO – INICIO → ${destE164}`);

  try {
    const msg = await client.messages.create({
      from: `whatsapp:${FROM_NUMBER}`,
      to  : `whatsapp:${destE164}`,
      contentSid: KNOWN_TEMPLATES.INICIO,
    });
    console.log(`\n  ✅ Enviado OK  SID=${msg.sid}  status=${msg.status}`);
    return true;
  } catch (err) {
    console.error(`\n  ❌ Error ${err.code}: ${err.message}`);
    if (err.moreInfo) console.error(`     Más info: ${err.moreInfo}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// 5. Diagnóstico de formato de variables (sin enviar)
// ─────────────────────────────────────────────
function diagnosticoVariables() {
  banner('🔬 DIAGNÓSTICO DE FORMATO DE VARIABLES');

  const { Intl: _Intl } = globalThis;
  const fmt = new _Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 2
  });

  const test = 12500;
  const formatted = fmt.format(test);
  const chars = [...formatted].map(c => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`);

  console.log(`\n  formatearMoneda(${test}) = "${formatted}"`);
  console.log(`  Caracteres: ${chars.join(' ')}`);

  // Twilio no acepta saltos de línea, tabulaciones ni más de 4 espacios consecutivos
  const hasNewline   = /[\n\r]/.test(formatted);
  const hasTab       = /\t/.test(formatted);
  const hasNBSP      = /\u00a0/.test(formatted);
  const has4spaces   = /    /.test(formatted);

  console.log(`\n  ¿Contiene salto de línea? ${hasNewline ? '⚠️  SÍ – PROBLEMA' : '✅ No'}`);
  console.log(`  ¿Contiene tabulación?    ${hasTab     ? '⚠️  SÍ – PROBLEMA' : '✅ No'}`);
  console.log(`  ¿Contiene espacio duro?  ${hasNBSP    ? '⚠️  SÍ – PUEDE SER PROBLEMA' : '✅ No'}`);
  console.log(`  ¿4+ espacios seguidos?   ${has4spaces ? '⚠️  SÍ – PROBLEMA' : '✅ No'}`);

  if (hasNBSP) {
    console.log('\n  💡 SOLUCIÓN: el formatter de es-AR usa espacio no separable (U+00A0).');
    console.log('     Reemplazar en whatsappService.js con .replace(/\\u00a0/g, " ")');
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
(async () => {
  console.log('\n🔧 TEST PLANTILLAS TWILIO – COBER360');
  console.log(`   Account SID: ${ACCOUNT_SID}`);
  console.log(`   From       : ${FROM_NUMBER}`);
  console.log(`   Destino    : ${destE164}`);

  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    console.error('\n❌ Variables de entorno TWILIO_* no encontradas. Verificar .env');
    process.exit(1);
  }

  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

  // 1. Listar plantillas
  await listarTemplates(client);

  // 2. Diagnóstico de formato
  diagnosticoVariables();

  // 3. Envíos de prueba
  banner('🚀 ENVIANDO MENSAJES DE PRUEBA');
  console.log(`  (Si algún envío falla con 21656, la causa más probable`);
  console.log(`   es una variable nula/vacía o caracteres especiales)\n`);

  const r1 = await testSaludoInicial(client);
  const r2 = await testInicio(client);
  const r3 = await testCotizacion(client);

  banner('📊 RESUMEN');
  console.log(`  SALUDO_INICIAL : ${r1 ? '✅ OK' : '❌ FALLO'}`);
  console.log(`  INICIO         : ${r2 ? '✅ OK' : '❌ FALLO'}`);
  console.log(`  COTIZACION     : ${r3 ? '✅ OK' : '❌ FALLO'}`);

  if (!r3) {
    console.log(`\n  ⚠️  La plantilla COTIZACION falla. Causas más comunes:`);
    console.log(`     1. Espacio no separable (U+00A0) en los valores formateados`);
    console.log(`        → Aplicar .replace(/\\u00a0/g, " ") en formatearMoneda()`);
    console.log(`     2. La plantilla fue rechazada/eliminada por WhatsApp/Meta`);
    console.log(`        → Verificar estado en Twilio Console > Content Templates`);
    console.log(`     3. El número de variables en la plantilla cambió`);
    console.log(`        → Abrir el SID ${KNOWN_TEMPLATES.COTIZACION} en Twilio Console`);
  }
  console.log('');
})();
