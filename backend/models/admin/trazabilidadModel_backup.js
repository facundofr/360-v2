const db = require('../../config/db');

const TrazabilidadModel = {
    /**
     * Obtener trazabilidad completa de todos los prospectos
     */
    async obtenerTrazabilidadCompleta(filtros = {}) {
        try {
            let whereClause = "WHERE p.estado != 'eliminado'";
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
                    
                    -- Conversaciones WhatsApp
                    conversacion_whatsapp.id as conversacion_id,
                    conversacion_whatsapp.numero_conversacion,
                    conversacion_whatsapp.estado as conversacion_estado,
                    conversacion_whatsapp.tipo_origen as conversacion_origen,
                    conversacion_whatsapp.created_at as conversacion_fecha_inicio,
                    conversacion_whatsapp.ultima_actividad as conversacion_ultima_actividad,
                    
                    -- Conteo de mensajes WhatsApp
                    COALESCE(mensajes_count.total_mensajes, 0) as total_mensajes_whatsapp,
                    COALESCE(mensajes_count.mensajes_enviados, 0) as mensajes_enviados,
                    COALESCE(mensajes_count.mensajes_recibidos, 0) as mensajes_recibidos,
                    
                    -- Cotizaciones
                    COALESCE(cotizaciones_count.total_cotizaciones, 0) as total_cotizaciones,
                    cotizacion_reciente.fecha as fecha_ultima_cotizacion,
                    
                    -- Pólizas
                    poliza.id as poliza_id,
                    poliza.numero_poliza,
                    poliza.numero_poliza_oficial,
                    poliza.estado as poliza_estado,
                    poliza.created_at as poliza_fecha_creacion,
                    
                    -- Historial de acciones
                    COALESCE(acciones_count.total_acciones, 0) as total_acciones_historial,
                    accion_reciente.accion as ultima_accion,
                    accion_reciente.fecha as fecha_ultima_accion,
                    
                    -- Total de asignaciones (para ver reasignaciones)
                    COALESCE(total_asignaciones.total, 0) as total_asignaciones

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
                
                -- Conversación WhatsApp más reciente
                LEFT JOIN chat_conversaciones_whatsapp conversacion_whatsapp ON p.id = conversacion_whatsapp.prospecto_id
                
                -- Conteo de mensajes WhatsApp
                LEFT JOIN (
                    SELECT 
                        cw.prospecto_id,
                        COUNT(cm.id) as total_mensajes,
                        SUM(CASE WHEN cm.tipo = 'enviado' THEN 1 ELSE 0 END) as mensajes_enviados,
                        SUM(CASE WHEN cm.tipo = 'recibido' THEN 1 ELSE 0 END) as mensajes_recibidos
                    FROM chat_conversaciones_whatsapp cw
                    LEFT JOIN chat_mensajes cm ON cw.id = cm.conversacion_id
                    GROUP BY cw.prospecto_id
                ) mensajes_count ON p.id = mensajes_count.prospecto_id
                
                -- Conteo de cotizaciones
                LEFT JOIN (
                    SELECT prospecto_id, COUNT(*) as total_cotizaciones
                    FROM cotizaciones
                    GROUP BY prospecto_id
                ) cotizaciones_count ON p.id = cotizaciones_count.prospecto_id
                
                -- Cotización más reciente
                LEFT JOIN (
                    SELECT c1.*
                    FROM cotizaciones c1
                    INNER JOIN (
                        SELECT prospecto_id, MAX(fecha) as max_fecha
                        FROM cotizaciones
                        GROUP BY prospecto_id
                    ) c2 ON c1.prospecto_id = c2.prospecto_id AND c1.fecha = c2.max_fecha
                ) cotizacion_reciente ON p.id = cotizacion_reciente.prospecto_id
                
                -- Póliza (si existe)
                LEFT JOIN polizas poliza ON p.id = poliza.prospecto_id AND poliza.deleted_at IS NULL
                
                -- Conteo de acciones en historial
                LEFT JOIN (
                    SELECT id_prospecto, COUNT(*) as total_acciones
                    FROM historial_acciones
                    GROUP BY id_prospecto
                ) acciones_count ON p.id = acciones_count.id_prospecto
                
                -- Acción más reciente
                LEFT JOIN (
                    SELECT ha1.*
                    FROM historial_acciones ha1
                    INNER JOIN (
                        SELECT id_prospecto, MAX(fecha) as max_fecha
                        FROM historial_acciones
                        GROUP BY id_prospecto
                    ) ha2 ON ha1.id_prospecto = ha2.id_prospecto AND ha1.fecha = ha2.max_fecha
                ) accion_reciente ON p.id = accion_reciente.id_prospecto
                
                -- Total de asignaciones por prospecto
                LEFT JOIN (
                    SELECT id_prospecto, COUNT(*) as total
                    FROM asignaciones
                    GROUP BY id_prospecto
                ) total_asignaciones ON p.id = total_asignaciones.id_prospecto
                
                ${whereClause}
                ORDER BY p.fecha_registro DESC, p.id DESC
            `;

            const [results] = await db.query(query, params);
            
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
                
                // Indicadores de estado
                tiene_whatsapp: row.whatsapp_opt_in === 1,
                tiene_conversacion_whatsapp: row.conversacion_id !== null,
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
                    COUNT(DISTINCT p.id) as total_prospectos,
                    COUNT(DISTINCT CASE WHEN p.estado = 'Lead' THEN p.id END) as total_leads,
                    COUNT(DISTINCT CASE WHEN p.estado = 'Venta' THEN p.id END) as total_ventas,
                    COUNT(DISTINCT CASE WHEN p.estado = 'No contactado' THEN p.id END) as total_no_contactados,
                    COUNT(DISTINCT CASE WHEN p.whatsapp_opt_in = 1 THEN p.id END) as total_con_whatsapp,
                    COUNT(DISTINCT cw.prospecto_id) as total_con_conversaciones,
                    COUNT(DISTINCT co.prospecto_id) as total_con_cotizaciones,
                    COUNT(DISTINCT po.prospecto_id) as total_con_polizas,
                    COUNT(DISTINCT CASE WHEN us.logout_time IS NULL THEN a.id_vendedor END) as vendedores_activos,
                    COUNT(DISTINCT a.id_vendedor) as total_vendedores
                FROM prospectos p
                LEFT JOIN asignaciones a ON p.id = a.id_prospecto
                LEFT JOIN chat_conversaciones_whatsapp cw ON p.id = cw.prospecto_id
                LEFT JOIN cotizaciones co ON p.id = co.prospecto_id
                LEFT JOIN polizas po ON p.id = po.prospecto_id AND po.deleted_at IS NULL
                LEFT JOIN users u ON a.id_vendedor = u.id
                LEFT JOIN user_sessions us ON u.id = us.user_id AND us.logout_time IS NULL
                WHERE p.estado != 'eliminado'
            `;

            const [results] = await db.query(query);
            return results[0];

        } catch (error) {
            console.error('Error al obtener estadísticas de trazabilidad:', error);
            throw new Error('Error al obtener estadísticas');
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
                    END as estado_sesion,
                    TIMESTAMPDIFF(MINUTE, us.login_time, COALESCE(us.last_activity, NOW())) as tiempo_actividad_minutos
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

            const [results] = await db.query(query, [vendedorId, vendedorId]);
            
            if (results.length > 0) {
                const sesion = results[0];
                return {
                    ...sesion,
                    tiempo_actividad_horas: sesion.tiempo_actividad_minutos ? 
                        Math.round(sesion.tiempo_actividad_minutos / 60 * 100) / 100 : 0,
                    activo: sesion.estado_sesion === 'activo'
                };
            }

            return null;

        } catch (error) {
            console.error('Error al verificar estado de sesión:', error);
            throw new Error('Error al verificar estado de sesión del vendedor');
        }
    },

    /**
     * Obtener historial completo de un prospecto específico
     */
    async obtenerHistorialProspecto(prospectoId) {
        try {
            // Obtener trazabilidad del prospecto específico
            const trazabilidad = await this.obtenerTrazabilidadCompleta({ prospecto_id: prospectoId });
            
            if (trazabilidad.length === 0) {
                return null;
            }

            // Obtener historial detallado de asignaciones
            const queryAsignaciones = `
                SELECT 
                    a.*,
                    u.first_name as vendedor_nombre,
                    u.last_name as vendedor_apellido,
                    u.email as vendedor_email,
                    asignador.first_name as asignador_nombre,
                    asignador.last_name as asignador_apellido
                FROM asignaciones a
                LEFT JOIN users u ON a.id_vendedor = u.id
                LEFT JOIN users asignador ON a.asignado_por = asignador.id
                WHERE a.id_prospecto = ?
                ORDER BY a.fecha_asignacion ASC
            `;

            // Obtener historial de acciones
            const queryAcciones = `
                SELECT 
                    ha.*,
                    u.first_name as vendedor_nombre,
                    u.last_name as vendedor_apellido
                FROM historial_acciones ha
                LEFT JOIN users u ON ha.id_vendedor = u.id
                WHERE ha.id_prospecto = ?
                ORDER BY ha.fecha ASC
            `;

            // Obtener cotizaciones
            const queryCotizaciones = `
                SELECT 
                    c.*,
                    p.nombre as plan_nombre
                FROM cotizaciones c
                LEFT JOIN planes p ON c.plan_id = p.id
                WHERE c.prospecto_id = ?
                ORDER BY c.fecha ASC
            `;

            const [asignaciones] = await db.query(queryAsignaciones, [prospectoId]);
            const [acciones] = await db.query(queryAcciones, [prospectoId]);
            const [cotizaciones] = await db.query(queryCotizaciones, [prospectoId]);

            return {
                prospecto: trazabilidad[0],
                historial_asignaciones: asignaciones.map(a => ({
                    ...a,
                    fecha_asignacion_formateada: this.formatearFecha(a.fecha_asignacion),
                    fecha_estado_formateada: this.formatearFecha(a.fecha_estado)
                })),
                historial_acciones: acciones.map(a => ({
                    ...a,
                    fecha_formateada: this.formatearFecha(a.fecha)
                })),
                cotizaciones: cotizaciones.map(c => ({
                    ...c,
                    fecha_formateada: this.formatearFecha(c.fecha)
                }))
            };

        } catch (error) {
            console.error('Error al obtener historial del prospecto:', error);
            throw new Error('Error al obtener historial detallado del prospecto');
        }
    },

    /**
     * Formatear fecha para mostrar
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
    },

    /**
     * Calcular tiempo transcurrido desde una fecha
     */
    calcularTiempoTranscurrido(fecha) {
        if (!fecha) return null;
        
        const ahora = new Date();
        const fechaObj = new Date(fecha);
        const diferencia = ahora - fechaObj;
        
        const minutos = Math.floor(diferencia / (1000 * 60));
        const horas = Math.floor(minutos / 60);
        const dias = Math.floor(horas / 24);
        
        if (dias > 0) {
            return `${dias} día${dias > 1 ? 's' : ''}`;
        } else if (horas > 0) {
            return `${horas} hora${horas > 1 ? 's' : ''}`;
        } else {
            return `${minutos} minuto${minutos > 1 ? 's' : ''}`;
        }
    }
};

module.exports = TrazabilidadModel;