const pool = require('../../config/db');

class ProspectosBackOffice {
    // ✅ Obtener todos los prospectos con información completa
    static async getAllProspectos({
        page = 1,
        limit = 50,
        id = '',
        search = '',
        estado = '',
        vendedor_id = '',
        supervisor_id = '',
        fecha_desde = '',
        fecha_hasta = ''
    } = {}) {
        try {
            const offset = (page - 1) * limit;

            // Construir condiciones WHERE
            let whereConditions = ['p.id IS NOT NULL'];
            let queryParams = [];

            if (id) {
                whereConditions.push('p.id = ?');
                queryParams.push(id);
            }

            if (search) {
                whereConditions.push(`(
                    p.nombre LIKE ? OR 
                    p.apellido LIKE ? OR 
                    p.correo LIKE ? OR 
                    p.numero_contacto LIKE ? OR
                    p.dni LIKE ?
                )`);
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            }
            
            if (estado) {
                whereConditions.push('asig.estado = ?');
                queryParams.push(estado);
            }
            
            if (vendedor_id) {
                whereConditions.push('asig.id_vendedor = ?');
                queryParams.push(vendedor_id);
            }
            
            if (supervisor_id) {
                whereConditions.push('vendedor.supervisor_id = ?');
                queryParams.push(supervisor_id);
            }
            
            if (fecha_desde) {
                whereConditions.push('COALESCE(p.fecha_hora_registro, p.fecha_registro) >= ?');
                queryParams.push(fecha_desde);
            }
            
            if (fecha_hasta) {
                whereConditions.push('COALESCE(p.fecha_hora_registro, p.fecha_registro) <= ?');
                queryParams.push(fecha_hasta);
            }
            
            const whereClause = whereConditions.join(' AND ');
            
            const query = `
                SELECT 
                    p.id,
                    p.nombre,
                    p.apellido,
                    p.edad,
                    p.numero_contacto,
                    p.correo,
                    p.localidad,
                    p.fecha_hora_registro,
                    p.fecha_registro,
                    p.comentario,
                    p.whatsapp_opt_in,
                    p.whatsapp_opt_in_fecha,
                    p.es_reciclado,
                    p.origen,
                    
                    -- Estado real desde asignaciones
                    asig.estado,
                    asig.fecha_asignacion,
                    asig.comentario as asignacion_comentario,
                    
                    -- Información del vendedor desde asignaciones
                    vendedor.id as vendedor_id,
                    vendedor.first_name as vendedor_nombre,
                    vendedor.last_name as vendedor_apellido,
                    vendedor.email as vendedor_email,
                    vendedor.phone_number as vendedor_telefono,
                    
                    -- Información del supervisor
                    supervisor.id as supervisor_id,
                    supervisor.first_name as supervisor_nombre,
                    supervisor.last_name as supervisor_apellido,
                    supervisor.email as supervisor_email,
                    
                    -- Contadores
                    COALESCE(cotizaciones_count.total, 0) as cotizaciones_count,
                    COALESCE(polizas_count.total, 0) as polizas_count,
                    COALESCE(acciones_count.total, 0) as acciones_count,
                    
                    -- Última acción
                    ultima_accion.accion as ultima_accion,
                    ultima_accion.fecha as ultima_accion_fecha,
                    ultima_accion.descripcion as ultima_accion_descripcion,
                    
                    -- Última cotización
                    ultima_cotizacion.total_final as ultima_cotizacion_monto,
                    ultima_cotizacion.fecha as ultima_cotizacion_fecha,
                    
                    -- Estado de póliza más reciente
                    poliza_reciente.estado as poliza_estado,
                    poliza_reciente.numero_poliza as poliza_numero
                    
                FROM prospectos p
                
                -- JOIN con la asignación más reciente (fuente de verdad)
                LEFT JOIN (
                    SELECT 
                        id_prospecto,
                        id_vendedor,
                        estado,
                        fecha_asignacion,
                        comentario,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                
                -- JOIN con vendedor desde asignaciones
                LEFT JOIN users vendedor ON asig.id_vendedor = vendedor.id
                
                -- JOIN con supervisor
                LEFT JOIN users supervisor ON vendedor.supervisor_id = supervisor.id
                
                -- Contar cotizaciones
                LEFT JOIN (
                    SELECT prospecto_id, COUNT(*) as total
                    FROM cotizaciones
                    GROUP BY prospecto_id
                ) cotizaciones_count ON p.id = cotizaciones_count.prospecto_id
                
                -- Contar pólizas
                LEFT JOIN (
                    SELECT prospecto_id, COUNT(*) as total
                    FROM polizas
                    WHERE deleted_at IS NULL
                    GROUP BY prospecto_id
                ) polizas_count ON p.id = polizas_count.prospecto_id
                
                -- Contar acciones
                LEFT JOIN (
                    SELECT id_prospecto, COUNT(*) as total
                    FROM historial_acciones
                    GROUP BY id_prospecto
                ) acciones_count ON p.id = acciones_count.id_prospecto
                
                -- Última acción
                LEFT JOIN (
                    SELECT 
                        ha1.id_prospecto,
                        ha1.accion,
                        ha1.fecha,
                        ha1.descripcion
                    FROM historial_acciones ha1
                    INNER JOIN (
                        SELECT id_prospecto, MAX(fecha) as max_fecha, MAX(id) as max_id
                        FROM historial_acciones
                        GROUP BY id_prospecto
                    ) ha_max ON ha1.id_prospecto = ha_max.id_prospecto 
                               AND ha1.fecha = ha_max.max_fecha 
                               AND ha1.id = ha_max.max_id
                ) ultima_accion ON p.id = ultima_accion.id_prospecto
                
                -- Última cotización
                LEFT JOIN (
                    SELECT 
                        c1.prospecto_id,
                        c1.total_final,
                        c1.fecha
                    FROM cotizaciones c1
                    INNER JOIN (
                        SELECT prospecto_id, MAX(fecha) as max_fecha, MAX(id) as max_id
                        FROM cotizaciones
                        GROUP BY prospecto_id
                    ) c_max ON c1.prospecto_id = c_max.prospecto_id 
                              AND c1.fecha = c_max.max_fecha 
                              AND c1.id = c_max.max_id
                ) ultima_cotizacion ON p.id = ultima_cotizacion.prospecto_id
                
                -- Póliza más reciente
                LEFT JOIN (
                    SELECT 
                        pol1.prospecto_id,
                        pol1.estado,
                        pol1.numero_poliza
                    FROM polizas pol1
                    INNER JOIN (
                        SELECT prospecto_id, MAX(created_at) as max_created, MAX(id) as max_id
                        FROM polizas
                        WHERE deleted_at IS NULL
                        GROUP BY prospecto_id
                    ) pol_max ON pol1.prospecto_id = pol_max.prospecto_id 
                                AND pol1.created_at = pol_max.max_created 
                                AND pol1.id = pol_max.max_id
                    WHERE pol1.deleted_at IS NULL
                ) poliza_reciente ON p.id = poliza_reciente.prospecto_id
                
                WHERE ${whereClause}
                ORDER BY COALESCE(p.fecha_hora_registro, p.fecha_registro) DESC, p.id DESC
                LIMIT ? OFFSET ?
            `;
            
            queryParams.push(limit, offset);
            
            const [prospectos] = await pool.query(query, queryParams);
            
            // Query para contar el total
            const countQuery = `
                SELECT COUNT(DISTINCT p.id) as total
                FROM prospectos p
                LEFT JOIN (
                    SELECT 
                        id_prospecto,
                        id_vendedor,
                        estado,
                        fecha_asignacion,
                        comentario,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                LEFT JOIN users vendedor ON asig.id_vendedor = vendedor.id
                LEFT JOIN users supervisor ON vendedor.supervisor_id = supervisor.id
                WHERE ${whereClause}
            `;
            
            const countParams = queryParams.slice(0, -2); // Remover limit y offset
            const [countResult] = await pool.query(countQuery, countParams);
            const total = countResult[0].total;
            
            return {
                prospectos,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            };
            
        } catch (error) {
            console.error('❌ Error al obtener prospectos:', error);
            throw error;
        }
    }
    
