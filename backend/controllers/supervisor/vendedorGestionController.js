const db = require('../../config/db');

// Obtener prospectos de un vendedor específico (solo si está asignado al supervisor)
const getProspectosVendedor = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
    
    console.log('📋 Supervisor obteniendo prospectos del vendedor:', { supervisor_id, vendedorId });
    
    // ✅ FILTRO JERÁRQUICO: Solo prospectos de vendedores asignados al supervisor
    const query = `
      SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.numero_contacto,
        p.correo,
        p.estado,
        p.origen,
        a.estado AS asignacion_estado,
        a.comentario AS asignacion_comentario,
        a.fecha_asignacion
      FROM prospectos p
      INNER JOIN asignaciones a ON p.id = a.id_prospecto
      INNER JOIN users v ON a.id_vendedor = v.id AND v.supervisor_id = ?
      WHERE a.id_vendedor = ?
      ORDER BY a.fecha_asignacion DESC
    `;
    
    const [prospectos] = await db.execute(query, [supervisor_id, vendedorId]);
    
    res.json(prospectos);
  } catch (error) {
    console.error('Error al obtener prospectos del vendedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener prospectos del vendedor',
      error: error.message 
    });
  }
};

// Deshabilitar vendedor (solo si está asignado al supervisor)
const disableVendedor = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const supervisorId = req.user.id;
    
    console.log('❌ Supervisor deshabilitando vendedor:', { supervisorId, vendedorId });
    
    // ✅ FILTRO JERÁRQUICO: Verificar que el vendedor está asignado al supervisor
    const [vendedor] = await db.execute(
      'SELECT id, first_name, last_name FROM users WHERE id = ? AND role = 1 AND supervisor_id = ?',
      [vendedorId, supervisorId]
    );
    
    if (vendedor.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendedor no encontrado o no asignado a este supervisor' 
      });
    }
    
    // Deshabilitar vendedor
    await db.execute(
      'UPDATE users SET is_enabled = 0, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [supervisorId, vendedorId]
    );
    
    res.json({ 
      success: true, 
      message: `Vendedor ${vendedor[0].first_name} ${vendedor[0].last_name} deshabilitado correctamente` 
    });
  } catch (error) {
    console.error('Error al deshabilitar vendedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al deshabilitar vendedor',
      error: error.message 
    });
  }
};

// Eliminar vendedor
const deleteVendedor = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { vendedorId } = req.params;
    const supervisorId = req.user.id;
    
    await connection.beginTransaction();
    
    // ✅ FILTRO JERÁRQUICO: Verificar que el vendedor está asignado al supervisor
    const [vendedor] = await connection.execute(
      'SELECT id, first_name, last_name FROM users WHERE id = ? AND role = 1 AND supervisor_id = ?',
      [vendedorId, supervisorId]
    );
    
    if (vendedor.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Vendedor no encontrado o no asignado a este supervisor' 
      });
    }
    
    // Verificar que no tenga prospectos asignados
    const [prospectos] = await connection.execute(
      'SELECT COUNT(*) as count FROM asignaciones WHERE id_vendedor = ?',
      [vendedorId]
    );
    
    if (prospectos[0].count > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar el vendedor porque tiene prospectos asignados. Reasigne los prospectos primero.' 
      });
    }
    
    // Eliminar vendedor
    await connection.execute(
      'DELETE FROM users WHERE id = ?',
      [vendedorId]
    );
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      message: `Vendedor ${vendedor[0].first_name} ${vendedor[0].last_name} eliminado correctamente` 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar vendedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar vendedor',
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

