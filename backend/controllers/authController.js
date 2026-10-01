const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const EmailService = require('../services/emailService');
const TokenBlacklist = require('../utils/tokenBlacklist');
const moment = require('moment');
const validator = require('validator');
const { validateRecaptcha } = require('../services/recaptchaService'); // 🔐 Servicio reCAPTCHA

const register = async (req, res) => {
    try {
        const { first_name, last_name, email, phone_number, password } = req.body;

        // 🛡️ VALIDACIONES ADICIONALES DE SEGURIDAD
        if (!validator.isEmail(email)) {
            return res.status(400).json({ 
                message: "Formato de correo electrónico inválido.",
                code: "INVALID_EMAIL_FORMAT"
            });
        }

        // Verificar longitud y complejidad de contraseña
        if (!password || password.length < 8) {
            return res.status(400).json({ 
                message: "La contraseña debe tener al menos 8 caracteres.",
                code: "WEAK_PASSWORD"
            });
        }

        // Validar nombres (no números ni caracteres especiales)
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(first_name) || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(last_name)) {
            return res.status(400).json({ 
                message: "Los nombres solo pueden contener letras y espacios.",
                code: "INVALID_NAME_FORMAT"
            });
        }

        // Normalizar email
        const normalizedEmail = email.toLowerCase().trim();

        // Verificar si el correo ya está registrado
        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            console.warn(`🚨 Intento de registro con email existente: ${normalizedEmail} desde IP: ${req.ip}`);
            return res.status(400).json({ 
                message: "El correo ya está registrado.",
                code: "EMAIL_ALREADY_EXISTS"
            });
        }

        // Verificar si el número de teléfono ya está registrado
        if (phone_number) {
            const existingPhone = await User.findByPhoneNumber(phone_number);
            if (existingPhone) {
                return res.status(400).json({ 
                    message: "El número de teléfono ya está registrado.",
                    code: "PHONE_ALREADY_EXISTS"
                });
            }
        }

        // 🔐 HASH MÁS SEGURO (12 rounds en lugar de 10)
        const hashedPassword = await bcrypt.hash(password, 12);
        const verification_token = crypto.randomBytes(32).toString('hex');
        const verification_expires = moment().add(24, 'hours').format('YYYY-MM-DD HH:mm:ss');

        await User.create({
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: normalizedEmail,
            phone_number: phone_number?.trim(),
            password: hashedPassword,
            verification_token,
            verification_expires,
            created_by: null,
        });

        // 📧 ENVIAR EMAIL DE VERIFICACIÓN
        await EmailService.sendVerificationEmail(normalizedEmail, verification_token);

        console.log(`✅ Usuario registrado exitosamente: ${normalizedEmail} desde IP: ${req.ip}`);
        
        return res.status(201).json({ 
            message: "Usuario registrado. Revisa tu correo para verificar la cuenta.",
            code: "REGISTRATION_SUCCESS"
        });
    } catch (error) {
        console.error('❌ Error en registro:', error);
        res.status(500).json({ 
            message: "Error en el servidor.",
            code: "INTERNAL_ERROR"
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password, recaptchaToken } = req.body;

        // 🛡️ VALIDACIÓN Y NORMALIZACIÓN
        if (!email || !password) {
            return res.status(400).json({ 
                message: "Email y contraseña son requeridos.",
                code: "MISSING_CREDENTIALS"
            });
        }

        // 🔐 VALIDAR reCAPTCHA v3 PRIMERO
        if (recaptchaToken) {
            console.log(`🔐 Validando reCAPTCHA para login de: ${email}`);
            
            const recaptchaValidation = await validateRecaptcha(recaptchaToken, 'login', req.ip);
            
            if (!recaptchaValidation.success) {
                console.warn(`🚨 reCAPTCHA falló para ${email}: ${recaptchaValidation.error}`);
                return res.status(400).json({
                    message: "Verificación de seguridad falló. Por favor intenta nuevamente.",
                    code: recaptchaValidation.code || "RECAPTCHA_FAILED",
                    details: process.env.NODE_ENV === 'development' ? recaptchaValidation.details : undefined
                });
            }
            
            console.log(`✅ reCAPTCHA válido - Score: ${recaptchaValidation.score || 'N/A'} para ${email}`);
        } else {
            console.warn(`⚠️ Login sin reCAPTCHA desde IP: ${req.ip} para email: ${email}`);
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Verificar si el usuario existe
        const user = await User.findByEmail(normalizedEmail);
        if (!user) {
            console.warn(`🚨 Intento de login con email inexistente: ${normalizedEmail} desde IP: ${req.ip}`);
            return res.status(401).json({ 
                message: "Credenciales incorrectas.",
                code: "INVALID_CREDENTIALS"
            });
        }

        // 🔐 VALIDACIÓN: Cuenta habilitada por el administrador
        if (user.is_enabled === 0) {
            console.warn(`🚨 Intento de login con cuenta deshabilitada: ${normalizedEmail} desde IP: ${req.ip}`);
            return res.status(403).json({ 
                message: "Tu cuenta debe ser verificada por un administrador. Por favor, espera la aprobación.",
                code: "ACCOUNT_DISABLED"
            });
        }

        // Verificar si la cuenta está bloqueada
        if (user.lock_until && new Date(user.lock_until) > new Date()) {
            const lockTime = moment(user.lock_until).fromNow();
            console.warn(`🚨 Intento de login con cuenta bloqueada: ${normalizedEmail} hasta ${lockTime}`);
            return res.status(403).json({ 
                message: `Cuenta bloqueada hasta ${lockTime}. Intenta más tarde.`,
                code: "ACCOUNT_LOCKED"
            });
        }

        // Verificar si la contraseña es correcta
        const isMatch = await User.comparePassword(password, user.password);
        if (!isMatch) {
            console.warn(`🚨 Intento de login con contraseña incorrecta: ${normalizedEmail} desde IP: ${req.ip}`);
            await User.incrementFailedAttempts(normalizedEmail);
            
            if (user.failed_attempts + 1 >= 5) {
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Bloqueo de 15 minutos
                await User.lockUser(normalizedEmail, lockUntil);
                console.warn(`🚨 Cuenta bloqueada por intentos fallidos: ${normalizedEmail}`);
                return res.status(403).json({ 
                    message: "Cuenta bloqueada temporalmente por intentos fallidos. Intenta en 15 minutos.",
                    code: "ACCOUNT_LOCKED_FAILED_ATTEMPTS"
                });
            }
            return res.status(401).json({ 
                message: "Credenciales incorrectas.",
                code: "INVALID_CREDENTIALS"
            });
        }

        await User.resetFailedAttempts(normalizedEmail);

        // Verificar si la cuenta está activada por verificación de correo
        if (!user.verified) {
            return res.status(403).json({ 
                message: "Debes verificar tu correo antes de iniciar sesión.",
                code: "EMAIL_NOT_VERIFIED"
            });
        }

        // 🔐 GENERAR TOKEN CON INFORMACIÓN ADICIONAL
        const tokenPayload = {
            id: user.id,
            role: user.role,
            email: user.email,
            iat: Math.floor(Date.now() / 1000),
            ip: req.ip // Para verificación adicional
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "2h" });

        // Registrar el último inicio de sesión
        await db.execute("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);

        console.log(`✅ Login exitoso: ${normalizedEmail} desde IP: ${req.ip}`);

        return res.json({
            message: "Inicio de sesión exitoso",
            token,
            role: user.role,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            },
            code: "LOGIN_SUCCESS"
        });
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ 
            message: "Error en el servidor.",
            code: "INTERNAL_ERROR"
        });
    }
};

