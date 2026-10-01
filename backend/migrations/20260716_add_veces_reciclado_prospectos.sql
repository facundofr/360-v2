-- ============================================
-- MIGRACIÓN: Contador de reingresos automáticos por dato repetido
-- Fecha: 2026-07-16
-- Descripción: Trackea cuántas veces un contacto fue reingresado
--              automáticamente por el proceso de "dato repetido sin evolución"
-- ============================================

ALTER TABLE prospectos
ADD COLUMN IF NOT EXISTS veces_reciclado INT DEFAULT 0 NOT NULL
COMMENT 'Cantidad de veces que este contacto fue reingresado automáticamente por duplicado sin evolución';

SELECT COUNT(*) AS 'Tiene veces_reciclado' FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'prospectos' AND column_name = 'veces_reciclado';

SELECT 'Migración completada exitosamente' AS resultado;
