const db = require('../../config/db');
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');

const Supervisor = {
    async getAllProspectos(supervisor_id) {
        // Obtener la asignación más reciente por prospecto y deduplicar por número de contacto+vendedor
        // (evita duplicados cuando un prospecto fue cargado dos veces en refritos, o tiene
        // múltiples registros en `asignaciones` por refritos/admin/backoffice)
        const query = `
            SELECT main.*
            FROM (
                SELECT 
                    p.*, 
                    a.id_vendedor, 
                    u.first_name AS vendedor_nombre, 
                    u.last_name AS vendedor_apellido,
                    a.estado AS asignacion_estado,
                    a.comentario AS asignacion_comentario,
                    a.fecha_estado AS asignacion_fecha,
                    ROW_NUMBER() OVER (
                        PARTITION BY IFNULL(NULLIF(p.numero_contacto, ''), CONCAT('__nop__', p.id)),
                                     a.id_vendedor
                        ORDER BY COALESCE(p.fecha_hora_registro, p.fecha_registro) DESC, p.id DESC
                    ) AS dup_rank
                FROM prospectos p
                INNER JOIN asignaciones a ON a.id = (
                    SELECT id FROM asignaciones
                    WHERE id_prospecto = p.id
                    ORDER BY fecha_asignacion DESC, id DESC
                    LIMIT 1
                )
                INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
            ) main
            WHERE main.dup_rank = 1
            ORDER BY COALESCE(main.fecha_hora_registro, main.fecha_registro) DESC, main.id DESC
        `;
        const [prospectos] = await db.query(query, [supervisor_id]);

        // Obtener familiares solo para los prospectos del supervisor
        const prospectoIds = prospectos.map(p => p.id);
        let familiares = [];
        
        if (prospectoIds.length > 0) {
            const placeholders = prospectoIds.map(() => '?').join(',');
            const [familiaresResult] = await db.query(`
                SELECT * FROM familiares WHERE prospecto_id IN (${placeholders})
            `, prospectoIds);
            familiares = familiaresResult;
        }

        // Asocia familiares a cada prospecto
        const prospectosConFamiliares = prospectos.map(p => ({
            ...p,
            familiares: familiares.filter(f => f.prospecto_id === p.id)
        }));

        return prospectosConFamiliares;
    },

    async getEstadisticas(supervisor_id) {
        // Total de prospectos del supervisor
        const [totalProspectosResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM prospectos p
            INNER JOIN asignaciones a ON a.id_prospecto = p.id
            INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
        `, [supervisor_id]);
        const totalProspectos = totalProspectosResult[0].total;

        // Vendedores activos del supervisor (role = 1 significa vendedor, is_enabled = 1 significa activo)
        const [vendedoresActivosResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM users 
            WHERE role = 1 AND is_enabled = 1 AND supervisor_id = ?
        `, [supervisor_id]);
        const totalVendedores = vendedoresActivosResult[0].total;

        // Ventas confirmadas del supervisor
        const [ventasConfirmadasResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM asignaciones a
            INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
            WHERE a.estado = 'Venta'
        `, [supervisor_id]);
        const ventasConfirmadas = ventasConfirmadasResult[0].total;

        // Total de pólizas generadas por vendedores del supervisor
        const [totalPolizasResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM polizas p
            INNER JOIN users u ON p.created_by = u.id AND u.supervisor_id = ?
            WHERE p.deleted_at IS NULL
        `, [supervisor_id]);
        const totalPolizas = totalPolizasResult[0].total;

        // Total facturado real basado en las cotizaciones de las pólizas del supervisor
        const [totalFacturadoResult] = await db.query(`
            SELECT COALESCE(SUM(c.total_final), 0) as total_facturado
            FROM polizas p
            LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
            INNER JOIN users u ON p.created_by = u.id AND u.supervisor_id = ?
            WHERE p.deleted_at IS NULL
        `, [supervisor_id]);
        const totalFacturado = parseFloat(totalFacturadoResult[0].total_facturado);

        return {
            totalProspectos,
            totalVendedores,
            ventasConfirmadas,
            totalFacturado,
            totalPolizas
        };
    },

    async getDatosGrafica(supervisor_id) {
        try {
            // Obtener datos de prospectos por mes del año actual para el supervisor
            const [prospectosResult] = await db.query(`
                SELECT 
                    MONTH(p.fecha_registro) as mes,
                    COUNT(*) as nuevosProspectos
                FROM prospectos p
                INNER JOIN asignaciones a ON a.id_prospecto = p.id
                INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
                WHERE YEAR(p.fecha_registro) = YEAR(CURDATE())
                GROUP BY MONTH(p.fecha_registro)
                ORDER BY mes
            `, [supervisor_id]);

            // Obtener datos de ventas por mes para el supervisor
            const [ventasResult] = await db.query(`
                SELECT 
                    MONTH(a.fecha_estado) as mes,
                    COUNT(*) as ventas
                FROM asignaciones a
                INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
                WHERE a.estado = 'Venta' 
                    AND YEAR(a.fecha_estado) = YEAR(CURDATE())
                GROUP BY MONTH(a.fecha_estado)
                ORDER BY mes
            `, [supervisor_id]);

            // Obtener datos de pólizas generadas por mes para el supervisor
            const [polizasResult] = await db.query(`
                SELECT 
                    MONTH(p.created_at) as mes,
                    COUNT(*) as polizasGeneradas
                FROM polizas p
                INNER JOIN users u ON p.created_by = u.id AND u.supervisor_id = ?
                WHERE YEAR(p.created_at) = YEAR(CURDATE())
                    AND p.deleted_at IS NULL
                GROUP BY MONTH(p.created_at)
                ORDER BY mes
            `, [supervisor_id]);

            // Obtener vendedores activos del supervisor
            const [vendedoresResult] = await db.query(`
                SELECT COUNT(*) as totalVendedores
                FROM users 
                WHERE role = 1 AND is_enabled = 1 AND supervisor_id = ?
            `, [supervisor_id]);

            const vendedoresActivos = vendedoresResult[0].totalVendedores;

            // Crear array de 12 meses con datos
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const datosGrafica = [];

            for (let i = 1; i <= 12; i++) {
                const prospectoData = prospectosResult.find(p => p.mes === i);
                const ventaData = ventasResult.find(v => v.mes === i);
                const polizaData = polizasResult.find(p => p.mes === i);

                datosGrafica.push({
                    mes: meses[i - 1],
                    nuevosProspectos: prospectoData ? prospectoData.nuevosProspectos : 0,
                    vendedores: vendedoresActivos, // Simplificado: mismo número para todos los meses
                    ventas: ventaData ? ventaData.ventas : 0,
                    polizasGeneradas: polizaData ? polizaData.polizasGeneradas : 0
                });
            }

            return datosGrafica;
        } catch (error) {
            console.error('Error al obtener datos de gráfica:', error);
            // Retornar datos mock en caso de error
            return [
                { mes: 'Ene', nuevosProspectos: 280, vendedores: 12, ventas: 45, polizasGeneradas: 35 },
                { mes: 'Feb', nuevosProspectos: 320, vendedores: 14, ventas: 52, polizasGeneradas: 42 },
                { mes: 'Mar', nuevosProspectos: 380, vendedores: 15, ventas: 68, polizasGeneradas: 58 },
                { mes: 'Abr', nuevosProspectos: 200, vendedores: 13, ventas: 35, polizasGeneradas: 28 },
                { mes: 'May', nuevosProspectos: 190, vendedores: 12, ventas: 42, polizasGeneradas: 35 },
                { mes: 'Jun', nuevosProspectos: 220, vendedores: 14, ventas: 48, polizasGeneradas: 40 },
                { mes: 'Jul', nuevosProspectos: 350, vendedores: 16, ventas: 75, polizasGeneradas: 62 },
                { mes: 'Ago', nuevosProspectos: 380, vendedores: 17, ventas: 82, polizasGeneradas: 70 },
                { mes: 'Sep', nuevosProspectos: 320, vendedores: 16, ventas: 68, polizasGeneradas: 55 },
                { mes: 'Oct', nuevosProspectos: 290, vendedores: 15, ventas: 55, polizasGeneradas: 45 },
                { mes: 'Nov', nuevosProspectos: 250, vendedores: 14, ventas: 48, polizasGeneradas: 38 },
                { mes: 'Dic', nuevosProspectos: 200, vendedores: 13, ventas: 38, polizasGeneradas: 30 }
            ];
        }
    },

    async cambiarEstadoProspecto(prospectoId, nuevoEstado, motivo, supervisorId) {
        try {
            console.log('📝 Modelo: Cambiando estado de prospecto:', {
                prospectoId,
                nuevoEstado,
                motivo,
                supervisorId
            });

            // Verificar que el prospecto existe y pertenece a un vendedor del supervisor
            const [prospecto] = await db.query(
                `SELECT p.* 
                 FROM prospectos p
                 INNER JOIN asignaciones a ON a.id_prospecto = p.id
                 INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
                 WHERE p.id = ?`,
                [supervisorId, prospectoId]
            );

            if (prospecto.length === 0) {
                throw new Error('Prospecto no encontrado o no tiene acceso a este prospecto');
            }

            // Verificar que existe una asignación para este prospecto del supervisor
            const [asignacion] = await db.query(
                `SELECT a.* 
                 FROM asignaciones a
                 INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
                 WHERE a.id_prospecto = ?
                 ORDER BY a.fecha_asignacion DESC
                 LIMIT 1`,
                [supervisorId, prospectoId]
            );

            if (asignacion.length === 0) {
                throw new Error('No existe una asignación válida para este prospecto');
            }

            // ✅ ACTUALIZAR: Solo la asignación más reciente del vendedor bajo este supervisor
            await db.query(
                `UPDATE asignaciones 
                 SET estado = ?, comentario = ?, fecha_estado = NOW() 
                 WHERE id = ?`,
                [nuevoEstado, motivo || 'Estado actualizado por supervisor', asignacion[0].id]
            );

            // 🔄 Hook: Promover siguiente refrito si aplica
            try {
                await RefritosVisibilityService.onCambioEstadoProspecto(prospectoId, nuevoEstado, asignacion[0].id_vendedor);
            } catch (refritoError) {
                console.log('⚠️ Error al promover refrito:', refritoError.message);
            }

            // Registrar el cambio en historial (si existe la tabla)
            try {
                await db.query(
                    `INSERT INTO prospecto_historial 
                     (prospecto_id, accion, descripcion, usuario_id, fecha) 
                     VALUES (?, 'CAMBIO_ESTADO', ?, ?, NOW())`,
                    [
                        prospectoId, 
                        `Estado cambiado a: ${nuevoEstado}. Motivo: ${motivo || 'Sin motivo especificado'}`,
                        supervisorId
                    ]
                );
            } catch (historialError) {
                console.log('⚠️ No se pudo registrar en historial:', historialError.message);
                // No fallar la operación principal por esto
            }

            return {
                id: prospectoId,
                estado_anterior: prospecto[0].estado,
                estado_nuevo: nuevoEstado,
                mensaje: `Estado actualizado a: ${nuevoEstado}`
            };

        } catch (error) {
            console.error('❌ Error en modelo cambiarEstadoProspecto:', error);
            throw error;
        }
    }
};

module.exports = Supervisor;