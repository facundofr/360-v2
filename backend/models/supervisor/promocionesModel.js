const db = require("../../config/db");

const PromocionesModel = {
  // Obtener todas las promociones (solo lectura para supervisores)
  async obtenerTodas() {
    try {
      const [rows] = await db.query("SELECT * FROM promociones ORDER BY id DESC");
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener promociones: ${error.message}`);
    }
  },

  // Obtener una promoción por ID
  async obtenerPorId(id) {
    try {
      const [rows] = await db.query("SELECT * FROM promociones WHERE id = ?", [id]);
      return rows.length ? rows[0] : null;
    } catch (error) {
      throw new Error(`Error al obtener promoción: ${error.message}`);
    }
  },

  // Obtener solo promociones activas
  async obtenerActivas() {
    try {
      const [rows] = await db.query(
        "SELECT * FROM promociones WHERE activa = 1 ORDER BY id DESC"
      );
      return rows;
    } catch (error) {
      throw new Error(`Error al obtener promociones activas: ${error.message}`);
    }
  },
};

module.exports = PromocionesModel;
