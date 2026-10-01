const GoogleSheetsService = require('../../services/googleSheetsService');

const GoogleSheetsController = {
  /**
   * 🧪 Probar conexión con Google Sheets
   * GET /api/google-sheets/test
   */
  async testConexion(req, res) {
    try {
      const result = await GoogleSheetsService.probarConexion();
      res.json({
        success: true,
        message: 'Conexión exitosa con Google Sheets',
        data: result
      });
    } catch (error) {
      console.error('Error probando conexión:', error);
      res.status(500).json({
        success: false,
        message: 'Error al conectar con Google Sheets',
        error: error.message
      });
    }
  },

  /**
   * 🆕 Inicializar hoja con headers
   * POST /api/google-sheets/init
   */
  async inicializarHoja(req, res) {
    try {
      await GoogleSheetsService.inicializarHoja();
      res.json({
        success: true,
        message: 'Hoja inicializada correctamente con headers'
      });
    } catch (error) {
      console.error('Error inicializando hoja:', error);
      res.status(500).json({
        success: false,
        message: 'Error al inicializar la hoja',
        error: error.message
      });
    }
  },

  /**
   * 🔄 Sincronizar todos los prospectos
   * POST /api/google-sheets/sync-all
   */
  async sincronizarTodos(req, res) {
    try {
      const result = await GoogleSheetsService.sincronizarTodosProspectos();
      res.json({
        success: true,
        message: `Sincronizados ${result.sincronizados} prospectos`,
        data: result
      });
    } catch (error) {
      console.error('Error sincronizando prospectos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar prospectos',
        error: error.message
      });
    }
  },

  /**
   * ➕ Sincronizar un prospecto específico
   * POST /api/google-sheets/sync/:id
   */
  async sincronizarProspecto(req, res) {
    try {
      const { id } = req.params;
      await GoogleSheetsService.agregarProspecto(id);
      res.json({
        success: true,
        message: `Prospecto ${id} sincronizado correctamente`
      });
    } catch (error) {
      console.error('Error sincronizando prospecto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar prospecto',
        error: error.message
      });
    }
  },

  /**
   * 🔄 Actualizar estado de un prospecto
   * PUT /api/google-sheets/update-estado/:id
   */
  async actualizarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      
      await GoogleSheetsService.actualizarEstadoProspecto(id, estado);
      res.json({
        success: true,
        message: `Estado del prospecto ${id} actualizado en Google Sheets`
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado',
        error: error.message
      });
    }
  }
};

module.exports = GoogleSheetsController;
