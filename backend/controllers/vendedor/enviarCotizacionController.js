const WhatsAppService = require('../../services/whatsappService');
const ChatService = require('../../services/chatService');
const db = require('../../config/db');

const CotizacionController = {
  // Enviar cotización por WhatsApp
  async enviarPorWhatsApp(req, res) {
    try {
      // Verificar si el servicio está disponible
      if (!WhatsAppService.isServiceAvailable()) {
        return res.status(503).json({ 
          error: 'Servicio de WhatsApp no disponible',
          message: 'El servicio de WhatsApp no está configurado correctamente'
        });
      }

      const { 
        telefono, 
        cotizacion, 
        prospecto 
      } = req.body;

      if (!telefono) {
        return res.status(400).json({ 
          error: 'Número de teléfono requerido' 
        });
      }

      if (!cotizacion) {
        return res.status(400).json({ 
          error: 'Datos de cotización requeridos' 
        });
      }

      // Validar formato básico del teléfono
      const telefonoLimpio = telefono.replace(/[\s\-\(\)]/g, '');
      if (telefonoLimpio.length < 10) {
        return res.status(400).json({ 
          error: 'Número de teléfono inválido' 
        });
      }

      // Preparar datos para el template de cotización
      const grupoFamiliar = cotizacion.detalles && cotizacion.detalles.length > 0 
        ? `${cotizacion.detalles.length} personas`
        : "1 persona";

      const datosCotizacion = {
        nombreCliente: `${prospecto?.nombre || ''} ${prospecto?.apellido || ''}`.trim() || 'Cliente',
        nombrePlan: cotizacion.plan_nombre || 'Plan seleccionado',
        grupoFamiliar: grupoFamiliar,
        tipoAfiliacion: cotizacion.tipo_afiliacion_nombre || 'Particular',
        totalBruto: cotizacion.total_bruto || 0,
        descuentoAporte: cotizacion.total_descuento_aporte || 0,
        descuentoPromocion: cotizacion.total_descuento_promocion || 0,
        totalFinal: cotizacion.total_final || 0
      };

      console.log('📋 Datos para template de cotización:', datosCotizacion);

      // Enviar por WhatsApp usando template aprobado
      const resultado = await WhatsAppService.enviarCotizacion(telefonoLimpio, datosCotizacion);

      // 🆕 CREAR/ACTUALIZAR CONVERSACIÓN DE CHAT
      try {
        const conversacion = await ChatService.crearConversacion({
          telefono: telefonoLimpio,
          vendedor_id: req.user?.id || 1, // TODO: Obtener del token/sesión
          prospecto_id: prospecto?.id || null,
          poliza_id: null,
          tipo_origen: 'cotizacion',
          twilio_message_sid: resultado.message_id
        });

        // Formatear valores monetarios
        const formatearMoneda = (valor) => {
          return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
          }).format(valor);
        };

        // Crear el mensaje completo tal como lo recibe el prospecto
        const mensajeCompleto = `COBER - Cotización de Plan

Hola ${datosCotizacion.nombreCliente}, te compartimos los detalles de tu cotización:

📋 Plan: ${datosCotizacion.nombrePlan}
👥 Grupo Familiar: ${datosCotizacion.grupoFamiliar}
📊 Tipo de Afiliación: ${datosCotizacion.tipoAfiliacion}

💰 Detalle de precios:
* Total Bruto: ${formatearMoneda(datosCotizacion.totalBruto)}
* Descuento Aporte: ${formatearMoneda(datosCotizacion.descuentoAporte)}
* Descuento Promoción: ${formatearMoneda(datosCotizacion.descuentoPromocion)}

✅ TOTAL FINAL: ${formatearMoneda(datosCotizacion.totalFinal)}

📞 Para más información o para avanzar con la contratación, podés responder a este mensaje.`;

        // Registrar mensaje completo del template en el chat
        await ChatService.registrarMensaje({
          conversacion_id: conversacion.id,
          mensaje: mensajeCompleto,
          tipo: 'enviado',
          origen: 'vendedor',
          twilio_message_sid: resultado.message_id,
          estado_entrega: 'enviado',
          metadata: {
            tipo_envio: 'cotizacion_template',
            plan_nombre: datosCotizacion.nombrePlan,
            total_final: datosCotizacion.totalFinal,
            template_used: resultado.template_used
          }
        });

        console.log('✅ Conversación de chat creada/actualizada:', conversacion.numero_conversacion);
      } catch (chatError) {
        console.warn('⚠️ Error creando conversación de chat (no crítico):', chatError.message);
      }

      // 🔄 Actualizar estado en asignaciones a 'Calificado Cotización'
      try {
        const vendedorId = req.user?.id;
        if (prospecto?.id && vendedorId) {
          const fechaHoraTextoCotizacion = new Date().toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          await db.query(
            `UPDATE asignaciones SET estado = 'Calificado Cotización', comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
            [`Cotización de "${datosCotizacion.nombrePlan}" enviada por WhatsApp el ${fechaHoraTextoCotizacion}`, prospecto.id, vendedorId]
          );
          console.log(`✅ Estado actualizado a 'Calificado Cotización' para prospecto ${prospecto.id}`);
          // Sincronizar estado en Google Sheets
          try {
            const GoogleSheetsService = require('../../services/googleSheetsService');
            await GoogleSheetsService.actualizarAsignacionEnSheet(prospecto.id);
            console.log(`📊 Estado 'Calificado Cotización' sincronizado en Google Sheets para prospecto ${prospecto.id}`);
          } catch (errSheet) {
            console.warn('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
          }
        }
      } catch (estadoError) {
        console.warn('⚠️ Error actualizando estado a Calificado Cotización:', estadoError.message);
      }

      res.json({
        success: true,
        message: 'Cotización enviada por WhatsApp usando template aprobado',
        sid: resultado.sid,
        template_used: resultado.template_used,
        recipient: resultado.recipient
      });

    } catch (error) {
      console.error('Error enviando cotización por WhatsApp:', error);
      
      // Manejar errores específicos
      let mensajeError = 'Error enviando por WhatsApp';
      if (error.message.includes('inválido')) {
        mensajeError = 'Número de teléfono inválido';
      } else if (error.message.includes('no válido')) {
        mensajeError = 'El número no tiene WhatsApp habilitado';
      } else if (error.message.includes('no configurado')) {
        mensajeError = 'Servicio de WhatsApp no disponible temporalmente';
      } else if (error.message.includes('Template')) {
        mensajeError = 'Template de WhatsApp no disponible';
      } else if (error.message.includes('incompletos')) {
        mensajeError = 'Datos de cotización incompletos';
      }
      
      res.status(500).json({ 
        error: mensajeError,
        message: error.message 
      });
    }
  }
};

module.exports = CotizacionController;