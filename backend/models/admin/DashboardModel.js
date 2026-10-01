const db = require('../../config/db');

class DashboardModel {
  /**
   * Obtener resumen general del dashboard
   * @param {Object} filtros - Filtros opcionales (fecha_desde, fecha_hasta)
   * @returns {Promise<Object>} - Datos de resumen
   */
  static async obtenerResumenGeneral(filtros = {}) {
    const { fecha_desde, fecha_hasta } = filtros;
    
    try {
      const [usuarios] = await db.query(
        `SELECT 
          COUNT(*) as total_usuarios,
          SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as usuarios_activos,
          SUM(CASE WHEN role = 1 THEN 1 ELSE 0 END) as total_vendedores,
          SUM(CASE WHEN role = 2 THEN 1 ELSE 0 END) as total_supervisores
        FROM users`
      );

      const [prospectos] = await db.query(
        `SELECT 
          COUNT(*) as total_prospectos,
          SUM(CASE WHEN estado = 'Lead' THEN 1 ELSE 0 END) as prospectos_nuevos,
          SUM(CASE WHEN estado = '1º Contacto' THEN 1 ELSE 0 END) as prospectos_contactados,
          SUM(CASE WHEN estado = 'Venta' THEN 1 ELSE 0 END) as prospectos_cerrados
        FROM prospectos`
      );

      const [polizas] = await db.query(
        `SELECT 
          COUNT(*) as total_polizas,
          SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as polizas_activas,
          SUM(CASE WHEN estado = 'pendiente_revision' THEN 1 ELSE 0 END) as polizas_pendientes,
          0 as valor_total_primas
        FROM polizas`
      );

      const [sesiones] = await db.query(
        `SELECT 
          COUNT(DISTINCT user_id) as usuarios_conectados,
          COUNT(*) as total_sesiones_activas
        FROM user_sessions`
      );

      return {
        usuarios: usuarios[0] || {},
        prospectos: prospectos[0] || {},
        polizas: polizas[0] || {},
        sesiones: sesiones[0] || {}
      };
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerResumenGeneral:', error);
      throw error;
    }
  }

