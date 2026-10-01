/**
 * Saneamiento de nombres de prospecto que llegan de fuentes sin validación de formato.
 *
 * Contexto: el formulario web exige /^[a-zA-Z áéíóúüñ]+$/ de 2 a 50 caracteres en
 * nombre y apellido, así que lo que entra por ahí ya es un nombre. El alta en frío
 * por WhatsApp guarda el ProfileName tal como el usuario lo puso en su teléfono, y
 * en la base quedaron valores como '💖', 'Pintos Ale🙂‍↔️' o
 * 'Grupo León | Construcción & Remodelaciones'.
 *
 * Eso importa porque ese nombre se usa como firmante en VaFirma — un documento legal
 * a nombre de '💖' — y se interpola en el HTML del PDF.
 *
 * El escape de HTML del PDF vive aparte, en polizaPDFController: son dos capas
 * distintas. Esto arregla el dato; aquello arregla el render de cualquier fuente.
 */

// Se conserva todo lo que puede formar parte de un nombre real: letras de cualquier
// alfabeto, marcas diacríticas (acentos), espacios, apóstrofos y guiones. Cae todo lo
// demás: emoji y pictogramas (que son símbolos, no letras), dígitos, barras, pipes,
// ampersands y cualquier carácter de control.
const NO_PERMITIDOS = /[^\p{L}\p{M}\s'’.\-]/gu;
const LARGO_MAXIMO = 50; // mismo límite que valida el formulario web

// Se quitan primero: los selectores de variación (U+FE0F y compañía) son categoría
// marca, igual que los acentos, así que \p{M} los dejaría pasar y quedaría un carácter
// invisible pegado al nombre ('Pintos Ale🙂‍↔️' -> 'Pintos Ale ️'). Los ZWJ y demás
// caracteres de formato entran en la misma bolsa.
const INVISIBLES = /[\u200B-\u200F\u2060-\u206F\uFE00-\uFE0F]/g;

/**
 * Limpia un nombre proveniente de una fuente sin validar.
 *
 * @param {string} valor - Nombre crudo (ej. ProfileName de WhatsApp)
 * @param {string|null} fallback - Qué devolver si no queda nada utilizable
 * @returns {string|null}
 */
function sanitizarNombre(valor, fallback = null) {
  const limpio = String(valor || '')
    .replace(INVISIBLES, '')
    .replace(NO_PERMITIDOS, ' ')
    .replace(/\s+/g, ' ')
    // puntos y guiones sueltos en los bordes ('Magalí.' -> 'Magalí')
    .replace(/^[\s.\-']+|[\s.\-']+$/g, '')
    .trim()
    .slice(0, LARGO_MAXIMO)
    .trim();

  return limpio || fallback;
}

/**
 * Nombre del firmante para VaFirma. Se sanea en el momento de usarlo y no solo al
 * guardar, porque los prospectos dados de alta antes de este saneamiento siguen
 * teniendo el ProfileName crudo en la base.
 *
 * @returns {string} Nombre utilizable, o 'Cliente' si no queda nada
 */
function nombreParaFirma(nombre, apellido) {
  const completo = `${sanitizarNombre(nombre) || ''} ${sanitizarNombre(apellido) || ''}`.trim();
  return completo || 'Cliente';
}

module.exports = { sanitizarNombre, nombreParaFirma, LARGO_MAXIMO };
