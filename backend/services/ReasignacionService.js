const ReAsignacionAutomatica = require('../models/ReAsignacionAutomatica');

class ReasignacionService {
  // Inicializar tabla de auditoría
  static async inicializarTablas() {
    try {
      await ReAsignacionAutomatica.crearTablaAuditoria();
      console.log('✅ Tabla de auditoría de reasignaciones creada/verificada');
    } catch (error) {
      console.error('Error al crear tabla de auditoría:', error);
      throw error;
    }
  }

  // Obtener prospectos candidatos a reasignación
  static async obtenerCandidatos() {
    try {
      const candidatos = await ReAsignacionAutomatica.obtenerProspectosSinActividad();
      return {
        success: true,
        total: candidatos.length,
        candidatos
      };
    } catch (error) {
      console.error('Error obteniendo candidatos:', error);
      throw error;
    }
  }

  // Obtener vendedores disponibles
  static async obtenerVendedoresDisponibles(excluirId = null) {
    try {
      const vendedor = await ReAsignacionAutomatica.obtenerVendedorDisponible(excluirId);
      return {
        success: true,
        vendedor: vendedor || null
      };
    } catch (error) {
      console.error('Error obteniendo vendedores disponibles:', error);
      throw error;
    }
  }

  // Reasignar prospecto manual
  static async reasignarManual(idProspecto, idVendedorNuevo, idVendedorAnterior, motivo) {
    try {
      const resultado = await ReAsignacionAutomatica.reasignarProspecto(
        idProspecto,
        idVendedorNuevo,
        idVendedorAnterior,
        motivo,
        'manual'
      );
      console.log(`📝 Reasignación manual ejecutada para prospecto ${idProspecto}`);
      return {
        success: true,
        resultado: resultado === true ? 'Reasignación completada correctamente' : resultado
      };
    } catch (error) {
      console.error('Error en reasignación manual:', error);
      throw error;
    }
  }

