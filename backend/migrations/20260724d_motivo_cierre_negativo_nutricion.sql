-- =====================================================
-- MIGRACIÓN: Nuevo motivo de cierre para nutrición (respuesta negativa)
-- Fecha: 2026-07-24
-- Motivo: el mensaje 4 ahora tiene dos botones (contactaron / no contactaron).
-- La rama negativa cierra la nutrición con un motivo propio, distinto de
-- 'usuario_confirmo', para poder reportarlos por separado.
-- Ejecutar directamente en MySQL.
-- =====================================================

ALTER TABLE validacion_nutricion MODIFY COLUMN motivo_cierre
  ENUM('completado','vendedor_contacto','usuario_confirmo','usuario_nego_contacto','cancelado') NULL;

-- Verificación:
-- SHOW COLUMNS FROM validacion_nutricion LIKE 'motivo_cierre';
