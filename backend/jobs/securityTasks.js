const cron = require('node-cron');
const TokenBlacklist = require('../utils/tokenBlacklist');

class SecurityTasks {
    
    // 🧹 Inicializar tareas de limpieza automática
    static init() {
        console.log('🔧 Iniciando tareas de seguridad automáticas...');
        
        // Limpiar tokens blacklisted expirados cada hora
        cron.schedule('0 * * * *', async () => {
            console.log('🧹 Ejecutando limpieza de tokens blacklisted...');
            try {
                const cleaned = await TokenBlacklist.cleanExpiredTokens();
                console.log(`✅ Limpieza completada: ${cleaned} tokens removidos`);
            } catch (error) {
                console.error('❌ Error en limpieza de tokens:', error);
            }
        });
        
        // Generar reporte de seguridad diario
        cron.schedule('0 6 * * *', async () => {
            console.log('📊 Generando reporte de seguridad diario...');
            try {
                const stats = await TokenBlacklist.getStats();
                if (stats) {
                    console.log('📊 Estadísticas de seguridad (últimos 7 días):', {
                        total_blacklisted: stats.total_blacklisted,
                        active_blacklisted: stats.active_blacklisted,
                        logout_tokens: stats.logout_tokens,
                        security_tokens: stats.security_tokens
                    });
                }
            } catch (error) {
                console.error('❌ Error generando reporte de seguridad:', error);
            }
        });
        
        console.log('✅ Tareas de seguridad configuradas correctamente');
    }
    
    // 🚨 Verificar salud del sistema de seguridad
    static async healthCheck() {
        try {
            const stats = await TokenBlacklist.getStats();
            
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                blacklist_stats: stats,
                security_features: {
                    token_blacklist: 'active',
                    rate_limiting: 'active',
                    input_validation: 'active',
                    sql_injection_protection: 'active',
                    security_headers: 'active'
                }
            };
        } catch (error) {
            console.error('❌ Error en health check de seguridad:', error);
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
}

module.exports = SecurityTasks;
