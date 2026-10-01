const db = require('../../config/db');

const SupervisorResumen = {
  async getResumen(supervisor_id) {
    // Total de prospectos asignados a vendedores del supervisor
    const [[{ totalAsignados }]] = await db.query(
      `SELECT COUNT(*) AS totalAsignados 
       FROM asignaciones a
       INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?`,
      [supervisor_id]
    );

    // Prospectos nuevos hoy (por fecha de registro en prospectos del supervisor)
    const [[{ nuevosDia }]] = await db.query(
      `SELECT COUNT(*) AS nuevosDia 
       FROM prospectos p
       INNER JOIN asignaciones a ON a.id_prospecto = p.id
       INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
       WHERE p.fecha_registro = CURDATE()`,
      [supervisor_id]
    );

    // Prospectos nuevos esta semana
    const [[{ nuevosSemana }]] = await db.query(
      `SELECT COUNT(*) AS nuevosSemana 
       FROM prospectos p
       INNER JOIN asignaciones a ON a.id_prospecto = p.id
       INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
       WHERE YEARWEEK(p.fecha_registro, 1) = YEARWEEK(CURDATE(), 1)`,
      [supervisor_id]
    );

    // Prospectos nuevos este mes
    const [[{ nuevosMes }]] = await db.query(
      `SELECT COUNT(*) AS nuevosMes 
       FROM prospectos p
       INNER JOIN asignaciones a ON a.id_prospecto = p.id
       INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
       WHERE YEAR(p.fecha_registro) = YEAR(CURDATE()) AND MONTH(p.fecha_registro) = MONTH(CURDATE())`,
      [supervisor_id]
    );

    // Prospectos convertidos en ventas (estado en asignaciones del supervisor)
    const [[{ totalVentas }]] = await db.query(
      `SELECT COUNT(*) AS totalVentas 
       FROM asignaciones a
       INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
       WHERE a.estado = 'Venta'`,
      [supervisor_id]
    );

    // Prospectos por estado (desde asignaciones del supervisor)
    const [prospectosPorEstado] = await db.query(
      `SELECT estado, COUNT(*) AS cantidad 
       FROM asignaciones a
       INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
       GROUP BY estado`,
      [supervisor_id]
    );

    return {
      totalAsignados,
      nuevosDia,
      nuevosSemana,
      nuevosMes,
      totalVentas,
      prospectosPorEstado
    };
  },

  async getMetricasPorVendedor(supervisor_id) {
    // Cantidad de prospectos por vendedor del supervisor
    const [prospectosPorVendedor] = await db.query(`
      SELECT 
        u.id AS vendedor_id,
        CONCAT(u.first_name, ' ', u.last_name) AS vendedor,
        COUNT(a.id) AS total_prospectos
      FROM asignaciones a
      INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
      GROUP BY a.id_vendedor
    `, [supervisor_id]);

    // Tasa de conversión por vendedor (ventas / total asignados) del supervisor
    const [conversionPorVendedor] = await db.query(`
      SELECT 
        u.id AS vendedor_id,
        CONCAT(u.first_name, ' ', u.last_name) AS vendedor,
        SUM(a.estado = 'Venta') AS ventas,
        COUNT(a.id) AS total_prospectos,
        ROUND(100 * SUM(a.estado = 'Venta') / COUNT(a.id), 2) AS tasa_conversion
      FROM asignaciones a
      INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
      GROUP BY a.id_vendedor
    `, [supervisor_id]);

    // Prospectos por estado por vendedor del supervisor
    const [estadosPorVendedor] = await db.query(`
      SELECT 
        u.id AS vendedor_id,
        CONCAT(u.first_name, ' ', u.last_name) AS vendedor,
        a.estado,
        COUNT(a.id) AS cantidad
      FROM asignaciones a
      INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
      GROUP BY a.id_vendedor, a.estado
    `, [supervisor_id]);

    // Tiempo promedio de conversión (desde asignación hasta venta) del supervisor
    const [tiempoPromedioConversion] = await db.query(`
      SELECT 
        u.id AS vendedor_id,
        CONCAT(u.first_name, ' ', u.last_name) AS vendedor,
        ROUND(AVG(TIMESTAMPDIFF(HOUR, a.fecha_asignacion, a.fecha_estado)), 2) AS horas_promedio_conversion
      FROM asignaciones a
      INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
      WHERE a.estado = 'Venta' AND a.fecha_asignacion IS NOT NULL AND a.fecha_estado IS NOT NULL
      GROUP BY a.id_vendedor
    `, [supervisor_id]);

    return {
      prospectosPorVendedor,
      conversionPorVendedor,
      estadosPorVendedor,
      tiempoPromedioConversion
    };
  },

  async getCotizacionesPorProspecto(supervisor_id) {
    // Cotizaciones por prospecto de vendedores del supervisor
    const [cotizacionesPorProspecto] = await db.query(`
      SELECT 
        p.id AS prospecto_id,
        CONCAT(p.nombre, ' ', p.apellido) AS prospecto,
        u.id AS vendedor_id,
        CONCAT(u.first_name, ' ', u.last_name) AS vendedor,
        COUNT(c.id) AS total_cotizaciones,
        MAX(c.created_at) AS ultima_cotizacion,
        COALESCE(SUM(c.total_final), 0) AS valor_total_cotizaciones
      FROM prospectos p
      INNER JOIN asignaciones a ON a.id_prospecto = p.id
      INNER JOIN users u ON a.id_vendedor = u.id AND u.supervisor_id = ?
      LEFT JOIN cotizaciones c ON c.prospecto_id = p.id
      GROUP BY p.id, u.id
      ORDER BY ultima_cotizacion DESC
    `, [supervisor_id]);

    return cotizacionesPorProspecto;
  }
};

module.exports = SupervisorResumen;