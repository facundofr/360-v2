#!/usr/bin/env node

/**
 * Script: Upsert de envío VaFirma por número de póliza oficial
 * - Busca `poliza_id` por `numero_poliza_oficial` (o `numero_poliza`)
 * - Asegura que la tabla permita múltiples envíos por póliza (quita UNIQUE en poliza_id si existe)
 * - Inserta o actualiza el registro para `doc_uuid` con estado proporcionado
 *
 * Uso:
 *   node upsert_vafirma_envio.js --numero 32542345237 \
 *     --doc 6a1224a4-c4c3-4b3f-bd8f-9234e5cf674a \
 *     --email ss@grupocober.online \
 *     --estado signed \
 *     --fecha "2026-03-25 19:03:20"
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function ensureMultiEnvios() {
  const [indexes] = await db.query('SHOW INDEX FROM polizas_vafirma_envios');
  const hasUniquePoliza = indexes.some(idx => idx.Key_name === 'poliza_id' && idx.Non_unique === 0);
  if (hasUniquePoliza) {
    console.log('🔧 Eliminando índice UNIQUE en poliza_id (permitir múltiples envíos por póliza)...');
    try {
      await db.query('ALTER TABLE polizas_vafirma_envios DROP INDEX `poliza_id`');
      console.log('✅ UNIQUE(poliza_id) eliminado');
    } catch (e) {
      console.log(`⚠️  No se pudo eliminar UNIQUE(poliza_id): ${e.message}`);
    }
  }
}

async function findPolizaId(numero) {
  const [rows] = await db.query(
    `SELECT id, numero_poliza_oficial, numero_poliza, estado
     FROM polizas
     WHERE numero_poliza_oficial = ? OR numero_poliza = ?
     ORDER BY id DESC
     LIMIT 1`,
    [numero, numero]
  );
  return rows && rows.length ? rows[0] : null;
}

async function upsertEnvio({ polizaId, docUUID, email, estado, fecha, requiereBiometria = 1, tipoFirma = 'Simple' }) {
  // Si ya existe el doc_uuid, actualizar; si no, insertar
  const [exists] = await db.query(
    'SELECT id, estado_firma FROM polizas_vafirma_envios WHERE doc_uuid = ? LIMIT 1',
    [docUUID]
  );

  if (exists && exists.length) {
    const id = exists[0].id;
    console.log(`🔁 Actualizando registro existente id=${id} (doc_uuid coincidente)`);
    const [res] = await db.query(
      `UPDATE polizas_vafirma_envios
       SET estado_firma = ?, actualizado_en = NOW(),
           firmado_en = CASE WHEN ? = 'signed' THEN COALESCE(?, NOW()) ELSE firmado_en END
       WHERE id = ?`,
      [estado, estado, fecha || null, id]
    );
    return res.affectedRows;
  }

  console.log('➕ Insertando nuevo envío VaFirma para la póliza...');
  const [res] = await db.query(
    `INSERT INTO polizas_vafirma_envios
      (poliza_id, doc_uuid, estado_firma, email_firmante, telefono_firmante,
       requiere_biometria, tipo_firma, enviado_en, actualizado_en, firmado_en)
     VALUES (?, ?, ?, ?, NULL, ?, ?, NOW(), NOW(), CASE WHEN ? = 'signed' THEN ? ELSE NULL END)`,
    [polizaId, docUUID, estado, email, requiereBiometria ? 1 : 0, tipoFirma, estado, fecha || null]
  );
  return res.affectedRows;
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const numero = args.numero || args.nro || args.oficial;
    const docUUID = args.doc || args.docuuid || args.uuid;
    const email = args.email || null;
    const estado = (args.estado || 'signed').toLowerCase().trim();
    const fecha = args.fecha || null; // 'YYYY-MM-DD HH:mm:ss'

    if (!numero || !docUUID) {
      console.log('\nUso: node upsert_vafirma_envio.js --numero <numero_oficial> --doc <docUUID> [--email <email>] [--estado signed|pending|rejected|expired] [--fecha "YYYY-MM-DD HH:mm:ss"]\n');
      process.exit(1);
    }

    console.log(`\n🔍 Buscando póliza por número oficial: ${numero}`);
    await ensureMultiEnvios();

    const poliza = await findPolizaId(numero);
    if (!poliza) {
      console.error('❌ No se encontró póliza con ese número.');
      process.exit(2);
    }

    console.log(`✅ Póliza encontrada: id=${poliza.id}, numero_oficial=${poliza.numero_poliza_oficial}, estado=${poliza.estado}`);

    const affected = await upsertEnvio({ polizaId: poliza.id, docUUID, email, estado, fecha, requiereBiometria: 1, tipoFirma: 'Simple' });
    console.log(`\n✅ BD actualizada. Filas afectadas: ${affected}`);

    // Mostrar resumen agregado para esa póliza
    const [agg] = await db.query(
      `SELECT 
         MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed') THEN 1 ELSE 0 END) AS any_signed,
         MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('pending') THEN 1 ELSE 0 END) AS any_pending,
         COUNT(*) AS total_envios
       FROM polizas_vafirma_envios WHERE poliza_id = ?`,
      [poliza.id]
    );
    const a = agg[0] || {};
    console.log(`\n📊 Estado agregado: any_signed=${a.any_signed} any_pending=${a.any_pending} total_envios=${a.total_envios}`);

    await db.end();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    try { await db.end(); } catch (_) {}
    process.exit(1);
  }
}

main();
