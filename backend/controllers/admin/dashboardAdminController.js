const db = require('../../config/db');

class DashboardAdminController {
  
  // Obtener estadísticas del dashboard de admin
  static async getDashboard(req, res) {
    try {
      const {
        periodType = 'month',
        year = new Date().getFullYear(),
        month,
        date
      } = req.query;

      const now = new Date();
      const y = parseInt(year || now.getFullYear(), 10);
      const m = month ? parseInt(month, 10) : (now.getMonth() + 1);

      // Calcular rangos de fecha según el tipo de periodo
      let inicioPeriodo, finPeriodo;
      
      if ((periodType || '').toLowerCase() === 'year' || (periodType || '').toLowerCase() === 'anio') {
        inicioPeriodo = `${y}-01-01`;
        finPeriodo = `${y}-12-31`;
      } else if ((periodType || '').toLowerCase() === 'day' || (periodType || '').toLowerCase() === 'dia') {
        const d = date || now.toISOString().split('T')[0];
        inicioPeriodo = d;
        finPeriodo = d;
      } else {
        // Por defecto: mes actual
        const ultimoDia = new Date(y, m, 0).getDate();
        inicioPeriodo = `${y}-${String(m).padStart(2, '0')}-01`;
        finPeriodo = `${y}-${String(m).padStart(2, '0')}-${ultimoDia}`;
      }

      // Estadísticas del periodo seleccionado
      const [stats] = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE role = 2 AND is_enabled = 1) as supervisores_activos,
          (SELECT COUNT(*) FROM users WHERE role = 1 AND is_enabled = 1) as vendedores_activos,
          (SELECT COUNT(*) FROM users WHERE role = 1 AND supervisor_id IS NULL) as vendedores_sin_supervisor,
          (SELECT COUNT(*) FROM prospectos WHERE DATE(fecha_registro) = CURDATE()) as prospectos_hoy,
          (SELECT COUNT(*) FROM prospectos 
             WHERE DATE(fecha_registro) BETWEEN ? AND ?
          ) as total_prospectos,
          (SELECT COUNT(*) FROM asignaciones 
             WHERE estado = 'Venta' 
               AND DATE(fecha_estado) BETWEEN ? AND ?
          ) as ventas_mes,
          (SELECT COUNT(*) FROM asignaciones 
             WHERE estado IN ('Lead', '1º Contacto', 'Calificado Cotización', 'Calificado Póliza', 'Calificado Pago')
          ) as prospectos_activos_total,
          (SELECT COUNT(*) FROM cotizaciones 
             WHERE DATE(fecha) BETWEEN ? AND ?
          ) as cotizaciones_mes,
          (SELECT COUNT(*) FROM polizas 
             WHERE DATE(created_at) BETWEEN ? AND ?
          ) as polizas_mes,
          (SELECT COUNT(*) FROM cupones_pago 
             WHERE estado = 'pagado' 
               AND DATE(fecha_pago) BETWEEN ? AND ?
          ) as pagos_exitosos_mes,
          (SELECT ROUND(AVG(c.total_final), 2) 
             FROM polizas p 
             JOIN cotizaciones c ON c.id = p.cotizacion_id 
             WHERE p.estado = 'cerrada' 
               AND DATE(p.fecha_cambio_estado) BETWEEN ? AND ?
          ) as ticket_promedio_mes,
          (SELECT SUM(c.total_final) 
             FROM polizas p 
             JOIN cotizaciones c ON c.id = p.cotizacion_id 
             WHERE p.estado = 'cerrada' 
               AND DATE(p.fecha_cambio_estado) BETWEEN ? AND ?
          ) as ingresos_mes
      `, [
        inicioPeriodo, finPeriodo,
        inicioPeriodo, finPeriodo,
        inicioPeriodo, finPeriodo,
        inicioPeriodo, finPeriodo,
        inicioPeriodo, finPeriodo,
        inicioPeriodo, finPeriodo,
        inicioPeriodo, finPeriodo
      ]);

      console.log('✅ [ADMIN] Dashboard obtenido exitosamente');

      res.json({
        success: true,
        data: {
          periodo: {
            tipo: periodType,
            inicio: inicioPeriodo,
            fin: finPeriodo
          },
          generales: stats[0], // Cambiar 'estadisticas' a 'generales' para compatibilidad con el componente
          estadisticas: stats[0] // Mantener también estadisticas por compatibilidad
        }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas del dashboard',
        error: error.message
      });
    }
  }

  // Obtener vendedores sin supervisor (alias para compatibilidad)
  static async getVendedoresSinSupervisor(req, res) {
    try {
      const [vendedores] = await db.query(`
        SELECT 
          id,
          first_name,
          last_name,
          email,
          phone_number,
          is_enabled,
          last_login,
          created_at
        FROM users
        WHERE role = 1 AND supervisor_id IS NULL
        ORDER BY first_name, last_name
      `);

      console.log(`✅ [ADMIN] ${vendedores.length} vendedores sin supervisor obtenidos`);

      res.json({
        success: true,
        data: vendedores
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener vendedores sin supervisor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener vendedores sin supervisor',
        error: error.message
      });
    }
  }
}

module.exports = DashboardAdminController;