    // ✅ Obtener detalles completos de un prospecto específico
    static async getProspectoById(id) {
        try {
            const query = `
                SELECT 
                    p.*,
                    
                    -- Estado real desde asignaciones
                    asig.estado,
                    asig.fecha_asignacion,
                    asig.comentario as asignacion_comentario,
                    
                    -- Información del vendedor desde asignaciones
                    vendedor.id as vendedor_id,
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
                LEFT JOIN (
                    SELECT 
                        id_prospecto,
                        id_vendedor,
                        estado,
                        fecha_asignacion,
                        comentario,
                        ROW_NUMBER() OVER (PARTITION BY id_prospecto ORDER BY fecha_asignacion DESC) as rn
                    FROM asignaciones
                ) asig ON p.id = asig.id_prospecto AND asig.rn = 1
                LEFT JOIN users vendedor ON asig.id_vendedor = vendedor.id
                LEFT JOIN users supervisor ON vendedor.supervisor_id = supervisor.id
                WHERE p.id = ?
            `;
            
            const [result] = await pool.query(query, [id]);
            
            if (!result || result.length === 0) {
                return null;
            }
            
            const prospecto = result[0];
            
            // Obtener historial de acciones
            const accionesQuery = `
                SELECT 
                    ha.*,
                    u.first_name as ejecutor_nombre,
                    u.last_name as ejecutor_apellido
                FROM historial_acciones ha
                LEFT JOIN users u ON ha.id_vendedor = u.id
                WHERE ha.id_prospecto = ?
                ORDER BY ha.fecha DESC
            `;
            
            const [acciones] = await pool.query(accionesQuery, [id]);
            
            // Obtener cotizaciones
            const cotizacionesQuery = `
                SELECT 
                    c.*,
                    p.nombre as plan_nombre,
                    p.descripcion as plan_descripcion
                FROM cotizaciones c
                LEFT JOIN planes p ON c.plan_id = p.id
                WHERE c.prospecto_id = ?
                ORDER BY c.fecha DESC
            `;
            
            const [cotizaciones] = await pool.query(cotizacionesQuery, [id]);
            
            // Obtener pólizas
            const polizasQuery = `
                SELECT 
                    pol.*,
                    c.total_final as cotizacion_monto
                FROM polizas pol
                LEFT JOIN cotizaciones c ON pol.cotizacion_id = c.id
                WHERE pol.prospecto_id = ? AND pol.deleted_at IS NULL
                ORDER BY pol.created_at DESC
            `;
            
            const [polizas] = await pool.query(polizasQuery, [id]);
            
            return {
                ...prospecto,
                acciones,
                cotizaciones,
                polizas
            };
            
        } catch (error) {
            console.error('❌ Error al obtener prospecto por ID:', error);
            throw error;
        }
    }
    
