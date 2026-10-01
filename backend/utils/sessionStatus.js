const db = require('../config/db');

/**
 * Utilidad para verificar el estado de sesión de usuarios
 */
const SessionStatusUtil = {
    /**
     * Verificar si un usuario específico está activo
     * @param {number} userId - ID del usuario
     * @returns {Promise<Object>} Estado de la sesión del usuario
     */
    async checkUserSession(userId) {
        try {
            const query = `
                SELECT 
                    us.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.role,
                    CASE 
                        WHEN us.logout_time IS NULL THEN 'activo'
                        ELSE 'inactivo'
                    END as estado_sesion,
                    TIMESTAMPDIFF(MINUTE, us.login_time, COALESCE(us.logout_time, NOW())) as minutos_actividad,
                    TIMESTAMPDIFF(MINUTE, us.login_time, NOW()) as minutos_desde_login
                FROM user_sessions us
                INNER JOIN users u ON us.user_id = u.id
                WHERE us.user_id = ? 
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = ?
                    )
                LIMIT 1
            `;

            const [results] = await db.query(query, [userId, userId]);
            
            if (results.length === 0) {
                return {
                    user_id: userId,
                    activo: false,
                    estado_sesion: 'sin_sesion',
                    sesion_encontrada: false,
                    mensaje: 'Usuario sin sesiones registradas'
                };
            }

            const sesion = results[0];
            
            // Calcular si la sesión está realmente activa (últimos 60 minutos para sesiones sin logout)
            const TIMEOUT_MINUTOS = 60;
            const realmente_activo = sesion.estado_sesion === 'activo' && 
                                   sesion.minutos_desde_login <= (8 * 60); // Máximo 8 horas de sesión

            return {
                user_id: parseInt(userId),
                activo: realmente_activo,
                estado_sesion: sesion.estado_sesion,
                sesion_encontrada: true,
                datos_usuario: {
                    nombre: sesion.first_name,
                    apellido: sesion.last_name,
                    email: sesion.email,
                    rol: sesion.role
                },
                datos_sesion: {
                    id_sesion: sesion.id,
                    login_time: sesion.login_time,
                    logout_time: sesion.logout_time,
                    session_time: sesion.session_time
                },
                metricas: {
                    minutos_total_actividad: sesion.minutos_actividad,
                    horas_total_actividad: Math.round(sesion.minutos_actividad / 60 * 100) / 100,
                    minutos_desde_login: sesion.minutos_desde_login,
                    activo_recientemente: sesion.minutos_desde_login <= (8 * 60)
                },
                timestamps: {
                    login_formateado: this.formatearFecha(sesion.login_time),
                    logout_formateado: this.formatearFecha(sesion.logout_time)
                }
            };

        } catch (error) {
            console.error('Error al verificar estado de sesión:', error);
            throw new Error('Error al verificar estado de sesión del usuario');
        }
    },

    /**
     * Obtener estado de sesión de múltiples usuarios
     * @param {Array<number>} userIds - Array de IDs de usuarios
     * @returns {Promise<Array>} Array con el estado de cada usuario
     */
    async checkMultipleUserSessions(userIds) {
        try {
            const estadosSesion = await Promise.all(
                userIds.map(userId => this.checkUserSession(userId))
            );

            return estadosSesion;

        } catch (error) {
            console.error('Error al verificar múltiples sesiones:', error);
            throw new Error('Error al verificar estado de sesiones de usuarios');
        }
    },

    /**
     * Obtener todos los usuarios activos en este momento
     * @returns {Promise<Array>} Usuarios con sesiones activas
     */
    async getActiveUsers() {
        try {
            const query = `
                SELECT DISTINCT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.role,
                    us.login_time,
                    TIMESTAMPDIFF(MINUTE, us.login_time, NOW()) as minutos_desde_login
                FROM users u
                INNER JOIN user_sessions us ON u.id = us.user_id
                WHERE us.logout_time IS NULL
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = u.id
                    )
                    AND TIMESTAMPDIFF(MINUTE, us.login_time, NOW()) <= 480
                ORDER BY us.login_time DESC
            `;

            const [results] = await db.query(query);
            
            return results.map(user => ({
                ...user,
                activo: true,
                login_formateado: this.formatearFecha(user.login_time),
                horas_desde_login: Math.round(user.minutos_desde_login / 60 * 100) / 100
            }));

        } catch (error) {
            console.error('Error al obtener usuarios activos:', error);
            throw new Error('Error al obtener usuarios activos');
        }
    },

    /**
     * Obtener estadísticas generales de sesiones
     * @returns {Promise<Object>} Estadísticas de sesiones
     */
    async getSessionStats() {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT CASE WHEN us.logout_time IS NULL THEN u.id END) as usuarios_activos,
                    COUNT(DISTINCT u.id) as total_usuarios_con_sesiones,
                    COUNT(DISTINCT CASE WHEN u.role = 1 AND us.logout_time IS NULL THEN u.id END) as vendedores_activos,
                    COUNT(DISTINCT CASE WHEN u.role = 2 AND us.logout_time IS NULL THEN u.id END) as supervisores_activos,
                    COUNT(DISTINCT CASE WHEN u.role = 3 AND us.logout_time IS NULL THEN u.id END) as admins_activos,
                    AVG(TIMESTAMPDIFF(MINUTE, us.login_time, COALESCE(us.last_activity, NOW()))) as promedio_minutos_sesion,
                    MAX(us.login_time) as ultima_sesion_global
                FROM users u
                LEFT JOIN user_sessions us ON u.id = us.user_id 
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = u.id
                    )
                WHERE u.is_enabled = 1
            `;

            const [results] = await db.query(query);
            const stats = results[0];

            return {
                usuarios_activos: parseInt(stats.usuarios_activos) || 0,
                total_usuarios_con_sesiones: parseInt(stats.total_usuarios_con_sesiones) || 0,
                vendedores_activos: parseInt(stats.vendedores_activos) || 0,
                supervisores_activos: parseInt(stats.supervisores_activos) || 0,
                admins_activos: parseInt(stats.admins_activos) || 0,
                promedio_horas_sesion: stats.promedio_minutos_sesion ? 
                    Math.round(stats.promedio_minutos_sesion / 60 * 100) / 100 : 0,
                ultima_sesion_global: this.formatearFecha(stats.ultima_sesion_global),
                fecha_consulta: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error al obtener estadísticas de sesiones:', error);
            throw new Error('Error al obtener estadísticas de sesiones');
        }
    },

    /**
     * Verificar si un vendedor está disponible para asignaciones
     * @param {number} vendedorId - ID del vendedor
     * @returns {Promise<Object>} Estado de disponibilidad del vendedor
     */
    async checkVendedorDisponibilidad(vendedorId) {
        try {
            const estadoSesion = await this.checkUserSession(vendedorId);
            
            if (!estadoSesion.sesion_encontrada) {
                return {
                    vendedor_id: vendedorId,
                    disponible: false,
                    motivo: 'Sin sesiones registradas',
                    estado_sesion: estadoSesion
                };
            }

            // Verificar que sea vendedor (rol 1)
            if (estadoSesion.datos_usuario.rol !== 1) {
                return {
                    vendedor_id: vendedorId,
                    disponible: false,
                    motivo: 'No es un vendedor',
                    estado_sesion: estadoSesion
                };
            }

            // Verificar que esté activo
            if (!estadoSesion.activo) {
                return {
                    vendedor_id: vendedorId,
                    disponible: false,
                    motivo: estadoSesion.estado_sesion === 'inactivo' ? 
                        'Sesión cerrada' : 'Inactivo por tiempo',
                    estado_sesion: estadoSesion
                };
            }

            return {
                vendedor_id: vendedorId,
                disponible: true,
                motivo: 'Vendedor activo y disponible',
                estado_sesion: estadoSesion
            };

        } catch (error) {
            console.error('Error al verificar disponibilidad del vendedor:', error);
            return {
                vendedor_id: vendedorId,
                disponible: false,
                motivo: 'Error al verificar estado',
                error: error.message
            };
        }
    },

    /**
     * Formatear fecha para mostrar
     * @param {Date|string} fecha - Fecha a formatear
     * @returns {string|null} Fecha formateada
     */
    formatearFecha(fecha) {
        if (!fecha) return null;
        
        const fechaObj = new Date(fecha);
        return fechaObj.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

module.exports = SessionStatusUtil;