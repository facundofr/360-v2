const DashboardModel = require('../../models/admin/DashboardModel');

class DashboardController {
  /**
   * Obtener resumen general del dashboard
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerResumen(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta
      };

      const resumen = await DashboardModel.obtenerResumenGeneral(filtros);

      res.json({
        success: true,
        data: resumen,
        message: 'Resumen del dashboard obtenido exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerResumen:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el resumen del dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener actividad reciente
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerActividad(req, res) {
    try {
      const limite = parseInt(req.query.limite) || 10;
      const actividad = await DashboardModel.obtenerActividadReciente(limite);

      res.json({
        success: true,
        data: actividad,
        message: 'Actividad reciente obtenida exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerActividad:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la actividad reciente',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener estadísticas de vendedores
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerVendedores(req, res) {
    try {
      const limite = parseInt(req.query.limite) || 5;
      const vendedores = await DashboardModel.obtenerEstadisticasVendedores(limite);

      res.json({
        success: true,
        data: vendedores,
        message: 'Estadísticas de vendedores obtenidas exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerVendedores:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las estadísticas de vendedores',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener tendencias de prospectos
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerTendencias(req, res) {
    try {
      const dias = parseInt(req.query.dias) || 30;
      const tendencia = await DashboardModel.obtenerTendenciaProspectos(dias);

      res.json({
        success: true,
        data: tendencia,
        message: 'Tendencias obtenidas exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerTendencias:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las tendencias',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener distribución de pólizas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerDistribucion(req, res) {
    try {
      const distribucion = await DashboardModel.obtenerDistribucionPolizas();

      res.json({
        success: true,
        data: distribucion,
        message: 'Distribución de pólizas obtenida exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerDistribucion:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la distribución de pólizas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener alertas del dashboard
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerAlertas(req, res) {
    try {
      const alertas = await DashboardModel.obtenerAlertas();

      res.json({
        success: true,
        data: alertas,
        message: 'Alertas obtenidas exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerAlertas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las alertas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtener dashboard completo (llamada única optimizada)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async obtenerDashboardCompleto(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta
      };

      const dashboardData = await DashboardModel.obtenerDashboardCompleto(filtros);

      console.log('✅ Dashboard completo generado exitosamente');
      console.log(`- Resumen: usuarios=${dashboardData.resumen.usuarios.total_usuarios}, prospectos=${dashboardData.resumen.prospectos.total_prospectos}`);
      console.log(`- Actividad: ${dashboardData.actividad.length} registros`);
      console.log(`- Top vendedores: ${dashboardData.vendedores.length} registros`);
      console.log(`- Alertas activas: ${dashboardData.alertas.length}`);

      res.json({
        success: true,
        data: dashboardData,
        message: 'Dashboard completo obtenido exitosamente'
      });
    } catch (error) {
      console.error('❌ Error en DashboardController.obtenerDashboardCompleto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el dashboard completo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = DashboardController;
