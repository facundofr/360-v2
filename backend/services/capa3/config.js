// Parámetros configurables de Capa 3 (env vars, con default documentado).
// Nada acá se hardcodea sin poder overridearse.

const UMBRAL_CONFIANZA_MINIMA = parseFloat(process.env.CAPA3_UMBRAL_CONFIANZA_MINIMA || '0.5');
// Umbral por encima del cual, si hay objecion pero el modelo no precisa la categoria,
// se asume 'otro' en vez de dejarla pendiente de revision.
const UMBRAL_OBJECION_OTRO = parseFloat(process.env.CAPA3_UMBRAL_OBJECION_OTRO || '0.6');
// CAPA3_CONCURRENCY es el nombre preferido (usado por el wrapper de cron);
// CAPA3_CONCURRENCIA queda como alias retrocompatible.
const CONCURRENCIA = parseInt(process.env.CAPA3_CONCURRENCY || process.env.CAPA3_CONCURRENCIA || '3', 10);
// Tamaño del lote controlado inicial antes de continuar automáticamente con el resto.
const TAMANIO_LOTE_CONTROLADO = parseInt(process.env.CAPA3_TAMANIO_LOTE_CONTROLADO || '500', 10);
// Gate de errores críticos: si la tasa de excepciones del lote controlado supera esto, se detiene.
const UMBRAL_TASA_EXCEPCIONES_CRITICA = parseFloat(process.env.CAPA3_UMBRAL_EXCEPCIONES_CRITICA || '0.05');

// Precios estimados de gpt-4o-mini (USD por 1M tokens) — verificar precio vigente del proveedor.
const PRECIO_INPUT_POR_1M = parseFloat(process.env.CAPA3_PRECIO_INPUT_1M || '0.15');
const PRECIO_OUTPUT_POR_1M = parseFloat(process.env.CAPA3_PRECIO_OUTPUT_1M || '0.60');

module.exports = {
  UMBRAL_CONFIANZA_MINIMA,
  UMBRAL_OBJECION_OTRO,
  CONCURRENCIA,
  TAMANIO_LOTE_CONTROLADO,
  UMBRAL_TASA_EXCEPCIONES_CRITICA,
  PRECIO_INPUT_POR_1M,
  PRECIO_OUTPUT_POR_1M,
};
