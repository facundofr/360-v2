const db = require('../config/db');
const WhatsAppService = require('./whatsappService');

class ChatService {
  /**
   * Crear una nueva conversación cuando se envía cotización/póliza
   * Asegura que solo haya una conversación activa por prospecto
   */
  async crearConversacion(datos) {
    try {
      const {
        telefono,
        vendedor_id,
        prospecto_id = null,
        poliza_id = null,
        tipo_origen, // 'cotizacion' | 'poliza' | 'manual'
        twilio_message_sid = null
      } = datos;

      const telefonoNormalizado = this.normalizarTelefono(telefono);

      // Si tenemos prospecto_id, buscar conversación existente para ese prospecto
      if (prospecto_id) {
        const [conversacionExistente] = await db.execute(
          `SELECT id, numero_conversacion, telefono, estado 
           FROM chat_conversaciones_whatsapp 
           WHERE prospecto_id = ? AND estado IN ('activa', 'pausada') 
           ORDER BY created_at DESC LIMIT 1`,
          [prospecto_id]
        );

        if (conversacionExistente.length > 0) {
          // Reactivar conversación existente si estaba pausada
          if (conversacionExistente[0].estado === 'pausada') {
            await db.execute(
              `UPDATE chat_conversaciones_whatsapp 
               SET estado = 'activa', ultima_actividad = NOW(), tipo_origen = ?, poliza_id = ?
               WHERE id = ?`,
              [tipo_origen, poliza_id, conversacionExistente[0].id]
            );
          } else {
            // Solo actualizar última actividad y datos adicionales
            await db.execute(
              `UPDATE chat_conversaciones_whatsapp 
               SET ultima_actividad = NOW(), tipo_origen = ?, poliza_id = ?
               WHERE id = ?`,
              [tipo_origen, poliza_id, conversacionExistente[0].id]
            );
          }

          console.log('✅ Conversación existente reutilizada para prospecto:', {
            id: conversacionExistente[0].id,
            numero: conversacionExistente[0].numero_conversacion,
            prospecto_id,
            tipo_origen
          });

          return {
            id: conversacionExistente[0].id,
            numero_conversacion: conversacionExistente[0].numero_conversacion,
            es_nueva: false
          };
        }
      }

      // Si no hay prospecto_id, buscar por teléfono pero solo si hay prospecto registrado
      if (!prospecto_id) {
        const [conversacionExistente] = await db.execute(
          `SELECT id, numero_conversacion, prospecto_id, estado 
           FROM chat_conversaciones_whatsapp 
           WHERE telefono = ? AND estado IN ('activa', 'pausada') 
           ORDER BY created_at DESC LIMIT 1`,
          [telefonoNormalizado]
        );

        if (conversacionExistente.length > 0) {
          // Actualizar conversación existente
          await db.execute(
            `UPDATE chat_conversaciones_whatsapp 
             SET ultima_actividad = NOW(), tipo_origen = ?, poliza_id = ?
             WHERE id = ?`,
            [tipo_origen, poliza_id, conversacionExistente[0].id]
          );

          return {
            id: conversacionExistente[0].id,
            numero_conversacion: conversacionExistente[0].numero_conversacion,
            es_nueva: false
          };
        }
      }

      // Crear nueva conversación solo si está asociada a un prospecto
      if (!prospecto_id && !vendedor_id) {
        throw new Error('No se puede crear conversación sin prospecto o vendedor asociado');
      }

      const [resultado] = await db.execute(
        `INSERT INTO chat_conversaciones_whatsapp 
         (numero_conversacion, telefono, prospecto_id, poliza_id, vendedor_id, tipo_origen, twilio_conversation_sid)
         VALUES (generar_numero_conversacion(), ?, ?, ?, ?, ?, ?)`,
        [telefonoNormalizado, prospecto_id, poliza_id, vendedor_id, tipo_origen, twilio_message_sid]
      );

      const [nuevaConversacion] = await db.execute(
        `SELECT numero_conversacion FROM chat_conversaciones_whatsapp WHERE id = ?`,
        [resultado.insertId]
      );

      console.log('✅ Nueva conversación creada:', {
        id: resultado.insertId,
        numero: nuevaConversacion[0].numero_conversacion,
        telefono: telefonoNormalizado,
        prospecto_id,
        tipo_origen
      });

      return {
        id: resultado.insertId,
        numero_conversacion: nuevaConversacion[0].numero_conversacion,
        es_nueva: true
      };

    } catch (error) {
      console.error('❌ Error creando conversación:', error);
      throw error;
    }
  }

