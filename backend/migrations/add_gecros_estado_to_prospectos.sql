-- Agregar campo para estado de Gecros en prospectos
ALTER TABLE prospectos 
ADD COLUMN gecros_estado VARCHAR(50) DEFAULT NULL COMMENT 'Estado de cobertura en Gecros',
ADD COLUMN gecros_consultado_at DATETIME DEFAULT NULL COMMENT 'Última fecha de consulta a Gecros';
