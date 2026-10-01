const db = require('../config/db');

/**
 * 📋 SERVICIO PÚBLICO DE LISTA DE PRECIOS
 * Logica de lectura de precios de forma pública y segura
 */
class PublicListaPreciosService {
  /**
   * 🔍 Obtener lista de precios con filtros opcionales
   */
  static async fetchListaPrecios(filters = {}) {
    try {
      let query = 'SELECT lp.*, cat.nombre as categoria_nombre FROM lista_precios lp LEFT JOIN categorias cat ON lp.categoria_id = cat.id WHERE 1=1';
      const params = [];

      // Filtros opcionales
      if (filters.year) {
        query += ' AND YEAR(lp.fecha_vigencia) = ?';
        params.push(filters.year);
      }

      if (filters.categoria_id) {
        query += ' AND lp.categoria_id = ?';
        params.push(filters.categoria_id);
      }

      if (filters.plan_id) {
        query += ' AND lp.plan_id = ?';
        params.push(filters.plan_id);
      }

      if (filters.tipo_familia_id) {
        query += ' AND lp.tipo_familia_id = ?';
        params.push(filters.tipo_familia_id);
      }

      query += ' ORDER BY lp.fecha_vigencia DESC LIMIT 1000';

      const [rows] = await db.execute(query, params);
      return rows || [];
    } catch (error) {
      console.error('❌ Error en fetchListaPrecios:', error);
      throw new Error('Error al obtener lista de precios');
    }
  }

  /**
   * 📊 Obtener categorías disponibles
   */
  static async getCategorias() {
    try {
      const [categorias] = await db.execute('SELECT id, nombre FROM categorias WHERE estado = 1 ORDER BY nombre');
      return categorias || [];
    } catch (error) {
      console.error('❌ Error en getCategorias:', error);
      throw new Error('Error al obtener categorías');
    }
  }

  /**
   * 📅 Obtener años disponibles
   */
  static async getYearsAvailable() {
    try {
      const [years] = await db.execute('SELECT DISTINCT YEAR(fecha_vigencia) as year FROM lista_precios ORDER BY year DESC');
      return years || [];
    } catch (error) {
      console.error('❌ Error en getYearsAvailable:', error);
      throw new Error('Error al obtener años disponibles');
    }
  }

  /**
   * 🔍 Obtener precio específico
   */
  static async getPrecioById(id) {
    try {
      const [precio] = await db.execute(
        'SELECT * FROM lista_precios WHERE id = ? AND estado = 1',
        [id]
      );
      return precio?.[0] || null;
    } catch (error) {
      console.error('❌ Error en getPrecioById:', error);
      throw new Error('Error al obtener precio');
    }
  }
}

module.exports = PublicListaPreciosService;
