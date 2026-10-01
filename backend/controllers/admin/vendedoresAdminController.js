const db = require('../../config/db');
const NotificationsService = require('../../services/notificationsService');
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');

class VendedoresAdminController {
  
  // Obtener todos los vendedores con información completa
  static async getVendedores(req, res) {
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
          COUNT(CASE WHEN a.estado = 'Venta' THEN 1 END) as conversiones
        FROM users v
        LEFT JOIN users s ON v.supervisor_id = s.id AND s.role = 2
        LEFT JOIN categorias_config c ON v.categoria_id = c.id
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        WHERE v.role = 1
        GROUP BY v.id, v.first_name, v.last_name, v.email, v.phone_number, v.is_enabled, v.last_login, 
                 v.created_at, v.supervisor_id, v.categoria_id, s.first_name, s.last_name, 
                 c.nombre, c.prioridad, c.capacidad_maxima
        ORDER BY v.first_name, v.last_name
      `);

      console.log(`✅ [ADMIN] ${vendedores.length} vendedores obtenidos`);

      res.json({
        success: true,
        data: vendedores
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener vendedores:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener vendedores',
        error: error.message
      });
    }
  }

  // Obtener detalles de un vendedor específico
  static async getDetallesVendedor(req, res) {
    try {
      const { id } = req.params;

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
          ROUND((COUNT(a.id_prospecto) * 100.0) / NULLIF(c.capacidad_maxima, 0), 2) as porcentaje_carga,
          COUNT(CASE WHEN a.estado = 'Venta' THEN 1 END) as conversiones
        FROM users v
        LEFT JOIN users s ON v.supervisor_id = s.id AND s.role = 2
        LEFT JOIN categorias_config c ON v.categoria_id = c.id
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        WHERE v.id = ? AND v.role = 1
        GROUP BY v.id, v.first_name, v.last_name, v.email, v.phone_number, v.is_enabled, v.last_login, 
                 v.created_at, v.supervisor_id, v.categoria_id, s.first_name, s.last_name, 
                 c.nombre, c.prioridad, c.capacidad_maxima
      `, [id]);

