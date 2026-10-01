/**
 * Configuración centralizada para el sistema de métricas
 */

const METRICAS_CONFIG = {
  // Rangos de edad predefinidos
  RANGOS_EDAD: {
    '18-24': { min: 18, max: 24, orden: 1 },
    '25-34': { min: 25, max: 34, orden: 2 },
    '35-44': { min: 35, max: 44, orden: 3 },
    '45-54': { min: 45, max: 54, orden: 4 },
    '55-64': { min: 55, max: 64, orden: 5 },
    '65+': { min: 65, max: 999, orden: 6 },
    'No especificado': { min: null, max: null, orden: 7 }
  },

  // Límites de consultas
  LIMITES: {
    DIAS_TENDENCIA: 30,
    MAX_PERIODOS_EVOLUCION: 50,
    TOP_VENDEDORES: 10,
    TOP_FUENTES: 10
  },

  // Agrupaciones temporales válidas
  AGRUPACIONES_TEMPORALES: ['day', 'week', 'month'],

  // Formatos de fecha por agrupación
  FORMATOS_FECHA: {
    day: 'YYYY-MM-DD',
    week: 'YYYY-MM-DD',
    month: 'YYYY-MM'
  },

  // Truncate para PostgreSQL por agrupación
  TRUNCATE_POSTGRES: {
    day: 'day',
    week: 'week',
    month: 'month'
  },

  // Estados de prospects válidos
  ESTADOS_PROSPECT: [
    'Nuevo',
    'Contactado',
    'Interesado',
    'Cotizacion_Enviada',
    'Negociacion',
    'Venta',
    'No_Interesado',
    'No_Contactado'
  ],

  // Roles de usuario válidos para métricas
  ROLES_USUARIO: ['vendedor', 'supervisor', 'admin'],

  // Configuración de caché (si se implementa)
  CACHE: {
    TTL_SEGUNDOS: 300, // 5 minutos
    ENABLED: false
  },

  // Configuración de validaciones
  VALIDACIONES: {
    FECHA_REGEX: /^\d{4}-\d{2}-\d{2}$/,
    MAX_RANGO_DIAS: 365, // Máximo 1 año de rango
    MIN_FECHA: '2020-01-01' // Fecha mínima válida
  },

  // Mensajes de error estandarizados
  MENSAJES_ERROR: {
    FECHA_INVALIDA: 'Formato de fecha inválido (use YYYY-MM-DD)',
    RANGO_FECHA_INVALIDO: 'El rango de fechas no puede ser mayor a 365 días',
    FECHA_ORDEN_INVALIDO: 'fecha_desde debe ser anterior a fecha_hasta',
    PARAMETROS_FALTANTES: 'Faltan parámetros requeridos',
    AGRUPACION_INVALIDA: 'Agrupación inválida. Valores permitidos: day, week, month',
    ID_INVALIDO: 'ID debe ser un número válido mayor a 0',
    ACCESO_DENEGADO: 'No tiene permisos para acceder a esta información'
  },

  // Configuración de logging
  LOGGING: {
    ENABLED: true,
    NIVEL: 'info', // debug, info, warn, error
    INCLUIR_QUERIES: false // Solo en desarrollo
  }
};

/**
 * Funciones utilitarias para métricas
 */
const METRICAS_UTILS = {
  /**
   * Obtener configuración de rango de edad
   * @param {number} edad - Edad a clasificar
   * @returns {string} - Rango de edad
   */
  obtenerRangoEdad(edad) {
    if (!edad || isNaN(edad)) return 'No especificado';
    
    for (const [rango, config] of Object.entries(METRICAS_CONFIG.RANGOS_EDAD)) {
      if (config.min !== null && config.max !== null) {
        if (edad >= config.min && edad <= config.max) {
          return rango;
        }
      }
    }
    
    return 'No especificado';
  },

  /**
   * Validar rango de fechas
   * @param {string} fechaDesde - Fecha de inicio
   * @param {string} fechaHasta - Fecha de fin
   * @returns {Object} - Resultado de validación
   */
  validarRangoFechas(fechaDesde, fechaHasta) {
    const errores = [];

    if (fechaDesde && !METRICAS_CONFIG.VALIDACIONES.FECHA_REGEX.test(fechaDesde)) {
      errores.push(METRICAS_CONFIG.MENSAJES_ERROR.FECHA_INVALIDA + ' (fecha_desde)');
    }

    if (fechaHasta && !METRICAS_CONFIG.VALIDACIONES.FECHA_REGEX.test(fechaHasta)) {
      errores.push(METRICAS_CONFIG.MENSAJES_ERROR.FECHA_INVALIDA + ' (fecha_hasta)');
    }

    if (fechaDesde && fechaHasta) {
      const desde = new Date(fechaDesde);
      const hasta = new Date(fechaHasta);
      
      if (desde > hasta) {
        errores.push(METRICAS_CONFIG.MENSAJES_ERROR.FECHA_ORDEN_INVALIDO);
      }

      const diffDias = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24));
      if (diffDias > METRICAS_CONFIG.VALIDACIONES.MAX_RANGO_DIAS) {
        errores.push(METRICAS_CONFIG.MENSAJES_ERROR.RANGO_FECHA_INVALIDO);
      }
    }

    return {
      valido: errores.length === 0,
      errores
    };
  },

  /**
   * Generar cláusula WHERE base para consultas
   * @returns {string} - Cláusula WHERE base
   */
  obtenerWhereBase() {
    return '1=1'; // Condición base que siempre es verdadera
  },

  /**
   * Formatear respuesta estándar de API
   * @param {boolean} success - Éxito de la operación
   * @param {*} data - Datos de respuesta
   * @param {string} message - Mensaje descriptivo
   * @param {Object} meta - Metadatos adicionales
   * @returns {Object} - Respuesta formateada
   */
  formatearRespuesta(success, data, message, meta = null) {
    const respuesta = {
      success,
      data,
      message,
      timestamp: new Date().toISOString()
    };

    if (meta) {
      respuesta.meta = meta;
    }

    return respuesta;
  },

  /**
   * Calcular tasa de conversión
   * @param {number} convertidos - Número de convertidos
   * @param {number} total - Total de leads
   * @returns {number} - Tasa de conversión
   */
  calcularTasaConversion(convertidos, total) {
    if (!total || total === 0) return 0;
    return Math.round((convertidos / total) * 100 * 100) / 100; // 2 decimales
  }
};

module.exports = {
  METRICAS_CONFIG,
  METRICAS_UTILS
};