const rateLimit = require('express-rate-limit');

/**
 * ✅ RATE LIMITER ESPECÍFICO PARA ENDPOINTS DE USUARIOS ACTIVOS
 * 
 * Este middleware controla específicamente las solicitudes a los endpoints
 * de monitoreo de usuarios activos para prevenir sobrecarga del servidor.
 */

// 📊 RATE LIMITER PARA USUARIOS ACTIVOS - OPTIMIZADO PARA WEBSOCKETS
const activeUsersLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 segundos
    max: 10, // Máximo 10 solicitudes cada 30 segundos
    message: {
        success: false,
        error: "Demasiadas consultas de usuarios activos. WebSocket recomendado para tiempo real.",
        code: "ACTIVE_USERS_RATE_LIMIT",
        recommendation: "Usar WebSocket para actualizaciones en tiempo real",
        nextAllowedIn: 30
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 1,
    
    // Clave personalizada por usuario admin
    keyGenerator: (req) => {
        const userId = req.user ? req.user.id : 'anonymous';
        const ip = req.ip;
        return `active_users_${userId}_${ip}`;
    },
    
    // Permitir más consultas si viene de WebSocket fallback
    max: (req) => {
        // Si detectamos que es un fallback de WebSocket, ser más permisivo
        const userAgent = req.headers['user-agent'] || '';
        const isWebSocketFallback = req.headers['x-websocket-fallback'] === 'true';
        
        if (isWebSocketFallback) return 20; // Fallback: 20 requests/30s
        if (req.user && req.user.role === 3) return 15; // Admin: 15 requests/30s
        return 5; // Otros: 5 requests/30s
    },
    
    // Handler personalizado que retorna JSON válido
    handler: (req, res) => {
        console.log(`⚠️ Rate limit para usuarios activos - User: ${req.user?.id || 'N/A'}, IP: ${req.ip}`);
        
        res.status(429).json({
            success: false,
            message: 'Demasiadas consultas de usuarios activos',
            code: 'ACTIVE_USERS_RATE_LIMIT_EXCEEDED',
            data: {
                active_users: [], // Datos vacíos para evitar errores frontend
                total_active: 0,
                timeframe_minutes: req.query.timeframe || 5,
                last_updated: new Date().toISOString(),
                rate_limited: true
            },
            retryAfter: 30,
            recommendation: 'Usar WebSocket (wss://wspflows.cober.online/admin) para actualizaciones en tiempo real'
        });
    },
    
    // Skip function para casos especiales
    skip: (req) => {
        // Skip si es una solicitud inicial (primera carga)
        const isInitialLoad = req.headers['x-initial-load'] === 'true';
        if (isInitialLoad) {
            console.log('🟢 Permitiendo solicitud inicial de usuarios activos');
            return true;
        }
        
        return false;
    }
});

// 📈 RATE LIMITER PARA ESTADÍSTICAS DE ACTIVIDAD - MÁS ESTRICTO
const activityStatsLimiter = rateLimit({
    windowMs: 60 * 1000, // 60 segundos
    max: 8, // Máximo 8 solicitudes cada 60 segundos
    message: {
        success: false,
        error: "Demasiadas consultas de estadísticas de actividad.",
        code: "ACTIVITY_STATS_RATE_LIMIT",
        nextAllowedIn: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 1,
    
    // Clave por usuario admin
    keyGenerator: (req) => {
        const userId = req.user ? req.user.id : 'anonymous';
        return `activity_stats_${userId}_${req.ip}`;
    },
    
    // Handler que retorna estructura de datos válida
    handler: (req, res) => {
        console.log(`⚠️ Rate limit para estadísticas de actividad - User: ${req.user?.id || 'N/A'}, IP: ${req.ip}`);
        
        res.status(429).json({
            success: false,
            message: 'Demasiadas consultas de estadísticas',
            code: 'ACTIVITY_STATS_RATE_LIMIT_EXCEEDED',
            data: {
                summary: {
                    active_5min: 0,
                    active_15min: 0,
                    active_1hour: 0,
                    active_today: 0,
                    total_users: 0,
                    enabled_users: 0,
                    never_logged_in: 0
                },
                by_role: [],
                recent_logins: [],
                last_updated: new Date().toISOString(),
                rate_limited: true
            },
            retryAfter: 60
        });
    }
});

// 💓 RATE LIMITER PARA HEARTBEAT - MUY PERMISIVO
const heartbeatLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 segundos
    max: 100, // 100 heartbeats cada 30 segundos
    message: {
        success: false,
        error: "Demasiados heartbeats. Reduce la frecuencia.",
        code: "HEARTBEAT_RATE_LIMIT"
    },
    trustProxy: 1,
    
    // Clave por usuario para permitir múltiples sesiones
    keyGenerator: (req) => {
        const userId = req.user ? req.user.id : 'anonymous';
        return `heartbeat_${userId}`;
    },
    
    // Límites por tipo de usuario
    max: (req) => {
        if (req.user && req.user.role === 3) return 200; // Admin: 200 heartbeats/30s
        if (req.user && req.user.id) return 150; // Usuario autenticado: 150/30s
        return 50; // No autenticado: 50/30s
    },
    
    // Handler que retorna respuesta válida de heartbeat
    handler: (req, res) => {
        console.log(`⚠️ Rate limit para heartbeat - User: ${req.user?.id || 'N/A'}`);
        
        res.status(429).json({
            success: false,
            message: 'Demasiados heartbeats',
            code: 'HEARTBEAT_RATE_LIMIT_EXCEEDED',
            data: {
                user_id: req.user?.id || null,
                timestamp: new Date().toISOString(),
                rate_limited: true
            },
            retryAfter: 30
        });
    }
});

