const db = require('../../config/db');
const { mapLocalidadToPartido, isValidLocalidadBA } = require('../../config/partidosBuenosAires');

const dashboardMetricasModel = {
  /**
   * Construye filtro de fecha según el período seleccionado
   */
  buildDateFilter(periodo = 'mes_actual') {
    const now = new Date();
    let startDate, endDate;

    // Soporte para rango personalizado en formato 'YYYY-MM-DD:YYYY-MM-DD'
    if (typeof periodo === 'string' && periodo.includes(':')) {
      const [fromStr, toStr] = periodo.split(':');
      startDate = new Date(fromStr);
      endDate = new Date(toStr);
      const formatDate = (date) => date.toISOString().split('T')[0];
      return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        range: `${formatDate(startDate)} AND ${formatDate(endDate)}`
      };
    }

    switch(periodo) {
      case 'hoy':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'semana':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startDate = startOfWeek;
        endDate = now;
        break;
      case 'mes_actual':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'mes_anterior':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        // Asumir que es un mes específico en formato YYYY-MM
        const [year, month] = periodo.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0);
    }

    const formatDate = (date) => date.toISOString().split('T')[0];
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      range: `${formatDate(startDate)} AND ${formatDate(endDate)}`
    };
  },

  /**
   * Obtiene los KPIs principales del dashboard
   */
  async getKPIs(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      // Calcular período anterior con la misma duración (en días)
      const msPerDay = 24 * 60 * 60 * 1000;
      const s = new Date(dateFilter.startDate + 'T00:00:00Z');
      const e = new Date(dateFilter.endDate + 'T00:00:00Z');
      const spanDays = Math.max(0, Math.round((e - s) / msPerDay));
      const prevEnd = new Date(s.getTime() - msPerDay);
      const prevStart = new Date(prevEnd.getTime() - spanDays * msPerDay);
      const fmt = (d) => d.toISOString().split('T')[0];
      const prevDateFilter = { startDate: fmt(prevStart), endDate: fmt(prevEnd) };
      
      // Total de prospectos en el período usando fecha_registro o fecha_hora_registro
      const [totales] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) = ? THEN 1 ELSE 0 END) as hoy,
          SUM(CASE WHEN COALESCE(p.fecha_registro, p.fecha_hora_registro) >= DATE_SUB(?, INTERVAL 7 DAY) THEN 1 ELSE 0 END) as semana
        FROM prospectos p
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [dateFilter.endDate, dateFilter.endDate, dateFilter.startDate, dateFilter.endDate]);

      const [totalAnterior] = await db.query(`
        SELECT COUNT(*) as total
        FROM prospectos p
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [prevDateFilter.startDate, prevDateFilter.endDate]);

      const cambioProspectos = totalAnterior[0].total > 0 
        ? Math.round((((totales[0].total - totalAnterior[0].total) / totalAnterior[0].total) * 100) * 10) / 10
        : 0;

      // Tasa de conversión (Venta / Total de prospectos asignados en el período)
      const [conversion] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          COUNT(DISTINCT p.id) as total,
          SUM(CASE WHEN al.estado = 'Venta' THEN 1 ELSE 0 END) as ventas,
          (SUM(CASE WHEN al.estado = 'Venta' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT p.id), 0)) * 100 as tasa
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      const [conversionAnterior] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          COUNT(DISTINCT p.id) as total,
          SUM(CASE WHEN al.estado = 'Venta' THEN 1 ELSE 0 END) as ventas,
          (SUM(CASE WHEN al.estado = 'Venta' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT p.id), 0)) * 100 as tasa
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [prevDateFilter.startDate, prevDateFilter.endDate]);

      const tasaActualRaw = conversion[0]?.tasa;
      const tasaAnteriorRaw = conversionAnterior[0]?.tasa;
      const tasaActualNum = (tasaActualRaw === null || tasaActualRaw === undefined) ? null : Number(tasaActualRaw);
      const tasaAnteriorNum = (tasaAnteriorRaw === null || tasaAnteriorRaw === undefined) ? null : Number(tasaAnteriorRaw);

      const cambioConversion = (tasaAnteriorNum !== null && !Number.isNaN(tasaAnteriorNum) && tasaAnteriorNum > 0 &&
                                tasaActualNum !== null && !Number.isNaN(tasaActualNum))
        ? Math.round((((tasaActualNum - tasaAnteriorNum) / tasaAnteriorNum) * 100) * 10) / 10
        : 0;

      // Tiempo promedio de respuesta (desde asignación hasta primer contacto)
      const [tiempoRespuesta] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          AVG(TIMESTAMPDIFF(HOUR, al.fecha_asignacion, al.fecha_estado)) as horas_respuesta
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE al.estado IS NOT NULL AND al.estado != 'Lead'
          AND DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      // Pólizas generadas en el período (según fecha de creación de póliza)
      const [polizasGeneradas] = await db.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_polizas,
          COUNT(DISTINCT p.prospecto_id) as prospectos_con_poliza,
          AVG(c.total_final) as valor_promedio_poliza
        FROM polizas p
        LEFT JOIN cotizaciones c ON c.prospecto_id = p.prospecto_id
        WHERE DATE(p.created_at) BETWEEN ? AND ?
          AND p.deleted_at IS NULL
      `, [dateFilter.startDate, dateFilter.endDate]);

      // Tiempo promedio desde asignación hasta "1º Contacto"
      const [tiempoContacto] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          AVG(TIMESTAMPDIFF(HOUR, al.fecha_asignacion, al.fecha_estado)) as horas_primer_contacto
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE al.estado = '1º Contacto'
          AND DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      // Prospectos activos por estado
      const [prospectosActivos] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN al.estado = 'Lead' THEN 1 ELSE 0 END) as nuevo,
          SUM(CASE WHEN al.estado = '1º Contacto' THEN 1 ELSE 0 END) as contactado,
          SUM(CASE WHEN al.estado = 'Calificado Cotización' THEN 1 ELSE 0 END) as cotizacion,
          SUM(CASE WHEN al.estado IN ('Calificado Póliza', 'Calificado Pago') THEN 1 ELSE 0 END) as negociacion,
          SUM(CASE WHEN al.estado = 'Venta' THEN 1 ELSE 0 END) as cierre
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      return {
        periodo: periodo,
        fechas: {
          inicio: dateFilter.startDate,
          fin: dateFilter.endDate
        },
        totalProspectos: {
          total: parseInt(totales[0].total) || 0,
          hoy: parseInt(totales[0].hoy) || 0,
          semana: parseInt(totales[0].semana) || 0,
          cambio: parseFloat(cambioProspectos) || 0
        },
        tasaConversion: {
          valor: (tasaActualNum !== null && !Number.isNaN(tasaActualNum)) ? (Math.round(tasaActualNum * 10) / 10) : 0,
          totalVentas: parseInt(conversion[0].ventas) || 0,
          cambio: Number.isFinite(cambioConversion) ? cambioConversion : 0,
          meta: 28
        },
        tiempoRespuesta: {
          valor: tiempoRespuesta[0].horas_respuesta ? Math.round(tiempoRespuesta[0].horas_respuesta) : 0,
          unidad: 'horas',
          descripcion: 'Tiempo promedio desde asignación hasta cambio de estado'
        },
        tiempoContacto: {
          valor: tiempoContacto[0].horas_primer_contacto ? Math.round(tiempoContacto[0].horas_primer_contacto) : 0,
          unidad: 'horas',
          descripcion: 'Tiempo promedio para primer contacto'
        },
        polizasGeneradas: {
          total: parseInt(polizasGeneradas[0].total_polizas) || 0,
          prospectosConPoliza: parseInt(polizasGeneradas[0].prospectos_con_poliza) || 0,
          valorPromedio: parseInt(polizasGeneradas[0].valor_promedio_poliza) || 0
        },
        prospectosActivos: {
          total: parseInt(prospectosActivos[0].total) || 0,
          nuevo: parseInt(prospectosActivos[0].nuevo) || 0,
          contactado: parseInt(prospectosActivos[0].contactado) || 0,
          cotizacion: parseInt(prospectosActivos[0].cotizacion) || 0,
          negociacion: parseInt(prospectosActivos[0].negociacion) || 0,
          cierre: parseInt(prospectosActivos[0].cierre) || 0
        }
      };
    } catch (error) {
      console.error('Error en getKPIs:', error);
      throw error;
    }
  },

  /**
   * Obtiene prospectos por día para el período seleccionado
   */
  async getProspectosPorDia(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      
      const [rows] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          DATE_FORMAT(DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)), '%d %b') as fecha,
          DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) as fecha_completa,
          COUNT(DISTINCT p.id) as prospectos,
          COUNT(DISTINCT CASE WHEN al.estado = 'Venta' THEN p.id END) as convertidos
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
        GROUP BY DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro))
        ORDER BY fecha_completa ASC
      `, [dateFilter.startDate, dateFilter.endDate]);

      return rows.map(row => ({
        fecha: row.fecha,
        prospectos: parseInt(row.prospectos),
        convertidos: parseInt(row.convertidos)
      }));
    } catch (error) {
      console.error('Error en getProspectosPorDia:', error);
      throw error;
    }
  },

  /**
   * Obtiene datos del embudo de ventas para el período seleccionado
   */
  async getFunnelData(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      
      const [rows] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          SUM(CASE WHEN al.estado = 'Lead' THEN 1 ELSE 0 END) as nuevo,
          SUM(CASE WHEN al.estado = '1º Contacto' THEN 1 ELSE 0 END) as contactado,
          SUM(CASE WHEN al.estado = 'Calificado Cotización' THEN 1 ELSE 0 END) as cotizacion,
          SUM(CASE WHEN al.estado IN ('Calificado Póliza', 'Calificado Pago') THEN 1 ELSE 0 END) as negociacion,
          SUM(CASE WHEN al.estado = 'Venta' THEN 1 ELSE 0 END) as cierre
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      const data = rows[0];
      const total = parseInt(data.nuevo) || 1; // Evitar división por cero

      return [
        {
          etapa: 'Nuevo',
          cantidad: parseInt(data.nuevo) || 0,
          porcentaje: 100
        },
        {
          etapa: 'Contactado',
          cantidad: parseInt(data.contactado) || 0,
          porcentaje: Math.round((parseInt(data.contactado) / total) * 100)
        },
        {
          etapa: 'Cotización',
          cantidad: parseInt(data.cotizacion) || 0,
          porcentaje: Math.round((parseInt(data.cotizacion) / total) * 100)
        },
        {
          etapa: 'Negociación',
          cantidad: parseInt(data.negociacion) || 0,
          porcentaje: Math.round((parseInt(data.negociacion) / total) * 100)
        },
        {
          etapa: 'Cierre',
          cantidad: parseInt(data.cierre) || 0,
          porcentaje: Math.round((parseInt(data.cierre) / total) * 100)
        }
      ];
    } catch (error) {
      console.error('Error en getFunnelData:', error);
      throw error;
    }
  },

  /**
   * Obtiene distribución de prospectos por canal (origen) para el período seleccionado
   */
  async getProspectosPorCanal(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      
      const [rows] = await db.query(`
        SELECT 
          p.origen as canal,
          COUNT(DISTINCT p.id) as cantidad
        FROM prospectos p
        WHERE DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
        GROUP BY p.origen
        ORDER BY cantidad DESC
      `, [dateFilter.startDate, dateFilter.endDate]);

      const total = rows.reduce((sum, row) => sum + parseInt(row.cantidad), 0);

      return rows.map(row => ({
        canal: row.canal || 'Sin especificar',
        cantidad: parseInt(row.cantidad),
        porcentaje: ((parseInt(row.cantidad) / total) * 100).toFixed(1)
      }));
    } catch (error) {
      console.error('Error en getProspectosPorCanal:', error);
      throw error;
    }
  },

  /**
   * Obtiene cantidad de prospectos por localidad para el período seleccionado
   */
  async getProspectosPorLocalidad(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      const [rows] = await db.query(`
        SELECT 
          TRIM(p.localidad) AS localidad,
          COUNT(*) AS cantidad
        FROM prospectos p
        WHERE p.localidad IS NOT NULL AND TRIM(p.localidad) <> ''
          AND UPPER(TRIM(p.localidad)) NOT IN ('C.A.B.A','CABA','CAPITAL FEDERAL','CIUDAD AUTÓNOMA DE BUENOS AIRES','CIUDAD AUTONOMA DE BUENOS AIRES')
          AND DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
        GROUP BY TRIM(p.localidad)
        ORDER BY cantidad DESC
      `, [dateFilter.startDate, dateFilter.endDate]);

      return rows.map(r => ({ localidad: r.localidad, cantidad: parseInt(r.cantidad) || 0 }));
    } catch (error) {
      console.error('Error en getProspectosPorLocalidad:', error);
      throw error;
    }
  },

  /**
   * Obtiene cantidad de prospectos agrupados por partido de PBA (para coropleta)
   */
  async getProspectosPorPartido(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      const [rows] = await db.query(`
        SELECT 
          TRIM(p.localidad) AS localidad,
          COUNT(*) AS cantidad
        FROM prospectos p
        WHERE p.localidad IS NOT NULL AND TRIM(p.localidad) <> ''
          AND DATE(COALESCE(p.fecha_registro, p.fecha_hora_registro)) BETWEEN ? AND ?
        GROUP BY TRIM(p.localidad)
        ORDER BY cantidad DESC
      `, [dateFilter.startDate, dateFilter.endDate]);

      // Mapear localidades a partidos, validando whitelist
      const partidoAgregado = {};
      rows.forEach(row => {
        if (!isValidLocalidadBA(row.localidad)) {
          // Ignorar localidades fuera de PBA
          return;
        }
        const partido = mapLocalidadToPartido(row.localidad);
        if (partido) {
          if (!partidoAgregado[partido]) {
            partidoAgregado[partido] = 0;
          }
          partidoAgregado[partido] += row.cantidad;
        }
      });

      // Retornar array ordenado por cantidad
      return Object.entries(partidoAgregado)
        .map(([partido, cantidad]) => ({ partido, cantidad: parseInt(cantidad) || 0 }))
        .sort((a, b) => b.cantidad - a.cantidad);
    } catch (error) {
      console.error('Error en getProspectosPorPartido:', error);
      throw error;
    }
  },

  /**
   * Obtiene últimos prospectos
   */
  async getUltimosProspectos(limit = 5) {
    try {
      const [rows] = await db.query(`
        WITH a_latest AS (
          SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
          FROM asignaciones a
        )
        SELECT 
          p.id,
          CONCAT(p.nombre, ' ', p.apellido) as nombre,
          COALESCE(pl.nombre, 'Sin plan') as plan,
          p.origen as canal,
          al.estado,
          DATE_FORMAT(COALESCE(p.fecha_registro, p.fecha_hora_registro), '%d/%m/%Y') as fecha
        FROM prospectos p
        LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
        LEFT JOIN cotizaciones c ON c.prospecto_id = p.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        ORDER BY COALESCE(p.fecha_registro, p.fecha_hora_registro) DESC
        LIMIT ?
      `, [limit]);

      return rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        plan: row.plan,
        canal: row.canal || 'Web',
        estado: row.estado,
        fecha: row.fecha
      }));
    } catch (error) {
      console.error('Error en getUltimosProspectos:', error);
      throw error;
    }
  },

  /**
   * Obtiene total de ventas (asignaciones con estado='Venta' en el período)
   */
  async getVentas(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      const [result] = await db.query(`
        SELECT COUNT(DISTINCT p.id) as total_ventas
        FROM polizas p
        WHERE p.estado = 'venta_cerrada'
          AND DATE(p.created_at) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      return {
        total_ventas: result[0]?.total_ventas || 0
      };
    } catch (error) {
      console.error('Error en getVentas:', error);
      return { total_ventas: 0 };
    }
  },

  /**
   * Obtiene total de ingresos (pólizas con estado='venta_cerrada' con valores de cotizaciones)
   */
  async getIngresos(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      const [result] = await db.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_polizas,
          COALESCE(SUM(cot.total_final), 0) as total_ingresos
        FROM polizas p
        LEFT JOIN cotizaciones cot ON cot.id = p.cotizacion_id
        WHERE p.estado = 'venta_cerrada'
          AND p.deleted_at IS NULL
          AND DATE(p.created_at) BETWEEN ? AND ?
      `, [dateFilter.startDate, dateFilter.endDate]);

      return {
        total_polizas: result[0]?.total_polizas || 0,
        total_ingresos: parseFloat(result[0]?.total_ingresos || 0).toFixed(2)
      };
    } catch (error) {
      console.error('Error en getIngresos:', error);
      return { total_polizas: 0, total_ingresos: 0 };
    }
  },

  /**
   * Obtiene el desglose de asignaciones por estado en el período
   */
  async getAsignacionesPorEstado(periodo = 'mes_actual') {
    try {
      const dateFilter = this.buildDateFilter(periodo);
      const [rows] = await db.query(`
        SELECT
          estado,
          COUNT(*) AS total,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS porcentaje
        FROM asignaciones
        WHERE DATE(fecha_asignacion) BETWEEN ? AND ?
          AND estado IS NOT NULL
          AND estado != ''
        GROUP BY estado
        ORDER BY total DESC
      `, [dateFilter.startDate, dateFilter.endDate]);

      return rows.map(r => ({
        estado: r.estado,
        total: Number(r.total),
        porcentaje: parseFloat(r.porcentaje)
      }));
    } catch (error) {
      console.error('Error en getAsignacionesPorEstado:', error);
      return [];
    }
  },

  /**
   * Obtiene todos los datos del dashboard en una sola llamada
   */
  async getDashboardCompleto(periodo = 'mes_actual') {
    try {
      const [kpis, prospectosPorDia, funnelData, prospectosPorCanal, ultimosProspectos, ventas, ingresos, prospectosPorLocalidad, prospectosPorPartido, asignacionesPorEstado] = await Promise.all([
        this.getKPIs(periodo),
        this.getProspectosPorDia(periodo),
        this.getFunnelData(periodo),
        this.getProspectosPorCanal(periodo),
        this.getUltimosProspectos(5),
        this.getVentas(periodo),
        this.getIngresos(periodo),
        this.getProspectosPorLocalidad(periodo),
        this.getProspectosPorPartido(periodo),
        this.getAsignacionesPorEstado(periodo)
      ]);

      return {
        periodo,
        kpis,
        prospectosPorDia,
        funnelData,
        prospectosPorCanal,
        ultimosProspectos,
        ventas,
        ingresos,
        prospectosPorLocalidad,
        prospectosPorPartido,
        asignacionesPorEstado
      };
    } catch (error) {
      console.error('Error en getDashboardCompleto:', error);
      throw error;
    }
  }
};

module.exports = dashboardMetricasModel;
