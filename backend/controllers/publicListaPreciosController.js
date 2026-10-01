const PublicListaPreciosService = require('../services/publicListaPreciosService');

/**
 * 📋 CONTROLADOR PÚBLICO DE LISTA DE PRECIOS (SOLO LECTURA)
 * Endpoint seguro y públicamente accesible para consumir precios desde el frontend
 * Delega la lógica al servicio
 */

class PublicListaPreciosController {
  /**
   * 🔍 Obtener lista de precios con filtros opcionales
   * GET /api/public/lista-precios
   */
  static async getListaPrecios(req, res) {
    try {
      const filters = {
        year: req.query.year,
        categoria_id: req.query.categoria_id,
        plan_id: req.query.plan_id,
        tipo_familia_id: req.query.tipo_familia_id
      };

      const data = await PublicListaPreciosService.fetchListaPrecios(filters);
      
      return res.status(200).json({
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en getListaPrecios:', error);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
        errors: error.errors,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 📊 Obtener años disponibles en la lista de precios
   * GET /api/public/lista-precios/years
   */
  static async getAvailableYears(req, res) {
    try {
      const years = await PublicListaPreciosService.fetchYears();

      return res.status(200).json({
        success: true,
        data: years,
        count: years.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en getAvailableYears:', error);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 💰 Obtener precio específico
   * GET /api/public/lista-precios/precio
   */
  static async getPrecio(req, res) {
    try {
      const { categoria_id, plan_id, year, tipo_familia_id } = req.query;

      const precio = await PublicListaPreciosService.fetchPrecio(
        categoria_id,
        plan_id,
        year,
        tipo_familia_id
      );

      return res.status(200).json({
        success: true,
        data: precio,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en getPrecio:', error);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
        params: error.params,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 📈 Obtener estadísticas de precios (resumen)
   * GET /api/public/lista-precios/stats
   */
  static async getStats(req, res) {
    try {
      const stats = await PublicListaPreciosService.fetchStats();

      return res.status(200).json({
        success: true,
        data: stats,
        count: stats.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en getStats:', error);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = PublicListaPreciosController;