    // ✅ Obtener estadísticas generales de prospectos para el dashboard
    static async getEstadisticasProspectos() {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT p.id) as total_prospectos,
                    COUNT(DISTINCT CASE WHEN p.fecha_registro >= CURDATE() THEN p.id END) as prospectos_hoy,
                    COUNT(DISTINCT CASE WHEN p.fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN p.id END) as prospectos_semana,
                    COUNT(DISTINCT CASE WHEN p.fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN p.id END) as prospectos_mes,
                    
                    -- Por estado
                    COUNT(DISTINCT CASE WHEN p.estado = 'Lead' THEN p.id END) as leads,
                    COUNT(DISTINCT CASE WHEN p.estado = '1º Contacto' THEN p.id END) as primer_contacto,
                    COUNT(DISTINCT CASE WHEN p.estado = 'Calificado Cotización' THEN p.id END) as calificado_cotizacion,
                    COUNT(DISTINCT CASE WHEN p.estado = 'Calificado Póliza' THEN p.id END) as calificado_poliza,
                    -- ✅ MODIFICADO: Contar ventas desde tabla asignaciones (estado = 'Venta')
                    COUNT(DISTINCT CASE WHEN a.estado = 'Venta' THEN a.id_prospecto END) as ventas,
                    
                    -- Con cotizaciones
                    COUNT(DISTINCT CASE WHEN cotizaciones_count.prospecto_id IS NOT NULL THEN p.id END) as con_cotizaciones,
                    
