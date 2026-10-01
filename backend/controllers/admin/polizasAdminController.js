const PolizasSupervisorController = require('../supervisor/polizasController');
const db = require('../../config/db');

const PolizasAdminController = {
  // ✅ HEREDAR MÉTODOS DEL SUPERVISOR
  ...PolizasSupervisorController,

  // ✅ SOBRESCRIBIR obtenerPolizas para Admin (con funcionalidades extras)
  async obtenerPolizas(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        estado, 
        vendedor_id,
        supervisor_id, // ✅ NUEVO: Filtrar por supervisor
        desde, 
        hasta, 
        buscar,
        plan,
        incluir_eliminadas = false // ✅ NUEVO: Ver pólizas eliminadas
      } = req.query;

      console.log('👑 Admin obteniendo pólizas con filtros avanzados:', { 
        estado, vendedor_id, supervisor_id, desde, hasta, buscar, plan, incluir_eliminadas
      });

      let whereConditions = ['1=1']; // Admin ve TODAS las pólizas
      let queryParams = [];

      // ✅ NUEVO: Incluir/excluir eliminadas
      if (!incluir_eliminadas || incluir_eliminadas === 'false') {
        whereConditions.push('p.deleted_at IS NULL');
      }

      // Filtrar por estado
      if (estado && estado !== 'todos') {
        whereConditions.push('p.estado = ?');
        queryParams.push(estado);
      }

      // Filtrar por vendedor
      if (vendedor_id && vendedor_id !== 'todos') {
        whereConditions.push('p.created_by = ?');
        queryParams.push(vendedor_id);
      }

      // ✅ NUEVO: Filtrar por supervisor
      if (supervisor_id && supervisor_id !== 'todos') {
        whereConditions.push('p.revisado_por = ?');
        queryParams.push(supervisor_id);
      }

      // Filtrar por fechas
      if (desde) {
        whereConditions.push('DATE(p.created_at) >= ?');
        queryParams.push(desde);
      }

      if (hasta) {
        whereConditions.push('DATE(p.created_at) <= ?');
        queryParams.push(hasta);
      }

      // Filtrar por plan
      if (plan && plan !== 'todos') {
        whereConditions.push('pl.nombre = ?');
        queryParams.push(plan);
      }

      // Búsqueda por texto (más amplia para admin)
      if (buscar) {
        whereConditions.push(`(
          p.numero_poliza LIKE ? OR 
          pr.nombre LIKE ? OR 
          pr.apellido LIKE ? OR 
          pr.numero_contacto LIKE ? OR
          pr.correo LIKE ? OR
          CONCAT(v.first_name, ' ', v.last_name) LIKE ? OR
          CONCAT(s.first_name, ' ', s.last_name) LIKE ? OR
          p.motivo_cambio_estado LIKE ?
        )`);
        const buscarParam = `%${buscar}%`;
        queryParams.push(buscarParam, buscarParam, buscarParam, buscarParam, buscarParam, buscarParam, buscarParam, buscarParam);
      }

      const whereClause = whereConditions.join(' AND ');
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // ✅ QUERY EXPANDIDA PARA ADMIN
      const query = `
        SELECT 
          p.id,
          p.numero_poliza,
          p.estado,
          p.estado_anterior,
          p.created_at,
          p.updated_at,
          p.fecha_finalizacion,
          p.fecha_cambio_estado,
          p.motivo_cambio_estado,
          p.deleted_at, -- ✅ Para admin
          p.pdf_hash, -- ✅ HASH PARA DESCARGA DIRECTA
          -- Datos del prospecto
          pr.nombre as prospecto_nombre,
          pr.apellido as prospecto_apellido,
          pr.numero_contacto as prospecto_telefono,
          pr.correo as prospecto_email,
          pr.edad as prospecto_edad,
          pr.localidad as prospecto_localidad,
          -- Datos de la cotización
          pl.nombre as plan_nombre,
          c.total_bruto,
          c.total_descuento_aporte,
          c.total_descuento_promocion,
          c.total_final as cotizacion_total,
          c.anio as anio_plan,
          -- Datos del tipo de afiliación
          ta.etiqueta as tipo_afiliacion_nombre,
          -- Datos del vendedor
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido,
          v.email as vendedor_email,
          -- ✅ NUEVO: Datos del supervisor
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          s.email as supervisor_email,
          -- ✅ NUEVO: Conteo de documentos
          (SELECT COUNT(*) FROM poliza_documentos pd WHERE pd.poliza_id = p.id) as total_documentos
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
        LEFT JOIN users v ON p.created_by = v.id
        LEFT JOIN users s ON p.revisado_por = s.id
        WHERE ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), offset);

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
        LEFT JOIN users v ON p.created_by = v.id
        LEFT JOIN users s ON p.revisado_por = s.id
        WHERE ${whereClause}
      `;

      const countParams = queryParams.slice(0, -2);

      // Ejecutar queries
      const [polizas] = await db.execute(query, queryParams);
      const [countResult] = await db.execute(countQuery, countParams);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / parseInt(limit));

      // ✅ FORMATEAR RESPUESTA EXPANDIDA PARA ADMIN
      const polizasFormateadas = polizas.map(poliza => ({
        id: poliza.id,
        numero_poliza: poliza.numero_poliza,
        pdf_hash: poliza.pdf_hash, // ✅ AGREGADO PARA DESCARGA PDF UNIFICADA
        estado: poliza.estado,
        estado_anterior: poliza.estado_anterior,
        created_at: poliza.created_at,
        updated_at: poliza.updated_at,
        fecha_finalizacion: poliza.fecha_finalizacion,
        fecha_cambio_estado: poliza.fecha_cambio_estado,
        motivo_cambio_estado: poliza.motivo_cambio_estado,
        deleted_at: poliza.deleted_at, // ✅ Para mostrar si está eliminada
        // Datos del prospecto
        prospecto_nombre: poliza.prospecto_nombre,
        prospecto_apellido: poliza.prospecto_apellido,
        prospecto_telefono: poliza.prospecto_telefono,
        prospecto_email: poliza.prospecto_email,
        prospecto_edad: poliza.prospecto_edad,
        prospecto_localidad: poliza.prospecto_localidad,
        // Datos del plan
        plan_nombre: poliza.plan_nombre,
        anio_plan: poliza.anio_plan,
        total_bruto: poliza.total_bruto,
        total_descuento_aporte: poliza.total_descuento_aporte,
        total_descuento_promocion: poliza.total_descuento_promocion,
        total_final: poliza.cotizacion_total,
        // Datos adicionales
        tipo_afiliacion: poliza.tipo_afiliacion_nombre,
        total_documentos: poliza.total_documentos, // ✅ NUEVO
        vendedor: {
          nombre: poliza.vendedor_nombre,
          apellido: poliza.vendedor_apellido,
          email: poliza.vendedor_email
        },
        // ✅ NUEVO: Información del supervisor
        supervisor: poliza.supervisor_nombre ? {
          nombre: poliza.supervisor_nombre,
          apellido: poliza.supervisor_apellido,
          email: poliza.supervisor_email
        } : null,
        urls: {
          pdf: `${process.env.BASE_URL || `https://${process.env.DOMAIN}`}/api/polizas/${poliza.id}/pdf`,
          detalle: `${process.env.BASE_URL || `https://${process.env.DOMAIN}`}/api/polizas/${poliza.id}`,
          historial: `${process.env.BASE_URL || `https://${process.env.DOMAIN}`}/api/admin/polizas/${poliza.id}/historial` // ✅ NUEVO
        }
      }));

      res.json({
        success: true,
        data: polizasFormateadas,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: totalPages,
          has_more: parseInt(page) < totalPages
        },
        filters_applied: {
          estado: estado || 'todos',
          vendedor_id: vendedor_id || 'todos',
          supervisor_id: supervisor_id || 'todos', // ✅ NUEVO
          plan: plan || 'todos',
          incluir_eliminadas: incluir_eliminadas === 'true', // ✅ NUEVO
          desde,
          hasta,
          buscar
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo pólizas del admin:', error);
      res.status(500).json({ 
        error: 'Error obteniendo pólizas',
        message: error.message 
      });
    }
  },

  // ✅ ESTADÍSTICAS AVANZADAS PARA ADMIN
  async obtenerEstadisticasAvanzadas(req, res) {
    try {
      const { periodo = 'mes' } = req.query;

      let fechaFiltro = '';
      switch (periodo) {
        case 'dia':
          fechaFiltro = 'DATE(p.created_at) = CURDATE()';
          break;
        case 'semana':
          fechaFiltro = 'YEARWEEK(p.created_at) = YEARWEEK(NOW())';
          break;
        case 'mes':
          fechaFiltro = 'YEAR(p.created_at) = YEAR(NOW()) AND MONTH(p.created_at) = MONTH(NOW())';
          break;
        case 'año':
          fechaFiltro = 'YEAR(p.created_at) = YEAR(NOW())';
          break;
        default:
          fechaFiltro = 'YEAR(p.created_at) = YEAR(NOW()) AND MONTH(p.created_at) = MONTH(NOW())';
      }

      // ✅ ESTADÍSTICAS COMPLETAS PARA ADMIN
      const statsQuery = `
        SELECT 
          COUNT(*) as total_polizas,
          COUNT(CASE WHEN p.estado = 'activa' THEN 1 END) as polizas_activas,
          COUNT(CASE WHEN p.estado = 'borrador' THEN 1 END) as polizas_borrador,
          COUNT(CASE WHEN p.estado = 'pendiente_revision' THEN 1 END) as polizas_pendiente_revision,
          COUNT(CASE WHEN p.estado = 'en_revision' THEN 1 END) as polizas_en_revision,
          COUNT(CASE WHEN p.estado = 'rechazada' THEN 1 END) as polizas_rechazadas,
          COUNT(CASE WHEN p.estado = 'cancelada' THEN 1 END) as polizas_canceladas,
          COUNT(CASE WHEN p.deleted_at IS NOT NULL THEN 1 END) as polizas_eliminadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          COALESCE(AVG(c.total_final), 0) as ticket_promedio,
          COUNT(DISTINCT p.created_by) as vendedores_activos,
          COUNT(DISTINCT p.revisado_por) as supervisores_activos,
          -- ✅ NUEVAS MÉTRICAS
          COUNT(CASE WHEN p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as polizas_ultima_semana,
          COUNT(CASE WHEN p.fecha_cambio_estado >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as cambios_estado_24h
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE ${fechaFiltro}
      `;

      // ✅ PERFORMANCE POR VENDEDOR
      const vendedoresQuery = `
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(p.id) as total_polizas,
          COUNT(CASE WHEN p.estado = 'activa' THEN 1 END) as polizas_activas,
          COUNT(CASE WHEN p.estado = 'rechazada' THEN 1 END) as polizas_rechazadas,
          COALESCE(SUM(c.total_final), 0) as facturacion,
          COALESCE(AVG(c.total_final), 0) as ticket_promedio,
          -- ✅ TASA DE CONVERSIÓN
          CASE 
            WHEN COUNT(p.id) > 0 THEN 
              ROUND((COUNT(CASE WHEN p.estado = 'activa' THEN 1 END) / COUNT(p.id)) * 100, 2)
            ELSE 0 
          END as conversion_rate
        FROM users u
        LEFT JOIN polizas p ON u.id = p.created_by AND ${fechaFiltro}
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE u.role = 1 AND p.id IS NOT NULL
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total_polizas DESC
        LIMIT 10
      `;

      // ✅ PERFORMANCE POR SUPERVISOR
      const supervisoresQuery = `
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(p.id) as polizas_revisadas,
          COUNT(CASE WHEN p.estado = 'autorizada' THEN 1 END) as polizas_autorizadas,
          COUNT(CASE WHEN p.estado = 'rechazada' THEN 1 END) as polizas_rechazadas,
          -- ✅ TASA DE APROBACIÓN
          CASE 
            WHEN COUNT(p.id) > 0 THEN 
              ROUND((COUNT(CASE WHEN p.estado = 'autorizada' THEN 1 END) / COUNT(p.id)) * 100, 2)
            ELSE 0 
          END as approval_rate
        FROM users u
        LEFT JOIN polizas p ON u.id = p.revisado_por AND ${fechaFiltro}
        WHERE u.role = 2 AND p.id IS NOT NULL
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY polizas_revisadas DESC
        LIMIT 5
      `;

      // ✅ EVOLUCIÓN DIARIA DETALLADA
      const evolucionQuery = `
        SELECT 
          DATE(p.created_at) as fecha,
          COUNT(*) as total_creadas,
          COUNT(CASE WHEN p.estado = 'activa' THEN 1 END) as activas,
          COUNT(CASE WHEN p.estado = 'rechazada' THEN 1 END) as rechazadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_dia
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(p.created_at)
        ORDER BY fecha DESC
        LIMIT 30
      `;

      const [stats] = await db.execute(statsQuery);
      const [vendedores] = await db.execute(vendedoresQuery);
      const [supervisores] = await db.execute(supervisoresQuery);
      const [evolucion] = await db.execute(evolucionQuery);

      res.json({
        success: true,
        periodo: periodo,
        data: {
          resumen_general: stats[0],
          performance_vendedores: vendedores,
          performance_supervisores: supervisores,
          evolucion_diaria: evolucion,
          metricas_calculadas: {
            conversion_rate_global: stats[0].total_polizas > 0 
              ? ((stats[0].polizas_activas / stats[0].total_polizas) * 100).toFixed(2) + '%'
              : '0%',
            rejection_rate: stats[0].total_polizas > 0 
              ? ((stats[0].polizas_rechazadas / stats[0].total_polizas) * 100).toFixed(2) + '%'
              : '0%',
            ticket_promedio_formateado: new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS'
            }).format(stats[0].ticket_promedio),
            crecimiento_semanal: stats[0].polizas_ultima_semana,
            actividad_reciente: stats[0].cambios_estado_24h
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas avanzadas:', error);
      res.status(500).json({ 
        error: 'Error obteniendo estadísticas avanzadas',
        message: error.message 
      });
    }
  },

  // ✅ FILTROS EXPANDIDOS PARA ADMIN
  async obtenerFiltrosAvanzados(req, res) {
    try {
      // Obtener vendedores
      const vendedoresQuery = `
        SELECT DISTINCT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(p.id) as total_polizas
        FROM users u
        LEFT JOIN polizas p ON u.id = p.created_by
        WHERE u.role = 1
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total_polizas DESC, u.first_name, u.last_name
      `;

      // ✅ NUEVO: Obtener supervisores
      const supervisoresQuery = `
        SELECT DISTINCT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(p.id) as polizas_revisadas
        FROM users u
        LEFT JOIN polizas p ON u.id = p.revisado_por
        WHERE u.role = 2
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY polizas_revisadas DESC, u.first_name, u.last_name
      `;

      // Obtener planes
      const planesQuery = `
        SELECT DISTINCT 
          pl.id,
          pl.nombre,
          COUNT(p.id) as uso_count
        FROM planes pl
        INNER JOIN cotizaciones c ON pl.id = c.plan_id
        INNER JOIN polizas p ON c.id = p.cotizacion_id
        GROUP BY pl.id, pl.nombre
        ORDER BY uso_count DESC, pl.nombre
      `;

      const [vendedores] = await db.execute(vendedoresQuery);
      const [supervisores] = await db.execute(supervisoresQuery);
      const [planes] = await db.execute(planesQuery);

      res.json({
        success: true,
        data: {
          vendedores,
          supervisores, // ✅ NUEVO
          planes: planes.map(p => ({ id: p.id, nombre: p.nombre, uso_count: p.uso_count })),
          estados: [
            'borrador', 'pendiente_revision', 'en_revision', 'pendiente_documentos',
            'pendiente_autorizacion', 'autorizada', 'enviada_cliente', 'firmada',
            'activa', 'rechazada', 'cancelada', 'vencida'
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo filtros avanzados:', error);
      res.status(500).json({ 
        error: 'Error obteniendo filtros avanzados',
        message: error.message 
      });
    }
  },

  // ✅ NUEVOS MÉTODOS ESPECÍFICOS PARA ADMIN

  // Eliminar póliza (soft delete)
  async eliminarPoliza(req, res) {
    try {
      const { id } = req.params;
      const { motivo_eliminacion } = req.body;
      const admin_id = req.user.id;

      console.log('🗑️ Admin eliminando póliza:', { poliza_id: id, admin_id, motivo: motivo_eliminacion });

      const updateQuery = `
        UPDATE polizas 
        SET 
          deleted_at = NOW(),
          deleted_by = ?,
          motivo_eliminacion = ?
        WHERE id = ?
      `;

      const [result] = await db.execute(updateQuery, [admin_id, motivo_eliminacion, id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      res.json({
        success: true,
        message: 'Póliza eliminada correctamente',
        data: { id, motivo_eliminacion }
      });

    } catch (error) {
      console.error('❌ Error eliminando póliza:', error);
      res.status(500).json({ 
        error: 'Error eliminando póliza',
        message: error.message 
      });
    }
  },

  // Restaurar póliza eliminada
  async restaurarPoliza(req, res) {
    try {
      const { id } = req.params;
      const admin_id = req.user.id;

      console.log('🔄 Admin restaurando póliza:', { poliza_id: id, admin_id });

      const updateQuery = `
        UPDATE polizas 
        SET 
          deleted_at = NULL,
          deleted_by = NULL,
          motivo_eliminacion = NULL,
          restored_at = NOW(),
          restored_by = ?
        WHERE id = ?
      `;

      const [result] = await db.execute(updateQuery, [admin_id, id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      res.json({
        success: true,
        message: 'Póliza restaurada correctamente',
        data: { id }
      });

    } catch (error) {
      console.error('❌ Error restaurando póliza:', error);
      res.status(500).json({ 
        error: 'Error restaurando póliza',
        message: error.message 
      });
    }
  },

  // Auditoría de cambios
  async obtenerAuditoriaCompleta(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          'estado' as tipo_cambio,
          h.estado_anterior as valor_anterior,
          h.estado_nuevo as valor_nuevo,
          h.motivo,
          h.created_at as fecha_cambio,
          u.first_name as usuario_nombre,
          u.last_name as usuario_apellido,
          u.email as usuario_email,
          u.role as usuario_role
        FROM poliza_estados_historial h
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.poliza_id = ?
        
        UNION ALL
        
        SELECT 
          'eliminacion' as tipo_cambio,
          'activa' as valor_anterior,
          'eliminada' as valor_nuevo,
          p.motivo_eliminacion as motivo,
          p.deleted_at as fecha_cambio,
          u.first_name as usuario_nombre,
          u.last_name as usuario_apellido,
          u.email as usuario_email,
          u.role as usuario_role
        FROM polizas p
        LEFT JOIN users u ON p.deleted_by = u.id
        WHERE p.id = ? AND p.deleted_at IS NOT NULL
        
        ORDER BY fecha_cambio DESC
      `;

      const [auditoria] = await db.execute(query, [id, id]);

      res.json({
        success: true,
        data: auditoria
      });

    } catch (error) {
      console.error('❌ Error obteniendo auditoría completa:', error);
      res.status(500).json({ 
        error: 'Error obteniendo auditoría completa',
        message: error.message 
      });
    }
  },

  // ✅ NUEVO: Obtener documentos de una póliza específica (Admin puede ver TODAS)
  async obtenerDocumentosPoliza(req, res) {
    try {
      const { polizaId } = req.params;
      const admin_id = req.user.id;

      console.log('📄 Admin obteniendo documentos para póliza:', { polizaId, admin_id });

      // ✅ ADMIN NO NECESITA VERIFICACIÓN - VE TODAS LAS PÓLIZAS
      const verificarPolizaQuery = `
        SELECT 
          id, 
          numero_poliza, 
          created_by,
          estado,
          deleted_at
        FROM polizas 
        WHERE id = ?
      `;

      const [polizaVerif] = await db.execute(verificarPolizaQuery, [polizaId]);

      if (polizaVerif.length === 0) {
        return res.status(404).json({ 
          error: 'Póliza no encontrada',
          poliza_id: polizaId 
        });
      }

      const poliza = polizaVerif[0];

      // ✅ OBTENER DOCUMENTOS CON INFORMACIÓN EXTENDIDA PARA ADMIN
      const query = `
        SELECT 
          d.id,
          d.tipo_documento,
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tamaño_bytes,
          d.tipo_mime,
          d.integrante_index,
          d.fecha_subida,
          d.created_at,
          -- Datos de la póliza
          p.numero_poliza,
          p.estado as poliza_estado,
          p.deleted_at as poliza_eliminada,
          -- Datos del prospecto titular
          pr.nombre as titular_nombre,
          pr.apellido as titular_apellido,
          pr.numero_contacto as titular_telefono,
          pr.correo as titular_email,
          -- ✅ DATOS DEL VENDEDOR (para admin)
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido,
          v.email as vendedor_email,
          -- ✅ DATOS DEL SUPERVISOR (para admin)
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          s.email as supervisor_email,
          -- ✅ INFORMACIÓN DE AUDITORÍA
          d.created_at as fecha_creacion_documento,
          d.updated_at as fecha_modificacion_documento
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        INNER JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN users v ON p.created_by = v.id
        LEFT JOIN users s ON p.revisado_por = s.id
        WHERE d.poliza_id = ?
        ORDER BY d.tipo_documento, d.integrante_index, d.fecha_subida DESC
      `;

      const [documentos] = await db.execute(query, [polizaId]);

      // ✅ FORMATEAR DOCUMENTOS AGRUPADOS POR TIPO CON INFO EXTENDIDA
      const documentosAgrupados = documentos.reduce((acc, doc) => {
        const tipo = doc.tipo_documento;
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push({
          id: doc.id,
          nombre_original: doc.nombre_original,
          nombre_archivo: doc.nombre_archivo,
          ruta_archivo: doc.ruta_archivo,
          tamaño_bytes: doc.tamaño_bytes,
          tipo_mime: doc.tipo_mime,
          integrante_index: doc.integrante_index,
          fecha_subida: doc.fecha_subida,
          created_at: doc.created_at,
          fecha_creacion_documento: doc.fecha_creacion_documento,
          fecha_modificacion_documento: doc.fecha_modificacion_documento,
          urls: {
            download: `${process.env.BASE_URL || `https://${process.env.DOMAIN}`}/api/admin/documentos/${doc.id}/download`,
            preview: `${process.env.BASE_URL || `https://${process.env.DOMAIN}`}/api/admin/documentos/${doc.id}/preview`,
            delete: `${process.env.BASE_URL || `https://${process.env.DOMAIN}`}/api/admin/documentos/${doc.id}` // ✅ Admin puede eliminar
          }
        });
        return acc;
      }, {});

      // ✅ RESPUESTA EXTENDIDA PARA ADMIN
      res.json({
        success: true,
        poliza_id: polizaId,
        numero_poliza: documentos[0]?.numero_poliza || null,
        estado_poliza: poliza.estado,
        poliza_eliminada: poliza.deleted_at !== null,
        titular: documentos[0] ? {
          nombre: documentos[0].titular_nombre,
          apellido: documentos[0].titular_apellido,
          telefono: documentos[0].titular_telefono,
          email: documentos[0].titular_email
        } : null,
        // ✅ INFO DEL EQUIPO PARA ADMIN
        vendedor: documentos[0] ? {
          nombre: documentos[0].vendedor_nombre,
          apellido: documentos[0].vendedor_apellido,
          email: documentos[0].vendedor_email
        } : null,
        supervisor: documentos[0] && documentos[0].supervisor_nombre ? {
          nombre: documentos[0].supervisor_nombre,
          apellido: documentos[0].supervisor_apellido,
          email: documentos[0].supervisor_email
        } : null,
        documentos: documentosAgrupados,
        total_documentos: documentos.length,
        // ✅ ESTADÍSTICAS DE DOCUMENTOS PARA ADMIN
        estadisticas_documentos: {
          tipos_documento: Object.keys(documentosAgrupados).length,
          documentos_por_tipo: Object.entries(documentosAgrupados).map(([tipo, docs]) => ({
            tipo,
            cantidad: docs.length,
            tamaño_total: docs.reduce((sum, doc) => sum + doc.tamaño_bytes, 0)
          }))
        },
        message: documentos.length === 0 ? 'No hay documentos disponibles para esta póliza' : null
      });

    } catch (error) {
      console.error('❌ Error obteniendo documentos de póliza (admin):', error);
      res.status(500).json({ 
        error: 'Error obteniendo documentos',
        message: error.message 
      });
    }
  },

  // ✅ NUEVO: Descargar documento específico (Admin puede descargar TODOS)
  async descargarDocumento(req, res) {
    try {
      const { documentoId } = req.params;
      const admin_id = req.user.id;

      console.log('📥 Admin descargando documento:', { documentoId, admin_id });

      // ✅ ADMIN PUEDE DESCARGAR CUALQUIER DOCUMENTO (sin restricciones)
      const query = `
        SELECT 
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tipo_mime,
          d.tamaño_bytes,
          p.numero_poliza,
          p.created_by,
          p.deleted_at,
          -- Info del vendedor para auditoría
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        LEFT JOIN users v ON p.created_by = v.id
        WHERE d.id = ?
      `;

      const [documentos] = await db.execute(query, [documentoId]);
      
      if (documentos.length === 0) {
        return res.status(404).json({ 
          error: 'Documento no encontrado' 
        });
      }

      const documento = documentos[0];
      const fs = require('fs');
      const path = require('path');
      let rutaCompleta = documento.ruta_archivo;

      // Si la ruta ya es absoluta, úsala tal cual
      if (!path.isAbsolute(rutaCompleta)) {
        rutaCompleta = path.join(process.env.UPLOADS_PATH || '/var/www/uploads', rutaCompleta);
      }

      if (!fs.existsSync(rutaCompleta)) {
        return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
      }

      // ✅ REGISTRAR DESCARGA PARA AUDITORÍA (opcional)
      try {
        const auditQuery = `
          INSERT INTO admin_audit_log (
            admin_id, 
            action, 
            resource_type, 
            resource_id, 
            details, 
            created_at
          ) VALUES (?, 'download_document', 'documento', ?, ?, NOW())
        `;
        
        await db.execute(auditQuery, [
          admin_id, 
          documentoId, 
          JSON.stringify({
            documento_nombre: documento.nombre_original,
            poliza_numero: documento.numero_poliza,
            vendedor: `${documento.vendedor_nombre} ${documento.vendedor_apellido}`
          })
        ]);
      } catch (auditError) {
        console.log('⚠️ No se pudo registrar la auditoría:', auditError.message);
      }

      console.log('✅ Admin enviando archivo:', rutaCompleta);

      res.setHeader('Content-Disposition', `attachment; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Content-Length', documento.tamaño_bytes);
      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error descargando documento (admin):', error);
      res.status(500).json({ 
        error: 'Error descargando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVO: Preview de documento (Admin puede previsualizar TODOS)
  async previewDocumento(req, res) {
    try {
      const { documentoId } = req.params;
      const admin_id = req.user.id;

      console.log('👁️ Admin previsualizando documento:', { documentoId, admin_id });

      // Admin puede previsualizar cualquier documento
      const query = `
        SELECT 
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tipo_mime,
          p.numero_poliza,
          p.deleted_at
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        WHERE d.id = ?
      `;

      const [documentos] = await db.execute(query, [documentoId]);
      
      if (documentos.length === 0) {
        return res.status(404).json({ 
          error: 'Documento no encontrado' 
        });
      }

      const documento = documentos[0];
      const fs = require('fs');
      const path = require('path');
      let rutaCompleta = documento.ruta_archivo;

      if (!path.isAbsolute(rutaCompleta)) {
        rutaCompleta = path.join(process.env.UPLOADS_PATH || '/var/www/uploads', rutaCompleta);
      }

      if (!fs.existsSync(rutaCompleta)) {
        return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
      }

      // Solo permitir preview de imágenes y PDFs
      if (!documento.tipo_mime.startsWith('image/') && documento.tipo_mime !== 'application/pdf') {
        return res.status(400).json({ 
          error: 'Este tipo de archivo no se puede previsualizar',
          tipo_mime: documento.tipo_mime 
        });
      }

      // ✅ INDICAR SI LA PÓLIZA ESTÁ ELIMINADA
      if (documento.deleted_at) {
        res.setHeader('X-Poliza-Status', 'deleted');
      }

      res.setHeader('Content-Type', documento.tipo_mime);
      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error previsualizando documento (admin):', error);
      res.status(500).json({ 
        error: 'Error previsualizando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVO: Eliminar documento (Solo Admin)
  async eliminarDocumento(req, res) {
    try {
      const { documentoId } = req.params;
      const { motivo_eliminacion = 'Eliminado por administrador' } = req.body;
      const admin_id = req.user.id;

      console.log('🗑️ Admin eliminando documento:', { documentoId, admin_id, motivo: motivo_eliminacion });

      // Obtener información del documento antes de eliminarlo
      const infoQuery = `
        SELECT 
          d.nombre_original,
          d.ruta_archivo,
          p.numero_poliza,
          p.created_by,
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        LEFT JOIN users v ON p.created_by = v.id
        WHERE d.id = ?
      `;

      const [documentoInfo] = await db.execute(infoQuery, [documentoId]);

      if (documentoInfo.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      const documento = documentoInfo[0];

      // Eliminar físicamente el archivo
      const fs = require('fs');
      const path = require('path');
      let rutaCompleta = documento.ruta_archivo;

      if (!path.isAbsolute(rutaCompleta)) {
        rutaCompleta = path.join(process.env.UPLOADS_PATH || '/var/www/uploads', rutaCompleta);
      }

      // Eliminar registro de la base de datos
      const deleteQuery = 'DELETE FROM poliza_documentos WHERE id = ?';
      const [result] = await db.execute(deleteQuery, [documentoId]);

      // Eliminar archivo físico (si existe)
      if (fs.existsSync(rutaCompleta)) {
        try {
          fs.unlinkSync(rutaCompleta);
          console.log('✅ Archivo físico eliminado:', rutaCompleta);
        } catch (fileError) {
          console.log('⚠️ No se pudo eliminar el archivo físico:', fileError.message);
        }
      }

      // ✅ REGISTRAR ELIMINACIÓN PARA AUDITORÍA
      try {
        const auditQuery = `
          INSERT INTO admin_audit_log (
            admin_id, 
            action, 
            resource_type, 
            resource_id, 
            details, 
            created_at
          ) VALUES (?, 'delete_document', 'documento', ?, ?, NOW())
        `;
        
        await db.execute(auditQuery, [
          admin_id, 
          documentoId, 
          JSON.stringify({
            documento_nombre: documento.nombre_original,
            poliza_numero: documento.numero_poliza,
            vendedor: `${documento.vendedor_nombre} ${documento.vendedor_apellido}`,
            motivo: motivo_eliminacion
          })
        ]);
      } catch (auditError) {
        console.log('⚠️ No se pudo registrar la auditoría:', auditError.message);
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      res.json({
        success: true,
        message: 'Documento eliminado correctamente',
        data: { 
          id: documentoId, 
          nombre_original: documento.nombre_original,
          poliza_numero: documento.numero_poliza,
          motivo_eliminacion 
        }
      });

    } catch (error) {
      console.error('❌ Error eliminando documento (admin):', error);
      res.status(500).json({ 
        error: 'Error eliminando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVO: Estadísticas de documentos por póliza
  async obtenerEstadisticasDocumentos(req, res) {
    try {
      const admin_id = req.user.id;

      console.log('📊 Admin obteniendo estadísticas de documentos');

      const statsQuery = `
        SELECT 
          COUNT(DISTINCT d.poliza_id) as polizas_con_documentos,
          COUNT(d.id) as total_documentos,
          COUNT(DISTINCT d.tipo_documento) as tipos_documentos_usados,
          SUM(d.tamaño_bytes) as espacio_total_usado,
          AVG(d.tamaño_bytes) as tamaño_promedio_documento,
          -- Por tipo de documento
          d.tipo_documento,
          COUNT(d.id) as cantidad_por_tipo,
          SUM(d.tamaño_bytes) as espacio_por_tipo
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        GROUP BY d.tipo_documento
        ORDER BY cantidad_por_tipo DESC
      `;

      const resumenQuery = `
        SELECT 
          COUNT(DISTINCT d.poliza_id) as polizas_con_documentos,
          COUNT(d.id) as total_documentos,
          SUM(d.tamaño_bytes) as espacio_total_usado,
          AVG(d.tamaño_bytes) as tamaño_promedio_documento,
          -- Documentos por estado de póliza
          COUNT(CASE WHEN p.estado = 'activa' THEN d.id END) as docs_polizas_activas,
          COUNT(CASE WHEN p.estado = 'borrador' THEN d.id END) as docs_polizas_borrador,
          COUNT(CASE WHEN p.deleted_at IS NOT NULL THEN d.id END) as docs_polizas_eliminadas
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
      `;

      const [statsPorTipo] = await db.execute(statsQuery);
      const [resumen] = await db.execute(resumenQuery);

      res.json({
        success: true,
        data: {
          resumen_general: resumen[0],
          por_tipo_documento: statsPorTipo,
          metricas_calculadas: {
            espacio_total_gb: (resumen[0].espacio_total_usado / (1024 * 1024 * 1024)).toFixed(2),
            promedio_docs_por_poliza: resumen[0].polizas_con_documentos > 0 
              ? (resumen[0].total_documentos / resumen[0].polizas_con_documentos).toFixed(1)
              : 0,
            tamaño_promedio_mb: (resumen[0].tamaño_promedio_documento / (1024 * 1024)).toFixed(2)
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de documentos:', error);
      res.status(500).json({ 
        error: 'Error obteniendo estadísticas de documentos',
        message: error.message 
      });
    }
  }
};

module.exports = PolizasAdminController;