      if (vendedor.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vendedor no encontrado'
        });
      }

      console.log(`✅ [ADMIN] Detalles del vendedor ${id} obtenidos`);

      res.json({
        success: true,
        data: vendedor[0]
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener detalles del vendedor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles del vendedor',
        error: error.message
      });
    }
  }

  // Obtener métricas de un vendedor
  static async getMetricasVendedor(req, res) {
    try {
      const { id } = req.params;

      const [metricas] = await db.query(`
        SELECT 
          COUNT(DISTINCT a.id_prospecto) as total_prospectos,
          COUNT(DISTINCT CASE WHEN a.estado = 'Venta' THEN a.id_prospecto END) as ventas_realizadas,
          COUNT(DISTINCT CASE WHEN a.estado IN ('Lead', '1º Contacto', 'Calificado Cotización', 'Calificado Póliza', 'Calificado Pago') THEN a.id_prospecto END) as prospectos_activos,
          COUNT(DISTINCT c.id) as cotizaciones_generadas,
          COUNT(DISTINCT pol.id) as polizas_creadas,
          COALESCE(SUM(CASE WHEN pol.estado = 'cerrada' THEN c.total_final ELSE 0 END), 0) as ingresos_generados
        FROM users v
        LEFT JOIN asignaciones a ON a.id_vendedor = v.id
        LEFT JOIN cotizaciones c ON c.prospecto_id = a.id_prospecto
        LEFT JOIN polizas pol ON pol.created_by = v.id AND pol.deleted_at IS NULL
        WHERE v.id = ? AND v.role = 1
      `, [id]);

      console.log(`✅ [ADMIN] Métricas del vendedor ${id} obtenidas`);

      res.json({
        success: true,
        data: metricas[0]
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener métricas del vendedor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener métricas del vendedor',
        error: error.message
      });
    }
  }

  // Obtener prospectos de un vendedor
  static async getProspectosVendedor(req, res) {
    try {
      const { id } = req.params;

      const [prospectos] = await db.query(`
        SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.numero_contacto,
          p.correo,
          p.edad,
          p.localidad,
          p.fecha_registro,
          a.estado,
          a.fecha_asignacion,
          a.fecha_estado,
          a.comentario
        FROM asignaciones a
        INNER JOIN prospectos p ON p.id = a.id_prospecto
        WHERE a.id_vendedor = ?
        ORDER BY a.fecha_asignacion DESC
      `, [id]);

      console.log(`✅ [ADMIN] ${prospectos.length} prospectos del vendedor ${id} obtenidos`);

      res.json({
        success: true,
        data: prospectos
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al obtener prospectos del vendedor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener prospectos del vendedor',
        error: error.message
      });
    }
  }

  // Habilitar/Deshabilitar vendedor
  static async toggleVendedorStatus(req, res) {
    try {
      const { id } = req.params;

      // Obtener estado actual
      const [vendedor] = await db.query(
        'SELECT is_enabled, first_name, last_name FROM users WHERE id = ? AND role = 1',
        [id]
      );

      if (vendedor.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vendedor no encontrado'
        });
      }

      const nuevoEstado = vendedor[0].is_enabled === 1 ? 0 : 1;

      await db.query(
        'UPDATE users SET is_enabled = ? WHERE id = ?',
        [nuevoEstado, id]
      );

      console.log(`✅ [ADMIN] Vendedor ${id} ${nuevoEstado === 1 ? 'habilitado' : 'deshabilitado'}`);

      res.json({
        success: true,
        message: `Vendedor ${nuevoEstado === 1 ? 'habilitado' : 'deshabilitado'} correctamente`,
        data: { is_enabled: nuevoEstado }
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al cambiar estado del vendedor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cambiar estado del vendedor',
        error: error.message
      });
    }
  }

  // Eliminar vendedor
  static async eliminarVendedor(req, res) {
    try {
      const { id } = req.params;

      // Verificar que el vendedor existe
      const [vendedor] = await db.query(
        'SELECT id FROM users WHERE id = ? AND role = 1',
        [id]
      );

      if (vendedor.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vendedor no encontrado'
        });
      }

      // Eliminar vendedor (las asignaciones se manejan por CASCADE)
      await db.query('DELETE FROM users WHERE id = ?', [id]);

      console.log(`✅ [ADMIN] Vendedor ${id} eliminado`);

      res.json({
        success: true,
        message: 'Vendedor eliminado correctamente'
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al eliminar vendedor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar vendedor',
        error: error.message
      });
    }
  }

  // Reasignar prospectos de un vendedor a otro
  static async reasignarProspectos(req, res) {
    try {
      // Aceptar tanto el payload esperado como el actual del frontend
      const vendedorOrigenId = req.body.vendedorOrigenId || req.body.vendedor_anterior_id;
      const vendedorDestinoId = req.body.vendedorDestinoId || req.body.nuevo_vendedor_id;
      const prospectoIds = req.body.prospectoIds || req.body.prospectos;

      if (!vendedorOrigenId || !vendedorDestinoId || !prospectoIds || prospectoIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Datos incompletos para reasignación'
        });
      }

      // Verificar que ambos vendedores existen
      const [vendedores] = await db.query(
        'SELECT id FROM users WHERE id IN (?, ?) AND role = 1',
        [vendedorOrigenId, vendedorDestinoId]
      );

      if (vendedores.length !== 2) {
        return res.status(404).json({
          success: false,
          message: 'Uno o ambos vendedores no encontrados'
        });
      }

      // Obtener info de las asignaciones a mover para aplicar reglas de refritos
      const placeholders = prospectoIds.map(() => '?').join(',');
      const [asignacionesAMover] = await db.query(
        `SELECT a.id, a.id_prospecto, a.id_vendedor, a.estado, a.visible_refrito, a.fecha_asignacion, p.es_reciclado
         FROM asignaciones a
         INNER JOIN prospectos p ON p.id = a.id_prospecto
         WHERE a.id_vendedor = ? AND a.id_prospecto IN (${placeholders})`,
        [vendedorOrigenId, ...prospectoIds]
      );

      if (asignacionesAMover.length === 0) {
        return res.status(404).json({ success: false, message: 'No se encontraron asignaciones para mover' });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // 1) Mover todas las asignaciones (cualquier tipo)
        await connection.query(
          `UPDATE asignaciones 
           SET id_vendedor = ? 
           WHERE id_prospecto IN (${placeholders}) AND id_vendedor = ?`,
          [vendedorDestinoId, ...prospectoIds, vendedorOrigenId]
        );

        // 2) Aplicar reglas solo a reciclados en Lead
        const idsRecicladosLead = asignacionesAMover
          .filter(a => a.es_reciclado === 1 && a.estado === 'Lead')
          .map(a => a.id_prospecto);

        // ¿El vendedor origen pierde un visible?
        const origenPerdioVisible = asignacionesAMover.some(a => a.es_reciclado === 1 && a.estado === 'Lead' && a.visible_refrito === 1);

        if (idsRecicladosLead.length > 0) {
          const placeholdersRL = idsRecicladosLead.map(() => '?').join(',');

          // 2.a) Poner en cola todas las movidas al destino (por defecto)
          await connection.query(
            `UPDATE asignaciones a
             INNER JOIN prospectos p ON p.id = a.id_prospecto AND p.es_reciclado = 1
             SET a.visible_refrito = 0
             WHERE a.id_vendedor = ? AND a.estado = 'Lead' AND a.id_prospecto IN (${placeholdersRL})`,
            [vendedorDestinoId, ...idsRecicladosLead]
          );

          // 2.b) Si el destino NO tiene visible actual, promover UNA de las recién movidas
          const [destTieneVisibleRows] = await connection.query(
            `SELECT COUNT(*) AS total FROM asignaciones a
             INNER JOIN prospectos p ON p.id = a.id_prospecto AND p.es_reciclado = 1
             WHERE a.id_vendedor = ? AND a.estado = 'Lead' AND a.visible_refrito = 1`,
            [vendedorDestinoId]
          );
          const destTieneVisible = (destTieneVisibleRows[0]?.total || 0) > 0;

          if (!destTieneVisible) {
            // Elegir la más antigua por fecha_asignacion entre las recién movidas
            const [unaParaPromover] = await connection.query(
              `SELECT a.id
               FROM asignaciones a
               INNER JOIN prospectos p ON p.id = a.id_prospecto AND p.es_reciclado = 1
               WHERE a.id_vendedor = ? AND a.estado = 'Lead' AND a.id_prospecto IN (${placeholdersRL})
               ORDER BY a.fecha_asignacion ASC
               LIMIT 1`,
              [vendedorDestinoId, ...idsRecicladosLead]
            );
            if (unaParaPromover.length > 0) {
              await connection.query(`UPDATE asignaciones SET visible_refrito = 1 WHERE id = ?`, [unaParaPromover[0].id]);
            }
          }
        }

        await connection.commit();

        // 3) Si el origen perdió su visible, promover siguiente en su cola
        if (origenPerdioVisible) {
          try {
            await RefritosVisibilityService.promoverSiguienteRefrito(vendedorOrigenId);
          } catch (px) {
            console.warn('⚠️  No se pudo promover siguiente refrito tras reasignación admin:', px.message);
          }
        }
      } catch (txErr) {
        await connection.rollback();
        connection.release();
        throw txErr;
      }
      // Liberar conexión si no hubo errores
      // Nota: si no entró al try de transacción, no hay connection
      if (typeof connection !== 'undefined') connection.release();

      // Enviar notificación al nuevo vendedor
      try {
        await NotificationsService.enviarNotificacion(
          vendedorDestinoId,
          'prospectos_reasignados',
          'Nuevos prospectos asignados',
          `Se te han asignado ${prospectoIds.length} prospecto(s)`,
          { cantidad: prospectoIds.length }
        );
      } catch (notifError) {
        console.error('Error enviando notificación:', notifError);
      }

      console.log(`✅ [ADMIN] ${prospectoIds.length} prospectos reasignados de ${vendedorOrigenId} a ${vendedorDestinoId}`);

      res.json({
        success: true,
        message: `${prospectoIds.length} prospecto(s) reasignado(s) correctamente`
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al reasignar prospectos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al reasignar prospectos',
        error: error.message
      });
    }
  }

  // Asignar categoría a vendedor
  static async asignarCategoria(req, res) {
    try {
      const { vendedorId, categoriaId } = req.body;

      if (!vendedorId || !categoriaId) {
        return res.status(400).json({
          success: false,
          message: 'Datos incompletos'
        });
      }

      await db.query(
        'UPDATE users SET categoria_id = ? WHERE id = ? AND role = 1',
        [categoriaId, vendedorId]
      );

      console.log(`✅ [ADMIN] Categoría ${categoriaId} asignada al vendedor ${vendedorId}`);

      res.json({
        success: true,
        message: 'Categoría asignada correctamente'
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al asignar categoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error al asignar categoría',
        error: error.message
      });
    }
  }

  // Asignar supervisor a vendedor
  static async asignarSupervisor(req, res) {
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

      console.log(`✅ [ADMIN] Supervisor ${supervisorId || 'ninguno'} asignado al vendedor ${vendedorId}`);

      res.json({
        success: true,
        message: supervisorId ? 'Supervisor asignado correctamente' : 'Supervisor removido correctamente'
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error al asignar supervisor:', error);
      res.status(500).json({
        success: false,
        message: 'Error al asignar supervisor',
        error: error.message
      });
    }
  }

  // Obtener métricas generales de vendedores
  static async getMetricasGenerales(req, res) {
    try {
      const [metricasVendedores] = await db.query(`
        SELECT 
          COUNT(*) as totalVendedores,
          COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as vendedoresActivos,
          COUNT(CASE WHEN supervisor_id IS NULL THEN 1 END) as vendedoresSinSupervisor,
          COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as vendedoresActivosSemana
        FROM users
        WHERE role = 1
      `);

      const [metricasSupervisores] = await db.query(`
        SELECT 
          COUNT(CASE WHEN is_enabled = 1 THEN 1 END) as supervisioresActivos
        FROM users
        WHERE role = 2
      `);

      console.log('✅ [ADMIN] Métricas generales de vendedores obtenidas');

      res.json({
        success: true,
        data: {
          ...metricasVendedores[0],
          supervisioresActivos: metricasSupervisores[0].supervisioresActivos
        }
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

module.exports = VendedoresAdminController;
