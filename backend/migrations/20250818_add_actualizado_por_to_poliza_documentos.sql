-- Migración: Añadir columna actualizado_por a poliza_documentos
-- Fecha: 2025-08-18
-- Descripción: Añade la columna `actualizado_por`, la poblamos con `subido_por` si está disponible
-- y creamos un índice. (No forzamos la FK por seguridad; puedes descomentarlo si quieres FK)

-- 1) Añadir columna si no existe
ALTER TABLE poliza_documentos
  ADD COLUMN IF NOT EXISTS actualizado_por INT NULL;

-- 2) Poblamos la columna con subido_por (valor estimado) para mantener trazabilidad
UPDATE poliza_documentos
SET actualizado_por = subido_por
WHERE (actualizado_por IS NULL OR actualizado_por = 0) AND (subido_por IS NOT NULL AND subido_por != 0);

-- 3) Crear índice para consultas rápidas
ALTER TABLE poliza_documentos
  ADD INDEX idx_actualizado_por (actualizado_por);

-- 4) (Opcional) Añadir FK a users.id si deseas garantizar integridad referencial
-- ALTER TABLE poliza_documentos
--   ADD CONSTRAINT fk_poliza_doc_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES users(id);

-- Nota: Haz backup de la tabla antes de ejecutar en producción. Ejecuta este archivo con:
-- mysql -u <user> -p <database> < 20250818_add_actualizado_por_to_poliza_documentos.sql
