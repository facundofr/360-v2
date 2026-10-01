const pool = require('../../config/db'); // Conexión a la base de datos
const validator = require('validator'); // Para sanitizar entradas
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');

class Admin {
    // ✅ CORREGIR: Consulta con columnas que realmente existen
    static async listUsersByRoles() {
        const query = `
            SELECT 
                id, 
                first_name, 
                last_name, 
                email, 
                phone_number, 
                role, 
                is_enabled, 
                verified,
                verification_token,
                verification_expires,
                created_at, 
                updated_at,
                last_login,
                password_updated_at,
                session_time,
                failed_attempts,
                lock_until,
                language,
                timezone,
                theme,
                created_by,
                updated_by
            FROM users 
            WHERE role IN (1, 2, 3, 4) 
            ORDER BY created_at DESC
        `;
        const [rows] = await pool.query(query);
        return rows;
    }

    // Crear un nuevo usuario
    static async createUser({ first_name, last_name, email, phone_number, password, role }) {
        // Validación
        const errores = [];
        if (!first_name || typeof first_name !== 'string' || first_name.length < 2 || first_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(first_name)) {
            errores.push("El nombre debe tener entre 2 y 50 caracteres y solo letras.");
        }
        if (!last_name || typeof last_name !== 'string' || last_name.length < 2 || last_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(last_name)) {
            errores.push("El apellido debe tener entre 2 y 50 caracteres y solo letras.");
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
        if (!Number.isInteger(Number(role)) || Number(role) < 1 || Number(role) > 4) {
            errores.push("El rol seleccionado no es válido.");
        }
        if (errores.length > 0) {
            const err = new Error("Error de validación");
            err.errores = errores;
            throw err;
        }

        // Sanitización
        first_name = validator.escape(first_name);
        last_name = validator.escape(last_name);
        email = email.toLowerCase().trim(); // ✅ CORREGIDO: Conservar puntos en email
        phone_number = validator.escape(phone_number);

        const query = `
            INSERT INTO users (first_name, last_name, email, phone_number, password, role)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query(query, [
            first_name,
            last_name,
            email,
            phone_number,
            password,
            role,
        ]);
        return result;
    }

    // Buscar un usuario por ID
    static async findById(id) {
        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            throw new Error("ID de usuario inválido.");
        }
        const query = `SELECT * FROM users WHERE id = ?`;
        const [rows] = await pool.query(query, [id]);
        return rows[0]; // Retorna el primer resultado o undefined si no existe
    }

    // Eliminar un usuario
    static async deleteUser(id) {
        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            throw new Error("ID de usuario inválido.");
        }

        // Verificar si el usuario existe antes de eliminar
        const user = await this.findById(id);
        if (!user) {
            throw new Error("Usuario no encontrado.");
        }

        // Verificar si es un administrador (no se puede eliminar)
        if (user.role === 3) {
            throw new Error("No se puede eliminar un usuario administrador.");
        }

        // ✅ VERIFICAR: Dependencias con nombres de columna correctos según tu estructura
        const dependenciasQuery = `
            SELECT 
                (SELECT COUNT(*) FROM prospectos WHERE user_id = ?) as prospectos_count,
                (SELECT COUNT(*) FROM polizas WHERE created_by = ?) as polizas_count,
                (SELECT COUNT(*) FROM users WHERE created_by = ?) as users_created_count,
                (SELECT COUNT(*) FROM users WHERE updated_by = ?) as users_updated_count
        `;
        
        const [dependencias] = await pool.query(dependenciasQuery, [id, id, id, id]);
        
        const prospectos_count = dependencias[0].prospectos_count || 0;
        const polizas_count = dependencias[0].polizas_count || 0;
        const users_created = dependencias[0].users_created_count || 0;
        const users_updated = dependencias[0].users_updated_count || 0;
        
        // Verificar si tiene dependencias
        if (prospectos_count > 0 || polizas_count > 0 || users_created > 0 || users_updated > 0) {
            let mensaje = "No se puede eliminar el usuario porque tiene registros asociados:\n";
            
            if (prospectos_count > 0) {
                mensaje += `• ${prospectos_count} prospectos asignados\n`;
            }
            if (polizas_count > 0) {
                mensaje += `• ${polizas_count} pólizas creadas\n`;
            }
            if (users_created > 0) {
                mensaje += `• ${users_created} usuarios creados\n`;
            }
            if (users_updated > 0) {
                mensaje += `• ${users_updated} usuarios actualizados\n`;
            }
            
            mensaje += "\nConsidere deshabilitar la cuenta en su lugar.";
            throw new Error(mensaje);
        }

        // Verificar si es un usuario reciente (menos de 24 horas)
        const creationDate = new Date(user.created_at);
        const now = new Date();
        const hoursDifference = (now - creationDate) / (1000 * 60 * 60);
        
        // Solo permitir eliminación de usuarios muy recientes sin actividad
        if (hoursDifference > 24) {
            throw new Error("Por seguridad, solo se pueden eliminar usuarios creados hace menos de 24 horas. Para usuarios con más tiempo, use la opción de deshabilitar.");
        }

        // Intentar eliminar el usuario
        try {
            const query = `DELETE FROM users WHERE id = ?`;
            const [result] = await pool.query(query, [id]);
            
            if (result.affectedRows === 0) {
                throw new Error("No se pudo eliminar el usuario.");
            }
            
            console.log(`✅ Usuario eliminado exitosamente: ID ${id}`);
            return result;
            
        } catch (deleteError) {
            console.error("❌ Error en eliminación:", deleteError);
            
            // Manejar errores específicos de MySQL
            if (deleteError.code === 'ER_ROW_IS_REFERENCED_2' || deleteError.code === 'ER_ROW_IS_REFERENCED') {
                throw new Error("No se puede eliminar el usuario porque tiene registros asociados en el sistema. Considere deshabilitar la cuenta en su lugar.");
            }
            
            // Re-lanzar otros errores
            throw deleteError;
        }
    }

    // ✅ MEJORAR: Deshabilitar usuario (método más seguro)
    static async disableUser(id) {
        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            throw new Error("ID de usuario inválido.");
        }

        // Verificar si el usuario existe
        const userExists = await this.findById(id);
        if (!userExists) {
            throw new Error("Usuario no encontrado.");
        }

        // Verificar si es un administrador
        if (userExists.role === 3) {
            throw new Error("No se puede deshabilitar un usuario administrador.");
        }

        // Verificar si ya está deshabilitado
        if (userExists.is_enabled === 0) {
            throw new Error("El usuario ya está deshabilitado.");
        }

        const query = `UPDATE users SET is_enabled = 0, updated_at = NOW() WHERE id = ?`;
        const [result] = await pool.query(query, [id]);
        
        if (result.affectedRows === 0) {
            throw new Error("No se pudo deshabilitar el usuario.");
        }
        
        console.log(`🚫 Usuario deshabilitado exitosamente: ID ${id}`);
        return result;
    }

    // ✅ MEJORAR: Habilitar usuario
    static async enableUser(id) {
        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            throw new Error("ID de usuario inválido.");
        }

        // Verificar si el usuario existe
        const userExists = await this.findById(id);
        if (!userExists) {
            throw new Error("Usuario no encontrado.");
        }

        // Verificar si ya está habilitado
        if (userExists.is_enabled === 1) {
            throw new Error("El usuario ya está habilitado.");
        }

        const query = `UPDATE users SET is_enabled = 1, updated_at = NOW() WHERE id = ?`;
        const [result] = await pool.query(query, [id]);
        
        if (result.affectedRows === 0) {
            throw new Error("No se pudo habilitar el usuario.");
        }
        
        console.log(`✅ Usuario habilitado exitosamente: ID ${id}`);
        return result;
    }

    // ✅ AGREGAR: Método para actualizar usuario
    static async updateUser(id, { first_name, last_name, email, phone_number, role }) {
        // Validación de ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            throw new Error("ID de usuario inválido.");
        }

        // Validaciones de campos
        const errores = [];
        if (!first_name || typeof first_name !== 'string' || first_name.length < 2 || first_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(first_name)) {
            errores.push("El nombre debe tener entre 2 y 50 caracteres y solo letras.");
        }
        if (!last_name || typeof last_name !== 'string' || last_name.length < 2 || last_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(last_name)) {
            errores.push("El apellido debe tener entre 2 y 50 caracteres y solo letras.");
        }
        if (!email || !validator.isEmail(email)) {
            errores.push("El correo electrónico no es válido.");
        }
        if (!phone_number || typeof phone_number !== 'string' || !/^[\d\s\(\)\+\-]{8,20}$/.test(phone_number)) {
            errores.push("El formato del número de teléfono es inválido. Debe contener entre 8 y 20 caracteres numéricos.");
        }
        if (!Number.isInteger(Number(role)) || Number(role) < 1 || Number(role) > 4) {
            errores.push("El rol seleccionado no es válido.");
        }

        if (errores.length > 0) {
            const err = new Error("Error de validación");
            err.errores = errores;
            throw err;
        }

        // Sanitización
        first_name = validator.escape(first_name);
        last_name = validator.escape(last_name);
        email = email.toLowerCase().trim(); // ✅ CORREGIDO: Conservar puntos en email
        phone_number = validator.escape(phone_number);

        // Verificar si el usuario existe
        const userExists = await this.findById(id);
        if (!userExists) {
            throw new Error("Usuario no encontrado.");
        }

        // Verificar si el email ya existe en otro usuario
        const emailCheck = await pool.query(
            'SELECT id FROM users WHERE email = ? AND id != ?', 
            [email, id]
        );
        if (emailCheck[0].length > 0) {
            throw new Error("El correo electrónico ya está registrado por otro usuario.");
        }

        // Verificar si el teléfono ya existe en otro usuario
        const phoneCheck = await pool.query(
            'SELECT id FROM users WHERE phone_number = ? AND id != ?', 
            [phone_number, id]
        );
        if (phoneCheck[0].length > 0) {
            throw new Error("El número de teléfono ya está registrado por otro usuario.");
        }

        // Detectar si el email cambió para resetear la verificación
        const emailChanged = userExists.email.toLowerCase().trim() !== email;

        const query = `
            UPDATE users 
            SET first_name = ?, last_name = ?, email = ?, phone_number = ?, role = ?,
                verified = IF(? = 1, 0, verified),
                updated_at = NOW()
            WHERE id = ?
        `;
        
        const [result] = await pool.query(query, [
            first_name,
            last_name,
            email,
            phone_number,
            role,
            emailChanged ? 1 : 0,
            id
        ]);

        return { result, emailChanged };
    }

    // ✅ MEJORAR: Crear un nuevo usuario con token de verificación
    static async createUser({ 
        first_name, last_name, email, phone_number, password, role, 
        verification_token, verification_expires, created_by 
    }) {
        // Validación (mantener la existente)
        const errores = [];
        if (!first_name || typeof first_name !== 'string' || first_name.length < 2 || first_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(first_name)) {
            errores.push("El nombre debe tener entre 2 y 50 caracteres y solo letras.");
        }
        if (!last_name || typeof last_name !== 'string' || last_name.length < 2 || last_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(last_name)) {
            errores.push("El apellido debe tener entre 2 y 50 caracteres y solo letras.");
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
        if (!Number.isInteger(Number(role)) || Number(role) < 1 || Number(role) > 4) {
            errores.push("El rol seleccionado no es válido.");
        }
        
        if (errores.length > 0) {
            const err = new Error("Error de validación");
            err.errores = errores;
            throw err;
        }

        // Sanitización
        first_name = validator.escape(first_name);
        last_name = validator.escape(last_name);
        email = email.toLowerCase().trim(); // ✅ CORREGIDO: Conservar puntos en email
        phone_number = validator.escape(phone_number);

        // ✅ MEJORAR: Query con campos adicionales
        const query = `
            INSERT INTO users (
                first_name, last_name, email, phone_number, password, role,
                verification_token, verification_expires, created_by,
                is_enabled, verified, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())
        `;
        
        const [result] = await pool.query(query, [
            first_name,
            last_name,
            email,
            phone_number,
            password,
            role,
            verification_token || null,
            verification_expires || null,
            created_by || null
        ]);
        
        return result;
    }

    // Obtener lista de vendedores
    static async getVendedores() {
        try {
            const query = `
                SELECT 
                    id,
                    first_name,
                    last_name,
                    email,
                    phone_number,
                    is_enabled,
                    created_at,
                    last_login
                FROM users 
                WHERE categoria_id = 2 
                AND is_enabled = 1
                ORDER BY first_name ASC, last_name ASC;
            `;
            
            const [rows] = await pool.query(query);
            return rows;
        } catch (error) {
            console.error('❌ Error en Admin.getVendedores:', error);
            throw error;
        }
    }

    // Obtener lista de supervisores
    static async getSupervisores() {
        try {
            const query = `
                SELECT 
                    id,
                    first_name,
                    last_name,
                    email,
                    phone_number,
                    is_enabled,
                    created_at,
                    last_login
                FROM users 
                WHERE categoria_id = 3 
                AND is_enabled = 1
                ORDER BY first_name ASC, last_name ASC;
            `;
            
            const [rows] = await pool.query(query);
            return rows;
        } catch (error) {
            console.error('❌ Error en Admin.getSupervisores:', error);
            throw error;
        }
    }

    // ✅ NUEVO: Obtener usuarios activos en tiempo real
    static async getActiveUsers(timeframeMinutes = 5) {
        try {
            const query = `
                SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.phone_number,
                    u.role,
                    u.is_enabled,
                    u.last_login,
                    u.last_activity,
                    u.is_logged_out,
                    CASE 
                        WHEN u.role = 1 THEN 'Vendedor'
                        WHEN u.role = 2 THEN 'Supervisor'
                        WHEN u.role = 3 THEN 'Administrador'
                        WHEN u.role = 4 THEN 'Back Office'
                        ELSE 'Desconocido'
                    END as role_name,
                    CASE 
                        WHEN u.role = 1 THEN 'primary'
                        WHEN u.role = 2 THEN 'success'
                        WHEN u.role = 3 THEN 'danger'
                        WHEN u.role = 4 THEN 'info'
                        ELSE 'secondary'
                    END as role_color,
                    TIMESTAMPDIFF(MINUTE, COALESCE(u.last_activity, u.last_login), NOW()) as minutes_since_activity,
                    DATE_FORMAT(COALESCE(u.last_activity, u.last_login), '%H:%i:%s') as last_activity_time,
                    DATE_FORMAT(COALESCE(u.last_activity, u.last_login), '%d/%m/%Y') as last_activity_date
                FROM users u
                WHERE u.is_enabled = 1
                AND u.is_logged_out = 0
                AND (u.last_activity IS NOT NULL OR u.last_login IS NOT NULL)
                AND COALESCE(u.last_activity, u.last_login) >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
                ORDER BY COALESCE(u.last_activity, u.last_login) DESC;
            `;
            
            const [rows] = await pool.query(query, [timeframeMinutes]);
            return rows;
        } catch (error) {
            console.error('❌ Error en Admin.getActiveUsers:', error);
            throw error;
        }
    }

    // ✅ NUEVO: Obtener estadísticas de actividad
    static async getUserActivityStats() {
        try {
            const queries = {
                // Usuarios activos en diferentes timeframes
                activeStats: `
                    SELECT 
                        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END) as active_5min,
                        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 END) as active_15min,
                        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as active_1hour,
                        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as active_today,
                        COUNT(*) as total_users,
                        COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as enabled_users,
                        COUNT(CASE WHEN last_login IS NULL THEN 1 END) as never_logged_in
                    FROM users 
                    WHERE role IN (1, 2, 3, 4)
                `,
                
                // Estadísticas por roles
                roleStats: `
                    SELECT 
                        u.role,
                        CASE 
                            WHEN u.role = 1 THEN 'Vendedor'
                            WHEN u.role = 2 THEN 'Supervisor'
                            WHEN u.role = 3 THEN 'Administrador'
                            WHEN u.role = 4 THEN 'Back Office'
                            ELSE 'Desconocido'
                        END as role_name,
                        COUNT(*) as total,
                        COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as enabled,
                        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as active_today,
                        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END) as active_now
                    FROM users u
                    WHERE u.role IN (1, 2, 3, 4)
                    GROUP BY u.role
                    ORDER BY u.role
                `,
                
                // Últimos logins
                recentLogins: `
                    SELECT 
                        u.id,
                        u.first_name,
                        u.last_name,
                        u.email,
                        u.role,
                        CASE 
                            WHEN u.role = 1 THEN 'Vendedor'
                            WHEN u.role = 2 THEN 'Supervisor'
                            WHEN u.role = 3 THEN 'Administrador'
                            WHEN u.role = 4 THEN 'Back Office'
                            ELSE 'Desconocido'
                        END as role_name,
                        u.last_login,
                        TIMESTAMPDIFF(MINUTE, u.last_login, NOW()) as minutes_ago
                    FROM users u
                    WHERE u.last_login IS NOT NULL
                    AND u.is_enabled = 1
                    ORDER BY u.last_login DESC
                    LIMIT 10
                `
            };

            const [activeStats] = await pool.query(queries.activeStats);
            const [roleStats] = await pool.query(queries.roleStats);
            const [recentLogins] = await pool.query(queries.recentLogins);

            return {
                summary: activeStats[0],
                by_role: roleStats,
                recent_logins: recentLogins,
                last_updated: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error en Admin.getUserActivityStats:', error);
            throw error;
        }
    }

    // ✅ NUEVO: Actualizar actividad del usuario
    static async updateUserActivity(userId, activityData = {}) {
        try {
            // Actualizar last_activity como indicador principal de actividad
            // También establecer is_logged_out = 0 para reactivar al usuario
            const query = `
                UPDATE users 
                SET last_activity = NOW(),
                    is_logged_out = 0,
                    updated_at = NOW()
                WHERE id = ? AND is_enabled = 1
            `;
            
            const [result] = await pool.query(query, [userId]);
            
            // Log de la actividad para debugging
            console.log(`💓 Actividad actualizada para usuario ${userId}:`, {
                affected_rows: result.affectedRows,
                activity_data: activityData,
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            console.error('❌ Error en Admin.updateUserActivity:', error);
            throw error;
        }
    }

    // ✅ NUEVO: Marcar usuario como inactivo (para logout)
    static async markUserInactive(userId) {
        try {
            // Marcar como logueado fuera para que no aparezca como activo
            const query = `
                UPDATE users 
                SET is_logged_out = 1,
                    updated_at = NOW()
                WHERE id = ? AND is_enabled = 1
            `;
            
            const [result] = await pool.query(query, [userId]);
            
            // Log de la desactivación para debugging
            console.log(`🚪 Usuario ${userId} marcado como inactivo (logout):`, {
                affected_rows: result.affectedRows,
                timestamp: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            console.error('❌ Error en Admin.markUserInactive:', error);
            throw error;
        }
    }

    // ✅ NUEVOS MÉTODOS: Gestión de prospectos para admin
    static async getAllProspectos() {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.nombre,
                    p.apellido,
                    p.edad,
                    p.numero_contacto as telefono,
                    p.correo as email,
                    p.localidad,
                    p.fecha_registro as fecha_registro,
                    p.comentario as notas,
                    p.whatsapp_opt_in,
                    p.whatsapp_opt_in_fecha,
                    p.es_reciclado, -- ✅ NUEVO: Campo para identificar refritos
                    
                    -- Estado: COALESCE para usar prospectos.estado si es "Dato repetido" o "Fuera de edad", si no usar asignaciones.estado
                    COALESCE(
                        CASE 
                            WHEN p.estado IN ('Dato repetido', 'Fuera de edad') THEN p.estado
                            ELSE NULL
                        END,
                        asig.estado,
                        'Sin asignar'
                    ) as estado,
                    
                    asig.fecha_asignacion as fecha_asignacion,
                    asig.comentario as asignacion_comentario,
                    asig.fecha_estado as fecha_estado,
                    
                    -- Información del vendedor desde asignaciones
                    asig.id_vendedor as vendedor_id,
                    vendedor.first_name as vendedor_nombre,
                    vendedor.last_name as vendedor_apellido,
                    vendedor.email as vendedor_email,
                    vendedor.phone_number as vendedor_telefono,
                    
                    -- Información del supervisor
                    supervisor.id as supervisor_id,
                    supervisor.first_name as supervisor_nombre,
                    supervisor.last_name as supervisor_apellido,
                    supervisor.email as supervisor_email
                    
                FROM prospectos p
                
                -- JOIN con la asignación más reciente (fuente de verdad para el estado)
                LEFT JOIN (
                    SELECT 
                        id_prospecto,
                        id_vendedor,
                        estado,
                        fecha_asignacion,
                        comentario,
                        fecha_estado,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                
                -- JOIN con vendedor desde asignaciones
                LEFT JOIN users vendedor ON asig.id_vendedor = vendedor.id
                
                -- JOIN con supervisor
                LEFT JOIN users supervisor ON vendedor.supervisor_id = supervisor.id
                
                ORDER BY p.fecha_registro DESC
            `;
            const [prospectos] = await pool.query(query);

            // Obtener familiares para todos los prospectos
            const prospectoIds = prospectos.map(p => p.id);
            let familiares = [];
            
            if (prospectoIds.length > 0) {
                const placeholders = prospectoIds.map(() => '?').join(',');
                const [familiaresResult] = await pool.query(`
                    SELECT * FROM familiares WHERE prospecto_id IN (${placeholders})
                `, prospectoIds);
                familiares = familiaresResult;
            }

            // Asociar familiares a cada prospecto
            const prospectosConFamiliares = prospectos.map(p => ({
                ...p,
                familiares: familiares.filter(f => f.prospecto_id === p.id)
            }));

            return prospectosConFamiliares;
        } catch (error) {
            console.error('❌ Error en Admin.getAllProspectos:', error);
            throw error;
        }
    }

    static async getProspectosEstadisticas() {
        try {
            // Total de prospectos del sistema
            const [totalProspectosResult] = await pool.query(`
                SELECT COUNT(*) as total FROM prospectos
            `);
            const totalProspectos = totalProspectosResult[0].total;

            // Prospectos sin asignar (usando asignación más reciente)
            const [sinAsignarResult] = await pool.query(`
                SELECT COUNT(*) as total 
                FROM prospectos p
                LEFT JOIN (
                    SELECT 
                        id_prospecto,
                        id_vendedor,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                WHERE asig.id_vendedor IS NULL
            `);
            const prospectosSinAsignar = sinAsignarResult[0].total;

            // Total de vendedores activos
            const [vendedoresActivosResult] = await pool.query(`
                SELECT COUNT(*) as total 
                FROM users 
                WHERE role = 1 AND is_enabled = 1
            `);
            const totalVendedores = vendedoresActivosResult[0].total;

            // Total de supervisores activos
            const [supervisoresActivosResult] = await pool.query(`
                SELECT COUNT(*) as total 
                FROM users 
                WHERE role = 2 AND is_enabled = 1
            `);
            const totalSupervisores = supervisoresActivosResult[0].total;

            // Ventas confirmadas del sistema (usando asignación más reciente)
            const [ventasConfirmadasResult] = await pool.query(`
                SELECT COUNT(*) as total 
                FROM prospectos p
                INNER JOIN (
                    SELECT 
                        id_prospecto,
                        estado,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                WHERE asig.estado = 'Venta'
            `);
            const ventasConfirmadas = ventasConfirmadasResult[0].total;

            // Total de pólizas generadas
            const [totalPolizasResult] = await pool.query(`
                SELECT COUNT(*) as total 
                FROM polizas
                WHERE deleted_at IS NULL
            `);
            const totalPolizas = totalPolizasResult[0].total;

            // Total facturado real basado en cotizaciones
            const [totalFacturadoResult] = await pool.query(`
                SELECT COALESCE(SUM(c.total_final), 0) as total_facturado
                FROM polizas p
                LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
                WHERE p.deleted_at IS NULL
            `);
            const totalFacturado = parseFloat(totalFacturadoResult[0].total_facturado);

            // Distribución por estados (usando asignación más reciente)
            const [estadosResult] = await pool.query(`
                SELECT 
                    COALESCE(asig.estado, 'Sin asignar') as estado,
                    COUNT(*) as cantidad
                FROM prospectos p
                LEFT JOIN (
                    SELECT 
                        id_prospecto,
                        estado,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                GROUP BY COALESCE(asig.estado, 'Sin asignar')
                ORDER BY cantidad DESC
            `);

            return {
                totalProspectos,
                prospectosSinAsignar,
                totalVendedores,
                totalSupervisores,
                ventasConfirmadas,
                totalFacturado,
                totalPolizas,
                distribucionEstados: estadosResult
            };
        } catch (error) {
            console.error('❌ Error en Admin.getProspectosEstadisticas:', error);
            throw error;
        }
    }

    static async reasignarProspecto(prospectoId, nuevoVendedorId, adminId) {
        try {
            // Verificar que el prospecto existe
            const [prospecto] = await pool.query(
                'SELECT * FROM prospectos WHERE id = ?',
                [prospectoId]
            );

            if (prospecto.length === 0) {
                throw new Error('Prospecto no encontrado');
            }

            // Verificar que el vendedor existe y está activo
            const [vendedor] = await pool.query(
                'SELECT * FROM users WHERE id = ? AND role = 1 AND is_enabled = 1',
                [nuevoVendedorId]
            );

            if (vendedor.length === 0) {
                throw new Error('Vendedor no encontrado o inactivo');
            }

            // ✅ BUSCAR SOLO LA ASIGNACIÓN MÁS RECIENTE (activa)
            const [asignacionExistente] = await pool.query(
                'SELECT id, id_vendedor FROM asignaciones WHERE id_prospecto = ? ORDER BY fecha_asignacion DESC LIMIT 1',
                [prospectoId]
            );

            let vendedorAnterior = null;

            if (asignacionExistente.length > 0) {
                vendedorAnterior = asignacionExistente[0].id_vendedor;
                
                // ✅ ACTUALIZAR SOLO LA ASIGNACIÓN MÁS RECIENTE (NO TODAS)
                // visible_refrito = 1 y estado = 'Lead': si el prospecto es un refrito
                // (es_reciclado=1), garantiza que la reasignación lo haga visible de inmediato
                // en el dashboard del nuevo vendedor (ver filtro en prospectoModel.js findAll).
                await pool.query(
                    `UPDATE asignaciones
                     SET id_vendedor = ?, fecha_asignacion = NOW(), estado = 'Lead', visible_refrito = 1,
                         comentario = CONCAT(COALESCE(comentario, ''), '\nReasignado por admin el ', NOW())
                     WHERE id = ?`,
                    [nuevoVendedorId, asignacionExistente[0].id]
                );

                console.log(`✅ Admin reasignó prospecto ${prospectoId} de vendedor ${vendedorAnterior} a ${nuevoVendedorId}`);
            } else {
                // Crear nueva asignación si no existe
                await pool.query(
                    `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_asignacion, visible_refrito)
                     VALUES (?, ?, 'Lead', 'Asignado por admin', NOW(), 1)`,
                    [prospectoId, nuevoVendedorId]
                );
                
                console.log(`✅ Admin creó nueva asignación para prospecto ${prospectoId} al vendedor ${nuevoVendedorId}`);
            }

            // Registrar en historial
            try {
                await pool.query(
                    `INSERT INTO historial_acciones 
                     (id_prospecto, id_vendedor, accion, descripcion, fecha) 
                     VALUES (?, ?, 'REASIGNACION', ?, NOW())`,
                    [
                        prospectoId, 
                        adminId,
                        `Prospecto reasignado ${vendedorAnterior ? `de vendedor ${vendedorAnterior}` : ''} al vendedor: ${vendedor[0].first_name} ${vendedor[0].last_name}`
                    ]
                );
            } catch (historialError) {
                console.log('⚠️ No se pudo registrar en historial:', historialError.message);
            }

            return {
                prospecto_id: prospectoId,
                vendedor_anterior: vendedorAnterior,
                vendedor_nuevo: nuevoVendedorId,
                vendedor_nombre: `${vendedor[0].first_name} ${vendedor[0].last_name}`,
                mensaje: 'Prospecto reasignado correctamente'
            };

        } catch (error) {
            console.error('❌ Error en Admin.reasignarProspecto:', error);
            throw error;
        }
    }

    static async cambiarEstadoProspecto(prospectoId, nuevoEstado, notas, adminId) {
        try {
            // Verificar que el prospecto existe
            const [prospecto] = await pool.query(
                'SELECT * FROM prospectos WHERE id = ?',
                [prospectoId]
            );

            if (prospecto.length === 0) {
                throw new Error('Prospecto no encontrado');
            }

            // Verificar que existe una asignación (obtener la más reciente)
            const [asignacion] = await pool.query(
                'SELECT * FROM asignaciones WHERE id_prospecto = ? ORDER BY fecha_asignacion DESC LIMIT 1',
                [prospectoId]
            );

            if (asignacion.length === 0) {
                throw new Error('No existe una asignación para este prospecto');
            }

            // Actualizar solo la asignación más reciente
            await pool.query(
                `UPDATE asignaciones 
                 SET estado = ?, comentario = ?, fecha_estado = NOW() 
                 WHERE id = ?`,
                [nuevoEstado, notas || 'Estado actualizado por admin', asignacion[0].id]
            );

            // 🔄 Hook: Promover siguiente refrito si aplica
            try {
                await RefritosVisibilityService.onCambioEstadoProspecto(prospectoId, nuevoEstado, asignacion[0].id_vendedor);
            } catch (refritoError) {
                console.log('⚠️ Error al promover refrito:', refritoError.message);
            }

            // Registrar en historial
            try {
                await pool.query(
                    `INSERT INTO historial_acciones 
                     (id_prospecto, id_vendedor, accion, descripcion, fecha) 
                     VALUES (?, ?, 'CAMBIO_ESTADO', ?, NOW())`,
                    [
                        prospectoId, 
                        adminId,
                        `Estado cambiado de '${prospectoActual[0].estado}' a '${nuevoEstado}'${notas ? `. Notas: ${notas}` : ''}`
                    ]
                );
            } catch (historialError) {
                console.log('⚠️ No se pudo registrar en historial:', historialError.message);
            }

            return {
                prospecto_id: prospectoId,
                estado_anterior: asignacion[0].estado,
                estado_nuevo: nuevoEstado,
                mensaje: `Estado actualizado a: ${nuevoEstado}`
            };

        } catch (error) {
            console.error('❌ Error en Admin.cambiarEstadoProspecto:', error);
            throw error;
        }
    }

    static async getProspectoHistorial(prospectoId) {
        try {
            const query = `
                SELECT 
                    ha.id,
                    ha.id_prospecto as prospecto_id,
                    ha.id_vendedor as usuario_id,
                    ha.accion,
                    ha.descripcion,
                    ha.fecha,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM historial_acciones ha
                LEFT JOIN users u ON ha.id_vendedor = u.id
                WHERE ha.id_prospecto = ?
                ORDER BY ha.fecha DESC
            `;
            
            const [historial] = await pool.query(query, [prospectoId]);
            
            return historial.map(h => ({
                ...h,
                usuario: h.first_name && h.last_name 
                    ? `${h.first_name} ${h.last_name}` 
                    : 'Sistema'
            }));
        } catch (error) {
            console.error('❌ Error en Admin.getProspectoHistorial:', error);
            // Retornar array vacío si hay error
            return [];
        }
    }

    static async getProspectoCotizaciones(prospectoId) {
        try {
            const query = `
                SELECT 
                    c.*,
                    p.nombre as plan_nombre,
                    p.descripcion as plan_descripcion,
                    pr.nombre as prospecto_nombre,
                    pr.apellido as prospecto_apellido,
                    pr.categoria_monotributo as prospecto_categoria_monotributo,
                    cm.letra as categoria_monotributo_letra,
                    cm.aporte_presuntivo as categoria_monotributo_aporte
                FROM cotizaciones c
                LEFT JOIN planes p ON c.plan_id = p.id
                LEFT JOIN prospectos pr ON c.prospecto_id = pr.id
                LEFT JOIN categorias_monotributo cm ON pr.categoria_monotributo = cm.letra
                WHERE c.prospecto_id = ?
                ORDER BY c.fecha DESC
            `;
            
            const [cotizaciones] = await pool.query(query, [prospectoId]);
            
            // Obtener detalles para cada cotización
            for (let cotizacion of cotizaciones) {
                const detallesQuery = `
                    SELECT 
                        cd.*,
                        ta.nombre as tipo_afiliacion,
                        ta.etiqueta as tipo_afiliacion_etiqueta
                    FROM cotizaciones_detalles cd
                    LEFT JOIN tipos_afiliacion ta ON cd.tipo_afiliacion_id = ta.id
                    WHERE cd.cotizacion_id = ?
                    ORDER BY cd.id
                `;
                
                const [detalles] = await pool.query(detallesQuery, [cotizacion.id]);
                
                // Agregar información de categoría de monotributo a cada detalle si es monotributista
                for (let detalle of detalles) {
                    if (detalle.tipo_afiliacion === 'Monotributista' && cotizacion.prospecto_categoria_monotributo) {
                        detalle.categoria_monotributo = cotizacion.prospecto_categoria_monotributo;
                        detalle.categoria_monotributo_aporte = cotizacion.categoria_monotributo_aporte;
                        detalle.tipo_afiliacion_completo = `${detalle.tipo_afiliacion} - Categoría ${cotizacion.prospecto_categoria_monotributo}`;
                    }
                }
                
                cotizacion.detalles = detalles;
            }
            
            return cotizaciones;
        } catch (error) {
            console.error('❌ Error en Admin.getProspectoCotizaciones:', error);
            throw error;
        }
    }

    // ✅ NUEVO MÉTODO: Obtener conversaciones de WhatsApp por teléfono
    static async getConversacionesPorTelefono(telefono) {
        try {
            const query = `
                SELECT 
                    ccw.id,
                    ccw.numero_conversacion,
                    ccw.telefono,
                    ccw.prospecto_id,
                    ccw.poliza_id,
                    ccw.vendedor_id,
                    ccw.estado,
                    ccw.tipo_origen,
                    ccw.twilio_conversation_sid,
                    ccw.ultima_actividad,
                    ccw.created_at,
                    ccw.updated_at,
                    -- Información del vendedor
                    v.first_name as vendedor_nombre,
                    v.last_name as vendedor_apellido,
                    v.email as vendedor_email,
                    -- Información del prospecto (si existe)
                    p.nombre as prospecto_nombre,
                    p.apellido as prospecto_apellido,
                    p.correo as prospecto_email,
                    p.numero_contacto as prospecto_telefono,
                    -- Información de la póliza (si existe)
                    pol.numero_poliza,
                    pol.estado as poliza_estado,
                    -- Contar mensajes
                    COUNT(cm.id) as total_mensajes,
                    -- Último mensaje
                    (SELECT mensaje 
                     FROM chat_mensajes 
                     WHERE conversacion_id = ccw.id 
                     ORDER BY created_at DESC 
                     LIMIT 1) as ultimo_mensaje,
                    (SELECT created_at 
                     FROM chat_mensajes 
                     WHERE conversacion_id = ccw.id 
                     ORDER BY created_at DESC 
                     LIMIT 1) as fecha_ultimo_mensaje
                FROM chat_conversaciones_whatsapp ccw
                LEFT JOIN users v ON ccw.vendedor_id = v.id
                LEFT JOIN prospectos p ON ccw.prospecto_id = p.id
                LEFT JOIN polizas pol ON ccw.poliza_id = pol.id
                LEFT JOIN chat_mensajes cm ON ccw.id = cm.conversacion_id
                WHERE ccw.telefono = ?
                GROUP BY ccw.id
                ORDER BY ccw.ultima_actividad DESC
            `;
            
            const [conversaciones] = await pool.query(query, [telefono]);
            return conversaciones;
        } catch (error) {
            console.error('❌ Error en Admin.getConversacionesPorTelefono:', error);
            throw error;
        }
    }

    // ✅ NUEVO MÉTODO: Obtener mensajes de una conversación específica
    static async getMensajesConversacion(conversacionId) {
        try {
            const query = `
                SELECT 
                    cm.id,
                    cm.conversacion_id,
                    cm.mensaje as contenido,
                    cm.tipo,
                    cm.origen,
                    cm.twilio_message_sid,
                    cm.estado_entrega as estado,
                    cm.metadata,
                    cm.created_at as fecha_envio,
                    cm.archivo_url,
                    cm.archivo_tipo,
                    cm.archivo_nombre,
                    cm.archivo_tamaño,
                    -- Información de la conversación
                    ccw.numero_conversacion,
                    ccw.telefono,
                    ccw.estado as conversacion_estado,
                    -- Información del vendedor
                    v.first_name as vendedor_nombre,
                    v.last_name as vendedor_apellido
                FROM chat_mensajes cm
                INNER JOIN chat_conversaciones_whatsapp ccw ON cm.conversacion_id = ccw.id
                LEFT JOIN users v ON ccw.vendedor_id = v.id
                WHERE cm.conversacion_id = ?
                ORDER BY cm.created_at ASC
            `;
            
            const [mensajes] = await pool.query(query, [conversacionId]);
            
            // Parsear metadata si existe
            for (let mensaje of mensajes) {
                if (mensaje.metadata) {
                    try {
                        mensaje.metadata = JSON.parse(mensaje.metadata);
                    } catch (e) {
                        console.warn('⚠️ No se pudo parsear metadata del mensaje:', mensaje.id);
                    }
                }
            }
            
            return mensajes;
        } catch (error) {
            console.error('❌ Error en Admin.getMensajesConversacion:', error);
            throw error;
        }
    }

    static async updateVerificationToken(userId, token, expires) {
        const [result] = await pool.query(
            'UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?',
            [token, expires, userId]
        );
        return result;
    }
}

module.exports = Admin;