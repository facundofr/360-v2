// Prueba piloto obligatoria de Capa 3 (Paso 10-11 del pedido).
// Selecciona una muestra estratificada de 30-50 conversaciones, corre el pipeline real
// (incluye llamadas reales a OpenAI) y emite un reporte de validación.
// Ejecutar: node backend/scripts/capa3/piloto.js

require('dotenv').config({ path: __dirname + '/../../.env' });
const fs = require('fs');
const db = require('../../config/db');
const pipeline = require('../../services/capa3/pipeline');
const { redactarParaLog } = require('../../services/capa3/enmascarado');

const TAMANIO_OBJETIVO = 40;
const PRECIO_INPUT_POR_1M = 0.15;  // USD, gpt-4o-mini, estimado — verificar precio vigente
const PRECIO_OUTPUT_POR_1M = 0.60; // USD, gpt-4o-mini, estimado — verificar precio vigente

async function muestraPorResultado(resultado, n) {
  const [rows] = await db.query(
    `SELECT fc.conversacion_id
     FROM features_conversacion fc
     JOIN features_mensaje fm ON fm.conversacion_id = fc.conversacion_id
     WHERE fc.resultado_final = ?
     GROUP BY fc.conversacion_id
     ORDER BY RAND() LIMIT ?`,
    [resultado, n]
  );
  return rows.map(r => r.conversacion_id);
}

async function muestraConObjeciones(n) {
  const [rows] = await db.query(
    `SELECT DISTINCT conversacion_id FROM features_mensaje
     WHERE autor='cliente' AND mensaje_texto REGEXP
       '(caro|costoso|no me interesa|no puedo pagar|ya tengo|otra obra social|no confio|no confío|pensarlo|desconfio|desconfío)'
     ORDER BY RAND() LIMIT ?`,
    [n]
  );
  return rows.map(r => r.conversacion_id);
}

async function muestraPorTamanio(condicion, n) {
  const [rows] = await db.query(
    `SELECT conversacion_id FROM features_conversacion
     WHERE total_mensajes ${condicion}
     ORDER BY RAND() LIMIT ?`,
    [n]
  );
  return rows.map(r => r.conversacion_id);
}

async function muestraPorVendedores(condicion, n) {
  const [rows] = await db.query(
    `SELECT conversacion_id FROM features_conversacion
     WHERE cantidad_vendedores_distintos ${condicion}
     ORDER BY RAND() LIMIT ?`,
    [n]
  );
  return rows.map(r => r.conversacion_id);
}

async function construirMuestra() {
  const estratos = {};
  estratos.venta_cerrada = await muestraPorResultado('venta_cerrada_sin_pago_confirmado', 5);
  estratos.no_venta_confirmada = await muestraPorResultado('no_venta_confirmada', 5);
  estratos.abandonada = await muestraPorResultado('abandonada_sin_respuesta', 5);
  estratos.activo = await muestraPorResultado('activo', 5);
  estratos.con_objeciones = await muestraConObjeciones(6);
  estratos.cortas = await muestraPorTamanio('<= 3', 5);
  estratos.largas = await muestraPorTamanio('>= 20', 5);
  estratos.un_vendedor = await muestraPorVendedores('= 1', 4);
  estratos.multi_vendedor = await muestraPorVendedores('> 1', 4);

  const set = new Set();
  const detalleEstratos = {};
  for (const [nombre, ids] of Object.entries(estratos)) {
    detalleEstratos[nombre] = ids.length;
    ids.forEach(id => set.add(id));
  }

  let idsFinal = [...set];
  if (idsFinal.length > TAMANIO_OBJETIVO + 10) idsFinal = idsFinal.slice(0, TAMANIO_OBJETIVO + 10);

  return { ids: idsFinal, detalleEstratos };
}

async function distribucion(columna, ids) {
  if (ids.length === 0) return [];
  const [rows] = await db.query(
    `SELECT ${columna} AS valor, COUNT(*) AS cantidad
     FROM features_mensaje
     WHERE conversacion_id IN (?) AND ${columna} IS NOT NULL
     GROUP BY ${columna} ORDER BY cantidad DESC`,
    [ids]
  );
  return rows;
}

async function ejemplosAnonimizados(ids, n = 8) {
  const [rows] = await db.query(
    `SELECT mensaje_id, conversacion_id, autor, tipo_mensaje, intencion_principal, tema_principal,
            etapa_embudo, nivel_interes, estado_emocional_prospecto, objecion_principal,
            proxima_accion_sugerida, confianza_clasificacion, mensaje_texto
     FROM features_mensaje
     WHERE conversacion_id IN (?) AND capa2_procesado = 1
     ORDER BY RAND() LIMIT ?`,
    [ids, n]
  );
  return rows.map(r => ({
    mensaje_id: r.mensaje_id,
    conversacion_id: r.conversacion_id,
    autor: r.autor,
    preview_anonimizado: redactarParaLog(r.mensaje_texto, 60),
    tipo_mensaje: r.tipo_mensaje,
    intencion_principal: r.intencion_principal,
    tema_principal: r.tema_principal,
    etapa_embudo: r.etapa_embudo,
    nivel_interes: r.nivel_interes,
    estado_emocional_prospecto: r.estado_emocional_prospecto,
    objecion_principal: r.objecion_principal,
    proxima_accion_sugerida: r.proxima_accion_sugerida,
    confianza: r.confianza_clasificacion,
  }));
}

