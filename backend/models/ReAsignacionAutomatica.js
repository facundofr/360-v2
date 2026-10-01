const db = require('../config/db');

class ReAsignacionAutomatica {
  // Crear tabla de auditoría de reasignaciones
  static async crearTablaAuditoria() {
    const sql = `
      CREATE TABLE IF NOT EXISTS reasignacion_auditoria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_prospecto INT NOT NULL,
        id_vendedor_anterior INT,
        id_vendedor_nuevo INT NOT NULL,
        motivo VARCHAR(255),
        fecha_reasignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        razon_automatica VARCHAR(255),
        FOREIGN KEY (id_prospecto) REFERENCES prospectos(id),
        FOREIGN KEY (id_vendedor_anterior) REFERENCES users(id),
        FOREIGN KEY (id_vendedor_nuevo) REFERENCES users(id),
        INDEX idx_prospecto (id_prospecto),
        INDEX idx_fecha (fecha_reasignacion)
      )
    `;
    try {
      await db.query(sql);
      console.log('✅ Tabla reasignacion_auditoria verificada');
    } catch (error) {
      console.error('Error en crearTablaAuditoria:', error);
      throw error;
    }
  }

  // Obtener prospectos sin actividad en horario laboral (L-V 9-18hs)
  // ⚠️ IMPORTANTE: Excluye prospectos creados por vendedores (origen='Vendedor-App') y refritos (origen='Refrito - Campaña')
  // ⚠️ IMPORTANTE: Excluye vendedores conectados ahora mismo (last_activity reciente) para no
  // pisarle un guardado en curso — ver auditoría de logs 2026-08-20 (race con Prospecto.update).
  // ⚠️ IMPORTANTE: El conteo de "sin actividad" nunca arranca antes de las 09:00 de hoy. Si no fuera
  // así, el primer tick del cron dentro del horario laboral reasignaría el lead antes de que el
  // vendedor original tuviera oportunidad real de trabajarlo — ver reporte de vendedores 2026-08-27
  // (leads asignados fuera de horario que desaparecían apenas arrancaba el horario comercial).
  // Cubre las tres formas de quedar asignado fuera de horario: el día hábil anterior (noche, fin de
  // semana o feriado) y también la madrugada de HOY. Este último caso se escapaba cuando la
  // referencia se elegía con DATE(...) < CURDATE(): una asignación de las 02:00 es del mismo día,
  // así que contaba desde las 02:00 y al tick de las 09:00 ya acumulaba siete horas. El
  // ValidacionFallbackJob corre cada 15 minutos sin restricción horaria, así que produce
  // exactamente esas asignaciones de madrugada — 11% de las asignaciones caen entre 00:00 y 08:59.
  // ⚠️ IMPORTANTE: cuenta como actividad tanto historial_acciones como el último mensaje que el
  // vendedor mandó por el chat. chatService.enviarMensaje no escribe en historial_acciones, así
  // que un vendedor que trabaja el lead solo desde el chat no refrescaba el reloj. En la práctica
  // casi no pasa —al trabajar el lead su asignación deja el estado 'Lead' y sale de esta query—
  // pero el hueco existe para quien usa únicamente el chat. Sumar la señal solo puede atrasar una
  // reasignación, nunca provocarla.
  static async obtenerProspectosSinActividad() {
    const sql = `
      SELECT
        a.id as id_asignacion,
        a.id_prospecto,
        a.id_vendedor,
        a.fecha_asignacion,
        p.nombre,
        p.apellido,
        p.numero_contacto,
        p.estado,
        p.origen,
        TIMESTAMPDIFF(MINUTE, COALESCE(MAX(ha.fecha), a.fecha_asignacion), NOW()) as minutos_sin_actividad,
        TIMESTAMPDIFF(
          MINUTE,
          GREATEST(
            COALESCE(MAX(ha.fecha), a.fecha_asignacion),
            COALESCE((
              SELECT MAX(cm.created_at)
              FROM chat_conversaciones_whatsapp cc
              JOIN chat_mensajes cm ON cm.conversacion_id = cc.id
              WHERE cc.prospecto_id = a.id_prospecto
                AND cc.vendedor_id = a.id_vendedor
                AND cm.origen = 'vendedor'
            ), a.fecha_asignacion),
            TIMESTAMP(CURDATE(), '09:00:00')
          ),
          NOW()
        ) as minutos_habiles_sin_actividad
      FROM asignaciones a
      INNER JOIN prospectos p ON a.id_prospecto = p.id
      INNER JOIN users u ON u.id = a.id_vendedor
      LEFT JOIN historial_acciones ha ON a.id_prospecto = ha.id_prospecto AND ha.id_vendedor = a.id_vendedor
      WHERE
        a.estado = 'Lead'
        AND HOUR(NOW()) >= 9 AND HOUR(NOW()) <= 18
        AND DAYOFWEEK(NOW()) BETWEEN 2 AND 6
        AND p.origen NOT IN ('Vendedor-App', 'Refrito - Campaña')
        AND (
          u.is_logged_out = 1
          OR u.last_activity IS NULL
          OR u.last_activity < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        )
      GROUP BY a.id_prospecto, a.id_vendedor
      HAVING minutos_habiles_sin_actividad >= 60

      ORDER BY minutos_sin_actividad DESC
    `;

    try {
      const [results] = await db.query(sql);
      return results || [];
    } catch (error) {
      console.error('Error obteniendo prospectos sin actividad:', error);
      throw error;
    }
  }

