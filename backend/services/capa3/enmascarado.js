// Enmascarado de PII antes de enviar contenido a un proveedor externo de IA.
// Regla: todo lo que se envía al modelo pasa por enmascararParaIA(). El texto crudo
// nunca sale del proceso hacia OpenAI; solo se usa localmente para reglas/regex.

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Cualquier corrida de 7+ dígitos (cubre teléfonos, DNI, códigos largos) con separadores opcionales
const RE_DIGITOS_LARGOS = /(?:\d[\s.-]?){7,}\d/g;

function enmascararParaIA(texto) {
  if (!texto) return texto;
  let out = String(texto);
  out = out.replace(RE_EMAIL, '[EMAIL]');
  out = out.replace(RE_DIGITOS_LARGOS, '[NUMERO]');
  return out;
}

// Redacta un mensaje para logging: nunca se debe loguear el texto original completo
// si contiene datos personales. Se usa solo para logs de proceso/errores, no para el
// contenido que se persiste en features_mensaje (ese ya existía desde Capa 2).
function redactarParaLog(texto, maxLen = 40) {
  if (!texto) return '';
  const enmascarado = enmascararParaIA(texto);
  return enmascarado.length > maxLen ? enmascarado.slice(0, maxLen) + '…' : enmascarado;
}

module.exports = { enmascararParaIA, redactarParaLog, RE_EMAIL, RE_DIGITOS_LARGOS };
