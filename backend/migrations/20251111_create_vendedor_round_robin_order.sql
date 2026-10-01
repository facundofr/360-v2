-- Migración: Crear tabla para gestionar orden de rotación en round-robin
-- Fecha: 2025-11-11
-- Descripción: Tabla para evitar race conditions en asignación rápida de prospectos
-- Soluciona: Problema donde múltiples asignaciones rápidas iban al mismo vendedor

CREATE TABLE IF NOT EXISTS vendedor_round_robin_order (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID único del registro',
  categoria_id INT NOT NULL COMMENT 'ID de la categoría (Expert, Senior, Junior)',
  vendedor_id INT NOT NULL COMMENT 'ID del vendedor',
  orden_rotacion BIGINT DEFAULT 0 COMMENT 'Contador secuencial para determinar próximo en rotación',
  fecha_ultima_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Última vez que este vendedor fue asignado',
  
  -- Restricciones de unicidad y relaciones
  UNIQUE KEY unique_categoria_vendedor (categoria_id, vendedor_id) COMMENT 'Un vendedor por categoría',
  FOREIGN KEY (categoria_id) REFERENCES categorias_config(id) ON DELETE CASCADE COMMENT 'Relación con categorías',
  FOREIGN KEY (vendedor_id) REFERENCES users(id) ON DELETE CASCADE COMMENT 'Relación con usuarios',
  
  -- Índices para performance
  INDEX idx_categoria_orden (categoria_id, orden_rotacion) COMMENT 'Índice para búsqueda rápida del siguiente vendedor'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla de control de rotación round-robin para distribución de prospectos';

-- Insertar registros iniciales para vendedores actuales
-- (Esta parte se ejecutará después de que la tabla sea creada)

-- Ejemplo de cómo se usará en el futuro:
-- SELECT * FROM vendedor_round_robin_order 
-- WHERE categoria_id = 2 
-- ORDER BY orden_rotacion ASC 
-- LIMIT 1 FOR UPDATE;
--
-- UPDATE vendedor_round_robin_order 
-- SET orden_rotacion = orden_rotacion + 10
-- WHERE id = ? AND categoria_id = ?;