  /**
   * Buscar prospecto por número de teléfono normalizado
   */
  async buscarProspectoPorTelefono(telefono) {
    try {
      // Normalizar el número (quitar espacios, paréntesis, guiones, etc.)
      const telefonoNormalizado = this.normalizarTelefono(telefono);
      
      // Buscar prospecto por diferentes variaciones del número
      // INCLUIR asignación más reciente desde la tabla asignaciones
      const [prospectos] = await db.execute(
        `SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.numero_contacto,
          p.user_id,
          p.estado,
          a.estado as estado_asignacion,
          a.id_vendedor as vendedor_id,
          u.first_name as vendedor_nombre,
          u.last_name as vendedor_apellido
         FROM prospectos p
         LEFT JOIN asignaciones a ON p.id = a.id_prospecto
         LEFT JOIN users u ON a.id_vendedor = u.id
         WHERE 
           REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.numero_contacto, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '') = ?
           OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.numero_contacto, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '') LIKE CONCAT('%', ?)
           OR ? LIKE CONCAT('%', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.numero_contacto, ' ', ''), '(', ''), ')', ''), '-', ''), '+', ''))
         ORDER BY p.fecha_registro DESC, a.fecha_asignacion DESC
         LIMIT 1`,
        [telefonoNormalizado, telefonoNormalizado.slice(-10), telefonoNormalizado]
      );

      return prospectos.length > 0 ? prospectos[0] : null;
    } catch (error) {
      console.error('❌ Error buscando prospecto por teléfono:', error);
      throw error;
    }
  }

