const db = require('../config/db');

class MetricasModel {
  /**
   * Obtener métricas avanzadas de leads
   * @param {Object} filtros - Filtros para las consultas
   * @returns {Promise<Object>} - Métricas agrupadas
   */
  static async obtenerMetricasAvanzadas(filtros) {
    const { 
      fecha_desde, 
      fecha_hasta, 
      vendedor_id, 
      supervisor_id 
    } = filtros;

    // Construir condiciones WHERE
    const { whereClause, queryParams } = this.construirFiltrosWhere(filtros);

    try {
      // Ejecutar todas las consultas en paralelo
      const [
        leadsPorHoraResult,
        leadsPorEdadResult,
        leadsPorDiaResult,
        resumenResult
      ] = await Promise.all([
        this.obtenerLeadsPorHora(filtros),
        this.obtenerLeadsPorEdad(whereClause, queryParams),
        this.obtenerLeadsPorDia(whereClause, queryParams),
        this.obtenerResumenGeneral(whereClause, queryParams, filtros)
      ]);

      // Formatear resultados - MySQL devuelve arrays, no objetos con .rows
      const formatResult = (result) => {
        if (Array.isArray(result)) return result;
        if (result && result.rows) return result.rows;
        if (result && Array.isArray(result[0])) return result[0];
        return [];
      };

      const metricas = {
        leadsPorHora: formatResult(leadsPorHoraResult),
        leadsPorEdad: formatResult(leadsPorEdadResult),
        leadsPorDia: formatResult(leadsPorDiaResult).reverse(), // Ordenar cronológicamente
        resumen: resumenResult || {}
      };

      // Agregar información adicional al resumen
      if (metricas.resumen.hora_pico !== undefined && metricas.resumen.hora_pico !== null) {
        metricas.resumen.hora_pico_formateada = `${metricas.resumen.hora_pico}:00`;
      }

      return metricas;
    } catch (error) {
      console.error('❌ Error en MetricasModel.obtenerMetricasAvanzadas:', error);
      throw error;
    }
  }

