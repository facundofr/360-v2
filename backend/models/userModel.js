const db = require('../config/db');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// Función de validación para datos de usuario
function validarDatosUsuario({
    first_name, last_name, email, phone_number, password, verification_token, verification_expires, created_by
}) {
    const errores = [];
    if (!first_name || typeof first_name !== 'string' || first_name.length < 2 || first_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(first_name)) {
        errores.push("El nombre debe tener entre 2 y 50 caracteres y contener solo letras.");
    }
    if (!last_name || typeof last_name !== 'string' || last_name.length < 2 || last_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(last_name)) {
        errores.push("El apellido debe tener entre 2 y 50 caracteres y contener solo letras.");
    }
    if (!email || !validator.isEmail(email)) {
        errores.push("El correo electrónico no es válido.");
    }
    if (!phone_number || typeof phone_number !== 'string' || !/^[\d\s\(\)\+\-]{8,20}$/.test(phone_number)) {
        errores.push("El formato del número de teléfono es inválido. Debe contener entre 8 y 20 caracteres numéricos.");
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        errores.push("La contraseña debe tener al menos 6 caracteres.");
    }
    // Puedes agregar más validaciones según tus necesidades (por ejemplo, created_by debe ser un número)
    return errores;
}

const User = {
    async create({
        first_name, last_name, email, phone_number, 
        password, verification_token, verification_expires, created_by
    }) {
        // Validar datos antes de insertar
        const errores = validarDatosUsuario({
            first_name, last_name, email, phone_number, password, verification_token, verification_expires, created_by
        });
        if (errores.length > 0) {
            const err = new Error("Error de validación");
            err.errores = errores;
            throw err;
        }

        // Sanitizar entradas
        first_name = validator.escape(first_name);
        last_name = validator.escape(last_name);
        email = email.toLowerCase().trim(); // Solo minúsculas y sin espacios, conservando puntos
        phone_number = validator.escape(phone_number);

        const query = `
            INSERT INTO users (
                first_name, last_name, email, phone_number, 
                password, verification_token, verification_expires, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(query, [
            first_name, last_name, email, phone_number,  
            password, verification_token, verification_expires, created_by
        ]);
        return result;
    },

    async findByEmail(email) {
        email = email.toLowerCase().trim(); // Solo minúsculas y sin espacios, conservando puntos
        const query = `SELECT * FROM users WHERE email = ?`;
        const [rows] = await db.query(query, [email]);
        return rows[0];
    },
    
    async findByPhoneNumber(phone_number) {
        phone_number = validator.escape(phone_number); // Sanitizar el número de teléfono
        const query = `SELECT * FROM users WHERE phone_number = ?`;
        const [rows] = await db.query(query, [phone_number]);
        return rows[0];
    },

    async comparePassword(inputPassword, hashedPassword) {
        return bcrypt.compare(inputPassword, hashedPassword);
    },

    async verifyUser(token) {
        const query = `UPDATE users SET verified = 1, verification_token = NULL WHERE verification_token = ?`;
        await db.query(query, [token]);
    },

    async updateLastLogin(id) {
        const query = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
        await db.query(query, [id]);
    },

    async incrementFailedAttempts(email) {
        email = email.toLowerCase().trim(); // Normalizar consistentemente
        const query = `UPDATE users SET failed_attempts = failed_attempts + 1 WHERE email = ?`;
        await db.query(query, [email]);
    },

    async resetFailedAttempts(email) {
        email = email.toLowerCase().trim(); // Normalizar consistentemente
        const query = `UPDATE users SET failed_attempts = 0 WHERE email = ?`;
        await db.query(query, [email]);
    },

    async lockUser(email, lockUntil) {
        email = email.toLowerCase().trim(); // Normalizar consistentemente
        const query = `UPDATE users SET lock_until = ? WHERE email = ?`;
        await db.query(query, [lockUntil, email]);
    },

    async enableUser(id) {
        const query = `UPDATE users SET is_enabled = 1 WHERE id = ?`;
        await db.query(query, [id]);
    },

    async isUserEnabled(id) {
        const query = `SELECT is_enabled FROM users WHERE id = ?`;
        const [rows] = await db.query(query, [id]);
        return rows[0]?.is_enabled === 1;
    },

    async findById(id) {
        const query = `SELECT * FROM users WHERE id = ?`;
        const [rows] = await db.query(query, [id]);
        return rows[0];
    }
};

module.exports = User;
