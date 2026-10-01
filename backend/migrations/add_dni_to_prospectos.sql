-- Agregar campo DNI a la tabla prospectos
ALTER TABLE prospectos 
ADD COLUMN dni VARCHAR(20) NULL AFTER apellido;

-- Crear índice para búsquedas rápidas por DNI
CREATE INDEX idx_dni ON prospectos(dni);
