const db = require('../../config/db');

class ChatbotVendedorModel {
  // Crear nueva conversación de vendedor
  static async crearConversacion(vendedorId, titulo = 'Nueva consulta') {
    try {
      const [result] = await db.query(
        'INSERT INTO chatbot_vendedor_conversaciones (vendedor_id, titulo, creado_en) VALUES (?, ?, NOW())',
        [vendedorId, titulo]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error al crear conversación de vendedor:', error);
      throw error;
    }
  }

  // Obtener conversaciones de un vendedor
  static async obtenerConversaciones(vendedorId, limite = 10) {
    try {
      const [conversaciones] = await db.query(
        `SELECT id, titulo, estado, creado_en, actualizado_en,
                (SELECT COUNT(*) FROM chatbot_vendedor_mensajes WHERE conversacion_id = c.id) as total_mensajes
         FROM chatbot_vendedor_conversaciones c
         WHERE vendedor_id = ?
         ORDER BY actualizado_en DESC
         LIMIT ?`,
        [vendedorId, limite]
      );
      return conversaciones;
    } catch (error) {
      console.error('Error al obtener conversaciones de vendedor:', error);
      throw error;
    }
  }

  // Guardar mensaje
  static async guardarMensaje(conversacionId, rol, contenido, tipoConsulta = null, datosConsulta = null) {
    try {
      const [result] = await db.query(
        `INSERT INTO chatbot_vendedor_mensajes 
         (conversacion_id, rol, contenido, tipo_consulta, datos_consulta, creado_en) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [conversacionId, rol, contenido, tipoConsulta, datosConsulta ? JSON.stringify(datosConsulta) : null]
      );
      
      // Actualizar timestamp de conversación
      await db.query(
        'UPDATE chatbot_vendedor_conversaciones SET actualizado_en = NOW() WHERE id = ?',
        [conversacionId]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error al guardar mensaje de vendedor:', error);
      throw error;
    }
  }

  // Obtener historial de conversación
  static async obtenerHistorial(conversacionId) {
    try {
      const [mensajes] = await db.query(
        `SELECT id, rol, contenido, tipo_consulta, datos_consulta, creado_en 
         FROM chatbot_vendedor_mensajes 
         WHERE conversacion_id = ? 
         ORDER BY creado_en ASC`,
        [conversacionId]
      );
      return mensajes.map(m => ({
        ...m,
        datos_consulta: m.datos_consulta ? JSON.parse(m.datos_consulta) : null
      }));
    } catch (error) {
      console.error('Error al obtener historial de vendedor:', error);
      throw error;
    }
  }

  // ===============================================
  // MÉTODOS DE CONSULTA DE DATOS
  // ===============================================

  // Obtener precios por edad y plan
  static async obtenerPrecios(edad, anio = null, planId = null) {
    try {
      const anioActual = anio || new Date().getFullYear();
      
      let query = `
        SELECT 
          lp.id,
          lp.precio,
          lp.anio,
          p.nombre as plan_nombre,
          ce.edad_min,
          ce.edad_max,
          tf.nombre as tipo_familia
        FROM listas_precios lp
        JOIN planes p ON lp.plan_id = p.id
        JOIN categorias_edad ce ON lp.categoria_id = ce.id
        LEFT JOIN tipo_familia tf ON lp.tipo_familia_id = tf.id
        WHERE ce.edad_min <= ? AND ce.edad_max >= ? AND lp.anio = ?
      `;
      
      const params = [edad, edad, anioActual];
      
      if (planId) {
        query += ' AND lp.plan_id = ?';
        params.push(planId);
      }
      
      query += ' ORDER BY p.nombre, lp.precio';
      
      const [precios] = await db.query(query, params);
      return precios;
    } catch (error) {
      console.error('Error al obtener precios:', error);
      throw error;
    }
  }

  // Obtener todos los planes
  static async obtenerPlanes() {
    try {
      const [planes] = await db.query(
        'SELECT id, nombre, descripcion FROM planes ORDER BY nombre'
      );
      return planes;
    } catch (error) {
      console.error('Error al obtener planes:', error);
      throw error;
    }
  }

  // Obtener promociones activas
  static async obtenerPromociones() {
    try {
      const [promociones] = await db.query(
        `SELECT id, nombre, descripcion, descuento_porcentaje, fecha_inicio, fecha_fin, activa
         FROM promociones 
         WHERE activa = 1 AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
         ORDER BY descuento_porcentaje DESC`
      );
      return promociones;
    } catch (error) {
      console.error('Error al obtener promociones:', error);
      throw error;
    }
  }

  // Obtener prestadores por zona y plan
  static async obtenerPrestadores(planId = null, localidad = null) {
    try {
      let query = `
        SELECT DISTINCT
          pr.id,
          pr.nombre,
          pr.especialidad,
          pr.telefono,
          pr.email,
          pr.direccion,
          pr.localidad,
          pr.provincia,
          pr.tipo_prestador,
          pr.estado,
          COUNT(pp.plan_id) as planes_disponibles
        FROM prestadores pr
        LEFT JOIN planes_prestadores pp ON pr.id = pp.prestador_id AND pp.activo = 1
        WHERE pr.estado = 1
      `;
      
      const params = [];
      
      if (planId) {
        query += ' AND pp.plan_id = ?';
        params.push(planId);
      }
      
      if (localidad) {
        query += ' AND pr.localidad LIKE ?';
        params.push(`%${localidad}%`);
      }
      
      query += ' GROUP BY pr.id ORDER BY pr.localidad, pr.nombre';
      
      const [prestadores] = await db.query(query, params);
      return prestadores;
    } catch (error) {
      console.error('Error al obtener prestadores:', error);
      throw error;
    }
  }

  // Obtener prestadores por plan específico
  static async obtenerPrestadoresPorPlan(planId) {
    try {
      const [prestadores] = await db.query(
        `SELECT 
          pr.id,
          pr.nombre,
          pr.localidad,
          pr.provincia,
          pr.telefono,
          pr.tipo_prestador,
          pp.tipo_cobertura,
          pp.porcentaje_cobertura,
          pp.copago
         FROM prestadores pr
         JOIN planes_prestadores pp ON pr.id = pp.prestador_id
         WHERE pp.plan_id = ? AND pp.activo = 1 AND pr.estado = 1
         ORDER BY pr.localidad, pr.nombre`,
        [planId]
      );
      return prestadores;
    } catch (error) {
      console.error('Error al obtener prestadores por plan:', error);
      throw error;
    }
  }

  // Comparar precios entre planes
  static async compararPlanes(edad, anio = null) {
    try {
      const anioActual = anio || new Date().getFullYear();
      
      const [comparacion] = await db.query(
        `SELECT 
          p.id as plan_id,
          p.nombre as plan_nombre,
          p.descripcion,
          lp.precio,
          ce.edad_min,
          ce.edad_max,
          COUNT(DISTINCT pp.prestador_id) as total_prestadores
         FROM planes p
         JOIN listas_precios lp ON p.id = lp.plan_id
         JOIN categorias_edad ce ON lp.categoria_id = ce.id
         LEFT JOIN planes_prestadores pp ON p.id = pp.plan_id AND pp.activo = 1
         WHERE ce.edad_min <= ? AND ce.edad_max >= ? AND lp.anio = ?
         GROUP BY p.id, lp.precio
         ORDER BY lp.precio ASC`,
        [edad, edad, anioActual]
      );
      
      return comparacion;
    } catch (error) {
      console.error('Error al comparar planes:', error);
      throw error;
    }
  }

  // Buscar prestadores por especialidad
  static async buscarPorEspecialidad(especialidad) {
    try {
      const [prestadores] = await db.query(
        `SELECT pr.*, COUNT(pp.plan_id) as planes_disponibles
         FROM prestadores pr
         LEFT JOIN planes_prestadores pp ON pr.id = pp.prestador_id AND pp.activo = 1
         WHERE pr.estado = 1 AND pr.especialidad LIKE ?
         GROUP BY pr.id
         ORDER BY pr.nombre`,
        [`%${especialidad}%`]
      );
      return prestadores;
    } catch (error) {
      console.error('Error al buscar por especialidad:', error);
      throw error;
    }
  }

  // Finalizar conversación
  static async finalizarConversacion(conversacionId) {
    try {
      await db.query(
        'UPDATE chatbot_vendedor_conversaciones SET estado = "finalizada", actualizado_en = NOW() WHERE id = ?',
        [conversacionId]
      );
    } catch (error) {
      console.error('Error al finalizar conversación:', error);
      throw error;
    }
  }
}

module.exports = ChatbotVendedorModel;