// Paso 1 (reglas) y Paso 2 (extracción de entidades de catálogo cerrado) del pipeline
// de Capa 3. Todo lo que se puede resolver sin IA vive acá: es más barato, determinístico
// y sirve de verificación cruzada contra la salida del modelo (Paso 4).

const RE_PREGUNTA_SIGNO = /\?/;
const RE_PREGUNTA_PALABRAS = /\b(que|qué|como|cómo|cuando|cuándo|cuanto|cuánto|cuánto|donde|dónde|por que|por qué|se puede|puedo|hay|tienen|tenes|tenés|me pod[eé]s|cubre|incluye)\b/i;
const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const RE_TELEFONO = /(?:\+?54\s?9?\s?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}\b/;
const RE_FECHA_CON_ANIO = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
const RE_HORARIO = /\b\d{1,2}:\d{2}\s?(?:hs|h)?\b|\b(?:a las|alas)\s?\d{1,2}\s?(?:hs|h)?\b/i;
const RE_MONTO = /\$\s?\d[\d.,]*|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\s?(?:pesos|mil)\b/i;
const RE_PORCENTAJE = /\b\d{1,3}\s?%|\b\d{1,3}\s?por ?ciento\b/i;
const RE_EDAD = /\btengo\s?\d{1,2}\s?años\b|\b\d{1,2}\s?años\b/i;
const RE_INTEGRANTES = /\b(somos|seríamos|seriamos)\s?\d{1,2}\b|\b\d{1,2}\s?(integrantes|personas)\b/i;

function detectarPregunta(texto) {
  if (!texto) return 0;
  return (RE_PREGUNTA_SIGNO.test(texto) || RE_PREGUNTA_PALABRAS.test(texto)) ? 1 : 0;
}

function extraerEmail(texto) {
  const m = texto && texto.match(RE_EMAIL);
  return m ? 1 : 0; // no se persiste el valor crudo, solo el flag de presencia
}

function extraerTelefono(texto) {
  const m = texto && texto.match(RE_TELEFONO);
  return m ? 1 : 0;
}

// Solo devuelve la fecha si tiene día, mes Y año explícitos (una columna DATE no admite
// fechas parciales tipo "15/03"). Fechas sin año quedan sin resolver, no se inventa el año.
function extraerFecha(texto) {
  if (!texto) return null;
  const m = texto.match(RE_FECHA_CON_ANIO);
  if (!m) return null;
  let [, dia, mes, anio] = m;
  if (anio.length === 2) anio = `20${anio}`;
  dia = dia.padStart(2, '0');
  mes = mes.padStart(2, '0');
  if (Number(mes) > 12 || Number(dia) > 31) return null;
  return `${anio}-${mes}-${dia}`;
}

function extraerHorario(texto) {
  const m = texto && texto.match(RE_HORARIO);
  return m ? m[0] : null;
}

function extraerMonto(texto) {
  if (!texto) return null;
  const m = texto.match(RE_MONTO);
  if (!m) return null;
  const limpio = m[0].replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(limpio);
  return Number.isFinite(valor) ? valor : null;
}

function extraerPorcentaje(texto) {
  if (!texto) return null;
  const m = texto.match(RE_PORCENTAJE);
  if (!m) return null;
  const valor = parseFloat(m[0]);
  return Number.isFinite(valor) ? valor : null;
}

function extraerEdad(texto) {
  if (!texto) return null;
  const m = texto.match(RE_EDAD);
  if (!m) return null;
  const num = m[0].match(/\d{1,2}/);
  return num ? parseInt(num[0], 10) : null;
}

function extraerCantidadIntegrantes(texto) {
  if (!texto) return null;
  const m = texto.match(RE_INTEGRANTES);
  if (!m) return null;
  const num = m[0].match(/\d{1,2}/);
  return num ? parseInt(num[0], 10) : null;
}

function conversacionEstancada(minutosHastaSiguiente, umbralMinutos = 1440) {
  if (minutosHastaSiguiente === null || minutosHastaSiguiente === undefined) return 0; // último mensaje, no se puede evaluar todavía
  return minutosHastaSiguiente > umbralMinutos ? 1 : 0;
}

function normalizar(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

// Matching contra catálogo cerrado (planes/prestadores desde la DB, o listas curadas).
// Nunca devuelve texto libre inventado por el modelo: si no matchea ningún candidato
// del catálogo, devuelve null (queda pendiente de revisión, no se persiste normalizado).
function matchearCatalogo(textoLibre, catalogo) {
  if (!textoLibre) return null;
  const norm = normalizar(textoLibre);
  for (const candidato of catalogo) {
    const candNorm = normalizar(candidato);
    if (candNorm.length >= 3 && norm.includes(candNorm)) return candidato;
  }
  return null;
}

// Catálogo curado de competidores/obras sociales frecuentes en el mercado de salud AR.
// Mantenimiento: a cargo del equipo de negocio, no se infiere de ninguna tabla porque
// no existe una tabla `competidores` en el sistema operativo.
const COMPETIDORES_CURADOS = [
  'OSDE', 'Swiss Medical', 'Galeno', 'Medife', 'Sancor Salud', 'Avalian', 'Accord Salud',
  'Federada Salud', 'Jerarquicos Salud', 'OMINT', 'Doctored', 'PAMI', 'IOMA', 'Prevención Salud',
  'Hominis', 'Apres', 'ASE Nacional', 'Ospe', 'Luis Pasteur',
];

module.exports = {
  detectarPregunta,
  extraerEmail,
  extraerTelefono,
  extraerFecha,
  extraerHorario,
  extraerMonto,
  extraerPorcentaje,
  extraerEdad,
  extraerCantidadIntegrantes,
  conversacionEstancada,
  matchearCatalogo,
  normalizar,
  COMPETIDORES_CURADOS,
};
