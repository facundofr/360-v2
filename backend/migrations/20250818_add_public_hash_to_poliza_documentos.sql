-- Migración: Añadir columna public_hash a poliza_documentos
-- Fecha: 2025-08-18
-- Descripción: Añade la columna `public_hash`, rellena valores únicos para filas existentes
-- y crea un índice único. Ajusta/ejecuta en tu entorno de MySQL/MariaDB.

-- 1) Añadir columna (si no existe)
ALTER TABLE poliza_documentos
  ADD COLUMN IF NOT EXISTS public_hash VARCHAR(64) NULL;

-- 2) Rellenar filas existentes con un valor único (combina UUID + id y toma 32 chars)
--    Usamos LEFT(CONCAT(REPLACE(UUID(),'-',''), LPAD(id,6,'0')),32) para garantizar unicidad por fila.
UPDATE poliza_documentos
SET public_hash = LEFT(CONCAT(REPLACE(UUID(),'-',''), LPAD(id,6,'0')),32)
WHERE public_hash IS NULL OR public_hash = '';

-- 3) Crear índice único para evitar colisiones futuras
ALTER TABLE poliza_documentos
  ADD UNIQUE INDEX ux_poliza_documentos_public_hash (public_hash);

-- 4) Marcar la columna como NOT NULL (opcional, si estás seguro)
ALTER TABLE poliza_documentos
  MODIFY COLUMN public_hash VARCHAR(32) NOT NULL;

-- Nota:
-- - Si tu versión de MySQL no soporta `ADD COLUMN IF NOT EXISTS`, ejecuta el primer ALTER sólo si la columna no existe.
-- - Si prefieres no forzar NOT NULL, puedes omitir el último ALTER.
-- - Haz un backup de la tabla antes de ejecutar estas instrucciones en producción.
