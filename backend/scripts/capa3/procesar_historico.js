// Procesamiento del histórico completo de Capa 3.
//
// Uso:
//   node backend/scripts/capa3/procesar_historico.js [--limit N] [--concurrencia N] [--forzar-reprocesar]
//
// --limit N            Procesa como máximo N conversaciones en total en esta corrida.
// --concurrencia N      Sobreescribe CAPA3_CONCURRENCIA (default 3).
// --forzar-reprocesar  Reprocesa también mensajes ya clasificados con otra versión de modelo/prompt/taxonomía.
//
// Comportamiento: procesa por lotes de conversaciones completas con concurrencia limitada.
// El primer lote (tamaño configurable, default 500 conversaciones = CAPA3_TAMANIO_LOTE_CONTROLADO)
// actúa como gate: si su tasa de excepciones supera CAPA3_UMBRAL_EXCEPCIONES_CRITICA, el proceso
// se detiene ahí (no sigue con el resto del histórico) para que se revise manualmente.
// Es resumible: al reanudar, solo toma mensajes pendientes (capa2_procesado=0 o versión distinta),
// nunca toca revision_manual=1, nunca reprocesa lo ya hecho con la versión vigente salvo --forzar-reprocesar.

require('dotenv').config({ path: __dirname + '/../../.env' });
const pLimit = require('p-limit');
const db = require('../../config/db');
const pipeline = require('../../services/capa3/pipeline');
const config = require('../../services/capa3/config');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  return {
    limit: get('--limit') ? parseInt(get('--limit'), 10) : null,
    concurrencia: get('--concurrencia') ? parseInt(get('--concurrencia'), 10) : config.CONCURRENCIA,
    forzarReprocesar: args.includes('--forzar-reprocesar'),
  };
}

async function obtenerConversacionesPendientes(forzarReprocesar) {
  const condicion = forzarReprocesar
    ? '1=1'
    : `EXISTS (
         SELECT 1 FROM features_mensaje fm
         WHERE fm.conversacion_id = fc.conversacion_id
           AND fm.revision_manual = 0
           AND (fm.capa2_procesado = 0 OR fm.capa2_modelo_version IS NULL OR fm.capa2_modelo_version <> ?)
       )`;
  const params = forzarReprocesar ? [] : [pipeline.versionActual()];

  const [rows] = await db.query(
    `SELECT fc.conversacion_id
     FROM features_conversacion fc
     WHERE ${condicion}
     ORDER BY
       (fc.grupo_dataset = 'principal') DESC,
       (fc.resultado_final IN ('venta_cerrada_sin_pago_confirmado','no_venta_confirmada')) DESC,
       fc.conversacion_id ASC`,
    params
  );
  return rows.map(r => r.conversacion_id);
}

async function procesarConcurrente(ids, concurrencia, opts) {
  const limit = pLimit(concurrencia);
  return Promise.all(ids.map(id => limit(() => pipeline.procesarConversacion(id, opts))));
}

