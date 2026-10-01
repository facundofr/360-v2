-- 🔒 MIGRACIÓN: Crear tabla token_blacklist para invalidación de tokens
-- Fecha: 2024-12-19
-- Descripción: Lista negra de tokens para logout seguro e invalidación

CREATE TABLE IF NOT EXISTS token_blacklist (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID único del registro',
    token_hash VARCHAR(64) NOT NULL UNIQUE COMMENT 'Hash SHA256 del token',
    user_id INT NOT NULL COMMENT 'ID del usuario propietario del token',
    expires_at DATETIME NOT NULL COMMENT 'Fecha de expiración del token original',
    blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha en que se añadió a la blacklist',
    reason ENUM('logout', 'forced_logout', 'security_breach', 'admin_action') DEFAULT 'logout' COMMENT 'Motivo de invalidación',
    
    -- Índices para optimización
    INDEX idx_token_blacklist_hash (token_hash),
    INDEX idx_token_blacklist_user (user_id),
    INDEX idx_token_blacklist_expires (expires_at),
    INDEX idx_token_blacklist_cleanup (expires_at, blacklisted_at),
    
    -- Relaciones
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Lista negra de tokens JWT para invalidación segura';

-- 🔒 EVENTO: Limpieza automática de tokens expirados
-- Este evento elimina automáticamente tokens expirados cada 6 horas
DROP EVENT IF EXISTS cleanup_expired_tokens;

DELIMITER $$
CREATE EVENT cleanup_expired_tokens
ON SCHEDULE EVERY 6 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Limpiar tokens expirados de la blacklist
    DELETE FROM token_blacklist 
    WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY);
    
    -- Limpiar sesiones expiradas
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() AND is_active = 0;
    
    -- Log de limpieza
    INSERT INTO system_logs (action, details, created_at) 
    VALUES ('token_cleanup', CONCAT('Cleaned expired tokens at ', NOW()), NOW());
END$$
DELIMITER ;
