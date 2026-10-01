const db = require('../../config/db');

const BackOfficeChatController = {
  // ✅ Obtener conversaciones por prospecto (SIN RESTRICCIONES)
  async obtenerConversacionesPorProspecto(req, res) {
    try {
      const { prospecto_id } = req.params;

      console.log('💬 Back Office obteniendo conversaciones para prospecto:', prospecto_id);

      // ✅ SIN RESTRICCIONES: Obtener información del prospecto de cualquier vendedor
      const [prospecto] = await db.execute(
        `SELECT 
          p.id, 
          p.nombre, 
          p.apellido, 
          p.numero_contacto as telefono,
          p.correo,
          p.localidad,
          a.estado,
          a.id_vendedor,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre
         FROM prospectos p
         LEFT JOIN asignaciones a ON p.id = a.id_prospecto
         LEFT JOIN users v ON a.id_vendedor = v.id
         LEFT JOIN users s ON v.supervisor_id = s.id
         WHERE p.id = ?`,
        [prospecto_id]
      );

      if (prospecto.length === 0) {
        return res.status(404).json({
          error: 'Prospecto no encontrado',
          message: 'No se encontró información del prospecto'
        });
      }

      // ✅ SIN RESTRICCIONES: Obtener todas las conversaciones del prospecto
      const [conversaciones] = await db.execute(
        `SELECT 
          c.id,
          c.numero_conversacion,
          c.telefono as telefono_cliente,
          c.estado,
          c.tipo_origen,
          c.ultima_actividad,
          c.created_at as fecha_conversacion,
          c.poliza_id,
          c.vendedor_id,
          pol.numero_poliza,
          pol.numero_poliza_oficial,
          pol.estado as poliza_estado,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_asignado,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_asignado,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id) as total_mensajes,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id AND estado_entrega != 'leido' AND tipo = 'recibido') as mensajes_no_leidos
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN polizas pol ON c.poliza_id = pol.id
         LEFT JOIN users v ON c.vendedor_id = v.id
         LEFT JOIN users s ON v.supervisor_id = s.id
         WHERE c.prospecto_id = ?
         ORDER BY c.created_at DESC`,
        [prospecto_id]
      );

      // Obtener últimos mensajes de cada conversación
      const conversacionesConMensajes = await Promise.all(
        conversaciones.map(async (conv) => {
          const [ultimoMensaje] = await db.execute(
            `SELECT 
              mensaje as contenido,
              tipo,
              origen,
              created_at
             FROM chat_mensajes 
             WHERE conversacion_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          const [ultimoMensajeCliente] = await db.execute(
            `SELECT mensaje 
             FROM chat_mensajes 
             WHERE conversacion_id = ? AND tipo = 'recibido' 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          const [ultimoMensajeVendedor] = await db.execute(
            `SELECT mensaje 
             FROM chat_mensajes 
             WHERE conversacion_id = ? AND tipo = 'enviado' 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          return {
            ...conv,
            ultimo_mensaje: ultimoMensaje.length > 0 ? ultimoMensaje[0] : null,
            mensaje_cliente: ultimoMensajeCliente.length > 0 ? ultimoMensajeCliente[0].mensaje : null,
            respuesta_bot: ultimoMensajeVendedor.length > 0 ? ultimoMensajeVendedor[0].mensaje : null,
            notas: null
          };
        })
      );

      console.log(`✅ Back Office encontró ${conversacionesConMensajes.length} conversaciones`);

      res.json({
        success: true,
        data: {
          prospecto: prospecto[0],
          conversaciones: conversacionesConMensajes
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo conversaciones (Back Office):', error);
      res.status(500).json({
        error: 'Error obteniendo conversaciones',
        message: error.message
      });
    }
  },

  // ✅ Obtener mensajes de una conversación (SIN RESTRICCIONES)
  async obtenerMensajes(req, res) {
    try {
      const { conversacion_id } = req.params;
      const limite = parseInt(req.query.limite) || 50;
      const offset = parseInt(req.query.offset) || 0;

      console.log('💬 Back Office obteniendo mensajes de conversación:', conversacion_id);

      // ✅ SIN RESTRICCIONES: Obtener cualquier conversación del sistema
      const [conversacion] = await db.execute(
        `SELECT 
          c.id,
          c.numero_conversacion,
          c.telefono,
          c.estado,
          c.prospecto_id,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         LEFT JOIN users v ON c.vendedor_id = v.id
         LEFT JOIN users s ON v.supervisor_id = s.id
         WHERE c.id = ?`,
        [conversacion_id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      // Obtener mensajes de la conversación
      const [mensajes] = await db.execute(
        `SELECT 
          id,
          conversacion_id,
          mensaje as contenido,
          tipo,
          origen as tipo_contenido,
          metadata,
          twilio_message_sid as mensaje_whatsapp_id,
          created_at,
          estado_entrega as leido,
          estado_entrega as entregado
         FROM chat_mensajes 
         WHERE conversacion_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [conversacion_id, limite, offset]
      );

      console.log(`✅ Back Office encontró ${mensajes.length} mensajes`);

      res.json({
        success: true,
        data: {
          conversacion: conversacion[0],
          mensajes: mensajes.reverse()
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo mensajes (Back Office):', error);
      res.status(500).json({
        error: 'Error obteniendo mensajes',
        message: error.message
      });
    }
  },

  // ✅ Crear nueva conversación (SIN RESTRICCIONES)
  async crearConversacion(req, res) {
    try {
      const { prospecto_id, tipo_origen = 'manual', poliza_id = null, vendedor_id = null } = req.body;
      const backoffice_user_id = req.user.id;

      console.log('💬 Back Office creando conversación para prospecto:', prospecto_id);

      // ✅ SIN RESTRICCIONES: Obtener cualquier prospecto del sistema
      const [prospecto] = await db.execute(
        `SELECT 
          p.id, 
          p.nombre, 
          p.apellido, 
          p.numero_contacto,
          a.id_vendedor
         FROM prospectos p
         LEFT JOIN asignaciones a ON p.id = a.id_prospecto
         WHERE p.id = ?`,
        [prospecto_id]
      );

      if (prospecto.length === 0) {
        return res.status(404).json({
          error: 'Prospecto no encontrado'
        });
      }

      // Generar número de conversación único
      const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const [ultimaConversacion] = await db.execute(
        `SELECT numero_conversacion FROM chat_conversaciones_whatsapp 
         WHERE numero_conversacion LIKE 'CONV-${fechaHoy}-%' 
         ORDER BY id DESC LIMIT 1`
      );

      let numeroSecuencial = 1;
      if (ultimaConversacion.length > 0) {
        const ultimoNumero = ultimaConversacion[0].numero_conversacion;
        const secuencial = parseInt(ultimoNumero.split('-')[2]);
        numeroSecuencial = secuencial + 1;
      }

      const numeroConversacion = `CONV-${fechaHoy}-${numeroSecuencial.toString().padStart(4, '0')}`;

      // Determinar vendedor asignado
      const vendedorAsignado = vendedor_id || prospecto[0].id_vendedor || null;

      // Crear la conversación
      const [resultado] = await db.execute(
        `INSERT INTO chat_conversaciones_whatsapp 
         (numero_conversacion, telefono, prospecto_id, poliza_id, vendedor_id, tipo_origen, estado, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'activa', NOW(), NOW())`,
        [
          numeroConversacion,
          prospecto[0].numero_contacto,
          prospecto_id,
          poliza_id,
          vendedorAsignado,
          tipo_origen
        ]
      );

      const conversacionId = resultado.insertId;

      // Obtener la conversación creada con todos los datos
      const [nuevaConversacion] = await db.execute(
        `SELECT 
          c.*,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         LEFT JOIN users v ON c.vendedor_id = v.id
         LEFT JOIN users s ON v.supervisor_id = s.id
         WHERE c.id = ?`,
        [conversacionId]
      );

      console.log('✅ Back Office creó conversación exitosamente:', numeroConversacion);

      res.status(201).json({
        success: true,
        message: 'Conversación creada exitosamente',
        data: nuevaConversacion[0]
      });

    } catch (error) {
      console.error('❌ Error creando conversación (Back Office):', error);
      res.status(500).json({
        error: 'Error creando conversación',
        message: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Obtener todas las conversaciones del sistema (Dashboard)
  async obtenerTodasLasConversaciones(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        estado, 
        vendedor_id,
        supervisor_id,
        desde, 
        hasta, 
        buscar 
      } = req.query;

      console.log('💬 Back Office obteniendo todas las conversaciones del sistema');

      // ✅ SIN RESTRICCIONES: Todas las conversaciones
      let whereConditions = ['1=1'];
      let queryParams = [];

      if (estado && estado !== 'todos') {
        whereConditions.push('c.estado = ?');
        queryParams.push(estado);
      }

      if (supervisor_id && supervisor_id !== 'todos') {
        whereConditions.push('s.id = ?');
        queryParams.push(supervisor_id);
      }

      if (vendedor_id && vendedor_id !== 'todos') {
        whereConditions.push('v.id = ?');
        queryParams.push(vendedor_id);
      }

      if (desde) {
        whereConditions.push('DATE(c.created_at) >= ?');
        queryParams.push(desde);
      }

      if (hasta) {
        whereConditions.push('DATE(c.created_at) <= ?');
        queryParams.push(hasta);
      }

      if (buscar) {
        whereConditions.push(`(
          c.numero_conversacion LIKE ? OR 
          c.telefono LIKE ? OR
          p.nombre LIKE ? OR 
          p.apellido LIKE ? OR
          CONCAT(v.first_name, ' ', v.last_name) LIKE ?
        )`);
        const searchTerm = `%${buscar}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const whereClause = whereConditions.join(' AND ');
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Query principal
      const query = `
        SELECT 
          c.id,
          c.numero_conversacion,
          c.telefono,
          c.estado,
          c.tipo_origen,
          c.ultima_actividad,
          c.created_at,
          c.prospecto_id,
          c.poliza_id,
          c.vendedor_id,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido,
          p.correo as prospecto_email,
          pol.numero_poliza,
          pol.numero_poliza_oficial,
          pol.estado as poliza_estado,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre,
          v.email as vendedor_email,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre,
          s.email as supervisor_email,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id) as total_mensajes,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id AND estado_entrega != 'leido' AND tipo = 'recibido') as mensajes_no_leidos
        FROM chat_conversaciones_whatsapp c
        LEFT JOIN prospectos p ON c.prospecto_id = p.id
        LEFT JOIN polizas pol ON c.poliza_id = pol.id
        LEFT JOIN users v ON c.vendedor_id = v.id
        LEFT JOIN users s ON v.supervisor_id = s.id
        WHERE ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), offset);

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM chat_conversaciones_whatsapp c
        LEFT JOIN prospectos p ON c.prospecto_id = p.id  
        LEFT JOIN polizas pol ON c.poliza_id = pol.id
        LEFT JOIN users v ON c.vendedor_id = v.id
        LEFT JOIN users s ON v.supervisor_id = s.id
        WHERE ${whereClause}
      `;

      const countParams = queryParams.slice(0, -2);

      const [conversaciones] = await db.execute(query, queryParams);
      const [countResult] = await db.execute(countQuery, countParams);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / parseInt(limit));

      console.log(`✅ Back Office encontró ${total} conversaciones`);

      res.json({
        success: true,
        data: conversaciones.map(conv => ({
          id: conv.id,
          numero_conversacion: conv.numero_conversacion,
          telefono: conv.telefono,
          estado: conv.estado,
          tipo_origen: conv.tipo_origen,
          ultima_actividad: conv.ultima_actividad,
          created_at: conv.created_at,
          prospecto: {
            id: conv.prospecto_id,
            nombre: conv.prospecto_nombre,
            apellido: conv.prospecto_apellido,
            email: conv.prospecto_email
          },
          poliza: conv.poliza_id ? {
            id: conv.poliza_id,
            numero: conv.numero_poliza_oficial || conv.numero_poliza,
            estado: conv.poliza_estado
          } : null,
          vendedor: conv.vendedor_id ? {
            id: conv.vendedor_id,
            nombre: conv.vendedor_nombre,
            email: conv.vendedor_email
          } : null,
          supervisor: conv.supervisor_nombre ? {
            nombre: conv.supervisor_nombre,
            email: conv.supervisor_email
          } : null,
          metricas: {
            total_mensajes: conv.total_mensajes,
            mensajes_no_leidos: conv.mensajes_no_leidos
          }
        })),
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: totalPages,
          has_more: parseInt(page) < totalPages
        },
        filters_applied: {
          estado: estado || 'todos',
          vendedor_id: vendedor_id || 'todos',
          supervisor_id: supervisor_id || 'todos',
          desde,
          hasta,
          buscar
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo todas las conversaciones (Back Office):', error);
      res.status(500).json({
        error: 'Error obteniendo conversaciones',
        message: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIÓN: Estadísticas de conversaciones
  async obtenerEstadisticasConversaciones(req, res) {
    try {
      console.log('📊 Back Office obteniendo estadísticas de conversaciones');

      // ✅ SIN RESTRICCIONES: Estadísticas globales del sistema
      const [estadisticas] = await db.execute(`
        SELECT 
          COUNT(*) as total_conversaciones,
          COUNT(CASE WHEN c.estado = 'activa' THEN 1 END) as conversaciones_activas,
          COUNT(CASE WHEN c.estado = 'cerrada' THEN 1 END) as conversaciones_cerradas,
          COUNT(CASE WHEN c.estado = 'pausada' THEN 1 END) as conversaciones_pausadas,
          COUNT(DISTINCT c.prospecto_id) as prospectos_unicos,
          COUNT(DISTINCT c.vendedor_id) as vendedores_activos,
          (SELECT COUNT(*) FROM chat_mensajes) as total_mensajes,
          (SELECT COUNT(*) FROM chat_mensajes WHERE estado_entrega != 'leido' AND tipo = 'recibido') as mensajes_pendientes
        FROM chat_conversaciones_whatsapp c
      `);

      // Estadísticas por tipo de origen
      const [tiposOrigen] = await db.execute(`
        SELECT 
          tipo_origen,
          COUNT(*) as cantidad,
          ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM chat_conversaciones_whatsapp)), 2) as porcentaje
        FROM chat_conversaciones_whatsapp
        GROUP BY tipo_origen
        ORDER BY cantidad DESC
      `);

      // Top supervisores por conversaciones
      const [topSupervisores] = await db.execute(`
        SELECT 
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre,
          s.email as supervisor_email,
          COUNT(c.id) as total_conversaciones,
          COUNT(CASE WHEN c.estado = 'activa' THEN 1 END) as conversaciones_activas,
          COUNT(DISTINCT c.vendedor_id) as vendedores_con_conversaciones
        FROM chat_conversaciones_whatsapp c
        LEFT JOIN users v ON c.vendedor_id = v.id
        LEFT JOIN users s ON v.supervisor_id = s.id
        WHERE s.id IS NOT NULL
        GROUP BY s.id, s.first_name, s.last_name, s.email
        ORDER BY total_conversaciones DESC
        LIMIT 10
      `);

      // Top vendedores por conversaciones
      const [topVendedores] = await db.execute(`
        SELECT 
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre,
          v.email as vendedor_email,
          CONCAT(s.first_name, ' ', s.last_name) as supervisor_nombre,
          COUNT(c.id) as total_conversaciones,
          COUNT(CASE WHEN c.estado = 'activa' THEN 1 END) as conversaciones_activas,
          COUNT(CASE WHEN c.estado = 'cerrada' THEN 1 END) as conversaciones_cerradas
        FROM chat_conversaciones_whatsapp c
        LEFT JOIN users v ON c.vendedor_id = v.id
        LEFT JOIN users s ON v.supervisor_id = s.id
        WHERE v.id IS NOT NULL
        GROUP BY v.id, v.first_name, v.last_name, v.email, s.first_name, s.last_name
        ORDER BY total_conversaciones DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          resumen: estadisticas[0],
          tipos_origen: tiposOrigen,
          top_supervisores: topSupervisores,
          top_vendedores: topVendedores,
          metricas_calculadas: {
            tasa_conversion: estadisticas[0].total_conversaciones > 0 
              ? ((estadisticas[0].conversaciones_cerradas / estadisticas[0].total_conversaciones) * 100).toFixed(2) + '%'
              : '0%',
            promedio_mensajes_por_conversacion: estadisticas[0].total_conversaciones > 0
              ? (estadisticas[0].total_mensajes / estadisticas[0].total_conversaciones).toFixed(1)
              : '0'
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de conversaciones (Back Office):', error);
      res.status(500).json({
        error: 'Error obteniendo estadísticas',
        message: error.message
      });
    }
  }
};

module.exports = BackOfficeChatController;
