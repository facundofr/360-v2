// 🚀 MIDDLEWARE PARA PREVENIR DOBLE ENVÍO Y DUPLICADOS
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// 📦 Cache en memoria para requests recientes (en producción usar Redis)
const recentRequests = new Map();

// 🧹 Limpiar cache cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentRequests.entries()) {
        if (now - timestamp > 300000) { // 5 minutos
            recentRequests.delete(key);
        }
    }
}, 60000); // Revisar cada minuto

// 🔐 Llamadas server-to-server confiables (ej. Lead Router) se identifican con este
// header, no con Origin/Referer (que no envían los clientes HTTP no-browser).
// Mismo mecanismo que ya usa cober360-bariloche.
const isTrustedInternalCall = (req) => {
    const internalKey = req.get('x-internal-key');
    return Boolean(internalKey) && internalKey === process.env.INTERNAL_LEAD_API_KEY;
};

/**
 * 🛡️ Middleware para prevenir envíos duplicados basado en contenido
 * Utiliza un hash del contenido del body + IP para detectar requests idénticas
 */
const preventDuplicateSubmission = (windowMs = 30000) => { // 30 segundos por defecto
    return (req, res, next) => {
        try {
            if (isTrustedInternalCall(req)) {
                console.log('✅ Llamada interna confiable (X-Internal-Key) - duplicate check omitido');
                return next();
            }

            // 🔍 Generar identificador único basado en IP + contenido
            const contentHash = crypto
                .createHash('sha256')
                .update(JSON.stringify(req.body) + req.ip)
                .digest('hex');
            
            const now = Date.now();
            const requestKey = `duplicate_${contentHash}`;
            
            // 🔍 Verificar si existe una request idéntica reciente
            if (recentRequests.has(requestKey)) {
                const lastRequestTime = recentRequests.get(requestKey);
                const timeDiff = now - lastRequestTime;
                
                if (timeDiff < windowMs) {
                    console.warn(`🚨 DUPLICADO DETECTADO - IP: ${req.ip}, Hash: ${contentHash.slice(0, 8)}, Tiempo: ${timeDiff}ms`);
                    
                    return res.status(429).json({
                        message: "Solicitud duplicada detectada. Por favor espera unos segundos antes de enviar nuevamente.",
                        code: "DUPLICATE_REQUEST_DETECTED",
                        retryAfter: Math.ceil((windowMs - timeDiff) / 1000)
                    });
                }
            }
            
            // 💾 Registrar la nueva request
            recentRequests.set(requestKey, now);
            
            // ✅ Continuar con la request
            next();
            
        } catch (error) {
            console.error('Error en preventDuplicateSubmission:', error);
            // En caso de error, permitir continuar
            next();
        }
    };
};

/**
 * 🎯 Rate Limiter específico para creación de leads
 * Más restrictivo que el general para prevenir spam
 */
const leadCreationLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutos
    max: 3, // Máximo 3 leads por IP cada 2 minutos
    message: {
        error: "Demasiadas solicitudes de creación de leads. Intenta nuevamente en 2 minutos.",
        code: "LEAD_CREATION_RATE_LIMIT_EXCEEDED",
        retryAfter: 2 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: 1,

    // 🎯 Excluir llamadas internas confiables del rate limiting
    skip: (req) => {
        if (isTrustedInternalCall(req)) {
            console.log('✅ Llamada interna confiable (X-Internal-Key) - rate limit omitido');
            return true;
        }
        return false;
    },

    // 🎯 Key personalizada para incluir más contexto
    keyGenerator: (req) => {
        // Combinar IP con algunos datos del body para mayor precisión
        const baseKey = req.ip;
        if (req.body && req.body.numero_contacto) {
            return `lead_${baseKey}_${req.body.numero_contacto}`;
        }
        return `lead_${baseKey}`;
    },
    
    // 🛠️ Handler personalizado con más información
    handler: (req, res) => {
        console.warn(`🚨 Rate limit para creación de leads - IP: ${req.ip}, Tel: ${req.body?.numero_contacto || 'N/A'}`);
        
        res.status(429).json({
            error: "Demasiadas solicitudes de creación de leads. Intenta nuevamente en 2 minutos.",
            code: "LEAD_CREATION_RATE_LIMIT_EXCEEDED",
            retryAfter: 2 * 60,
            details: {
                windowMs: 2 * 60 * 1000,
                maxRequests: 3,
                suggestion: "Verifica que los datos sean correctos antes de enviar nuevamente."
            }
        });
    }
});

