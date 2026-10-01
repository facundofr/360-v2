-- Tabla para almacenar cupones de pago de MercadoPago
-- Ejecutar: mysql -u root -p cober360 < create_cupones_pago.sql

CREATE TABLE IF NOT EXISTS cupones_pago (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cotizacion_id INT NOT NULL,
  prospecto_id INT NOT NULL,
  preferencia_id VARCHAR(255) NOT NULL,
  payment_id VARCHAR(255) NULL,
  checkout_url TEXT NOT NULL,
  external_reference VARCHAR(255) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  fecha_vencimiento DATETIME NOT NULL,
  estado ENUM('activo', 'pendiente', 'pagado', 'rechazado', 'cancelado', 'expirado') DEFAULT 'activo',
  estado_pago VARCHAR(50) NULL COMMENT 'Estado del pago en MercadoPago',
  primer_envio_whatsapp DATETIME NULL,
  ultimo_envio_whatsapp DATETIME NULL,
  contador_envios INT DEFAULT 0,
  fecha_pago DATETIME NULL,
  metadatos JSON NULL COMMENT 'Metadatos adicionales de MercadoPago',
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices
  INDEX idx_cotizacion_id (cotizacion_id),
  INDEX idx_prospecto_id (prospecto_id),
  INDEX idx_preferencia_id (preferencia_id),
  INDEX idx_external_reference (external_reference),
  INDEX idx_estado (estado),
  INDEX idx_fecha_vencimiento (fecha_vencimiento),
  
  -- Claves foráneas (si existen las tablas referenciadas)
  FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (prospecto_id) REFERENCES prospectos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar comentario a la tabla
ALTER TABLE cupones_pago COMMENT = 'Cupones de pago generados con MercadoPago para cotizaciones';

-- Crear vista para consultas frecuentes
CREATE OR REPLACE VIEW vista_cupones_pago AS
SELECT 
  cp.*,
  p.nombre as prospecto_nombre,
  p.apellido as prospecto_apellido,
  p.correo as prospecto_email,
  p.numero_contacto as prospecto_telefono,
  c.plan_id,
  pl.nombre as plan_nombre,
  c.total_final as cotizacion_total,
  CASE 
    WHEN cp.fecha_vencimiento < NOW() AND cp.estado = 'activo' THEN 'expirado'
    ELSE cp.estado 
  END as estado_actual
FROM cupones_pago cp
JOIN prospectos p ON cp.prospecto_id = p.id
JOIN cotizaciones c ON cp.cotizacion_id = c.id
LEFT JOIN planes pl ON c.plan_id = pl.id;

-- Crear procedimiento para limpiar cupones expirados
DELIMITER //
CREATE PROCEDURE LimpiarCuponesExpirados()
BEGIN
  UPDATE cupones_pago 
  SET estado = 'expirado' 
  WHERE fecha_vencimiento < NOW() 
    AND estado = 'activo';
    
  SELECT ROW_COUNT() as cupones_expirados;
END //
DELIMITER ;

-- Agregar evento para ejecutar limpieza automática cada día
-- (Opcional - comentado por defecto)
/*
CREATE EVENT IF NOT EXISTS evt_limpiar_cupones_expirados
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  CALL LimpiarCuponesExpirados();
*/
