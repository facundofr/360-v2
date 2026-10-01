/**
 * Resolución del email del prospecto con fallback a los datos de la póliza.
 *
 * Contexto: los prospectos de alta en frío por WhatsApp se crean sin `correo`
 * (ver validacionWhatsappService.crearProspectoDesdeWhatsappEntrante). El email
 * recién aparece cuando el vendedor completa la póliza, y queda guardado en
 * `polizas.datos_personales.email` sin volver a `prospectos.correo`.
 *
 * Sin este fallback, `prospecto_email` llega vacío al frontend y el botón
 * "Enviar a Firma" queda deshabilitado aunque el email exista.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esEmailValido(valor) {
  return typeof valor === 'string' && EMAIL_REGEX.test(valor);
}

function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * `datos_personales` viene como longtext desde la BD, pero algunos endpoints ya
 * lo parsean antes de mapear. Acepta ambos casos.
 */
function parsearDatosPersonales(datosPersonales) {
  if (!datosPersonales) return null;
  if (typeof datosPersonales === 'object') return datosPersonales;
  try {
    return JSON.parse(datosPersonales);
  } catch (e) {
    return null;
  }
}

/**
 * Devuelve el mejor email disponible para el prospecto de una póliza.
 * Prioridad: prospectos.correo válido > polizas.datos_personales.email válido >
 * lo que haya en prospectos.correo (para no perder el dato en pantalla) > null.
 *
 * @param {Object} poliza - Fila con `prospecto_email` y `datos_personales`
 * @returns {string|null}
 */
function resolverEmailProspecto(poliza) {
  if (!poliza) return null;

  const correoProspecto = limpiar(poliza.prospecto_email);
  if (esEmailValido(correoProspecto)) return correoProspecto;

  const datos = parsearDatosPersonales(poliza.datos_personales);
  const correoPoliza = limpiar(datos?.email);
  if (esEmailValido(correoPoliza)) return correoPoliza;

  return correoProspecto || null;
}

module.exports = {
  resolverEmailProspecto,
  esEmailValido
};
