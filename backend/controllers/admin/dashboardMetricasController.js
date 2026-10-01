const dashboardMetricasModel = require('../../models/admin/dashboardMetricasModel');

const dashboardMetricasController = {
  /**
   * Obtiene todos los datos del dashboard de métricas
   * GET /api/admin/dashboard/metricas?periodo=mes_actual
   */
  async getDashboardMetricas(req, res) {
    try {
      let periodo = req.query.periodo || 'mes_actual';
      if (req.query.desde && req.query.hasta) {
        periodo = `${req.query.desde}:${req.query.hasta}`;
      }
      const data = await dashboardMetricasModel.getDashboardCompleto(periodo);
      
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error en getDashboardMetricas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener datos del dashboard',
        error: error.message
      });
    }
  },

  /**
   * Obtiene solo los KPIs
   * GET /api/admin/dashboard/metricas/kpis?periodo=mes_actual
   */
  async getKPIs(req, res) {
    try {
      let periodo = req.query.periodo || 'mes_actual';
      if (req.query.desde && req.query.hasta) {
        periodo = `${req.query.desde}:${req.query.hasta}`;
      }
      const kpis = await dashboardMetricasModel.getKPIs(periodo);
      
      res.json({
        success: true,
        data: kpis
      });
    } catch (error) {
      console.error('Error en getKPIs:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener KPIs',
        error: error.message
      });
    }
  },

  /**
   * Obtiene prospectos por día
   * GET /api/admin/dashboard/metricas/prospectos-por-dia?periodo=mes_actual
   */
  async getProspectosPorDia(req, res) {
    try {
      let periodo = req.query.periodo || 'mes_actual';
      if (req.query.desde && req.query.hasta) {
        periodo = `${req.query.desde}:${req.query.hasta}`;
      }
      const data = await dashboardMetricasModel.getProspectosPorDia(periodo);
      
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error en getProspectosPorDia:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener prospectos por día',
        error: error.message
      });
    }
  },

  /**
   * Obtiene datos del embudo de ventas
   * GET /api/admin/dashboard/metricas/funnel?periodo=mes_actual
   */
  async getFunnelData(req, res) {
    try {
      let periodo = req.query.periodo || 'mes_actual';
      if (req.query.desde && req.query.hasta) {
        periodo = `${req.query.desde}:${req.query.hasta}`;
      }
      const data = await dashboardMetricasModel.getFunnelData(periodo);
      
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error en getFunnelData:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener datos del funnel',
        error: error.message
      });
    }
  },

  /**
   * Obtiene prospectos por canal
   * GET /api/admin/dashboard/metricas/prospectos-por-canal?periodo=mes_actual
   */
  async getProspectosPorCanal(req, res) {
    try {
      let periodo = req.query.periodo || 'mes_actual';
      if (req.query.desde && req.query.hasta) {
        periodo = `${req.query.desde}:${req.query.hasta}`;
      }
      const data = await dashboardMetricasModel.getProspectosPorCanal(periodo);
      
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error en getProspectosPorCanal:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener prospectos por canal',
        error: error.message
      });
    }
  },

  /**
   * Obtiene últimos prospectos
   * GET /api/admin/dashboard/metricas/ultimos-prospectos?limit=5
   */
  async getUltimosProspectos(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const data = await dashboardMetricasModel.getUltimosProspectos(limit);
      
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error en getUltimosProspectos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener últimos prospectos',
        error: error.message
      });
    }
  }
};

module.exports = dashboardMetricasController;
