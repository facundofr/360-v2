const Admin = require('../../models/admin/adminModel');
const bcrypt = require('bcrypt');
const validator = require('validator');
const crypto = require('crypto');
const moment = require('moment');
const emailService = require('../../services/emailService'); // ✅ Import correcto

// Listar usuarios
const listUsersByRoles = async (req, res) => {
    try {
        const users = await Admin.listUsersByRoles();
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error al listar usuarios:", error);
        return res.status(500).json({ message: "Error al obtener los usuarios." });
    }
};

// Crear un usuario
const createUser = async (req, res) => {
    try {
        const { first_name, last_name, email, phone_number, password, role } = req.body;

        console.log('📝 Creando nuevo usuario:', { first_name, last_name, email, role });

        // Validar campos requeridos
        if (!first_name || !last_name || !email || !phone_number || !password || !role) {
            return res.status(400).json({ 
                message: "Todos los campos son obligatorios.",
                errores: ["Faltan campos requeridos: nombre, apellido, email, teléfono, contraseña y rol."]
            });
        }

        // Validar nombre y apellido
        if (typeof first_name !== 'string' || first_name.length < 2 || first_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(first_name)) {
            return res.status(400).json({ message: "El nombre debe tener entre 2 y 50 caracteres y solo letras." });
        }
        if (typeof last_name !== 'string' || last_name.length < 2 || last_name.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(last_name)) {
            return res.status(400).json({ message: "El apellido debe tener entre 2 y 50 caracteres y solo letras." });
        }

        // Validar formato del correo
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: "El correo electrónico no es válido." });
        }

        // Validar teléfono
        if (typeof phone_number !== 'string' || !/^[\d\s\(\)\+\-]{8,20}$/.test(phone_number)) {
            return res.status(400).json({ message: "El formato del número de teléfono es inválido. Debe contener entre 8 y 20 caracteres numéricos." });
        }

        // Validar contraseña
        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres." });
        }

        // Validar rol
        if (!Number.isInteger(Number(role)) || Number(role) < 1 || Number(role) > 4) {
            return res.status(400).json({ message: "El rol seleccionado no es válido." });
        }

        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ AGREGAR: Generar token de verificación
        const verification_token = crypto.randomBytes(32).toString('hex');
        const verification_expires = moment().add(24, 'hours').format('YYYY-MM-DD HH:mm:ss');

        // ✅ MEJORAR: Crear el usuario con token de verificación
        const result = await Admin.createUser({
            first_name,
            last_name,
            email,
            phone_number,
            password: hashedPassword,
            role,
            verification_token,
            verification_expires,
            created_by: req.user ? req.user.id : null // ID del admin que crea el usuario
        });

        const userId = result.insertId;
        console.log(`✅ Usuario creado con ID: ${userId}`);

        // ✅ AGREGAR: Enviar email de verificación/bienvenida
        try {
            await emailService.enviarEmailBienvenida({
                to: email,
                user: {
                    first_name,
                    last_name,
                    email,
                    role: getRoleLabel(role)
                },
                verification_token,
                isCreatedByAdmin: true
            });
            console.log(`📧 Email de bienvenida enviado a: ${email}`);
        } catch (emailError) {
            console.error("❌ Error enviando email de bienvenida:", emailError);
            // No fallar la operación por un error de email, pero notificar
        }

        return res.status(201).json({ 
            message: "Usuario creado exitosamente. Se ha enviado un email de verificación.",
            userId: userId,
            user: {
                id: userId,
                name: `${first_name} ${last_name}`,
                email: email,
                role: getRoleLabel(role)
            }
        });

    } catch (error) {
        console.error("❌ Error al crear usuario:", error);

        // Manejar errores de validación del modelo
        if (error.errores) {
            return res.status(400).json({ 
                message: "Error de validación", 
                errores: error.errores 
            });
        }

        // Manejar errores de duplicados
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.message.includes('email') || error.sqlMessage.includes('email')) {
                return res.status(400).json({ message: "El correo electrónico ya está registrado." });
            }
            if (error.message.includes('phone') || error.sqlMessage.includes('phone')) {
                return res.status(400).json({ message: "El número de teléfono ya está registrado." });
            }
            return res.status(400).json({ message: "Ya existe un usuario con esos datos." });
        }

        return res.status(500).json({ 
            message: "Error interno del servidor al crear el usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ AGREGAR: Función helper para obtener label del rol
const getRoleLabel = (roleValue) => {
    const roles = {
        1: "Vendedor",
        2: "Supervisor", 
        3: "Administrador",
        4: "Back Office"
    };
    return roles[roleValue] || "Desconocido";
};

// Actualizar un usuario
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone_number, role } = req.body;

        console.log(`📝 Intentando actualizar usuario ID: ${id}`);
        console.log('📄 Datos recibidos:', { first_name, last_name, email, phone_number, role });

        // Validar que se recibieron todos los campos requeridos
        if (!first_name || !last_name || !email || !phone_number || !role) {
            return res.status(400).json({ 
                message: "Todos los campos son obligatorios.",
                errores: ["Faltan campos requeridos en la solicitud."]
            });
        }

        // Llamar al método del modelo (que incluye todas las validaciones)
        const { emailChanged } = await Admin.updateUser(id, { first_name, last_name, email, phone_number, role });
        
        console.log(`✅ Usuario ID: ${id} actualizado exitosamente${emailChanged ? ' (email cambiado, verificación reseteada)' : ''}`);
        return res.status(200).json({ 
            message: "Usuario actualizado con éxito.",
            emailChanged: !!emailChanged
        });

    } catch (error) {
        console.error("❌ Error al actualizar usuario:", error);

        // Manejar errores de validación personalizados
        if (error.errores) {
            return res.status(400).json({ 
                message: "Error de validación", 
                errores: error.errores 
            });
        }

        // Manejar errores de duplicados
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.message.includes('email')) {
                return res.status(400).json({ message: "El correo electrónico ya está registrado." });
            }
            if (error.message.includes('phone')) {
                return res.status(400).json({ message: "El número de teléfono ya está registrado." });
            }
            return res.status(400).json({ message: "Ya existe un usuario con esos datos." });
        }

        // Manejar errores específicos del modelo
        if (error.message === "Usuario no encontrado.") {
            return res.status(404).json({ message: error.message });
        }

        if (error.message.includes("correo electrónico ya está registrado") || 
            error.message.includes("teléfono ya está registrado")) {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ 
            message: "Error interno del servidor al actualizar el usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Eliminar un usuario
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Intentando eliminar usuario ID: ${id}`);

        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            return res.status(400).json({ message: "ID de usuario inválido." });
        }

        // Verificar si el usuario existe
        const user = await Admin.findById(id);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        // Verificar si es el mismo usuario que está intentando eliminarse
        if (req.user && req.user.id === parseInt(id)) {
            return res.status(400).json({ message: "No puedes eliminar tu propia cuenta." });
        }

        // Intentar eliminar el usuario
        await Admin.deleteUser(id);
        
        console.log(`✅ Usuario ID: ${id} eliminado exitosamente`);
        return res.status(200).json({ 
            message: "Usuario eliminado con éxito.",
            deletedUser: {
                id: user.id,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email
            }
        });

    } catch (error) {
        console.error("❌ Error al eliminar usuario:", error);

        // Manejar errores específicos del modelo
        if (error.message === "Usuario no encontrado.") {
            return res.status(404).json({ message: error.message });
        }

        if (error.message === "No se puede eliminar un usuario administrador.") {
            return res.status(403).json({ message: error.message });
        }

        if (error.message.includes("tiene") && error.message.includes("asociadas")) {
            return res.status(400).json({ 
                message: error.message,
                suggestion: "Considere deshabilitar la cuenta en lugar de eliminarla."
            });
        }

        return res.status(500).json({ 
            message: "Error interno del servidor al eliminar el usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Deshabilitar usuario (alternativa más segura)
const disableUser = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🚫 Intentando deshabilitar usuario ID: ${id}`);

        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            return res.status(400).json({ message: "ID de usuario inválido." });
        }

        // Verificar si es el mismo usuario
        if (req.user && req.user.id === parseInt(id)) {
            return res.status(400).json({ message: "No puedes deshabilitar tu propia cuenta." });
        }

        // Deshabilitar el usuario
        await Admin.disableUser(id);
        
        console.log(`✅ Usuario ID: ${id} deshabilitado exitosamente`);
        return res.status(200).json({ message: "Usuario deshabilitado con éxito." });

    } catch (error) {
        console.error("❌ Error al deshabilitar usuario:", error);

        if (error.message === "Usuario no encontrado.") {
            return res.status(404).json({ message: error.message });
        }

        if (error.message === "No se puede deshabilitar un usuario administrador.") {
            return res.status(403).json({ message: error.message });
        }

        return res.status(500).json({ 
            message: "Error interno del servidor al deshabilitar el usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ AGREGAR: Habilitar usuario
const enableUser = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`✅ Intentando habilitar usuario ID: ${id}`);

        // Validar ID
        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            return res.status(400).json({ message: "ID de usuario inválido." });
        }

        // Verificar si es el mismo usuario
        if (req.user && req.user.id === parseInt(id)) {
            return res.status(400).json({ message: "No necesitas habilitar tu propia cuenta." });
        }

        // Habilitar al usuario
        await Admin.enableUser(id);

        // Buscar al usuario para enviar el correo
        const user = await Admin.findById(id);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado después de habilitar." });
        }

        // Enviar correo de confirmación (opcional)
        try {
            await emailService.sendConfirmationEmail(user.email, {
                subject: 'Cuenta Habilitada - COBER 360',
                message: `Hola ${user.first_name}, tu cuenta ha sido habilitada exitosamente.`
            });
            console.log(`📧 Email de confirmación enviado a: ${user.email}`);
        } catch (emailError) {
            console.error("❌ Error enviando email de confirmación:", emailError);
            // No fallar la operación por un error de email
        }

        console.log(`✅ Usuario ID: ${id} habilitado exitosamente`);
        return res.status(200).json({ 
            message: "Usuario habilitado con éxito.",
            user: {
                id: user.id,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email
            }
        });

    } catch (error) {
        console.error("❌ Error al habilitar usuario:", error);

        // Manejar errores específicos del modelo
        if (error.message === "Usuario no encontrado.") {
            return res.status(404).json({ message: error.message });
        }

        if (error.message === "El usuario ya está habilitado.") {
            return res.status(400).json({ message: error.message });
        }

        if (error.message === "No se puede habilitar un usuario administrador.") {
            return res.status(403).json({ message: error.message });
        }

        return res.status(500).json({ 
            message: "Error interno del servidor al habilitar el usuario.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Obtener lista de vendedores
const getVendedores = async (req, res) => {
    try {
        const vendedores = await Admin.getVendedores();
        res.json({
            success: true,
            data: vendedores,
            message: 'Vendedores obtenidos exitosamente'
        });
    } catch (error) {
        console.error('❌ Error obteniendo vendedores:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Obtener lista de supervisores
const getSupervisores = async (req, res) => {
    try {
        const supervisores = await Admin.getSupervisores();
        res.json({
            success: true,
            data: supervisores,
            message: 'Supervisores obtenidos exitosamente'
        });
    } catch (error) {
        console.error('❌ Error obteniendo supervisores:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NUEVO: Obtener usuarios activos en tiempo real
const getActiveUsers = async (req, res) => {
    try {
        // Obtener parámetros opcionales
        const { 
            timeframe = 5, // minutos para considerar "activo"
            include_details = 'true' 
        } = req.query;

        console.log(`🔍 Obteniendo usuarios activos (últimos ${timeframe} minutos)`);

        const activeUsers = await Admin.getActiveUsers(parseInt(timeframe));
        
        const response = {
            success: true,
            data: {
                active_users: activeUsers,
                total_active: activeUsers.length,
                timeframe_minutes: parseInt(timeframe),
                last_updated: new Date().toISOString(),
                criteria: `Usuarios con actividad en los últimos ${timeframe} minutos`
            },
            message: `${activeUsers.length} usuarios activos encontrados`
        };

        // Si no se requieren detalles, enviar solo el conteo
        if (include_details === 'false') {
            response.data = {
                total_active: activeUsers.length,
                timeframe_minutes: parseInt(timeframe),
                last_updated: new Date().toISOString()
            };
        }

        res.json(response);
    } catch (error) {
        console.error('❌ Error obteniendo usuarios activos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener usuarios activos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NUEVO: Obtener estadísticas de actividad de usuarios
const getUserActivityStats = async (req, res) => {
    try {
        console.log('📊 Obteniendo estadísticas de actividad de usuarios');

        const stats = await Admin.getUserActivityStats();
        
        res.json({
            success: true,
            data: stats,
            message: 'Estadísticas de actividad obtenidas exitosamente'
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de actividad:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener estadísticas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NUEVO: Actualizar actividad del usuario (heartbeat)
const updateUserActivity = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, action } = req.body;

        console.log(`💓 Heartbeat del usuario ${userId}:`, { page, action });

        // Actualizar last_activity en la base de datos
        await Admin.updateUserActivity(userId, { page, action });
        
        res.json({
            success: true,
            message: 'Actividad actualizada correctamente',
            data: {
                user_id: userId,
                timestamp: new Date().toISOString(),
                page,
                action
            }
        });
    } catch (error) {
        console.error('❌ Error actualizando actividad del usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al actualizar actividad',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NUEVO: Marcar usuario como inactivo al hacer logout
const logoutUserActivity = async (req, res) => {
    try {
        const userId = req.user.id;
        const { action } = req.body;

        console.log(`🚪 Logout del usuario ${userId}:`, { action });

        // Marcar como inactivo estableciendo last_activity a una fecha pasada
        await Admin.markUserInactive(userId);
        
        res.json({
            success: true,
            message: 'Usuario marcado como inactivo correctamente',
            data: {
                user_id: userId,
                timestamp: new Date().toISOString(),
                action: action || 'logout'
            }
        });
    } catch (error) {
        console.error('❌ Error marcando usuario como inactivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al marcar como inactivo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NUEVOS: Métodos para gestión de prospectos por admin
const getAllProspectos = async (req, res) => {
    try {
        console.log('📋 Admin obteniendo todos los prospectos del sistema');
        
        const prospectos = await Admin.getAllProspectos();
        res.status(200).json(prospectos);
    } catch (error) {
        console.error("❌ Error al listar todos los prospectos:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener los prospectos." 
        });
    }
};

const getProspectosEstadisticas = async (req, res) => {
    try {
        console.log('📊 Admin obteniendo estadísticas generales de prospectos');
        
        const estadisticas = await Admin.getProspectosEstadisticas();
        res.status(200).json({
            success: true,
            data: estadisticas
        });
    } catch (error) {
        console.error("❌ Error al obtener estadísticas de prospectos:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener las estadísticas de prospectos." 
        });
    }
};

const reasignarProspecto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevo_vendedor_id } = req.body;
        const adminId = req.user.id;

        console.log('🔄 Admin reasignando prospecto:', { 
            prospecto_id: id,
            nuevo_vendedor_id,
            admin_id: adminId
        });

        if (!nuevo_vendedor_id) {
            return res.status(400).json({
                success: false,
                message: 'El nuevo vendedor es requerido'
            });
        }

        const resultado = await Admin.reasignarProspecto(id, nuevo_vendedor_id, adminId);
        
        res.json({
            success: true,
            message: 'Prospecto reasignado correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error reasignando prospecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al reasignar el prospecto',
            error: error.message
        });
    }
};

const cambiarEstadoProspecto = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, notas } = req.body;
        const adminId = req.user.id;

        console.log('🔄 Admin cambiando estado de prospecto:', { 
            prospecto_id: id,
            estado_nuevo: estado, 
            notas,
            admin_id: adminId
        });

        // Validar estados permitidos
        const estadosValidos = [
            'Lead', '1º Contacto', 'WhatsApp enviado', 'Llamada telefónica', 'Conversación iniciada por WhatsApp',
            'Promoción aplicada', 'Calificado Cotización', 'Calificado Póliza',
            'Calificado Pago', 'Póliza iniciada', 'Póliza generada', 'Póliza enviada a supervisor',
            'Póliza pendiente a firma', 'Póliza firmada', 'Venta', 'Fuera de zona', 'Fuera de edad',
            'Preexistencia', 'Reafiliación', 'No contesta', 'prueba interna',
            'Ya es socio', 'Busca otra Cobertura', 'Teléfono erróneo',
            'No le interesa (económico)', 'No le interesa cartilla', 'No busca cobertura médica'
        ];

        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Estado no válido',
                estado_recibido: estado,
                estados_validos: estadosValidos
            });
        }

        const resultado = await Admin.cambiarEstadoProspecto(id, estado, notas, adminId);
        
        res.json({
            success: true,
            message: 'Estado del prospecto actualizado correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error cambiando estado del prospecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar el estado del prospecto',
            error: error.message
        });
    }
};

const getProspectoHistorial = async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('📜 Admin obteniendo historial del prospecto:', id);
        
        const historial = await Admin.getProspectoHistorial(id);
        res.status(200).json(historial);
    } catch (error) {
        console.error("❌ Error al obtener historial del prospecto:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener el historial del prospecto." 
        });
    }
};

const getProspectoCotizaciones = async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('💰 Admin obteniendo cotizaciones del prospecto:', id);
        
        const cotizaciones = await Admin.getProspectoCotizaciones(id);
        res.status(200).json(cotizaciones);
    } catch (error) {
        console.error("❌ Error al obtener cotizaciones del prospecto:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener las cotizaciones del prospecto." 
        });
    }
};

// ✅ NUEVA FUNCIÓN: Obtener conversaciones de WhatsApp por teléfono
const getConversacionesPorTelefono = async (req, res) => {
    try {
        const { telefono } = req.params;
        
        if (!telefono) {
            return res.status(400).json({ 
                success: false,
                message: "El teléfono es requerido" 
            });
        }

        console.log(`📞 Admin consultando conversaciones para teléfono: ${telefono}`);
        
        const conversaciones = await Admin.getConversacionesPorTelefono(telefono);
        
        res.status(200).json({
            success: true,
            data: conversaciones,
            total: conversaciones.length
        });
    } catch (error) {
        console.error("❌ Error al obtener conversaciones de WhatsApp:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener las conversaciones de WhatsApp." 
        });
    }
};

// ✅ NUEVA FUNCIÓN: Obtener mensajes de una conversación específica
const getMensajesConversacion = async (req, res) => {
    try {
        const { conversacionId } = req.params;
        
        if (!conversacionId) {
            return res.status(400).json({ 
                success: false,
                message: "El ID de conversación es requerido" 
            });
        }

        console.log(`💬 Admin consultando mensajes de conversación: ${conversacionId}`);
        
        const mensajes = await Admin.getMensajesConversacion(conversacionId);
        
        res.status(200).json({
            success: true,
            data: mensajes,
            total: mensajes.length
        });
    } catch (error) {
        console.error("❌ Error al obtener mensajes de la conversación:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener los mensajes de la conversación." 
        });
    }
};

