const rateLimit = require('express-rate-limit');

// 🔐 RATE LIMITER PARA LOGIN - MÁS ESTRICTO
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos (reducido de 15)
    max: 20, // Máximo 20 intentos por IP cada 10 minutos (aumentado de 15)
    message: {
        error: "Demasiados intentos de inicio de sesión. Intenta nuevamente en 10 minutos.",
        code: "LOGIN_RATE_LIMIT_EXCEEDED",
        retryAfter: 10 * 60 // segundos
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 1,
    
    // ⚡ Skip para usuarios autenticados válidos
    skip: (req) => {
        return req.headers['x-skip-rate-limit'] === process.env.RATE_LIMIT_SKIP_TOKEN;
    },
    
    // 🎯 Rate limiting dinámico - más permisivo para logins exitosos
    max: (req) => {
        // Si viene de una IP conocida (whitelist interna), permitir más intentos
        const trustedIPs = ['127.0.0.1', '::1', '192.168.', '10.0.'];
        const isLocalNetwork = trustedIPs.some(ip => req.ip.startsWith(ip));
        
        if (isLocalNetwork) return 100; // Red local: 100 intentos
        return 20; // Internet: 20 intentos
    },
    
    // 🎯 Handler personalizado para cuando se alcanza el límite
    handler: (req, res) => {
        console.log(`🚨 Rate limit alcanzado para IP: ${req.ip} en login`);
        res.status(429).json({
            error: "Demasiados intentos de inicio de sesión. Intenta nuevamente en 10 minutos.",
            code: "LOGIN_RATE_LIMIT_EXCEEDED",
            retryAfter: 10 * 60
        });
    }
});

// 📝 RATE LIMITER PARA REGISTRO - MODERADO
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // Máximo 3 registros por IP por hora
    message: {
        error: "Demasiadas solicitudes de registro. Intenta nuevamente en 1 hora.",
        code: "REGISTER_RATE_LIMIT_EXCEEDED",
        retryAfter: 60 * 60
    },
    trustProxy: 1
});

// 🔑 RATE LIMITER PARA RESET DE CONTRASEÑA - BALANCEADO
const passwordResetLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos (reducido de 15)
    max: 5, // Máximo 5 solicitudes por IP (aumentado de 2)
    message: {
        error: "Demasiadas solicitudes de restablecimiento de contraseña. Intenta nuevamente en 10 minutos.",
        code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
        retryAfter: 10 * 60
    },
    trustProxy: 1,
    
    // 🎯 Excluir IPs de confianza del rate limiting
    skip: (req) => {
        const trustedIPs = [
            '127.0.0.1',
            '::1',
            '::ffff:127.0.0.1',
            '201.212.96.163' // IP del usuario que reportó el problema
        ];
        return trustedIPs.includes(req.ip);
    }
});

// � RATE LIMITER ESPECÍFICO PARA SESIONES - MUY PERMISIVO
const sessionLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 300, // 300 verificaciones de sesión por ventana (1 por segundo aprox)
    message: {
        error: "Demasiadas verificaciones de sesión. Intenta nuevamente en unos momentos.",
        code: "SESSION_CHECK_RATE_LIMIT_EXCEEDED"
    },
    trustProxy: 1,
    
    // 🎯 Key basado en usuario autenticado
    keyGenerator: (req) => {
        if (req.user && req.user.id) {
            return `session_user_${req.user.id}`;
        }
        return `session_ip_${req.ip}`;
    },
    
    // 📈 Límites muy altos para verificaciones de sesión
    max: (req) => {
        if (req.user && req.user.id) return 500; // Usuario autenticado: 500 verificaciones/5min
        return 100; // No autenticado: 100 verificaciones/5min
    },
    
    // 🛠️ Handler personalizado que no bloquea completamente
    handler: (req, res) => {
        console.log(`⚠️ Rate limit suave alcanzado para verificación de sesión - User: ${req.user?.id || 'N/A'}, IP: ${req.ip}`);
        // Retornar una respuesta válida pero indicando que la sesión sigue activa
        res.json({
            active: true,
            timeRemaining: 15, // Asumir 15 minutos restantes
            shouldWarn: false,
            rateLimited: true,
            message: 'Verificación limitada temporalmente',
            code: 'SESSION_CHECK_LIMITED'
        });
    }
});

