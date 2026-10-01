const db = require('../../config/db');
const validator = require('validator');

const Prestador = {
  async getAll() {
    const query = `
      SELECT 
        p.*,
        u1.first_name as created_by_name,
        u2.first_name as updated_by_name,
        COUNT(pp.id) as planes_asignados
      FROM prestadores p
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.updated_by = u2.id
      LEFT JOIN planes_prestadores pp ON p.id = pp.prestador_id AND pp.activo = 1
      GROUP BY p.id
      ORDER BY p.nombre ASC
    `;
    const [rows] = await db.query(query);
    return rows;
  },

  async getById(id) {
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      throw new Error("ID de prestador inválido.");
    }
    
    const query = `
      SELECT p.*, 
             u1.first_name as created_by_name,
             u2.first_name as updated_by_name
      FROM prestadores p
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.updated_by = u2.id
      WHERE p.id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0] || null;
  },

  async create(data) {
    const errores = this.validarDatos(data);
    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }

    const query = `
      INSERT INTO prestadores (
        nombre, especialidad, telefono, email, direccion, 
        localidad, provincia, codigo_postal, matricula, 
        tipo_prestador, estado, observaciones, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.query(query, [
      data.nombre,
      data.especialidad || null,
      data.telefono || null,
      data.email || null,
      data.direccion || null,
      data.localidad || null,
      data.provincia || null,
      data.codigo_postal || null,
      data.matricula || null,
      data.tipo_prestador || 'medico',
      data.estado !== undefined ? data.estado : 1,
      data.observaciones || null,
      data.created_by || null
    ]);
    
    return result.insertId;
  },

  async update(id, data) {
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      throw new Error("ID de prestador inválido.");
    }

    const errores = this.validarDatos(data);
    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }

    const query = `
      UPDATE prestadores SET 
        nombre = ?, especialidad = ?, telefono = ?, email = ?, 
        direccion = ?, localidad = ?, provincia = ?, codigo_postal = ?,
        matricula = ?, tipo_prestador = ?, estado = ?, 
        observaciones = ?, updated_by = ?
      WHERE id = ?
    `;
    
    const [result] = await db.query(query, [
      data.nombre,
      data.especialidad || null,
      data.telefono || null,
      data.email || null,
      data.direccion || null,
      data.localidad || null,
      data.provincia || null,
      data.codigo_postal || null,
      data.matricula || null,
      data.tipo_prestador || 'medico',
      data.estado !== undefined ? data.estado : 1,
      data.observaciones || null,
      data.updated_by || null,
      id
    ]);
    
    return result;
  },

  async delete(id) {
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      throw new Error("ID de prestador inválido.");
    }

    // Verificar si tiene planes asignados
    const [planes] = await db.query(
      'SELECT COUNT(*) as count FROM planes_prestadores WHERE prestador_id = ? AND activo = 1',
      [id]
    );
    
    if (planes[0].count > 0) {
      throw new Error("No se puede eliminar el prestador porque tiene planes asignados.");
    }

    const [result] = await db.query('DELETE FROM prestadores WHERE id = ?', [id]);
    return result;
  },

  async changeStatus(id, estado, updated_by) {
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      throw new Error("ID de prestador inválido.");
    }

    const [result] = await db.query(
      'UPDATE prestadores SET estado = ?, updated_by = ? WHERE id = ?',
      [estado ? 1 : 0, updated_by || null, id]
    );
    return result;
  },

  // Gestión de relación con planes
  async getPlanesAsignados(prestadorId) {
    const query = `
      SELECT pp.*, pl.nombre as plan_nombre
      FROM planes_prestadores pp
      JOIN planes pl ON pp.plan_id = pl.id
      WHERE pp.prestador_id = ? AND pp.activo = 1
      ORDER BY pl.nombre
    `;
    const [rows] = await db.query(query, [prestadorId]);
    return rows;
  },

  async asignarPlan(prestadorId, planId, data) {
    const query = `
      INSERT INTO planes_prestadores 
      (plan_id, prestador_id, tipo_cobertura, porcentaje_cobertura, copago, fecha_desde, fecha_hasta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      tipo_cobertura = VALUES(tipo_cobertura),
      porcentaje_cobertura = VALUES(porcentaje_cobertura),
      copago = VALUES(copago),
      fecha_desde = VALUES(fecha_desde),
      fecha_hasta = VALUES(fecha_hasta),
      activo = 1
    `;
    
    const [result] = await db.query(query, [
      planId,
      prestadorId,
      data.tipo_cobertura || 'completa',
      data.porcentaje_cobertura || 100.00,
      data.copago || 0.00,
      data.fecha_desde || null,
      data.fecha_hasta || null
    ]);
    
    return result;
  },

  async desasignarPlan(prestadorId, planId) {
    const [result] = await db.query(
      'UPDATE planes_prestadores SET activo = 0 WHERE prestador_id = ? AND plan_id = ?',
      [prestadorId, planId]
    );
    return result;
  },

  validarDatos(data) {
    const errores = [];

    // Validar nombre (obligatorio)
    if (!data.nombre || data.nombre.trim().length < 2) {
      errores.push("El nombre es obligatorio y debe tener al menos 2 caracteres.");
    }
    if (data.nombre && data.nombre.length > 100) {
      errores.push("El nombre no puede exceder 100 caracteres.");
    }

    // Validar email (opcional pero debe ser válido)
    if (data.email && !validator.isEmail(data.email)) {
      errores.push("El formato del email no es válido.");
    }

    // Validar teléfono (opcional)
    if (data.telefono && (data.telefono.length < 8 || data.telefono.length > 20)) {
      errores.push("El teléfono debe tener entre 8 y 20 caracteres.");
    }

    // Validar tipo de prestador
    const tiposValidos = ['medico', 'clinica', 'laboratorio', 'farmacia', 'otro'];
    if (data.tipo_prestador && !tiposValidos.includes(data.tipo_prestador)) {
      errores.push("El tipo de prestador no es válido.");
    }

    // Validar código postal (opcional)
    if (data.codigo_postal && (data.codigo_postal.length < 4 || data.codigo_postal.length > 10)) {
      errores.push("El código postal debe tener entre 4 y 10 caracteres.");
    }

    return errores;
  }
};

module.exports = Prestador;