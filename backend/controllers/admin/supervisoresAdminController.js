const db = require('../../config/db');

class SupervisoresAdminController {
  
  // Obtener todos los supervisores con sus equipos
  static async getSupervisores(req, res) {
    try {
      const [supervisores] = await db.query(`
        SELECT 
          s.id,
          s.first_name,
          s.last_name,
          s.email,
          s.phone_number,
          s.is_enabled,
          s.last_login,
          s.created_at,
          COUNT(v.id) as total_vendedores,
          COUNT(CASE WHEN v.is_enabled = 1 THEN 1 END) as vendedores_activos,
          COUNT(CASE WHEN v.last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as vendedores_activos_semana
        FROM users s
        LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
        WHERE s.role = 2
        GROUP BY s.id, s.first_name, s.last_name, s.email, s.phone_number, s.is_enabled, s.last_login, s.created_at
        ORDER BY s.first_name, s.last_name
      `);

      console.log(`✅ [ADMIN] ${supervisores.length} supervisores obtenidos`);

      res.json({
        success: true,
        data: supervisores
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener supervisores:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener supervisores',
        error: error.message
      });
    }
  }

  // Obtener detalles de un supervisor específico y su equipo
  static async getDetallesSupervisor(req, res) {
    try {
      const { id } = req.params;

      // Información del supervisor
      const [supervisor] = await db.query(`
        SELECT 
          id, first_name, last_name, email, phone_number,
          is_enabled, last_login, created_at
        FROM users 
        WHERE id = ? AND role = 2
      `, [id]);

      if (supervisor.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Supervisor no encontrado'
        });
      }

      // Vendedores asignados al supervisor
      const [vendedores] = await db.query(`
        SELECT 
          v.id,
          v.first_name,
          v.last_name,
          v.email,
          v.phone_number,
          v.is_enabled,
          v.last_login,
          v.categoria_id,
          c.nombre as categoria_nombre,
          COUNT(p.id) as total_prospectos,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as ventas_realizadas,
          COUNT(CASE WHEN p.estado IN ('Lead', '1º Contacto', 'Calificado Cotización', 'Calificado Póliza', 'Calificado Pago') THEN 1 END) as prospectos_activos
        FROM users v
        LEFT JOIN categorias_config c ON v.categoria_id = c.id
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        WHERE v.supervisor_id = ? AND v.role = 1
        GROUP BY v.id, v.first_name, v.last_name, v.email, v.phone_number, v.is_enabled, v.last_login, v.categoria_id, c.nombre
        ORDER BY v.first_name, v.last_name
      `, [id]);

      console.log(`✅ [ADMIN] Detalles del supervisor ${id} obtenidos`);

      res.json({
        success: true,
        data: {
          supervisor: supervisor[0],
          vendedores: vendedores
        }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener detalles del supervisor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles del supervisor',
        error: error.message
      });
    }
  }

  // Obtener vendedores sin supervisor asignado
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
          last_login
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

  // Asignar vendedor a supervisor
  static async asignarVendedor(req, res) {
    try {
      const { vendedorId, supervisorId } = req.body;

      if (!vendedorId) {
        return res.status(400).json({
          success: false,
          message: 'ID de vendedor requerido'
        });
      }

      // supervisorId puede ser null para quitar el supervisor
      await db.query(
        'UPDATE users SET supervisor_id = ? WHERE id = ? AND role = 1',
        [supervisorId || null, vendedorId]
      );

      console.log(`✅ [ADMIN] Vendedor ${vendedorId} asignado al supervisor ${supervisorId || 'ninguno'}`);

      res.json({
        success: true,
        message: supervisorId ? 'Vendedor asignado al supervisor correctamente' : 'Supervisor removido del vendedor correctamente'
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al asignar vendedor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al asignar vendedor',
        error: error.message
      });
    }
  }

  // Habilitar/Deshabilitar supervisor
  static async toggleSupervisorStatus(req, res) {
    try {
      const { id } = req.params;

      // Obtener estado actual
      const [supervisor] = await db.query(
        'SELECT is_enabled, first_name, last_name FROM users WHERE id = ? AND role = 2',
        [id]
      );

      if (supervisor.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Supervisor no encontrado'
        });
      }

      const nuevoEstado = supervisor[0].is_enabled === 1 ? 0 : 1;

      await db.query(
        'UPDATE users SET is_enabled = ? WHERE id = ?',
        [nuevoEstado, id]
      );

      console.log(`✅ [ADMIN] Supervisor ${id} ${nuevoEstado === 1 ? 'habilitado' : 'deshabilitado'}`);

      res.json({
        success: true,
        message: `Supervisor ${nuevoEstado === 1 ? 'habilitado' : 'deshabilitado'} correctamente`,
        data: { is_enabled: nuevoEstado }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al cambiar estado del supervisor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cambiar estado del supervisor',
        error: error.message
      });
    }
  }

  // Obtener métricas generales de supervisores
  static async getMetricasGenerales(req, res) {
    try {
      const [metricas] = await db.query(`
        SELECT 
          COUNT(*) as totalSupervisores,
          COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as supervisoresActivos,
          COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as supervisoresActivosSemana
        FROM users
        WHERE role = 2
      `);

      console.log('✅ [ADMIN] Métricas generales de supervisores obtenidas');

      res.json({
        success: true,
        data: metricas[0]
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener métricas generales:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener métricas generales',
        error: error.message
      });
    }
  }
}

module.exports = SupervisoresAdminController;