  /**
   * Construir filtros WHERE para las consultas
   * @param {Object} filtros - Filtros de la consulta
   * @returns {Object} - whereClause y queryParams
   */
  static construirFiltrosWhere(filtros) {
    const { fecha_desde, fecha_hasta, vendedor_id, supervisor_id } = filtros;
    
    let whereConditions = [];
    let queryParams = [];

    if (fecha_desde) {
      whereConditions.push('p.fecha_registro >= ?');
      queryParams.push(fecha_desde);
    }

    if (fecha_hasta) {
      whereConditions.push('p.fecha_registro <= DATE_ADD(?, INTERVAL 1 DAY)');
      queryParams.push(fecha_hasta);
    }

    if (vendedor_id) {
      whereConditions.push('p.user_id = ?');
      queryParams.push(vendedor_id);
    }

    if (supervisor_id) {
      whereConditions.push('v.supervisor_id = ?');
      queryParams.push(supervisor_id);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    return { whereClause, queryParams };
  }

  /**
   * Obtener leads agrupados por hora del día
   * @param {string} whereClause - Cláusula WHERE
   * @param {Array} queryParams - Parámetros de la consulta
   * @returns {Promise<Object>} - Resultado de la consulta
   */
  static async obtenerLeadsPorHora(filtros) {
    const query = `
      SELECT 
        HOUR(a.fecha_asignacion) as hora,
        COUNT(*) as total_leads
      FROM asignaciones a
      INNER JOIN prospectos p ON a.id_prospecto = p.id
      LEFT JOIN users v ON a.id_vendedor = v.id
      WHERE DATE(a.fecha_asignacion) >= ? AND DATE(a.fecha_asignacion) <= ?
      ${filtros.vendedor_id ? 'AND a.id_vendedor = ?' : ''}
      ${filtros.supervisor_id ? 'AND v.supervisor_id = ?' : ''}
      GROUP BY HOUR(a.fecha_asignacion)
      ORDER BY hora;
    `;

    const params = [filtros.fecha_desde, filtros.fecha_hasta];
    if (filtros.vendedor_id) params.push(filtros.vendedor_id);
    if (filtros.supervisor_id) params.push(filtros.supervisor_id);

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Obtener leads agrupados por rango de edad
   * @param {string} whereClause - Cláusula WHERE
   * @param {Array} queryParams - Parámetros de la consulta
   * @returns {Promise<Object>} - Resultado de la consulta
   */
  static async obtenerLeadsPorEdad(whereClause, queryParams) {
    const query = `
      SELECT 
        CASE 
          WHEN p.edad BETWEEN 18 AND 25 THEN '18-25'
          WHEN p.edad BETWEEN 26 AND 35 THEN '26-35'
          WHEN p.edad BETWEEN 36 AND 45 THEN '36-45'
          WHEN p.edad BETWEEN 46 AND 55 THEN '46-55'
          WHEN p.edad BETWEEN 56 AND 65 THEN '56-65'
          WHEN p.edad > 65 THEN '65+'
          ELSE 'Sin edad'
        END as rango_edad,
        COUNT(*) as total_leads
      FROM prospectos p
      LEFT JOIN users v ON p.user_id = v.id
      ${whereClause}
      GROUP BY rango_edad
      ORDER BY rango_edad;
    `;

    const [rows] = await db.query(query, queryParams);
    return rows;
  }

  /**
   * Obtener leads agrupados por sexo
   * @param {string} whereClause - Cláusula WHERE
   * @param {Array} queryParams - Parámetros de la consulta
   * @returns {Promise<Object>} - Resultado de la consulta
   */
  /**
   * Obtener tendencia de leads por día
   * @param {string} whereClause - Cláusula WHERE
   * @param {Array} queryParams - Parámetros de la consulta
   * @returns {Promise<Object>} - Resultado de la consulta
   */
  static async obtenerLeadsPorDia(whereClause, queryParams) {
    const query = `
      SELECT 
        DATE(p.fecha_registro) as fecha,
        COUNT(*) as total_leads,
        COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as ventas
      FROM prospectos p
      LEFT JOIN users v ON p.user_id = v.id
      ${whereClause}
      GROUP BY DATE(p.fecha_registro)
      ORDER BY fecha DESC
      LIMIT 30;
    `;

    const [rows] = await db.query(query, queryParams);
    return rows;
  }

  /**
   * Obtener resumen general de métricas
   * @param {string} whereClause - Cláusula WHERE
   * @param {Array} queryParams - Parámetros de la consulta
   * @param {Object} filtros - Filtros originales
   * @returns {Promise<Object>} - Resultado de la consulta
   */
  static async obtenerResumenGeneral(whereClause, queryParams, filtros = {}) {
    // Construir parámetros para la subconsulta de hora pico
    const horaPicoParams = [];
    let horaPicoConditions = [];
    
    if (filtros.fecha_desde) {
      horaPicoConditions.push('DATE(a2.fecha_asignacion) >= ?');
      horaPicoParams.push(filtros.fecha_desde);
    }
    
    if (filtros.fecha_hasta) {
      horaPicoConditions.push('DATE(a2.fecha_asignacion) <= ?');
      horaPicoParams.push(filtros.fecha_hasta);
    }
    
    if (filtros.vendedor_id) {
      horaPicoConditions.push('a2.id_vendedor = ?');
      horaPicoParams.push(filtros.vendedor_id);
    }
    
    if (filtros.supervisor_id) {
      horaPicoConditions.push('v2.supervisor_id = ?');
      horaPicoParams.push(filtros.supervisor_id);
    }
    
    const horaPicoWhere = horaPicoConditions.length > 0 
      ? `WHERE ${horaPicoConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as total_ventas,
        COUNT(CASE WHEN p.estado = '1º Contacto' THEN 1 END) as primer_contacto,
        COUNT(CASE WHEN p.estado = 'Calificado Cotización' THEN 1 END) as cotizaciones,
        COUNT(CASE WHEN p.estado = 'Calificado Póliza' THEN 1 END) as polizas,
        ROUND(COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) * 100.0 / COUNT(*), 2) as conversion_rate,
        (
          SELECT HOUR(a2.fecha_asignacion) 
          FROM asignaciones a2
          INNER JOIN prospectos p2 ON a2.id_prospecto = p2.id 
          LEFT JOIN users v2 ON a2.id_vendedor = v2.id
          ${horaPicoWhere}
          GROUP BY HOUR(a2.fecha_asignacion) 
          ORDER BY COUNT(*) DESC 
          LIMIT 1
        ) as hora_pico
      FROM prospectos p
      LEFT JOIN users v ON p.user_id = v.id
      ${whereClause};
    `;

    const allParams = [...queryParams, ...horaPicoParams];
    const [rows] = await db.query(query, allParams);
    return rows[0] || {};
  }

  /**
   * Obtener métricas comparativas entre dos períodos
   * @param {Object} parametros - Parámetros de comparación
   * @returns {Promise<Object>} - Métricas comparativas
   */
  static async obtenerMetricasComparativas(parametros) {
    const { 
      fecha_inicio_periodo1,
      fecha_fin_periodo1,
      fecha_inicio_periodo2,
      fecha_fin_periodo2,
      vendedor_id,
      supervisor_id
    } = parametros;

    try {
      // Construir condiciones WHERE para cada período
      let whereConditions1 = [
        'p.fecha_registro >= ?',
        'p.fecha_registro <= DATE_ADD(?, INTERVAL 1 DAY)'
      ];

      let whereConditions2 = [
        'p.fecha_registro >= ?',
        'p.fecha_registro <= DATE_ADD(?, INTERVAL 1 DAY)'
      ];

      let queryParams = [
        fecha_inicio_periodo1, fecha_fin_periodo1,
        fecha_inicio_periodo2, fecha_fin_periodo2
      ];

      if (vendedor_id) {
        whereConditions1.push('p.user_id = ?');
        whereConditions2.push('p.user_id = ?');
        queryParams.push(vendedor_id, vendedor_id);
      }

      if (supervisor_id) {
        whereConditions1.push('v.supervisor_id = ?');
        whereConditions2.push('v.supervisor_id = ?');
        queryParams.push(supervisor_id, supervisor_id);
      }

      const whereClause1 = `WHERE ${whereConditions1.join(' AND ')}`;
      const whereClause2 = `WHERE ${whereConditions2.join(' AND ')}`;

      // Consulta comparativa
      const consultaComparativa = `
        WITH periodo1 AS (
          SELECT 
            COUNT(*) as total_leads,
            COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as leads_convertidos,
            ROUND(AVG(p.edad), 1) as edad_promedio
          FROM prospectos p
          LEFT JOIN users v ON p.user_id = v.id
          ${whereClause1}
        ),
        periodo2 AS (
          SELECT 
            COUNT(*) as total_leads,
            COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as leads_convertidos,
            ROUND(AVG(p.edad), 1) as edad_promedio
          FROM prospectos p
          LEFT JOIN users v ON p.user_id = v.id
          ${whereClause2}
        )
        SELECT 
          p1.total_leads as periodo1_total,
          p1.leads_convertidos as periodo1_convertidos,
          p1.edad_promedio as periodo1_edad,
          p2.total_leads as periodo2_total,
          p2.leads_convertidos as periodo2_convertidos,
          p2.edad_promedio as periodo2_edad,
          CASE 
            WHEN p1.total_leads > 0 
            THEN ROUND(((p2.total_leads - p1.total_leads) * 100.0 / p1.total_leads), 2)
            ELSE 0
          END as crecimiento_leads,
          CASE 
            WHEN p1.leads_convertidos > 0 
            THEN ROUND(((p2.leads_convertidos - p1.leads_convertidos) * 100.0 / p1.leads_convertidos), 2)
            ELSE 0
          END as crecimiento_conversiones
        FROM periodo1 p1, periodo2 p2;
      `;

      const resultado = await db.query(consultaComparativa, queryParams);
      return resultado[0]?.[0] || {};
    } catch (error) {
      console.error('❌ Error en MetricasModel.obtenerMetricasComparativas:', error);
      throw error;
    }
  }

  /**
   * Obtener métricas de rendimiento por vendedor
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Array>} - Métricas de rendimiento
   */
  static async obtenerRendimientoVendedores(filtros) {
    const { fecha_desde, fecha_hasta, supervisor_id } = filtros;

    let whereConditions = ['p.user_id IS NOT NULL'];
    let queryParams = [];

    if (fecha_desde) {
      whereConditions.push('p.fecha_registro >= ?');
      queryParams.push(fecha_desde);
    }

    if (fecha_hasta) {
      whereConditions.push('p.fecha_registro <= DATE_ADD(?, INTERVAL 1 DAY)');
      queryParams.push(fecha_hasta);
    }

    if (supervisor_id) {
      whereConditions.push('v.supervisor_id = ?');
      queryParams.push(supervisor_id);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    try {
      const rendimientoQuery = `
        SELECT 
          v.id as vendedor_id,
          v.first_name,
          v.last_name,
          v.email,
          COUNT(p.id) as total_leads,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as ventas,
          ROUND(
            (COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) * 100.0 / NULLIF(COUNT(p.id), 0)), 
            2
          ) as tasa_conversion,
          COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) as cotizaciones_generadas,
          COUNT(CASE WHEN pol.id IS NOT NULL THEN 1 END) as polizas_generadas,
          ROUND(AVG(p.edad), 1) as edad_promedio_leads,
          COUNT(CASE WHEN cw.id IS NOT NULL THEN 1 END) as leads_con_whatsapp
        FROM users v
        LEFT JOIN prospectos p ON v.id = p.user_id
        LEFT JOIN cotizaciones c ON p.id = c.prospecto_id
        LEFT JOIN polizas pol ON p.id = pol.prospecto_id
        LEFT JOIN chat_conversaciones_whatsapp cw ON p.numero_contacto = cw.telefono
        ${whereClause}
        AND v.categoria_id IN (2, 3)
        GROUP BY v.id, v.first_name, v.last_name, v.email
        HAVING COUNT(p.id) > 0
        ORDER BY ventas DESC, tasa_conversion DESC;
      `;

      const resultado = await db.query(rendimientoQuery, queryParams);
      return resultado[0] || [];
    } catch (error) {
      console.error('❌ Error en MetricasModel.obtenerRendimientoVendedores:', error);
      throw error;
    }
  }

  /**
   * Obtener métricas de conversión por fuente
   * @param {Object} filtros - Filtros para la consulta
   * @returns {Promise<Array>} - Métricas por fuente
   */
  static async obtenerMetricasPorFuente(filtros) {
    const { whereClause, queryParams } = this.construirFiltrosWhere(filtros);

    try {
      const query = `
        SELECT 
          COALESCE(p.fuente, 'No especificada') as fuente,
          COUNT(*) as total_leads,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as leads_convertidos,
          ROUND(
            (COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 
            2
          ) as tasa_conversion,
          ROUND(AVG(p.edad), 1) as edad_promedio
        FROM prospectos p
        LEFT JOIN users v ON p.user_id = v.id
        ${whereClause}
        GROUP BY p.fuente
        ORDER BY total_leads DESC;
      `;

      const resultado = await db.query(query, queryParams);
      return resultado[0] || [];
    } catch (error) {
      console.error('❌ Error en MetricasModel.obtenerMetricasPorFuente:', error);
      throw error;
    }
  }

  /**
   * Obtener evolución temporal de métricas
   * @param {Object} filtros - Filtros para la consulta
   * @param {string} agrupacion - 'day', 'week', 'month'
   * @returns {Promise<Array>} - Evolución temporal
   */
  static async obtenerEvolucionTemporal(filtros, agrupacion = 'day') {
    const { whereClause, queryParams } = this.construirFiltrosWhere(filtros);

    let formatoFecha;
    let intervaloSQL;
    
    switch (agrupacion) {
      case 'week':
        formatoFecha = '%Y-%m-%d';
        intervaloSQL = 'DATE(DATE_SUB(p.fecha_registro, INTERVAL WEEKDAY(p.fecha_registro) DAY))';
        break;
      case 'month':
        formatoFecha = '%Y-%m';
        intervaloSQL = 'DATE_FORMAT(p.fecha_registro, "%Y-%m-01")';
        break;
      default:
        formatoFecha = '%Y-%m-%d';
        intervaloSQL = 'DATE(p.fecha_registro)';
    }

    try {
      const query = `
        SELECT 
          ${intervaloSQL} as periodo,
          DATE_FORMAT(${intervaloSQL}, '${formatoFecha}') as fecha_formateada,
          COUNT(*) as total_leads,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as leads_convertidos,
          ROUND(
            (COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 
            2
          ) as tasa_conversion
        FROM prospectos p
        LEFT JOIN users v ON p.user_id = v.id
        ${whereClause}
        GROUP BY ${intervaloSQL}
        ORDER BY periodo DESC
        LIMIT 50;
      `;

      const resultado = await db.query(query, queryParams);
      return (resultado[0] || []).reverse(); // Ordenar cronológicamente
    } catch (error) {
      console.error('❌ Error en MetricasModel.obtenerEvolucionTemporal:', error);
      throw error;
    }
  }
}

module.exports = MetricasModel;