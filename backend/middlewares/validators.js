const { body, param, query, validationResult } = require('express-validator');
const validator = require('validator');

// 🛡️ VALIDADORES COMUNES
const commonValidators = {
    
    // Email con sanitización
    email: () => body('email')
        .isEmail()
        .normalizeEmail({
            gmail_remove_dots: false,
            outlookdotcom_remove_subaddress: false
        })
        .withMessage('Email inválido')
        .isLength({ max: 100 })
        .withMessage('Email demasiado largo'),
    
    // Contraseña segura
    password: () => body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('La contraseña debe tener entre 8 y 128 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
        .withMessage('La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 símbolo especial'),
    
    // Nombre (sin caracteres especiales peligrosos)
    name: (field) => body(field)
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage(`${field} debe tener entre 2 y 50 caracteres`)
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage(`${field} solo puede contener letras y espacios`)
        .escape(), // Escapar HTML
    
    // Teléfono
    phone: () => body('phone_number')
        .optional()
        .custom((value) => {
            if (!value) return true; // Opcional
            
            // Remover todos los caracteres no numéricos para contar dígitos
            const numbersOnly = value.replace(/\D/g, '');
            
            // Debe tener al menos 10 dígitos y máximo 15
            if (numbersOnly.length < 10 || numbersOnly.length > 15) {
                throw new Error('El número debe tener entre 10 y 15 dígitos');
            }
            
            // Verificar formato básico (puede empezar con + y contener espacios, guiones, paréntesis)
            if (!/^[\+]?[\d\s\-\(\)]+$/.test(value)) {
                throw new Error('Formato de teléfono inválido');
            }
            
            return true;
        })
        .withMessage('Número de teléfono inválido')
        .isLength({ max: 20 })
        .withMessage('Número demasiado largo'),
    
    // ID numérico
    numericId: (field = 'id') => param(field)
        .isInt({ min: 1 })
        .withMessage(`${field} debe ser un número entero positivo`)
        .toInt(),
    
    // Token seguro
    token: (field = 'token') => param(field)
        .isLength({ min: 32, max: 256 })
        .matches(/^[a-fA-F0-9]+$/)
        .withMessage('Token inválido'),
    
    // Paginación
    pagination: () => [
        query('page')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage('Página debe ser un número entre 1 y 1000')
            .toInt(),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Límite debe ser un número entre 1 y 100')
            .toInt()
    ],
    
    // URL segura
    url: (field) => body(field)
        .optional()
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true
        })
        .withMessage(`${field} debe ser una URL válida`),
    
    // Texto libre (para comentarios, etc.)
    freeText: (field, maxLength = 1000) => body(field)
        .optional()
        .trim()
        .isLength({ max: maxLength })
        .withMessage(`${field} no puede exceder ${maxLength} caracteres`)
        .escape()
};

// 🛡️ VALIDADORES ESPECÍFICOS PARA AUTH
const authValidators = {
    register: [
        commonValidators.name('first_name'),
        commonValidators.name('last_name'),
        commonValidators.email(),
        commonValidators.phone(),
        commonValidators.password(),
        body('password_confirmation')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Las contraseñas no coinciden');
                }
                return true;
            })
    ],
    
    login: [
        commonValidators.email(),
        body('password')
            .notEmpty()
            .withMessage('Contraseña requerida')
            .isLength({ max: 128 })
            .withMessage('Contraseña demasiado larga')
    ],
    
    passwordReset: [
        commonValidators.email()
    ],
    
    resetPassword: [
        commonValidators.token(),
        commonValidators.password()
    ]
};

// 🛡️ VALIDADORES PARA ADMIN
const adminValidators = {
    createUser: [
        commonValidators.name('first_name'),
        commonValidators.name('last_name'),
        commonValidators.email(),
        commonValidators.phone(),
        commonValidators.password(),
        body('role')
            .isInt({ min: 1, max: 4 })
            .withMessage('Rol inválido')
            .toInt()
    ],
    
    updateUser: [
        commonValidators.numericId(),
        commonValidators.name('first_name').optional(),
        commonValidators.name('last_name').optional(),
        commonValidators.email().optional(),
        commonValidators.phone().optional(),
        body('role')
            .optional()
            .isInt({ min: 1, max: 4 })
            .withMessage('Rol inválido')
            .toInt()
    ]
};

// 🛡️ MIDDLEWARE PARA MANEJAR ERRORES DE VALIDACIÓN
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));
        
        console.warn(`🚨 Errores de validación en ${req.path}:`, errorMessages);
        
        return res.status(400).json({
            error: 'Datos inválidos',
            code: 'VALIDATION_ERROR',
            details: errorMessages
        });
    }
    
    next();
};

