const db = require('../../config/db');

const NacionalidadController = {
  async listar(req, res) {
    try {
      const [rows] = await db.query('SELECT id, nombre FROM nacionalidades ORDER BY nombre ASC');
      res.json(rows);
    } catch (error) {
      console.error('Error al obtener nacionalidades:', error);
      res.status(500).json({ error: 'Error al obtener nacionalidades' });
    }
  }
};

module.exports = NacionalidadController;