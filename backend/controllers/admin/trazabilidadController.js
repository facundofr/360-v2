const TrazabilidadModel = require('../../models/admin/trazabilidadModel');
const { validationResult } = require('express-validator');

const TrazabilidadController = {
    /**
     * Obtener trazabilidad completa de todos los prospectos
     */
    async obtenerTrazabilidadCompleta(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            // Extraer filtros de query parameters
            const filtros = {
                estado: req.query.estado,
                vendedor_id: req.query.vendedor_id,
                fecha_desde: req.query.fecha_desde,
                fecha_hasta: req.query.fecha_hasta,
                supervisor_id: req.query.supervisor_id,
                activo_solamente: req.query.activo_solamente === 'true'
            };

            // Remover filtros vacíos
            Object.keys(filtros).forEach(key => {
                if (!filtros[key] && filtros[key] !== 0) {
                    delete filtros[key];
                }
            });

            console.log('🔍 Obteniendo trazabilidad completa con filtros:', filtros);

            const trazabilidad = await TrazabilidadModel.obtenerTrazabilidadCompleta(filtros);

            // Si se solicita solo vendedores activos, filtrar
            let trazabilidadFiltrada = trazabilidad;
            if (filtros.activo_solamente) {
                trazabilidadFiltrada = trazabilidad.filter(item => item.vendedor_activo);
            }

            // Si se filtra por supervisor
            if (filtros.supervisor_id) {
                trazabilidadFiltrada = trazabilidadFiltrada.filter(item => 
                    item.supervisor_id == filtros.supervisor_id
                );
            }

            res.json({
                success: true,
                message: 'Trazabilidad obtenida exitosamente',
                data: {
                    prospectos: trazabilidadFiltrada,
                    total: trazabilidadFiltrada.length,
                    filtros_aplicados: filtros
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener trazabilidad completa:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener trazabilidad',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Obtener estadísticas generales de trazabilidad
     */
    async obtenerEstadisticas(req, res) {
        try {
            console.log('📊 Obteniendo estadísticas de trazabilidad...');

            const estadisticas = await TrazabilidadModel.obtenerEstadisticasTrazabilidad();

            // Calcular porcentajes
            const stats = {
                ...estadisticas,
                porcentaje_ventas: estadisticas.total_prospectos > 0 ? 
                    Math.round((estadisticas.total_ventas / estadisticas.total_prospectos) * 100) : 0,
                porcentaje_con_whatsapp: estadisticas.total_prospectos > 0 ? 
                    Math.round((estadisticas.total_con_whatsapp / estadisticas.total_prospectos) * 100) : 0,
                porcentaje_con_conversaciones: estadisticas.total_prospectos > 0 ? 
                    Math.round((estadisticas.total_con_conversaciones / estadisticas.total_prospectos) * 100) : 0,
                porcentaje_con_cotizaciones: estadisticas.total_prospectos > 0 ? 
                    Math.round((estadisticas.total_con_cotizaciones / estadisticas.total_prospectos) * 100) : 0,
                porcentaje_con_polizas: estadisticas.total_prospectos > 0 ? 
                    Math.round((estadisticas.total_con_polizas / estadisticas.total_prospectos) * 100) : 0
            };

            res.json({
                success: true,
                message: 'Estadísticas obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener estadísticas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Obtener historial detallado de un prospecto específico
     */
    async obtenerHistorialProspecto(req, res) {
        try {
            const { prospectoId } = req.params;

            if (!prospectoId || isNaN(prospectoId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de prospecto inválido'
                });
            }

            console.log(`🔍 Obteniendo historial detallado del prospecto ${prospectoId}...`);

            const historial = await TrazabilidadModel.obtenerHistorialProspecto(parseInt(prospectoId));

            if (!historial) {
                return res.status(404).json({
                    success: false,
                    message: 'Prospecto no encontrado'
                });
            }

            res.json({
                success: true,
                message: 'Historial obtenido exitosamente',
                data: historial
            });

        } catch (error) {
            console.error('❌ Error al obtener historial del prospecto:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener historial',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Verificar estado de sesión de un vendedor
     */
    async verificarEstadoSesion(req, res) {
        try {
            const { vendedorId } = req.params;

            if (!vendedorId || isNaN(vendedorId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de vendedor inválido'
                });
            }

            console.log(`🔍 Verificando estado de sesión del vendedor ${vendedorId}...`);

            const estadoSesion = await TrazabilidadModel.verificarEstadoSesionVendedor(parseInt(vendedorId));

            if (!estadoSesion) {
                return res.json({
                    success: true,
                    message: 'Vendedor sin sesiones registradas',
                    data: {
                        vendedor_id: parseInt(vendedorId),
                        estado_sesion: 'inactivo',
                        activo: false,
                        sesion_encontrada: false
                    }
                });
            }

            res.json({
                success: true,
                message: 'Estado de sesión obtenido exitosamente',
                data: {
                    ...estadoSesion,
                    sesion_encontrada: true
                }
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
     * Obtener lista de vendedores para filtros
     */
    async obtenerVendedores(req, res) {
        try {
            console.log('👥 Obteniendo lista de vendedores...');

            // Query para obtener vendedores que tienen prospectos asignados
            const query = `
                SELECT DISTINCT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    supervisor.first_name as supervisor_nombre,
                    supervisor.last_name as supervisor_apellido,
                    COUNT(DISTINCT a.id_prospecto) as total_prospectos,
                    CASE 
                        WHEN us.logout_time IS NULL THEN 'activo'
                        ELSE 'inactivo'
                    END as estado_sesion
                FROM users u
                INNER JOIN asignaciones a ON u.id = a.id_vendedor
                LEFT JOIN users supervisor ON u.supervisor_id = supervisor.id
                LEFT JOIN user_sessions us ON u.id = us.user_id 
                    AND us.logout_time IS NULL
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = u.id
                    )
                WHERE u.role = 1  -- Solo vendedores
                GROUP BY u.id, u.first_name, u.last_name, u.email, 
                         supervisor.first_name, supervisor.last_name, estado_sesion
                ORDER BY u.first_name, u.last_name
            `;

            const db = require('../../config/db');
            const [vendedores] = await db.query(query);

            res.json({
                success: true,
                message: 'Lista de vendedores obtenida exitosamente',
                data: vendedores
            });

        } catch (error) {
            console.error('❌ Error al obtener vendedores:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener vendedores',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Obtener lista de supervisores para filtros
     */
    async obtenerSupervisores(req, res) {
        try {
            console.log('👨‍💼 Obteniendo lista de supervisores...');

            const query = `
                SELECT DISTINCT
                    supervisor.id,
                    supervisor.first_name,
                    supervisor.last_name,
                    supervisor.email,
                    COUNT(DISTINCT vendedor.id) as total_vendedores,
                    COUNT(DISTINCT a.id_prospecto) as total_prospectos
                FROM users supervisor
                INNER JOIN users vendedor ON supervisor.id = vendedor.supervisor_id
                INNER JOIN asignaciones a ON vendedor.id = a.id_vendedor
                WHERE supervisor.role IN (2, 3)  -- Supervisores y admins
                GROUP BY supervisor.id, supervisor.first_name, supervisor.last_name, supervisor.email
                ORDER BY supervisor.first_name, supervisor.last_name
            `;

            const db = require('../../config/db');
            const [supervisores] = await db.query(query);

            res.json({
                success: true,
                message: 'Lista de supervisores obtenida exitosamente',
                data: supervisores
            });

        } catch (error) {
            console.error('❌ Error al obtener supervisores:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener supervisores',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Exportar trazabilidad a Excel/CSV (funcionalidad futura)
     */
    async exportarTrazabilidad(req, res) {
        try {
            // Por ahora retornamos los datos, en el futuro se puede implementar exportación real
            const filtros = {
                estado: req.query.estado,
                vendedor_id: req.query.vendedor_id,
                fecha_desde: req.query.fecha_desde,
                fecha_hasta: req.query.fecha_hasta
            };

            Object.keys(filtros).forEach(key => {
                if (!filtros[key]) {
                    delete filtros[key];
                }
            });

            const trazabilidad = await TrazabilidadModel.obtenerTrazabilidadCompleta(filtros);

            res.json({
                success: true,
                message: 'Datos preparados para exportación',
                data: {
                    prospectos: trazabilidad,
                    total: trazabilidad.length,
                    fecha_exportacion: new Date().toISOString(),
                    filtros_aplicados: filtros
                }
            });

        } catch (error) {
            console.error('❌ Error al exportar trazabilidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al exportar',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = TrazabilidadController;