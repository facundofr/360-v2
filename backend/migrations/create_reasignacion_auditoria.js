// Cargar variables de entorno del backend/.env
require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
// Logger simple para migración (fallback)
const logger = { info: console.log, error: console.error };

/**
 * Script de migración para crear tabla de auditoría de reasignaciones
 * Ejecutar: node backend/migrations/create_reasignacion_auditoria.js
 */

const crearTabla = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS reasignacion_auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_prospecto INT NOT NULL,
      id_vendedor_anterior INT,
      id_vendedor_nuevo INT NOT NULL,
      motivo VARCHAR(255),
      fecha_reasignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      razon_automatica VARCHAR(255),
      FOREIGN KEY (id_prospecto) REFERENCES prospectos(id) ON DELETE CASCADE,
      FOREIGN KEY (id_vendedor_anterior) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (id_vendedor_nuevo) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_prospecto (id_prospecto),
      INDEX idx_vendedor_anterior (id_vendedor_anterior),
      INDEX idx_vendedor_nuevo (id_vendedor_nuevo),
      INDEX idx_fecha (fecha_reasignacion),
      INDEX idx_fecha_prospecto (fecha_reasignacion, id_prospecto)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await db.query(sql);
    logger.info('✅ Tabla reasignacion_auditoria creada/verificada correctamente');
    return true;
  } catch (error) {
    logger.error('❌ Error creando tabla reasignacion_auditoria:', error);
    throw error;
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  crearTabla()
    .then(() => {
      console.log('✅ Migración completada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en migración:', error.message);
      process.exit(1);
    });
}

module.exports = { crearTabla };
