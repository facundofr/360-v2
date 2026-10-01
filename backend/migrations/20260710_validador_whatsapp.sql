-- =====================================================
-- MIGRACIÓN: Validador de leads por WhatsApp
-- Fecha: 2026-07-10
-- Ejecutar directamente en MySQL (no hay runner de migraciones en este repo)
-- =====================================================

-- 1. Flag de validación + timestamps de envío y resolución del circuito de WhatsApp
ALTER TABLE prospectos
  ADD COLUMN validado TINYINT(1) NOT NULL DEFAULT 0 AFTER estado,
  ADD COLUMN validacion_enviada_at DATETIME NULL AFTER validado,
  ADD COLUMN validacion_resuelta_at DATETIME NULL AFTER validacion_enviada_at;

CREATE INDEX idx_prospectos_validado ON prospectos (validado);

-- 2. Toggle + cupo diario del circuito de validación (fila única, se actualiza con UPDATE)
CREATE TABLE IF NOT EXISTS validacion_whatsapp_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  activo TINYINT(1) NOT NULL DEFAULT 0,
  cupo_diario INT NOT NULL DEFAULT 20,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO validacion_whatsapp_config (activo, cupo_diario) VALUES (0, 20);

-- 3. Contador atómico de leads derivados al validador por día (evita condiciones de
--    carrera bajo requests concurrentes: UPDATE ... WHERE contador < cupo)
CREATE TABLE IF NOT EXISTS validacion_piloto_contador (
  fecha DATE PRIMARY KEY,
  contador INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Usuario de sistema: dueño temporal de la conversación de WhatsApp mientras el
--    prospecto todavía no tiene vendedor asignado (validación en curso / rechazada /
--    a corregir). is_enabled=0 para que el round-robin de asignación lo ignore siempre.
INSERT IGNORE INTO users (first_name, last_name, email, phone_number, password, role, is_enabled)
VALUES (
  'Bot', 'Validador', 'bot-validador@cober.internal', '00000000000',
  '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
  1, 0
);

-- 5. Nuevo tipo de origen de conversación, para distinguir las conversaciones del
--    circuito de validación de las de cotización/póliza/manual existentes.
ALTER TABLE chat_conversaciones_whatsapp
  MODIFY COLUMN tipo_origen ENUM('cotizacion','poliza','manual','validacion') NOT NULL;

-- =====================================================
-- Verificación rápida post-migración
-- =====================================================
-- SELECT * FROM validacion_whatsapp_config;
-- SELECT id, email, role, is_enabled FROM users WHERE email = 'bot-validador@cober.internal';
-- DESCRIBE prospectos;
