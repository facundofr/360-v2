const db = require('../../config/db');
const validator = require('validator');

const CategoriaConfig = {
  // Obtener todas las categorías
  async findAll() {
    const [categorias] = await db.query(`
      SELECT 
        c.*,
        COUNT(u.id) as vendedores_asignados,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM asignaciones a WHERE a.id_vendedor = u.id)
        ), 0) as total_prospectos_categoria
      FROM categorias_config c
      LEFT JOIN users u ON c.id = u.categoria_id AND u.role = 1 AND u.is_enabled = 1
      GROUP BY c.id
      ORDER BY c.prioridad ASC, c.nombre ASC
    `);
    return categorias;
  },

  // Obtener una categoría por ID
  async findById(id) {
    const [rows] = await db.query(`
      SELECT c.*, COUNT(u.id) as vendedores_asignados
      FROM categorias_config c
      LEFT JOIN users u ON c.id = u.categoria_id AND u.role = 1 AND u.is_enabled = 1
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);
    return rows[0];
  },

  // Crear nueva categoría
  async create(data) {
    const { nombre, descripcion, prioridad } = data;

    // Validaciones
    if (!nombre || nombre.trim().length < 2 || nombre.trim().length > 50) {
      throw new Error("El nombre debe tener entre 2 y 50 caracteres");
    }

    if (!validator.isInt(prioridad.toString(), { min: 1, max: 10 })) {
      throw new Error("La prioridad debe ser un número entre 1 y 10");
    }

    // Sanitización
    const nombreClean = validator.escape(nombre.trim());
    const descripcionClean = descripcion ? validator.escape(descripcion.trim()) : null;

    const [result] = await db.query(`
      INSERT INTO categorias_config (nombre, descripcion, prioridad)
      VALUES (?, ?, ?)
    `, [nombreClean, descripcionClean, prioridad]);

    // Crear entrada en round-robin
    await db.query(`
      INSERT INTO distribucion_round_robin (categoria_id)
      VALUES (?)
    `, [result.insertId]);

    return result.insertId;
  },

  // Actualizar categoría
  async update(id, data) {
    const { nombre, descripcion, prioridad, activa } = data;

    // Validaciones
    if (nombre && (nombre.trim().length < 2 || nombre.trim().length > 50)) {
      throw new Error("El nombre debe tener entre 2 y 50 caracteres");
    }

    if (prioridad && !validator.isInt(prioridad.toString(), { min: 1, max: 10 })) {
      throw new Error("La prioridad debe ser un número entre 1 y 10");
    }

    // Sanitización
    const updates = [];
    const values = [];

    if (nombre) {
      updates.push('nombre = ?');
      values.push(validator.escape(nombre.trim()));
    }

    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      values.push(descripcion ? validator.escape(descripcion.trim()) : null);
    }

    if (prioridad) {
      updates.push('prioridad = ?');
      values.push(prioridad);
    }

    if (activa !== undefined) {
      updates.push('activa = ?');
      values.push(activa ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new Error("No hay campos para actualizar");
    }

    values.push(id);

    const [result] = await db.query(`
      UPDATE categorias_config 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    return result.affectedRows > 0;
  },

  // Eliminar categoría (solo si no tiene vendedores asignados)
  async delete(id) {
    // Verificar que no tenga vendedores asignados
    const [vendedores] = await db.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE categoria_id = ? AND role = 1
    `, [id]);

    if (vendedores[0].count > 0) {
      throw new Error("No se puede eliminar la categoría porque tiene vendedores asignados");
    }

    await db.query('START TRANSACTION');

    try {
      // Eliminar entrada de round-robin
      await db.query('DELETE FROM distribucion_round_robin WHERE categoria_id = ?', [id]);
      
      // Eliminar categoría
      const [result] = await db.query('DELETE FROM categorias_config WHERE id = ?', [id]);
      
      await db.query('COMMIT');
      return result.affectedRows > 0;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  },

  // Obtener vendedores por categoría
  async getVendedoresByCategoria(categoriaId) {
    const [vendedores] = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.is_enabled,
        COUNT(a.id) as total_prospectos,
        SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) as ventas_completadas
      FROM users u
      LEFT JOIN asignaciones a ON u.id = a.id_vendedor
      WHERE u.categoria_id = ? AND u.role = 1
      GROUP BY u.id
      ORDER BY u.first_name, u.last_name
    `, [categoriaId]);

    return vendedores;
  }
};

module.exports = CategoriaConfig;
