// Paso 3 del pipeline: clasificación semántica con IA, salida JSON estructurada,
// restringida a las taxonomías aprobadas (backend/scripts/capa3/taxonomias.js).
// Reutiliza la misma instanciación de OpenAI que ya usa el chatbot existente
// (controllers/chatbot/chatbotVendedorController.js), sin credenciales nuevas.

const { OpenAI } = require('openai');
const { TAXONOMIAS, valoresValidos, VERSION: TAXONOMIA_VERSION } = require('../../scripts/capa3/taxonomias');
const { enmascararParaIA } = require('./enmascarado');

const MODELO = process.env.CAPA3_OPENAI_MODEL || 'gpt-4o-mini';
const PROMPT_VERSION = 'v1';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function enumTax(nombre) {
  return valoresValidos(nombre);
}

function construirJsonSchema() {
  return {
    name: 'clasificacion_mensaje',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'tipo_mensaje', 'intencion_principal', 'tema_principal', 'etapa_embudo',
        'nivel_interes', 'estado_emocional_prospecto', 'objecion_principal',
        'contiene_objecion', 'contiene_decision', 'contiene_intencion_compra',
        'contiene_intencion_abandono', 'requiere_seguimiento', 'requiere_respuesta',
        'responde_pregunta_anterior', 'proxima_accion_sugerida',
        'contiene_informacion_personal', 'contiene_datos_sensibles',
        'plan_mencionado_texto', 'obra_social_mencionada_texto',
        'competidor_mencionado_texto', 'prestador_mencionado_texto',
        'grupo_familiar_detalle_texto', 'confianza',
      ],
      properties: {
        tipo_mensaje: { type: 'string', enum: enumTax('tipo_mensaje') },
        intencion_principal: { type: 'string', enum: enumTax('intencion_principal') },
        tema_principal: { type: 'string', enum: enumTax('tema_principal') },
        etapa_embudo: { type: 'string', enum: enumTax('etapa_embudo') },
        nivel_interes: { type: ['string', 'null'], enum: [...enumTax('nivel_interes'), null] },
        estado_emocional_prospecto: { type: ['string', 'null'], enum: [...enumTax('estado_emocional_prospecto'), null] },
        objecion_principal: { type: ['string', 'null'], enum: [...enumTax('objecion_principal'), null] },
        contiene_objecion: { type: 'boolean' },
        contiene_decision: { type: 'boolean' },
        contiene_intencion_compra: { type: 'boolean' },
        contiene_intencion_abandono: { type: 'boolean' },
        requiere_seguimiento: { type: 'boolean' },
        requiere_respuesta: { type: 'boolean' },
        responde_pregunta_anterior: { type: 'boolean' },
        proxima_accion_sugerida: { type: 'string', enum: enumTax('proxima_accion_sugerida') },
        contiene_informacion_personal: { type: 'boolean' },
        contiene_datos_sensibles: { type: 'boolean' },
        plan_mencionado_texto: { type: ['string', 'null'] },
        obra_social_mencionada_texto: { type: ['string', 'null'] },
        competidor_mencionado_texto: { type: ['string', 'null'] },
        prestador_mencionado_texto: { type: ['string', 'null'] },
        grupo_familiar_detalle_texto: { type: ['string', 'null'] },
        confianza: { type: 'number' },
      },
    },
  };
}

function describirTaxonomias() {
  return Object.entries(TAXONOMIAS).map(([nombre, def]) => {
    const valores = Object.entries(def.valores).map(([v, d]) => `    - ${v}: ${d}`).join('\n');
    return `${nombre} (${def.descripcion}):\n${valores}`;
  }).join('\n\n');
}

