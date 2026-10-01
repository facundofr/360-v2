const db = require('../../config/db');

const VendedorModel = {
  /**
   * Obtiene la lista de vendedores del supervisor con sus métricas
   * @param {number} supervisor_id - ID del supervisor
   * @returns {Promise<Array>} Array de vendedores
   */
  async findAll(supervisor_id) {
    const [vendedores] = await db.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.phone_number, 
        u.role, 
        u.is_enabled, 
        u.created_at,
        u.categoria_id,
        cc.nombre as categoria_nombre,
        cc.capacidad_maxima,
        cc.prioridad as categoria_prioridad,
        COUNT(DISTINCT a.id_prospecto) AS total_prospectos,
        SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) AS ventas_completadas,
        ROUND(
          (SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) / 
          IF(COUNT(DISTINCT a.id_prospecto) > 0, COUNT(DISTINCT a.id_prospecto), 1)) * 100, 
          2
        ) AS tasa_conversion,
        ROUND(
          (COUNT(DISTINCT a.id_prospecto) / IFNULL(cc.capacidad_maxima, 50)) * 100,
          2
        ) AS porcentaje_carga
      FROM users u
      LEFT JOIN asignaciones a ON u.id = a.id_vendedor
      LEFT JOIN categorias_config cc ON u.categoria_id = cc.id
      WHERE u.role = 1 AND u.supervisor_id = ?
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone_number, u.role, u.is_enabled, u.created_at, u.categoria_id, cc.nombre, cc.capacidad_maxima, cc.prioridad
      ORDER BY cc.prioridad ASC, u.id DESC
    `, [supervisor_id]);
    
    return vendedores;
  },

  /**
   * Obtiene las métricas detalladas de un vendedor específico del supervisor
   * @param {number} id - ID del vendedor
   * @param {number} supervisor_id - ID del supervisor
   * @returns {Promise<Object>} Objeto con métricas y estadísticas mensuales
   */
  async getMetricas(id, supervisor_id) {
    // Verificar que el ID sea válido
    if (!id || isNaN(id)) {
      throw new Error('ID de vendedor inválido');
    }

    // Verificar que el vendedor pertenece al supervisor
    const [vendedorCheck] = await db.query(
      'SELECT id FROM users WHERE id = ? AND role = 1 AND supervisor_id = ?', 
      [id, supervisor_id]
    );
    
    if (vendedorCheck.length === 0) {
      throw new Error('Vendedor no encontrado o no tiene acceso a este vendedor');
    }
    
    // Métricas generales del vendedor
    const [metricas] = await db.query(`
      SELECT 
        COUNT(DISTINCT a.id_prospecto) AS total_prospectos,
        SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) AS ventas_completadas,
        SUM(CASE WHEN a.estado = 'Lead' THEN 1 ELSE 0 END) AS leads,
        SUM(CASE WHEN a.estado = '1º Contacto' THEN 1 ELSE 0 END) AS primer_contacto,
        SUM(CASE WHEN a.estado = 'Calificado Cotización' THEN 1 ELSE 0 END) AS calificado_cotizacion,
        SUM(CASE WHEN a.estado = 'Calificado Póliza' THEN 1 ELSE 0 END) AS calificado_poliza,
        SUM(CASE WHEN a.estado = 'Calificado Pago' THEN 1 ELSE 0 END) AS calificado_pago,
        ROUND(
          (SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) / 
          IF(COUNT(DISTINCT a.id_prospecto) > 0, COUNT(DISTINCT a.id_prospecto), 1)) * 100, 
          2
        ) AS tasa_conversion
      FROM asignaciones a
      WHERE a.id_vendedor = ?
    `, [id]);
    
    // Estadísticas mensuales (últimos 6 meses)
    const [estadisticasMensuales] = await db.query(`
      SELECT 
        DATE_FORMAT(a.fecha_asignacion, '%Y-%m') AS mes,
        COUNT(DISTINCT a.id_prospecto) AS prospectos,
        SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) AS ventas
      FROM asignaciones a
      WHERE a.id_vendedor = ?
      AND a.fecha_asignacion >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(a.fecha_asignacion, '%Y-%m')
      ORDER BY mes ASC
    `, [id]);
    
    return {
      metricas: metricas[0] || {
        total_prospectos: 0,
        ventas_completadas: 0,
        leads: 0,
        primer_contacto: 0,
        calificado_cotizacion: 0,
        calificado_poliza: 0,
        calificado_pago: 0,
        tasa_conversion: 0
      },
      estadisticasMensuales
    };
  },

  /**
   * Habilita un vendedor deshabilitado del supervisor
   * @param {number} id - ID del vendedor a habilitar
   * @param {number} supervisor_id - ID del supervisor
   * @returns {Promise<Object>} Resultado de la operación
   */
  async enableVendedor(id, supervisor_id) {
    // Verificar que el ID sea válido
    if (!id || isNaN(id)) {
      throw new Error('ID de vendedor inválido');
    }
    
    // Verificar que el usuario exista, sea un vendedor y pertenezca al supervisor
    const [vendedor] = await db.query(
      'SELECT id FROM users WHERE id = ? AND role = 1 AND supervisor_id = ?', 
      [id, supervisor_id]
    );
    
    if (vendedor.length === 0) {
      throw new Error('Vendedor no encontrado o no tiene acceso a este vendedor');
    }
    
    // Habilitar al vendedor
    const [result] = await db.query(
      'UPDATE users SET is_enabled = 1 WHERE id = ?', 
      [id]
    );
    
    return {
      affectedRows: result.affectedRows,
      message: result.affectedRows > 0 ? 'Vendedor habilitado correctamente' : 'No se pudo habilitar el vendedor'
    };
  }
};

module.exports = VendedorModel;