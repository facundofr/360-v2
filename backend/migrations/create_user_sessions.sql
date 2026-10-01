-- 🔒 MIGRACIÓN: Crear tabla user_sessions para gestión avanzada de sesiones
-- Fecha: 2024-12-19
-- Descripción: Tabla para tracking de sesiones de usuario con device fingerprinting

CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(36) PRIMARY KEY COMMENT 'UUID de la sesión',
    user_id INT NOT NULL COMMENT 'ID del usuario',
    refresh_token TEXT NOT NULL COMMENT 'Token de refresco encriptado',
    device_fingerprint VARCHAR(64) NOT NULL COMMENT 'Huella digital del dispositivo',
    device_info JSON COMMENT 'Información detallada del dispositivo',
    ip_address VARCHAR(45) COMMENT 'Dirección IP del usuario',
    user_agent TEXT COMMENT 'User Agent del navegador',
    expires_at DATETIME NOT NULL COMMENT 'Fecha de expiración de la sesión',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Última actividad',
    logout_at DATETIME NULL COMMENT 'Fecha de logout (si aplica)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Si la sesión está activa',
    
    -- Índices para optimización
    INDEX idx_user_sessions_user_id (user_id),
    INDEX idx_user_sessions_fingerprint (device_fingerprint),
    INDEX idx_user_sessions_active (is_active, expires_at),
    INDEX idx_user_sessions_cleanup (expires_at, is_active),
    
    -- Relaciones
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabla de sesiones de usuario con device fingerprinting para seguridad avanzada';
