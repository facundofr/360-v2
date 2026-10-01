const PolizaModel = require('../../models/poliza/polizaModel');
const db = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const GoogleSheetsPolizasService = require('../../services/googleSheetsPolizasService');
const { resolverEmailProspecto } = require('../../utils/emailProspecto');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/polizas/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: function (req, file, cb) {
    // Tipos de archivo permitidos
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, JPG, PNG, DOC y DOCX'));
    }
  }
});

const PolizasBackOfficeController = {
  // ✅ SIN RESTRICCIONES: Obtener TODAS las pólizas del sistema
  async obtenerPolizas(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        estado, 
        vendedor_id,
        supervisor_id, // ✅ NUEVO: Filtro por supervisor para Back Office
        desde, 
        hasta, 
        buscar,
        plan,
        orden = 'mas_nuevos',
        estado_firma
      } = req.query;

      console.log('🏢 Back Office obteniendo TODAS las pólizas con filtros:', { 
        estado, vendedor_id, supervisor_id, desde, hasta, buscar, plan, orden, estado_firma 
      });

      // ✅ SIN RESTRICCIONES JERÁRQUICAS: Consulta global
      let whereConditions = ['p.deleted_at IS NULL']; // Excluir pólizas eliminadas
      let queryParams = [];

      // Filtrar por estado
      if (estado && estado !== 'todos') {
        whereConditions.push('p.estado = ?');
        queryParams.push(estado);
      }

      // ✅ NUEVO: Filtrar por supervisor específico (opcional para Back Office)
      if (supervisor_id && supervisor_id !== 'todos') {
        whereConditions.push('v.supervisor_id = ?');
        queryParams.push(supervisor_id);
      }

      // Filtrar por vendedor específico (de cualquier supervisor)
      if (vendedor_id && vendedor_id !== 'todos') {
        whereConditions.push('v.id = ?');
        queryParams.push(vendedor_id);
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

      // ✅ Filtro por estado de firma (usa agregados de pvea)
      if (estado_firma && estado_firma !== 'todos') {
        switch ((estado_firma || '').toLowerCase()) {
          case 'signed':
            whereConditions.push('(pvea.any_signed = 1)');
            break;
          case 'pending':
            // Pendiente y aún no firmada
            whereConditions.push('(pvea.any_pending = 1 AND (pvea.any_signed IS NULL OR pvea.any_signed = 0))');
            break;
          case 'rejected':
            whereConditions.push('(pvea.any_rejected = 1 AND (pvea.any_signed IS NULL OR pvea.any_signed = 0))');
            break;
          case 'expired':
            whereConditions.push('(pvea.any_expired = 1 AND (pvea.any_signed IS NULL OR pvea.any_signed = 0))');
            break;
          default:
            break;
        }
      }

      // Búsqueda por texto (global en todo el sistema)
      if (buscar) {
        whereConditions.push(`(
          p.numero_poliza LIKE ? OR 
          p.numero_poliza_oficial LIKE ? OR
          pr.nombre LIKE ? OR 
          pr.apellido LIKE ? OR
          pr.numero_contacto LIKE ? OR
          pr.correo LIKE ? OR
          CONCAT(v.first_name, ' ', v.last_name) LIKE ? OR
          CONCAT(s.first_name, ' ', s.last_name) LIKE ? OR
          pl.nombre LIKE ?
        )`);
        const searchTerm = `%${buscar}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const whereClause = whereConditions.join(' AND ');
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Determinar el ORDER BY
      let orderByClause;
      switch (orden) {
        case 'mas_antiguos':
          orderByClause = 'ORDER BY p.created_at ASC';
          break;
        case 'alfabetico':
          orderByClause = 'ORDER BY pr.nombre ASC, pr.apellido ASC';
          break;
        case 'alfabetico_desc':
          orderByClause = 'ORDER BY pr.nombre DESC, pr.apellido DESC';
          break;
        case 'supervisor':
          orderByClause = 'ORDER BY s.first_name ASC, s.last_name ASC, v.first_name ASC';
          break;
        case 'monto_desc':
          orderByClause = 'ORDER BY c.total_final DESC';
          break;
        case 'mas_nuevos':
        default:
          orderByClause = 'ORDER BY p.created_at DESC';
          break;
      }

      // ✅ QUERY GLOBAL: Incluye información del supervisor y estado de firma (agregado sobre todos los envíos)
      const query = `
        SELECT 
          p.*,
          pr.nombre as prospecto_nombre,
          pr.apellido as prospecto_apellido,
          pr.correo as prospecto_email,
          pr.edad as prospecto_edad,
          pr.numero_contacto as prospecto_telefono,
          pr.localidad as prospecto_localidad,
          pr.tipo_afiliacion_id,
          c.total_final,
          c.total_bruto,
          c.total_descuento_aporte,
          c.total_descuento_promocion,
          c.anio as anio_plan,
          pl.nombre as plan_nombre,
          pl.id as plan_id,
          ta.etiqueta as tipo_afiliacion_nombre,
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido,
          v.email as vendedor_email,
          v.id as vendedor_id,
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          s.email as supervisor_email,
          s.id as supervisor_id,
          /* Estado de firma agregado: si alguna solicitud está firmada => 'signed'; si no, si alguna está pendiente => 'pending' */
          CASE 
            WHEN pvea.any_signed = 1 THEN 'signed'
            WHEN pvea.any_pending = 1 THEN 'pending'
            WHEN pvea.any_rejected = 1 THEN 'rejected'
            WHEN pvea.any_expired = 1 THEN 'expired'
            ELSE NULL
          END AS estado_firma,
          /* Último envío a firma (de cualquier solicitud) */
          pvea.last_enviado_en as fecha_envio_firma,
          /* Fecha de la última firma entre todas las solicitudes firmadas */
          (
            SELECT MAX(pve2.firmado_en)
            FROM polizas_vafirma_envios pve2
            WHERE pve2.poliza_id = p.id AND TRIM(LOWER(pve2.estado_firma)) IN ('signed','firmado','completed')
          ) AS fecha_firma,
          /* Referencia (doc_uuid) del último documento firmado, si existe */
          (
            SELECT pve3.doc_uuid
            FROM polizas_vafirma_envios pve3
            WHERE pve3.poliza_id = p.id AND TRIM(LOWER(pve3.estado_firma)) IN ('signed','firmado','completed')
            ORDER BY pve3.firmado_en DESC
            LIMIT 1
          ) AS referencia_vafirma
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
        LEFT JOIN users v ON p.created_by = v.id
        LEFT JOIN users s ON v.supervisor_id = s.id
        /* Agregado de estado de firma por póliza */
        LEFT JOIN (
          SELECT 
            poliza_id,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed') THEN 1 ELSE 0 END) AS any_signed,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('pending') THEN 1 ELSE 0 END) AS any_pending,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('rejected','rechazado') THEN 1 ELSE 0 END) AS any_rejected,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('expired','expirado') THEN 1 ELSE 0 END) AS any_expired,
            MAX(enviado_en) AS last_enviado_en
          FROM polizas_vafirma_envios
          GROUP BY poliza_id
        ) pvea ON pvea.poliza_id = p.id
        WHERE ${whereClause}
        ${orderByClause}
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
        LEFT JOIN users s ON v.supervisor_id = s.id
        LEFT JOIN (
          SELECT 
            poliza_id,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed') THEN 1 ELSE 0 END) AS any_signed,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('pending') THEN 1 ELSE 0 END) AS any_pending,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('rejected','rechazado') THEN 1 ELSE 0 END) AS any_rejected,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('expired','expirado') THEN 1 ELSE 0 END) AS any_expired
          FROM polizas_vafirma_envios
          GROUP BY poliza_id
        ) pvea ON pvea.poliza_id = p.id
        WHERE ${whereClause}
      `;

      const countParams = queryParams.slice(0, -2);

      // Ejecutar queries
      const [polizas] = await db.execute(query, queryParams);
      const [countResult] = await db.execute(countQuery, countParams);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / parseInt(limit));

      // ✅ FORMATEAR CON INFORMACIÓN DEL SUPERVISOR Y FIRMA ELECTRÓNICA
      const polizasFormateadas = polizas.map(poliza => ({
        id: poliza.id,
        numero_poliza: poliza.numero_poliza,
        numero_poliza_oficial: poliza.numero_poliza_oficial,
        pdf_hash: poliza.pdf_hash,
        estado: poliza.estado,
        requiere_auditoria_medica: poliza.requiere_auditoria_medica, // ✅ NUEVO: Flag de auditoría médica
        created_at: poliza.created_at,
        updated_at: poliza.updated_at,
        fecha_finalizacion: poliza.fecha_finalizacion,
        prospecto_nombre: poliza.prospecto_nombre,
        prospecto_apellido: poliza.prospecto_apellido,
        prospecto_telefono: poliza.prospecto_telefono,
        prospecto_email: resolverEmailProspecto(poliza),
        prospecto_edad: poliza.prospecto_edad,
        prospecto_localidad: poliza.prospecto_localidad,
        plan_nombre: poliza.plan_nombre,
        anio_plan: poliza.anio_plan,
        total_bruto: poliza.total_bruto,
        total_descuento_aporte: poliza.total_descuento_aporte,
        total_descuento_promocion: poliza.total_descuento_promocion,
        total_final: poliza.total_final,
        tipo_afiliacion: poliza.tipo_afiliacion_nombre,
        // ✅ DATOS DE FIRMA ELECTRÓNICA desde polizas_vafirma_envios
        estado_firma: poliza.estado_firma || null,
        fecha_envio_firma: poliza.fecha_envio_firma || null,
        fecha_firma: poliza.fecha_firma || null,
        referencia_vafirma: poliza.referencia_vafirma || null,
        vendedor: {
          id: poliza.vendedor_id,
          nombre: poliza.vendedor_nombre,
          apellido: poliza.vendedor_apellido,
          email: poliza.vendedor_email
        },
        supervisor: {
          id: poliza.supervisor_id,
          nombre: poliza.supervisor_nombre,
          apellido: poliza.supervisor_apellido,
          email: poliza.supervisor_email
        },
        urls: {
          pdf: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/${poliza.id}/pdf`,
          detalle: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/${poliza.id}`
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
          supervisor_id: supervisor_id || 'todos',
          plan: plan || 'todos',
          estado_firma: estado_firma || 'todos',
          desde,
          hasta,
          buscar
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo pólizas (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo pólizas',
        message: error.message 
      });
    }
  },

  // ✅ SIN RESTRICCIONES: Estadísticas globales de toda la organización
  async obtenerEstadisticas(req, res) {
    try {
      const { periodo = 'mes', mes, anio } = req.query;

      let fechaFiltro = '';
      let periodoDescripcion = '';

      // Si se especifica mes y año específicos
      if (mes && anio) {
        fechaFiltro = 'YEAR(p.created_at) = ? AND MONTH(p.created_at) = ?';
        periodoDescripcion = `${getMesNombre(mes)} ${anio}`;
      } else {
        switch (periodo) {
          case 'dia':
            fechaFiltro = 'DATE(p.created_at) = CURDATE()';
            periodoDescripcion = 'Hoy';
            break;
          case 'semana':
            fechaFiltro = 'p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
            periodoDescripcion = 'Últimos 7 días';
            break;
          case 'año':
            fechaFiltro = 'YEAR(p.created_at) = YEAR(CURDATE())';
            periodoDescripcion = 'Este año';
            break;
          case 'todos':
            fechaFiltro = '1=1';
            periodoDescripcion = 'Todos los períodos';
            break;
          case 'mes':
          default:
            fechaFiltro = 'YEAR(p.created_at) = YEAR(CURDATE()) AND MONTH(p.created_at) = MONTH(CURDATE())';
            periodoDescripcion = 'Este mes';
            break;
        }
      }

      // ✅ ESTADÍSTICAS GLOBALES: Todo el sistema - NUEVOS ESTADOS
      const statsQuery = `
        SELECT 
          COUNT(*) as total_polizas,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as polizas_en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as polizas_finalizadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          COUNT(DISTINCT p.created_by) as vendedores_activos,
          COUNT(DISTINCT v.supervisor_id) as supervisores_activos,
          MIN(p.created_at) as primera_poliza,
          MAX(p.created_at) as ultima_poliza
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN users v ON p.created_by = v.id
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
      `;

      // ✅ ESTADÍSTICAS POR SUPERVISOR: Todos los supervisores - NUEVOS ESTADOS
      const supervisoresQuery = `
        SELECT 
          s.id as supervisor_id,
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          s.email as supervisor_email,
          COUNT(DISTINCT v.id) as vendedores_activos,
          COUNT(p.id) as total_polizas,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as polizas_en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as polizas_finalizadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          ROUND((COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) / NULLIF(COUNT(p.id), 0)) * 100, 2) as tasa_finalizacion
        FROM users s
        LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
        LEFT JOIN polizas p ON p.created_by = v.id AND ${fechaFiltro} AND p.deleted_at IS NULL
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE s.role = 2
        GROUP BY s.id, s.first_name, s.last_name, s.email
        ORDER BY total_polizas DESC
        LIMIT 10
      `;

      // ✅ TOP VENDEDORES: De toda la organización - NUEVOS ESTADOS
      const vendedoresQuery = `
        SELECT 
          v.first_name,
          v.last_name,
          v.email,
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          COUNT(p.id) as total_polizas,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as polizas_en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as polizas_finalizadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          ROUND((COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) / NULLIF(COUNT(p.id), 0)) * 100, 2) as tasa_finalizacion
        FROM polizas p
        LEFT JOIN users v ON p.created_by = v.id
        LEFT JOIN users s ON v.supervisor_id = s.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
        GROUP BY p.created_by, v.first_name, v.last_name, v.email, s.first_name, s.last_name
        HAVING COUNT(p.id) > 0
        ORDER BY total_polizas DESC
        LIMIT 10
      `;

      // ✅ ESTADÍSTICAS POR ESTADO: Todo el sistema
      const estadosQuery = `
        SELECT 
          p.estado,
          COUNT(*) as cantidad,
          COALESCE(SUM(c.total_final), 0) as facturacion,
          ROUND((COUNT(*) / (SELECT COUNT(*) FROM polizas p2 WHERE ${fechaFiltro} AND p2.deleted_at IS NULL)) * 100, 2) as porcentaje
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
        GROUP BY p.estado
        ORDER BY cantidad DESC
      `;

      // Ejecutar queries
      let queryParams = [];
      if (mes && anio) {
        queryParams = [anio, mes];
      }

      const [stats] = await db.execute(statsQuery, queryParams);
      const [supervisores] = await db.execute(supervisoresQuery, queryParams);
      const [vendedores] = await db.execute(vendedoresQuery, queryParams);
      const [estados] = await db.execute(estadosQuery, queryParams);

      const resumenEstadisticas = stats[0];

      res.json({
        success: true,
        periodo: periodo,
        periodo_descripcion: periodoDescripcion,
        filtro_aplicado: { mes, anio, periodo },
        data: {
          resumen: {
            ...resumenEstadisticas,
            tasa_finalizacion: resumenEstadisticas.total_polizas > 0 
              ? ((resumenEstadisticas.polizas_finalizadas / resumenEstadisticas.total_polizas) * 100).toFixed(2)
              : '0',
            tasa_en_proceso: resumenEstadisticas.total_polizas > 0 
              ? ((resumenEstadisticas.polizas_en_proceso / resumenEstadisticas.total_polizas) * 100).toFixed(2)
              : '0'
          },
          por_supervisor: supervisores,
          top_vendedores: vendedores,
          distribucion_estados: estados,
          metricas_calculadas: {
            finalization_rate: resumenEstadisticas.total_polizas > 0 
              ? ((resumenEstadisticas.polizas_finalizadas / resumenEstadisticas.total_polizas) * 100).toFixed(2) + '%'
              : '0%',
            proceso_rate: resumenEstadisticas.total_polizas > 0 
              ? ((resumenEstadisticas.polizas_en_proceso / resumenEstadisticas.total_polizas) * 100).toFixed(2) + '%'
              : '0%',
            facturacion_total_formateada: new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS'
            }).format(resumenEstadisticas.facturacion_total)
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo estadísticas',
        message: error.message 
      });
    }
  },

  // ✅ SIN RESTRICCIONES: Filtros de todos los vendedores y supervisores
  async obtenerFiltros(req, res) {
    try {
      // ✅ TODOS LOS SUPERVISORES del sistema
      const supervisoresQuery = `
        SELECT DISTINCT 
          s.id,
          s.first_name,
          s.last_name,
          s.email,
          COUNT(v.id) as vendedores_count
        FROM users s
        LEFT JOIN users v ON s.id = v.supervisor_id AND v.role = 1
        WHERE s.role = 2 AND s.is_enabled = 1
        GROUP BY s.id, s.first_name, s.last_name, s.email
        ORDER BY s.first_name, s.last_name
      `;

      // ✅ TODOS LOS VENDEDORES del sistema con información del supervisor
      const vendedoresQuery = `
        SELECT DISTINCT 
          v.id,
          v.first_name,
          v.last_name,
          v.email,
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          s.id as supervisor_id
        FROM users v
        LEFT JOIN users s ON v.supervisor_id = s.id
        WHERE v.role = 1 AND v.is_enabled = 1
        ORDER BY s.first_name, s.last_name, v.first_name, v.last_name
      `;

      // ✅ TODOS LOS PLANES del sistema
      const planesQuery = `
        SELECT DISTINCT pl.nombre
        FROM planes pl
        INNER JOIN cotizaciones c ON pl.id = c.plan_id
        INNER JOIN polizas p ON c.id = p.cotizacion_id
        ORDER BY pl.nombre
      `;

      const [supervisores] = await db.execute(supervisoresQuery);
      const [vendedores] = await db.execute(vendedoresQuery);
      const [planes] = await db.execute(planesQuery);

      res.json({
        success: true,
        data: {
          supervisores,
          vendedores,
          planes: planes.map(p => p.nombre),
          estados: [
            'asesor', 'supervisor', 'back_office', 'venta_cerrada', 'venta_rechazada'
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo filtros (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo filtros',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Obtener meses disponibles para filtro de estadísticas
  async obtenerMesesDisponibles(req, res) {
    try {
      // ✅ SIN RESTRICCIONES: Todos los meses con datos en el sistema
      const query = `
        SELECT DISTINCT 
          YEAR(p.created_at) as anio,
          MONTH(p.created_at) as mes,
          COUNT(*) as total_polizas
        FROM polizas p
        WHERE p.deleted_at IS NULL 
        GROUP BY YEAR(p.created_at), MONTH(p.created_at)
        ORDER BY anio DESC, mes DESC
      `;

      const [resultados] = await db.execute(query);

      const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];

      const mesesDisponibles = resultados.map(row => ({
        anio: row.anio,
        mes: row.mes,
        mes_nombre: meses[row.mes - 1],
        total_polizas: row.total_polizas,
        label: `${meses[row.mes - 1]} ${row.anio}`,
        value: `${row.anio}-${row.mes.toString().padStart(2, '0')}`
      }));

      res.json({
        success: true,
        data: mesesDisponibles,
        total_periodos: mesesDisponibles.length
      });

    } catch (error) {
      console.error('❌ Error obteniendo meses disponibles (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo meses disponibles',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Obtener documentos de una póliza específica  
  async obtenerDocumentosPoliza(req, res) {
    try {
      const { id: polizaId } = req.params;

      console.log('📄 Back Office obteniendo documentos para póliza:', polizaId);
      
      if (!polizaId || isNaN(polizaId)) {
        return res.status(400).json({ 
          error: 'ID de póliza inválido',
          details: `Parámetro recibido: ${polizaId}` 
        });
      }

      // ✅ SIN RESTRICCIONES: Cualquier póliza del sistema
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
          d.observaciones,
          p.numero_poliza,
          p.numero_poliza_oficial,
          pr.nombre as titular_nombre,
          pr.apellido as titular_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        INNER JOIN prospectos pr ON p.prospecto_id = pr.id
        WHERE d.poliza_id = ?
        ORDER BY d.tipo_documento, d.integrante_index, d.fecha_subida DESC
      `;

      const [documentos] = await db.execute(query, [parseInt(polizaId)]);

      console.log(`📄 Back Office encontró ${documentos.length} documentos`);

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
          observaciones: doc.observaciones || null,
          urls: {
            download: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/backoffice/polizas/documentos/${doc.id}/download`,
            preview: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/backoffice/polizas/documentos/${doc.id}/preview`
          }
        });
        return acc;
      }, {});

      res.json({
        success: true,
        poliza_id: polizaId,
        numero_poliza: documentos[0]?.numero_poliza_oficial || null,
        titular: documentos[0] ? {
          nombre: documentos[0].titular_nombre,
          apellido: documentos[0].titular_apellido
        } : null,
        documentos: documentosAgrupados,
        total_documentos: documentos.length
      });

    } catch (error) {
      console.error('❌ Error obteniendo documentos (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo documentos',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Descargar documento específico
  async descargarDocumento(req, res) {
    try {
      const { documentoId } = req.params;

      // ✅ SIN RESTRICCIONES: Cualquier documento del sistema
      const query = `
        SELECT 
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tipo_mime,
          p.numero_poliza_oficial || p.numero_poliza as numero_poliza
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        WHERE d.id = ?
      `;

      const [documentos] = await db.execute(query, [documentoId]);
      if (documentos.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
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

      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error descargando documento (Back Office):', error);
      res.status(500).json({ 
        error: 'Error descargando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Eliminar documento (Back Office tiene permisos completos)
  async eliminarDocumento(req, res) {
    try {
      const { documentoId } = req.params;

      // ✅ SIN RESTRICCIONES: Puede eliminar cualquier documento
      const selectQuery = `
        SELECT 
          d.ruta_archivo,
          d.nombre_original,
          p.numero_poliza_oficial || p.numero_poliza as numero_poliza
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        WHERE d.id = ?
      `;

      const [documentos] = await db.execute(selectQuery, [documentoId]);
      if (documentos.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      const documento = documentos[0];

      const deleteQuery = 'DELETE FROM poliza_documentos WHERE id = ?';
      await db.execute(deleteQuery, [documentoId]);

      const fs = require('fs');
      const path = require('path');
      let rutaCompleta = documento.ruta_archivo;

      if (!path.isAbsolute(rutaCompleta)) {
        rutaCompleta = path.join(process.env.UPLOADS_PATH || '/var/www/uploads', rutaCompleta);
      }

      if (fs.existsSync(rutaCompleta)) {
        fs.unlinkSync(rutaCompleta);
      }

      res.json({
        success: true,
        message: 'Documento eliminado correctamente',
        documento_eliminado: {
          id: documentoId,
          nombre: documento.nombre_original,
          poliza: documento.numero_poliza
        }
      });

    } catch (error) {
      console.error('❌ Error eliminando documento (Back Office):', error);
      res.status(500).json({ 
        error: 'Error eliminando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Cambiar estado de póliza
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, motivo_cambio_estado } = req.body;
      const user_id = req.user.id;

      console.log('🔄 Back Office cambiando estado de póliza:', { 
        poliza_id: id,
        estado_nuevo: estado, 
        motivo: motivo_cambio_estado,
        backoffice_user_id: user_id
      });

      // ✅ NUEVOS ESTADOS: asesor, supervisor, back_office, venta_cerrada, venta_rechazada
      const estadosValidos = [
        'asesor', 'supervisor', 'back_office', 'venta_cerrada', 'venta_rechazada'
      ];

      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          error: 'Estado no válido',
          estado_recibido: estado,
          estados_validos: estadosValidos
        });
      }

      // ✅ SIN RESTRICCIONES: Obtener cualquier póliza del sistema
      const queryPoliza = `
        SELECT 
          p.*,
          pr.nombre as prospecto_nombre, 
          pr.apellido as prospecto_apellido,
          u.first_name as vendedor_nombre,
          u.last_name as vendedor_apellido
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `;
      
      const [polizas] = await db.execute(queryPoliza, [id]);
      
      if (polizas.length === 0) {
        return res.status(404).json({ 
          error: 'Póliza no encontrada',
          poliza_id: id
        });
      }

      const polizaActual = polizas[0];

      // ✅ BACK OFFICE: SIN RESTRICCIONES DE TRANSICIÓN
      // Back office puede cambiar a cualquier estado sin validación
      console.log('✅ Back Office tiene permiso para cambiar libremente de estado (sin validación)');

      // Actualizar estado
      const updateQuery = `
        UPDATE polizas 
        SET 
          estado = ?,
          estado_anterior = ?,
          motivo_cambio_estado = ?,
          fecha_cambio_estado = NOW(),
          revisado_por = ?,
          fecha_revision = NOW()
        WHERE id = ?
      `;

      const [updateResult] = await db.execute(updateQuery, [
        estado,
        polizaActual.estado,
        motivo_cambio_estado,
        user_id,
        id
      ]);

      if (updateResult.affectedRows === 0) {
        return res.status(500).json({
          error: 'No se pudo actualizar la póliza'
        });
      }

      // Registrar en historial
      try {
        const historialQuery = `
          INSERT INTO poliza_estados_historial 
          (poliza_id, estado_anterior, estado_nuevo, motivo, changed_by, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `;
        
        await db.execute(historialQuery, [
          id, 
          polizaActual.estado,
          estado,
          motivo_cambio_estado,
          user_id
        ]);
      } catch (historialError) {
        console.log('⚠️ No se pudo registrar en historial:', historialError.message);
      }

      // ✅ Si el estado cambia a "venta_cerrada", actualizar asignaciones a "Venta" y exportar a Google Sheets
      if (estado === 'venta_cerrada') {
        try {
          const queryAsignacion = `
            UPDATE asignaciones a
            INNER JOIN polizas p ON a.id_prospecto = p.prospecto_id
            SET 
              a.estado = 'Venta',
              a.fecha_estado = NOW(),
              a.comentario = CONCAT(
                IFNULL(a.comentario, ''), 
                IF(a.comentario IS NOT NULL AND a.comentario != '', '\n', ''),
                'Estado actualizado automáticamente a "Venta" por cierre de póliza #', 
                IFNULL(p.numero_poliza_oficial, p.numero_poliza),
                ' - ', NOW()
              )
            WHERE p.id = ? AND a.estado != 'Venta'
          `;
          
          const [updateAsignacion] = await db.execute(queryAsignacion, [id]);
          
          if (updateAsignacion.affectedRows > 0) {
            console.log(`✅ Back Office: Asignación actualizada a "Venta"`);
          }
          
        } catch (asignacionError) {
          console.error('⚠️ Error actualizando asignación:', asignacionError.message);
        }

        // ✅ NUEVO: Exportar póliza cerrada a Google Sheets desde Back Office
        try {
          console.log('📊 Back Office: Exportando póliza cerrada a Google Sheets...');
          
          await GoogleSheetsPolizasService.agregarPolizaCerrada(
            id, 
            motivo_cambio_estado || ''
          );
          
          console.log('✅ Póliza exportada a Google Sheets exitosamente desde Back Office');
        } catch (sheetsError) {
          console.error('⚠️ Error exportando a Google Sheets desde Back Office:', sheetsError.message);
          // No fallar la operación principal por este error
        }

        // 📊 Sincronizar estado 'Venta' en planilla de prospectos
        if (polizaActual.prospecto_id) {
          try {
            const GoogleSheetsService = require('../../services/googleSheetsService');
            await GoogleSheetsService.actualizarAsignacionEnSheet(polizaActual.prospecto_id);
            console.log(`📊 Planilla de prospectos sincronizada para prospecto ${polizaActual.prospecto_id}`);
          } catch (prospectoSheetError) {
            console.error('⚠️ Error sincronizando planilla de prospectos:', prospectoSheetError.message);
          }
        }
      }

      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: {
          id: id,
          numero_poliza: polizaActual.numero_poliza_oficial || polizaActual.numero_poliza,
          prospecto: `${polizaActual.prospecto_nombre} ${polizaActual.prospecto_apellido}`,
          estado_anterior: polizaActual.estado,
          estado_nuevo: estado,
          mensaje: PolizasBackOfficeController.getMensajeEstado(estado)
        }
      });

    } catch (error) {
      console.error('❌ Error cambiando estado (Back Office):', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  },

  // ✅ VALIDAR TRANSICIONES DE ESTADO - NUEVOS ESTADOS
  validarTransicionEstado(estadoActual, estadoNuevo) {
    const transicionesValidas = {
      'asesor': ['supervisor'],                    // Asesor solo puede pasar a Supervisor
      'supervisor': ['asesor', 'back_office'],     // Supervisor puede devolver a Asesor o pasar a Back Office
      'back_office': ['supervisor', 'venta_cerrada', 'venta_rechazada'], // Back Office puede devolver a Supervisor, cerrar o rechazar
      'venta_cerrada': [],                         // Venta Cerrada es estado final
      'venta_rechazada': []                        // Venta Rechazada es estado final
    };

    const estadosPermitidos = transicionesValidas[estadoActual] || [];
    
    return {
      valida: estadosPermitidos.includes(estadoNuevo),
      razon: estadosPermitidos.includes(estadoNuevo) 
        ? null 
        : `No se puede cambiar de '${estadoActual}' a '${estadoNuevo}'. Estados permitidos: ${estadosPermitidos.join(', ')}`
    };
  },

  // ✅ MENSAJES AMIGABLES PARA ESTADOS - NUEVOS ESTADOS
  getMensajeEstado(estado) {
    const mensajes = {
      'asesor': 'Póliza en revisión por Asesor',
      'supervisor': 'Póliza en revisión por Supervisor',
      'back_office': 'Póliza en proceso de Back Office',
      'venta_cerrada': 'Venta cerrada exitosamente',
      'venta_rechazada': 'Ingreso rechazado por Back Office'
    };
    
    return mensajes[estado] || 'Estado desconocido';
  },

  // ✅ NUEVA FUNCIÓN: Obtener historial de estados
  async obtenerHistorialEstados(req, res) {
    try {
      const { id } = req.params;

      console.log('📋 Back Office obteniendo historial de estados para póliza:', id);

      // ✅ SIN RESTRICCIONES: Cualquier póliza del sistema
      const query = `
        SELECT 
          h.*,
          u.first_name as usuario_nombre,
          u.last_name as usuario_apellido,
          u.email as usuario_email
        FROM poliza_estados_historial h
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.poliza_id = ?
        ORDER BY h.created_at DESC
      `;

      const [historial] = await db.execute(query, [id]);

      res.json({
        success: true,
        data: historial.map(item => ({
          id: item.id,
          estado_anterior: item.estado_anterior,
          estado_nuevo: item.estado_nuevo,
          motivo: item.motivo,
          fecha: item.created_at,
          usuario: {
            id: item.changed_by,
            nombre: item.usuario_nombre,
            apellido: item.usuario_apellido,
            email: item.usuario_email
          }
        }))
      });

    } catch (error) {
      console.error('❌ Error obteniendo historial (Back Office):', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo historial de estados',
        message: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Obtener póliza para edición
  async obtenerPolizaParaEdicion(req, res) {
    try {
      const { id } = req.params;

      console.log('📝 Back Office obteniendo póliza completa para edición:', id);

      // ✅ SIN RESTRICCIONES: Cualquier póliza del sistema
      const query = `
        SELECT 
          p.*,
          pr.nombre as prospecto_nombre,
          pr.apellido as prospecto_apellido,
          pr.correo as prospecto_email,
          pr.edad as prospecto_edad,
          pr.numero_contacto as prospecto_telefono,
          pr.localidad as prospecto_localidad,
          pr.tipo_afiliacion_id,
          pr.grupo_familiar as prospecto_grupo_familiar,
          pr.sueldo_bruto as prospecto_sueldo_bruto,
          pr.categoria_monotributo as prospecto_categoria_monotributo,
          c.total_final,
          c.total_bruto,
          c.total_descuento_aporte,
          c.total_descuento_promocion,
          c.anio as anio_plan,
          pl.nombre as plan_nombre,
          pl.id as plan_id,
          ta.etiqueta as tipo_afiliacion_nombre,
          u.first_name as creador_nombre,
          u.last_name as creador_apellido,
          u.email as creador_email,
          ur.first_name as revisor_nombre,
          ur.last_name as revisor_apellido,
          ur.email as revisor_email
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN users ur ON p.revisado_por = ur.id
        WHERE p.id = ? AND p.deleted_at IS NULL
      `;

      const [polizas] = await db.execute(query, [id]);

      if (polizas.length === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      const poliza = polizas[0];

      // ✅ Cargar detalles de cotización para que EditarPolizaModal
      // muestre correctamente el plan, precio y promos (igual que PolizaForm)
      let cotizacionDetalles = [];
      if (poliza.cotizacion_id) {
        try {
          const [detalles] = await db.execute(`
            SELECT 
              cd.id,
              cd.persona,
              cd.vinculo,
              cd.edad,
              cd.tipo_afiliacion_id,
              cd.precio_base,
              cd.descuento_aporte,
              cd.descuento_promocion,
              cd.promocion_aplicada,
              cd.precio_final
            FROM cotizaciones_detalles cd
            WHERE cd.cotizacion_id = ?
            ORDER BY cd.id
          `, [poliza.cotizacion_id]);
          cotizacionDetalles = detalles;
        } catch (e) {
          console.warn('⚠️ No se pudieron cargar detalles de cotización:', e.message);
        }
      }

      // Parsear campos JSON
      const camposJson = [
        'datos_personales',
        'integrantes', 
        'documentos_titular',
        'documentos_integrantes',
        'referencias',
        'declaracion_salud',
        'cobertura_anterior',
        'datos_adicionales',
        'informacion_afiliado',
        'informacion_facturacion',
        'solicitud_afiliacion',
        'datos_comerciales'
      ];

      camposJson.forEach(campo => {
        try {
          if (poliza[campo]) {
            if (typeof poliza[campo] === 'string') {
              poliza[campo] = JSON.parse(poliza[campo]);
            }
          } else {
            if (['integrantes', 'referencias', 'documentos_titular', 'documentos_integrantes'].includes(campo)) {
              poliza[campo] = [];
            } else {
              poliza[campo] = {};
            }
          }
        } catch (parseError) {
          console.error(`Error parseando campo ${campo}:`, parseError);
          if (['integrantes', 'referencias', 'documentos_titular', 'documentos_integrantes'].includes(campo)) {
            poliza[campo] = [];
          } else {
            poliza[campo] = {};
          }
        }
      });

      // Normalizar declaración de salud
      if (poliza.declaracion_salud && poliza.declaracion_salud.respuestas) {
        if (typeof poliza.declaracion_salud.respuestas === 'object') {
          poliza.declaracion_salud.respuestas_por_integrante = poliza.declaracion_salud.respuestas;
          
          if (poliza.declaracion_salud.respuestas["0"]) {
            poliza.declaracion_salud.respuestas_titular = poliza.declaracion_salud.respuestas["0"];
          }
        }
      }

      const polizaCompleta = {
        id: poliza.id,
        prospecto_id: poliza.prospecto_id,
        cotizacion_id: poliza.cotizacion_id,
        numero_poliza: poliza.numero_poliza_oficial || poliza.numero_poliza,
        estado: poliza.estado,
        estado_anterior: poliza.estado_anterior,
        fecha_cambio_estado: poliza.fecha_cambio_estado,
        motivo_cambio_estado: poliza.motivo_cambio_estado,
        
        created_at: poliza.created_at,
        updated_at: poliza.updated_at,
        fecha_finalizacion: poliza.fecha_finalizacion,
        fecha_revision: poliza.fecha_revision,
        fecha_aceptacion_terminos: poliza.fecha_aceptacion_terminos,
        
        datos_personales: poliza.datos_personales,
        integrantes: poliza.integrantes,
        documentos_titular: poliza.documentos_titular,
        documentos_integrantes: poliza.documentos_integrantes,
        referencias: poliza.referencias,
        declaracion_salud: poliza.declaracion_salud,
        cobertura_anterior: poliza.cobertura_anterior,
        datos_adicionales: poliza.datos_adicionales,
        informacion_afiliado: poliza.informacion_afiliado,
        informacion_facturacion: poliza.informacion_facturacion,
        solicitud_afiliacion: poliza.solicitud_afiliacion,
        datos_comerciales: poliza.datos_comerciales,
        
        observaciones: poliza.observaciones,
        terminos_aceptados: poliza.terminos_aceptados,
        
        prospecto: {
          id: poliza.prospecto_id,
          nombre: poliza.prospecto_nombre,
          apellido: poliza.prospecto_apellido,
          email: resolverEmailProspecto(poliza),
          telefono: poliza.prospecto_telefono,
          localidad: poliza.prospecto_localidad,
          edad: poliza.prospecto_edad,
          grupo_familiar: poliza.prospecto_grupo_familiar,
          sueldo_bruto: poliza.prospecto_sueldo_bruto,
          categoria_monotributo: poliza.prospecto_categoria_monotributo,
          tipo_afiliacion_id: poliza.tipo_afiliacion_id,
          tipo_afiliacion_nombre: poliza.tipo_afiliacion_nombre,
          direccion: poliza.datos_personales?.direccion || '',
          cod_postal: poliza.datos_personales?.cod_postal || '',
          nacionalidad: poliza.datos_personales?.nacionalidad || '',
          condicion_iva: poliza.datos_personales?.condicion_iva || ''
        },
        
        plan: {
          id: poliza.plan_id,
          nombre: poliza.plan_nombre,
          anio: poliza.anio_plan
        },
        
        cotizacion: {
          total_final: poliza.total_final,
          total_bruto: poliza.total_bruto,
          total_descuento_aporte: poliza.total_descuento_aporte,
          total_descuento_promocion: poliza.total_descuento_promocion,
          detalles: cotizacionDetalles
        },
        
        creador: poliza.created_by ? {
          id: poliza.created_by,
          nombre: poliza.creador_nombre,
          apellido: poliza.creador_apellido,
          email: poliza.creador_email
        } : null,
        
        revisor: poliza.revisado_por ? {
          id: poliza.revisado_por,
          nombre: poliza.revisor_nombre,
          apellido: poliza.revisor_apellido,
          email: poliza.revisor_email
        } : null
      };

      res.json({
        success: true,
        data: polizaCompleta,
        campos_editables: [
          'datos_personales',
          'integrantes', 
          'documentos_titular',
          'documentos_integrantes',
          'referencias',
          'declaracion_salud',
          'cobertura_anterior',
          'datos_adicionales',
          'informacion_afiliado',
          'informacion_facturacion', 
          'solicitud_afiliacion',
          'datos_comerciales',
          'observaciones',
          'terminos_aceptados'
        ]
      });

    } catch (error) {
      console.error('❌ Error obteniendo póliza para edición (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo póliza',
        message: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Actualizar datos de la póliza
  async actualizarPoliza(req, res) {
    try {
      const { id } = req.params;
      const { 
        datos_personales, 
        integrantes, 
        documentos_titular,
        documentos_integrantes,
        referencias, 
        declaracion_salud, 
        cobertura_anterior, 
        datos_adicionales,
        informacion_afiliado,
        informacion_facturacion,
        solicitud_afiliacion,
        datos_comerciales,
        observaciones,
        terminos_aceptados,
        motivo 
      } = req.body;
      const user_id = req.user.id;

      console.log('📝 Back Office actualizando póliza completa:', id);

      // ✅ SIN RESTRICCIONES: Cualquier póliza del sistema
      const [polizaExistente] = await db.execute('SELECT * FROM polizas WHERE id = ? AND deleted_at IS NULL', [id]);
      
      if (polizaExistente.length === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // ✅ Sync peso/altura desde datos_fisicos de declaracion_salud hacia datos_personales
      const datosPersonalesSincronizados = { ...(datos_personales || {}) };
      const datosFisicosBO = declaracion_salud?.datos_fisicos;
      if (datosFisicosBO) {
        if (datosFisicosBO.titular_peso !== undefined && datosFisicosBO.titular_peso !== '') {
          datosPersonalesSincronizados.peso = datosFisicosBO.titular_peso;
        }
        if (datosFisicosBO.titular_altura !== undefined && datosFisicosBO.titular_altura !== '') {
          datosPersonalesSincronizados.altura = datosFisicosBO.titular_altura;
        }
      }

      // ✅ Sincronizar peso/altura de datos_fisicos.integrantes → integrantes[idx]
      const datosFisicosIntsBO = declaracion_salud?.datos_fisicos?.integrantes;
      let integrantesBO = integrantes || [];
      if (Array.isArray(datosFisicosIntsBO) && Array.isArray(integrantesBO)) {
        integrantesBO = integrantesBO.map((integrante, idx) => {
          const fisico = datosFisicosIntsBO[idx];
          if (!fisico) return integrante;
          return {
            ...integrante,
            peso: fisico.peso !== undefined && fisico.peso !== '' ? fisico.peso : integrante.peso,
            altura: fisico.altura !== undefined && fisico.altura !== '' ? fisico.altura : integrante.altura
          };
        });
      }

      const updateQuery = `
        UPDATE polizas 
        SET 
          datos_personales = ?,
          integrantes = ?,
          documentos_titular = ?,
          documentos_integrantes = ?,
          referencias = ?,
          declaracion_salud = ?,
          cobertura_anterior = ?,
          datos_adicionales = ?,
          informacion_afiliado = ?,
          informacion_facturacion = ?,
          solicitud_afiliacion = ?,
          datos_comerciales = ?,
          observaciones = ?,
          terminos_aceptados = ?,
          numero_poliza_oficial = COALESCE(?, numero_poliza_oficial),
          updated_at = NOW(),
          motivo_cambio_estado = ?,
          revisado_por = ?
        WHERE id = ? AND deleted_at IS NULL
      `;

      const updateParams = [
        JSON.stringify(datosPersonalesSincronizados),
        JSON.stringify(integrantesBO || []),
        JSON.stringify(documentos_titular || []),
        JSON.stringify(documentos_integrantes || []),
        JSON.stringify(referencias || []),
        JSON.stringify(declaracion_salud || {}),
        JSON.stringify(cobertura_anterior || {}),
        JSON.stringify(datos_adicionales || {}),
        JSON.stringify(informacion_afiliado || {}),
        JSON.stringify(informacion_facturacion || {}),
        JSON.stringify(solicitud_afiliacion || {}),
        JSON.stringify(datos_comerciales || {}),
        observaciones || null,
        terminos_aceptados ? 1 : 0,
        datosPersonalesSincronizados.numero_poliza_vendedor || null,
        motivo || 'Póliza editada por Back Office',
        user_id,
        id
      ];

      const [result] = await db.execute(updateQuery, updateParams);

      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'No se pudo actualizar la póliza' });
      }

      console.log('✅ Póliza actualizada exitosamente por Back Office');

      // ✅ Actualizar correo en tabla prospectos si se envió
      const correoNuevoBO = datosPersonalesSincronizados.correo || datosPersonalesSincronizados.email;
      if (correoNuevoBO && polizaExistente[0].prospecto_id) {
        await db.execute('UPDATE prospectos SET correo = ? WHERE id = ?', [correoNuevoBO, polizaExistente[0].prospecto_id]);
        console.log('✅ Correo actualizado en prospectos (backoffice):', correoNuevoBO);
      }

      res.json({
        success: true,
        message: 'Póliza actualizada correctamente',
        data: {
          id: id,
          numero_poliza: polizaExistente[0].numero_poliza_oficial || polizaExistente[0].numero_poliza,
          updated_at: new Date(),
          campos_actualizados: [
            'datos_personales',
            'integrantes', 
            'documentos_titular',
            'documentos_integrantes',
            'referencias',
            'declaracion_salud',
            'cobertura_anterior',
            'datos_adicionales',
            'informacion_afiliado',
            'informacion_facturacion',
            'solicitud_afiliacion',
            'datos_comerciales',
            'observaciones',
            'terminos_aceptados'
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error actualizando póliza (Back Office):', error);
      res.status(500).json({
        error: 'Error actualizando póliza',
        message: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Cargar múltiples documentos
  async cargarMultiplesDocumentos(req, res) {
    const uploadMultiple = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 6
      },
      fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Solo se permiten archivos PDF, JPG, PNG, DOC y DOCX'));
        }
      }
    }).array('documentos', 6);

    uploadMultiple(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Máximo 6 documentos permitidos por carga.'
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Uno o más archivos son demasiado grandes. Máximo 10MB por archivo.'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Error al subir archivos: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      try {
        const { poliza_id: polizaId, tipos_documentos, observaciones } = req.body;
        const backoffice_user_id = req.user.id;
        
        console.log('📎 Back Office cargando múltiples documentos para póliza:', {
          polizaId,
          cantidad_archivos: req.files?.length || 0,
          backoffice_user_id
        });

        // ✅ SIN RESTRICCIONES: Verificar que la póliza existe en el sistema
        const [polizaExistente] = await db.execute(
          `SELECT p.*, pr.nombre as prospecto_nombre, pr.apellido as prospecto_apellido
           FROM polizas p
           LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
           WHERE p.id = ? AND p.deleted_at IS NULL`,
          [polizaId]
        );

        if (polizaExistente.length === 0) {
          if (req.files) {
            for (const file of req.files) {
              try {
                await fs.unlink(file.path);
              } catch (unlinkError) {
                console.error('Error eliminando archivo:', unlinkError);
              }
            }
          }
          return res.status(404).json({
            success: false,
            message: 'Póliza no encontrada'
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionaron archivos'
          });
        }

        let tiposDocumento = [];
        if (tipos_documentos) {
          try {
            tiposDocumento = JSON.parse(tipos_documentos);
          } catch (e) {
            console.error('Error parseando tipos_documentos:', e);
            tiposDocumento = [];
          }
        }

        const [documentosExistentes] = await db.execute(
          'SELECT COUNT(*) as total FROM poliza_documentos WHERE poliza_id = ?',
          [polizaId]
        );

        const totalExistentes = documentosExistentes[0].total;
        const totalNuevos = req.files.length;

        if (totalExistentes + totalNuevos > 20) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (unlinkError) {
              console.error('Error eliminando archivo:', unlinkError);
            }
          }
          return res.status(400).json({
            success: false,
            message: `Límite de documentos excedido. Actualmente tiene ${totalExistentes} documentos. Máximo total: 20 documentos por póliza.`
          });
        }

        const documentosGuardados = [];

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const tipoDocumento = tiposDocumento[i] || 'documento_adicional';

          const pathRelativo = path.relative('/var/www/uploads', file.path);
          const publicHash = crypto.randomBytes(16).toString('hex');

          const insertQuery = `
            INSERT INTO poliza_documentos 
            (poliza_id, tipo_documento, nombre_original, nombre_archivo, ruta_archivo, tamaño_bytes, tipo_mime, observaciones, subido_por, fecha_subida, public_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
          `;

          const [insertResult] = await db.execute(insertQuery, [
            polizaId,
            tipoDocumento,
            file.originalname,
            file.filename,
            pathRelativo,
            file.size,
            file.mimetype,
            observaciones || `Documento cargado por Back Office - ${tipoDocumento}`,
            backoffice_user_id,
            publicHash
          ]);

          documentosGuardados.push({
            id: insertResult.insertId,
            tipo_documento: tipoDocumento,
            nombre_original: file.originalname,
            nombre_archivo: file.filename,
            tamaño_bytes: file.size,
            tipo_mime: file.mimetype,
            fecha_subida: new Date(),
            urls: {
              download: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/backoffice/polizas/documentos/${insertResult.insertId}/download`,
              preview: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/backoffice/polizas/documentos/${insertResult.insertId}/preview`
            }
          });
        }

        try {
          await db.execute(
            `INSERT INTO poliza_estados_historial 
             (poliza_id, estado_anterior, estado_nuevo, motivo, changed_by, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
              polizaId,
              polizaExistente[0].estado,
              polizaExistente[0].estado,
              `Se cargaron ${documentosGuardados.length} documentos adicionales por Back Office`,
              backoffice_user_id
            ]
          );
        } catch (historialError) {
          console.warn('⚠️ Error registrando en historial:', historialError.message);
        }

        res.json({
          success: true,
          message: `${documentosGuardados.length} documentos cargados exitosamente`,
          data: {
            poliza_id: polizaId,
            numero_poliza: polizaExistente[0].numero_poliza_oficial || polizaExistente[0].numero_poliza,
            prospecto: `${polizaExistente[0].prospecto_nombre} ${polizaExistente[0].prospecto_apellido}`,
            documentos_cargados: documentosGuardados.length,
            total_documentos_poliza: totalExistentes + documentosGuardados.length,
            documentos: documentosGuardados
          }
        });

      } catch (error) {
        console.error('❌ Error cargando múltiples documentos (Back Office):', error);
        
        if (req.files) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (unlinkError) {
              console.error('Error eliminando archivo:', unlinkError);
            }
          }
        }

        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: error.message
        });
      }
    });
  },

  // ✅ NUEVA FUNCIÓN: Actualizar documento
  async actualizarDocumento(req, res) {
    upload.single('documento')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'El archivo es demasiado grande. Máximo 10MB permitido.'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Error al subir archivo: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      try {
        const { documentoId } = req.params;
        const { motivo_actualizacion } = req.body;
        const backoffice_user_id = req.user.id;

        console.log('📝 Back Office actualizando documento:', { documentoId, backoffice_user_id });

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionó archivo'
          });
        }

        // ✅ SIN RESTRICCIONES: Cualquier documento del sistema
        const [documentoExistente] = await db.execute(
          'SELECT * FROM poliza_documentos WHERE id = ?',
          [documentoId]
        );

        if (documentoExistente.length === 0) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error eliminando archivo:', unlinkError);
          }
          return res.status(404).json({
            success: false,
            message: 'Documento no encontrado'
          });
        }

        const documento = documentoExistente[0];

        try {
          const archivoAnterior = path.join('uploads/polizas/', documento.nombre_archivo);
          await fs.unlink(archivoAnterior);
          console.log('🗑️ Archivo anterior eliminado:', archivoAnterior);
        } catch (unlinkError) {
          console.warn('⚠️ No se pudo eliminar archivo anterior:', unlinkError.message);
        }

        const updateQuery = `
          UPDATE poliza_documentos 
          SET 
            nombre_archivo = ?,
            nombre_original = ?,
            tipo_mime = ?,
            tamaño_bytes = ?,
            updated_at = CURRENT_TIMESTAMP,
            actualizado_por = ?
          WHERE id = ?
        `;

        await db.execute(updateQuery, [
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          backoffice_user_id,
          documentoId
        ]);

        try {
          await db.execute(
            `INSERT INTO poliza_documentos_historial 
             (documento_id, accion, motivo, usuario_id, archivo_anterior, archivo_nuevo, created_at) 
             VALUES (?, 'actualizado', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              documentoId,
              motivo_actualizacion || 'Documento actualizado por Back Office',
              backoffice_user_id,
              documento.nombre_archivo,
              req.file.filename
            ]
          );
        } catch (logError) {
          console.warn('⚠️ Error registrando historial:', logError.message);
        }

        res.json({
          success: true,
          message: 'Documento actualizado correctamente',
          data: {
            id: documentoId,
            nombre_archivo: req.file.filename,
            nombre_original: req.file.originalname,
            tipo_mime: req.file.mimetype,
            tamaño_bytes: req.file.size
          }
        });

      } catch (error) {
        console.error('❌ Error actualizando documento (Back Office):', error);
        
        if (req.file) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error eliminando archivo:', unlinkError);
          }
        }

        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: error.message
        });
      }
    });
  },

  // ✅ NUEVA FUNCIÓN: Obtener tipos de documentos disponibles
  async obtenerTiposDocumentos(req, res) {
    try {
      const tiposDocumentos = [
        {
          valor: 'codem',
          etiqueta: 'CODEM',
          descripcion: 'Certificado de Domicilio Electrónico (CODEM)',
          requerido: false,
          icono: 'file-text'
        },
        {
          valor: 'formulario_f152',
          etiqueta: 'Formulario F152',
          descripcion: 'Formulario F152 - Constancia de ingresos',
          requerido: false,
          icono: 'form'
        },
        {
          valor: 'formulario_f184',
          etiqueta: 'Formulario F184',
          descripcion: 'Formulario F184 - Información complementaria',
          requerido: false,
          icono: 'form'
        },
        {
          valor: 'constancia_inscripcion',
          etiqueta: 'Constancia de Inscripción',
          descripcion: 'Constancia de inscripción en registros oficiales',
          requerido: false,
          icono: 'clipboard-check'
        },
        {
          valor: 'comprobante_pago_cuota',
          etiqueta: 'Comprobante de Pago de Cuota',
          descripcion: 'Comprobantes de pago de la cuota (pueden ser múltiples)',
          requerido: false,
          icono: 'receipt'
        },
        {
          valor: 'estudios_medicos',
          etiqueta: 'Estudios Médicos',
          descripcion: 'Resultados de estudios médicos y análisis',
          requerido: false,
          icono: 'activity'
        },
        {
          valor: 'poliza_firmada',
          etiqueta: 'Póliza Firmada por Cliente',
          descripcion: 'Documento de póliza con firma del cliente',
          requerido: true,
          icono: 'document-check'
        },
        {
          valor: 'auditoria_medica',
          etiqueta: 'Auditoría Médica',
          descripcion: 'Resultado de la auditoría médica',
          requerido: true,
          icono: 'clipboard-list'
        },
        {
          valor: 'documento_identidad_adicional',
          etiqueta: 'Documento de Identidad Adicional',
          descripcion: 'DNI, pasaporte u otro documento de identidad',
          requerido: false,
          icono: 'identification'
        },
        {
          valor: 'autorizacion_debito',
          etiqueta: 'Autorización de Débito',
          descripcion: 'Autorización para débito automático',
          requerido: false,
          icono: 'credit-card'
        },
        {
          valor: 'documento_adicional',
          etiqueta: 'Documento Adicional',
          descripcion: 'Cualquier otro documento relacionado',
          requerido: false,
          icono: 'document-plus'
        }
      ];

      res.json({
        success: true,
        data: tiposDocumentos,
        total: tiposDocumentos.length
      });

    } catch (error) {
      console.error('❌ Error obteniendo tipos de documentos (Back Office):', error);
      res.status(500).json({ 
        error: 'Error obteniendo tipos de documentos',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Preview de documento
  async previsualizarDocumento(req, res) {
    try {
      const { documentoId } = req.params;

      // ✅ SIN RESTRICCIONES: Cualquier documento del sistema
      const query = `
        SELECT 
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tipo_mime,
          d.tipo_documento,
          p.numero_poliza_oficial || p.numero_poliza as numero_poliza,
          pr.nombre as prospecto_nombre,
          pr.apellido as prospecto_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        INNER JOIN prospectos pr ON p.prospecto_id = pr.id
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
        return res.status(404).json({ 
          error: 'Archivo no encontrado en el servidor',
          ruta: rutaCompleta 
        });
      }

      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Documento-Tipo', documento.tipo_documento);
      res.setHeader('X-Poliza-Numero', documento.numero_poliza);
      res.setHeader('X-Prospecto-Nombre', `${documento.prospecto_nombre} ${documento.prospecto_apellido}`);

      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error previsualizando documento (Back Office):', error);
      res.status(500).json({ 
        error: 'Error previsualizando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Obtener estadísticas de documentos
  async obtenerEstadisticasDocumentos(req, res) {
    try {
      const { id: polizaId } = req.params;

      let whereClause = '';
      let queryParams = [];

      if (polizaId) {
        // ✅ SIN RESTRICCIONES: Verificar cualquier póliza del sistema
        const [polizaAcceso] = await db.execute(
          `SELECT p.numero_poliza_oficial || p.numero_poliza as numero_poliza
           FROM polizas p
           WHERE p.id = ? AND p.deleted_at IS NULL`,
          [polizaId]
        );

        if (polizaAcceso.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Póliza no encontrada'
          });
        }

        whereClause = 'WHERE pd.poliza_id = ?';
        queryParams = [polizaId];
      } else {
        // Estadísticas generales de todo el sistema
        whereClause = 'WHERE 1=1';
        queryParams = [];
      }

      const [estadisticas] = await db.execute(`
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(CASE WHEN pd.tipo_documento = 'poliza_firmada' THEN 1 END) as polizas_firmadas,
          COUNT(CASE WHEN pd.tipo_documento = 'auditoria_medica' THEN 1 END) as auditorias_medicas,
          COUNT(CASE WHEN pd.tipo_documento = 'documento_identidad_adicional' THEN 1 END) as documentos_identidad,
          COUNT(CASE WHEN pd.tipo_documento = 'comprobante_ingresos' THEN 1 END) as comprobantes_ingresos,
          COUNT(CASE WHEN pd.tipo_documento = 'autorizacion_debito' THEN 1 END) as autorizaciones_debito,
          COUNT(CASE WHEN pd.tipo_documento = 'documento_adicional' THEN 1 END) as documentos_adicionales,
          SUM(pd.tamaño_bytes) as tamaño_total_bytes,
          MAX(pd.fecha_subida) as ultimo_documento_subido,
          MIN(pd.fecha_subida) as primer_documento_subido
        FROM poliza_documentos pd
        INNER JOIN polizas p ON pd.poliza_id = p.id
        ${whereClause}
      `, queryParams);

      const stats = estadisticas[0];
      const tamañoTotalMB = stats.tamaño_total_bytes ? (stats.tamaño_total_bytes / (1024 * 1024)).toFixed(2) : 0;

      const documentosRequeridos = {
        poliza_firmada: stats.polizas_firmadas > 0,
        auditoria_medica: stats.auditorias_medicas > 0
      };

      const documentosCompletos = Object.values(documentosRequeridos).every(Boolean);

      const responseData = {
        total_documentos: stats.total_documentos,
        tamaño_total_mb: tamañoTotalMB,
        documentos_por_tipo: {
          poliza_firmada: stats.polizas_firmadas,
          auditoria_medica: stats.auditorias_medicas,
          documento_identidad_adicional: stats.documentos_identidad,
          comprobante_ingresos: stats.comprobantes_ingresos,
          autorizacion_debito: stats.autorizaciones_debito,
          documento_adicional: stats.documentos_adicionales
        },
        documentos_requeridos: documentosRequeridos,
        documentos_completos: documentosCompletos,
        fechas: {
          primer_documento: stats.primer_documento_subido,
          ultimo_documento: stats.ultimo_documento_subido
        },
        limite_documentos: {
          maximo_total: 20,
          restantes: Math.max(0, 20 - stats.total_documentos),
          maximo_por_carga: 6
        }
      };

      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de documentos (Back Office):', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas de documentos',
        message: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Eliminar póliza (soft delete)
  async eliminarPoliza(req, res) {
    try {
      const { id } = req.params;
      const { motivo_eliminacion } = req.body;
      const user_id = req.user.id;

      if (!motivo_eliminacion || !motivo_eliminacion.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un motivo para eliminar la póliza'
        });
      }

      // Obtener la póliza actual (sin importar deleted_at porque no debería ya estar eliminada)
      const queryPoliza = `
        SELECT 
          p.id, p.numero_poliza, p.numero_poliza_oficial, p.estado,
          p.deleted_at,
          /* Estado de firma agregado */
          CASE 
            WHEN pvea.any_signed = 1 THEN 'signed'
            WHEN pvea.any_pending = 1 THEN 'pending'
            ELSE NULL
          END AS estado_firma,
          pvea.last_enviado_en AS enviado_en
        FROM polizas p
        LEFT JOIN (
          SELECT 
            poliza_id,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed') THEN 1 ELSE 0 END) AS any_signed,
            MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('pending') THEN 1 ELSE 0 END) AS any_pending,
            MAX(enviado_en) AS last_enviado_en
          FROM polizas_vafirma_envios
          GROUP BY poliza_id
        ) pvea ON pvea.poliza_id = p.id
        WHERE p.id = ?
      `;

      const [polizas] = await db.execute(queryPoliza, [id]);

      if (polizas.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Póliza no encontrada'
        });
      }

      const poliza = polizas[0];

      // Verificar que no esté ya eliminada
      if (poliza.deleted_at) {
        return res.status(400).json({
          success: false,
          error: 'La póliza ya fue eliminada anteriormente'
        });
      }

      // Verificar que no esté en estado venta_cerrada
      if (poliza.estado === 'venta_cerrada') {
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar una póliza con venta cerrada'
        });
      }

      // La póliza puede eliminarse aunque tenga una solicitud de firma (pendiente o firmada):
      // el registro de solicitud de firma (polizas_vafirma_envios) se elimina junto con la póliza.
      // El front debe advertir esto al usuario de back office antes de confirmar.
      const fueEnviadaFirma = poliza.enviado_en ||
        poliza.estado_firma === 'pending' ||
        poliza.estado_firma === 'signed';

      // Soft delete: marcar como eliminada
      const updateQuery = `
        UPDATE polizas
        SET
          deleted_at = NOW(),
          deleted_by = ?,
          motivo_eliminacion = ?
        WHERE id = ?
      `;

      await db.execute(updateQuery, [user_id, motivo_eliminacion.trim(), id]);

      // Si había una solicitud de firma asociada, eliminar también ese registro
      let registrosFirmaEliminados = 0;
      if (fueEnviadaFirma) {
        try {
          const [resultFirma] = await db.execute(
            'DELETE FROM polizas_vafirma_envios WHERE poliza_id = ?',
            [id]
          );
          registrosFirmaEliminados = resultFirma.affectedRows || 0;
          console.log(`🗑️ Registro(s) de solicitud de firma eliminado(s) para póliza ${id}: ${registrosFirmaEliminados}`);
        } catch (firmaError) {
          console.error('⚠️ No se pudo eliminar el registro de solicitud de firma:', firmaError.message);
        }
      }

      // Registrar en historial de estados
      try {
        await db.execute(
          `INSERT INTO poliza_estados_historial
           (poliza_id, estado_anterior, estado_nuevo, motivo, changed_by, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, poliza.estado, 'eliminada', motivo_eliminacion.trim(), user_id]
        );
      } catch (historialError) {
        console.error('⚠️ No se pudo registrar historial de eliminación:', historialError.message);
      }

      console.log(`🗑️ Póliza ${poliza.numero_poliza_oficial || poliza.numero_poliza} eliminada por usuario ${user_id}. Motivo: ${motivo_eliminacion}`);

      res.json({
        success: true,
        message: 'Póliza eliminada correctamente',
        data: {
          id: poliza.id,
          numero_poliza: poliza.numero_poliza_oficial || poliza.numero_poliza,
          registrosFirmaEliminados
        }
      });

    } catch (error) {
      console.error('❌ Error eliminando póliza (Back Office):', error);
      res.status(500).json({
        success: false,
        error: 'Error eliminando póliza',
        message: error.message
      });
    }
  }
};

// Función auxiliar para obtener nombre del mes
function getMesNombre(numeroMes) {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return meses[parseInt(numeroMes) - 1] || 'Mes desconocido';
}

module.exports = PolizasBackOfficeController;
