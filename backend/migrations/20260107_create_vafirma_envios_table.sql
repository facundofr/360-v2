-- =====================================================
-- Script SQL para crear tabla polizas_vafirma_envios
-- Ejecutar directamente en MySQL
-- =====================================================

CREATE TABLE IF NOT EXISTS polizas_vafirma_envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  poliza_id INT NOT NULL UNIQUE,
  doc_uuid VARCHAR(255) NOT NULL UNIQUE,
  estado_firma VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, signed, rejected, expired',
  email_firmante VARCHAR(255) NOT NULL,
  telefono_firmante VARCHAR(50),
  requiere_biometria TINYINT(1) DEFAULT 1,
  tipo_firma VARCHAR(50) DEFAULT 'Simple' COMMENT 'Simple, Advanced, Biometric',
  enviado_en TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  firmado_en TIMESTAMP NULL,
  usuario_id INT,
  intentos INT DEFAULT 1,
  notas TEXT,
  
  INDEX idx_poliza_id (poliza_id),
  INDEX idx_doc_uuid (doc_uuid),
  INDEX idx_estado_firma (estado_firma),
  INDEX idx_enviado_en (enviado_en),
  
  FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar que la tabla se creó correctamente
SELECT 'Tabla polizas_vafirma_envios creada correctamente' AS resultado;
DESC polizas_vafirma_envios;
