const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { register, login, logout, requestPasswordReset, resetPassword } = require('../controllers/authController');
const { loginLimiter, registerLimiter, passwordResetLimiter } = require('../middlewares/rateLimiters');
const { authValidators, handleValidationErrors } = require('../middlewares/validators');
const { authenticateToken } = require('../middlewares/authMiddleware');

// 🛡️ RUTAS CON VALIDACIÓN Y RATE LIMITING
router.post('/register', 
    registerLimiter, 
    authValidators.register, 
    handleValidationErrors, 
    register
);

router.post('/login', 
    loginLimiter, 
    authValidators.login, 
    handleValidationErrors, 
    login
);

router.post('/logout', 
    authenticateToken, 
    logout
);

router.post('/request-password-reset', 
    passwordResetLimiter, 
    authValidators.passwordReset, 
    handleValidationErrors, 
    requestPasswordReset
);

router.post('/reset-password/:token', 
    authValidators.resetPassword, 
    handleValidationErrors, 
    resetPassword
);

// ✅ NUEVA RUTA: Verificar estado de sesión
router.get('/session-status', authenticateToken, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const userId = req.user.id;
        
        // Verificar si el token existe y no está en blacklist
        const [blacklistResult] = await db.query(
            'SELECT id FROM token_blacklist WHERE token = ?', 
            [token]
        );
        
        if (blacklistResult.length > 0) {
            return res.status(401).json({ 
                active: false, 
                message: 'Token invalidado',
                timeRemaining: 0,
                shouldWarn: false
            });
        }
        
        // Verificar usuario activo
        const [userResult] = await db.query(
            'SELECT is_enabled, role FROM users WHERE id = ?', 
            [userId]
        );
        
        if (userResult.length === 0 || !userResult[0].is_enabled) {
            return res.status(401).json({ 
                active: false, 
                message: 'Usuario no habilitado',
                timeRemaining: 0,
                shouldWarn: false
            });
        }
        
        // Calcular tiempo restante (JWT típicamente tiene 24h = 86400 segundos)
        const jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const currentTime = Math.floor(Date.now() / 1000);
        const timeRemaining = Math.max(0, jwtPayload.exp - currentTime);
        const shouldWarn = timeRemaining <= 300; // Advertir si quedan 5 minutos o menos
        
        res.json({
            active: true,
            timeRemaining: timeRemaining,
            shouldWarn: shouldWarn,
            user: {
                id: userId,
                role: userResult[0].role
            }
        });
        
    } catch (error) {
        console.error('❌ Error en session-status:', error);
        res.status(500).json({ 
            active: false, 
            message: 'Error interno del servidor',
            timeRemaining: 0,
            shouldWarn: false
        });
    }
});

router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;
    console.log("Token recibido:", token);

    try {
        // Consulta para verificar el token
        const query = `SELECT id, verification_expires FROM users WHERE verification_token = ? AND verified = FALSE`;
        console.log("Ejecutando consulta SQL...");

        const [results] = await db.query(query, [token]); // Usar await db.query
        console.log("✅ Resultado de la consulta:", results);

        if (results.length === 0) {
            console.warn("⚠️ Token no encontrado o ya verificado.");
            return res.status(400).json({ message: "Enlace inválido o expirado." });
        }

        const user = results[0];
        console.log("Usuario encontrado:", user);

        const now = new Date();
        console.log("📅 Fecha de expiración del token:", user.verification_expires);
        console.log("🕒 Fecha actual:", now);

        // Verificar si el token ha expirado
        if (new Date(user.verification_expires) < now) {
            return res.status(400).json({ message: "Enlace expirado. Regístrate nuevamente." });
        }

        // Actualizar el usuario como verificado
        const updateQuery = `UPDATE users SET verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?`;
        await db.query(updateQuery, [user.id]); // Usar await db.query

        console.log("✅ Usuario verificado con éxito.");
        res.json({ message: "Cuenta verificada con éxito." });
    } catch (error) {
        console.error("❌ Error inesperado:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});


router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;
    console.log("Token recibido:", token);

    try {
        const query = `SELECT id, verification_expires FROM users WHERE verification_token = ? AND verified = FALSE`;
        console.log("Ejecutando consulta SQL...");

        db.query(query, [token], async (err, results) => {
            if (err) {
                console.error("❌ Error en la consulta SQL:", err);
                return res.status(500).json({ message: "Error en el servidor." });
            }

            console.log("✅ Resultado de la consulta:", results);

            if (results.length === 0) {
                console.warn("⚠️ Token no encontrado o ya verificado.");
                return res.status(400).json({ message: "Enlace inválido o expirado." });
            }

            const user = results[0];
            console.log("Usuario encontrado:", user);

            const now = new Date();

            console.log("📅 Fecha de expiración del token:", user.verification_expires);
            console.log("🕒 Fecha actual:", now);

            if (new Date(user.verification_expires) < now) {
                return res.status(400).json({ message: "Enlace expirado. Regístrate nuevamente." });
            }

            // 🔄 Marcar usuario como verificado
            const updateQuery = `UPDATE users SET verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?`;
            db.query(updateQuery, [user.id], (err) => {
                if (err) {
                    console.error("❌ Error al actualizar usuario:", err);
                    return res.status(500).json({ message: "Error al actualizar el usuario." });
                }

                console.log("✅ Usuario verificado con éxito.");
                res.json({ message: "Cuenta verificada con éxito." });
            });
        });

    } catch (error) {
        console.error("❌ Error inesperado:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});



module.exports = router;