  // Obtener vendedor disponible (menor carga de prospectos Lead)
  static async obtenerVendedorDisponible(excluirVendedorId = null) {
    let sql = `
      SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as nombre,
        COUNT(a.id_prospecto) as cantidad_leads
      FROM users u
      LEFT JOIN asignaciones a ON u.id = a.id_vendedor AND a.estado = 'Lead'
      WHERE 
        u.is_enabled = 1
        AND u.role = 1
    `;

    if (excluirVendedorId) {
      sql += ` AND u.id != ${db.escape(excluirVendedorId)}`;
    }

    sql += `
      GROUP BY u.id
      ORDER BY cantidad_leads ASC
      LIMIT 1
    `;

    try {
      const [results] = await db.query(sql);
      return results && results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Error obteniendo vendedor disponible:', error);
      throw error;
    }
  }

  // Reasignar prospecto a nuevo vendedor
  static async reasignarProspecto(idProspecto, idVendedorNuevo, idVendedorAnterior, motivo = null, origen = 'automatica') {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Actualizar asignación
      // visible_refrito = 1: si el prospecto es un refrito (es_reciclado=1), garantiza que la
      // reasignación lo haga visible de inmediato en el dashboard del nuevo vendedor (ver filtro
      // en prospectoModel.js findAll).
      await connection.query(
        'UPDATE asignaciones SET id_vendedor = ?, fecha_asignacion = NOW(), visible_refrito = 1 WHERE id_prospecto = ? AND id_vendedor = ?',
        [idVendedorNuevo, idProspecto, idVendedorAnterior]
      );

      // 2. Registrar en auditoría
      const razon = origen === 'automatica'
        ? 'Sin actividad en horario laboral (L-V 9-18hs, > 1 hora)'
        : (motivo ? `Manual: ${motivo}` : 'Manual');

      await connection.query(
        `INSERT INTO reasignacion_auditoria 
         (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, motivo, razon_automatica)
         VALUES (?, ?, ?, ?, ?)`,
        [idProspecto, idVendedorAnterior, idVendedorNuevo, motivo, razon]
      );

      // 3. Registrar acción en historial
      const descripcion = `${origen === 'automatica' ? 'Reasignado automáticamente' : 'Reasignado manualmente'} de vendedor ${idVendedorAnterior} a ${idVendedorNuevo}. ${motivo || (origen === 'automatica' ? 'Sin actividad' : '')}`;
      const accionHist = origen === 'automatica' ? 'Reasignación Automática' : 'Reasignación Manual';
      await connection.query(
        `INSERT INTO historial_acciones 
         (id_prospecto, id_vendedor, accion, descripcion, fecha)
         VALUES (?, ?, ?, ?, NOW())`,
        [idProspecto, idVendedorNuevo, accionHist, descripcion]
      );

      // 4. Reasignar conversaciones activas de WhatsApp a nuevo vendedor
      const [convs] = await connection.query(
        'SELECT id FROM chat_conversaciones_whatsapp WHERE prospecto_id = ? AND vendedor_id = ? AND estado = "activa"',
        [idProspecto, idVendedorAnterior]
      );

      if (convs && convs.length > 0) {
        // Actualizar conversaciones
        await connection.query(
          'UPDATE chat_conversaciones_whatsapp SET vendedor_id = ?, updated_at = NOW() WHERE prospecto_id = ? AND vendedor_id = ? AND estado = "activa"',
          [idVendedorNuevo, idProspecto, idVendedorAnterior]
        );

        // Registrar mensajes de sistema en cada conversación
        for (const conv of convs) {
          const msg = `Conversación transferida automáticamente del vendedor ${idVendedorAnterior} al ${idVendedorNuevo}.`;
          await connection.query(
            'INSERT INTO chat_mensajes (conversacion_id, mensaje, tipo, origen) VALUES (?, ?, "sistema", "sistema")',
            [conv.id, msg]
          );
        }
      }

      // 5. Actualizar chatbot_conversaciones (si existe)
      try {
        await connection.query(
          'UPDATE chatbot_conversaciones SET usuario_id = ? WHERE prospecto_id = ? AND usuario_id = ?',
          [idVendedorNuevo, idProspecto, idVendedorAnterior]
        );
      } catch (err) {
        // Tabla podría no existir, ignorar error
        console.log('Tabla chatbot_conversaciones no encontrada, continuando...');
      }

      await connection.commit();
      console.log(`✅ Prospecto ${idProspecto} reasignado exitosamente a vendedor ${idVendedorNuevo} (origen: ${origen})`);
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error en reasignarProspecto:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Obtener reasignaciones recientes
  static async obtenerReasignacionesRecientes(limite = 20) {
    const limitNum = Math.max(1, parseInt(limite, 10) || 20);
    const sql = `
      SELECT 
        ra.id,
        ra.id_prospecto,
        p.nombre,
        p.apellido,
        p.fecha_hora_registro as fecha_ingreso,
        CONCAT(u1.first_name, ' ', u1.last_name) as vendedor_anterior,
        CONCAT(u2.first_name, ' ', u2.last_name) as vendedor_nuevo,
        ra.motivo,
        ra.fecha_reasignacion,
        ra.razon_automatica,
        DATEDIFF(ra.fecha_reasignacion, p.fecha_hora_registro) as dias_desde_ingreso
      FROM reasignacion_auditoria ra
      INNER JOIN prospectos p ON ra.id_prospecto = p.id
      LEFT JOIN users u1 ON ra.id_vendedor_anterior = u1.id
      LEFT JOIN users u2 ON ra.id_vendedor_nuevo = u2.id
      ORDER BY ra.fecha_reasignacion DESC
      LIMIT ${limitNum}
    `;

    try {
      const [results] = await db.query(sql);
      return results || [];
    } catch (error) {
      console.error('Error obteniendo reasignaciones recientes:', error);
      throw error;
    }
  }

  // Estadísticas de reasignaciones
  static async obtenerEstadisticas(fecha_inicio = null, fecha_fin = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_reasignaciones,
        COUNT(DISTINCT id_prospecto) as prospectos_reasignados,
        COUNT(DISTINCT id_vendedor_nuevo) as vendedores_receptores,
        DATE(fecha_reasignacion) as fecha
      FROM reasignacion_auditoria
      WHERE 1=1
    `;

    const params = [];

    if (fecha_inicio) {
      sql += ` AND fecha_reasignacion >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += ` AND fecha_reasignacion <= ?`;
      params.push(fecha_fin);
    }

    sql += ` GROUP BY DATE(fecha_reasignacion) ORDER BY fecha DESC`;

    try {
      const [results] = await db.query(sql, params);
      return results || [];
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}

module.exports = ReAsignacionAutomatica;
