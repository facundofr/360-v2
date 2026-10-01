const SessionStatusUtil = require('../utils/sessionStatus');
const { validationResult } = require('express-validator');

const SessionStatusController = {
    /**
     * Verificar estado de sesión de un usuario específico
     */
    async checkUserSession(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const { userId } = req.params;
            console.log(`🔍 Verificando estado de sesión del usuario ${userId}...`);

            const estadoSesion = await SessionStatusUtil.checkUserSession(parseInt(userId));

            res.json({
                success: true,
                message: 'Estado de sesión obtenido exitosamente',
                data: estadoSesion
            });

        } catch (error) {
            console.error('❌ Error al verificar estado de sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al verificar estado de sesión',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Obtener usuarios activos en este momento
     */
    async getActiveUsers(req, res) {
        try {
            console.log('👥 Obteniendo usuarios activos...');

            const usuariosActivos = await SessionStatusUtil.getActiveUsers();

            res.json({
                success: true,
                message: 'Usuarios activos obtenidos exitosamente',
                data: {
                    usuarios_activos: usuariosActivos,
                    total: usuariosActivos.length,
                    fecha_consulta: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener usuarios activos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener usuarios activos',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Obtener estadísticas generales de sesiones
     */
    async getSessionStats(req, res) {
        try {
            console.log('📊 Obteniendo estadísticas de sesiones...');

            const estadisticas = await SessionStatusUtil.getSessionStats();

            res.json({
                success: true,
                message: 'Estadísticas de sesiones obtenidas exitosamente',
                data: estadisticas
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas de sesiones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener estadísticas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Verificar disponibilidad de un vendedor
     */
    async checkVendedorDisponibilidad(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const { vendedorId } = req.params;
            console.log(`🔍 Verificando disponibilidad del vendedor ${vendedorId}...`);

            const disponibilidad = await SessionStatusUtil.checkVendedorDisponibilidad(parseInt(vendedorId));

            res.json({
                success: true,
                message: 'Disponibilidad del vendedor verificada exitosamente',
                data: disponibilidad
            });

        } catch (error) {
            console.error('❌ Error al verificar disponibilidad del vendedor:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al verificar disponibilidad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Verificar estado de múltiples usuarios
     */
    async checkMultipleUsers(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const { userIds } = req.body;
            
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un array de IDs de usuarios'
                });
            }

            console.log(`🔍 Verificando estado de ${userIds.length} usuarios...`);

            const estadosSesion = await SessionStatusUtil.checkMultipleUserSessions(userIds);

            res.json({
                success: true,
                message: 'Estados de sesión obtenidos exitosamente',
                data: {
                    estados_sesion: estadosSesion,
                    total_consultados: userIds.length,
                    fecha_consulta: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error al verificar múltiples estados de sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al verificar estados de sesión',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Endpoint para dashboard - resumen de actividad
     */
    async getDashboardSummary(req, res) {
        try {
            console.log('📋 Obteniendo resumen para dashboard...');

            const [estadisticas, usuariosActivos] = await Promise.all([
                SessionStatusUtil.getSessionStats(),
                SessionStatusUtil.getActiveUsers()
            ]);

            // Agrupar usuarios activos por rol
            const usuariosPorRol = usuariosActivos.reduce((acc, user) => {
                const rol = user.role === 1 ? 'vendedores' : 
                           user.role === 2 ? 'supervisores' : 'administradores';
                
                if (!acc[rol]) acc[rol] = [];
                acc[rol].push(user);
                return acc;
            }, {});

            res.json({
                success: true,
                message: 'Resumen de dashboard obtenido exitosamente',
                data: {
                    estadisticas_generales: estadisticas,
                    usuarios_activos_por_rol: usuariosPorRol,
                    total_activos: usuariosActivos.length,
                    fecha_consulta: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener resumen de dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener resumen',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = SessionStatusController;