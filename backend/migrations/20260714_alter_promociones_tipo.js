// Migración: permite que una promoción sea de tipo "descuento" (resta al precio)
// o "incremento" (suma al precio). Antes solo existía descuento_porcentaje sin signo,
// por lo que toda promoción se restaba del precio sin excepción.
// Ejecutar: node backend/migrations/20260714_alter_promociones_tipo.js

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');

async function main() {
  try {
    await db.query(`
      ALTER TABLE promociones
        ADD COLUMN IF NOT EXISTS tipo ENUM('descuento','incremento') NOT NULL DEFAULT 'descuento' AFTER descuento_porcentaje
    `);
    console.log('✅ promociones: columna tipo agregada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración de tipo de promociones:', error);
    process.exit(1);
  }
}

if (require.main === module) main();
