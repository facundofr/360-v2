const db = require('../../config/db');

const TrazabilidadModel = {
    /**
     * Obtener trazabilidad completa de todos los prospectos
     */
    async obtenerTrazabilidadCompleta(filtros = {}) {
        try {
            let whereClause = "";
            let params = [];

            // Aplicar filtros si existen
            if (filtros.estado) {
                whereClause += " AND p.estado = ?";
                params.push(filtros.estado);
            }

            if (filtros.vendedor_id) {
                whereClause += " AND asignacion_actual.id_vendedor = ?";
                params.push(filtros.vendedor_id);
            }

            if (filtros.fecha_desde) {
                whereClause += " AND DATE(p.fecha_registro) >= ?";
                params.push(filtros.fecha_desde);
            }

            if (filtros.fecha_hasta) {
                whereClause += " AND DATE(p.fecha_registro) <= ?";
                params.push(filtros.fecha_hasta);
            }

            if (filtros.supervisor_id) {
                whereClause += " AND supervisor.id = ?";
                params.push(filtros.supervisor_id);
            }

            if (filtros.activo_solamente === 'true' || filtros.activo_solamente === true) {
                whereClause += " AND us.logout_time IS NULL AND us.id IS NOT NULL";
            }

            const query = `
                SELECT 
                    -- Datos del prospecto
                    p.id as prospecto_id,
                    p.nombre,
                    p.apellido,
                    p.edad,
                    p.numero_contacto,
                    p.correo,
                    p.localidad,
                    p.fecha_registro,
                    p.estado as estado_prospecto,
                    p.comentario as comentario_prospecto,
                    ta.nombre as tipo_afiliacion,
                    p.whatsapp_opt_in,
                    p.whatsapp_opt_in_fecha,
                    
                    -- Asignación actual
                    asignacion_actual.id as asignacion_id,
                    asignacion_actual.id_vendedor,
                    asignacion_actual.fecha_asignacion,
                    asignacion_actual.estado as estado_asignacion,
                    asignacion_actual.fecha_estado,
                    asignacion_actual.comentario as comentario_asignacion,
                    
                    -- Datos del vendedor
                    vendedor.first_name as vendedor_nombre,
                    vendedor.last_name as vendedor_apellido,
                    vendedor.email as vendedor_email,
                    vendedor.phone_number as vendedor_telefono,
                    vendedor.last_login as vendedor_ultimo_login,
                    
                    -- Datos del supervisor
                    supervisor.id as supervisor_id,
                    supervisor.first_name as supervisor_nombre,
                    supervisor.last_name as supervisor_apellido,
                    supervisor.email as supervisor_email,
                    
                    -- Estado de sesión del vendedor
                    CASE 
                        WHEN us.id IS NOT NULL AND us.logout_time IS NULL 
                        THEN 'activo'
                        ELSE 'inactivo'
                    END as vendedor_estado_sesion,
                    us.login_time as vendedor_sesion_inicio,
                    us.logout_time as vendedor_sesion_fin,
                    TIMESTAMPDIFF(MINUTE, us.login_time, COALESCE(us.logout_time, NOW())) as tiempo_actividad_minutos,
                    
                    -- Conversaciones WhatsApp (usando subconsultas para evitar duplicados)
                    (SELECT COUNT(*) FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id LIMIT 1) as tiene_conversacion_whatsapp,
                    (SELECT numero_conversacion FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as numero_conversacion,
                    (SELECT estado FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as conversacion_estado,
                    (SELECT tipo_origen FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as conversacion_origen,
                    (SELECT created_at FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as conversacion_fecha_inicio,
                    (SELECT ultima_actividad FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id ORDER BY created_at DESC LIMIT 1) as conversacion_ultima_actividad,
                    
                    -- Conteo de mensajes WhatsApp
                    (SELECT COUNT(cm.id) 
                     FROM chat_conversaciones_whatsapp cw 
                     LEFT JOIN chat_mensajes cm ON cw.id = cm.conversacion_id 
                     WHERE cw.prospecto_id = p.id) as total_mensajes_whatsapp,
                    (SELECT COUNT(cm.id) 
                     FROM chat_conversaciones_whatsapp cw 
                     LEFT JOIN chat_mensajes cm ON cw.id = cm.conversacion_id 
                     WHERE cw.prospecto_id = p.id AND cm.tipo = 'enviado') as mensajes_enviados,
                    (SELECT COUNT(cm.id) 
                     FROM chat_conversaciones_whatsapp cw 
                     LEFT JOIN chat_mensajes cm ON cw.id = cm.conversacion_id 
                     WHERE cw.prospecto_id = p.id AND cm.tipo = 'recibido') as mensajes_recibidos,
                    
                    -- Cotizaciones
                    (SELECT COUNT(*) FROM cotizaciones WHERE prospecto_id = p.id) as total_cotizaciones,
                    (SELECT fecha FROM cotizaciones WHERE prospecto_id = p.id ORDER BY fecha DESC LIMIT 1) as fecha_ultima_cotizacion,
                    
                    -- Pólizas
                    (SELECT id FROM polizas WHERE prospecto_id = p.id AND deleted_at IS NULL LIMIT 1) as poliza_id,
                    (SELECT numero_poliza FROM polizas WHERE prospecto_id = p.id AND deleted_at IS NULL LIMIT 1) as numero_poliza,
                    (SELECT numero_poliza_oficial FROM polizas WHERE prospecto_id = p.id AND deleted_at IS NULL LIMIT 1) as numero_poliza_oficial,
                    (SELECT estado FROM polizas WHERE prospecto_id = p.id AND deleted_at IS NULL LIMIT 1) as poliza_estado,
                    (SELECT created_at FROM polizas WHERE prospecto_id = p.id AND deleted_at IS NULL LIMIT 1) as poliza_fecha_creacion,
                    
                    -- Historial de acciones
                    (SELECT COUNT(*) FROM historial_acciones WHERE id_prospecto = p.id) as total_acciones_historial,
                    (SELECT accion FROM historial_acciones WHERE id_prospecto = p.id ORDER BY fecha DESC LIMIT 1) as ultima_accion,
                    (SELECT fecha FROM historial_acciones WHERE id_prospecto = p.id ORDER BY fecha DESC LIMIT 1) as fecha_ultima_accion,
                    
                    -- Total de asignaciones (para ver reasignaciones)
                    (SELECT COUNT(*) FROM asignaciones WHERE id_prospecto = p.id) as total_asignaciones

                FROM prospectos p
                
                -- Asignación más reciente
                LEFT JOIN (
                    SELECT a1.*
                    FROM asignaciones a1
                    INNER JOIN (
                        SELECT id_prospecto, MAX(fecha_asignacion) as max_fecha
                        FROM asignaciones
                        GROUP BY id_prospecto
                    ) a2 ON a1.id_prospecto = a2.id_prospecto AND a1.fecha_asignacion = a2.max_fecha
                ) asignacion_actual ON p.id = asignacion_actual.id_prospecto
                
                -- Datos del vendedor
                LEFT JOIN users vendedor ON asignacion_actual.id_vendedor = vendedor.id
                
                -- Datos del supervisor
                LEFT JOIN users supervisor ON vendedor.supervisor_id = supervisor.id
                
                -- Estado de sesión actual del vendedor
                LEFT JOIN user_sessions us ON vendedor.id = us.user_id 
                    AND us.logout_time IS NULL
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = vendedor.id
                    )
                
                -- Tipo de afiliación
                LEFT JOIN tipos_afiliacion ta ON p.tipo_afiliacion_id = ta.id
                
                WHERE p.estado != 'eliminado'
                ${whereClause}
                ORDER BY p.fecha_registro DESC, p.id DESC
            `;

            console.log('🔍 Ejecutando consulta de trazabilidad con filtros:', filtros);
            const [results] = await db.query(query, params);
            
            console.log(`📊 Resultados obtenidos: ${results.length} registros`);
            
            // Procesar resultados para formatear fechas y calcular métricas
            const trazabilidad = results.map(row => ({
                ...row,
                // Formatear fechas
                fecha_registro_formateada: this.formatearFecha(row.fecha_registro),
                fecha_asignacion_formateada: this.formatearFecha(row.fecha_asignacion),
                fecha_estado_formateada: this.formatearFecha(row.fecha_estado),
                vendedor_ultimo_login_formateado: this.formatearFecha(row.vendedor_ultimo_login),
                vendedor_sesion_inicio_formateado: this.formatearFecha(row.vendedor_sesion_inicio),
                conversacion_fecha_inicio_formateada: this.formatearFecha(row.conversacion_fecha_inicio),
                conversacion_ultima_actividad_formateada: this.formatearFecha(row.conversacion_ultima_actividad),
                fecha_ultima_cotizacion_formateada: this.formatearFecha(row.fecha_ultima_cotizacion),
                poliza_fecha_creacion_formateada: this.formatearFecha(row.poliza_fecha_creacion),
                fecha_ultima_accion_formateada: this.formatearFecha(row.fecha_ultima_accion),
                
                // Calcular tiempo desde última actividad
                tiempo_desde_login: this.calcularTiempoTranscurrido(row.vendedor_sesion_inicio),
                tiempo_desde_registro: this.calcularTiempoTranscurrido(row.fecha_registro),
                tiempo_desde_ultima_actividad: this.calcularTiempoTranscurrido(row.vendedor_ultimo_login),
                
                // Indicadores de estado
                tiene_whatsapp: row.whatsapp_opt_in === 1,
                tiene_conversacion_whatsapp: row.tiene_conversacion_whatsapp > 0,
                tiene_cotizaciones: row.total_cotizaciones > 0,
                tiene_poliza: row.poliza_id !== null,
                tiene_supervisor: row.supervisor_id !== null,
                fue_reasignado: row.total_asignaciones > 1,
                
                // Estado del vendedor
                vendedor_activo: row.vendedor_estado_sesion === 'activo',
                tiempo_actividad_horas: row.tiempo_actividad_minutos ? Math.round(row.tiempo_actividad_minutos / 60 * 100) / 100 : 0
            }));

            return trazabilidad;

        } catch (error) {
            console.error('Error al obtener trazabilidad completa:', error);
            throw new Error('Error al obtener la trazabilidad de prospectos');
        }
    },

    /**
     * Obtener estadísticas de trazabilidad
     */
    async obtenerEstadisticasTrazabilidad() {
        try {
            const query = `
                SELECT 
                    COUNT(p.id) as total_prospectos,
                    COUNT(CASE WHEN p.estado = 'Lead' THEN 1 END) as total_leads,
                    COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as total_ventas,
                    COUNT(CASE WHEN p.estado = 'No contactado' THEN 1 END) as total_no_contactados,
                    COUNT(CASE WHEN p.whatsapp_opt_in = 1 THEN 1 END) as total_con_whatsapp,
                    COUNT(CASE WHEN (SELECT COUNT(*) FROM chat_conversaciones_whatsapp WHERE prospecto_id = p.id) > 0 THEN 1 END) as total_con_conversaciones,
                    COUNT(CASE WHEN (SELECT COUNT(*) FROM cotizaciones WHERE prospecto_id = p.id) > 0 THEN 1 END) as total_con_cotizaciones,
                    COUNT(CASE WHEN (SELECT COUNT(*) FROM polizas WHERE prospecto_id = p.id AND deleted_at IS NULL) > 0 THEN 1 END) as total_con_polizas,
                    (SELECT COUNT(DISTINCT vendedor.id) 
                     FROM users vendedor 
                     JOIN user_sessions us ON vendedor.id = us.user_id 
                     WHERE us.logout_time IS NULL 
                     AND vendedor.role = 1) as vendedores_activos,
                    (SELECT COUNT(*) FROM users WHERE role = 1) as total_vendedores
                FROM prospectos p
                WHERE p.estado != 'eliminado'
            `;

            const [results] = await db.query(query);
            const stats = results[0];
            
            // Calcular porcentajes
            const total = stats.total_prospectos;
            return {
                ...stats,
                porcentaje_ventas: total > 0 ? Math.round((stats.total_ventas / total) * 100) : 0,
                porcentaje_con_whatsapp: total > 0 ? Math.round((stats.total_con_whatsapp / total) * 100) : 0,
                porcentaje_con_conversaciones: total > 0 ? Math.round((stats.total_con_conversaciones / total) * 100) : 0,
                porcentaje_con_cotizaciones: total > 0 ? Math.round((stats.total_con_cotizaciones / total) * 100) : 0
            };

        } catch (error) {
            console.error('Error al obtener estadísticas de trazabilidad:', error);
            throw new Error('Error al obtener estadísticas');
        }
    },

    /**
     * Obtener lista de vendedores para filtros
     */
    async obtenerVendedores() {
        try {
            const query = `
                SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    CASE 
                        WHEN us.logout_time IS NULL THEN 'activo'
                        ELSE 'inactivo'
                    END as estado_sesion
                FROM users u
                LEFT JOIN user_sessions us ON u.id = us.user_id 
                    AND us.logout_time IS NULL
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = u.id
                    )
                WHERE u.role = 1
                ORDER BY u.first_name, u.last_name
            `;

            const [results] = await db.query(query);
            return results;

        } catch (error) {
            console.error('Error al obtener vendedores:', error);
            throw new Error('Error al obtener lista de vendedores');
        }
    },

    /**
     * Obtener lista de supervisores para filtros
     */
    async obtenerSupervisores() {
        try {
            const query = `
                SELECT 
                    id,
                    first_name,
                    last_name,
                    email
                FROM users
                WHERE role = 2
                ORDER BY first_name, last_name
            `;

            const [results] = await db.query(query);
            return results;

        } catch (error) {
            console.error('Error al obtener supervisores:', error);
            throw new Error('Error al obtener lista de supervisores');
        }
    },

    /**
     * Verificar estado de sesión de un vendedor específico
     */
    async verificarEstadoSesionVendedor(vendedorId) {
        try {
            const query = `
                SELECT 
                    us.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    CASE 
                        WHEN us.logout_time IS NULL THEN 'activo'
                        ELSE 'inactivo'
                    END as estado_sesion
                FROM users u
                LEFT JOIN user_sessions us ON u.id = us.user_id
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = u.id
                    )
                WHERE u.id = ?
            `;

            const [results] = await db.query(query, [vendedorId]);
            return results[0] || null;

        } catch (error) {
            console.error('Error al verificar estado de sesión del vendedor:', error);
            throw new Error('Error al verificar estado de sesión');
        }
    },

    /**
     * Obtener historial detallado de un prospecto específico
     */
    async obtenerHistorialProspecto(prospectoId) {
        try {
            // Información básica del prospecto
            const queryProspecto = `
                SELECT 
                    p.*,
                    ta.nombre as tipo_afiliacion,
                    vendedor.first_name as vendedor_nombre,
                    vendedor.last_name as vendedor_apellido,
                    vendedor.email as vendedor_email,
                    supervisor.first_name as supervisor_nombre,
                    supervisor.last_name as supervisor_apellido,
                    asignacion_actual.fecha_asignacion,
                    CASE 
                        WHEN us.logout_time IS NULL THEN 'activo'
                        ELSE 'inactivo'
                    END as vendedor_estado_sesion,
                    TIMESTAMPDIFF(MINUTE, us.login_time, COALESCE(us.logout_time, NOW())) as tiempo_actividad_minutos
                FROM prospectos p
                LEFT JOIN tipos_afiliacion ta ON p.tipo_afiliacion_id = ta.id
                LEFT JOIN (
                    SELECT a1.*
                    FROM asignaciones a1
                    INNER JOIN (
                        SELECT id_prospecto, MAX(fecha_asignacion) as max_fecha
                        FROM asignaciones
                        GROUP BY id_prospecto
                    ) a2 ON a1.id_prospecto = a2.id_prospecto AND a1.fecha_asignacion = a2.max_fecha
                ) asignacion_actual ON p.id = asignacion_actual.id_prospecto
                LEFT JOIN users vendedor ON asignacion_actual.id_vendedor = vendedor.id
                LEFT JOIN users supervisor ON vendedor.supervisor_id = supervisor.id
                LEFT JOIN user_sessions us ON vendedor.id = us.user_id 
                    AND us.logout_time IS NULL
                    AND us.login_time = (
                        SELECT MAX(login_time) 
                        FROM user_sessions 
                        WHERE user_id = vendedor.id
                    )
                WHERE p.id = ?
            `;

            // Historial de asignaciones
            const queryAsignaciones = `
                SELECT 
                    a.*,
                    u.first_name as vendedor_nombre,
                    u.last_name as vendedor_apellido,
                    u.email as vendedor_email
                FROM asignaciones a
                LEFT JOIN users u ON a.id_vendedor = u.id
                WHERE a.id_prospecto = ?
                ORDER BY a.fecha_asignacion DESC
            `;

            // Historial de acciones
            const queryAcciones = `
                SELECT 
                    ha.*,
                    u.first_name as vendedor_nombre,
                    u.last_name as vendedor_apellido
                FROM historial_acciones ha
                LEFT JOIN users u ON ha.id_vendedor = u.id
                WHERE ha.id_prospecto = ?
                ORDER BY ha.fecha DESC
            `;

            // Cotizaciones
            const queryCotizaciones = `
                SELECT 
                    c.*,
                    p.nombre as plan_nombre
                FROM cotizaciones c
                LEFT JOIN planes p ON c.plan_id = p.id
                WHERE c.prospecto_id = ?
                ORDER BY c.fecha DESC
            `;

            const [prospectoResult] = await db.query(queryProspecto, [prospectoId]);
            const [asignacionesResult] = await db.query(queryAsignaciones, [prospectoId]);
            const [accionesResult] = await db.query(queryAcciones, [prospectoId]);
            const [cotizacionesResult] = await db.query(queryCotizaciones, [prospectoId]);

            if (prospectoResult.length === 0) {
                return null;
            }

            const prospecto = prospectoResult[0];
            
            return {
                prospecto: {
                    ...prospecto,
                    fecha_registro_formateada: this.formatearFecha(prospecto.fecha_registro),
                    fecha_asignacion_formateada: this.formatearFecha(prospecto.fecha_asignacion),
                    vendedor_activo: prospecto.vendedor_estado_sesion === 'activo',
                    tiempo_actividad_horas: prospecto.tiempo_actividad_minutos ? Math.round(prospecto.tiempo_actividad_minutos / 60 * 100) / 100 : 0
                },
                historial_asignaciones: asignacionesResult.map(asignacion => ({
                    ...asignacion,
                    fecha_asignacion_formateada: this.formatearFecha(asignacion.fecha_asignacion)
                })),
                historial_acciones: accionesResult.map(accion => ({
                    ...accion,
                    fecha_formateada: this.formatearFecha(accion.fecha)
                })),
                cotizaciones: cotizacionesResult.map(cotizacion => ({
                    ...cotizacion,
                    fecha_formateada: this.formatearFecha(cotizacion.fecha)
                }))
            };

        } catch (error) {
            console.error('Error al obtener historial del prospecto:', error);
            throw new Error('Error al obtener historial del prospecto');
        }
    },

    /**
     * Formatear fecha para mostrar
     */
    formatearFecha(fecha) {
        if (!fecha) return null;
        
        try {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) return null;
            
            return fechaObj.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return null;
        }
    },

    /**
     * Calcular tiempo transcurrido desde una fecha
     */
    calcularTiempoTranscurrido(fecha) {
        if (!fecha) return null;
        
        try {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) return null;
            
            const ahora = new Date();
            const diffMs = ahora - fechaObj;
            const diffMinutos = Math.floor(diffMs / (1000 * 60));
            const diffHoras = Math.floor(diffMinutos / 60);
            const diffDias = Math.floor(diffHoras / 24);
            
            if (diffDias > 0) {
                return `${diffDias} día${diffDias > 1 ? 's' : ''}`;
            } else if (diffHoras > 0) {
                return `${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
            } else {
                return `${diffMinutos} minuto${diffMinutos > 1 ? 's' : ''}`;
            }
        } catch (error) {
            return null;
        }
    }
};

module.exports = TrazabilidadModel;