// Reenviar email de verificación a un usuario
const resendVerification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !validator.isInt(id.toString(), { min: 1 })) {
            return res.status(400).json({ message: "ID de usuario inválido." });
        }

        const user = await Admin.findById(id);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        if (user.verified) {
            return res.status(400).json({ message: "El usuario ya verificó su cuenta." });
        }

        // Generar nuevo token de verificación
        const verification_token = crypto.randomBytes(32).toString('hex');
        const verification_expires = moment().add(24, 'hours').format('YYYY-MM-DD HH:mm:ss');

        await Admin.updateVerificationToken(id, verification_token, verification_expires);

        await emailService.enviarEmailBienvenida({
            to: user.email,
            user: {
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: getRoleLabel(user.role)
            },
            verification_token,
            isCreatedByAdmin: true
        });

        console.log(`📧 Email de verificación reenviado al usuario ID: ${id} (${user.email})`);
        return res.status(200).json({ message: "Email de verificación reenviado correctamente." });

    } catch (error) {
        console.error("❌ Error al reenviar verificación:", error);
        return res.status(500).json({ message: "Error interno al reenviar el email de verificación." });
    }
};

module.exports = {
    listUsersByRoles,
    createUser,
    updateUser,
    deleteUser,
    disableUser,
    enableUser,
    resendVerification,
    getVendedores,
    getSupervisores,
    getActiveUsers,
    getUserActivityStats,
    updateUserActivity,
    logoutUserActivity,
    // ✅ Nuevos métodos de prospectos
    getAllProspectos,
    getProspectosEstadisticas,
    reasignarProspecto,
    cambiarEstadoProspecto,
    getProspectoHistorial,
    getProspectoCotizaciones,
    // ✅ Nuevos métodos de WhatsApp
    getConversacionesPorTelefono,
    getMensajesConversacion
};