// 🛡️ SANITIZACIÓN ADICIONAL DE INPUTS
const sanitizeInputs = (req, res, next) => {
    // 🛡️ Excepciones para rutas que necesitan preservar hashes y parámetros exactos
    const exemptPaths = [
        '/polizas/pdf/',
        '/api/polizas/pdf/',
        '/poliza-documentos/',
        '/static/',
        '/vafirma/',
        '/api/vafirma/'
    ];
    
    if (exemptPaths.some(path => req.path.includes(path))) {
        return next();
    }
    
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            // Remover caracteres de control y espacios extra
            return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
        }
        return value;
    };
    
    // Sanitizar body
    if (req.body && typeof req.body === 'object') {
        Object.keys(req.body).forEach(key => {
            req.body[key] = sanitizeValue(req.body[key]);
        });
    }
    
    // Sanitizar query params
    if (req.query && typeof req.query === 'object') {
        Object.keys(req.query).forEach(key => {
            req.query[key] = sanitizeValue(req.query[key]);
        });
    }
    
    next();
};

// 🛡️ VALIDADORES PARA SESIONES
const sessionValidators = {
    createSession: [
        body('login_time')
            .isISO8601()
            .withMessage('login_time debe ser una fecha ISO válida'),
        body('user_agent')
            .isString()
            .isLength({ min: 1, max: 500 })
            .withMessage('user_agent debe ser una cadena válida de máximo 500 caracteres'),
        body('ip')
            .optional() // IP es opcional ya que se puede obtener del request
            .matches(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)
            .withMessage('IP debe tener formato válido')
    ],
    
    closeSession: [
        body('session_id')
            .isInt({ min: 1 })
            .withMessage('session_id debe ser un número entero positivo'),
        body('logout_time')
            .isISO8601()
            .withMessage('logout_time debe ser una fecha ISO válida'),
        body('session_time')
            .isInt({ min: 0 })
            .withMessage('session_time debe ser un número entero no negativo')
    ]
};

// 🛡️ VALIDADOR PERSONALIZADO PARA SQL INJECTION
const preventSQLInjection = (req, res, next) => {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        /(;|\-\-|\/\*|\*\/|xp_|sp_)/i,
        /(\b(OR|AND)\b.*[=<>])/i
    ];
    
    // 🔐 Campos que deben ser excluidos de la validación (tokens, hashes, etc.)
    const exemptFields = [
        'recaptchaToken',      // Token de reCAPTCHA v3
        'recaptcha_token',     // Token de reCAPTCHA v3 (snake_case)
        'token',               // Tokens JWT u otros
        'refreshToken',        // Refresh tokens
        'access_token',        // Access tokens
        'authorization',       // Headers de autorización
        'estado',              // Estado del prospecto (puede contener texto descriptivo)
        'nuevoEstado',         // Nuevo estado para cambios de estado
        'comentario'           // Texto libre (fechas, comillas, %) guardado vía queries parametrizadas
    ];
    
    const checkValue = (value, fieldName) => {
        // Saltar validación para campos excluidos
        if (exemptFields.includes(fieldName)) {
            return false;
        }
        
        if (typeof value === 'string') {
            return sqlPatterns.some(pattern => pattern.test(value));
        }
        return false;
    };
    
    // 🛡️ Excepciones para rutas específicas que pueden contener datos que parecen SQL
    const exemptPaths = [
        '/sessions/start',
        '/sessions/end',
        '/polizas/pdf/',        // Rutas de generación de PDF
        '/api/polizas/pdf/',    // Rutas de API de PDF
        '/poliza-documentos/',  // Rutas de documentos de póliza
        '/static/',             // Archivos estáticos
        '/vafirma/',            // Rutas de firma VaFirma (contienen pdfBase64)
        '/api/vafirma/',        // Rutas de API VaFirma
        '/lead',                // Formulario de leads (recaptcha_token largo)
        '/api/lead'             // Formulario de leads via /api
    ];
    
    if (exemptPaths.some(path => req.path.includes(path))) {
        return next();
    }
    
    // Verificar body
    if (req.body) {
        for (const [key, value] of Object.entries(req.body)) {
            if (checkValue(value, key)) {
                console.warn(`🚨 Posible SQL injection detectado en ${key}: ${value}`);
                return res.status(400).json({
                    error: 'Datos inválidos detectados',
                    code: 'SECURITY_VIOLATION'
                });
            }
        }
    }
    
    // Verificar query params
    if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
            if (checkValue(value, key)) {
                console.warn(`🚨 Posible SQL injection detectado en query ${key}: ${value}`);
                return res.status(400).json({
                    error: 'Parámetros inválidos detectados',
                    code: 'SECURITY_VIOLATION'
                });
            }
        }
    }
    
    next();
};

module.exports = {
    commonValidators,
    authValidators,
    adminValidators,
    sessionValidators,
    handleValidationErrors,
    sanitizeInputs,
    preventSQLInjection
};
