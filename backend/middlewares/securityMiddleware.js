const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

// 🛡️ CONFIGURACIÓN DE HELMET PARA HEADERS DE SEGURIDAD
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com", "https://www.gstatic.com"],
            frameSrc: ["'self'", "https://www.google.com"],
            connectSrc: ["'self'", "https://wspflows.cober.online", "https://cober360.vercel.app"]
        },
    },
    crossOriginEmbedderPolicy: false, // Permitir recursos de terceros
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' }
});

// 🛡️ SANITIZACIÓN DE DATOS
const sanitizeInput = mongoSanitize({
    replaceWith: '_', // Reemplazar caracteres maliciosos con _
    onSanitize: ({ req, key }) => {
        console.warn(`🚨 Input sanitizado en ${req.path}: ${key}`);
    }
});

// 🛡️ RATE LIMITING MÁS ESTRICTO PARA OPERACIONES CRÍTICAS
const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 requests por ventana
    message: {
        error: 'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 1,
    skip: (req) => {
        const secret = process.env.INTERNAL_REQUEST_SECRET;
        if (!secret) return false;
        return req.headers['x-internal-request'] === secret;
    }
});

// 🛡️ RATE LIMITING PARA APIs SENSIBLES
const apiSecurityLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 50, // Máximo 50 requests por ventana
    message: {
        error: 'Límite de API excedido. Intenta nuevamente en 5 minutos.',
        code: 'API_LIMIT_EXCEEDED'
    },
    trustProxy: 1
});

// 🛡️ VALIDACIÓN DE HEADERS REQUERIDOS
const validateRequiredHeaders = (req, res, next) => {
    // 🛡️ Excepciones para rutas que pueden ser accedidas por navegadores headless (Puppeteer)
    const exemptPaths = [
        '/polizas/pdf/',
        '/api/polizas/pdf/',
        '/poliza-documentos/',
        '/static/',
        '/health/'
    ];
    
    if (exemptPaths.some(path => req.path.includes(path))) {
        return next();
    }
    
    const userAgent = req.get('User-Agent');
    
    if (!userAgent || userAgent.length < 10) {
        return res.status(400).json({
            error: 'Headers inválidos',
            code: 'INVALID_HEADERS'
        });
    }
    
    // Detectar bots maliciosos básicos (pero permitir Puppeteer y navegadores headless)
    const suspiciousAgents = [
        'scanner', 'scraper'  // Removemos 'bot', 'crawler', 'spider', 'curl', 'wget', 'python-requests'
    ];
    
    const lowerAgent = userAgent.toLowerCase();
    const isSuspicious = suspiciousAgents.some(agent => lowerAgent.includes(agent));
    
    // HeadlessChrome requiere validación adicional
    const isHeadlessBrowser = lowerAgent.includes('headlesschrome') || lowerAgent.includes('puppeteer');
    
    if (isSuspicious && !req.headers['x-authorized-bot']) {
        // Si es HeadlessChrome, permitir solo si accede a rutas válidas
        if (isHeadlessBrowser) {
            const validRoutes = ['/health', '/api/', '/sessions/', '/login', '/'];
            const isValidRoute = validRoutes.some(route => req.path.startsWith(route));
            
            if (!isValidRoute) {
                console.warn(`🚨 Bot sospechoso detectado: ${userAgent} desde IP: ${req.ip} - Ruta inválida: ${req.path}`);
                return res.status(403).json({
                    error: 'Acceso no autorizado',
                    code: 'SUSPICIOUS_ACTIVITY'
                });
            }
        } else {
            console.warn(`🚨 Bot sospechoso detectado: ${userAgent} desde IP: ${req.ip}`);
            return res.status(403).json({
                error: 'Acceso no autorizado',
                code: 'SUSPICIOUS_ACTIVITY'
            });
        }
    }
    
    next();
};

// 🛡️ LOGGING DE SEGURIDAD
const securityLogger = (req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;
    
    res.send = function(body) {
        const duration = Date.now() - start;
        
        // Endpoints legítimos que NO deben considerarse sospechosos
        const legitimateEndpoints = [
            '/sessions/status',
            '/sessions/check',
            '/health',
            '/chat/',
            '/localidades/',
            '/prospectos',
            '/vendedor/',
            '/supervisor/',
            '/api/'
        ];
        
        const isLegitimateEndpoint = legitimateEndpoints.some(endpoint => req.path.includes(endpoint));
        
        // Log SOLO de requests realmente sospechosos
        if (res.statusCode >= 400 && !isLegitimateEndpoint) {
            // Solo registrar como ataque si es realmente sospechoso
            const suspiciousPaths = ['.env', '.git', 'wp-admin', 'phpmyadmin', 'config', 'backup', 'database'];
            const isSuspicious = suspiciousPaths.some(path => req.path.includes(path));
            
            if (isSuspicious) {
                console.warn(`🚨 Request fallido: ${req.method} ${req.path} - Status: ${res.statusCode} - IP: ${req.ip} - Duration: ${duration}ms`);
            } else {
                console.log(`⚠️ Request no encontrado: ${req.method} ${req.path} - Status: ${res.statusCode} - IP: ${req.ip}`);
            }
        }
        
        // Log de requests exitosos a endpoints sensibles
        const sensitiveEndpoints = ['/auth/', '/admin/', '/sessions/'];
        if (sensitiveEndpoints.some(endpoint => req.path.includes(endpoint))) {
            console.log(`🔒 Acceso seguro: ${req.method} ${req.path} - Status: ${res.statusCode} - User: ${req.user?.id || 'anónimo'}`);
        }
        
        originalSend.call(this, body);
    };
    
    next();
};

// 🛡️ DETECCIÓN DE IP SOSPECHOSAS (básico)
const suspiciousIpDetection = (req, res, next) => {
    const ip = req.ip;
    
    // Lista básica de rangos IP sospechosos (puedes expandir esto)
    const suspiciousPatterns = [
        /^10\.0\.0\./, // Algunas IPs internas sospechosas
        /^192\.168\.1\.1$/ // Router común usado para ataques
    ];
    
    // En producción, podrías integrar con servicios como AbuseIPDB
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(ip));
    
    if (isSuspicious) {
        console.warn(`🚨 IP sospechosa detectada: ${ip}`);
        // No bloqueamos automáticamente, solo registramos
    }
    
    next();
};

module.exports = {
    helmetConfig,
    sanitizeInput,
    strictRateLimit,
    apiSecurityLimit,
    validateRequiredHeaders,
    securityLogger,
    suspiciousIpDetection
};