                    -- Con pólizas
                    COUNT(DISTINCT CASE WHEN polizas_count.prospecto_id IS NOT NULL THEN p.id END) as con_polizas,
                    
                    -- ✅ MODIFICADO: WhatsApp respondidas (conversaciones con mensajes recibidos de la tabla chat_mensajes)
                    COUNT(DISTINCT CASE WHEN cm.tipo = 'recibido' THEN cm.conversacion_id END) as whatsapp_activo
                    
                FROM prospectos p
                
                LEFT JOIN asignaciones a ON p.id = a.id_prospecto
                
                LEFT JOIN (
                    SELECT DISTINCT prospecto_id
                    FROM cotizaciones
                ) cotizaciones_count ON p.id = cotizaciones_count.prospecto_id
                
                LEFT JOIN (
                    SELECT DISTINCT prospecto_id
                    FROM polizas
                    WHERE deleted_at IS NULL
                ) polizas_count ON p.id = polizas_count.prospecto_id
                
                LEFT JOIN chat_conversaciones_whatsapp cc ON p.id = cc.prospecto_id
                LEFT JOIN chat_mensajes cm ON cc.id = cm.conversacion_id AND cm.tipo = 'recibido'
            `;
            
            const [result] = await pool.query(query);
            return result[0];
            
        } catch (error) {
            console.error('❌ Error al obtener estadísticas de prospectos:', error);
            throw error;
        }
    }
    
    // ✅ Obtener filtros disponibles (vendedores, supervisores, estados)
    static async getFiltrosDisponibles() {
        try {
            // Obtener vendedores activos con prospectos (solo rol 1 = Vendedor)
            const vendedoresQuery = `
                SELECT DISTINCT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    COUNT(DISTINCT a.id_prospecto) as prospectos_count
                FROM users u
                LEFT JOIN asignaciones a ON u.id = a.id_vendedor
                WHERE u.role = 1 AND u.is_enabled = 1
                GROUP BY u.id, u.first_name, u.last_name, u.email
                ORDER BY u.first_name, u.last_name
            `;
            
            // Obtener supervisores activos (solo rol 2 = Supervisor)
            const supervisoresQuery = `
                SELECT DISTINCT
                    s.id,
                    s.first_name,
                    s.last_name,
                    s.email,
                    COUNT(DISTINCT a.id_prospecto) as prospectos_count
                FROM users s
                INNER JOIN users v ON s.id = v.supervisor_id
                LEFT JOIN asignaciones a ON v.id = a.id_vendedor
                WHERE s.role = 2 AND s.is_enabled = 1
                GROUP BY s.id, s.first_name, s.last_name, s.email
                ORDER BY s.first_name, s.last_name
            `;
            
            // Obtener estados disponibles
            const estadosQuery = `
                SELECT 
                    estado,
                    COUNT(*) as count
                FROM prospectos
                GROUP BY estado
                ORDER BY count DESC
            `;
            
            const [vendedores] = await pool.query(vendedoresQuery);
            const [supervisores] = await pool.query(supervisoresQuery);
            const [estados] = await pool.query(estadosQuery);
            
            return {
                vendedores,
                supervisores,
                estados
            };
            
        } catch (error) {
            console.error('❌ Error al obtener filtros disponibles:', error);
            throw error;
        }
    }
    
    // ✅ Asignar prospecto a un vendedor diferente
    static async asignarVendedor(prospecto_id, nuevo_vendedor_id, admin_id) {
        try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();
            
            try {
                // Verificar que el nuevo vendedor existe y es rol 1 (Vendedor)
                const [vendedorValido] = await connection.query(
                    'SELECT id FROM users WHERE id = ? AND role = 1 AND is_enabled = 1',
                    [nuevo_vendedor_id]
                );
                
                if (!vendedorValido || vendedorValido.length === 0) {
                    throw new Error('El vendedor seleccionado no es válido o no está activo');
                }
                
                // Obtener información actual del prospecto
                const [prospectoActual] = await connection.query(
                    'SELECT * FROM prospectos WHERE id = ?',
                    [prospecto_id]
                );
                
                if (!prospectoActual || prospectoActual.length === 0) {
                    throw new Error('Prospecto no encontrado');
                }
                
                // Obtener asignación anterior con FOR UPDATE para evitar race conditions
                const [asignacionAnterior] = await connection.query(
                    'SELECT id, id_vendedor FROM asignaciones WHERE id_prospecto = ? ORDER BY fecha_asignacion DESC, id DESC LIMIT 1 FOR UPDATE',
                    [prospecto_id]
                );
                
                const vendedor_anterior = asignacionAnterior.length > 0 ? asignacionAnterior[0].id_vendedor : null;
                
                if (asignacionAnterior.length > 0) {
                    // Actualizar la asignación existente en lugar de crear una nueva
                    // visible_refrito = 1: si el prospecto es un refrito (es_reciclado=1), garantiza
                    // que la reasignación manual lo haga visible de inmediato en el dashboard del
                    // nuevo vendedor (ver filtro en prospectoModel.js findAll).
                    await connection.query(
                        `UPDATE asignaciones
                         SET id_vendedor = ?, asignado_por = ?, estado = 'Lead', fecha_asignacion = NOW(), comentario = 'Reasignado desde BackOffice', visible_refrito = 1
                         WHERE id = ?`,
                        [nuevo_vendedor_id, admin_id, asignacionAnterior[0].id]
                    );
                } else {
                    // Segunda defensa: intentar UPDATE directo antes de insertar
                    const [updateResult] = await connection.query(
                        `UPDATE asignaciones
                         SET id_vendedor = ?, asignado_por = ?, estado = 'Lead', fecha_asignacion = NOW(), comentario = 'Reasignado desde BackOffice', visible_refrito = 1
                         WHERE id_prospecto = ?
                         ORDER BY fecha_asignacion DESC, id DESC
                         LIMIT 1`,
                        [nuevo_vendedor_id, admin_id, prospecto_id]
                    );
                    // Solo insertar si realmente no existía ninguna asignación
                    if (updateResult.affectedRows === 0) {
                        await connection.query(
                            `INSERT INTO asignaciones (id_prospecto, id_vendedor, asignado_por, estado, fecha_asignacion, comentario, visible_refrito)
                             VALUES (?, ?, ?, 'Lead', NOW(), 'Reasignado desde BackOffice', 1)`,
                            [prospecto_id, nuevo_vendedor_id, admin_id]
                        );
                    }
                }
                
                // Registrar la acción en el historial
                await connection.query(
                    `INSERT INTO historial_acciones (id_prospecto, id_vendedor, accion, descripcion, fecha)
                     VALUES (?, ?, ?, ?, NOW())`,
                    [
                        prospecto_id,
                        admin_id,
                        'Reasignación',
                        `Prospecto reasignado del vendedor ID ${vendedor_anterior} al vendedor ID ${nuevo_vendedor_id} por admin`
                    ]
                );
                
                await connection.commit();
                connection.release();
                return { success: true };
                
            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }
            
        } catch (error) {
            console.error('❌ Error al asignar vendedor:', error);
            throw error;
        }
    }
}

module.exports = ProspectosBackOffice;
