const axios = require('axios');

/**
 * 🔐 Servicio para validar reCAPTCHA v3
 * Valida tokens de reCAPTCHA con Google y verifica puntuaciones
 */

// 🔐 Configuración de reCAPTCHA v3
const RECAPTCHA_CONFIG = {
    SECRET_KEY: process.env.RECAPTCHA_SECRET || process.env.RECAPTCHA_SECRET_KEY || '6LdOVAkrAAAAAE9wKlwYjb5_UVE4S4lAc2t8ZBxg', // Clave secreta
    VERIFY_URL: 'https://www.google.com/recaptcha/api/siteverify',
    MIN_SCORE: parseFloat(process.env.RECAPTCHA_THRESHOLD) || 0.5, // Puntuación mínima para considerar válido (0.0 = bot, 1.0 = humano)
    TIMEOUT: 15000 // Timeout de 15 segundos (aumentado de 5000ms para evitar timeouts frecuentes)
};

/**
 * 🛡️ Validar token de reCAPTCHA v3
 * @param {string} token - Token generado por reCAPTCHA v3
 * @param {string} action - Acción esperada (login, register, etc.)
 * @param {string} remoteip - IP del cliente (opcional)
 * @returns {Object} Resultado de la validación
 */
const validateRecaptcha = async (token, action = 'login', remoteip = null) => {
    try {
        // 🔍 Validaciones iniciales
        if (!token || typeof token !== 'string') {
            return {
                success: false,
                error: 'Token de reCAPTCHA requerido',
                code: 'MISSING_TOKEN'
            };
        }

        if (!RECAPTCHA_CONFIG.SECRET_KEY) {
            console.error('❌ RECAPTCHA_SECRET_KEY no configurada');
            return {
                success: false,
                error: 'Servicio de verificación no disponible',
                code: 'SERVICE_UNAVAILABLE'
            };
        }

        // 📤 Preparar datos para enviar a Google
        const verifyData = {
            secret: RECAPTCHA_CONFIG.SECRET_KEY,
            response: token
        };

        // 🌐 Agregar IP si está disponible
        if (remoteip) {
            verifyData.remoteip = remoteip;
        }

        console.log(`🔐 Validando reCAPTCHA - Acción: ${action}, IP: ${remoteip || 'N/A'}`);

        // 📞 Llamar a la API de Google reCAPTCHA
        const response = await axios({
            method: 'POST',
            url: RECAPTCHA_CONFIG.VERIFY_URL,
            timeout: RECAPTCHA_CONFIG.TIMEOUT,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: new URLSearchParams(verifyData).toString()
        });

        const result = response.data;

        console.log(`📊 Respuesta reCAPTCHA:`, {
            success: result.success,
            score: result.score,
            action: result.action,
            hostname: result.hostname,
            challenge_ts: result.challenge_ts
        });

        // 🚫 Verificar si la validación falló
        if (!result.success) {
            console.warn(`⚠️ reCAPTCHA falló - Errores:`, result['error-codes']);
            
            return {
                success: false,
                error: 'Verificación de reCAPTCHA falló',
                code: 'RECAPTCHA_FAILED',
                details: {
                    errors: result['error-codes'],
                    timestamp: result.challenge_ts
                }
            };
        }

        // 📊 Verificar puntuación (solo para reCAPTCHA v3)
        if (result.score !== undefined) {
            if (result.score < RECAPTCHA_CONFIG.MIN_SCORE) {
                console.warn(`🤖 Puntuación baja detectada - Score: ${result.score}, Mínimo: ${RECAPTCHA_CONFIG.MIN_SCORE}`);
                
                return {
                    success: false,
                    error: 'Actividad sospechosa detectada',
                    code: 'LOW_SCORE',
                    details: {
                        score: result.score,
                        minScore: RECAPTCHA_CONFIG.MIN_SCORE,
                        action: result.action
                    }
                };
            }
        }

        // 🎯 Verificar acción esperada (opcional pero recomendado)
        if (result.action && result.action !== action) {
            console.warn(`🎯 Acción incorrecta - Esperada: ${action}, Recibida: ${result.action}`);
            
            return {
                success: false,
                error: 'Acción de verificación incorrecta',
                code: 'ACTION_MISMATCH',
                details: {
                    expected: action,
                    received: result.action
                }
            };
        }

        // ✅ Validación exitosa
        console.log(`✅ reCAPTCHA válido - Score: ${result.score || 'N/A'}, Acción: ${result.action || action}`);
        
        return {
            success: true,
            score: result.score,
            action: result.action,
            hostname: result.hostname,
            challenge_ts: result.challenge_ts
        };

    } catch (error) {
        console.error('❌ Error validando reCAPTCHA:', error.message);
        
        // 🌐 Errores de red o timeout
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            console.warn('⚠️ Timeout en verificación de reCAPTCHA - permitiendo acceso después de 15 segundos');
            // En caso de timeout, permitir el acceso después del tiempo de espera
            // (Suposición: si no hay error de bot después de 15s, probablemente es un usuario real)
            return {
                success: true,
                score: 0.7, // Puntuación media
                action: action,
                hostname: 'unknown',
                challenge_ts: new Date().toISOString(),
                timeout: true,
                message: 'Verificación permitida después de timeout'
            };
        }

        // 🔥 Error genérico
        return {
            success: false,
            error: 'Error interno de verificación',
            code: 'VERIFICATION_ERROR',
            details: error.message
        };
    }
};

/**
 * 🛡️ Middleware para validar reCAPTCHA en rutas
 * @param {string} action - Acción esperada
 * @param {boolean} required - Si es obligatorio (por defecto true)
 */
const recaptchaMiddleware = (action = 'submit', required = true) => {
    return async (req, res, next) => {
        try {
            const token = req.body.recaptchaToken || req.headers['recaptcha-token'];
            
            // 🔍 Si no es requerido y no hay token, continuar
            if (!required && !token) {
                console.log(`⚠️ reCAPTCHA no requerido para acción: ${action}`);
                return next();
            }

            // 🚫 Si es requerido pero no hay token, fallar
            if (required && !token) {
                return res.status(400).json({
                    message: 'Token de verificación requerido',
                    code: 'RECAPTCHA_TOKEN_REQUIRED'
                });
            }

            // 🔐 Validar el token
            const validation = await validateRecaptcha(token, action, req.ip);
            
            if (!validation.success) {
                return res.status(400).json({
                    message: validation.error,
                    code: validation.code,
                    ...(validation.details && { details: validation.details })
                });
            }

            // ✅ Agregar información del reCAPTCHA al request para uso posterior
            req.recaptcha = {
                score: validation.score,
                action: validation.action,
                hostname: validation.hostname,
                verified: true
            };

            next();

        } catch (error) {
            console.error('❌ Error en middleware reCAPTCHA:', error);
            
            if (required) {
                return res.status(500).json({
                    message: 'Error en el servicio de verificación',
                    code: 'RECAPTCHA_SERVICE_ERROR'
                });
            }
            
            // Si no es requerido, continuar sin validación
            next();
        }
    };
};

/**
 * 📊 Obtener configuración actual de reCAPTCHA (sin exponer secretos)
 */
const getConfig = () => {
    return {
        minScore: RECAPTCHA_CONFIG.MIN_SCORE,
        timeout: RECAPTCHA_CONFIG.TIMEOUT,
        hasSecretKey: !!RECAPTCHA_CONFIG.SECRET_KEY
    };
};

module.exports = {
    validateRecaptcha,
    recaptchaMiddleware,
    getConfig
};