/**
 * 🔍 Middleware para validar duplicados de leads en base de datos
 * ⚠️ INFORMATIVO SOLAMENTE - NO BLOQUEA, solo registra advertencias en headers
 */
const validateLeadDuplicates = async (req, res, next) => {
    try {
        const { numero_contacto, correo, nombre, apellido } = req.body;
        
        if (!numero_contacto || !correo) {
            return next(); // Si faltan datos críticos, dejar que la validación normal maneje
        }
        
        const db = require('../config/db');
        const advertencias = [];
        
        // 🔍 Verificar duplicados por teléfono (SOLO INFORMATIVO)
        const [phoneCheck] = await db.query(
            'SELECT id, nombre, apellido, fecha_registro FROM prospectos WHERE numero_contacto = ? AND fecha_registro > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
            [numero_contacto]
        );
        
        if (phoneCheck.length > 0) {
            console.warn(`⚠️ DUPLICADO DETECTADO (INFORMATIVO) - Teléfono: ${numero_contacto}, ID existente: ${phoneCheck[0].id}`);
            advertencias.push({
                type: "DUPLICATE_PHONE_WARNING",
                message: "Existe un lead con este teléfono en las últimas 24 horas",
                existingLeadId: phoneCheck[0].id
            });
        }
        
        // 🔍 Verificar duplicados por email (SOLO INFORMATIVO)
        const [emailCheck] = await db.query(
            'SELECT id, nombre, apellido, fecha_registro FROM prospectos WHERE correo = ? AND fecha_registro > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
            [correo]
        );
        
        if (emailCheck.length > 0) {
            console.warn(`⚠️ DUPLICADO DETECTADO (INFORMATIVO) - Email: ${correo}, ID existente: ${emailCheck[0].id}`);
            advertencias.push({
                type: "DUPLICATE_EMAIL_WARNING",
                message: "Existe un lead con este email en las últimas 24 horas",
                existingLeadId: emailCheck[0].id
            });
        }
        
        // 🔍 Verificar duplicados por nombre + apellido + teléfono (SOLO INFORMATIVO)
        const [identityCheck] = await db.query(
            'SELECT id, fecha_registro FROM prospectos WHERE nombre = ? AND apellido = ? AND numero_contacto = ? AND fecha_registro > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [nombre, apellido, numero_contacto]
        );
        
        if (identityCheck.length > 0) {
            console.warn(`⚠️ DUPLICADO EXACTO DETECTADO (INFORMATIVO) - ${nombre} ${apellido} ${numero_contacto}, ID: ${identityCheck[0].id}`);
            advertencias.push({
                type: "EXACT_DUPLICATE_WARNING",
                message: "Existe un lead idéntico registrado en la última hora",
                existingLeadId: identityCheck[0].id
            });
        }
        
        // ✅ GUARDAR ADVERTENCIAS EN REQUEST (para que el controlador las use)
        if (advertencias.length > 0) {
            req.duplicateWarnings = advertencias;
            console.info(`ℹ️ Se encontraron ${advertencias.length} duplicado(s), pero se permite continuar`);
        }
        
        // ✅ SIEMPRE CONTINUAR (NO BLOQUEAR)
        next();
        
    } catch (error) {
        console.error('Error en validateLeadDuplicates:', error);
        // En caso de error en la validación, permitir continuar
        next();
    }
};

module.exports = {
    preventDuplicateSubmission,
    leadCreationLimiter,
    validateLeadDuplicates
};