async function main() {
  console.log('=== Piloto Capa 3 — construyendo muestra estratificada ===');
  const { ids, detalleEstratos } = await construirMuestra();
  console.log(`Conversaciones seleccionadas: ${ids.length}`);
  console.log('Detalle por estrato (con solapamiento esperado):', detalleEstratos);

  console.log('\n=== Procesando conversaciones (llamadas reales a OpenAI) ===');
  const inicio = Date.now();
  const resultados = await pipeline.procesarLote(ids);
  const duracionSeg = ((Date.now() - inicio) / 1000).toFixed(1);

  const totalProcesados = resultados.reduce((a, r) => a + r.procesados, 0);
  const totalRechazados = resultados.reduce((a, r) => a + r.rechazados, 0);
  const totalErroresExcepcion = resultados.reduce((a, r) => a + r.errores.filter(e => e.tipo === 'excepcion').length, 0);
  const totalErroresValidacion = resultados.reduce((a, r) => a + r.errores.filter(e => e.tipo === 'validacion').length, 0);
  const tokensPrompt = resultados.reduce((a, r) => a + (r.tokens ? r.tokens.prompt : 0), 0);
  const tokensCompletion = resultados.reduce((a, r) => a + (r.tokens ? r.tokens.completion : 0), 0);
  const costoUSD = (tokensPrompt / 1e6) * PRECIO_INPUT_POR_1M + (tokensCompletion / 1e6) * PRECIO_OUTPUT_POR_1M;

  const idsConMensajes = resultados.filter(r => r.procesados > 0).map(r => r.conversacionId);

  const [distTipo, distIntencion, distTema, distEtapa, distObjecion, distNivelInteres, ejemplos] = await Promise.all([
    distribucion('tipo_mensaje', idsConMensajes),
    distribucion('intencion_principal', idsConMensajes),
    distribucion('tema_principal', idsConMensajes),
    distribucion('etapa_embudo', idsConMensajes),
    distribucion('objecion_principal', idsConMensajes),
    distribucion('nivel_interes', idsConMensajes),
    ejemplosAnonimizados(idsConMensajes, 8),
  ]);

  const [[{ bajaConfianza, totalConf }]] = await db.query(
    `SELECT SUM(confianza_clasificacion < 0.5) AS bajaConfianza, COUNT(*) AS totalConf
     FROM features_mensaje WHERE conversacion_id IN (?) AND capa2_procesado = 1`,
    [idsConMensajes.length ? idsConMensajes : [0]]
  );

  const inconsistencias = resultados
    .flatMap(r => [
      ...r.errores.map(e => ({ conversacionId: r.conversacionId, severidad: 'error', ...e })),
      ...(r.advertencias || []).map(a => ({ conversacionId: r.conversacionId, severidad: 'advertencia', tipo: 'coherencia_etapa', ...a })),
    ]);

  const totalMensajesPendientesHistorico = (await db.query(
    `SELECT COUNT(*) AS c FROM features_mensaje WHERE capa2_procesado = 0 AND revision_manual = 0`
  ))[0][0].c;

  const costoPorMensaje = totalProcesados ? costoUSD / totalProcesados : 0;
  const costoPorConversacion = ids.length ? costoUSD / ids.length : 0;
  const costoEstimadoHistoricoTotal = costoPorMensaje * (totalProcesados + totalMensajesPendientesHistorico);

  const reporte = {
    fecha: new Date().toISOString(),
    modelo: pipeline.versionActual(),
    conversaciones_seleccionadas: ids.length,
    detalle_estratos: detalleEstratos,
    duracion_segundos: Number(duracionSeg),
    mensajes_procesados: totalProcesados,
    mensajes_rechazados_validacion: totalRechazados,
    errores_excepcion: totalErroresExcepcion,
    errores_validacion: totalErroresValidacion,
    porcentaje_baja_confianza: totalConf ? Number(((bajaConfianza / totalConf) * 100).toFixed(1)) : null,
    distribucion_tipo_mensaje: distTipo,
    distribucion_intencion_principal: distIntencion,
    distribucion_tema_principal: distTema,
    distribucion_etapa_embudo: distEtapa,
    distribucion_objecion_principal: distObjecion,
    distribucion_nivel_interes: distNivelInteres,
    tokens_prompt: tokensPrompt,
    tokens_completion: tokensCompletion,
    costo_estimado_usd_piloto: Number(costoUSD.toFixed(4)),
    costo_estimado_usd_por_conversacion: Number(costoPorConversacion.toFixed(5)),
    costo_estimado_usd_por_mensaje: Number(costoPorMensaje.toFixed(6)),
    mensajes_pendientes_resto_historico: totalMensajesPendientesHistorico,
    costo_estimado_usd_historico_total: Number(costoEstimadoHistoricoTotal.toFixed(2)),
    ejemplos_anonimizados: ejemplos,
    inconsistencias: inconsistencias.slice(0, 30),
  };

  const rutaSalida = __dirname + '/reporte_piloto.json';
  fs.writeFileSync(rutaSalida, JSON.stringify(reporte, null, 2));
  console.log(`\n=== Reporte guardado en ${rutaSalida} ===`);
  console.log(JSON.stringify(reporte, null, 2));
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error('❌ Error en piloto:', err);
    process.exit(1);
  });
}

module.exports = { construirMuestra };
