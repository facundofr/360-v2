// Migración Capa 3 — enriquecimiento semántico de features_mensaje
// Ejecutar: node backend/migrations/20260714_create_capa3_semantica.js
//
// Alcance (ver confirmación entregada al usuario antes de aplicar esta migración):
// - CREATE TABLE IF NOT EXISTS taxonomia_valores
// - CREATE TABLE IF NOT EXISTS features_mensaje_historial_clasificacion
// - ALTER TABLE features_mensaje ADD COLUMN IF NOT EXISTS (idempotente, MariaDB 10.11)
// No toca ninguna tabla operativa del sistema.

require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../config/db');
const logger = { info: console.log, error: console.error };

// Columnas nuevas requeridas por el diseño de Capa 3.
// capa2_procesado / capa2_procesado_at / capa2_modelo_version ya existen desde la Capa 2;
// se listan igual acá con IF NOT EXISTS para que la migración sea segura de re-ejecutar
// en cualquier entorno, incluso si Capa 2 no se aplicó todavía.
const COLUMNAS_FEATURES_MENSAJE = [
  `ADD COLUMN IF NOT EXISTS etapa_embudo VARCHAR(30) NULL COMMENT 'Capa3: etapa del embudo comercial en el momento del mensaje'`,
  `ADD COLUMN IF NOT EXISTS nivel_interes VARCHAR(20) NULL COMMENT 'Capa3: solo autor=cliente'`,
  `ADD COLUMN IF NOT EXISTS objecion_principal VARCHAR(30) NULL COMMENT 'Capa3: NULL si contiene_objecion=0'`,
  `ADD COLUMN IF NOT EXISTS prestador_mencionado VARCHAR(150) NULL COMMENT 'Capa3: normalizado contra prestadores.nombre'`,
  `ADD COLUMN IF NOT EXISTS porcentaje_mencionado DECIMAL(5,2) NULL COMMENT 'Capa3: extraccion por regla'`,
  `ADD COLUMN IF NOT EXISTS grupo_familiar_detalle VARCHAR(255) NULL COMMENT 'Capa3: vinculo+cantidad detectados en el mensaje'`,
  `ADD COLUMN IF NOT EXISTS contiene_intencion_abandono TINYINT(1) UNSIGNED NULL`,
  `ADD COLUMN IF NOT EXISTS requiere_seguimiento TINYINT(1) UNSIGNED NULL`,
  `ADD COLUMN IF NOT EXISTS conversacion_estancada TINYINT(1) UNSIGNED NULL COMMENT 'Capa3: regla, no IA'`,
  `ADD COLUMN IF NOT EXISTS proxima_accion_sugerida VARCHAR(30) NULL`,
  `ADD COLUMN IF NOT EXISTS confianza_clasificacion DECIMAL(4,3) NULL COMMENT '0.000-1.000'`,
  `ADD COLUMN IF NOT EXISTS revision_manual TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Protege la fila de reprocesamiento automatico'`,
  `ADD COLUMN IF NOT EXISTS capa2_procesado TINYINT(1) UNSIGNED NOT NULL DEFAULT 0`,
  `ADD COLUMN IF NOT EXISTS capa2_procesado_at DATETIME NULL`,
  `ADD COLUMN IF NOT EXISTS capa2_modelo_version VARCHAR(80) NULL`,
];

async function alterFeaturesMensaje() {
  for (const clausula of COLUMNAS_FEATURES_MENSAJE) {
    const sql = `ALTER TABLE features_mensaje ${clausula}`;
    await db.query(sql);
  }
  logger.info('✅ features_mensaje: columnas de Capa 3 verificadas/agregadas');
}

async function crearTaxonomiaValores() {
  const sql = `
    CREATE TABLE IF NOT EXISTS taxonomia_valores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      taxonomia VARCHAR(50) NOT NULL,
      valor VARCHAR(50) NOT NULL,
      descripcion VARCHAR(500) NULL,
      version VARCHAR(20) NOT NULL DEFAULT 'v1',
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_taxonomia_valor_version (taxonomia, valor, version),
      INDEX idx_taxonomia_activo (taxonomia, activo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
  logger.info('✅ taxonomia_valores: tabla verificada/creada');
}

async function crearHistorialClasificacion() {
  const sql = `
    CREATE TABLE IF NOT EXISTS features_mensaje_historial_clasificacion (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      mensaje_id INT NOT NULL,
      conversacion_id INT NOT NULL,
      columna VARCHAR(60) NOT NULL,
      valor_anterior TEXT NULL,
      valor_nuevo TEXT NULL,
      modelo_utilizado VARCHAR(80) NULL,
      version_prompt VARCHAR(20) NULL,
      version_taxonomia VARCHAR(20) NULL,
      confianza DECIMAL(4,3) NULL,
      origen_modificacion ENUM('ia','manual') NOT NULL DEFAULT 'ia',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mensaje (mensaje_id),
      INDEX idx_conversacion (conversacion_id),
      CONSTRAINT fk_hist_mensaje FOREIGN KEY (mensaje_id) REFERENCES features_mensaje(mensaje_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
  logger.info('✅ features_mensaje_historial_clasificacion: tabla verificada/creada');
}

async function main() {
  try {
    await crearTaxonomiaValores();
    await crearHistorialClasificacion();
    await alterFeaturesMensaje();
    logger.info('✅ Migración Capa 3 completada');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error en migración Capa 3:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crearTaxonomiaValores, crearHistorialClasificacion, alterFeaturesMensaje };