// 🛡️ RATE LIMITER PARA APIS GENERALES
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 2000, // 2000 requests por ventana (aumentado de 1000)
    message: {
        error: "Demasiadas solicitudes a la API. Intenta nuevamente más tarde.",
        code: "API_RATE_LIMIT_EXCEEDED"
    },
    trustProxy: 1,
    
    // 🎯 Skip para rutas específicas que necesitan acceso libre
    skip: (req) => {
        const exemptPaths = [
            '/polizas/pdf/',
            '/api/polizas/pdf/',
            '/static/',
            '/health/',
            '/sessions/status', // 🔥 EXIMIR VERIFICACIONES DE SESIÓN
            '/sessions/renew',   // 🔥 EXIMIR RENOVACIONES DE SESIÓN
            '/chat/conversaciones', // 🔥 EXIMIR CONSULTAS DE CONVERSACIONES (POLLING)
            '/chat/estadisticas',   // 🔥 EXIMIR ESTADÍSTICAS DE CHAT
            '/api/chat/conversaciones', // 🔥 EXIMIR CONSULTAS DE CONVERSACIONES (POLLING)
            '/api/chat/estadisticas',    // 🔥 EXIMIR ESTADÍSTICAS DE CHAT
            '/request-password-reset',   // 🔥 EXIMIR RESET DE CONTRASEÑA
            '/reset-password'            // 🔥 EXIMIR CONFIRMACIÓN DE RESET
        ];
        return exemptPaths.some(path => req.path.includes(path));
    },
    
    // 🎯 Rate limiting dinámico basado en autenticación
    keyGenerator: (req) => {
        // Si está autenticado, usar user ID + IP, sino solo IP
        if (req.user && req.user.id) {
            return `api_user_${req.user.id}_${req.ip}`;
        }
        return `api_ip_${req.ip}`;
    },
    
    // 📈 Límites diferentes para usuarios autenticados
    max: (req) => {
        if (req.user && req.user.role === 3) return 8000; // Admin: 8000 req/15min
        if (req.user && req.user.role === 2) return 5000; // Supervisor: 5000 req/15min
        if (req.user && req.user.role === 1) return 3000; // Vendedor: 3000 req/15min
        return 500; // No autenticado: 500 req/15min (aumentado de 100)
    }
});


// 🔒 RATE LIMITER PARA OPERACIONES ADMINISTRATIVAS - OPTIMIZADO
const adminLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto (reducido de 5 minutos)
    max: 100, // 100 operaciones por minuto (aumentado de 200/5min)
    message: {
        error: "Demasiadas operaciones administrativas. Intenta nuevamente en 1 minuto.",
        code: "ADMIN_RATE_LIMIT_EXCEEDED"
    },
    trustProxy: 1,
    
    // Permitir más requests para admins en endpoints de monitoreo
    skip: (req) => {
        // Admins tienen límite más alto
        if (req.user && req.user.role === 3) return false;
        
        // Endpoints de estadísticas tienen límite especial
        if (req.path.includes('/activity-stats') || req.path.includes('/active')) {
            return false; // Aplicar límite especial
        }
        
        return false;
    },
    
    // Límite especial para endpoints de monitoreo
    keyGenerator: (req) => {
        const baseKey = req.ip;
        
        // Clave especial para endpoints de estadísticas
        if (req.path.includes('/activity-stats') || req.path.includes('/active')) {
            return `stats_${baseKey}`;
        }
        
        return baseKey;
    }
});

// 📊 RATE LIMITER ESPECÍFICO PARA ESTADÍSTICAS DE ACTIVIDAD - OPTIMIZADO
const activityStatsLimiter = rateLimit({
    windowMs: 60 * 1000, // 60 segundos (aumentado)
    max: 15, // Máximo 15 requests cada 60 segundos por IP (aumentado)
    message: {
        error: "Demasiadas consultas de estadísticas. Espera 60 segundos.",
        code: "ACTIVITY_STATS_LIMIT_EXCEEDED"
    },
    trustProxy: 1,
    standardHeaders: true,
    legacyHeaders: false,
    
    // Clave por usuario e IP para evitar conflictos
    keyGenerator: (req) => {
        const userId = req.user ? req.user.id : 'anonymous';
        return `activity_${req.ip}_${userId}`;
    }
});

// 🚨 RATE LIMITER PARA INTENTOS FALLIDOS
const failedAttemptLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 intentos fallidos por hora
    message: {
        error: "Demasiados intentos fallidos. Tu IP ha sido temporalmente bloqueada.",
        code: "FAILED_ATTEMPTS_EXCEEDED"
    },
    trustProxy: 1,
    
    // Solo contar responses con errores 4xx/5xx
    skip: (req, res) => {
        return res.statusCode < 400;
    }
});