// 🔄 FUNCIÓN PARA RESETEAR LÍMITES DE USUARIOS ACTIVOS
const resetActiveUsersLimit = async (userId, ip) => {
    try {
        const key = `active_users_${userId}_${ip}`;
        await activeUsersLimiter.resetKey(key);
        console.log(`✅ Rate limit de usuarios activos reseteado para User: ${userId}, IP: ${ip}`);
        return true;
    } catch (error) {
        console.error(`❌ Error al resetear rate limit de usuarios activos:`, error);
        return false;
    }
};

// 📊 FUNCIÓN PARA OBTENER INFORMACIÓN DE LÍMITES
const getActiveUsersLimitInfo = async (userId, ip) => {
    try {
        const key = `active_users_${userId}_${ip}`;
        const store = activeUsersLimiter.store;
        const info = await store.get(key);
        
        return {
            userId,
            ip,
            current: info?.totalHits || 0,
            remaining: Math.max(0, activeUsersLimiter.max - (info?.totalHits || 0)),
            resetTime: info?.resetTime || null,
            windowMs: activeUsersLimiter.windowMs
        };
    } catch (error) {
        console.error(`❌ Error al obtener info de rate limit:`, error);
        return null;
    }
};

// 🛠️ MIDDLEWARE PERSONALIZADO PARA PREVENIR MÚLTIPLES SOLICITUDES SIMULTÁNEAS
const preventSimultaneousRequests = (req, res, next) => {
    const key = `${req.user?.id || req.ip}_${req.path}`;
    
    // Store simple para tracking de requests en progreso
    if (!preventSimultaneousRequests.activeRequests) {
        preventSimultaneousRequests.activeRequests = new Map();
    }
    
    const activeRequests = preventSimultaneousRequests.activeRequests;
    
    // Verificar si ya hay una solicitud en progreso
    if (activeRequests.has(key)) {
        console.log(`⚠️ Solicitud duplicada detectada para ${key}`);
        return res.status(429).json({
            success: false,
            error: 'Solicitud duplicada detectada. Espera a que termine la anterior.',
            code: 'DUPLICATE_REQUEST_DETECTED'
        });
    }
    
    // Marcar solicitud como activa
    activeRequests.set(key, Date.now());
    
    // Limpiar al finalizar la respuesta
    const cleanup = () => {
        activeRequests.delete(key);
    };
    
    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    
    // Auto-cleanup después de 30 segundos por seguridad
    setTimeout(() => {
        if (activeRequests.has(key)) {
            console.log(`🧹 Auto-cleanup de solicitud activa para ${key}`);
            activeRequests.delete(key);
        }
    }, 30000);
    
    next();
};

module.exports = {
    activeUsersLimiter,
    activityStatsLimiter,
    heartbeatLimiter,
    preventSimultaneousRequests,
    resetActiveUsersLimit,
    getActiveUsersLimitInfo
};