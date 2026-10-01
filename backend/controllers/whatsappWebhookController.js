const ChatService = require('../services/chatService');
const Historial = require('../models/vendedor/historialModel');
const ValidacionWhatsappService = require('../services/validacionWhatsappService');
const NutricionLeadsService = require('../services/nutricionLeadsService');
const db = require('../config/db');

// Función para normalizar números de teléfono
function normalizarTelefono(telefono) {
  if (!telefono) return null;
  
  // Quitar 'whatsapp:' si existe
  let numero = telefono.replace('whatsapp:', '');
  
  // Quitar el '+' inicial si existe
  numero = numero.replace(/^\+/, '');
  
  return numero;
}

const WhatsAppWebhookController = {
    // 📥 VERIFICACIÓN DEL WEBHOOK (GET)
  async verificarWebhook(req, res) {
    try {
      console.log('🔍 Verificación webhook WhatsApp:', {
        mode: req.query['hub.mode'],
        challenge: req.query['hub.challenge'],
        verifyToken: req.query['hub.verify_token']
      });

      const mode = req.query['hub.mode'];
      const challenge = req.query['hub.challenge'];
      const verifyToken = req.query['hub.verify_token'];

      // Para webhooks de Twilio/Facebook, el modo debe ser 'subscribe'
      // Para pruebas manuales, aceptamos cualquier token válido
      if ((mode === 'subscribe' || !mode) && verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verificado correctamente');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Token de verificación inválido', {
          expectedToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
          receivedToken: verifyToken,
          mode: mode
        });
        return res.status(403).send('Forbidden');
      }
    } catch (error) {
      console.error('❌ Error en verificación webhook:', error);
      return res.status(500).send('Error interno');
    }
  },

  // Recibir mensajes entrantes de WhatsApp
  async recibirMensaje(req, res) {
    try {
      console.log('📨 Webhook WhatsApp recibido:', JSON.stringify(req.body, null, 2));

      // Twilio envía los datos en el body
      const {
        MessageSid,
        From,
        To,
        Body,
        ButtonPayload,
        ButtonText,
        MessageStatus,
        SmsStatus,
        MediaUrl0,
        MediaContentType0,
        NumMedia
      } = req.body;

      // Extraer número de teléfono y normalizar
      const telefonoRaw = From ? From.replace('whatsapp:', '') : null;
      const numeroDestinoRaw = To ? To.replace('whatsapp:', '') : null;
      
      // Normalizar números (quitar + inicial)
      const telefono = normalizarTelefono(From);
      const numeroDestino = normalizarTelefono(To);

      console.log('📱 Teléfono raw:', telefonoRaw, '-> normalizado:', telefono);
      console.log('📱 Destino raw:', numeroDestinoRaw, '-> normalizado:', numeroDestino);
      console.log('💬 Contenido:', Body);
      console.log('📊 Estado:', MessageStatus || SmsStatus);

      // Validar que tenga teléfono y (Body o multimedia)
      if (!telefono) {
        console.warn('⚠️ Mensaje sin teléfono, ignorando');
        return res.status(200).send('OK');
      }

      // 🤖 Circuito de validación de leads por WhatsApp: si el teléfono tiene una
      // validación en curso, se procesa acá mismo (máquina de estados de 2 pasos)
      // y se corta el flujo normal del chat vendedor↔prospecto para este mensaje.
      // Va antes del chequeo de Body vacío porque una respuesta de quick-reply
      // puede traer el valor solo en ButtonPayload, con Body vacío.
      try {
        const prospectoEnValidacion = await ValidacionWhatsappService.buscarProspectoEnValidacionPorTelefono(telefono);
        if (prospectoEnValidacion) {
          const textoRespuesta = ButtonPayload || ButtonText || Body || '';
          console.log(`🔍 Prospecto ${prospectoEnValidacion.id} en circuito de validación (estado: ${prospectoEnValidacion.estado}) — procesando inline`);
          await ValidacionWhatsappService.procesarRespuestaValidacion(prospectoEnValidacion, textoRespuesta);
          return res.status(200).send('OK');
        }
      } catch (validacionError) {
        // Si algo falla acá, seguimos con el flujo normal de cober360 en vez de
        // cortar el webhook — mejor no romper el chat existente por este error.
        console.error('⚠️ Error en circuito de validación del webhook, sigue flujo normal:', validacionError.message);
      }

      // 🌱 Nutrición post-validación: a diferencia del circuito de validación,
      // esto NO corta el flujo — el mensaje sigue su camino normal hacia el chat
      // del vendedor. Solo apaga la nutrición si vino el botón de cierre.
      try {
        const nutricionActiva = await NutricionLeadsService.buscarNutricionActivaPorTelefono(telefono);
        if (nutricionActiva) {
          const payload = (ButtonPayload || ButtonText || Body || '').trim().toLowerCase();
          if (payload === 'ya_contactaron') {
            await NutricionLeadsService.confirmarContactoPorUsuario(nutricionActiva.id);
            console.log(`✅ Nutrición ${nutricionActiva.id} cerrada — usuario confirmó contacto`);
          } else if (payload === 'no_contactaron') {
            await NutricionLeadsService.registrarFaltaDeContacto(nutricionActiva);
            console.log(`⚠️ Nutrición ${nutricionActiva.id} cerrada — usuario reportó falta de contacto`);
          }
        }
      } catch (nutricionError) {
        console.error('⚠️ Error chequeando nutrición del webhook:', nutricionError.message);
      }

      // Permitir mensajes sin Body si tienen archivos multimedia
      if (!Body && (!NumMedia || parseInt(NumMedia) === 0)) {
        console.warn('⚠️ Mensaje vacío sin multimedia, ignorando');
        return res.status(200).send('OK');
      }

      // 🔍 NUEVO: Verificar si el número pertenece a un prospecto registrado
      const prospecto = await ChatService.buscarProspectoPorTelefono(telefono);

      if (!prospecto) {
        // 🆕 Alta en frío: nadie conoce este teléfono. Si el mensaje entró por el
        // número dedicado del validador (no el compartido) y está activo con cupo
        // disponible, se crea un prospecto mínimo y arranca el mismo circuito de
        // validación que si hubiera llegado por el formulario web.
        try {
          const numeroValidador = String(process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR || '').replace(/\D/g, '');
          const esNumeroValidador = numeroValidador && numeroDestino === numeroValidador;

          if (esNumeroValidador) {
            const config = await ValidacionWhatsappService.getConfig();
            if (config.activo) {
              const entraAlCupo = await ValidacionWhatsappService.intentarReservarCupo(config.cupo_diario);
              if (entraAlCupo) {
                const prospectoNuevo = await ValidacionWhatsappService.crearProspectoDesdeWhatsappEntrante(telefono, req.body.ProfileName);
                const textoRespuesta = ButtonPayload || ButtonText || Body || '';
                console.log(`🆕 Prospecto ${prospectoNuevo.id} creado desde WhatsApp entrante (alta en frío) — arrancando validación`);
                await ValidacionWhatsappService.procesarRespuestaValidacion(prospectoNuevo, textoRespuesta);
                return res.status(200).send('OK');
              }
            }
          }
        } catch (altaFriaError) {
          console.error('⚠️ Error en alta en frío desde WhatsApp:', altaFriaError.message);
        }

        console.log('📵 Número no registrado como prospecto:', telefono, '- ignorando mensaje');
        // Responder OK para que Twilio no reintente, pero no procesar el mensaje
        return res.status(200).send('OK');
      }

      console.log('✅ Prospecto encontrado:', {
        id: prospecto.id,
        nombre: `${prospecto.nombre} ${prospecto.apellido}`,
        vendedor_id: prospecto.vendedor_id,
        estado: prospecto.estado
      });

      // 🔄 Obtener o crear conversación única para el prospecto
      const conversacion = await ChatService.obtenerOCrearConversacionProspecto(
        prospecto.id,
        telefono,
        prospecto.vendedor_id,
        'manual',
        null
      );

      console.log('✅ Conversación lista:', {
        id: conversacion.id,
        numero: conversacion.numero_conversacion,
        estado: conversacion.estado,
        es_nueva: conversacion.es_nueva
      });

      // 🆕 PROCESAR ARCHIVO MULTIMEDIA SI EXISTE
      let datosArchivo = null;
      
      if (NumMedia && parseInt(NumMedia) > 0 && MediaUrl0) {
        console.log('📎 Archivo multimedia recibido:', {
          url: MediaUrl0,
          tipo: MediaContentType0,
          cantidad: NumMedia
        });

        try {
          // Descargar y guardar el archivo
          const WhatsAppService = require('../services/whatsappService');
          datosArchivo = await WhatsAppService.descargarArchivoMultimedia(
            MediaUrl0,
            MediaContentType0
          );

          console.log('✅ Archivo descargado y guardado:', datosArchivo);
        } catch (error) {
          console.error('❌ Error procesando archivo multimedia:', error);
          // Continuar procesando el mensaje aunque falle el archivo
        }
      }

      // Registrar mensaje entrante
      await ChatService.registrarMensaje({
        conversacion_id: conversacion.id,
        mensaje: Body || '📎 Archivo multimedia',
        tipo: 'recibido',
        origen: 'cliente',
        twilio_message_sid: MessageSid,
        estado_entrega: 'entregado',
        // 🆕 AGREGAR CAMPOS DE ARCHIVO
        archivo_url: datosArchivo?.archivo_url || null,
        archivo_tipo: datosArchivo?.archivo_tipo || MediaContentType0 || null,
        archivo_nombre: datosArchivo?.archivo_nombre || null,
        archivo_tamaño: datosArchivo?.archivo_tamaño || null,
        metadata: {
          media_url_original: MediaUrl0 || null,
          media_type: MediaContentType0 || null,
          num_media: NumMedia || 0,
          prospecto_id: prospecto.id,
          prospecto_nombre: `${prospecto.nombre} ${prospecto.apellido}`
        }
      });
      
      console.log('✅ Mensaje registrado exitosamente para prospecto:', {
        conversacion_id: conversacion.id,
        prospecto: `${prospecto.nombre} ${prospecto.apellido}`,
        vendedor_id: prospecto.vendedor_id,
        vendedor: prospecto.vendedor_nombre ? `${prospecto.vendedor_nombre} ${prospecto.vendedor_apellido}` : 'Sin asignar'
      });

      // 🔄 Si el prospecto respondió efectivamente por WhatsApp y todavía estaba en una
      // etapa temprana (primer contacto, whatsapp enviado o llamada), subir el estado en asignaciones
      if (Body && prospecto.vendedor_id && ['1º Contacto', 'WhatsApp enviado', 'Llamada telefónica'].includes(prospecto.estado_asignacion)) {
        try {
          const fechaHoraTextoResp = new Date().toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          await db.query(
            `UPDATE asignaciones
             SET estado = 'Conversación iniciada por WhatsApp', comentario = ?, fecha_estado = NOW()
             WHERE id_prospecto = ? AND id_vendedor = ?`,
            [`Respondió por WhatsApp el ${fechaHoraTextoResp}: "${Body.substring(0, 200)}"`, prospecto.id, prospecto.vendedor_id]
          );
          await Historial.registrarAccion(
            prospecto.id,
            prospecto.vendedor_id,
            'whatsapp_conversacion_iniciada',
            `El prospecto respondió por WhatsApp: "${Body.substring(0, 200)}"`
          );
          console.log(`✅ Estado actualizado a 'Conversación iniciada por WhatsApp' para prospecto ${prospecto.id}`);

          // Sincronizar estado en Google Sheets
          try {
            const GoogleSheetsService = require('../services/googleSheetsService');
            await GoogleSheetsService.actualizarAsignacionEnSheet(prospecto.id);
            console.log(`📊 Estado 'Conversación iniciada por WhatsApp' sincronizado en Google Sheets para prospecto ${prospecto.id}`);
          } catch (errSheet) {
            console.error('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
          }
        } catch (errEstado) {
          console.error('❌ Error actualizando estado a conversación iniciada por WhatsApp:', errEstado.message);
        }
      }

      // 🤖 DETECTAR Y RESPONDER AL PRIMER MENSAJE DEL CLIENTE
      // Palabras clave que indican interés en información
      const palabrasClave = ['interesa', 'información', 'planes', 'cotización', 'cober', 'medicina privada', 'afiliación', 'seguros'];
      const mensajeLower = Body ? Body.toLowerCase() : '';
      
      // Verificar si es el primer mensaje y contiene palabras clave de interés
      const contieneInterés = palabrasClave.some(palabra => mensajeLower.includes(palabra));
      const esPrimerMensaje = conversacion.es_nueva || conversacion.estado === 'creada';
      
      if (Body && contieneInterés && esPrimerMensaje) {
        console.log('🤖 Se detectó primer mensaje con interés de información, enviando respuesta automática...');
        console.log('   Conversación nueva:', conversacion.es_nueva);
        console.log('   Estado:', conversacion.estado);
        console.log('   Mensaje:', Body);
        
        try {
          const WhatsAppService = require('../services/whatsappService');
          const resultadoRespuesta = await WhatsAppService.enviarRespuestaAutomatica(telefono);
          
          if (resultadoRespuesta.success) {
            console.log('✅ Respuesta automática enviada al cliente:', {
              telefono: telefono,
              message_sid: resultadoRespuesta.sid,
              template_sid: resultadoRespuesta.template_sid
            });
            
            // Registrar la respuesta automática en la base de datos
            await ChatService.registrarMensaje({
              conversacion_id: conversacion.id,
              mensaje: '¡Hola! Hemos recibido tu mensaje. A la brevedad un asesor se comunicará con vos. Gracias',
              tipo: 'enviado',
              origen: 'sistema',
              twilio_message_sid: resultadoRespuesta.sid,
              estado_entrega: 'entregado',
              metadata: {
                tipo_respuesta: 'automatica',
                template_sid: resultadoRespuesta.template_sid,
                disparado_por: 'primer_mensaje_cliente',
                mensaje_original: Body
              }
            });
            
            console.log('✅ Respuesta automática registrada en la base de datos');
          }
        } catch (error) {
          console.error('❌ Error enviando respuesta automática:', error.message);
          // No interrumpir el flujo si la respuesta automática falla
        }
      } else {
        console.log('ℹ️ No se envía respuesta automática:');
        console.log('   - Tiene Body:', !!Body);
        console.log('   - Contiene interés:', contieneInterés);
        console.log('   - Es primer mensaje:', esPrimerMensaje);
      }

      // 🔔 ENVIAR NOTIFICACIÓN PUSH AL VENDEDOR (solo si tiene vendedor asignado)
      if (prospecto.vendedor_id) {
        try {
          console.log(`🔔 Intentando enviar notificación push al vendedor ${prospecto.vendedor_id}`);
          const NotificationsService = require('../services/notificationsService');
          const previewMensaje = Body ? Body.substring(0, 50) : '📎 Archivo multimedia';
          
          console.log(`📋 Datos de notificación:`, {
            vendedor_id: prospecto.vendedor_id,
            prospecto_nombre: `${prospecto.nombre} ${prospecto.apellido}`,
            preview: previewMensaje,
            conversacion_id: conversacion.id
          });
          
          await NotificationsService.notificarMensajeWhatsApp(
            prospecto.vendedor_id,
            `${prospecto.nombre} ${prospecto.apellido}`,
            previewMensaje,
            conversacion.id
          );
          console.log(`✅ Notificación de WhatsApp enviada al vendedor ${prospecto.vendedor_id}`);
        } catch (notificationError) {
          console.error('❌ Error enviando notificación push:', notificationError.message);
          console.error('❌ Stack:', notificationError.stack);
        }
      } else {
        console.log('ℹ️ Prospecto sin vendedor asignado - notificación no enviada');
      }

      res.status(200).send('OK');

    } catch (error) {
      console.error('❌ Error procesando webhook WhatsApp:', error);
      res.status(500).send('Error interno');
    }
  },

  // Recibir actualizaciones de estado de mensajes
  async actualizarEstado(req, res) {
    try {
      console.log('📊 Actualización de estado:', JSON.stringify(req.body, null, 2));

      const { MessageSid, MessageStatus, SmsStatus } = req.body;
      const estado = MessageStatus || SmsStatus;

      if (MessageSid && estado) {
        await ChatService.actualizarEstadoMensaje(MessageSid, estado);
        console.log('✅ Estado actualizado:', MessageSid, '->', estado);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error actualizando estado:', error);
      res.status(500).send('Error interno');
    }
  }
};

module.exports = WhatsAppWebhookController;