// 🛠️ UTILIDADES PARA GESTIÓN DE RATE LIMITING
const resetRateLimit = async (ip, limiterType = 'login') => {
    try {
        let limiter;
        switch (limiterType) {
            case 'login':
                limiter = loginLimiter;
                break;
            case 'api':
                limiter = apiLimiter;
                break;
            case 'register':
                limiter = registerLimiter;
                break;
            default:
                limiter = loginLimiter;
        }
        
        // Resetear el contador para la IP específica
        await limiter.resetKey(ip);
        console.log(`✅ Rate limit reseteado para IP: ${ip} (tipo: ${limiterType})`);
        return true;
    } catch (error) {
        console.error(`❌ Error al resetear rate limit para IP ${ip}:`, error);
        return false;
    }
};

// 📊 Función para obtener información del rate limit
const getRateLimitInfo = async (ip, limiterType = 'login') => {
    try {
        let limiter;
        switch (limiterType) {
            case 'login':
                limiter = loginLimiter;
                break;
            case 'api':
                limiter = apiLimiter;
                break;
            default:
                limiter = loginLimiter;
        }
        
        // Obtener información actual del rate limit para la IP
        const store = limiter.store;
        const key = limiter.keyGenerator({ ip });
        const info = await store.get(key);
        
        return {
            ip,
            limiterType,
            current: info?.totalHits || 0,
            remaining: Math.max(0, limiter.max - (info?.totalHits || 0)),
            resetTime: info?.resetTime || null
        };
    } catch (error) {
        console.error(`❌ Error al obtener info de rate limit para IP ${ip}:`, error);
        return null;
    }
};

// 🌐 RATE LIMITER PARA ENDPOINTS PÚBLICOS - LECTURA
const publicReadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // 100 requests por minuto por IP
    message: {
        error: "Demasiadas solicitudes. Por favor intenta más tarde.",
        code: "PUBLIC_API_RATE_LIMIT_EXCEEDED",
        retryAfter: 60
    },
    trustProxy: 1,
    standardHeaders: true,
    legacyHeaders: false,
    
    // 🎯 Rate limiting más permisivo para usuarios autenticados
    max: (req) => {
        // IPs de confianza (ej: servidores internos)
        if (req.ip === '127.0.0.1' || req.ip === '::1') return 1000;
        // Usuarios autenticados: 500 req/min
        if (req.user && req.user.id) return 500;
        // Público general: 100 req/min
        return 100;
    },
    
    // 🛠️ Handler personalizado
    handler: (req, res) => {
        console.log(`⚠️ Rate limit alcanzado para endpoint público - IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: "Demasiadas solicitudes. Por favor intenta más tarde.",
            code: "PUBLIC_API_RATE_LIMIT_EXCEEDED",
            retryAfter: 60,
            timestamp: new Date().toISOString()
        });
    }
});

// 🔔 RATE LIMITER ESPECÍFICO PARA NOTIFICACIONES - MUY PERMISIVO
const notificationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 consultas de notificaciones por minuto
    message: {
        error: "Demasiadas consultas de notificaciones. Intenta nuevamente en un momento.",
        code: "NOTIFICATION_RATE_LIMIT_EXCEEDED"
    },
    trustProxy: 1,
    
    // 🎯 Key basado en usuario autenticado
    keyGenerator: (req) => {
        if (req.user && req.user.id) {
            return `notification_user_${req.user.id}`;
        }
        return `notification_ip_${req.ip}`;
    },
    
    // 📈 Límites muy altos para notificaciones
    max: (req) => {
        if (req.user && req.user.id) return 200; // Usuario autenticado: 200 consultas/min
        return 50; // No autenticado: 50 consultas/min
    },
    
    // 🛠️ Handler que no bloquea completamente
    handler: (req, res) => {
        console.log(`⚠️ Rate limit suave para notificaciones - User: ${req.user?.id || 'N/A'}, IP: ${req.ip}`);
        // Retornar respuesta vacía pero válida
        res.json({
            success: true,
            data: [],
            message: 'Consulta limitada temporalmente',
            rateLimited: true
        });
    }
});

module.exports = {
    loginLimiter,
    registerLimiter,
    passwordResetLimiter,
    apiLimiter,
    sessionLimiter, // 🔥 NUEVO: Rate limiter para sesiones
    notificationLimiter, // 🔔 NUEVO: Rate limiter para notificaciones
    adminLimiter,
    activityStatsLimiter, // ✅ ARREGLO: Agregar exportación faltante
    failedAttemptLimiter,
    publicReadLimiter, // 🌐 NUEVO: Rate limiter para endpoints públicos
    resetRateLimit,
    getRateLimitInfo
};