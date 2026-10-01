const MetricasModel = require('../models/MetricasModel');

class MetricasController {
  /**
   * Obtener métricas avanzadas de leads
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerMetricasAvanzadas(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        vendedor_id: req.query.vendedor_id,
        supervisor_id: req.query.supervisor_id
      };

      const metricas = await MetricasModel.obtenerMetricasAvanzadas(filtros);

      console.log('📊 Métricas avanzadas generadas exitosamente');
      console.log('- Leads por hora:', metricas.leadsPorHora.length, 'puntos de datos');
      console.log('- Leads por edad:', metricas.leadsPorEdad.length, 'rangos');
      console.log('- Tendencia diaria:', metricas.leadsPorDia.length, 'días');

      res.json({
        success: true,
        data: metricas,
        message: 'Métricas avanzadas obtenidas exitosamente'
      });

    } catch (error) {
      console.error('❌ Error en MetricasController.obtenerMetricasAvanzadas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener métricas comparativas entre períodos
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerMetricasComparativas(req, res) {
    try {
      const parametros = {
        fecha_inicio_periodo1: req.query.fecha_inicio_periodo1,
        fecha_fin_periodo1: req.query.fecha_fin_periodo1,
        fecha_inicio_periodo2: req.query.fecha_inicio_periodo2,
        fecha_fin_periodo2: req.query.fecha_fin_periodo2,
        vendedor_id: req.query.vendedor_id,
        supervisor_id: req.query.supervisor_id
      };

      // Validar que se proporcionen todos los períodos necesarios
      if (!parametros.fecha_inicio_periodo1 || !parametros.fecha_fin_periodo1 || 
          !parametros.fecha_inicio_periodo2 || !parametros.fecha_fin_periodo2) {
        return res.status(400).json({
          success: false,
          message: 'Se requieren las fechas de inicio y fin para ambos períodos'
        });
      }

      const metricas = await MetricasModel.obtenerMetricasComparativas(parametros);

      res.json({
        success: true,
        data: metricas,
        message: 'Métricas comparativas obtenidas exitosamente'
      });

    } catch (error) {
      console.error('❌ Error en MetricasController.obtenerMetricasComparativas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener métricas de rendimiento por vendedor
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerRendimientoVendedores(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        supervisor_id: req.query.supervisor_id
      };

      const metricas = await MetricasModel.obtenerRendimientoVendedores(filtros);

      console.log(`📈 Métricas de rendimiento generadas para ${metricas.length} vendedores`);

      res.json({
        success: true,
        data: metricas,
        message: 'Métricas de rendimiento obtenidas exitosamente',
        meta: {
          total_vendedores: metricas.length,
          filtros_aplicados: Object.keys(filtros).filter(key => filtros[key]).length
        }
      });

    } catch (error) {
      console.error('❌ Error en MetricasController.obtenerRendimientoVendedores:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener métricas por fuente de leads
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerMetricasPorFuente(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        vendedor_id: req.query.vendedor_id,
        supervisor_id: req.query.supervisor_id
      };

      const metricas = await MetricasModel.obtenerMetricasPorFuente(filtros);

      console.log(`📊 Métricas por fuente generadas para ${metricas.length} fuentes`);

      res.json({
        success: true,
        data: metricas,
        message: 'Métricas por fuente obtenidas exitosamente',
        meta: {
          total_fuentes: metricas.length,
          total_leads: metricas.reduce((acc, curr) => acc + parseInt(curr.total_leads), 0)
        }
      });

    } catch (error) {
      console.error('❌ Error en MetricasController.obtenerMetricasPorFuente:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener evolución temporal de métricas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerEvolucionTemporal(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        vendedor_id: req.query.vendedor_id,
        supervisor_id: req.query.supervisor_id
      };

      const agrupacion = req.query.agrupacion || 'day';

      // Validar agrupación
      const agrupacionesValidas = ['day', 'week', 'month'];
      if (!agrupacionesValidas.includes(agrupacion)) {
        return res.status(400).json({
          success: false,
          message: `Agrupación inválida. Valores permitidos: ${agrupacionesValidas.join(', ')}`
        });
      }

      const metricas = await MetricasModel.obtenerEvolucionTemporal(filtros, agrupacion);

      console.log(`📈 Evolución temporal generada con ${metricas.length} períodos (${agrupacion})`);

      res.json({
        success: true,
        data: metricas,
        message: 'Evolución temporal obtenida exitosamente',
        meta: {
          agrupacion: agrupacion,
          total_periodos: metricas.length,
          rango_fechas: metricas.length > 0 ? {
            desde: metricas[0].fecha_formateada,
            hasta: metricas[metricas.length - 1].fecha_formateada
          } : null
        }
      });

    } catch (error) {
      console.error('❌ Error en MetricasController.obtenerEvolucionTemporal:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener resumen ejecutivo de métricas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerResumenEjecutivo(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        vendedor_id: req.query.vendedor_id,
        supervisor_id: req.query.supervisor_id
      };

      // Obtener múltiples métricas en paralelo
      const [
        metricasAvanzadas,
        rendimientoVendedores,
        metricasPorFuente
      ] = await Promise.all([
        MetricasModel.obtenerMetricasAvanzadas(filtros),
        MetricasModel.obtenerRendimientoVendedores(filtros),
        MetricasModel.obtenerMetricasPorFuente(filtros)
      ]);

      // Calcular insights adicionales
      const insights = {
        total_vendedores_activos: rendimientoVendedores.length,
        mejor_vendedor: rendimientoVendedores.length > 0 ? rendimientoVendedores[0] : null,
        fuente_principal: metricasPorFuente.length > 0 ? metricasPorFuente[0] : null,
        tasa_conversion_promedio: rendimientoVendedores.length > 0 
          ? (rendimientoVendedores.reduce((acc, curr) => acc + parseFloat(curr.tasa_conversion || 0), 0) / rendimientoVendedores.length).toFixed(2)
          : 0
      };

      const resumen = {
        metricas_generales: metricasAvanzadas.resumen,
        top_vendedores: rendimientoVendedores.slice(0, 5),
        distribuciones: {
          por_hora: metricasAvanzadas.leadsPorHora,
          por_edad: metricasAvanzadas.leadsPorEdad,
          por_fuente: metricasPorFuente.slice(0, 5)
        },
        insights: insights
      };

      console.log('📊 Resumen ejecutivo generado exitosamente');

      res.json({
        success: true,
        data: resumen,
        message: 'Resumen ejecutivo obtenido exitosamente'
      });

    } catch (error) {
      console.error('❌ Error en MetricasController.obtenerResumenEjecutivo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Validar filtros comunes
   * @param {Object} filtros - Filtros a validar
   * @returns {Object} - Resultado de la validación
   */
  static validarFiltros(filtros) {
    const errores = [];

    // Validar formato de fechas
    if (filtros.fecha_desde && !this.esDateValida(filtros.fecha_desde)) {
      errores.push('Formato de fecha_desde inválido (use YYYY-MM-DD)');
    }

    if (filtros.fecha_hasta && !this.esDateValida(filtros.fecha_hasta)) {
      errores.push('Formato de fecha_hasta inválido (use YYYY-MM-DD)');
    }

    // Validar que fecha_desde sea anterior a fecha_hasta
    if (filtros.fecha_desde && filtros.fecha_hasta) {
      if (new Date(filtros.fecha_desde) > new Date(filtros.fecha_hasta)) {
        errores.push('fecha_desde debe ser anterior a fecha_hasta');
      }
    }

    // Validar IDs numéricos
    if (filtros.vendedor_id && !this.esNumeroValido(filtros.vendedor_id)) {
      errores.push('vendedor_id debe ser un número válido');
    }

    if (filtros.supervisor_id && !this.esNumeroValido(filtros.supervisor_id)) {
      errores.push('supervisor_id debe ser un número válido');
    }

    return {
      valido: errores.length === 0,
      errores: errores
    };
  }

  /**
   * Validar si una fecha tiene formato válido
   * @param {string} fecha - Fecha a validar
   * @returns {boolean} - True si es válida
   */
  static esDateValida(fecha) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(fecha) && !isNaN(Date.parse(fecha));
  }

  /**
   * Validar si un número es válido
   * @param {string|number} numero - Número a validar
   * @returns {boolean} - True si es válido
   */
  static esNumeroValido(numero) {
    return !isNaN(numero) && parseInt(numero) > 0;
  }
}

module.exports = MetricasController;