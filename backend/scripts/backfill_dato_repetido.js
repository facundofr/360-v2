// Reprocesa el backlog de prospectos marcados como 'Dato repetido' aplicando
// la misma regla que ahora corre en el alta en vivo (formController.js):
// si el original quedó "sin evolución" (Lead / 1º Contacto / No contesta)
// por 14+ días, el duplicado se reingresa como dato nuevo y se reasigna
// a otro vendedor.
//
// Uso:
//   node backend/scripts/backfill_dato_repetido.js            (dry-run, no escribe nada)
//   node backend/scripts/backfill_dato_repetido.js --apply    (ejecuta los cambios)

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const DuplicadosService = require('../services/DuplicadosService');
const ReAsignacionAutomatica = require('../models/ReAsignacionAutomatica');

const APLICAR = process.argv.includes('--apply');

async function obtenerOriginal(prospectoDuplicado) {
  const [rows] = await db.query(
    `SELECT id FROM prospectos
     WHERE numero_contacto = ? AND id <> ? AND fecha_hora_registro < ?
     ORDER BY fecha_hora_registro DESC LIMIT 1`,
    [prospectoDuplicado.numero_contacto, prospectoDuplicado.id, prospectoDuplicado.fecha_hora_registro]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function procesarUno(prospecto) {
  const idOriginal = await obtenerOriginal(prospecto);
  const evaluacion = await DuplicadosService.evaluarReingreso(idOriginal);

  if (!evaluacion.reingresable) {
    return { id: prospecto.id, accion: 'omitido', motivo: evaluacion.motivo };
  }

  const nuevoVendedor = await ReAsignacionAutomatica.obtenerVendedorDisponible(evaluacion.idVendedorOriginal);
  if (!nuevoVendedor) {
    return { id: prospecto.id, accion: 'omitido', motivo: 'No hay vendedores disponibles' };
  }

  if (!APLICAR) {
    return { id: prospecto.id, accion: 'reingresaria', motivo: evaluacion.motivo, vendedorNuevo: nuevoVendedor.id };
  }

  const [contadorRows] = await db.query(
    'SELECT COALESCE(MAX(veces_reciclado), 0) + 1 AS contador FROM prospectos WHERE numero_contacto = ?',
    [prospecto.numero_contacto]
  );
  const vecesReciclado = contadorRows[0].contador;

  await db.query(
    `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado)
     VALUES (?, ?, 'Lead', ?, NOW())`,
    [prospecto.id, nuevoVendedor.id, `Reingreso automático (backfill) - dato repetido sin evolución (${evaluacion.motivo})`]
  );

  await db.query(
    'UPDATE prospectos SET estado = ?, es_reciclado = 1, veces_reciclado = ? WHERE id = ?',
    ['Lead', vecesReciclado, prospecto.id]
  );

  await db.query(
    `INSERT INTO reasignacion_auditoria (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, motivo, razon_automatica)
     VALUES (?, ?, ?, ?, ?)`,
    [prospecto.id, evaluacion.idVendedorOriginal, nuevoVendedor.id, 'Reingreso automático de dato repetido (backfill)', evaluacion.motivo]
  );

  return { id: prospecto.id, accion: 'reingresado', motivo: evaluacion.motivo, vendedorNuevo: nuevoVendedor.id };
}

async function main() {
  console.log(APLICAR ? '⚠️  Modo APLICAR: se van a escribir cambios' : 'ℹ️  Modo dry-run: no se escribe nada (usar --apply para ejecutar)');

  const [pendientes] = await db.query(
    `SELECT id, numero_contacto, fecha_hora_registro
     FROM prospectos
     WHERE estado = 'Dato repetido'
     ORDER BY fecha_hora_registro ASC`
  );

  console.log(`Encontrados ${pendientes.length} prospectos en estado 'Dato repetido'`);

  const resumen = { reingresado: 0, reingresaria: 0, omitido: 0 };
  const detalle = [];

  for (const prospecto of pendientes) {
    const resultado = await procesarUno(prospecto);
    resumen[resultado.accion] = (resumen[resultado.accion] || 0) + 1;
    detalle.push(resultado);
  }

  console.log('\n=== Resumen ===');
  console.log(resumen);

  console.log('\n=== Detalle (primeros 30) ===');
  console.table(detalle.slice(0, 30));

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error en backfill_dato_repetido:', error);
  process.exit(1);
});
