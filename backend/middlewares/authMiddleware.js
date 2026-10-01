const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/userModel');
const TokenBlacklist = require('../utils/tokenBlacklist');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                message: 'Token no proporcionado',
                code: 'NO_TOKEN'
            });
        }

        // 🚫 Verificar si el token está en blacklist
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        if (isBlacklisted) {
            console.warn(`🚫 Token blacklisted usado por IP: ${req.ip}`);
            return res.status(401).json({ 
                message: 'Token inválido',
                code: 'TOKEN_BLACKLISTED'
            });
        }

        // ✅ Verificar y decodificar token
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                console.warn(`🚨 Token inválido desde IP: ${req.ip} - Error: ${err.message}`);
                return res.status(403).json({ 
                    message: 'Token inválido',
                    code: 'INVALID_TOKEN'
                });
            }

            // 🔐 Verificar que el usuario existe y está habilitado
            const isEnabled = await User.isUserEnabled(decoded.id);
            if (!isEnabled) {
                return res.status(403).json({ 
                    message: 'Tu cuenta no ha sido habilitada por un administrador.',
                    code: 'ACCOUNT_DISABLED'
                });
            }

            // 🕐 Verificar tiempo de expiración adicional (doble verificación)
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp <= now) {
                return res.status(401).json({ 
                    message: 'Token expirado',
                    code: 'TOKEN_EXPIRED'
                });
            }

            // ✅ Agregar información adicional al request
            req.user = decoded;
            req.token = token; // Para poder blacklisted en logout
            req.authTime = now;
            
            next();
        });
    } catch (error) {
        console.error('❌ Error en authenticateToken:', error);
        return res.status(500).json({ 
            message: 'Error de autenticación',
            code: 'AUTH_ERROR'
        });
    }
};

const authenticateAdmin = (req, res, next) => {
    if (req.user.role !== 3) { // 3 es el rol de administrador
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden realizar esta acción.' });
    }
    next();
};

const authenticateBackOffice = (req, res, next) => {
    if (req.user.role !== 4) { // 4 es el rol de Back Office
        return res.status(403).json({ message: 'Acceso denegado. Solo usuarios de Back Office pueden realizar esta acción.' });
    }
    next();
};

const authenticateSupervisor = (req, res, next) => {
    if (req.user.role !== 2) { // 2 es el rol de Supervisor
        return res.status(403).json({ message: 'Acceso denegado. Solo supervisores pueden realizar esta acción.' });
    }
    next();
};

const authenticateVendedor = (req, res, next) => {
    if (req.user.role !== 1) { // 1 es el rol de Vendedor
        return res.status(403).json({ message: 'Acceso denegado. Solo vendedores pueden realizar esta acción.' });
    }
    next();
};

// Middleware para verificar múltiples roles
const authenticateRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Acceso denegado. No tienes permisos para realizar esta acción.',
                allowedRoles: roles,
                userRole: req.user.role
            });
        }
        next();
    };
};

// ✅ NUEVO: Alias para requireBackOfficeRole (mismo que authenticateBackOffice)
const requireBackOfficeRole = authenticateBackOffice;

// ✅ NUEVO: Middleware más flexible para BackOffice - acepta BackOffice y Admin
const requireBackOfficeOrAdmin = (req, res, next) => {
    if (req.user.role !== 4 && req.user.role !== 3) { // 4 = BackOffice, 3 = Admin
        return res.status(403).json({ 
            message: 'Acceso denegado. Solo usuarios de Back Office o Administradores pueden realizar esta acción.',
            requiredRoles: ['BackOffice', 'Admin'],
            userRole: req.user.role
        });
    }
    next();
};

module.exports = { 
    authenticateToken, 
    authenticateAdmin, 
    authenticateBackOffice,
    authenticateSupervisor,
    authenticateVendedor,
    authenticateRoles,
    requireBackOfficeRole, // ✅ NUEVO: Alias
    requireBackOfficeOrAdmin // ✅ NUEVO: Más flexible
};