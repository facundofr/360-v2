-- 🔒 MIGRACIÓN: Mejorar tabla users para seguridad avanzada
-- Fecha: 2024-12-19
-- Descripción: Añadir campos de seguridad adicionales a la tabla users

-- Añadir campos de seguridad si no existen
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(45) COMMENT 'IP de registro',
ADD COLUMN IF NOT EXISTS registration_user_agent TEXT COMMENT 'User Agent del registro',
ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(64) COMMENT 'Fingerprint del dispositivo de registro',
ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45) COMMENT 'Última IP de login',
ADD COLUMN IF NOT EXISTS last_user_agent TEXT COMMENT 'Último User Agent',
ADD COLUMN IF NOT EXISTS password_changed_at DATETIME COMMENT 'Última fecha de cambio de contraseña',
ADD COLUMN IF NOT EXISTS security_notifications BOOLEAN DEFAULT TRUE COMMENT 'Si recibir notificaciones de seguridad',
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE COMMENT 'Si tiene 2FA habilitado',
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32) COMMENT 'Secret para 2FA (para futuro uso)';

-- Índices para optimización de seguridad
CREATE INDEX IF NOT EXISTS idx_users_registration_ip ON users(registration_ip);
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip);
CREATE INDEX IF NOT EXISTS idx_users_security ON users(is_enabled, verified, lock_until);