  /**
   * Obtener actividad reciente del dashboard
   * @param {number} limite - Número de registros a obtener
   * @returns {Promise<Array>} - Actividad reciente
   */
  static async obtenerActividadReciente(limite = 10) {
    try {
      const [actividad] = await db.query(
        `SELECT 
          ha.id,
          ha.accion,
          ha.descripcion,
          ha.accion as tabla_afectada,
          ha.fecha as timestamp,
          u.first_name,
          u.last_name,
          u.email
        FROM historial_acciones ha
        LEFT JOIN users u ON ha.id_vendedor = u.id
        ORDER BY ha.fecha DESC
        LIMIT ?`,
        [limite]
      );

      return actividad || [];
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerActividadReciente:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas por vendedor
   * @returns {Promise<Array>} - Top vendedores con sus métricas
   */
  static async obtenerEstadisticasVendedores(limite = 5) {
    try {
      const [vendedores] = await db.query(
        `SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(DISTINCT p.id) as total_prospectos,
          COUNT(DISTINCT pol.id) as total_polizas,
          0 as ingresos_generados,
          COUNT(DISTINCT CASE WHEN p.estado = 'Venta' THEN p.id END) as prospectos_cerrados
        FROM users u
        LEFT JOIN prospectos p ON u.id = p.user_id
        LEFT JOIN polizas pol ON pol.prospecto_id = p.id
        WHERE u.role = 1
        GROUP BY u.id
        ORDER BY total_prospectos DESC
        LIMIT ?`,
        [limite]
      );

      return vendedores || [];
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerEstadisticasVendedores:', error);
      throw error;
    }
  }

  /**
   * Obtener tendencias diarias de prospectos
   * @param {number} dias - Número de días a visualizar
   * @returns {Promise<Array>} - Datos de tendencia
   */
  static async obtenerTendenciaProspectos(dias = 30) {
    try {
      const [tendencia] = await db.query(
        `SELECT 
          DATE(fecha_hora_registro) as fecha,
          COUNT(*) as total_prospectos,
          SUM(CASE WHEN estado = 'Lead' THEN 1 ELSE 0 END) as nuevos,
          SUM(CASE WHEN estado = '1º Contacto' THEN 1 ELSE 0 END) as contactados,
          SUM(CASE WHEN estado = 'Venta' THEN 1 ELSE 0 END) as cerrados
        FROM prospectos
        WHERE fecha_hora_registro >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(fecha_hora_registro)
        ORDER BY fecha ASC`,
        [dias]
      );

      return tendencia || [];
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerTendenciaProspectos:', error);
      throw error;
    }
  }

  /**
   * Obtener información de pólizas por tipo
   * @returns {Promise<Array>} - Distribución de pólizas
   */
  static async obtenerDistribucionPolizas() {
    try {
      const [distribucion] = await db.query(
        `SELECT 
          'Sin plan' as tipo_plan,
          COUNT(p.id) as cantidad_polizas,
          0 as valor_total,
          ROUND(100.0 * COUNT(p.id) / (SELECT COUNT(*) FROM polizas WHERE deleted_at IS NULL), 2) as porcentaje
        FROM polizas p
        WHERE p.deleted_at IS NULL
        GROUP BY p.id
        LIMIT 1`
      );

      return distribucion || [];
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerDistribucionPolizas:', error);
      throw error;
    }
  }

  /**
   * Obtener alertas y notificaciones del dashboard
   * @returns {Promise<Array>} - Alertas activas
   */
  static async obtenerAlertas() {
    try {
      const alertas = [];

      // Pólizas por revisar
      const [polizasPendientes] = await db.query(
        `SELECT 
          COUNT(*) as cantidad,
          'polizas_pendientes' as tipo_alerta,
          'warning' as severidad
        FROM polizas
        WHERE estado IN ('pendiente_revision', 'en_revision')`
      );

      // Prospectos sin asignar
      const [prospectosNoAsignados] = await db.query(
        `SELECT 
          COUNT(*) as cantidad,
          'prospectos_sin_asignar' as tipo_alerta,
          'info' as severidad
        FROM prospectos
        WHERE user_id IS NULL AND estado = 'Lead'`
      );

      // Usuarios inactivos
      const [usuariosInactivos] = await db.query(
        `SELECT 
          COUNT(*) as cantidad,
          'usuarios_inactivos' as tipo_alerta,
          'info' as severidad
        FROM users
        WHERE last_login < DATE_SUB(NOW(), INTERVAL 7 DAY) 
          AND is_enabled = 1`
      );

      if (polizasPendientes[0]?.cantidad > 0) alertas.push(polizasPendientes[0]);
      if (prospectosNoAsignados[0]?.cantidad > 0) alertas.push(prospectosNoAsignados[0]);
      if (usuariosInactivos[0]?.cantidad > 0) alertas.push(usuariosInactivos[0]);

      return alertas;
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerAlertas:', error);
      return [];
    }
  }

  /**
   * Obtener datos completos del dashboard (llamada única)
   * @param {Object} filtros - Filtros opcionales
   * @returns {Promise<Object>} - Todos los datos del dashboard
   */
  static async obtenerDashboardCompleto(filtros = {}) {
    try {
      const [
        resumen,
        actividad,
        vendedores,
        tendencia,
        distribucion,
        alertas
      ] = await Promise.all([
        this.obtenerResumenGeneral(filtros),
        this.obtenerActividadReciente(10),
        this.obtenerEstadisticasVendedores(5),
        this.obtenerTendenciaProspectos(30),
        this.obtenerDistribucionPolizas(),
        this.obtenerAlertas()
      ]);

      return {
        resumen,
        actividad,
        vendedores,
        tendencia,
        distribucion,
        alertas,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error en DashboardModel.obtenerDashboardCompleto:', error);
      throw error;
    }
  }
}

module.exports = DashboardModel;
