const PolizaModel = require('../../models/poliza/polizaModel');
const db = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const axios = require('axios');
// const VaFirmaService = require('../../services/vafirmaService');
const GoogleSheetsPolizasService = require('../../services/googleSheetsPolizasService');
const { resolverEmailProspecto } = require('../../utils/emailProspecto');
const { nombreParaFirma } = require('../../utils/nombreProspecto');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/polizas');
    // Asegurar que el directorio existe
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creando directorio:', error);
      cb(error);
    }
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

const PolizasSupervisorController = {
  // Obtener todas las pólizas con filtros
  async obtenerPolizas(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        estado, 
        vendedor_id,
        desde, 
        hasta, 
        buscar,
        plan,
        orden = 'mas_nuevos'
      } = req.query;

      const supervisor_id = req.user.id; // ID del supervisor logueado

      console.log('📋 Supervisor obteniendo pólizas con filtros:', { 
        supervisor_id, estado, vendedor_id, desde, hasta, buscar, plan, orden 
      });

      // ✅ FILTRO JERÁRQUICO: Solo vendedores asignados al supervisor
      let whereConditions = ['v.supervisor_id = ?', 'p.deleted_at IS NULL']; // Solo vendedores del supervisor, excluir eliminadas
      let queryParams = [supervisor_id];

      // Filtrar por estado
      if (estado && estado !== 'todos') {
        whereConditions.push('p.estado = ?');
        queryParams.push(estado);
      }

      // Filtrar por vendedor específico (debe ser uno asignado al supervisor)
      if (vendedor_id && vendedor_id !== 'todos') {
        whereConditions.push('p.created_by = ?');
        whereConditions.push('v.id = ?'); // Doble verificación que sea vendedor del supervisor
        queryParams.push(vendedor_id, vendedor_id);
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

      // Búsqueda por texto
      if (buscar) {
        whereConditions.push(`(
          p.numero_poliza LIKE ? OR 
          p.numero_poliza_oficial LIKE ? OR
          pr.nombre LIKE ? OR 
          pr.apellido LIKE ? OR 
          pr.numero_contacto LIKE ? OR
          pr.correo LIKE ? OR
          CONCAT(v.first_name, ' ', v.last_name) LIKE ?
        )`);
        const buscarParam = `%${buscar}%`;
        queryParams.push(buscarParam, buscarParam, buscarParam, buscarParam, buscarParam, buscarParam, buscarParam);
      }

      const whereClause = whereConditions.join(' AND ');
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Query principal con joins completos
      // Determinar el ORDER BY basado en el parámetro de orden
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
        case 'mas_nuevos':
        default:
          orderByClause = 'ORDER BY p.created_at DESC';
          break;
      }

      // Query principal
      const query = `
        SELECT 
          p.*,
          pve.estado_firma,
          pve.doc_uuid as referencia_vafirma,
          pve.enviado_en as fecha_envio_firma,
          pve.firmado_en as fecha_firma,
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
          v.email as vendedor_email
        FROM polizas p
        LEFT JOIN polizas_vafirma_envios pve ON p.id = pve.poliza_id
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
        LEFT JOIN users v ON p.created_by = v.id
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
        WHERE ${whereClause}
      `;

      const countParams = queryParams.slice(0, -2);

      // Ejecutar queries
      const [polizas] = await db.execute(query, queryParams);
      const [countResult] = await db.execute(countQuery, countParams);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / parseInt(limit));

      // Formatear respuesta
      const polizasFormateadas = polizas.map(poliza => ({
        id: poliza.id,
        numero_poliza: poliza.numero_poliza,
        numero_poliza_oficial: poliza.numero_poliza_oficial,
        pdf_hash: poliza.pdf_hash, // ✅ AGREGADO PARA DESCARGA PDF UNIFICADA
        estado: poliza.estado,
        created_at: poliza.created_at,
        updated_at: poliza.updated_at,
        fecha_finalizacion: poliza.fecha_finalizacion,
        // ✅ Estado de firma electrónica
        estado_firma: poliza.estado_firma || null,
        fecha_envio_firma: poliza.fecha_envio_firma || null,
        fecha_firma: poliza.fecha_firma || null,
        referencia_vafirma: poliza.referencia_vafirma || null,
        // Datos del prospecto
        prospecto_nombre: poliza.prospecto_nombre,
        prospecto_apellido: poliza.prospecto_apellido,
        prospecto_telefono: poliza.prospecto_telefono,
        prospecto_email: resolverEmailProspecto(poliza),
        prospecto_edad: poliza.prospecto_edad,
        prospecto_localidad: poliza.prospecto_localidad,
        // Datos del plan
        plan_nombre: poliza.plan_nombre,
        anio_plan: poliza.anio_plan,
        total_bruto: poliza.total_bruto,
        total_descuento_aporte: poliza.total_descuento_aporte,
        total_descuento_promocion: poliza.total_descuento_promocion,
        total_final: poliza.total_final,
        // Datos adicionales
        tipo_afiliacion: poliza.tipo_afiliacion_nombre,
        vendedor: {
          nombre: poliza.vendedor_nombre,
          apellido: poliza.vendedor_apellido,
          email: poliza.vendedor_email
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
          plan: plan || 'todos',
          desde,
          hasta,
          buscar
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo pólizas del supervisor:', error);
      res.status(500).json({ 
        error: 'Error obteniendo pólizas',
        message: error.message 
      });
    }
  },

  // Obtener estadísticas globales
  async obtenerEstadisticas(req, res) {
    try {
      const { periodo = 'mes', mes, anio } = req.query;

      let fechaFiltro = '';
      let periodoDescripcion = '';

      // Si se especifica mes y año específicos
      if (mes && anio) {
        fechaFiltro = `YEAR(p.created_at) = ${parseInt(anio)} AND MONTH(p.created_at) = ${parseInt(mes)}`;
        const meses = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        periodoDescripcion = `${meses[parseInt(mes) - 1]} ${anio}`;
      } else {
        // Usar período predefinido
        switch (periodo) {
          case 'dia':
            fechaFiltro = 'DATE(p.created_at) = CURDATE()';
            periodoDescripcion = 'Hoy';
            break;
          case 'semana':
            fechaFiltro = 'YEARWEEK(p.created_at) = YEARWEEK(NOW())';
            periodoDescripcion = 'Esta semana';
            break;
          case 'mes':
            fechaFiltro = 'YEAR(p.created_at) = YEAR(NOW()) AND MONTH(p.created_at) = MONTH(NOW())';
            periodoDescripcion = 'Este mes';
            break;
          case 'año':
            fechaFiltro = 'YEAR(p.created_at) = YEAR(NOW())';
            periodoDescripcion = 'Este año';
            break;
          case 'todos':
            fechaFiltro = '1=1'; // Sin filtro de fecha
            periodoDescripcion = 'Todos los períodos';
            break;
          default:
            fechaFiltro = 'YEAR(p.created_at) = YEAR(NOW()) AND MONTH(p.created_at) = MONTH(NOW())';
            periodoDescripcion = 'Este mes';
        }
      }

      const supervisor_id = req.user.id; // ID del supervisor logueado

      // ✅ FILTRO JERÁRQUICO: Estadísticas solo de vendedores asignados al supervisor
      const statsQuery = `
        SELECT 
          COUNT(*) as total_polizas,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as polizas_en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as polizas_finalizadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          COUNT(DISTINCT p.created_by) as vendedores_activos,
          MIN(p.created_at) as primera_poliza,
          MAX(p.created_at) as ultima_poliza
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        INNER JOIN users v ON p.created_by = v.id AND v.supervisor_id = ?
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
      `;

      // ✅ FILTRO JERÁRQUICO: Top vendedores asignados al supervisor
      const vendedoresQuery = `
        SELECT 
          u.first_name,
          u.last_name,
          u.email,
          COUNT(p.id) as total_polizas,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as polizas_en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as polizas_finalizadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          ROUND((COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) / COUNT(p.id)) * 100, 2) as tasa_finalizacion
        FROM polizas p
        INNER JOIN users u ON p.created_by = u.id AND u.supervisor_id = ?
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
        GROUP BY p.created_by, u.first_name, u.last_name, u.email
        HAVING COUNT(p.id) > 0
        ORDER BY total_polizas DESC
        LIMIT 5
      `;

      // ✅ FILTRO JERÁRQUICO: Top planes de vendedores asignados al supervisor
      const planesQuery = `
        SELECT 
          pl.nombre as plan_nombre,
          COUNT(p.id) as cantidad_total,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as cantidad_en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as cantidad_finalizada,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          COALESCE(AVG(c.total_final), 0) as precio_promedio,
          ROUND((COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) / COUNT(p.id)) * 100, 2) as tasa_finalizacion
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        INNER JOIN users v ON p.created_by = v.id AND v.supervisor_id = ?
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
        GROUP BY pl.id, pl.nombre
        HAVING COUNT(p.id) > 0
        ORDER BY cantidad_total DESC
        LIMIT 5
      `;

      // ✅ FILTRO JERÁRQUICO: Estadísticas por estado de vendedores asignados
      const estadosQuery = `
        SELECT 
          p.estado,
          COUNT(*) as cantidad,
          COALESCE(SUM(c.total_final), 0) as facturacion,
          ROUND((COUNT(*) / (SELECT COUNT(*) FROM polizas p2 INNER JOIN users v2 ON p2.created_by = v2.id WHERE v2.supervisor_id = ? AND ${fechaFiltro} AND p2.deleted_at IS NULL)) * 100, 2) as porcentaje
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        INNER JOIN users v ON p.created_by = v.id AND v.supervisor_id = ?
        WHERE ${fechaFiltro} AND p.deleted_at IS NULL
        GROUP BY p.estado
        ORDER BY cantidad DESC
      `;

      // ✅ FILTRO JERÁRQUICO: Tendencia de vendedores asignados al supervisor
      const tendenciaQuery = `
        SELECT 
          DATE(p.created_at) as fecha,
          COUNT(*) as nuevas_polizas,
          COUNT(CASE WHEN p.estado IN ('asesor', 'supervisor', 'back_office') THEN 1 END) as en_proceso,
          COUNT(CASE WHEN p.estado IN ('venta_cerrada', 'cerrada') THEN 1 END) as finalizadas,
          COALESCE(SUM(c.total_final), 0) as facturacion_dia
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        INNER JOIN users v ON p.created_by = v.id AND v.supervisor_id = ?
        WHERE p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
          AND p.deleted_at IS NULL
        GROUP BY DATE(p.created_at)
        ORDER BY fecha DESC
      `;

      const [stats] = await db.execute(statsQuery, [supervisor_id]);
      const [vendedores] = await db.execute(vendedoresQuery, [supervisor_id]);
      const [planes] = await db.execute(planesQuery, [supervisor_id]);
      const [estados] = await db.execute(estadosQuery, [supervisor_id, supervisor_id]);
      const [tendencia] = await db.execute(tendenciaQuery, [supervisor_id]);

      const resumenEstadisticas = stats[0];

      res.json({
        success: true,
        periodo: periodo,
        periodo_descripcion: periodoDescripcion,
        filtro_aplicado: { mes, anio, periodo },
        data: {
          resumen: {
            ...resumenEstadisticas,
            // Métricas calculadas según nuevas especificaciones
            tasa_finalizacion: resumenEstadisticas.total_polizas > 0 
              ? ((resumenEstadisticas.polizas_finalizadas / resumenEstadisticas.total_polizas) * 100).toFixed(2)
              : '0',
            tasa_en_proceso: resumenEstadisticas.total_polizas > 0 
              ? ((resumenEstadisticas.polizas_en_proceso / resumenEstadisticas.total_polizas) * 100).toFixed(2)
              : '0',
            poliza_promedio_dia: tendencia.length > 0 
              ? (tendencia.reduce((sum, day) => sum + day.nuevas_polizas, 0) / tendencia.length).toFixed(1)
              : '0'
          },
          top_vendedores: vendedores,
          top_planes: planes,
          distribucion_estados: estados,
          tendencia_semanal: tendencia,
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
      console.error('❌ Error obteniendo estadísticas:', error);
      res.status(500).json({ 
        error: 'Error obteniendo estadísticas',
        message: error.message 
      });
    }
  },

  // Obtener meses disponibles para filtro de estadísticas
  async obtenerMesesDisponibles(req, res) {
    try {
      const supervisor_id = req.user.id; // ID del supervisor logueado
      
      // ✅ FILTRO JERÁRQUICO: Solo meses con datos de vendedores asignados
      const query = `
        SELECT DISTINCT 
          YEAR(p.created_at) as anio,
          MONTH(p.created_at) as mes,
          COUNT(*) as total_polizas
        FROM polizas p
        INNER JOIN users v ON p.created_by = v.id AND v.supervisor_id = ?
        WHERE p.deleted_at IS NULL 
        GROUP BY YEAR(p.created_at), MONTH(p.created_at)
        ORDER BY anio DESC, mes DESC
      `;

      const [resultados] = await db.execute(query, [supervisor_id]);

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
      console.error('❌ Error obteniendo meses disponibles:', error);
      res.status(500).json({ 
        error: 'Error obteniendo meses disponibles',
        message: error.message 
      });
    }
  },

  // Obtener listas para filtros
  async obtenerFiltros(req, res) {
    try {
      const supervisor_id = req.user.id; // ID del supervisor logueado
      
      // ✅ FILTRO JERÁRQUICO: Solo vendedores asignados al supervisor
      const vendedoresQuery = `
        SELECT DISTINCT 
          u.id,
          u.first_name,
          u.last_name,
          u.email
        FROM users u
        INNER JOIN polizas p ON u.id = p.created_by
        WHERE u.role = 1 AND u.supervisor_id = ?
        ORDER BY u.first_name, u.last_name
      `;

      // Obtener planes
      const planesQuery = `
        SELECT DISTINCT pl.nombre
        FROM planes pl
        INNER JOIN cotizaciones c ON pl.id = c.plan_id
        INNER JOIN polizas p ON c.id = p.cotizacion_id
        ORDER BY pl.nombre
      `;

      const [vendedores] = await db.execute(vendedoresQuery, [supervisor_id]);
      const [planes] = await db.execute(planesQuery);

      res.json({
        success: true,
        data: {
          vendedores,
          planes: planes.map(p => p.nombre),
          estados: [
            'asesor', 'supervisor', 'back_office', 'venta_cerrada'
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo filtros:', error);
      res.status(500).json({ 
        error: 'Error obteniendo filtros',
        message: error.message 
      });
    }
  },

  // NUEVA FUNCIÓN: Obtener documentos de una póliza específica
  async obtenerDocumentosPoliza(req, res) {
    try {
      const { id: polizaId } = req.params;

      console.log('📄 Obteniendo documentos para póliza:', polizaId);
      
      // Validar que polizaId existe y es un número
      if (!polizaId || isNaN(polizaId)) {
        return res.status(400).json({ 
          error: 'ID de póliza inválido',
          details: `Parámetro recibido: ${polizaId}` 
        });
      }

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
          -- Datos de la póliza
          p.numero_poliza,
          p.numero_poliza_oficial,
          -- Datos del prospecto titular
          pr.nombre as titular_nombre,
          pr.apellido as titular_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        INNER JOIN prospectos pr ON p.prospecto_id = pr.id
        WHERE d.poliza_id = ?
        ORDER BY d.tipo_documento, d.integrante_index, d.fecha_subida DESC
      `;

      const [documentos] = await db.execute(query, [parseInt(polizaId)]);

      console.log(`📄 Encontrados ${documentos.length} documentos para póliza ${polizaId}`);

      // Formatear documentos agrupados por tipo
      const baseUrl = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online');
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
            // ✅ URLs genéricas que funcionan tanto para supervisores como vendedores
            download: `${baseUrl}/api/polizas/${doc.id}/download`,
            preview: `${baseUrl}/api/polizas/${doc.id}/preview`
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
      console.error('❌ Error obteniendo documentos de póliza:', error);
      res.status(500).json({ 
        error: 'Error obteniendo documentos',
        message: error.message 
      });
    }
  },

  // NUEVA FUNCIÓN: Descargar documento específico
  async descargarDocumento(req, res) {
    try {
      const { documentoId } = req.params;

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
      
      // ✅ Usar la ruta tal como está guardada (ahora es absoluta)
      const rutaCompleta = documento.ruta_archivo;

      if (!fs.existsSync(rutaCompleta)) {
        console.error('❌ Archivo no encontrado:', rutaCompleta);
        return res.status(404).json({ 
          error: 'Archivo no encontrado en el servidor',
          ruta: rutaCompleta 
        });
      }

      // ✅ USAR INLINE PARA PREVISUALIZACIÓN EN LUGAR DE ATTACHMENT
      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error descargando documento:', error);
      res.status(500).json({ 
        error: 'Error descargando documento',
        message: error.message 
      });
    }
  },

  // NUEVA FUNCIÓN: Eliminar documento (solo supervisor)
  async eliminarDocumento(req, res) {
    try {
      const { documentoId } = req.params;

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

      // Si la ruta ya es absoluta, úsala tal cual
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
          poliza: documento.numero_poliza_oficial || documento.numero_poliza
        }
      });

    } catch (error) {
      console.error('❌ Error eliminando documento:', error);
      res.status(500).json({ 
        error: 'Error eliminando documento',
        message: error.message 
      });
    }
  },

  // ✅ AGREGAR MÉTODO PARA CAMBIAR ESTADO
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, motivo_cambio_estado } = req.body;
      const user_id = req.user.id;

      console.log('🔄 Supervisor cambiando estado de póliza:', { 
        poliza_id: id,
        estado_nuevo: estado, 
        motivo: motivo_cambio_estado,
        supervisor_id: user_id
      });

      // ✅ NUEVOS ESTADOS: asesor, supervisor, back_office, venta_cerrada
      const estadosValidos = [
        'asesor', 'supervisor', 'back_office', 'venta_cerrada'
      ];

      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          error: 'Estado no válido',
          estado_recibido: estado,
          estados_validos: estadosValidos
        });
      }

      // Obtener póliza actual con información completa
      const queryPoliza = `
        SELECT 
          p.*,
          pr.nombre as prospecto_nombre, 
          pr.apellido as prospecto_apellido,
          pr.correo as prospecto_email,
          pr.numero_contacto as prospecto_telefono,
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

      // Validar transición de estado
      const transicionValida = PolizasSupervisorController.validarTransicionEstado(
        polizaActual.estado, 
        estado
      );

      if (!transicionValida.valida) {
        return res.status(400).json({
          error: 'Transición de estado no válida',
          estado_actual: polizaActual.estado,
          estado_solicitado: estado,
          razon: transicionValida.razon
        });
      }

      // Actualizar estado en la base de datos
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
          error: 'No se pudo actualizar la póliza',
          details: 'La consulta de actualización no afectó ninguna fila'
        });
      }

      // Registrar en historial si la tabla existe
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
        console.log('⚠️ No se pudo registrar en historial (tabla puede no existir):', historialError.message);
        // No fallar la operación principal por esto
      }

      // ✅ NUEVA LÓGICA: Si el estado cambia a "venta_cerrada", actualizar asignaciones a "Venta"
      if (estado === 'venta_cerrada') {
        try {
          console.log('🎯 Póliza cerrada, actualizando asignación a estado "Venta"');
          
          // Buscar la asignación del prospecto de esta póliza
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
            console.log(`✅ Asignación actualizada a "Venta" exitosamente (${updateAsignacion.affectedRows} registro(s) actualizados)`);
          } else {
            console.log('ℹ️ No se encontró asignación para actualizar o ya estaba en estado "Venta"');
          }
          
        } catch (asignacionError) {
          console.error('⚠️ Error actualizando asignación a "Venta":', asignacionError.message);
          // No fallar la operación principal por este error
        }

        // ✅ NUEVO: Exportar póliza cerrada a Google Sheets
        try {
          console.log('📊 Supervisor: Exportando póliza cerrada a Google Sheets...');
          
          await GoogleSheetsPolizasService.agregarPolizaCerrada(
            id, 
            motivo_cambio_estado || ''
          );
          
          console.log('✅ Póliza exportada a Google Sheets exitosamente desde Supervisor');
        } catch (sheetsError) {
          console.error('⚠️ Error exportando a Google Sheets:', sheetsError.message);
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

      console.log('✅ Estado actualizado exitosamente');

      // 🚀 Nueva funcionalidad: Si se autoriza, enviar automáticamente a firma (VaFirma) y notificar por WhatsApp
      let autoFirma = null;
      if (estado === 'autorizada') {
        try {
          const baseURL = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online');
          const pdfUrl = `${baseURL}/api/polizas/${id}/pdf`;

          // Descargar el PDF generado por nuestro endpoint
          const pdfResp = await axios.get(pdfUrl, {
            responseType: 'arraybuffer',
            headers: {
              // Reusar auth si el endpoint lo requiere
              Authorization: req.headers.authorization || ''
            },
            timeout: 30000
          });

          const pdfBase64 = Buffer.from(pdfResp.data).toString('base64');

          // Preparar datos del firmante (prospecto)
          const signerName = nombreParaFirma(polizaActual.prospecto_nombre, polizaActual.prospecto_apellido);
          // VaFirma requiere email: si no existe, usar alias controlado de fallback
          const signerEmail = resolverEmailProspecto(polizaActual) || `firma+poliza${id}@cober360.com`;
          const whatsapp = normalizePhone(polizaActual.prospecto_telefono);

          // Enviar a VaFirma
          const firmaResp = await VaFirmaService.solicitarFirma({
            pdfBase64,
            fileName: `poliza_${id}.pdf`,
            signerName,
            signerEmail,
            whatsapp,
            emailSubject: 'Firma de Póliza - Cober360',
            signaturePageIndex: 0,
            signaturePageX: 50,
            signaturePageY: 50,
            docOriginId: `POLIZA-${id}-${Date.now()}`,
            // ✅ Activar validación biométrica
            requireBiometric: true,
            biometricOptions: {
              level: 'high',
              captureMethod: 'mobile',
              requireSelfie: true,
              requireDNI: true
            }
          });

          autoFirma = firmaResp;
          console.log('📨 Envío a VaFirma ejecutado:', firmaResp);
        } catch (autoErr) {
          console.error('❌ Error auto-enviando a firma (VaFirma):', autoErr.response?.data || autoErr.message);
          autoFirma = { success: false, error: autoErr.message };
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
          mensaje: PolizasSupervisorController.getMensajeEstado(estado),
          auto_firma: autoFirma
        }
      });

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message,
        details: error.sqlMessage || 'Error en base de datos'
      });
    }
  },

  // ✅ VALIDAR TRANSICIONES DE ESTADO - NUEVOS ESTADOS
  validarTransicionEstado(estadoActual, estadoNuevo) {
    const transicionesValidas = {
      'asesor': ['supervisor'],                    // Asesor solo puede pasar a Supervisor
      'supervisor': ['asesor', 'back_office'],     // Supervisor puede devolver a Asesor o pasar a Back Office
      'back_office': ['supervisor', 'venta_cerrada'], // Back Office puede devolver a Supervisor o cerrar venta
      'venta_cerrada': []                          // Venta Cerrada es estado final
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
      'venta_cerrada': 'Venta cerrada exitosamente'
    };
    
    return mensajes[estado] || 'Estado desconocido';
  },

  // ✅ AGREGAR ESTE MÉTODO QUE FALTA
  async obtenerHistorialEstados(req, res) {
    try {
      const { id } = req.params;

      console.log('📋 Obteniendo historial de estados para póliza:', id);

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

      console.log(`✅ Encontrados ${historial.length} registros de historial`);

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
      console.error('❌ Error obteniendo historial de estados:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo historial de estados',
        message: error.message
      });
    }
  },

  // ✅ NUEVO: Obtener póliza para edición
  async obtenerPolizaParaEdicion(req, res) {
    try {
      const { id } = req.params;

      console.log('📝 Obteniendo póliza completa para edición:', id);

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
          -- Datos del creador
          u.first_name as creador_nombre,
          u.last_name as creador_apellido,
          u.email as creador_email,
          -- Datos del revisor
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

      // ✅ PARSEAR CAMPOS JSON (INCLUYENDO LOS NUEVOS)
      const camposJson = [
        'datos_personales',
        'integrantes', 
        'documentos_titular',
        'documentos_integrantes',
        'referencias',
        'declaracion_salud',
        'cobertura_anterior',
        'datos_adicionales',
        // 🆕 NUEVOS CAMPOS
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
            // Inicializar con valores por defecto
            if (['integrantes', 'referencias', 'documentos_titular', 'documentos_integrantes'].includes(campo)) {
              poliza[campo] = [];
            } else {
              poliza[campo] = {};
            }
          }
        } catch (parseError) {
          console.error(`Error parseando campo ${campo}:`, parseError);
          // Inicializar con valor por defecto en caso de error
          if (['integrantes', 'referencias', 'documentos_titular', 'documentos_integrantes'].includes(campo)) {
            poliza[campo] = [];
          } else {
            poliza[campo] = {};
          }
        }
      });

      // ✅ MEJORAR: Normalizar estructura de declaración de salud para múltiples integrantes
      if (poliza.declaracion_salud && poliza.declaracion_salud.respuestas) {
        console.log('🏥 Estructura original de declaracion_salud:', JSON.stringify(poliza.declaracion_salud.respuestas, null, 2));
        
        // Si las respuestas están organizadas por índice de integrante
        if (typeof poliza.declaracion_salud.respuestas === 'object') {
          const keys = Object.keys(poliza.declaracion_salud.respuestas);
          
          // ✅ MANTENER estructura por integrante para edición en supervisor
          // No aplanar, sino asegurar que se mantenga la estructura por integrante
          poliza.declaracion_salud.respuestas_por_integrante = poliza.declaracion_salud.respuestas;
          
          // Para compatibilidad, también proporcionar las respuestas del titular (índice 0)
          if (poliza.declaracion_salud.respuestas["0"]) {
            poliza.declaracion_salud.respuestas_titular = poliza.declaracion_salud.respuestas["0"];
          }
          
          console.log('✅ Declaración de salud normalizada:', {
            total_integrantes: keys.length,
            indices: keys,
            tiene_respuestas_titular: !!poliza.declaracion_salud.respuestas["0"],
            tiene_coberturas_por_integrante: !!poliza.declaracion_salud.coberturas_por_integrante
          });
        }
      }

      // ✅ FORMATEAR RESPUESTA COMPLETA (INCLUYENDO NUEVOS CAMPOS)
      const polizaCompleta = {
        // Campos básicos de la póliza
        id: poliza.id,
        prospecto_id: poliza.prospecto_id,
        cotizacion_id: poliza.cotizacion_id,
        numero_poliza: poliza.numero_poliza_oficial || poliza.numero_poliza,
        estado: poliza.estado,
        estado_anterior: poliza.estado_anterior,
        fecha_cambio_estado: poliza.fecha_cambio_estado,
        motivo_cambio_estado: poliza.motivo_cambio_estado,
        
        // Fechas importantes
        created_at: poliza.created_at,
        updated_at: poliza.updated_at,
        fecha_finalizacion: poliza.fecha_finalizacion,
        fecha_revision: poliza.fecha_revision,
        fecha_aceptacion_terminos: poliza.fecha_aceptacion_terminos,
        
        // Campos editables principales
        datos_personales: poliza.datos_personales,
        integrantes: poliza.integrantes,
        documentos_titular: poliza.documentos_titular,
        documentos_integrantes: poliza.documentos_integrantes,
        referencias: poliza.referencias,
        declaracion_salud: poliza.declaracion_salud,
        cobertura_anterior: poliza.cobertura_anterior,
        datos_adicionales: poliza.datos_adicionales,
        
        // 🆕 NUEVOS CAMPOS EDITABLES (SOLO SUPERVISOR)
        informacion_afiliado: poliza.informacion_afiliado,
        informacion_facturacion: poliza.informacion_facturacion,
        solicitud_afiliacion: poliza.solicitud_afiliacion,
        datos_comerciales: poliza.datos_comerciales,
        
        // Campos adicionales editables
        observaciones: poliza.observaciones,
        terminos_aceptados: poliza.terminos_aceptados,
        
        // Información del prospecto
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
        
        // Información del plan
        plan: {
          id: poliza.plan_id,
          nombre: poliza.plan_nombre,
          anio: poliza.anio_plan
        },
        
        // Información de cotización
        cotizacion: {
          total_final: poliza.total_final,
          total_bruto: poliza.total_bruto,
          total_descuento_aporte: poliza.total_descuento_aporte,
          total_descuento_promocion: poliza.total_descuento_promocion,
          detalles: cotizacionDetalles
        },
        
        // Información de usuarios
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

      console.log('✅ Póliza cargada exitosamente para edición');

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
          // 🆕 NUEVOS CAMPOS EDITABLES
          'informacion_afiliado',
          'informacion_facturacion', 
          'solicitud_afiliacion',
          'datos_comerciales',
          'observaciones',
          'terminos_aceptados'
        ]
      });

    } catch (error) {
      console.error('❌ Error obteniendo póliza para edición:', error);
      res.status(500).json({ 
        error: 'Error obteniendo póliza',
        message: error.message,
        details: error.sqlMessage || 'Error en base de datos'
      });
    }
  },

  // ✅ ACTUALIZAR: Actualizar datos de la póliza (INCLUYENDO NUEVOS CAMPOS)
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
        // 🆕 AGREGAR ESTOS CAMPOS QUE FALTAN
        informacion_afiliado,
        informacion_facturacion,
        solicitud_afiliacion,
        datos_comerciales,
        observaciones,
        terminos_aceptados,
        motivo 
      } = req.body;
      const user_id = req.user.id;

      console.log('📝 Actualizando póliza completa:', id);
      console.log('📊 Campo informacion_afiliado recibido:', informacion_afiliado);

      // Verificar que la póliza existe
      const [polizaExistente] = await db.execute('SELECT * FROM polizas WHERE id = ? AND deleted_at IS NULL', [id]);
      
      if (polizaExistente.length === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // ✅ Sync peso/altura desde datos_fisicos de declaracion_salud hacia datos_personales
      const datosPersonalesSincronizados = { ...(datos_personales || {}) };
      const datosFisicosSup = declaracion_salud?.datos_fisicos;
      if (datosFisicosSup) {
        if (datosFisicosSup.titular_peso !== undefined && datosFisicosSup.titular_peso !== '') {
          datosPersonalesSincronizados.peso = datosFisicosSup.titular_peso;
        }
        if (datosFisicosSup.titular_altura !== undefined && datosFisicosSup.titular_altura !== '') {
          datosPersonalesSincronizados.altura = datosFisicosSup.titular_altura;
        }
      }

      // ✅ Sincronizar peso/altura de datos_fisicos.integrantes → integrantes[idx]
      const datosFisicosIntsSup = declaracion_salud?.datos_fisicos?.integrantes;
      let integrantesSup = integrantes || [];
      if (Array.isArray(datosFisicosIntsSup) && Array.isArray(integrantesSup)) {
        integrantesSup = integrantesSup.map((integrante, idx) => {
          const fisico = datosFisicosIntsSup[idx];
          if (!fisico) return integrante;
          return {
            ...integrante,
            peso: fisico.peso !== undefined && fisico.peso !== '' ? fisico.peso : integrante.peso,
            altura: fisico.altura !== undefined && fisico.altura !== '' ? fisico.altura : integrante.altura
          };
        });
      }

      // ✅ ACTUALIZAR INCLUYENDO LOS NUEVOS CAMPOS
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
        JSON.stringify(integrantesSup || []),
        JSON.stringify(documentos_titular || []),
        JSON.stringify(documentos_integrantes || []),
        JSON.stringify(referencias || []),
        JSON.stringify(declaracion_salud || {}),
        JSON.stringify(cobertura_anterior || {}),
        JSON.stringify(datos_adicionales || {}),
        // 🆕 NUEVOS CAMPOS JSON - ESTOS SON LOS QUE FALTABAN
        JSON.stringify(informacion_afiliado || {}),
        JSON.stringify(informacion_facturacion || {}),
        JSON.stringify(solicitud_afiliacion || {}),
        JSON.stringify(datos_comerciales || {}),
        observaciones || null,
        terminos_aceptados ? 1 : 0,
        datosPersonalesSincronizados.numero_poliza_vendedor || null,
        motivo || 'Póliza editada por supervisor',
        user_id,
        id
      ];

      console.log('📤 Enviando a base de datos - informacion_afiliado:', JSON.stringify(informacion_afiliado || {}));

      const [result] = await db.execute(updateQuery, updateParams);

      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'No se pudo actualizar la póliza' });
      }

      console.log('✅ Póliza actualizada exitosamente');

      // ✅ Actualizar correo en tabla prospectos si se envió
      const correoNuevoSup = datosPersonalesSincronizados.correo || datosPersonalesSincronizados.email;
      if (correoNuevoSup && polizaExistente[0].prospecto_id) {
        await db.execute('UPDATE prospectos SET correo = ? WHERE id = ?', [correoNuevoSup, polizaExistente[0].prospecto_id]);
        console.log('✅ Correo actualizado en prospectos (supervisor):', correoNuevoSup);
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
      console.error('❌ Error actualizando póliza:', error);
      res.status(500).json({
        error: 'Error actualizando póliza',
        message: error.message,
        details: error.sqlMessage || 'Error en base de datos'
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Cargar múltiples documentos adicionales
  async cargarMultiplesDocumentos(req, res) {
    // Configurar multer para múltiples archivos (máximo 6)
    const uploadMultiple = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo por archivo
        files: 6 // Máximo 6 archivos
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
    }).array('documentos', 6); // Campo 'documentos' con máximo 6 archivos

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
        // ✅ Obtener polizaId desde los parámetros de la URL
        const polizaId = req.params.id;
        const { tipos_documento, observaciones } = req.body;
        const supervisor_id = req.user.id;
        
        console.log('📝 Datos recibidos:', {
          polizaId,
          tipos_documento,
          archivos: req.files?.length || 0,
          supervisor_id
        });

        console.log('📎 Cargando múltiples documentos para póliza:', {
          polizaId,
          cantidad_archivos: req.files?.length || 0,
          supervisor_id,
          user: req.user
        });

        // ✅ Verificar acceso: backoffice (role 4) ve todas las pólizas, supervisor solo las suyas
        const esBackoffice = req.user.role === 4;
        const polizaQuery = esBackoffice
          ? `SELECT p.*, pr.nombre as prospecto_nombre, pr.apellido as prospecto_apellido
             FROM polizas p
             LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
             WHERE p.id = ? AND p.deleted_at IS NULL`
          : `SELECT p.*, pr.nombre as prospecto_nombre, pr.apellido as prospecto_apellido
             FROM polizas p
             LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
             INNER JOIN users u ON p.created_by = u.id
             WHERE p.id = ? AND u.supervisor_id = ? AND p.deleted_at IS NULL`;
        const queryParams = esBackoffice ? [polizaId] : [polizaId, supervisor_id];

        console.log('🔍 Ejecutando query con parámetros:', { polizaId, supervisor_id });

        const [polizaExistente] = await db.execute(polizaQuery, queryParams);
        
        console.log('📊 Resultado de búsqueda:', { 
          encontradas: polizaExistente.length,
          poliza: polizaExistente[0] 
        });

        if (polizaExistente.length === 0) {
          // Eliminar archivos subidos si la póliza no existe o no tiene acceso
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
            message: 'Póliza no encontrada o no tiene acceso a esta póliza'
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionaron archivos'
          });
        }

        // Parsear tipos de documento (viene como string JSON)
        let tiposDocumento = [];
        if (tipos_documento) {
          try {
            tiposDocumento = JSON.parse(tipos_documento);
          } catch (e) {
            console.error('Error parseando tipos_documento:', e);
            tiposDocumento = [];
          }
        }

        // Verificar que no se excedan los documentos máximos para la póliza
        const [documentosExistentes] = await db.execute(
          'SELECT COUNT(*) as total FROM poliza_documentos WHERE poliza_id = ?',
          [polizaId]
        );

        const totalExistentes = documentosExistentes[0].total;
        const totalNuevos = req.files.length;

        if (totalExistentes + totalNuevos > 20) { // Límite total de 20 documentos por póliza
          // Eliminar archivos subidos
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

        // Procesar cada archivo
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const tipoDocumento = tiposDocumento[i] || 'documento_adicional';

          // ✅ Guardar ruta absoluta en la base de datos para evitar problemas
          const rutaAbsoluta = file.path;

          // Insertar documento en la base de datos
          // Generar hash público único para el documento
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
            rutaAbsoluta, // ✅ Usar ruta absoluta
            file.size,
            file.mimetype,
            observaciones || `Documento cargado por supervisor - ${tipoDocumento}`,
            supervisor_id,
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
              download: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/supervisor/polizas/documentos/${insertResult.insertId}/download`,
              preview: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/supervisor/polizas/documentos/${insertResult.insertId}/preview`
            }
          });

          console.log(`✅ Documento ${i + 1} guardado:`, {
            id: insertResult.insertId,
            tipo: tipoDocumento,
            archivo: file.originalname
          });
        }

        // Registrar actividad en historial de la póliza
        try {
          await db.execute(
            `INSERT INTO poliza_estados_historial 
             (poliza_id, estado_anterior, estado_nuevo, motivo, changed_by, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
              polizaId,
              polizaExistente[0].estado,
              polizaExistente[0].estado, // Mismo estado
              `Se cargaron ${documentosGuardados.length} documentos adicionales por supervisor`,
              supervisor_id
            ]
          );
        } catch (historialError) {
          console.warn('⚠️ Error registrando en historial:', historialError.message);
        }

        console.log(`✅ Carga múltiple completada: ${documentosGuardados.length} documentos`);

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
        console.error('❌ Error cargando múltiples documentos:', error);
        
        // Eliminar archivos subidos en caso de error
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
    // Usar multer middleware manualmente
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
        const supervisor_id = req.user.id;

        console.log('📝 Actualizando documento:', { documentoId, supervisor_id });

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionó archivo'
          });
        }

        // Verificar que el documento existe
        const [documentoExistente] = await db.execute(
          'SELECT * FROM poliza_documentos WHERE id = ?',
          [documentoId]
        );

        if (documentoExistente.length === 0) {
          // Eliminar archivo subido si el documento no existe
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

        // Eliminar archivo anterior
        try {
          const archivoAnterior = path.join('uploads/polizas/', documento.nombre_archivo);
          await fs.unlink(archivoAnterior);
          console.log('🗑️ Archivo anterior eliminado:', archivoAnterior);
        } catch (unlinkError) {
          console.warn('⚠️ No se pudo eliminar archivo anterior:', unlinkError.message);
        }

        // Actualizar información del documento en la base de datos
        // Ahora incluimos `actualizado_por` para registrar el usuario que realizó la actualización.
        // Asegúrate de ejecutar la migración correspondiente para añadir la columna antes de usarlo.
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
          supervisor_id,
          documentoId
        ]);

        // Registrar la actualización en un log (opcional)
        try {
          await db.execute(
            `INSERT INTO poliza_documentos_historial 
             (documento_id, accion, motivo, usuario_id, archivo_anterior, archivo_nuevo, created_at) 
             VALUES (?, 'actualizado', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              documentoId,
              motivo_actualizacion || 'Documento actualizado por supervisor',
              supervisor_id,
              documento.nombre_archivo,
              req.file.filename
            ]
          );
        } catch (logError) {
          console.warn('⚠️ Error registrando historial:', logError.message);
        }

        console.log('✅ Documento actualizado exitosamente:', {
          id: documentoId,
          archivo_nuevo: req.file.filename,
          archivo_anterior: documento.nombre_archivo
        });

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
        console.error('❌ Error actualizando documento:', error);
        
        // Eliminar archivo subido en caso de error
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
      console.error('❌ Error obteniendo tipos de documentos:', error);
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
      const supervisor_id = req.user.id;

      // Verificar que el documento existe y que el supervisor tiene acceso
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
        INNER JOIN users u ON p.created_by = u.id
        WHERE d.id = ? AND u.supervisor_id = ?
      `;

      const [documentos] = await db.execute(query, [documentoId, supervisor_id]);
      
      if (documentos.length === 0) {
        return res.status(404).json({ 
          error: 'Documento no encontrado o no tiene acceso a este documento' 
        });
      }

      const documento = documentos[0];
      const fs = require('fs');
      const path = require('path');
      
      // ✅ Usar la ruta tal como está guardada (ahora es absoluta)
      const rutaCompleta = documento.ruta_archivo;

      if (!fs.existsSync(rutaCompleta)) {
        console.error('❌ Archivo no encontrado:', rutaCompleta);
        return res.status(404).json({ 
          error: 'Archivo no encontrado en el servidor',
          ruta: rutaCompleta 
        });
      }

      // Configurar headers para previsualización inline
      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
      res.setHeader('X-Documento-Tipo', documento.tipo_documento);
      res.setHeader('X-Poliza-Numero', documento.numero_poliza);
      res.setHeader('X-Prospecto-Nombre', `${documento.prospecto_nombre} ${documento.prospecto_apellido}`);

      // Enviar archivo
      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error previsualizando documento:', error);
      res.status(500).json({ 
        error: 'Error previsualizando documento',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Obtener estadísticas de documentos de la póliza
  async obtenerEstadisticasDocumentos(req, res) {
    try {
      const { id: polizaId } = req.params;
      const supervisor_id = req.user.id;

      let whereClause = '';
      let queryParams = [];
      let polizaAcceso = null;  // ✅ Declarar antes para evitar ReferenceError

      if (polizaId) {
        // Verificar acceso a la póliza específica
        const [polizaData] = await db.execute(
          `SELECT p.numero_poliza_oficial || p.numero_poliza as numero_poliza
           FROM polizas p
           INNER JOIN users u ON p.created_by = u.id
           WHERE p.id = ? AND u.supervisor_id = ? AND p.deleted_at IS NULL`,
          [polizaId, supervisor_id]
        );

        if (polizaData.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Póliza no encontrada o no tiene acceso'
          });
        }

        polizaAcceso = polizaData;  // ✅ Guardar los datos
        whereClause = 'WHERE pd.poliza_id = ?';
        queryParams = [polizaId];
      } else {
        // Estadísticas generales para todas las pólizas del supervisor
        whereClause = `WHERE p.id IN (
          SELECT p2.id FROM polizas p2 
          INNER JOIN users u2 ON p2.created_by = u2.id 
          WHERE u2.supervisor_id = ? AND p2.deleted_at IS NULL
        )`;
        queryParams = [supervisor_id];
      }

      // Obtener estadísticas de documentos
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
      
      // Formatear tamaño en MB
      const tamañoTotalMB = stats.tamaño_total_bytes ? (stats.tamaño_total_bytes / (1024 * 1024)).toFixed(2) : 0;

      // Verificar documentos requeridos
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

      // Agregar información específica de póliza si se solicita
      if (polizaId && polizaAcceso && polizaAcceso.length > 0) {  // ✅ Verificar que existe
        responseData.poliza_id = polizaId;
        responseData.numero_poliza = polizaAcceso[0].numero_poliza;
      }

      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de documentos:', error);
      res.status(500).json({ 
        error: 'Error obteniendo estadísticas de documentos',
        message: error.message 
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Eliminar póliza (soft delete - solo pólizas propias del supervisor)
  async eliminarPoliza(req, res) {
    try {
      const { id } = req.params;
      const { motivo_eliminacion } = req.body;
      const supervisor_id = req.user.id;

      if (!motivo_eliminacion || !motivo_eliminacion.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un motivo para eliminar la póliza'
        });
      }

      // Verificar que la póliza pertenezca a un vendedor de este supervisor
      const queryPoliza = `
        SELECT 
          p.id, p.numero_poliza, p.numero_poliza_oficial, p.estado,
          p.deleted_at,
          pve.estado_firma, pve.enviado_en,
          u.supervisor_id as vendedor_supervisor_id
        FROM polizas p
        LEFT JOIN polizas_vafirma_envios pve ON pve.poliza_id = p.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `;

      const [polizas] = await db.execute(queryPoliza, [id]);

      if (polizas.length === 0) {
        return res.status(404).json({ success: false, error: 'Póliza no encontrada' });
      }

      const poliza = polizas[0];

      // Verificar pertenencia al supervisor
      if (poliza.vendedor_supervisor_id !== supervisor_id) {
        return res.status(403).json({
          success: false,
          error: 'No tenés permisos para eliminar esta póliza'
        });
      }

      // Verificar que no esté ya eliminada
      if (poliza.deleted_at) {
        return res.status(400).json({ success: false, error: 'La póliza ya fue eliminada anteriormente' });
      }

      // Verificar restricciones de estado
      if (poliza.estado === 'venta_cerrada') {
        return res.status(400).json({ success: false, error: 'No se puede eliminar una póliza con venta cerrada' });
      }

      const fueEnviadaFirma = poliza.enviado_en ||
        poliza.estado_firma === 'pending' ||
        poliza.estado_firma === 'signed';

      if (fueEnviadaFirma) {
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar una póliza que ya fue enviada para firma electrónica'
        });
      }

      // Soft delete
      await db.execute(
        `UPDATE polizas SET deleted_at = NOW(), deleted_by = ?, motivo_eliminacion = ? WHERE id = ?`,
        [supervisor_id, motivo_eliminacion.trim(), id]
      );

      // Registrar en historial
      try {
        await db.execute(
          `INSERT INTO poliza_estados_historial (poliza_id, estado_anterior, estado_nuevo, motivo, changed_by, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, poliza.estado, 'eliminada', motivo_eliminacion.trim(), supervisor_id]
        );
      } catch (historialError) {
        console.error('⚠️ No se pudo registrar historial de eliminación:', historialError.message);
      }

      console.log(`🗑️ Póliza ${poliza.numero_poliza_oficial || poliza.numero_poliza} eliminada por supervisor ${supervisor_id}.`);

      res.json({
        success: true,
        message: 'Póliza eliminada correctamente',
        data: { id: poliza.id, numero_poliza: poliza.numero_poliza_oficial || poliza.numero_poliza }
      });

    } catch (error) {
      console.error('❌ Error eliminando póliza (Supervisor):', error);
      res.status(500).json({ success: false, error: 'Error eliminando póliza', message: error.message });
    }
  }
};

// Utilidad: normalizar teléfono a formato E.164 (AR por defecto)
function normalizePhone(tel) {
  if (!tel) return null;
  let s = String(tel).trim().replace(/\s|-/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    if (s.startsWith('0')) s = '+54' + s.slice(1);
    else s = '+54' + s;
  }
  return s;
}

module.exports = PolizasSupervisorController;