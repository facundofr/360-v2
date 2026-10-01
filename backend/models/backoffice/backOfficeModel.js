const db = require('../../config/db');

class BackOfficeModel {
  
  // Obtener todos los supervisores con sus equipos
  static async getSupervisoresConEquipos() {
    try {
      const [supervisores] = await db.query(`
        SELECT 
          s.id,
          s.first_name,
          s.last_name,
          s.email,
          s.is_enabled,
          s.last_login,
          s.created_at,
          COUNT(v.id) as total_vendedores,
          COUNT(CASE WHEN v.is_enabled = 1 THEN 1 END) as vendedores_activos,
          COUNT(CASE WHEN v.last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as vendedores_activos_semana
        FROM users s
        LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
        WHERE s.role = 2
        GROUP BY s.id, s.first_name, s.last_name, s.email, s.is_enabled, s.last_login, s.created_at
        ORDER BY s.first_name, s.last_name
      `);

      return supervisores;
    } catch (error) {
      console.error('Error al obtener supervisores con equipos:', error);
      throw error;
    }
  }

  // Obtener detalles completos de un supervisor y su equipo
  static async getDetallesSupervisor(supervisorId) {
    try {
      // Información del supervisor
      const [supervisor] = await db.query(`
        SELECT 
          id, first_name, last_name, email, phone_number,
          is_enabled, last_login, created_at
        FROM users 
        WHERE id = ? AND role = 2
      `, [supervisorId]);

      if (supervisor.length === 0) {
        return null;
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
      `, [supervisorId]);

      return {
        supervisor: supervisor[0],
        vendedores: vendedores
      };
    } catch (error) {
      console.error('Error al obtener detalles del supervisor:', error);
      throw error;
    }
  }

  // Obtener estadísticas generales para el dashboard de Back Office
  static async getEstadisticasGenerales({ periodType = 'month', year, month, date } = {}) {
    try {
      const now = new Date();
      const y = parseInt(year || now.getFullYear(), 10);
      const m = month ? parseInt(month, 10) : (now.getMonth() + 1);

      // Calcular rangos de fecha según el tipo de periodo
      let inicioPeriodo, finPeriodo;
      if ((periodType || '').toLowerCase() === 'year' || (periodType || '').toLowerCase() === 'anio') {
        inicioPeriodo = `${y}-01-01`;
        finPeriodo = `${y}-12-31`;
      } else if ((periodType || '').toLowerCase() === 'day' || (periodType || '').toLowerCase() === 'dia') {
        const d = date || new Date().toISOString().slice(0,10);
        inicioPeriodo = d;
        finPeriodo = d;
      } else {
        // month por defecto
        const startMonth = `${y}-${String(m).padStart(2, '0')}-01`;
        // último día del mes
        const lastDay = new Date(y, m, 0).getDate();
        const endMonth = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        inicioPeriodo = startMonth;
        finPeriodo = endMonth;
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
        inicioPeriodo, finPeriodo, // total_prospectos
        inicioPeriodo, finPeriodo, // ventas_mes
        inicioPeriodo, finPeriodo, // cotizaciones_mes
        inicioPeriodo, finPeriodo, // polizas_mes
        inicioPeriodo, finPeriodo, // pagos_exitosos_mes
        inicioPeriodo, finPeriodo, // ticket_promedio_mes
        inicioPeriodo, finPeriodo  // ingresos_mes
      ]);

      // Estadísticas por supervisor del periodo seleccionado
      const [statsPorSupervisor] = await db.query(`
        SELECT 
          s.id as supervisor_id,
          s.first_name,
          s.last_name,
          s.email,
          COUNT(DISTINCT v.id) as vendedores_count,
          COUNT(DISTINCT CASE WHEN DATE(a.fecha_asignacion) BETWEEN ? AND ? THEN a.id_prospecto END) as prospectos_total,
          COUNT(DISTINCT CASE WHEN a.estado = 'Venta' AND DATE(a.fecha_estado) BETWEEN ? AND ? THEN a.id_prospecto END) as ventas_count,
          COUNT(DISTINCT CASE WHEN DATE(c.fecha) BETWEEN ? AND ? THEN c.id END) as cotizaciones_count,
          COUNT(DISTINCT CASE WHEN DATE(pol.created_at) BETWEEN ? AND ? THEN pol.id END) as polizas_count,
          COUNT(DISTINCT CASE WHEN pol.estado = 'cerrada' AND DATE(pol.fecha_cambio_estado) BETWEEN ? AND ? THEN pol.id END) as polizas_cerradas_count,
          ROUND(
            COUNT(DISTINCT CASE WHEN a.estado = 'Venta' AND DATE(a.fecha_estado) BETWEEN ? AND ? THEN a.id_prospecto END) * 100.0 / 
            NULLIF(COUNT(DISTINCT CASE WHEN DATE(a.fecha_asignacion) BETWEEN ? AND ? THEN a.id_prospecto END), 0),
            2
          ) as conversion_rate,
          ROUND(AVG(CASE WHEN pol.estado = 'cerrada' AND DATE(pol.fecha_cambio_estado) BETWEEN ? AND ? THEN c.total_final END), 2) as ticket_promedio,
          SUM(CASE WHEN pol.estado = 'cerrada' AND DATE(pol.fecha_cambio_estado) BETWEEN ? AND ? THEN c.total_final ELSE 0 END) as ingresos_generados,
          COUNT(DISTINCT CASE WHEN a.estado IN ('Fuera de zona', 'Fuera de edad', 'No le interesa (económico)', 'No le interesa cartilla', 'No contesta', 'Teléfono erróneo', 'No busca cobertura médica') AND DATE(a.fecha_estado) BETWEEN ? AND ? THEN a.id_prospecto END) as rechazos_count,
          ROUND(AVG(CASE WHEN a.estado = 'Venta' AND DATE(a.fecha_estado) BETWEEN ? AND ? THEN DATEDIFF(a.fecha_estado, p.fecha_registro) END), 1) as dias_promedio_conversion
        FROM users s
        LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        LEFT JOIN cotizaciones c ON c.prospecto_id = p.id
        LEFT JOIN polizas pol ON pol.cotizacion_id = c.id
        WHERE s.role = 2
        GROUP BY s.id, s.first_name, s.last_name, s.email
        ORDER BY ingresos_generados DESC, ventas_count DESC
      `, [
        inicioPeriodo, finPeriodo, // prospectos_total
        inicioPeriodo, finPeriodo, // ventas_count
        inicioPeriodo, finPeriodo, // cotizaciones_count
        inicioPeriodo, finPeriodo, // polizas_count
        inicioPeriodo, finPeriodo, // polizas_cerradas_count
        inicioPeriodo, finPeriodo, // conversion_rate numerator
        inicioPeriodo, finPeriodo, // conversion_rate denominator
        inicioPeriodo, finPeriodo, // ticket_promedio
        inicioPeriodo, finPeriodo, // ingresos_generados
        inicioPeriodo, finPeriodo, // rechazos_count
        inicioPeriodo, finPeriodo  // dias_promedio_conversion
      ]);

      // Históricos según granularidad solicitada
      let labels = [];
      let prospectos_historico = [];
      let ventas_historico = [];
      let polizas_historico = [];
      let hist_granularity = 'year';

      if ((periodType || '').toLowerCase() === 'year' || (periodType || '').toLowerCase() === 'anio') {
        // Meses del año seleccionado
        const [prospectosPorMes] = await db.query(`
          SELECT MONTH(fecha_registro) as idx, COUNT(*) as total
          FROM prospectos
          WHERE DATE(fecha_registro) BETWEEN ? AND ?
          GROUP BY MONTH(fecha_registro)
          ORDER BY idx
        `, [ `${y}-01-01`, `${y}-12-31` ]);

        const [ventasPorMes] = await db.query(`
          SELECT MONTH(a.fecha_estado) as idx, COUNT(DISTINCT a.id_prospecto) as total
          FROM asignaciones a
          WHERE a.estado = 'Venta' AND DATE(a.fecha_estado) BETWEEN ? AND ?
          GROUP BY MONTH(a.fecha_estado)
          ORDER BY idx
        `, [ `${y}-01-01`, `${y}-12-31` ]);

        const [polizasPorMes] = await db.query(`
          SELECT MONTH(created_at) as idx, COUNT(*) as total
          FROM polizas
          WHERE DATE(created_at) BETWEEN ? AND ?
          GROUP BY MONTH(created_at)
          ORDER BY idx
        `, [ `${y}-01-01`, `${y}-12-31` ]);

        const mesesArray = Array.from({ length: 12 }, (_, i) => i + 1);
        const mapToArray = (rows) => {
          const map = new Map(rows.map(r => [r.idx, Number(r.total) || 0]));
          return mesesArray.map(mo => map.get(mo) || 0);
        };
        prospectos_historico = mapToArray(prospectosPorMes);
        ventas_historico = mapToArray(ventasPorMes);
        polizas_historico = mapToArray(polizasPorMes);
        labels = mesesArray.map(i => new Date(y, i - 1, 1).toLocaleString('es', { month: 'short' }));
        hist_granularity = 'year';
      } else if ((periodType || '').toLowerCase() === 'day' || (periodType || '').toLowerCase() === 'dia') {
        // Horas del día seleccionado (00..23)
        const d = inicioPeriodo; // YYYY-MM-DD
        const [prospectosPorHora] = await db.query(`
          SELECT HOUR(fecha_registro) as idx, COUNT(*) as total
          FROM prospectos
          WHERE DATE(fecha_registro) = ?
          GROUP BY HOUR(fecha_registro)
          ORDER BY idx
        `, [ d ]);

        const [ventasPorHora] = await db.query(`
          SELECT HOUR(a.fecha_estado) as idx, COUNT(DISTINCT a.id_prospecto) as total
          FROM asignaciones a
          WHERE a.estado = 'Venta' AND DATE(a.fecha_estado) = ?
          GROUP BY HOUR(a.fecha_estado)
          ORDER BY idx
        `, [ d ]);

        const [polizasPorHora] = await db.query(`
          SELECT HOUR(created_at) as idx, COUNT(*) as total
          FROM polizas
          WHERE DATE(created_at) = ?
          GROUP BY HOUR(created_at)
          ORDER BY idx
        `, [ d ]);

        const horasArray = Array.from({ length: 24 }, (_, i) => i);
        const mapToArray = (rows) => {
          const map = new Map(rows.map(r => [Number(r.idx), Number(r.total) || 0]));
          return horasArray.map(h => map.get(h) || 0);
        };
        prospectos_historico = mapToArray(prospectosPorHora);
        ventas_historico = mapToArray(ventasPorHora);
        polizas_historico = mapToArray(polizasPorHora);
        labels = horasArray.map(h => String(h).padStart(2, '0'));
        hist_granularity = 'day';
      } else {
        // Días del mes seleccionado (series diarias)
        const [prospectosPorDia] = await db.query(`
          SELECT DAY(fecha_registro) as idx, COUNT(*) as total
          FROM prospectos
          WHERE DATE(fecha_registro) BETWEEN ? AND ?
          GROUP BY DAY(fecha_registro)
          ORDER BY idx
        `, [ inicioPeriodo, finPeriodo ]);

        const [ventasPorDia] = await db.query(`
          SELECT DAY(a.fecha_estado) as idx, COUNT(DISTINCT a.id_prospecto) as total
          FROM asignaciones a
          WHERE a.estado = 'Venta' AND DATE(a.fecha_estado) BETWEEN ? AND ?
          GROUP BY DAY(a.fecha_estado)
          ORDER BY idx
        `, [ inicioPeriodo, finPeriodo ]);

        const [polizasPorDia] = await db.query(`
          SELECT DAY(created_at) as idx, COUNT(*) as total
          FROM polizas
          WHERE DATE(created_at) BETWEEN ? AND ?
          GROUP BY DAY(created_at)
          ORDER BY idx
        `, [ inicioPeriodo, finPeriodo ]);

        const diasMes = new Date(y, m, 0).getDate();
        const diasArray = Array.from({ length: diasMes }, (_, i) => i + 1);
        const mapToArray = (rows) => {
          const map = new Map(rows.map(r => [r.idx, Number(r.total) || 0]));
          return diasArray.map(d => map.get(d) || 0);
        };
        prospectos_historico = mapToArray(prospectosPorDia);
        ventas_historico = mapToArray(ventasPorDia);
        polizas_historico = mapToArray(polizasPorDia);
        labels = diasArray.map(String);

        // También: matriz día-hora para heatmap/scatter (X=día, Y=hora 0..23)
        const [prosDiaHora] = await db.query(`
          SELECT DAY(fecha_registro) as d, HOUR(fecha_registro) as h, COUNT(*) as total
          FROM prospectos
          WHERE DATE(fecha_registro) BETWEEN ? AND ?
          GROUP BY d, h
          ORDER BY d, h
        `, [ inicioPeriodo, finPeriodo ]);

        const [ventDiaHora] = await db.query(`
          SELECT DAY(a.fecha_estado) as d, HOUR(a.fecha_estado) as h, COUNT(DISTINCT a.id_prospecto) as total
          FROM asignaciones a
          WHERE a.estado = 'Venta' AND DATE(a.fecha_estado) BETWEEN ? AND ?
          GROUP BY d, h
          ORDER BY d, h
        `, [ inicioPeriodo, finPeriodo ]);

        const [polDiaHora] = await db.query(`
          SELECT DAY(created_at) as d, HOUR(created_at) as h, COUNT(*) as total
          FROM polizas
          WHERE DATE(created_at) BETWEEN ? AND ?
          GROUP BY d, h
          ORDER BY d, h
        `, [ inicioPeriodo, finPeriodo ]);

        const labelsX = diasArray.map(String);
        const labelsY = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
        const toPoints = (rows) => rows.map(r => ({ x: Number(r.d), y: Number(r.h), v: Number(r.total) || 0 }));

        const prospectos_heatmap = toPoints(prosDiaHora);
        const ventas_heatmap = toPoints(ventDiaHora);
        const polizas_heatmap = toPoints(polDiaHora);

        hist_granularity = 'month-hour';

        return {
          generales: stats[0],
          porSupervisor: statsPorSupervisor,
          prospectos_historico,
          ventas_historico,
          polizas_historico,
          labels,
          hist_granularity,
          labelsX,
          labelsY,
          prospectos_heatmap,
          ventas_heatmap,
          polizas_heatmap,
          periodo: { tipo: (periodType || '').toLowerCase(), year: y, month: m }
        };
      }

      return {
        generales: stats[0],
        porSupervisor: statsPorSupervisor,
        prospectos_historico,
        ventas_historico,
        polizas_historico,
        labels,
        hist_granularity,
        periodo: { tipo: (periodType || '').toLowerCase(), year: y, month: m }
      };
    } catch (error) {
      console.error('Error al obtener estadísticas generales:', error);
      throw error;
    }
  }

  // Obtener análisis de embudo de ventas
  static async getAnalisisEmbudo() {
    try {
      const [embudo] = await db.query(`
        SELECT 
          estado,
          COUNT(*) as cantidad,
          ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM asignaciones WHERE fecha_asignacion >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)), 2) as porcentaje
        FROM asignaciones
        WHERE fecha_asignacion >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY estado
        ORDER BY 
          CASE estado
            WHEN 'Lead' THEN 1
            WHEN '1º Contacto' THEN 2
            WHEN 'Calificado Cotización' THEN 3
            WHEN 'Calificado Póliza' THEN 4
            WHEN 'Calificado Pago' THEN 5
            WHEN 'Venta' THEN 6
            ELSE 7
          END
      `);

      return embudo;
    } catch (error) {
      console.error('Error al obtener análisis de embudo:', error);
      throw error;
    }
  }

  // Obtener rendimiento detallado de vendedores
  static async getRendimientoVendedores(supervisorId = null, dias = 30) {
    try {
      const whereClause = supervisorId ? 'AND v.supervisor_id = ?' : '';
      const params = supervisorId ? [dias, supervisorId] : [dias];
      
      const [vendedores] = await db.query(`
        SELECT 
          v.id as vendedor_id,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre,
          v.email as vendedor_email,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre,
          COUNT(DISTINCT a.id_prospecto) as total_prospectos,
          COUNT(DISTINCT CASE WHEN a.estado = 'Venta' THEN a.id_prospecto END) as total_ventas,
          COUNT(DISTINCT c.id) as total_cotizaciones,
          COUNT(DISTINCT pol.id) as total_polizas,
          COUNT(DISTINCT CASE WHEN pol.estado = 'cerrada' THEN pol.id END) as total_polizas_cerradas,
          ROUND(
            (COUNT(DISTINCT CASE WHEN a.estado = 'Venta' THEN a.id_prospecto END) * 100.0) / 
            NULLIF(COUNT(DISTINCT a.id_prospecto), 0), 2
          ) as tasa_conversion,
          ROUND(AVG(CASE WHEN pol.estado = 'cerrada' THEN c.total_final END), 2) as ticket_promedio,
          SUM(CASE WHEN pol.estado = 'cerrada' AND DATE(pol.fecha_cambio_estado) >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN c.total_final ELSE 0 END) as ingresos_generados,
          COUNT(DISTINCT DATE(a.fecha_asignacion)) as dias_activos,
          ROUND(COUNT(DISTINCT a.id_prospecto) / NULLIF(COUNT(DISTINCT DATE(a.fecha_asignacion)), 0), 2) as prospectos_por_dia,
          v.last_login,
          DATEDIFF(NOW(), v.last_login) as dias_sin_login,
          COUNT(DISTINCT CASE WHEN a.estado IN ('Fuera de zona', 'Fuera de edad', 'No le interesa (económico)', 'No le interesa cartilla', 'No contesta', 'No busca cobertura médica') THEN a.id_prospecto END) as rechazos,
          ROUND(AVG(CASE WHEN a.estado = 'Venta' THEN DATEDIFF(a.fecha_estado, p.fecha_registro) END), 1) as dias_promedio_venta
        FROM users v
        LEFT JOIN users s ON s.id = v.supervisor_id
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id AND a.fecha_asignacion >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        LEFT JOIN cotizaciones c ON c.prospecto_id = p.id
        LEFT JOIN polizas pol ON pol.cotizacion_id = c.id
        WHERE v.role = 1 ${whereClause}
        GROUP BY v.id, v.first_name, v.last_name, v.email, s.first_name, s.last_name, v.last_login
        ORDER BY ingresos_generados DESC, total_ventas DESC
      `, supervisorId ? [dias, dias, supervisorId] : [dias, dias]);
      
      return vendedores;
    } catch (error) {
      console.error('Error al obtener rendimiento de vendedores:', error);
      throw error;
    }
  }

  // Obtener tendencias temporales
  static async getTendenciasTemporales(dias = 30) {
    try {
      const [tendencias] = await db.query(`
        SELECT 
          DATE(a.fecha_asignacion) as fecha,
          COUNT(DISTINCT a.id_prospecto) as nuevos_prospectos,
          COUNT(DISTINCT CASE WHEN a.estado = 'Venta' THEN a.id_prospecto END) as ventas_cerradas,
          COUNT(DISTINCT c.id) as cotizaciones_realizadas,
          COUNT(DISTINCT pol.id) as polizas_creadas,
          COUNT(DISTINCT CASE WHEN pol.estado = 'cerrada' THEN pol.id END) as polizas_cerradas_dia,
          COUNT(DISTINCT CASE WHEN a.estado IN ('Fuera de zona', 'Fuera de edad', 'No le interesa (económico)', 'No le interesa cartilla', 'No contesta', 'No busca cobertura médica') THEN a.id_prospecto END) as rechazos,
          ROUND(SUM(CASE WHEN pol.estado = 'cerrada' AND DATE(pol.fecha_cambio_estado) = DATE(a.fecha_asignacion) THEN c.total_final ELSE 0 END), 2) as ingresos_dia
        FROM asignaciones a
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        LEFT JOIN cotizaciones c ON c.prospecto_id = p.id
        LEFT JOIN polizas pol ON pol.cotizacion_id = c.id
        WHERE a.fecha_asignacion >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(a.fecha_asignacion)
        ORDER BY fecha DESC
      `, [dias]);
      
      return tendencias;
    } catch (error) {
      console.error('Error al obtener tendencias temporales:', error);
      throw error;
    }
  }

  // Obtener alertas y notificaciones para Back Office
  static async getAlertas() {
    try {
      const alertas = [];

      // Vendedores sin actividad reciente
      const [vendedoresSinActividad] = await db.query(`
        SELECT CONCAT(first_name, ' ', last_name) as nombre, email, DATEDIFF(NOW(), last_login) as dias_sin_login
        FROM users 
        WHERE role = 1 AND last_login < DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY dias_sin_login DESC
        LIMIT 5
      `);

      if (vendedoresSinActividad.length > 0) {
        alertas.push({
          tipo: 'vendedores_inactivos',
          mensaje: `${vendedoresSinActividad.length} vendedores sin actividad en 7+ días`,
          prioridad: 'alta',
          datos: vendedoresSinActividad
        });
      }

      // Supervisores con baja tasa de conversión
      const [supervisoresBajaConversion] = await db.query(`
        SELECT 
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre,
          ROUND(COUNT(DISTINCT CASE WHEN a.estado = 'Venta' THEN a.id_prospecto END) * 100.0 / NULLIF(COUNT(DISTINCT a.id_prospecto), 0), 2) as tasa_conversion
        FROM users s
        LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id AND a.fecha_asignacion >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        WHERE s.role = 2
        GROUP BY s.id, s.first_name, s.last_name
        HAVING COUNT(DISTINCT a.id_prospecto) > 10 AND tasa_conversion < 10
        ORDER BY tasa_conversion ASC
      `);

      if (supervisoresBajaConversion.length > 0) {
        alertas.push({
          tipo: 'baja_conversion',
          mensaje: `${supervisoresBajaConversion.length} supervisores con tasa de conversión < 10%`,
          prioridad: 'media',
          datos: supervisoresBajaConversion
        });
      }

      // Prospectos estancados en cotización
      const [prospectosEstancados] = await db.query(`
        SELECT COUNT(*) as cantidad
        FROM prospectos p
        JOIN cotizaciones c ON c.prospecto_id = p.id
        WHERE p.estado = 'Calificado Cotización' 
        AND c.fecha < DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);

      if (prospectosEstancados[0].cantidad > 0) {
        alertas.push({
          tipo: 'prospectos_estancados',
          mensaje: `${prospectosEstancados[0].cantidad} prospectos estancados en cotización por 7+ días`,
          prioridad: 'media',
          datos: prospectosEstancados[0]
        });
      }

      return alertas;
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      throw error;
    }
  }

  // Asignar vendedor a supervisor
  // Asignar vendedor a supervisor (o quitar supervisor si supervisorId es null)
  static async asignarVendedorASupervisor(vendedorId, supervisorId) {
    try {
      const [result] = await db.query(`
        UPDATE users 
        SET supervisor_id = ?, updated_at = NOW()
        WHERE id = ? AND role = 1
      `, [supervisorId, vendedorId]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error al asignar/quitar vendedor de supervisor:', error);
      throw error;
    }
  }

  // Obtener vendedores sin supervisor asignado
  static async getVendedoresSinSupervisor() {
    try {
      const [vendedores] = await db.query(`
        SELECT 
          id, first_name, last_name, email, categoria_id, is_enabled, last_login
        FROM users 
        WHERE role = 1 AND supervisor_id IS NULL
        ORDER BY first_name, last_name
      `);

      return vendedores;
    } catch (error) {
      console.error('Error al obtener vendedores sin supervisor:', error);
      throw error;
    }
  }

  // Obtener todos los vendedores con información completa
  static async getVendedores() {
    try {
      const [vendedores] = await db.query(`
        SELECT 
          v.id,
          v.first_name,
          v.last_name,
          v.email,
          v.phone_number,
          v.is_enabled,
          v.last_login,
          v.created_at,
          v.supervisor_id,
          v.categoria_id,
          s.first_name as supervisor_first_name,
          s.last_name as supervisor_last_name,
          c.nombre as categoria_nombre,
          c.prioridad as categoria_prioridad,
          c.capacidad_maxima,
          COUNT(a.id_prospecto) as total_prospectos,
          ROUND((COUNT(a.id_prospecto) * 100.0) / NULLIF(c.capacidad_maxima, 0), 2) as porcentaje_carga,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as conversiones
        FROM users v
        LEFT JOIN users s ON v.supervisor_id = s.id AND s.role = 2
        LEFT JOIN categorias_config c ON v.categoria_id = c.id
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        WHERE v.role = 1
        GROUP BY v.id, v.first_name, v.last_name, v.email, v.phone_number, v.is_enabled, v.last_login, 
                 v.created_at, v.supervisor_id, v.categoria_id, s.first_name, s.last_name, 
                 c.nombre, c.prioridad, c.capacidad_maxima
        ORDER BY v.first_name, v.last_name
      `);

      return vendedores;
    } catch (error) {
      console.error('Error al obtener vendedores:', error);
      throw error;
    }
  }

  // Obtener detalles completos de un vendedor
  static async getDetallesVendedor(vendedorId) {
    try {
      const [vendedor] = await db.query(`
        SELECT 
          v.id,
          v.first_name,
          v.last_name,
          v.email,
          v.phone_number,
          v.is_enabled,
          v.last_login,
          v.created_at,
          v.supervisor_id,
          v.categoria_id,
          s.first_name as supervisor_first_name,
          s.last_name as supervisor_last_name,
          c.nombre as categoria_nombre,
          c.prioridad as categoria_prioridad,
          c.capacidad_maxima,
          COUNT(a.id_prospecto) as total_prospectos,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as conversiones,
          COUNT(CASE WHEN p.estado IN ('Lead', '1º Contacto', 'Calificado Cotización', 'Calificado Póliza', 'Calificado Pago') THEN 1 END) as prospectos_activos
        FROM users v
        LEFT JOIN users s ON v.supervisor_id = s.id AND s.role = 2
        LEFT JOIN categorias_config c ON v.categoria_id = c.id
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        WHERE v.id = ? AND v.role = 1
        GROUP BY v.id, v.first_name, v.last_name, v.email, v.phone_number, v.is_enabled, v.last_login, 
                 v.created_at, v.supervisor_id, v.categoria_id, s.first_name, s.last_name, 
                 c.nombre, c.prioridad, c.capacidad_maxima
      `, [vendedorId]);

      return vendedor.length > 0 ? vendedor[0] : null;
    } catch (error) {
      console.error('Error al obtener detalles del vendedor:', error);
      throw error;
    }
  }

  // Obtener métricas específicas de un vendedor
  static async getMetricasVendedor(vendedorId) {
    try {
      const [metricas] = await db.query(`
        SELECT 
          COUNT(DISTINCT a.id_prospecto) as total_prospectos,
          COUNT(DISTINCT CASE WHEN p.estado = 'Venta' THEN a.id_prospecto END) as total_ventas,
          COUNT(DISTINCT CASE WHEN p.estado IN ('Lead', '1º Contacto') THEN a.id_prospecto END) as prospectos_nuevos,
          COUNT(DISTINCT CASE WHEN p.estado IN ('Calificado Cotización', 'Calificado Póliza', 'Calificado Pago') THEN a.id_prospecto END) as prospectos_en_proceso,
          COUNT(DISTINCT CASE WHEN p.estado IN ('Fuera de zona', 'Fuera de edad', 'No le interesa (económico)', 'No le interesa cartilla', 'No contesta', 'Teléfono erróneo', 'No busca cobertura médica') THEN a.id_prospecto END) as rechazos,
          ROUND(COUNT(DISTINCT CASE WHEN p.estado = 'Venta' THEN a.id_prospecto END) * 100.0 / NULLIF(COUNT(DISTINCT a.id_prospecto), 0), 2) as tasa_conversion,
          COUNT(DISTINCT c.id) as cotizaciones_realizadas,
          COUNT(DISTINCT pol.id) as polizas_creadas,
          SUM(CASE WHEN pol.estado = 'cerrada' THEN cot.total_final ELSE 0 END) as ingresos_generados,
          ROUND(AVG(CASE WHEN pol.estado = 'cerrada' THEN cot.total_final END), 2) as ticket_promedio
        FROM asignaciones a
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        LEFT JOIN cotizaciones c ON c.prospecto_id = p.id
        LEFT JOIN cotizaciones cot ON cot.prospecto_id = p.id
        LEFT JOIN polizas pol ON pol.cotizacion_id = cot.id
        WHERE a.id_vendedor = ?
      `, [vendedorId]);

      return metricas[0];
    } catch (error) {
      console.error('Error al obtener métricas del vendedor:', error);
      throw error;
    }
  }

  // Obtener prospectos asignados a un vendedor
  static async getProspectosVendedor(vendedorId) {
    try {
      const [prospectos] = await db.query(`
        SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.numero_contacto,
          p.correo,
          p.origen,
          a.estado,
          a.comentario,
          a.fecha_asignacion,
          a.fecha_estado
        FROM prospectos p
        JOIN asignaciones a ON a.id_prospecto = p.id
        WHERE a.id_vendedor = ?
        AND a.id = (
          SELECT id 
          FROM asignaciones a2 
          WHERE a2.id_prospecto = p.id 
          ORDER BY a2.fecha_asignacion DESC 
          LIMIT 1
        )
        ORDER BY a.fecha_asignacion DESC
      `, [vendedorId]);

      return prospectos;
    } catch (error) {
      console.error('Error al obtener prospectos del vendedor:', error);
      throw error;
    }
  }

  // Habilitar/deshabilitar vendedor
  static async toggleVendedorStatus(vendedorId) {
    try {
      // Primero obtener el estado actual
      const [vendedor] = await db.query(`
        SELECT is_enabled FROM users WHERE id = ? AND role = 1
      `, [vendedorId]);

      if (vendedor.length === 0) {
        return null;
      }

      const newStatus = !vendedor[0].is_enabled;

      // Actualizar el estado
      const [result] = await db.query(`
        UPDATE users 
        SET is_enabled = ?, updated_at = NOW()
        WHERE id = ? AND role = 1
      `, [newStatus, vendedorId]);

      if (result.affectedRows > 0) {
        return { is_enabled: newStatus };
      }

      return null;
    } catch (error) {
      console.error('Error al cambiar estado del vendedor:', error);
      throw error;
    }
  }

  // Eliminar vendedor
  static async eliminarVendedor(vendedorId) {
    try {
      const [result] = await db.query(`
        DELETE FROM users WHERE id = ? AND role = 1
      `, [vendedorId]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error al eliminar vendedor:', error);
      throw error;
    }
  }

  // Reasignar prospectos de un vendedor a otro
  static async reasignarProspectos(prospectoIds, nuevoVendedorId, vendedorAnteriorId, realizadoPorId = null) {
    try {
      let prospectosReasignados = 0;
      
      // Procesar cada prospecto individualmente para manejar casos complejos
      for (const prospectoId of prospectoIds) {
        // 1. Buscar la asignación activa más reciente para este prospecto
        const [asignacionActual] = await db.query(`
          SELECT id, id_vendedor 
          FROM asignaciones 
          WHERE id_prospecto = ? 
          ORDER BY fecha_asignacion DESC 
          LIMIT 1
        `, [prospectoId]);

        if (asignacionActual.length > 0) {
          const asignacionId = asignacionActual[0].id;
          const vendedorActual = asignacionActual[0].id_vendedor;

          // 2. Actualizar la asignación existente con el nuevo vendedor (NO crear duplicado)
          // visible_refrito = 1: si el prospecto es un refrito (es_reciclado=1), garantiza que
          // la reasignación lo haga visible de inmediato en el dashboard del nuevo vendedor
          // (ver filtro en prospectoModel.js findAll).
          await db.query(`
            UPDATE asignaciones
            SET id_vendedor = ?,
                asignado_por = ?,
                fecha_asignacion = NOW(),
                comentario = CONCAT(COALESCE(comentario, ''), '\nReasignado desde BackOffice el ', NOW()),
                visible_refrito = 1
            WHERE id = ?
          `, [nuevoVendedorId, vendedorAnteriorId, asignacionId]);

          // Registrar en auditoría con el usuario que realizó la acción
          await db.query(`
            INSERT INTO reasignacion_auditoria 
            (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, realizado_por_id, motivo, razon_automatica)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [prospectoId, vendedorActual, nuevoVendedorId, realizadoPorId, 'Reasignado desde BackOffice', 'Manual']);

          prospectosReasignados++;
          
          console.log(`✅ Prospecto ${prospectoId} reasignado de vendedor ${vendedorActual} a vendedor ${nuevoVendedorId}`);
        } else {
          console.warn(`⚠️ No se encontró asignación para prospecto ${prospectoId}`);
        }
      }

      return {
        prospectos_reasignados: prospectosReasignados,
        nuevo_vendedor_id: nuevoVendedorId,
        vendedor_anterior_id: vendedorAnteriorId
      };
    } catch (error) {
      console.error('Error al reasignar prospectos:', error);
      throw error;
    }
  }

  // Habilitar/deshabilitar supervisor
  static async toggleSupervisorStatus(supervisorId) {
    try {
      // Primero obtener el estado actual
      const [supervisor] = await db.query(`
        SELECT is_enabled FROM users WHERE id = ? AND role = 2
      `, [supervisorId]);

      if (supervisor.length === 0) {
        return null;
      }

      const newStatus = !supervisor[0].is_enabled;

      // Actualizar el estado
      const [result] = await db.query(`
        UPDATE users 
        SET is_enabled = ?, updated_at = NOW()
        WHERE id = ? AND role = 2
      `, [newStatus, supervisorId]);

      if (result.affectedRows > 0) {
        return { is_enabled: newStatus };
      }

      return null;
    } catch (error) {
      console.error('Error al cambiar estado del supervisor:', error);
      throw error;
    }
  }

  // Obtener métricas de rendimiento por período
  static async getMetricasRendimiento(fechaInicio, fechaFin) {
    try {
      const [metricas] = await db.query(`
        SELECT 
          s.id as supervisor_id,
          s.first_name as supervisor_nombre,
          s.last_name as supervisor_apellido,
          COUNT(DISTINCT v.id) as vendedores_activos,
          COUNT(p.id) as prospectos_total,
          COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) as ventas_realizadas,
          COUNT(CASE WHEN p.estado IN ('Lead', '1º Contacto') THEN 1 END) as prospectos_nuevos,
          COUNT(CASE WHEN p.estado IN ('Calificado Cotización', 'Calificado Póliza', 'Calificado Pago') THEN 1 END) as prospectos_en_proceso,
          ROUND(COUNT(CASE WHEN p.estado = 'Venta' THEN 1 END) * 100.0 / NULLIF(COUNT(p.id), 0), 2) as tasa_conversion,
          AVG(DATEDIFF(
            CASE WHEN p.estado = 'Venta' THEN p.fecha_registro ELSE NULL END,
            p.fecha_registro
          )) as tiempo_promedio_venta
        FROM users s
        LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        LEFT JOIN prospectos p ON p.id = a.id_prospecto 
          AND p.fecha_registro BETWEEN ? AND ?
        WHERE s.role = 2
        GROUP BY s.id, s.first_name, s.last_name
        ORDER BY ventas_realizadas DESC
      `, [fechaInicio, fechaFin]);

      return metricas;
    } catch (error) {
      console.error('Error al obtener métricas de rendimiento:', error);
      throw error;
    }
  }
}

module.exports = BackOfficeModel;
