/**
 * Middleware para verificar roles de usuarios
 * Wrapper de authenticateRoles del authMiddleware
 */

const { authenticateRoles } = require('./authMiddleware');

/**
 * Middleware de roles que acepta un array de roles permitidos
 * @param {Array<number>} allowedRoles - Array de roles permitidos (1: Vendedor, 2: Supervisor, 3: Admin, 4: BackOffice)
 * @returns {Function} Middleware function
 */
const roleMiddleware = (allowedRoles) => {
    if (!Array.isArray(allowedRoles)) {
        throw new Error('roleMiddleware: allowedRoles debe ser un array');
    }

    return authenticateRoles(...allowedRoles);
};

module.exports = roleMiddleware;