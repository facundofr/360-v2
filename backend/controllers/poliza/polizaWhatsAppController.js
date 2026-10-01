const PolizaModel = require('../../models/poliza/polizaModel');
const WhatsAppService = require('../../services/whatsappService');
const EmailService = require('../../services/emailService');
const ChatService = require('../../services/chatService');

const PolizaWhatsAppController = {
  // Enviar póliza por WhatsApp
  async enviar(req, res) {
    try {
      const { id } = req.params;
      const { telefono, mensaje_personalizado } = req.body;

      console.log('📱 Enviando póliza por WhatsApp:', { id, telefono });

      // Obtener póliza completa
      const poliza = await PolizaModel.obtenerCompleta(id);
      
      if (!poliza) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // Validar teléfono
      if (!telefono) {
        return res.status(400).json({
          error: 'Teléfono requerido',
          message: 'Debe proporcionar un número de teléfono'
        });
      }

      // Formatear número de teléfono (quitar espacios, guiones, etc.)
      const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
      
      // Asegurar que tenga código de país (Argentina +54)
      const telefonoCompleto = telefonoLimpio.startsWith('54') 
        ? telefonoLimpio 
        : `54${telefonoLimpio.startsWith('9') ? telefonoLimpio : '9' + telefonoLimpio}`;

      // Parsear datos personales para el mensaje
      let datosPersonales = {};
      try {
        datosPersonales = typeof poliza.datos_personales === 'string' 
          ? JSON.parse(poliza.datos_personales) 
          : (poliza.datos_personales || {});
      } catch (parseError) {
        console.log('Error parseando datos personales:', parseError);
      }

      // Crear datos para el template de póliza
      const nombreCliente = datosPersonales.nombre || poliza.prospecto_nombre || 'Cliente';
      const apellidoCliente = datosPersonales.apellido || poliza.prospecto_apellido || '';
      const nombreCompleto = `${nombreCliente} ${apellidoCliente}`.trim();

      const datosPoliza = {
        nombreCliente: nombreCompleto,
        numeroPoliza: poliza.numero_poliza_oficial || poliza.numero_poliza,
        nombrePlan: poliza.plan_nombre || 'Sin especificar',
        totalMensual: poliza.total_final || 0,
        linkDescarga: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/pdf/${poliza.pdf_hash}`
      };

      console.log('📋 Datos para template de póliza:', datosPoliza);

      // Enviar por WhatsApp usando template aprobado
      const resultadoWhatsApp = await WhatsAppService.enviarPoliza(telefonoCompleto, datosPoliza);

      if (resultadoWhatsApp.success) {
        // 🆕 CREAR/ACTUALIZAR CONVERSACIÓN DE CHAT
        try {
          const conversacion = await ChatService.crearConversacion({
            telefono: telefonoCompleto,
            vendedor_id: req.user?.id || 1, // TODO: Obtener del token/sesión
            prospecto_id: poliza.prospecto_id || null,
            poliza_id: poliza.id,
            tipo_origen: 'poliza',
            twilio_message_sid: resultadoWhatsApp.message_id
          });

          // Formatear valor monetario
          const formatearMoneda = (valor) => {
            return new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS',
              minimumFractionDigits: 2
            }).format(valor);
          };

          // Crear el mensaje completo tal como lo recibe el prospecto
          const mensajeCompleto = `COBER - Tu póliza está lista

Hola ${datosPoliza.nombreCliente}, ¡tu póliza ya está disponible!

📋 Número de póliza: ${datosPoliza.numeroPoliza}
🏥 Plan contratado: ${datosPoliza.nombrePlan}
💰 Total mensual: ${formatearMoneda(datosPoliza.totalMensual)}

📄 Descarga tu póliza aquí:
${datosPoliza.linkDescarga}

¡Gracias por confiar en COBER para tu salud y la de tu familia!

Para cualquier consulta, responde a este mensaje.`;

          // Registrar mensaje completo del template en el chat
          await ChatService.registrarMensaje({
            conversacion_id: conversacion.id,
            mensaje: mensajeCompleto,
            tipo: 'enviado',
            origen: 'vendedor',
            twilio_message_sid: resultadoWhatsApp.message_id,
            estado_entrega: 'enviado',
            metadata: {
              tipo_envio: 'poliza_template',
              poliza_numero: poliza.numero_poliza,
              template_used: resultadoWhatsApp.template_used
            }
          });

          console.log('✅ Conversación de chat creada/actualizada:', conversacion.numero_conversacion);
        } catch (chatError) {
          console.warn('⚠️ Error creando conversación de chat (no crítico):', chatError.message);
        }

        // Registrar el envío en la base de datos (método existente)
        await PolizaWhatsAppController.registrarEnvio({
          poliza_id: poliza.id,
          telefono: telefonoCompleto,
          tipo: 'whatsapp',
          estado: 'enviado',
          mensaje: `Template de póliza enviado - SID: ${resultadoWhatsApp.template_used}`,
          response_id: resultadoWhatsApp.message_id || null
        });

        res.json({
          success: true,
          message: 'Póliza enviada por WhatsApp usando template aprobado',
          data: {
            telefono: telefonoCompleto,
            message_id: resultadoWhatsApp.message_id,
            poliza_numero: poliza.numero_poliza,
            template_used: resultadoWhatsApp.template_used,
            recipient: resultadoWhatsApp.recipient
          }
        });
      } else {
        throw new Error(resultadoWhatsApp.error || 'Error enviando WhatsApp');
      }

    } catch (error) {
      console.error('❌ Error enviando póliza por WhatsApp:', error);
      
      // Registrar el error
      if (req.params.id) {
        await PolizaWhatsAppController.registrarEnvio({
          poliza_id: req.params.id,
          telefono: req.body.telefono || 'N/A',
          tipo: 'whatsapp',
          estado: 'error',
          mensaje: 'Error enviando template de póliza',
          error_message: error.message
        });
      }

      res.status(500).json({ 
        error: 'Error enviando póliza por WhatsApp',
        message: error.message 
      });
    }
  },

  // Enviar póliza por Email
  async enviarEmail(req, res) {
    try {
      const { id } = req.params;
      const { email, asunto_personalizado, mensaje_personalizado } = req.body;

      console.log('📧 Enviando póliza por Email:', { id, email });

      // Obtener póliza completa
      const poliza = await PolizaModel.obtenerCompleta(id);
      
      if (!poliza) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // Validar email
      if (!email) {
        return res.status(400).json({
          error: 'Email requerido',
          message: 'Debe proporcionar una dirección de email'
        });
      }

      // Parsear datos personales
      let datosPersonales = {};
      try {
        datosPersonales = typeof poliza.datos_personales === 'string' 
          ? JSON.parse(poliza.datos_personales) 
          : (poliza.datos_personales || {});
      } catch (parseError) {
        console.log('Error parseando datos personales:', parseError);
      }

      const nombreCliente = datosPersonales.nombre || poliza.prospecto_nombre || 'Cliente';
      const apellidoCliente = datosPersonales.apellido || poliza.prospecto_apellido || '';
      const nombreCompleto = `${nombreCliente} ${apellidoCliente}`.trim();

      // Crear asunto y mensaje
      const asunto = asunto_personalizado || 
        `Tu póliza COBER #${poliza.numero_poliza} - ${nombreCompleto}`;

      const mensaje = mensaje_personalizado ||
        `Estimado/a ${nombreCompleto},\n\n` +
        `Nos complace enviarte tu póliza de COBER con los siguientes detalles:\n\n` +
        `• Número de póliza: ${poliza.numero_poliza}\n` +
        `• Plan contratado: ${poliza.plan_nombre || 'Sin especificar'}\n` +
        `• Total mensual: $${poliza.total_final ? parseFloat(poliza.total_final).toLocaleString('es-AR') : '0'}\n\n` +
        `Puedes descargar tu póliza en PDF desde el siguiente enlace:\n` +
        `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/pdf/${poliza.pdf_hash}\n\n` +
        `¡Gracias por confiar en COBER para tu salud y la de tu familia!\n\n` +
        `Saludos cordiales,\n` +
        `Equipo COBER`;

      // Enviar email usando el servicio
      const resultadoEmail = await EmailService.enviarEmail({
        to: email,
        subject: asunto,
        text: mensaje,
        html: mensaje.replace(/\n/g, '<br>'),
        attachments: [
          {
            filename: `Poliza-${poliza.numero_poliza}.pdf`,
            path: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/pdf/${poliza.pdf_hash}`,
            contentType: 'application/pdf'
          }
        ]
      });

      if (resultadoEmail.success) {
        // Registrar el envío
        await PolizaWhatsAppController.registrarEnvio({
          poliza_id: poliza.id,
          email: email,
          tipo: 'email',
          estado: 'enviado',
          asunto: asunto,
          mensaje: mensaje,
          message_id: resultadoEmail.message_id || null
        });

        res.json({
          success: true,
          message: 'Póliza enviada por email exitosamente',
          data: {
            email: email,
            message_id: resultadoEmail.message_id,
            poliza_numero: poliza.numero_poliza
          }
        });
      } else {
        throw new Error(resultadoEmail.error || 'Error enviando email');
      }

    } catch (error) {
      console.error('❌ Error enviando póliza por email:', error);
      
      // Registrar el error
      if (req.params.id) {
        await PolizaWhatsAppController.registrarEnvio({
          poliza_id: req.params.id,
          email: req.body.email || 'N/A',
          tipo: 'email',
          estado: 'error',
          asunto: req.body.asunto_personalizado || 'Asunto por defecto',
          mensaje: req.body.mensaje_personalizado || 'Mensaje por defecto',
          error_message: error.message
        });
      }

      res.status(500).json({ 
        error: 'Error enviando póliza por email',
        message: error.message 
      });
    }
  },

  // Obtener historial de envíos de una póliza
  async obtenerHistorialEnvios(req, res) {
    try {
      const { id } = req.params;

      const historial = await this.obtenerEnviosPoliza(id);

      res.json({
        success: true,
        data: historial
      });

    } catch (error) {
      console.error('Error obteniendo historial de envíos:', error);
      res.status(500).json({ 
        error: 'Error obteniendo historial',
        message: error.message 
      });
    }
  },

  // Reenviar póliza (WhatsApp o Email)
  async reenviar(req, res) {
    try {
      const { id } = req.params;
      const { tipo, telefono, email, mensaje_personalizado } = req.body;

      if (tipo === 'whatsapp') {
        return await this.enviar(req, res);
      } else if (tipo === 'email') {
        return await this.enviarEmail(req, res);
      } else {
        return res.status(400).json({
          error: 'Tipo inválido',
          message: 'El tipo debe ser "whatsapp" o "email"'
        });
      }

    } catch (error) {
      console.error('Error reenviando póliza:', error);
      res.status(500).json({ 
        error: 'Error reenviando póliza',
        message: error.message 
      });
    }
  },

  // Métodos auxiliares
  async registrarEnvio(datos) {
    try {
      const query = `
        INSERT INTO poliza_envios 
        (poliza_id, telefono, email, tipo, estado, asunto, mensaje, message_id, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await require('../../config/db').execute(query, [
        datos.poliza_id,
        datos.telefono || null,
        datos.email || null,
        datos.tipo,
        datos.estado,
        datos.asunto || null,
        datos.mensaje,
        datos.message_id || null,
        datos.error_message || null
      ]);

      console.log('✅ Envío registrado en base de datos');
    } catch (error) {
      console.error('❌ Error registrando envío:', error);
    }
  },

  async obtenerEnviosPoliza(poliza_id) {
    try {
      const query = `
        SELECT 
          id,
          telefono,
          email,
          tipo,
          estado,
          asunto,
          mensaje,
          message_id,
          error_message,
          created_at
        FROM poliza_envios 
        WHERE poliza_id = ?
        ORDER BY created_at DESC
      `;

      const [rows] = await require('../../config/db').execute(query, [poliza_id]);
      return rows;
    } catch (error) {
      console.error('Error obteniendo envíos:', error);
      return [];
    }
  }
};

module.exports = PolizaWhatsAppController;