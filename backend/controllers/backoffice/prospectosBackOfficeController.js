const ProspectosBackOffice = require('../../models/backoffice/prospectosBackOfficeModel');
const Admin = require('../../models/admin/adminModel');
const validator = require('validator');
const NotificationsService = require('../../services/notificationsService');
const db = require('../../config/db');

class ProspectosBackOfficeController {
    
    // ✅ Obtener lista de prospectos con paginación y filtros
    static async getProspectos(req, res) {
        try {
            const {
                page = 1,
                limit = 50,
                id = '',
                search = '',
                estado = '',
                vendedor_id = '',
                supervisor_id = '',
                fecha_desde = '',
                fecha_hasta = ''
            } = req.query;

            // Validaciones
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Parámetros de paginación inválidos'
                });
            }

            if (id && !validator.isInt(id.toString(), { min: 1 })) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de prospecto inválido'
                });
            }

            // Validar fechas si se proporcionan
            if (fecha_desde && !validator.isDate(fecha_desde)) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de fecha_desde inválido'
                });
            }

            if (fecha_hasta && !validator.isDate(fecha_hasta)) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de fecha_hasta inválido'
                });
            }

            const filtros = {
                page: pageNum,
                limit: limitNum,
                id: id ? parseInt(id) : '',
                search: search.trim(),
                estado: estado.trim(),
                vendedor_id: vendedor_id ? parseInt(vendedor_id) : '',
                supervisor_id: supervisor_id ? parseInt(supervisor_id) : '',
                fecha_desde: fecha_desde.trim(),
                fecha_hasta: fecha_hasta.trim()
            };

            console.log('🔍 Obteniendo prospectos con filtros:', filtros);

            const resultado = await ProspectosBackOffice.getAllProspectos(filtros);

            console.log(`✅ Se encontraron ${resultado.prospectos.length} prospectos de ${resultado.pagination.total} totales`);

            return res.status(200).json({
                success: true,
                message: 'Prospectos obtenidos exitosamente',
                data: resultado.prospectos,
                pagination: resultado.pagination,
                filtros_aplicados: filtros
            });

        } catch (error) {
            console.error('❌ Error al obtener prospectos:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener prospectos',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Obtener historial de un prospecto (acciones)
    static async getProspectoHistorial(req, res) {
        try {
            const { id } = req.params;

            if (!id || !validator.isInt(id.toString(), { min: 1 })) {
                return res.status(400).json({ success: false, message: 'ID de prospecto inválido' });
            }

            const historial = await Admin.getProspectoHistorial(parseInt(id));
            return res.status(200).json({ success: true, data: historial });
        } catch (error) {
            console.error('❌ Error al obtener historial del prospecto:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener historial',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Obtener cotizaciones de un prospecto (con detalles)
    static async getProspectoCotizaciones(req, res) {
        try {
            const { id } = req.params;

            if (!id || !validator.isInt(id.toString(), { min: 1 })) {
                return res.status(400).json({ success: false, message: 'ID de prospecto inválido' });
            }

            const cotizaciones = await Admin.getProspectoCotizaciones(parseInt(id));
            return res.status(200).json({ success: true, data: cotizaciones });
        } catch (error) {
            console.error('❌ Error al obtener cotizaciones del prospecto:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener cotizaciones',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Cambiar estado de un prospecto (y registrar notas)
    static async cambiarEstadoProspecto(req, res) {
        try {
            const { id } = req.params;
            const { estado, notas } = req.body;
            const adminId = req.user.id;
            const GoogleSheetsService = require('../../services/googleSheetsService');

            if (!id || !validator.isInt(id.toString(), { min: 1 })) {
                return res.status(400).json({ success: false, message: 'ID de prospecto inválido' });
            }

            const estadosValidos = [
                'Lead', '1º Contacto', 'WhatsApp enviado', 'Llamada telefónica', 'Conversación iniciada por WhatsApp',
                'Promoción aplicada', 'Calificado Cotización', 'Calificado Póliza',
                'Calificado Pago', 'Póliza iniciada', 'Póliza generada', 'Póliza enviada a supervisor',
                'Póliza pendiente a firma', 'Póliza firmada', 'Venta', 'Fuera de zona', 'Fuera de edad',
                'Preexistencia', 'Reafiliación', 'No contesta', 'prueba interna',
                'Ya es socio', 'Busca otra Cobertura', 'Teléfono erróneo',
                'No le interesa (económico)', 'No le interesa cartilla', 'No busca cobertura médica'
            ];

            if (!estado || !estadosValidos.includes(estado)) {
                return res.status(400).json({ success: false, message: 'Estado no válido', estados_validos: estadosValidos });
            }

            const resultado = await Admin.cambiarEstadoProspecto(parseInt(id), estado, notas, adminId);
            
            // 📊 SINCRONIZAR CON GOOGLE SHEETS (actualizar estado)
            try {
                await GoogleSheetsService.actualizarAsignacionEnSheet(parseInt(id));
                console.log(`📊 Estado actualizado en Google Sheets para prospecto ${id}`);
            } catch (sheetsError) {
                console.error('⚠️ Error sincronizando actualización de estado con Google Sheets:', sheetsError.message);
                // No fallar la actualización del prospecto si la sincronización falla
            }
            
            return res.status(200).json({ success: true, data: resultado, message: 'Estado actualizado correctamente' });
        } catch (error) {
            console.error('❌ Error al cambiar estado del prospecto:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al cambiar estado',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ WhatsApp: Conversaciones por teléfono
    static async getConversacionesPorTelefono(req, res) {
        try {
            const { telefono } = req.params;
            if (!telefono) {
                return res.status(400).json({ success: false, message: 'El teléfono es requerido' });
            }
            const conversaciones = await Admin.getConversacionesPorTelefono(telefono);
            return res.status(200).json({ success: true, data: conversaciones, total: conversaciones.length });
        } catch (error) {
            console.error('❌ Error al obtener conversaciones de WhatsApp:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener conversaciones',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ WhatsApp: Mensajes de una conversación
    static async getMensajesConversacion(req, res) {
        try {
            const { conversacionId } = req.params;
            if (!conversacionId || !validator.isInt(conversacionId.toString(), { min: 1 })) {
                return res.status(400).json({ success: false, message: 'ID de conversación inválido' });
            }
            const mensajes = await Admin.getMensajesConversacion(parseInt(conversacionId));
            return res.status(200).json({ success: true, data: mensajes, total: mensajes.length });
        } catch (error) {
            console.error('❌ Error al obtener mensajes de la conversación:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener mensajes',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Obtener detalles completos de un prospecto específico
    static async getProspectoById(req, res) {
        try {
            const { id } = req.params;

            // Validar ID
            if (!id || !validator.isInt(id.toString(), { min: 1 })) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de prospecto inválido'
                });
            }

            console.log(`🔍 Obteniendo detalles del prospecto ID: ${id}`);

            const prospecto = await ProspectosBackOffice.getProspectoById(parseInt(id));

            if (!prospecto) {
                return res.status(404).json({
                    success: false,
                    message: 'Prospecto no encontrado'
                });
            }

            console.log(`✅ Detalles del prospecto ${id} obtenidos exitosamente`);

            return res.status(200).json({
                success: true,
                message: 'Detalles del prospecto obtenidos exitosamente',
                data: prospecto
            });

        } catch (error) {
            console.error('❌ Error al obtener detalles del prospecto:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener detalles del prospecto',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Obtener estadísticas generales de prospectos
    static async getEstadisticas(req, res) {
        try {
            console.log('📊 Obteniendo estadísticas de prospectos...');

            const estadisticas = await ProspectosBackOffice.getEstadisticasProspectos();

            console.log('✅ Estadísticas de prospectos obtenidas exitosamente');

            return res.status(200).json({
                success: true,
                message: 'Estadísticas obtenidas exitosamente',
                data: estadisticas
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener estadísticas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Obtener filtros disponibles (vendedores, supervisores, estados)
    static async getFiltros(req, res) {
        try {
            console.log('🔧 Obteniendo filtros disponibles...');

            const filtros = await ProspectosBackOffice.getFiltrosDisponibles();

            console.log('✅ Filtros disponibles obtenidos exitosamente');

            return res.status(200).json({
                success: true,
                message: 'Filtros disponibles obtenidos exitosamente',
                data: filtros
            });

        } catch (error) {
            console.error('❌ Error al obtener filtros:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener filtros',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Asignar prospecto a un vendedor diferente
    static async asignarVendedor(req, res) {
        try {
            const { id } = req.params; // ID del prospecto
            const { vendedor_id } = req.body; // Nuevo vendedor
            const admin_id = req.user.id; // ID del admin que hace la reasignación

            // Validaciones
            if (!id || !validator.isInt(id.toString(), { min: 1 })) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de prospecto inválido'
                });
            }

            if (!vendedor_id || !validator.isInt(vendedor_id.toString(), { min: 1 })) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de vendedor inválido'
                });
            }

            console.log(`🔄 Reasignando prospecto ${id} al vendedor ${vendedor_id} por admin ${admin_id}`);

            const resultado = await ProspectosBackOffice.asignarVendedor(
                parseInt(id),
                parseInt(vendedor_id),
                admin_id
            );

            if (resultado.success) {
                console.log(`✅ Prospecto ${id} reasignado exitosamente`);

                // 📤 ENVIAR NOTIFICACIÓN AL NUEVO VENDEDOR
                try {
                    const [prospecto] = await db.query(
                        'SELECT id, nombre, apellido, numero_contacto, estado FROM prospectos WHERE id = ?',
                        [parseInt(id)]
                    );
                    
                    if (prospecto && prospecto.length > 0) {
                        await NotificationsService.notificarAsignacionProspecto(
                            parseInt(vendedor_id),
                            prospecto[0]
                        );
                        console.log(`📱 Notificación de reasignación enviada al vendedor ${vendedor_id}`);
                    }
                } catch (notificationError) {
                    console.error('⚠️ Error al enviar notificación de reasignación:', notificationError.message);
                    // No fallar la reasignación si la notificación falla
                }

                return res.status(200).json({
                    success: true,
                    message: 'Prospecto reasignado exitosamente',
                    data: {
                        prospecto_id: parseInt(id),
                        nuevo_vendedor_id: parseInt(vendedor_id),
                        reasignado_por: admin_id
                    }
                });
            } else {
                throw new Error('No se pudo realizar la reasignación');
            }

        } catch (error) {
            console.error('❌ Error al reasignar prospecto:', error);
            
            if (error.message === 'Prospecto no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: 'Prospecto no encontrado'
                });
            }

            if (error.message === 'El vendedor seleccionado no es válido o no está activo') {
                return res.status(400).json({
                    success: false,
                    message: 'El vendedor seleccionado no es válido o no está activo'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al reasignar prospecto',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // ✅ Exportar prospectos a CSV/Excel
    static async exportarProspectos(req, res) {
        try {
            const {
                formato = 'csv',
                search = '',
                estado = '',
                vendedor_id = '',
                supervisor_id = '',
                fecha_desde = '',
                fecha_hasta = ''
            } = req.query;

            // Validar formato
            if (!['csv', 'excel'].includes(formato)) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de exportación inválido. Use: csv o excel'
                });
            }

            console.log(`📊 Exportando prospectos en formato ${formato}...`);

            // Obtener todos los prospectos (sin paginación para export)
            const filtros = {
                page: 1,
                limit: 10000, // Límite alto para exportar todos
                search: search.trim(),
                estado: estado.trim(),
                vendedor_id: vendedor_id ? parseInt(vendedor_id) : '',
                supervisor_id: supervisor_id ? parseInt(supervisor_id) : '',
                fecha_desde: fecha_desde.trim(),
                fecha_hasta: fecha_hasta.trim()
            };

            const resultado = await ProspectosBackOffice.getAllProspectos(filtros);

            if (resultado.prospectos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No hay prospectos para exportar con los filtros aplicados'
                });
            }

            // Preparar datos para exportación
            const datosExport = resultado.prospectos.map(prospecto => ({
                'ID': prospecto.id,
                'Nombre': prospecto.nombre,
                'Apellido': prospecto.apellido,
                'Email': prospecto.correo || 'N/A',
                'Teléfono': prospecto.numero_contacto || 'N/A',
                'Edad': prospecto.edad || 'N/A',
                'Localidad': prospecto.localidad || 'N/A',
                'Estado': prospecto.estado,
                'Fecha Registro': prospecto.fecha_registro,
                'Vendedor': `${prospecto.vendedor_nombre || 'N/A'} ${prospecto.vendedor_apellido || ''}`.trim(),
                'Supervisor': `${prospecto.supervisor_nombre || 'N/A'} ${prospecto.supervisor_apellido || ''}`.trim(),
                'Cotizaciones': prospecto.cotizaciones_count,
                'Pólizas': prospecto.polizas_count,
                'Acciones': prospecto.acciones_count,
                'Última Acción': prospecto.ultima_accion || 'N/A',
                'Fecha Última Acción': prospecto.ultima_accion_fecha || 'N/A',
                'WhatsApp': prospecto.whatsapp_opt_in ? 'Sí' : 'No'
            }));

            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `prospectos_${timestamp}.${formato}`;

            if (formato === 'csv') {
                const json2csv = require('json2csv').parse;
                const csv = json2csv(datosExport);

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                console.log(`✅ Exportación CSV completada: ${datosExport.length} registros`);
                return res.status(200).send(csv);

            } else if (formato === 'excel') {
                const ExcelJS = require('exceljs');
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Prospectos');

                // Agregar headers
                const headers = Object.keys(datosExport[0]);
                worksheet.addRow(headers);

                // Agregar datos
                datosExport.forEach(row => {
                    worksheet.addRow(Object.values(row));
                });

                // Ajustar ancho de columnas
                worksheet.columns.forEach(column => {
                    column.width = 15;
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

                console.log(`✅ Exportación Excel completada: ${datosExport.length} registros`);
                return workbook.xlsx.write(res).then(() => {
                    res.end();
                });
            }

        } catch (error) {
            console.error('❌ Error al exportar prospectos:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor al exportar prospectos',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = ProspectosBackOfficeController;
