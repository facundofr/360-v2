-- Migración: Agregar columna 'origen' a tabla prospectos
-- Fecha: 2025-11-13
-- Descripción: Permite rastrear de dónde viene cada prospecto (Formulario Web, WhatsApp, Importación, etc.)

ALTER TABLE prospectos 
ADD COLUMN origen VARCHAR(50) DEFAULT 'Formulario Web' 
COMMENT 'Origen del prospecto: Formulario Web, WhatsApp, Importación, Manual, etc.'
AFTER fecha_registro;

-- Actualizar registros existentes
UPDATE prospectos 
SET origen = 'Formulario Web' 
WHERE origen IS NULL;

-- Crear índice para búsquedas rápidas
CREATE INDEX idx_origen ON prospectos(origen);
