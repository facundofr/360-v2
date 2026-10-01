const db = require('../../config/db');

const Historial = {
  async registrarAccion(id_prospecto, id_vendedor, accion, descripcion) {
    await db.query(
      `INSERT INTO historial_acciones (id_prospecto, id_vendedor, accion, descripcion) VALUES (?, ?, ?, ?)`,
      [id_prospecto, id_vendedor, accion, descripcion]
    );
  },

  async getHistorialPorProspecto(id_prospecto) {
    const [rows] = await db.query(
      `SELECT h.*, u.first_name, u.last_name 
       FROM historial_acciones h
       JOIN users u ON h.id_vendedor = u.id
       WHERE h.id_prospecto = ?
       ORDER BY h.fecha DESC`,
      [id_prospecto]
    );
    return rows;
  }
};

module.exports = Historial;