// Reasignar prospectos
const reasignarProspectos = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { prospectos, nuevo_vendedor_id, vendedor_anterior_id } = req.body;
    const supervisorId = req.user.id;
    
    if (!prospectos || prospectos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe especificar al menos un prospecto para reasignar' 
      });
    }
    
    if (!nuevo_vendedor_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe especificar el nuevo vendedor' 
      });
    }
    
    await connection.beginTransaction();
    
    // ✅ FILTRO JERÁRQUICO: Verificar que el nuevo vendedor está asignado al supervisor
    const [nuevoVendedor] = await connection.execute(
      'SELECT id, first_name, last_name FROM users WHERE id = ? AND role = 1 AND is_enabled = 1 AND supervisor_id = ?',
      [nuevo_vendedor_id, supervisorId]
    );
    
    if (nuevoVendedor.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'El nuevo vendedor no existe, no está habilitado, o no está asignado a este supervisor' 
      });
    }
    
    // Reasignar cada prospecto
    for (const prospectoId of prospectos) {
      // Primero verificar si existe una asignación activa para este prospecto
      const [asignacionExistente] = await connection.execute(
        'SELECT id, id_vendedor FROM asignaciones WHERE id_prospecto = ? ORDER BY fecha_asignacion DESC LIMIT 1',
        [prospectoId]
      );
      
      if (asignacionExistente.length > 0) {
        const vendedorAnteriorId = asignacionExistente[0].id_vendedor;

        // Actualizar la asignación existente
        // visible_refrito = 1 y estado = 'Lead': si el prospecto es un refrito (es_reciclado=1),
        // garantiza que la reasignación lo haga visible de inmediato en el dashboard del nuevo
        // vendedor (ver filtro en prospectoModel.js findAll).
        await connection.execute(
          `UPDATE asignaciones
           SET id_vendedor = ?, asignado_por = ?, fecha_asignacion = NOW(), estado = 'Lead', visible_refrito = 1
           WHERE id = ?`,
          [nuevo_vendedor_id, supervisorId, asignacionExistente[0].id]
        );
        
        // Agregar comentario de reasignación
        await connection.execute(
          `INSERT INTO asignacion_comentarios (id_asignacion, comentario, autor_id, fecha) 
           VALUES (?, CONCAT('Prospecto reasignado desde vendedor ID ', ?, ' a ', ?, ' ', ?, ' por supervisor'), ?, NOW())`,
          [
            asignacionExistente[0].id,
            vendedorAnteriorId, 
            nuevoVendedor[0].first_name, 
            nuevoVendedor[0].last_name,
            supervisorId
          ]
        );

        // Registrar en auditoría con el supervisor que realizó la acción
        await connection.execute(
          `INSERT INTO reasignacion_auditoria 
           (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, realizado_por_id, motivo, razon_automatica)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [prospectoId, vendedorAnteriorId, nuevo_vendedor_id, supervisorId, 'Reasignado desde Supervisor', 'Manual']
        );
      } else {
        // Si no existe asignación, crear una nueva
        const [nuevaAsignacion] = await connection.execute(
          `INSERT INTO asignaciones (id_prospecto, id_vendedor, asignado_por, estado, fecha_asignacion, visible_refrito)
           VALUES (?, ?, ?, 'Lead', NOW(), 1)`,
          [prospectoId, nuevo_vendedor_id, supervisorId]
        );
        
        // Agregar comentario de nueva asignación
        await connection.execute(
          `INSERT INTO asignacion_comentarios (id_asignacion, comentario, autor_id, fecha) 
           VALUES (?, CONCAT('Prospecto asignado a ', ?, ' ', ?, ' por supervisor'), ?, NOW())`,
          [
            nuevaAsignacion.insertId,
            nuevoVendedor[0].first_name, 
            nuevoVendedor[0].last_name,
            supervisorId
          ]
        );
      }
    }
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      message: `${prospectos.length} prospectos reasignados correctamente a ${nuevoVendedor[0].first_name} ${nuevoVendedor[0].last_name}`,
      reasignados: prospectos.length
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al reasignar prospectos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al reasignar prospectos',
      error: error.message 
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getProspectosVendedor,
  disableVendedor,
  deleteVendedor,
  reasignarProspectos
};