const SYSTEM_PROMPT = `Sos un clasificador semántico de mensajes de una conversación comercial de venta de planes de salud por WhatsApp.

Reglas estrictas:
- Devolvé ÚNICAMENTE el JSON solicitado. Nunca texto narrativo, nunca explicaciones.
- Usá EXCLUSIVAMENTE los valores de las listas cerradas provistas abajo. Nunca inventes un valor fuera de esas listas.
- "nivel_interes" y "estado_emocional_prospecto" solo aplican si el autor del mensaje actual es el cliente; si el autor es vendedor, ambos deben ser null.
- "objecion_principal" solo puede tener valor si "contiene_objecion" es true; si no hay objeción, debe ser null.
- No repitas ni cites textualmente números de teléfono, emails, documentos, nombres de enfermedades o medicamentos en tu respuesta. Los campos de texto libre (plan_mencionado_texto, obra_social_mencionada_texto, competidor_mencionado_texto, prestador_mencionado_texto, grupo_familiar_detalle_texto) son solo para nombres de planes/empresas/prestadores/composición familiar mencionados, nunca para datos de salud ni identificadores personales.
- "confianza" es tu propia certeza sobre esta clasificación, entre 0 y 1.
- El mensaje puede venir con partes reemplazadas por [EMAIL] o [NUMERO]: son datos enmascarados por privacidad, ignoralos, no intentes reconstruirlos.

Taxonomías y definición de cada valor:

${describirTaxonomias()}`;

function construirContexto(mensajesPrevios, mensajeActual) {
  const historial = mensajesPrevios.map(m => (
    `[${m.autor}] ${enmascararParaIA(m.mensaje_texto)}`
    + (m.tipo_mensaje ? ` (clasificado previamente como: tipo=${m.tipo_mensaje}, etapa=${m.etapa_embudo || 'n/d'})` : '')
  )).join('\n');

  return `Contexto de los mensajes anteriores de esta misma conversación (orden cronológico):
${historial || '(este es el primer mensaje de la conversación)'}

Mensaje actual a clasificar:
[${mensajeActual.autor}] ${enmascararParaIA(mensajeActual.mensaje_texto)}

Clasificá el "Mensaje actual" usando el contexto solo como referencia para coherencia (por ejemplo, para no retroceder de etapa sin motivo, o para saber si responde una pregunta anterior).`;
}

const MAX_REINTENTOS = parseInt(process.env.CAPA3_MAX_REINTENTOS || '4', 10);
const BACKOFF_BASE_MS = parseInt(process.env.CAPA3_BACKOFF_BASE_MS || '1000', 10);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

let _contadorReintentos = 0;
function obtenerYResetearReintentos() {
  const c = _contadorReintentos;
  _contadorReintentos = 0;
  return c;
}

// Reintenta ante rate limits (429) y errores transitorios (5xx, timeouts de red) con
// backoff exponencial + jitter. Errores de validación/parametros (4xx que no sean 429)
// no se reintentan porque no se van a resolver solos.
async function conReintentos(fn) {
  let ultimoError;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      const status = err.status || err.code;
      const esReintentable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET';
      if (!esReintentable || intento === MAX_REINTENTOS) throw err;
      _contadorReintentos++;
      const espera = BACKOFF_BASE_MS * Math.pow(2, intento) + Math.floor(Math.random() * 250);
      await sleep(espera);
    }
  }
  throw ultimoError;
}

async function clasificarMensaje({ mensajesPrevios, mensajeActual }) {
  const respuesta = await conReintentos(() => openai.chat.completions.create({
    model: MODELO,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: construirContexto(mensajesPrevios, mensajeActual) },
    ],
    response_format: { type: 'json_schema', json_schema: construirJsonSchema() },
    temperature: 0,
  }));

  const contenido = respuesta.choices[0].message.content;
  const usage = respuesta.usage || {};
  let json;
  try {
    json = JSON.parse(contenido);
  } catch (e) {
    throw new Error(`Respuesta del modelo no es JSON válido: ${e.message}`);
  }

  return {
    resultado: json,
    modelo: MODELO,
    promptVersion: PROMPT_VERSION,
    taxonomiaVersion: TAXONOMIA_VERSION,
    tokensPrompt: usage.prompt_tokens || 0,
    tokensCompletion: usage.completion_tokens || 0,
  };
}

module.exports = { clasificarMensaje, MODELO, PROMPT_VERSION, TAXONOMIA_VERSION, obtenerYResetearReintentos };