// 🚪 LOGOUT SEGURO CON BLACKLIST
const logout = async (req, res) => {
    try {
        const token = req.token; // Obtenido del middleware authenticateToken
        const userId = req.user.id;

        if (token) {
            // Agregar token a blacklist
            await TokenBlacklist.addToBlacklist(token, userId, 'logout');
            console.log(`🚪 Logout exitoso para usuario ${userId}`);
        }

        res.json({ 
            message: "Sesión cerrada exitosamente",
            code: "LOGOUT_SUCCESS"
        });
    } catch (error) {
        console.error('❌ Error en logout:', error);
        res.status(500).json({ 
            message: "Error cerrando sesión",
            code: "LOGOUT_ERROR"
        });
    }
};

const requestPasswordReset = async (req, res) => {
    let { email } = req.body;
    try {
        // 🛡️ VALIDACIÓN Y NORMALIZACIÓN
        if (!email || !validator.isEmail(email)) {
            return res.status(400).json({ 
                message: 'Email inválido.',
                code: 'INVALID_EMAIL'
            });
        }

        email = email.toLowerCase().trim();
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            console.warn(`🚨 Intento de reset con email inexistente: ${email} desde IP: ${req.ip}`);
            // No revelar si el email existe o no por seguridad
            return res.json({ 
                message: 'Si el correo existe, recibirás instrucciones de recuperación.',
                code: 'RESET_REQUEST_SENT'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = moment().add(1, 'hours').format('YYYY-MM-DD HH:mm:ss'); // Reducido a 1 hora

        await db.query('UPDATE users SET verification_token = ?, verification_expires = ? WHERE email = ?', 
                      [resetToken, resetExpires, email]);

        await EmailService.sendPasswordResetEmail(email, resetToken);
        
        console.log(`📧 Reset token enviado para: ${email}`);
        
        res.json({ 
            message: 'Si el correo existe, recibirás instrucciones de recuperación.',
            code: 'RESET_REQUEST_SENT'
        });

    } catch (error) {
        console.error('❌ Error en requestPasswordReset:', error);
        res.status(500).json({ 
            message: 'Error en el servidor.',
            code: 'INTERNAL_ERROR'
        });
    }
};

const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // 🛡️ VALIDACIONES - Las validaciones detalladas las hace el middleware validator
        if (!token || token.length < 32) {
            return res.status(400).json({ 
                message: 'Token inválido.',
                code: 'INVALID_TOKEN'
            });
        }

        if (!password || password.length < 8) {
            return res.status(400).json({ 
                message: 'La nueva contraseña debe tener al menos 8 caracteres.',
                code: 'WEAK_PASSWORD'
            });
        }

        const [users] = await db.query('SELECT * FROM users WHERE verification_token = ? AND verification_expires > NOW()', [token]);

        if (users.length === 0) {
            console.warn(`🚨 Intento de reset con token inválido/expirado: ${token} desde IP: ${req.ip}`);
            return res.status(400).json({ 
                message: 'Enlace inválido o expirado.',
                code: 'INVALID_OR_EXPIRED_TOKEN'
            });
        }

        // 🔐 HASH MÁS SEGURO
        const hashedPassword = await bcrypt.hash(password, 12);

        await db.query('UPDATE users SET password = ?, verification_token = NULL, verification_expires = NULL WHERE id = ?', 
                      [hashedPassword, users[0].id]);

        // 🚫 BLACKLIST TODOS LOS TOKENS DEL USUARIO POR SEGURIDAD
        await TokenBlacklist.blacklistAllUserTokens(users[0].id, 'password_reset');

        console.log(`🔐 Contraseña restablecida para usuario ID: ${users[0].id}`);

        res.json({ 
            message: 'Contraseña restablecida con éxito.',
            code: 'PASSWORD_RESET_SUCCESS'
        });

    } catch (error) {
        console.error('❌ Error en resetPassword:', error);
        res.status(500).json({ 
            message: 'Error en el servidor.',
            code: 'INTERNAL_ERROR'
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    requestPasswordReset,
    resetPassword
};
