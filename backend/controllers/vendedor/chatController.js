const ChatService = require('../../services/chatService');

const ChatController = {
  // Obtener conversaciones del vendedor
  async obtenerConversaciones(req, res) {
    try {
      const vendedor_id = req.user.id;
      const filtros = {
        estado: req.query.estado,
        tipo_origen: req.query.tipo_origen,
        busqueda: req.query.busqueda,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const conversaciones = await ChatService.obtenerConversaciones(vendedor_id, filtros);

      res.json({
        success: true,
        data: conversaciones,
        pagination: {
          limit: filtros.limit,
          offset: filtros.offset,
          total: conversaciones.length
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo conversaciones:', error);
      res.status(500).json({
        error: 'Error obteniendo conversaciones',
        message: error.message
      });
    }
  },

  // Obtener mensajes de una conversación
  async obtenerMensajes(req, res) {
    try {
      const { id } = req.params;
      const limite = parseInt(req.query.limite) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Verificar que la conversación pertenece al vendedor
      const [conversacion] = await require('../../config/db').execute(
        `SELECT id FROM chat_conversaciones_whatsapp WHERE id = ? AND vendedor_id = ?`,
        [id, req.user.id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      const mensajes = await ChatService.obtenerMensajes(id, limite, offset);

      // 🔧 CAMBIO: NO marcar automáticamente como leídos al cargar mensajes
      // Solo marcar como leídos cuando el usuario explícitamente lo haga
      // await ChatService.marcarComoLeidos(id, 'cliente');

      res.json({
        success: true,
        data: mensajes
      });

    } catch (error) {
      console.error('❌ Error obteniendo mensajes:', error);
      res.status(500).json({
        error: 'Error obteniendo mensajes',
        message: error.message
      });
    }
  },

  // Enviar mensaje
  async enviarMensaje(req, res) {
    try {
      const { id } = req.params;
      const { mensaje, plantilla_id } = req.body;

      if (!mensaje && !plantilla_id) {
        return res.status(400).json({
          error: 'Mensaje o plantilla requerida'
        });
      }

      // Verificar que la conversación pertenece al vendedor
      const [conversacion] = await require('../../config/db').execute(
        `SELECT id, telefono FROM chat_conversaciones_whatsapp WHERE id = ? AND vendedor_id = ?`,
        [id, req.user.id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      let mensajeFinal = mensaje;

      // Si se usa una plantilla, procesarla
      if (plantilla_id) {
        const [plantilla] = await require('../../config/db').execute(
          `SELECT contenido FROM chat_plantillas WHERE id = ? AND (vendedor_id = ? OR vendedor_id IS NULL)`,
          [plantilla_id, req.user.id]
        );

        if (plantilla.length === 0) {
          return res.status(404).json({
            error: 'Plantilla no encontrada'
          });
        }

        // Procesar variables de la plantilla
        const variables = {
          vendedor: `${req.user.first_name} ${req.user.last_name}`,
          cliente: 'Cliente', // Se puede mejorar obteniendo el nombre real
        };

        mensajeFinal = ChatService.procesarTemplate(plantilla[0].contenido, variables);
      }

      const resultado = await ChatService.enviarMensaje({
        conversacion_id: id,
        mensaje: mensajeFinal,
        vendedor_id: req.user.id
      });

      res.json({
        success: true,
        message: 'Mensaje enviado exitosamente',
        data: {
          mensaje_id: resultado.mensaje_id,
          twilio_sid: resultado.twilio_sid
        }
      });

    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      res.status(500).json({
        error: 'Error enviando mensaje',
        message: error.message
      });
    }
  },

  // Cambiar estado de conversación
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, motivo } = req.body;

      if (!['activa', 'pausada', 'cerrada'].includes(estado)) {
        return res.status(400).json({
          error: 'Estado inválido',
          message: 'El estado debe ser: activa, pausada o cerrada'
        });
      }

      // Verificar que la conversación pertenece al vendedor
      const [conversacion] = await require('../../config/db').execute(
        `SELECT id FROM chat_conversaciones_whatsapp WHERE id = ? AND vendedor_id = ?`,
        [id, req.user.id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      await ChatService.cambiarEstado(id, estado, req.user.id, motivo);

      res.json({
        success: true,
        message: `Conversación ${estado} exitosamente`
      });

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      res.status(500).json({
        error: 'Error cambiando estado',
        message: error.message
      });
    }
  },

  // Obtener plantillas
  async obtenerPlantillas(req, res) {
    try {
      const plantillas = await ChatService.obtenerPlantillas(req.user.id);

      // Agrupar por categoría
      const plantillasAgrupadas = plantillas.reduce((acc, plantilla) => {
        if (!acc[plantilla.categoria]) {
          acc[plantilla.categoria] = [];
        }
        acc[plantilla.categoria].push(plantilla);
        return acc;
      }, {});

      res.json({
        success: true,
        data: plantillasAgrupadas
      });

    } catch (error) {
      console.error('❌ Error obteniendo plantillas:', error);
      res.status(500).json({
        error: 'Error obteniendo plantillas',
        message: error.message
      });
    }
  },

  // Crear plantilla personalizada
  async crearPlantilla(req, res) {
    try {
      const { nombre, contenido, categoria = 'personalizado' } = req.body;

      if (!nombre || !contenido) {
        return res.status(400).json({
          error: 'Nombre y contenido requeridos'
        });
      }

      const [resultado] = await require('../../config/db').execute(
        `INSERT INTO chat_plantillas (nombre, contenido, categoria, vendedor_id)
         VALUES (?, ?, ?, ?)`,
        [nombre, contenido, categoria, req.user.id]
      );

      res.json({
        success: true,
        message: 'Plantilla creada exitosamente',
        data: {
          id: resultado.insertId
        }
      });

    } catch (error) {
      console.error('❌ Error creando plantilla:', error);
      res.status(500).json({
        error: 'Error creando plantilla',
        message: error.message
      });
    }
  },

  // Marcar mensajes como leídos
  async marcarComoLeidos(req, res) {
    try {
      const { id } = req.params;

      // Verificar que la conversación pertenece al vendedor
      const [conversacion] = await require('../../config/db').execute(
        `SELECT id FROM chat_conversaciones_whatsapp WHERE id = ? AND vendedor_id = ?`,
        [id, req.user.id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          error: 'Conversación no encontrada'
        });
      }

      // Marcar mensajes del cliente como leídos
      await ChatService.marcarComoLeidos(id, 'cliente');

      res.json({
        success: true,
        message: 'Mensajes marcados como leídos'
      });

    } catch (error) {
      console.error('❌ Error marcando mensajes como leídos:', error);
      res.status(500).json({
        error: 'Error marcando mensajes como leídos',
        message: error.message
      });
    }
  },

  // Verificar si un número está registrado como prospecto
  async verificarNumeroRegistrado(req, res) {
    try {
      const { telefono } = req.params;

      if (!telefono) {
        return res.status(400).json({
          error: 'Número de teléfono requerido'
        });
      }

      const resultado = await ChatService.verificarNumeroRegistrado(telefono);

      res.json({
        success: true,
        data: resultado
      });

    } catch (error) {
      console.error('❌ Error verificando número registrado:', error);
      res.status(500).json({
        error: 'Error verificando número registrado',
        message: error.message
      });
    }
  },

  // Obtener estadísticas del chat
  async obtenerEstadisticas(req, res) {
    try {
      const vendedor_id = req.user.id;
      
      const [stats] = await require('../../config/db').execute(`
        SELECT 
          COUNT(*) as total_conversaciones,
          SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as conversaciones_activas,
          SUM(CASE WHEN estado = 'pausada' THEN 1 ELSE 0 END) as conversaciones_pausadas,
          SUM(CASE WHEN estado = 'cerrada' THEN 1 ELSE 0 END) as conversaciones_cerradas,
          SUM(CASE WHEN tipo_origen = 'cotizacion' THEN 1 ELSE 0 END) as desde_cotizaciones,
          SUM(CASE WHEN tipo_origen = 'poliza' THEN 1 ELSE 0 END) as desde_polizas,
          (
            SELECT COUNT(*) 
            FROM chat_mensajes cm 
            JOIN chat_conversaciones_whatsapp cc ON cm.conversacion_id = cc.id 
            WHERE cc.vendedor_id = ? AND cm.origen = 'cliente' AND cm.estado_entrega != 'leido'
          ) as mensajes_no_leidos
        FROM chat_conversaciones_whatsapp 
        WHERE vendedor_id = ?
      `, [vendedor_id, vendedor_id]);

      res.json({
        success: true,
        data: stats[0] || {
          total_conversaciones: 0,
          conversaciones_activas: 0,
          conversaciones_pausadas: 0,
          conversaciones_cerradas: 0,
          desde_cotizaciones: 0,
          desde_polizas: 0,
          mensajes_no_leidos: 0
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      res.status(500).json({
        error: 'Error obteniendo estadísticas',
        message: error.message
      });
    }
  },

  // ✅ NUEVO: Obtener conversaciones por prospecto
  async obtenerConversacionesPorProspecto(req, res) {
    try {
      const { prospecto_id } = req.params;
      const vendedor_id = req.user.id;

      // Verificar que el prospecto pertenece al vendedor
      const [prospecto] = await require('../../config/db').execute(
        `SELECT id, nombre, apellido, telefono FROM prospectos WHERE id = ? AND vendedor_id = ?`,
        [prospecto_id, vendedor_id]
      );

      if (prospecto.length === 0) {
        return res.status(404).json({
          error: 'Prospecto no encontrado o no autorizado'
        });
      }

      // Obtener conversaciones del prospecto con datos relacionados
      const [conversaciones] = await require('../../config/db').execute(
        `SELECT 
          c.id,
          c.numero_conversacion,
          c.telefono,
          c.estado,
          c.tipo_origen,
          c.ultima_actividad,
          c.created_at,
          c.poliza_id,
          pol.numero_poliza,
          pol.estado as poliza_estado,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id) as total_mensajes,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id AND leido = 0 AND tipo = 'recibido') as mensajes_no_leidos
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN polizas pol ON c.poliza_id = pol.id
         WHERE c.prospecto_id = ? 
         ORDER BY c.created_at DESC`,
        [prospecto_id]
      );

      // Obtener últimos mensajes de cada conversación
      const conversacionesConMensajes = await Promise.all(
        conversaciones.map(async (conv) => {
          const [ultimoMensaje] = await require('../../config/db').execute(
            `SELECT 
              contenido,
              tipo,
              created_at,
              tipo_contenido
             FROM chat_mensajes 
             WHERE conversacion_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          return {
            ...conv,
            ultimo_mensaje: ultimoMensaje.length > 0 ? ultimoMensaje[0] : null
          };
        })
      );

      res.json({
        success: true,
        data: {
          prospecto: prospecto[0],
          conversaciones: conversacionesConMensajes
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo conversaciones por prospecto:', error);
      res.status(500).json({
        error: 'Error obteniendo conversaciones del prospecto',
        message: error.message
      });
    }
  },

  // 📎 Enviar mensaje con archivo adjunto
  async enviarMensajeConArchivo(req, res) {
    console.log('🔥 MÉTODO enviarMensajeConArchivo LLAMADO');
    console.log('📦 req.params:', req.params);
    console.log('📦 req.body:', req.body);
    console.log('📦 req.file:', req.file);
    
    try {
      const { id } = req.params;
      const { mensaje } = req.body;
      const archivo = req.file;

      if (!archivo) {
        return res.status(400).json({
          success: false,
          error: 'No se recibió ningún archivo'
        });
      }

      // Verificar que la conversación pertenece al vendedor
      const db = require('../../config/db');
      const [conversacion] = await db.execute(
        `SELECT id, telefono, prospecto_id FROM chat_conversaciones_whatsapp WHERE id = ? AND vendedor_id = ?`,
        [id, req.user.id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada'
        });
      }

  // Construir URL pública del archivo (usar alias bajo /api para compatibilidad con NGINX)
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const fileUrl = `${baseUrl.replace(/\/$/, '')}/api/uploads/whatsapp/${encodeURIComponent(archivo.filename)}`;

      console.log('📎 Enviando archivo via WhatsApp:', {
        archivo: archivo.filename,
        tipo: archivo.mimetype,
        tamaño: archivo.size,
        url: fileUrl
      });

      // Formatear número de teléfono correctamente
      let telefonoFormateado = conversacion[0].telefono;
      
      // Limpiar el número de caracteres especiales
      telefonoFormateado = telefonoFormateado.replace(/[^0-9+]/g, '');
      
      // Si no tiene +, agregarlo (asumiendo Argentina +54)
      if (!telefonoFormateado.startsWith('+')) {
        if (telefonoFormateado.startsWith('54')) {
          telefonoFormateado = '+' + telefonoFormateado;
        } else if (telefonoFormateado.startsWith('9')) {
          // Si empieza con 9, es formato con código de área
          telefonoFormateado = '+54' + telefonoFormateado;
        } else {
          // Si no, agregar +54 directamente
          telefonoFormateado = '+54' + telefonoFormateado;
        }
      }

      console.log('📱 Número formateado:', {
        original: conversacion[0].telefono,
        formateado: telefonoFormateado
      });

      // Enviar via Twilio WhatsApp
      const twilio = require('twilio');
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      const twilioMessage = await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${telefonoFormateado}`,
        body: mensaje || 'Archivo adjunto',
        mediaUrl: [fileUrl]
      });

      // Guardar en base de datos
      const [result] = await db.execute(
        `INSERT INTO chat_mensajes 
        (conversacion_id, mensaje, tipo, origen, estado_entrega, twilio_message_sid, archivo_url, archivo_tipo, archivo_nombre, archivo_tamaño, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          mensaje || 'Archivo enviado',
          'enviado',
          'vendedor',
          'enviado',
          twilioMessage.sid,
          fileUrl,
          archivo.mimetype,
          archivo.originalname,
          archivo.size
        ]
      );

      // Actualizar última actividad de la conversación
      await db.execute(
        `UPDATE chat_conversaciones_whatsapp 
        SET ultima_actividad = NOW()
        WHERE id = ?`,
        [id]
      );

      // Obtener el mensaje completo
      const [mensajeCompleto] = await db.execute(
        `SELECT * FROM chat_mensajes WHERE id = ?`,
        [result.insertId]
      );

      res.json({
        success: true,
        message: 'Archivo enviado correctamente',
        data: {
          ...mensajeCompleto[0],
          archivo: {
            nombre: archivo.originalname,
            tipo: archivo.mimetype,
            tamaño: archivo.size,
            url: fileUrl
          }
        }
      });

    } catch (error) {
      console.error('❌ Error enviando archivo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al enviar archivo',
        message: error.message
      });
    }
  }
};

module.exports = ChatController;
