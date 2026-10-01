// Corrige las columnas P (Primer Mensaje) y Q (Registro de Llamada Telefónica) de la
// hoja "Prospectos" en Google Sheets, filtrando ambas al VENDEDOR ACTUALMENTE ASIGNADO
// al prospecto (mismo criterio que ya usa actualizarAsignacionEnSheet: la fila de
// `asignaciones` con fecha_asignacion más reciente). Si hubo reasignación, el dato que
// queda es el del vendedor que siguió trabajando el lead, no el de un vendedor anterior.
//
// - Columna Q (llamada): usa `historial_acciones` (accion = 'llamada_telefonica'), que es
//   la única fuente de este evento y es append-only (nunca se actualiza ni se borra). Hoy
//   se pisa porque actualizarRegistroLlamadaEnSheet escribe literalmente "ahora" en cada
//   llamada, sin MIN().
// - Columna P (primer mensaje WhatsApp): usa `chat_mensajes` (vía
//   chat_conversaciones_whatsapp.vendedor_id), NO `historial_acciones`. El evento
//   'whatsapp_primer_contacto' solo se registra cuando el vendedor aprieta el botón
//   "marcar primer contacto"; hay ~2629 prospectos con mensajes reales del vendedor actual
//   que nunca pasaron por ese botón, así que usar historial_acciones ahí borraría datos
//   correctos. chat_mensajes ya es la fuente que usa hoy actualizarAsignacionEnSheet
//   (MIN(cm.created_at)), solo le agregamos el filtro por vendedor actual.
//
// Uso:
//   node backend/scripts/backfill_primer_contacto_sheet.js            (dry-run, no escribe nada)
//   node backend/scripts/backfill_primer_contacto_sheet.js --apply    (ejecuta los cambios)

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const GoogleSheetsService = require('../services/googleSheetsService');

const APLICAR = process.argv.includes('--apply');
const SHEET_NAME = 'Prospectos';
const LOTE_RANGOS = 200; // rangos por llamada a batchUpdate

function formatDateForSheet(d) {
  if (!d) return '';
  const date = new Date(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimeForSheet(d) {
  if (!d) return '';
  if (typeof d === 'string') {
    const timeMatch = d.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
  }
  const date = new Date(d);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatDateTimeForSheet(d) {
  if (!d) return '';
  return `${formatDateForSheet(d)} ${formatTimeForSheet(d)}`;
}

async function obtenerFilasSheet(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:Q`,
  });
  return response.data.values || [];
}

async function obtenerDatosBD(prospectoIds) {
  if (prospectoIds.length === 0) return new Map();

  const [rows] = await db.query(
    `SELECT
       p.id AS prospecto_id,
       cur.id_vendedor AS vendedor_actual,
       (SELECT MIN(cm.created_at) FROM chat_conversaciones_whatsapp ccw
          JOIN chat_mensajes cm ON cm.conversacion_id = ccw.id AND cm.origen = 'vendedor'
          WHERE ccw.prospecto_id = p.id AND ccw.vendedor_id = cur.id_vendedor) AS primer_whatsapp,
       (SELECT MIN(h.fecha) FROM historial_acciones h
          WHERE h.id_prospecto = p.id AND h.id_vendedor = cur.id_vendedor
            AND h.accion = 'llamada_telefonica') AS primera_llamada
     FROM prospectos p
     LEFT JOIN asignaciones cur ON cur.id = (
       SELECT id FROM asignaciones WHERE id_prospecto = p.id
       ORDER BY fecha_asignacion DESC, id DESC LIMIT 1
     )
     WHERE p.id IN (?)`,
    [prospectoIds]
  );

  const mapa = new Map();
  for (const row of rows) {
    mapa.set(String(row.prospecto_id), row);
  }
  return mapa;
}

async function main() {
  console.log(APLICAR ? '⚠️  Modo APLICAR: se van a escribir cambios en Google Sheets' : 'ℹ️  Modo dry-run: no se escribe nada (usar --apply para ejecutar)');

  const sheets = await GoogleSheetsService.init();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '17t4dxe-sKz4YTJHhbqmcidZsSWrzSiR024I_kyyqDw8';

  const filas = await obtenerFilasSheet(sheets, spreadsheetId);
  if (filas.length <= 1) {
    console.log('No hay filas de datos en la hoja.');
    process.exit(0);
  }

  const dataRows = filas.slice(1); // sin header
  const prospectoIds = dataRows.map(r => String(r[0] || '')).filter(Boolean);

  console.log(`Encontrados ${prospectoIds.length} prospectos en la hoja "${SHEET_NAME}"`);

  const datosBD = await obtenerDatosBD(prospectoIds);

  const detalle = [];
  const updates = [];
  let sinVendedor = 0;
  let sinCambios = 0;

  dataRows.forEach((fila, idx) => {
    const prospectoId = String(fila[0] || '');
    if (!prospectoId) return;

    const filaNum = idx + 2; // +1 por header, +1 porque los índices son 0-based
    const datos = datosBD.get(prospectoId);

    if (!datos || !datos.vendedor_actual) {
      sinVendedor++;
      return;
    }

    const pActualSheet = fila[15] || '';
    const qActualSheet = fila[16] || '';

    const pNuevo = datos.primer_whatsapp ? formatDateTimeForSheet(datos.primer_whatsapp) : '';
    const qNuevo = datos.primera_llamada ? formatDateTimeForSheet(datos.primera_llamada) : '';

    if (pNuevo === pActualSheet && qNuevo === qActualSheet) {
      sinCambios++;
      return;
    }

    detalle.push({
      prospecto_id: prospectoId,
      vendedor_actual: datos.vendedor_actual,
      P_actual: pActualSheet,
      P_nuevo: pNuevo,
      Q_actual: qActualSheet,
      Q_nuevo: qNuevo,
    });

    updates.push({
      range: `${SHEET_NAME}!P${filaNum}:Q${filaNum}`,
      values: [[pNuevo, qNuevo]],
    });
  });

  console.log('\n=== Resumen ===');
  console.log({
    total_filas: dataRows.length,
    a_actualizar: updates.length,
    sin_cambios: sinCambios,
    sin_vendedor_o_historial_actual: sinVendedor,
  });

  console.log('\n=== Detalle (primeras 30 filas a actualizar) ===');
  console.table(detalle.slice(0, 30));

  if (!APLICAR) {
    console.log('\nDry-run: no se escribió nada. Ejecutá con --apply para aplicar los cambios.');
    process.exit(0);
  }

  if (updates.length === 0) {
    console.log('\nNada para actualizar.');
    process.exit(0);
  }

  let escritos = 0;
  for (let i = 0; i < updates.length; i += LOTE_RANGOS) {
    const lote = updates.slice(i, i + LOTE_RANGOS);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: lote,
      },
    });
    escritos += lote.length;
    console.log(`  ✅ Lote escrito: ${escritos}/${updates.length}`);
  }

  console.log(`\n✅ Backfill completado. ${escritos} filas actualizadas.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error en backfill_primer_contacto_sheet:', error);
  process.exit(1);
});
