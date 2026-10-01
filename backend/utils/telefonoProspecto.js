/**
 * Criterio único de comparación de teléfonos de prospectos.
 *
 * Contexto: el mismo teléfono se guarda en dos formatos según por dónde entró.
 * Twilio entrega el móvil argentino con el 9 de celular y el alta en frío por
 * WhatsApp lo guarda tal cual (`+5491157595857`); el formulario web y los refritos
 * lo normalizan sin el 9 (`+541157595857`). Comparar por subcadena contigua o por
 * igualdad exacta falla entre ambos formatos: después de "54" uno tiene "9" y el
 * otro "1".
 *
 * El sufijo de 10 dígitos (código de área + abonado) es el mismo en los dos casos
 * y también entre un móvil y su línea fija equivalente, así que es el criterio que
 * usamos en todos lados. Es el que ya venía aplicando chatService.buscarProspectoPorTelefono.
 */

// numero_contacto sin espacios, paréntesis, guiones ni '+' — solo dígitos.
const SQL_TELEFONO_DIGITOS =
  "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(numero_contacto, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '')";

// Cláusula WHERE lista para intercalar. Toma un parámetro: el sufijo de sufijoTelefono().
const SQL_MATCH_TELEFONO = `RIGHT(${SQL_TELEFONO_DIGITOS}, 10) = ?`;

/**
 * Sufijo de 10 dígitos de un teléfono, para comparar con SQL_MATCH_TELEFONO.
 * Devuelve null si el número no llega a 10 dígitos: en ese caso no hay sufijo
 * confiable y comparar igual daría falsos positivos (ej. '444026' matchearía
 * cualquier número terminado así).
 *
 * @param {string} numero - Teléfono en cualquier formato
 * @returns {string|null} 10 dígitos, o null si el dato es insuficiente
 */
function sufijoTelefono(numero) {
  const digitos = String(numero || '').replace(/\D/g, '');
  return digitos.length >= 10 ? digitos.slice(-10) : null;
}

module.exports = {
  SQL_TELEFONO_DIGITOS,
  SQL_MATCH_TELEFONO,
  sufijoTelefono
};
