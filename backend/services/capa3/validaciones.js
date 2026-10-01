// Paso 4 del pipeline: validaciones antes de persistir. Un mensaje que no pasa
// validación queda pendiente de revisión (no se persiste como si fuera correcto):
// no se marca capa2_procesado=1 y se reporta en el lote como "rechazado".
//
// IMPORTANTE: `r` debe ser el resultado YA RESUELTO por el pipeline (objecion_principal
// ya con el default 'otro' aplicado si correspondía), no la salida cruda del modelo.
// Ver pipeline.js: resolverObjecionPrincipal().

const { esValorValido } = require('../../scripts/capa3/taxonomias');
const { UMBRAL_CONFIANZA_MINIMA } = require('./config');

const ORDEN_ETAPAS = ['contacto_inicial','descubrimiento','calificacion','recopilacion_de_datos','cotizacion','resolucion_de_objeciones','negociacion','decision','cierre','postventa'];
// Etapas hacia las que un retroceso es un patrón de venta consultiva normal, no una
// inconsistencia: reabrir objeciones o renegociar cerca del cierre son movimientos válidos
// (ej. cotizacion->resolucion_de_objeciones, decision->negociacion, cierre->resolucion_de_objeciones).
const ETAPAS_RETROCESO_NATURAL = ['resolucion_de_objeciones', 'negociacion'];

function validar(mensaje, r) {
  const errores = [];
  const advertencias = [];

  // 1) Enums pertenecen a la taxonomía activa (defensa en profundidad; el json_schema
  //    strict de OpenAI ya restringe esto, pero no confiamos ciegamente en el proveedor)
  for (const tax of ['tipo_mensaje', 'intencion_principal', 'tema_principal', 'etapa_embudo', 'proxima_accion_sugerida']) {
    if (!esValorValido(tax, r[tax])) errores.push(`${tax} fuera de catalogo: ${r[tax]}`);
  }
  for (const tax of ['nivel_interes', 'estado_emocional_prospecto', 'objecion_principal']) {
    if (r[tax] !== null && !esValorValido(tax, r[tax])) errores.push(`${tax} fuera de catalogo: ${r[tax]}`);
  }

  // 2) tipo_mensaje='objecion' implica contiene_objecion=1
  if (r.tipo_mensaje === 'objecion' && !r.contiene_objecion) {
    errores.push('tipo_mensaje=objecion pero contiene_objecion=false');
  }

  // 3) objecion_principal solo con objeción presente
  if (r.objecion_principal !== null && !r.contiene_objecion) {
    errores.push('objecion_principal con valor pero contiene_objecion=false');
  }
  // El pipeline ya intentó resolver objecion_principal a 'otro' cuando contiene_objecion=1
  // y la confianza alcanzaba CAPA3_UMBRAL_OBJECION_OTRO. Si igual llega null acá, significa
  // que la confianza fue insuficiente para categorizarla: se rechaza (no se persiste con
  // categoría nula), queda pendiente de revisión igual que cualquier otro rechazo.
  if (r.contiene_objecion && r.objecion_principal === null) {
    errores.push('objecion detectada sin categoria resoluble (confianza insuficiente) - pendiente de revision');
  }

  // 4) nivel_interes solo para autor=cliente
  if (r.nivel_interes !== null && mensaje.autor !== 'cliente') {
    errores.push('nivel_interes asignado a mensaje de vendedor');
  }

  // 5) estado_emocional_prospecto solo para autor=cliente
  if (r.estado_emocional_prospecto !== null && mensaje.autor !== 'cliente') {
    errores.push('estado_emocional_prospecto asignado a mensaje de vendedor');
  }

  // 6) coherencia secuencial de etapa_embudo (soft check -> advertencia, no rechazo).
  //    Los retrocesos NUNCA bloquean la persistencia; solo se advierten cuando no hay
  //    contenido (objeción presente, o destino en un patrón de retroceso natural) que los justifique.
  if (mensaje.etapa_embudo_anterior) {
    const idxAnterior = ORDEN_ETAPAS.indexOf(mensaje.etapa_embudo_anterior);
    const idxActual = ORDEN_ETAPAS.indexOf(r.etapa_embudo);
    const esRetroceso = idxActual < idxAnterior;
    const justificado = r.contiene_objecion || ETAPAS_RETROCESO_NATURAL.includes(r.etapa_embudo);
    if (esRetroceso && !justificado) {
      advertencias.push(`retroceso de etapa sin justificacion: ${mensaje.etapa_embudo_anterior} -> ${r.etapa_embudo}`);
    }
  }

  // 7) estructura + confianza
  if (typeof r.confianza !== 'number' || Number.isNaN(r.confianza)) {
    errores.push('confianza ausente o invalida');
  } else if (r.confianza < 0 || r.confianza > 1) {
    errores.push(`confianza fuera de rango: ${r.confianza}`);
  }

  const bajaConfianza = typeof r.confianza === 'number' && r.confianza < UMBRAL_CONFIANZA_MINIMA;
  if (bajaConfianza) advertencias.push(`confianza baja (< ${UMBRAL_CONFIANZA_MINIMA}): ${r.confianza}`);

  return {
    valido: errores.length === 0 && !bajaConfianza,
    errores,
    advertencias,
    bajaConfianza,
  };
}

module.exports = { validar, UMBRAL_CONFIANZA_MINIMA };