  /**
   * Obtener o crear conversación única para un prospecto
   * Esta función garantiza que solo haya una conversación activa por prospecto
   */
  async obtenerOCrearConversacionProspecto(prospecto_id, telefono, vendedor_id, tipo_origen = 'manual', poliza_id = null) {
    try {
      // Buscar conversación existente para el prospecto
      let conversacion = await this.buscarConversacionPorProspecto(prospecto_id);
      
      if (conversacion.length > 0) {
        // Si existe una conversación, reactivarla si está pausada
        const conv = conversacion[0];
        
        if (conv.estado === 'pausada') {
          await db.execute(
            `UPDATE chat_conversaciones_whatsapp 
             SET estado = 'activa', ultima_actividad = NOW(), tipo_origen = ?, poliza_id = ?
             WHERE id = ?`,
            [tipo_origen, poliza_id, conv.id]
          );
          
          console.log('✅ Conversación reactivada para prospecto:', prospecto_id);
        } else {
          // Solo actualizar última actividad
          await this.actualizarUltimaActividad(conv.id);
        }
        
        return {
          id: conv.id,
          numero_conversacion: conv.numero_conversacion,
          es_nueva: false,
          estado: 'reactivada'
        };
      }
      
      // Si no existe, crear nueva conversación
      const nuevaConversacion = await this.crearConversacion({
        telefono: this.normalizarTelefono(telefono),
        vendedor_id,
        prospecto_id,
        poliza_id,
        tipo_origen
      });
      
      console.log('✅ Nueva conversación creada para prospecto:', prospecto_id);
      
      return {
        ...nuevaConversacion,
        estado: 'creada'
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo/creando conversación para prospecto:', error);
      throw error;
    }
  }

  /**
   * Normalizar número de teléfono para comparaciones
   */
  normalizarTelefono(telefono) {
    if (!telefono) return '';
    
    // Quitar 'whatsapp:' si existe
    let numero = telefono.replace('whatsapp:', '');
    
    // Quitar caracteres no numéricos excepto el + inicial
    numero = numero.replace(/[^\d+]/g, '');
    
    // Quitar el + inicial si existe
    numero = numero.replace(/^\+/, '');
    
    return numero;
  }

  /**
   * Buscar conversación por prospecto ID
   */
  async buscarConversacionPorProspecto(prospecto_id) {
    try {
      const [conversaciones] = await db.execute(
        `SELECT 
          c.*,
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN users v ON c.vendedor_id = v.id
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         WHERE c.prospecto_id = ? AND c.estado IN ('activa', 'pausada')
         ORDER BY c.created_at DESC`,
        [prospecto_id]
      );

      return conversaciones;
    } catch (error) {
      console.error('❌ Error buscando conversación por prospecto:', error);
      throw error;
    }
  }

  /**
   * Verificar si un número de teléfono está registrado como prospecto
   */
  async verificarNumeroRegistrado(telefono) {
    try {
      const prospecto = await this.buscarProspectoPorTelefono(telefono);
      
      return {
        registrado: !!prospecto,
        prospecto: prospecto ? {
          id: prospecto.id,
          nombre: `${prospecto.nombre} ${prospecto.apellido}`,
          vendedor_id: prospecto.vendedor_id,
          estado: prospecto.estado
        } : null
      };
    } catch (error) {
      console.error('❌ Error verificando número registrado:', error);
      throw error;
    }
  }

  /**
   * Buscar conversación por número de teléfono
   */
  async buscarConversacionPorTelefono(telefono) {
    try {
      const telefonoNormalizado = this.normalizarTelefono(telefono);
      
      const [conversaciones] = await db.execute(
        `SELECT 
          c.*,
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN users v ON c.vendedor_id = v.id
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         WHERE c.telefono = ?
         ORDER BY c.created_at DESC`,
        [telefonoNormalizado]
      );

      return conversaciones;
    } catch (error) {
      console.error('❌ Error buscando conversación por teléfono:', error);
      throw error;
    }
  }

  /**
   * Actualizar última actividad de conversación
   */
  async actualizarUltimaActividad(conversacion_id) {
    try {
      await db.execute(
        `UPDATE chat_conversaciones_whatsapp 
         SET updated_at = NOW() 
         WHERE id = ?`,
        [conversacion_id]
      );
    } catch (error) {
      console.error('❌ Error actualizando última actividad:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de mensaje por Twilio SID (primera definición — delegada)
   */
  async actualizarEstadoMensaje_legacy(twilio_message_sid, estado) {
    // Esta función ha sido reemplazada por la definición al final de la clase
    return this.actualizarEstadoMensaje(twilio_message_sid, estado);
  }

  /**
   * Registrar mensaje en la conversación
   */
  async registrarMensaje(datos) {
    try {
      const {
        conversacion_id,
        mensaje,
        tipo, // 'enviado' | 'recibido' | 'sistema'
        origen, // 'vendedor' | 'cliente' | 'sistema' | 'whatsapp'
        twilio_message_sid = null,
        estado_entrega = 'pendiente',
        archivo_url = null,
        archivo_tipo = null,
        archivo_nombre = null,
        archivo_tamaño = null,
        metadata = null
      } = datos;

      const [resultado] = await db.execute(
        `INSERT INTO chat_mensajes 
         (conversacion_id, mensaje, tipo, origen, twilio_message_sid, estado_entrega, 
          archivo_url, archivo_tipo, archivo_nombre, archivo_tamaño, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversacion_id,
          mensaje,
          tipo,
          origen,
          twilio_message_sid,
          estado_entrega,
          archivo_url,
          archivo_tipo,
          archivo_nombre,
          archivo_tamaño,
          metadata ? JSON.stringify(metadata) : null
        ]
      );

      return resultado.insertId;

    } catch (error) {
      console.error('❌ Error registrando mensaje:', error);
      throw error;
    }
  }

  /**
   * Enviar mensaje desde la aplicación
   */
  async enviarMensaje(datos) {
    try {
      const {
        conversacion_id,
        mensaje,
        vendedor_id
      } = datos;

      // Obtener datos de la conversación
      const [conversacion] = await db.execute(
        `SELECT telefono, estado FROM chat_conversaciones_whatsapp WHERE id = ?`,
        [conversacion_id]
      );

      if (conversacion.length === 0) {
        throw new Error('Conversación no encontrada');
      }

      if (conversacion[0].estado === 'cerrada') {
        throw new Error('No se puede enviar mensajes a una conversación cerrada');
      }

      const telefono = conversacion[0].telefono;

      // Enviar por WhatsApp usando Twilio
      const resultadoWhatsApp = await WhatsAppService.enviarMensaje(telefono, mensaje);

      if (resultadoWhatsApp.success) {
        // Registrar en base de datos
        const mensaje_id = await this.registrarMensaje({
          conversacion_id,
          mensaje,
          tipo: 'enviado',
          origen: 'vendedor',
          twilio_message_sid: resultadoWhatsApp.message_id,
          estado_entrega: 'enviado'
        });

        // Actualizar actividad de la conversación
        await db.execute(
          `UPDATE chat_conversaciones_whatsapp SET ultima_actividad = NOW() WHERE id = ?`,
          [conversacion_id]
        );

        // 🆕 ACTUALIZACIÓN AUTOMÁTICA DEL SHEET: Si este es el primer mensaje del vendedor,
        // actualizar automáticamente la columna P en Google Sheets
        try {
          const [conversacion] = await db.execute(
            `SELECT prospecto_id FROM chat_conversaciones_whatsapp WHERE id = ?`,
            [conversacion_id]
          );

          console.log('📊 DEBUG: Conversación ID', conversacion_id, '- Prospecto ID:', conversacion.length > 0 ? conversacion[0].prospecto_id : 'NULL');

          if (conversacion.length > 0 && conversacion[0].prospecto_id) {
            const prospectoId = conversacion[0].prospecto_id;
            
            // Verificar que es el primer mensaje del vendedor
            // Contar todos los mensajes del vendedor (incluyendo el que acaba de registrarse)
            const [otrosMensajes] = await db.execute(
              `SELECT COUNT(*) as total FROM chat_mensajes 
               WHERE conversacion_id = ? AND origen = 'vendedor'`,
              [conversacion_id]
            );

            console.log('📊 DEBUG: Prospect', prospectoId, '- Total mensajes vendedor:', otrosMensajes[0].total);

            // Si es el primer mensaje (solo 1 mensaje del vendedor en la conversación)
            if (otrosMensajes[0].total === 1) {
              console.log('📊 DEBUG: Activando actualización Sheet para prospecto', prospectoId);
              const GoogleSheetsService = require('./googleSheetsService');
              
              // Usar la nueva función que actualiza solo la columna P con la fecha/hora ACTUAL
              try {
                console.log(`⏳ Esperando actualización de Sheet para prospecto ${prospectoId}...`);
                const resultadoSheet = await GoogleSheetsService.actualizarPrimerMensajeEnSheet(prospectoId, new Date());
                console.log(`✅ Sheet actualizado exitosamente para prospecto ${prospectoId} - Resultado:`, resultadoSheet);
              } catch (errSheet) {
                console.error(`❌ Error al actualizar Sheet para prospecto ${prospectoId}:`, errSheet.message);
                console.error(`   Stack:`, errSheet.stack);
              }
            }
          }
        } catch (err) {
          console.error('⚠️  Error en actualización automática del Sheet:', err.message);
          // No bloquear el envío del mensaje si falla la actualización del Sheet
        }

        return {
          success: true,
          mensaje_id,
          twilio_sid: resultadoWhatsApp.message_id
        };
      } else {
        throw new Error('Error enviando WhatsApp');
      }

    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      
      // Registrar mensaje fallido
      if (datos.conversacion_id) {
        await this.registrarMensaje({
          conversacion_id: datos.conversacion_id,
          mensaje: datos.mensaje,
          tipo: 'enviado',
          origen: 'vendedor',
          estado_entrega: 'fallido',
          metadata: { error: error.message }
        });
      }

      throw error;
    }
  }

  /**
   * Obtener conversaciones del vendedor
   */
  async obtenerConversaciones(vendedor_id, filtros = {}) {
    try {
      let whereClause = 'WHERE c.vendedor_id = ?';
      let params = [vendedor_id];

      // Aplicar filtros
      if (filtros.estado) {
        whereClause += ' AND c.estado = ?';
        params.push(filtros.estado);
      }

      if (filtros.tipo_origen) {
        whereClause += ' AND c.tipo_origen = ?';
        params.push(filtros.tipo_origen);
      }

      if (filtros.busqueda) {
        whereClause += ' AND (c.telefono LIKE ? OR c.prospecto_nombre LIKE ? OR c.prospecto_apellido LIKE ?)';
        const busqueda = `%${filtros.busqueda}%`;
        params.push(busqueda, busqueda, busqueda);
      }

      const query = `
        SELECT * FROM vista_conversaciones_completas c
        ${whereClause}
        ORDER BY c.ultima_actividad DESC
        LIMIT ${filtros.limit || 50}
        OFFSET ${filtros.offset || 0}
      `;

      const [conversaciones] = await db.execute(query, params);

      return conversaciones;

    } catch (error) {
      console.error('❌ Error obteniendo conversaciones:', error);
      throw error;
    }
  }

  /**
   * Obtener mensajes de una conversación
   */
  async obtenerMensajes(conversacion_id, limite = 50, offset = 0) {
    try {
      const [mensajes] = await db.execute(
        `SELECT 
          id,
          mensaje,
          tipo,
          origen,
          estado_entrega,
          metadata,
          created_at,
          twilio_message_sid,
          archivo_url,
          archivo_tipo,
          archivo_nombre,
          archivo_tamaño
         FROM chat_mensajes 
         WHERE conversacion_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [conversacion_id, limite, offset]
      );

      return mensajes.reverse(); // Mostrar más antiguos primero

    } catch (error) {
      console.error('❌ Error obteniendo mensajes:', error);
      throw error;
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  async marcarComoLeidos(conversacion_id, origen = 'cliente') {
    try {
      await db.execute(
        `UPDATE chat_mensajes 
         SET estado_entrega = 'leido' 
         WHERE conversacion_id = ? AND origen = ? AND estado_entrega != 'leido'`,
        [conversacion_id, origen]
      );

      return true;

    } catch (error) {
      console.error('❌ Error marcando mensajes como leídos:', error);
      throw error;
    }
  }

  /**
   * Cambiar estado de conversación
   */
  async cambiarEstado(conversacion_id, nuevo_estado, vendedor_id, motivo = null) {
    try {
      // Obtener estado actual
      const [conversacion] = await db.execute(
        `SELECT estado FROM chat_conversaciones_whatsapp WHERE id = ?`,
        [conversacion_id]
      );

      if (conversacion.length === 0) {
        throw new Error('Conversación no encontrada');
      }

      const estado_anterior = conversacion[0].estado;

      // Actualizar estado
      await db.execute(
        `UPDATE chat_conversaciones_whatsapp SET estado = ? WHERE id = ?`,
        [nuevo_estado, conversacion_id]
      );

      // Registrar cambio de estado
      await db.execute(
        `INSERT INTO chat_estados (conversacion_id, estado_anterior, estado_nuevo, motivo, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [conversacion_id, estado_anterior, nuevo_estado, motivo, vendedor_id]
      );

      // Registrar mensaje del sistema
      await this.registrarMensaje({
        conversacion_id,
        mensaje: `Conversación ${nuevo_estado}${motivo ? `: ${motivo}` : ''}`,
        tipo: 'sistema',
        origen: 'sistema',
        estado_entrega: 'entregado'
      });

      return true;

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      throw error;
    }
  }

  /**
   * Obtener plantillas de mensajes
   */
  async obtenerPlantillas(vendedor_id = null) {
    try {
      const [plantillas] = await db.execute(
        `SELECT id, nombre, contenido, categoria 
         FROM chat_plantillas 
         WHERE (vendedor_id = ? OR vendedor_id IS NULL) AND activa = TRUE
         ORDER BY categoria, nombre`,
        [vendedor_id]
      );

      return plantillas;

    } catch (error) {
      console.error('❌ Error obteniendo plantillas:', error);
      throw error;
    }
  }

  /**
   * Procesar template de mensaje con variables
   */
  procesarTemplate(template, variables) {
    let mensaje = template;
    
    Object.keys(variables).forEach(variable => {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      mensaje = mensaje.replace(regex, variables[variable]);
    });

    return mensaje;
  }

  // ✅ NUEVAS FUNCIONES PARA WEBHOOK

  /**
   * Buscar conversación por número de teléfono
   */
  async buscarConversacionPorTelefono(telefono) {
    try {
      const [conversaciones] = await db.execute(
        `SELECT * FROM vista_conversaciones_completas 
         WHERE telefono = ? AND estado != 'cerrada' 
         ORDER BY ultima_actividad DESC`,
        [telefono]
      );

      return conversaciones;

    } catch (error) {
      console.error('❌ Error buscando conversación por teléfono:', error);
      throw error;
    }
  }

  /**
   * Actualizar última actividad de conversación
   */
  async actualizarUltimaActividad(conversacion_id) {
    try {
      await db.execute(
        `UPDATE chat_conversaciones_whatsapp 
         SET ultima_actividad = NOW() 
         WHERE id = ?`,
        [conversacion_id]
      );

      return true;

    } catch (error) {
      console.error('❌ Error actualizando última actividad:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de mensaje por Twilio SID
   */
  async actualizarEstadoMensaje(twilio_message_sid, estado) {
    try {
      // Mapear estados de Twilio a ENUM de la BD
      const TWILIO_MAP = {
        queued:      'pendiente',
        accepting:   'pendiente',
        accepted:    'pendiente',
        scheduled:   'pendiente',
        sending:     'pendiente',
        sent:        'enviado',
        delivered:   'entregado',
        read:        'leido',
        failed:      'fallido',
        undelivered: 'fallido',
        canceled:    'fallido',
      };
      const estadoMapped = TWILIO_MAP[estado?.toLowerCase()] || null;
      if (!estadoMapped) {
        console.warn('⚠️ Estado Twilio desconocido (ignorado):', estado);
        return false;
      }

      await db.execute(
        `UPDATE chat_mensajes 
         SET estado_entrega = ? 
         WHERE twilio_message_sid = ?`,
        [estadoMapped, twilio_message_sid]
      );

      console.log(`✅ Estado actualizado: ${estado} → ${estadoMapped} (SID: ${twilio_message_sid})`);
      return true;

    } catch (error) {
      console.error('❌ Error actualizando estado de mensaje:', error);
      throw error;
    }
  }
}

module.exports = new ChatService();
