-- =====================================================
-- MIGRACIÓN: Tabla de nutrición de leads post-validación (rama "urgente")
-- Fecha: 2026-07-24
-- Motivo: un lead "urgente" queda asignado a vendedor pero puede tardar en
-- recibir contacto. Se le manda contenido informativo (4 mensajes) hasta que
-- el vendedor le escriba por su cuenta o el lead confirme que ya lo contactaron.
-- No usa prospectos.estado (ENUM cerrado) porque esto es estado operativo del
-- bot, no un estado de negocio del lead.
-- Ejecutar directamente en MySQL.
-- =====================================================

CREATE TABLE IF NOT EXISTS validacion_nutricion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prospecto_id INT NOT NULL,
  vendedor_id INT NULL,
  asignado_at DATETIME NOT NULL,
  mensajes_enviados INT NOT NULL DEFAULT 0,
  proximo_envio_at DATETIME NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  motivo_cierre ENUM('completado','vendedor_contacto','usuario_confirmo','cancelado') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prospecto (prospecto_id),
  INDEX idx_activo_proximo (activo, proximo_envio_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verificación:
-- SHOW COLUMNS FROM validacion_nutricion;