async function estadoActual() {
  const [[totales]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(capa2_procesado = 1) AS procesados,
      SUM(capa2_procesado = 0 AND revision_manual = 0) AS pendientes,
      SUM(revision_manual = 1) AS revision_manual,
      SUM(tipo_mensaje = 'otro') AS clasificados_otro,
      AVG(confianza_clasificacion) AS confianza_promedio
    FROM features_mensaje
  `);
  return totales;
}

function resumirChunk(resultados) {
  const conversaciones = resultados.length;
  const mensajesProcesados = resultados.reduce((a, r) => a + r.procesados, 0);
  const rechazados = resultados.reduce((a, r) => a + r.rechazados, 0);
  const excepciones = resultados.reduce((a, r) => a + r.errores.filter(e => e.tipo === 'excepcion').length, 0);
  const validaciones = resultados.reduce((a, r) => a + r.errores.filter(e => e.tipo === 'validacion').length, 0);
  const advertencias = resultados.reduce((a, r) => a + (r.advertencias ? r.advertencias.length : 0), 0);
  const tokensPrompt = resultados.reduce((a, r) => a + (r.tokens ? r.tokens.prompt : 0), 0);
  const tokensCompletion = resultados.reduce((a, r) => a + (r.tokens ? r.tokens.completion : 0), 0);
  const reintentos = resultados.reduce((a, r) => a + (r.reintentos || 0), 0);
  return { conversaciones, mensajesProcesados, rechazados, excepciones, validaciones, advertencias, tokensPrompt, tokensCompletion, reintentos };
}

async function main() {
  const { limit, concurrencia, forzarReprocesar } = parseArgs();
  await pipeline.cargarCatalogos();

  let pendientes = await obtenerConversacionesPendientes(forzarReprocesar);
  if (limit) pendientes = pendientes.slice(0, limit);

  console.log(`Conversaciones a procesar: ${pendientes.length} | concurrencia=${concurrencia} | version=${pipeline.versionActual()}`);

  const tamanioLote = config.TAMANIO_LOTE_CONTROLADO;
  const chunks = [];
  for (let i = 0; i < pendientes.length; i += tamanioLote) chunks.push(pendientes.slice(i, i + tamanioLote));

  let acumTokensPrompt = 0, acumTokensCompletion = 0, acumConversaciones = 0, acumMensajes = 0, acumReintentos = 0, acumRechazados = 0, acumExcepciones = 0;
  const inicioTotal = Date.now();
  console.log(`Fecha de inicio: ${new Date(inicioTotal).toISOString()}`);

  for (let c = 0; c < chunks.length; c++) {
    const inicioChunk = Date.now();
    const resultados = await procesarConcurrente(chunks[c], concurrencia, { forzarReprocesar });
    const duracionChunkSeg = (Date.now() - inicioChunk) / 1000;
    const resumen = resumirChunk(resultados);

    acumTokensPrompt += resumen.tokensPrompt;
    acumTokensCompletion += resumen.tokensCompletion;
    acumConversaciones += resumen.conversaciones;
    acumMensajes += resumen.mensajesProcesados;
    acumReintentos += resumen.reintentos;
    acumRechazados += resumen.rechazados;
    acumExcepciones += resumen.excepciones;

    const costoChunkUSD = (resumen.tokensPrompt / 1e6) * config.PRECIO_INPUT_POR_1M + (resumen.tokensCompletion / 1e6) * config.PRECIO_OUTPUT_POR_1M;
    const costoAcumUSD = (acumTokensPrompt / 1e6) * config.PRECIO_INPUT_POR_1M + (acumTokensCompletion / 1e6) * config.PRECIO_OUTPUT_POR_1M;
    const tasaExcepciones = resumen.conversaciones ? resumen.excepciones / resumen.conversaciones : 0;
    const estado = await estadoActual();

    console.log(`\n=== Lote ${c + 1}/${chunks.length} (${resumen.conversaciones} conversaciones) ===`);
    console.log({
      fecha_inicio_lote: new Date(inicioChunk).toISOString(),
      fecha_fin_lote: new Date().toISOString(),
      mensajes_procesados_lote: resumen.mensajesProcesados,
      rechazados_lote: resumen.rechazados,
      excepciones_lote: resumen.excepciones,
      advertencias_lote: resumen.advertencias,
      reintentos_lote: resumen.reintentos,
      tasa_excepciones_lote: Number(tasaExcepciones.toFixed(4)),
      duracion_seg_lote: Number(duracionChunkSeg.toFixed(1)),
      promedio_seg_por_conversacion: Number((duracionChunkSeg / Math.max(1, resumen.conversaciones)).toFixed(2)),
      costo_usd_lote: Number(costoChunkUSD.toFixed(4)),
      costo_usd_acumulado_corrida: Number(costoAcumUSD.toFixed(4)),
      mensajes_totales_bd: Number(estado.total),
      mensajes_procesados_bd: Number(estado.procesados),
      mensajes_pendientes_bd: Number(estado.pendientes),
      mensajes_revision_manual_bd: Number(estado.revision_manual),
      pct_clasificado_otro_bd: estado.procesados ? Number(((estado.clasificados_otro / estado.procesados) * 100).toFixed(1)) : null,
      pct_revision_manual_bd: estado.total ? Number(((estado.revision_manual / estado.total) * 100).toFixed(1)) : null,
      confianza_promedio_bd: estado.confianza_promedio ? Number(Number(estado.confianza_promedio).toFixed(3)) : null,
    });

    if (tasaExcepciones > config.UMBRAL_TASA_EXCEPCIONES_CRITICA) {
      console.error(`❌ Tasa de excepciones (${tasaExcepciones}) supera el umbral crítico (${config.UMBRAL_TASA_EXCEPCIONES_CRITICA}). Deteniendo la corrida para revisión manual.`);
      console.error('No se continúa automáticamente con el resto del histórico.');
      process.exit(1);
    }
  }

  const duracionTotalSeg = (Date.now() - inicioTotal) / 1000;
  const estadoFinal = await estadoActual();
  console.log('\n--- Resumen final de la corrida ---');
  console.log({
    fecha_inicio: new Date(inicioTotal).toISOString(),
    fecha_fin: new Date().toISOString(),
    conversaciones_procesadas: acumConversaciones,
    mensajes_procesados: acumMensajes,
    mensajes_pendientes_restantes: Number(estadoFinal.pendientes),
    rechazados: acumRechazados,
    excepciones: acumExcepciones,
    reintentos: acumReintentos,
    duracion_total_seg: Number(duracionTotalSeg.toFixed(1)),
    costo_total_usd: Number(((acumTokensPrompt / 1e6) * config.PRECIO_INPUT_POR_1M + (acumTokensCompletion / 1e6) * config.PRECIO_OUTPUT_POR_1M).toFixed(4)),
    modelo_prompt_taxonomia: pipeline.versionActual(),
  });
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error('❌ Error en procesamiento de histórico:', err);
    process.exit(1);
  });
}
