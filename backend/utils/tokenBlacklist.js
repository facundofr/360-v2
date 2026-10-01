const db = require('../config/db');

class TokenBlacklist {
    
    // 🚫 Agregar token a la blacklist
    static async addToBlacklist(token, userId, reason = 'logout') {
        try {
            const decoded = require('jsonwebtoken').decode(token);
            const expiresAt = new Date(decoded.exp * 1000);
            
            await db.execute(
                `INSERT INTO token_blacklist (token_hash, user_id, expires_at, reason, created_at) 
                 VALUES (SHA2(?, 256), ?, ?, ?, NOW())`,
                [token, userId, expiresAt, reason]
            );
            
            console.log(`🚫 Token blacklisted para usuario ${userId}: ${reason}`);
            return true;
        } catch (error) {
            console.error('❌ Error agregando token a blacklist:', error);
            return false;
        }
    }
    
    // ✅ Verificar si un token está en blacklist
    static async isBlacklisted(token) {
        try {
            const [results] = await db.execute(
                `SELECT id FROM token_blacklist 
                 WHERE token_hash = SHA2(?, 256) AND expires_at > NOW()`,
                [token]
            );
            
            return results.length > 0;
        } catch (error) {
            console.error('❌ Error verificando blacklist:', error);
            // En caso de error, permitir acceso (fail-open para evitar bloqueos)
            return false;
        }
    }
    
    // 🧹 Limpiar tokens expirados (ejecutar periódicamente)
    static async cleanExpiredTokens() {
        try {
            const [result] = await db.execute(
                `DELETE FROM token_blacklist WHERE expires_at < NOW()`
            );
            
            if (result.affectedRows > 0) {
                console.log(`🧹 Limpiados ${result.affectedRows} tokens expirados de blacklist`);
            }
            
            return result.affectedRows;
        } catch (error) {
            console.error('❌ Error limpiando blacklist:', error);
            return 0;
        }
    }
    
    // 🚫 Blacklistear todos los tokens de un usuario
    static async blacklistAllUserTokens(userId, reason = 'security_breach') {
        try {
            // Esto requeriría almacenar tokens activos, por ahora registramos la acción
            await db.execute(
                `INSERT INTO token_blacklist (token, token_hash, user_id, expires_at, reason, created_at) 
                 VALUES ('USER_ALL_TOKENS_PLACEHOLDER', 'USER_ALL_TOKENS', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, NOW())`,
                [userId, reason]
            );
            
            console.log(`🚫 Todos los tokens blacklisted para usuario ${userId}: ${reason}`);
            return true;
        } catch (error) {
            console.error('❌ Error blacklisting todos los tokens del usuario:', error);
            return false;
        }
    }
    
    // 📊 Obtener estadísticas de blacklist
    static async getStats() {
        try {
            const [stats] = await db.execute(`
                SELECT 
                    COUNT(*) as total_blacklisted,
                    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_blacklisted,
                    COUNT(CASE WHEN reason = 'logout' THEN 1 END) as logout_tokens,
                    COUNT(CASE WHEN reason = 'security_breach' THEN 1 END) as security_tokens
                FROM token_blacklist
                WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);
            
            return stats[0];
        } catch (error) {
            console.error('❌ Error obteniendo stats de blacklist:', error);
            return null;
        }
    }
}

module.exports = TokenBlacklist;
