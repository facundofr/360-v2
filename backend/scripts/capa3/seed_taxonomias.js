// Puebla taxonomia_valores a partir de taxonomias.js. Idempotente (upsert).
// Ejecutar: node backend/scripts/capa3/seed_taxonomias.js

require('dotenv').config({ path: __dirname + '/../../.env' });
const db = require('../../config/db');
const { VERSION, TAXONOMIAS } = require('./taxonomias');

async function seed() {
  let insertados = 0;
  for (const [taxonomia, def] of Object.entries(TAXONOMIAS)) {
    for (const [valor, descripcion] of Object.entries(def.valores)) {
      await db.query(
        `INSERT INTO taxonomia_valores (taxonomia, valor, descripcion, version, activo)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activo = 1`,
        [taxonomia, valor, descripcion, VERSION]
      );
      insertados++;
    }
  }
  console.log(`✅ taxonomia_valores: ${insertados} valores verificados/insertados (version ${VERSION})`);
}

async function main() {
  try {
    await seed();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error poblando taxonomia_valores:', error);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { seed };
