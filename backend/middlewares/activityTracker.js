const pool = require('../config/db');
const jwt = require('jsonwebtoken');

/**
 * ✅ MIDDLEWARE DE TRACKING DE ACTIVIDAD MEJORADO
 * 
 * Este middleware actualiza automáticamente la actividad del usuario 
 * en cada request autenticado para mantener el estado "online" en tiempo real.
 */

// Cache en memoria para evitar demasiadas actualizaciones de DB
const activityCache = new Map();
const CACHE_DURATION = 30000; // 30 segundos (reducido para mayor responsividad)

/**
 * Middleware principal para tracking de actividad
 */
const trackUserActivity = async (req, res, next) => {
  // Continuar con el request inmediatamente para no bloquear
  next();

  try {
    // Buscar el token en diferentes ubicaciones
    let token = null;
    let userId = null;
    
    // 1. Header Authorization (más común)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cober360_secret_key');
        userId = decoded.id;
      } catch (error) {
        console.log('🔒 Token inválido en trackUserActivity:', error.message);
        return; // Salir silenciosamente si el token es inválido
      }
    }
    // 2. Si req.user ya existe (middleware de auth ejecutado antes)
    else if (req.user && req.user.id) {
      userId = req.user.id;
    }
    // 3. Intentar obtener de cookies (si se usa)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cober360_secret_key');
        userId = decoded.id;
      } catch (error) {
        return; // Token inválido en cookies
      }
    }

    // Si no podemos obtener el ID del usuario, salir
    if (!userId) {
      return;
    }

    // Verificar cache para evitar actualizaciones excesivas
    const cacheKey = `user_${userId}`;
    const now = Date.now();
    const lastUpdate = activityCache.get(cacheKey);
    
    // Solo actualizar si han pasado más de 30 segundos desde la última actualización
    if (!lastUpdate || (now - lastUpdate) > CACHE_DURATION) {
      // Actualizar cache inmediatamente
      activityCache.set(cacheKey, now);
      
      console.log(`💓 Updating activity for user ${userId} on ${req.path}`);
      
      // Actualizar base de datos de forma asíncrona
      try {
        await updateUserLastActivity(userId, req);
      } catch (error) {
        console.error('❌ Error actualizando actividad:', error);
        // Remover del cache si falló la actualización
        activityCache.delete(cacheKey);
      }
    }

  } catch (error) {
    console.error('❌ Error en trackUserActivity:', error);
    // No hacer nada más, el request ya continuó
  }
};

/**
 * Función para actualizar la actividad en la base de datos
 */
async function updateUserLastActivity(userId, req) {
    try {
        // Usar la tabla correcta: users (no usuarios) y campo last_activity
        // También establecer is_logged_out = 0 para reactivar al usuario
        const query = `
            UPDATE users 
            SET last_activity = NOW(),
                is_logged_out = 0,
                updated_at = NOW()
            WHERE id = ? AND is_enabled = 1
        `;
        
        const [result] = await pool.query(query, [userId]);
        
        // Log para debugging
        console.log(`✅ Activity updated for user ${userId} - Affected rows: ${result.affectedRows}`);
        
        return result;
    } catch (error) {
        console.error('❌ Error en updateUserLastActivity:', error);
        throw error;
    }
}

/**
 * Middleware específico para páginas críticas (login, dashboard, etc.)
 * Fuerza la actualización sin cache
 */
const forceTrackActivity = (req, res, next) => {
    if (!req.user || !req.user.id) {
        return next();
    }

    const userId = req.user.id;
    
    // Actualizar inmediatamente
    setImmediate(async () => {
        try {
            await updateUserLastActivity(userId, req);
            console.log(`🎯 Forced activity update for user ${userId} on ${req.path}`);
        } catch (error) {
            console.error(`❌ Error in forced activity update for user ${userId}:`, error.message);
        }
    });

    next();
};

/**
 * Función para limpiar el cache periódicamente
 */
function cleanupActivityCache() {
    const currentTime = Date.now();
    const expiredKeys = [];
    
    for (const [key, timestamp] of activityCache.entries()) {
        if (currentTime - timestamp > CACHE_DURATION * 2) {
            expiredKeys.push(key);
        }
    }
    
    expiredKeys.forEach(key => activityCache.delete(key));
    
    if (expiredKeys.length > 0) {
        console.log(`🧹 Cleaned ${expiredKeys.length} expired activity cache entries`);
    }
}

// Limpiar cache cada 5 minutos
setInterval(cleanupActivityCache, 5 * 60 * 1000);

/**
 * Función para obtener estadísticas del cache
 */
function getCacheStats() {
    return {
        total_entries: activityCache.size,
        cache_duration_ms: CACHE_DURATION,
        memory_usage_estimate: activityCache.size * 50 // Estimación rough
    };
}

module.exports = {
    trackUserActivity,
    forceTrackActivity,
    updateUserLastActivity,
    getCacheStats
};