  // Obtener historial de reasignaciones
  static async obtenerHistorial(limite = 20) {
    try {
      const historial = await ReAsignacionAutomatica.obtenerReasignacionesRecientes(limite);
      return {
        success: true,
        total: historial.length,
        historial
      };
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  }

  // Obtener estadísticas
  static async obtenerEstadisticas(fechaInicio = null, fechaFin = null) {
    try {
      const estadisticas = await ReAsignacionAutomatica.obtenerEstadisticas(fechaInicio, fechaFin);
      return {
        success: true,
        estadisticas
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  // Obtener estadísticas de antigüedad de prospectos reasignados
  static async obtenerEstadisticasAntiguedad() {
    try {
      const db = require('../config/db');
      
      // 1. Resumen general
      const [resumenGeneral] = await db.query(`
        SELECT 
          MIN(p.fecha_hora_registro) as prospecto_mas_antiguo,
          MAX(p.fecha_hora_registro) as prospecto_mas_reciente,
          DATEDIFF(CURDATE(), MIN(p.fecha_hora_registro)) as dias_mas_antiguo,
          ROUND(AVG(DATEDIFF(CURDATE(), p.fecha_hora_registro)), 1) as promedio_dias_antiguedad,
          COUNT(*) as total_reasignaciones,
          COUNT(DISTINCT r.id_prospecto) as prospectos_unicos
        FROM reasignacion_auditoria r
        INNER JOIN prospectos p ON p.id = r.id_prospecto
      `);

      // 2. Distribución por antigüedad
      const [distribucionAntiguedad] = await db.query(`
        SELECT 
          CASE 
            WHEN DATEDIFF(CURDATE(), DATE(p.fecha_hora_registro)) <= 7 THEN 'Última semana'
            WHEN DATEDIFF(CURDATE(), DATE(p.fecha_hora_registro)) <= 15 THEN '8-15 días'
            WHEN DATEDIFF(CURDATE(), DATE(p.fecha_hora_registro)) <= 30 THEN '16-30 días'
            WHEN DATEDIFF(CURDATE(), DATE(p.fecha_hora_registro)) <= 60 THEN '31-60 días'
            ELSE 'Más de 60 días'
          END as rango_antiguedad,
          COUNT(*) as cantidad,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM reasignacion_auditoria), 2) as porcentaje
        FROM reasignacion_auditoria r
        INNER JOIN prospectos p ON p.id = r.id_prospecto
        GROUP BY rango_antiguedad
        ORDER BY 
          CASE 
            WHEN rango_antiguedad = 'Última semana' THEN 1
            WHEN rango_antiguedad = '8-15 días' THEN 2
            WHEN rango_antiguedad = '16-30 días' THEN 3
            WHEN rango_antiguedad = '31-60 días' THEN 4
            ELSE 5
          END
      `);

      // 3. Distribución mensual
      const [distribucionMensual] = await db.query(`
        SELECT 
          DATE_FORMAT(p.fecha_hora_registro, '%Y-%m') as mes,
          CASE DATE_FORMAT(p.fecha_hora_registro, '%m')
            WHEN '01' THEN CONCAT('Enero ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '02' THEN CONCAT('Febrero ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '03' THEN CONCAT('Marzo ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '04' THEN CONCAT('Abril ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '05' THEN CONCAT('Mayo ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '06' THEN CONCAT('Junio ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '07' THEN CONCAT('Julio ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '08' THEN CONCAT('Agosto ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '09' THEN CONCAT('Septiembre ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '10' THEN CONCAT('Octubre ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '11' THEN CONCAT('Noviembre ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
            WHEN '12' THEN CONCAT('Diciembre ', DATE_FORMAT(p.fecha_hora_registro, '%Y'))
          END as mes_nombre,
          COUNT(*) as cantidad
        FROM reasignacion_auditoria r
        INNER JOIN prospectos p ON p.id = r.id_prospecto
        GROUP BY mes, mes_nombre
        ORDER BY mes DESC
      `);

      // 4. Distribución por día (últimos 20 días)
      const [distribucionDiaria] = await db.query(`
        SELECT 
          DATE(p.fecha_hora_registro) as fecha,
          COUNT(*) as cantidad,
          MIN(p.fecha_hora_registro) as primer_registro,
          MAX(p.fecha_hora_registro) as ultimo_registro
        FROM reasignacion_auditoria r
        INNER JOIN prospectos p ON p.id = r.id_prospecto
        GROUP BY DATE(p.fecha_hora_registro)
        ORDER BY fecha DESC
        LIMIT 20
      `);

      // 5. Top vendedores que perdieron prospectos
      const [topPerdieron] = await db.query(`
        SELECT 
          CONCAT(u.first_name, ' ', u.last_name) as vendedor,
          COUNT(*) as cantidad_perdida
        FROM reasignacion_auditoria r
        LEFT JOIN users u ON u.id = r.id_vendedor_anterior
        GROUP BY r.id_vendedor_anterior, u.first_name, u.last_name
        ORDER BY cantidad_perdida DESC
        LIMIT 10
      `);

      // 6. Top vendedores que recibieron prospectos
      const [topRecibieron] = await db.query(`
        SELECT 
          CONCAT(u.first_name, ' ', u.last_name) as vendedor,
          COUNT(*) as cantidad_recibida
        FROM reasignacion_auditoria r
        LEFT JOIN users u ON u.id = r.id_vendedor_nuevo
        GROUP BY r.id_vendedor_nuevo, u.first_name, u.last_name
        ORDER BY cantidad_recibida DESC
        LIMIT 10
      `);

      return {
        success: true,
        resumen: resumenGeneral[0] || {},
        distribucion_antiguedad: distribucionAntiguedad || [],
        distribucion_mensual: distribucionMensual || [],
        distribucion_diaria: distribucionDiaria || [],
        top_perdieron: topPerdieron || [],
        top_recibieron: topRecibieron || []
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de antigüedad:', error);
      throw error;
    }
  }

  // Obtener estadísticas de efectividad de reasignaciones
  static async obtenerEstadisticasEfectividad() {
    try {
      const db = require('../config/db');
      
      // Estadísticas por hora de ejecución (hoy)
      const [efectividadPorHora] = await db.query(`
        SELECT 
          DATE_FORMAT(r.fecha_reasignacion, '%H:00') as hora_ejecucion,
          COUNT(DISTINCT r.id_prospecto) as total_reasignados,
          COUNT(DISTINCT CASE 
            WHEN ha.fecha > r.fecha_reasignacion 
            THEN r.id_prospecto 
          END) as con_actividad_posterior,
          COUNT(DISTINCT CASE 
            WHEN ha.fecha > r.fecha_reasignacion AND ha.accion IN ('Llamada', 'WhatsApp', 'Email')
            THEN r.id_prospecto 
          END) as contactados,
          COUNT(DISTINCT CASE 
            WHEN a.fecha_estado > r.fecha_reasignacion AND a.estado != 'Lead'
            THEN r.id_prospecto 
          END) as cambiaron_estado,
          ROUND(COUNT(DISTINCT CASE 
            WHEN ha.fecha > r.fecha_reasignacion 
            THEN r.id_prospecto 
          END) * 100.0 / NULLIF(COUNT(DISTINCT r.id_prospecto), 0), 1) as porcentaje_con_actividad,
          ROUND(COUNT(DISTINCT CASE 
            WHEN a.fecha_estado > r.fecha_reasignacion AND a.estado != 'Lead'
            THEN r.id_prospecto 
          END) * 100.0 / NULLIF(COUNT(DISTINCT r.id_prospecto), 0), 1) as porcentaje_cambio_estado,
          TIMESTAMPDIFF(HOUR, MIN(r.fecha_reasignacion), NOW()) as horas_transcurridas
        FROM reasignacion_auditoria r
        LEFT JOIN historial_acciones ha ON ha.id_prospecto = r.id_prospecto AND ha.id_vendedor = r.id_vendedor_nuevo
        LEFT JOIN asignaciones a ON a.id_prospecto = r.id_prospecto AND a.id_vendedor = r.id_vendedor_nuevo
        WHERE DATE(r.fecha_reasignacion) = CURDATE()
        GROUP BY DATE_FORMAT(r.fecha_reasignacion, '%H:00')
        ORDER BY hora_ejecucion DESC
      `);

      // Estadísticas generales de hoy
      const [resumenHoy] = await db.query(`
        SELECT 
          COUNT(DISTINCT r.id_prospecto) as total_reasignados_hoy,
          COUNT(DISTINCT CASE 
            WHEN ha.fecha > r.fecha_reasignacion 
            THEN r.id_prospecto 
          END) as con_actividad_hoy,
          COUNT(DISTINCT CASE 
            WHEN a.fecha_estado > r.fecha_reasignacion AND a.estado != 'Lead'
            THEN r.id_prospecto 
          END) as cambiaron_estado_hoy,
          ROUND(COUNT(DISTINCT CASE 
            WHEN ha.fecha > r.fecha_reasignacion 
            THEN r.id_prospecto 
          END) * 100.0 / NULLIF(COUNT(DISTINCT r.id_prospecto), 0), 1) as porcentaje_efectividad_hoy
        FROM reasignacion_auditoria r
        LEFT JOIN historial_acciones ha ON ha.id_prospecto = r.id_prospecto AND ha.id_vendedor = r.id_vendedor_nuevo
        LEFT JOIN asignaciones a ON a.id_prospecto = r.id_prospecto AND a.id_vendedor = r.id_vendedor_nuevo
        WHERE DATE(r.fecha_reasignacion) = CURDATE()
      `);

      return {
        success: true,
        efectividad_por_hora: efectividadPorHora || [],
        resumen_hoy: resumenHoy[0] || {}
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de efectividad:', error);
      throw error;
    }
  }
}

module.exports = ReasignacionService;
