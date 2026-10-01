// Auditoría manual previa (Sección 3 del pedido): selecciona una muestra estratificada
// de mensajes YA procesados y genera un reporte revisable por un humano, sin alterar
// ningún resultado. Solo lectura sobre features_mensaje / features_conversacion.
//
// Uso: node backend/scripts/capa3/auditoria_manual.js [--n 100]

require('dotenv').config({ path: __dirname + '/../../.env' });
const fs = require('fs');
const db = require('../../config/db');
const { validar } = require('../../services/capa3/validaciones');
const { enmascararParaIA } = require('../../services/capa3/enmascarado');

function parseN() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--n');
  return idx >= 0 ? parseInt(args[idx + 1], 10) : 100;
}

async function candidatosBase() {
  const [rows] = await db.query(`
    SELECT fm.mensaje_id, fm.conversacion_id, fm.orden_mensaje_humano, fm.autor,
           fm.mensaje_texto, fm.tipo_mensaje, fm.intencion_principal, fm.tema_principal,
           fm.etapa_embudo, fm.nivel_interes, fm.estado_emocional_prospecto,
           fm.objecion_principal, fm.contiene_objecion, fm.proxima_accion_sugerida,
           fm.confianza_clasificacion, fc.resultado_final, fc.grupo_dataset
    FROM features_mensaje fm
    JOIN features_conversacion fc ON fc.conversacion_id = fm.conversacion_id
    WHERE fm.capa2_procesado = 1
  `);
  return rows;
}

function muestrear(candidatos, n) {
  const seleccion = new Map();
  const agregar = (lista, tope) => {
    let c = 0;
    for (const m of lista) {
      if (seleccion.size >= n) return;
      if (seleccion.has(m.mensaje_id)) continue;
      seleccion.set(m.mensaje_id, m);
      c++;
      if (c >= tope) break;
    }
  };

  const porTipo = {};
  candidatos.forEach(m => { (porTipo[m.tipo_mensaje] = porTipo[m.tipo_mensaje] || []).push(m); });
  for (const tipo of Object.keys(porTipo)) agregar(porTipo[tipo], 4);

  const porIntencion = {};
  candidatos.forEach(m => { (porIntencion[m.intencion_principal] = porIntencion[m.intencion_principal] || []).push(m); });
  for (const i of Object.keys(porIntencion)) agregar(porIntencion[i], 3);

  const porEtapa = {};
  candidatos.forEach(m => { (porEtapa[m.etapa_embudo] = porEtapa[m.etapa_embudo] || []).push(m); });
  for (const e of Object.keys(porEtapa)) agregar(porEtapa[e], 3);

  agregar(candidatos.filter(m => m.contiene_objecion), 20);
  agregar(candidatos.filter(m => m.tipo_mensaje === 'otro'), 10);
  agregar(candidatos.filter(m => m.autor === 'cliente'), 15);
  agregar(candidatos.filter(m => m.autor === 'vendedor'), 15);
  agregar([...candidatos].sort((a, b) => a.confianza_clasificacion - b.confianza_clasificacion), 15); // confianza mas baja disponible
  agregar([...candidatos].sort((a, b) => b.confianza_clasificacion - a.confianza_clasificacion), 5); // confianza mas alta
  agregar(candidatos.filter(m => (m.resultado_final || '').startsWith('venta_')), 10);
  agregar(candidatos.filter(m => m.resultado_final === 'no_venta_confirmada' || m.resultado_final === 'abandonada_sin_respuesta'), 10);

  if (seleccion.size < n) agregar(candidatos, n); // completa con lo que falte

  return [...seleccion.values()].slice(0, n);
}

async function contextoAnterior(conversacionId, ordenActual, ventana = 3) {
  const [rows] = await db.query(
    `SELECT autor, mensaje_texto FROM features_mensaje
     WHERE conversacion_id = ? AND orden_mensaje_humano < ?
     ORDER BY orden_mensaje_humano DESC LIMIT ?`,
    [conversacionId, ordenActual, ventana]
  );
  return rows.reverse().map(r => `[${r.autor}] ${enmascararParaIA(r.mensaje_texto)}`);
}

async function main() {
  const n = parseN();
  const candidatos = await candidatosBase();
  const muestra = muestrear(candidatos, Math.min(n, candidatos.length));

  const filas = [];
  for (const m of muestra) {
    const contexto = await contextoAnterior(m.conversacion_id, m.orden_mensaje_humano);
    const revalidacion = validar(
      { autor: m.autor, etapa_embudo_anterior: null },
      {
        tipo_mensaje: m.tipo_mensaje, intencion_principal: m.intencion_principal, tema_principal: m.tema_principal,
        etapa_embudo: m.etapa_embudo, nivel_interes: m.nivel_interes, estado_emocional_prospecto: m.estado_emocional_prospecto,
        objecion_principal: m.objecion_principal, contiene_objecion: !!m.contiene_objecion,
        proxima_accion_sugerida: m.proxima_accion_sugerida, confianza: Number(m.confianza_clasificacion),
      }
    );
    filas.push({
      mensaje_id: m.mensaje_id,
      conversacion_id: m.conversacion_id,
      autor: m.autor,
      texto_anonimizado: enmascararParaIA(m.mensaje_texto),
      contexto_anterior_anonimizado: contexto,
      clasificacion: {
        tipo_mensaje: m.tipo_mensaje, intencion_principal: m.intencion_principal, tema_principal: m.tema_principal,
        etapa_embudo: m.etapa_embudo, nivel_interes: m.nivel_interes, estado_emocional_prospecto: m.estado_emocional_prospecto,
        objecion_principal: m.objecion_principal, proxima_accion_sugerida: m.proxima_accion_sugerida,
      },
      confianza: Number(m.confianza_clasificacion),
      resultado_final_conversacion: m.resultado_final,
      grupo_dataset: m.grupo_dataset,
      advertencias_revalidacion: revalidacion.advertencias,
    });
  }

  const rutaJson = __dirname + '/auditoria_manual_muestra.json';
  fs.writeFileSync(rutaJson, JSON.stringify(filas, null, 2));

  const md = ['# Auditoría manual previa — muestra estratificada\n', `Mensajes en la muestra: ${filas.length} (de ${candidatos.length} ya procesados)\n`];
  for (const f of filas) {
    md.push(`## Mensaje ${f.mensaje_id} (conversación ${f.conversacion_id}, ${f.autor})`);
    if (f.contexto_anterior_anonimizado.length) {
      md.push('**Contexto anterior:**');
      f.contexto_anterior_anonimizado.forEach(l => md.push(`- ${l}`));
    }
    md.push(`**Mensaje:** ${f.texto_anonimizado}`);
    md.push(`**Clasificación:** ${JSON.stringify(f.clasificacion)}`);
    md.push(`**Confianza:** ${f.confianza} | **Resultado conversación:** ${f.resultado_final_conversacion} | **Dataset:** ${f.grupo_dataset}`);
    if (f.advertencias_revalidacion.length) md.push(`**Advertencias:** ${f.advertencias_revalidacion.join('; ')}`);
    md.push('');
  }
  const rutaMd = __dirname + '/auditoria_manual_muestra.md';
  fs.writeFileSync(rutaMd, md.join('\n'));

  console.log(`✅ Muestra de auditoría: ${filas.length} mensajes`);
  console.log(`   JSON: ${rutaJson}`);
  console.log(`   Markdown: ${rutaMd}`);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('❌', e); process.exit(1); });
}
