-- ============================================================
-- Migración: Inmutabilidad del campo `origen` en `prospectos`
-- Descripción: Una vez asignado, el origen de un prospecto no
--              puede cambiar. El número de teléfono es el
--              identificador de trazabilidad de canal real.
-- Fecha: 2026-04-09
-- ============================================================

-- Eliminar el trigger si ya existía (idempotente)
DROP TRIGGER IF EXISTS before_update_prospectos_origen;

DELIMITER $$

CREATE TRIGGER before_update_prospectos_origen
BEFORE UPDATE ON prospectos
FOR EACH ROW
BEGIN
    -- Si el origen ya tenía un valor, preservarlo siempre
    IF OLD.origen IS NOT NULL AND OLD.origen != '' THEN
        SET NEW.origen = OLD.origen;
    END IF;
END$$

DELIMITER ;
