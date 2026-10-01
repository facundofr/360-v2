const db = require('../../config/db');
const validator = require('validator');

const ListaPrecios = {
  async getAll(anio) {
    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      throw new Error("Año inválido.");
    }
    const [rows] = await db.query(
      `SELECT lp.*, p.nombre AS plan, c.nombre AS categoria_edad, tf.nombre AS tipo_familia
       FROM listas_precios lp
       JOIN planes p ON lp.plan_id = p.id
       JOIN categorias_edad c ON lp.categoria_id = c.id
       JOIN tipo_familia tf ON lp.tipo_familia_id = tf.id
       WHERE lp.anio = ?`,
      [anio]
    );
    return rows;
  },

  async create(data) {
    const { categoria_id, plan_id, tipo_familia_id, precio, anio } = data;
    const errores = [];

    if (!categoria_id || !validator.isInt(categoria_id.toString(), { min: 1 })) {
      errores.push("ID de categoría inválido.");
    }
    if (!plan_id || !validator.isInt(plan_id.toString(), { min: 1 })) {
      errores.push("ID de plan inválido.");
    }
    if (!tipo_familia_id || !validator.isInt(tipo_familia_id.toString(), { min: 1 })) {
      errores.push("ID de tipo de familia inválido.");
    }
    if (precio === undefined || precio === null || isNaN(precio) || Number(precio) <= 0) {
      errores.push("El precio debe ser un número positivo.");
    }
    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      errores.push("Año inválido.");
    }

    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }

    await db.query(
      `INSERT INTO listas_precios (categoria_id, plan_id, tipo_familia_id, precio, anio)
       VALUES (?, ?, ?, ?, ?)`,
      [categoria_id, plan_id, tipo_familia_id, precio, anio]
    );
  },

  async update(id, precio) {
    const errores = [];
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      errores.push("ID de lista de precios inválido.");
    }
    if (precio === undefined || precio === null || isNaN(precio) || Number(precio) <= 0) {
      errores.push("El precio debe ser un número positivo.");
    }
    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }
    const [result] = await db.query(
      `UPDATE listas_precios SET precio = ? WHERE id = ?`,
      [precio, id]
    );
    return result;
  },

  // ✅ MEJORAR: Función unificada para aumentar/disminuir porcentaje
  async updateAllByPercentage(anio, porcentaje, operacion = 'aumentar') {
    const errores = [];
    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      errores.push("Año inválido.");
    }
    if (porcentaje === undefined || porcentaje === null || isNaN(porcentaje) || Number(porcentaje) <= 0) {
      errores.push("El porcentaje debe ser un número positivo.");
    }
    if (operacion === 'disminuir' && Number(porcentaje) >= 100) {
      errores.push("El porcentaje de descuento no puede ser mayor o igual a 100%.");
    }
    
    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }

    await db.query('START TRANSACTION');
    try {
      // Bloquear los registros para actualización
      await db.query(
        `SELECT id FROM listas_precios WHERE anio = ? FOR UPDATE`,
        [anio]
      );
      
      let query;
      if (operacion === 'disminuir') {
        // Restar porcentaje: precio = precio * (1 - porcentaje/100)
        query = `UPDATE listas_precios SET precio = precio * (1 - ? / 100) WHERE anio = ?`;
      } else {
        // Aumentar porcentaje: precio = precio * (1 + porcentaje/100)
        query = `UPDATE listas_precios SET precio = precio * (1 + ? / 100) WHERE anio = ?`;
      }
      
      const [result] = await db.query(query, [porcentaje, anio]);
      
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  },

  // ✅ MANTENER: Función específica para aumentar (retrocompatibilidad)
  async updateAllByPercentageIncrease(anio, porcentaje) {
    return this.updateAllByPercentage(anio, porcentaje, 'aumentar');
  },

  // ✅ AGREGAR: Función específica para disminuir
  async updateAllByPercentageDecrease(anio, porcentaje) {
    return this.updateAllByPercentage(anio, porcentaje, 'disminuir');
  },

  async delete(id) {
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      throw new Error("ID de lista de precios inválido.");
    }
    const [result] = await db.query(
      `DELETE FROM listas_precios WHERE id = ?`,
      [id]
    );
    return result;
  },

  // ✅ CORREGIR: Método para exportación SIN columnas inexistentes
  async getAllForExport(anio) {
    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      throw new Error("Año inválido.");
    }
    
    const [rows] = await db.query(
      `SELECT 
        lp.id,
        lp.categoria_id,
        lp.plan_id,
        lp.tipo_familia_id,
        lp.precio,
        lp.anio,
        p.nombre AS plan,
        c.nombre AS categoria_edad,
        tf.nombre AS tipo_familia
       FROM listas_precios lp
       JOIN planes p ON lp.plan_id = p.id
       JOIN categorias_edad c ON lp.categoria_id = c.id
       JOIN tipo_familia tf ON lp.tipo_familia_id = tf.id
       WHERE lp.anio = ?
       ORDER BY p.nombre, c.nombre, tf.nombre`,
      [anio]
    );
    
    return rows;
  },

  // ✅ CORREGIR: Estadísticas para exportación
  async getEstadisticasExportacion(anio) {
    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      throw new Error("Año inválido.");
    }

    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_precios,
        COUNT(DISTINCT lp.plan_id) as total_planes,
        COUNT(DISTINCT lp.categoria_id) as total_categorias,
        COUNT(DISTINCT lp.tipo_familia_id) as total_tipos_familia,
        MIN(lp.precio) as precio_minimo,
        MAX(lp.precio) as precio_maximo,
        AVG(lp.precio) as precio_promedio,
        SUM(lp.precio) as suma_total_precios
       FROM listas_precios lp
       WHERE lp.anio = ?`,
      [anio]
    );

    return stats[0];
  },
};

module.exports = ListaPrecios;