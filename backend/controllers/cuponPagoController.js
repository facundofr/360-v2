const mercadoPagoService = require('../services/mercadoPagoService');
const whatsappService = require('../services/whatsappService');
const db = require('../config/db');

class CuponPagoController {
  
  /**
   * Generar cupón de pago para una cotización
   */
  async generarCuponPago(req, res) {
    try {
      const { cotizacion_id } = req.params;
      const { 
        telefono, 
        vencimiento_dias = 7,
        descripcion_adicional = '',
        metodos_pago = ['credit_card', 'debit_card', 'account_money', 'ticket'],
        enviar_whatsapp = true 
      } = req.body;

      console.log(`🎯 Generando cupón de pago para cotización ${cotizacion_id}`);

      // Verificar que MercadoPago esté configurado
      if (!mercadoPagoService.isServiceAvailable()) {
        return res.status(503).json({
          success: false,
          message: 'Servicio de pagos no disponible en este momento'
        });
      }

      // 1. Obtener datos de la cotización con detalles
      const [cotizacionRows] = await db.execute(`
        SELECT 
          c.*,
          p.nombre, p.apellido, p.correo, p.numero_contacto, p.localidad,
          pl.nombre as plan_nombre
        FROM cotizaciones c
        JOIN prospectos p ON c.prospecto_id = p.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE c.id = ?
      `, [cotizacion_id]);

      if (cotizacionRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cotización no encontrada'
        });
      }

      const cotizacion = cotizacionRows[0];

      // 2. Obtener detalles de la cotización
      const [detallesRows] = await db.execute(`
        SELECT * FROM cotizaciones_detalles 
        WHERE cotizacion_id = ?
        ORDER BY id
      `, [cotizacion_id]);

      // Agregar detalles a la cotización
      cotizacion.detalles = detallesRows;

      // 3. Preparar datos del prospecto
      const prospecto = {
        id: cotizacion.prospecto_id,
        nombre: cotizacion.nombre,
        apellido: cotizacion.apellido,
        correo: cotizacion.correo,
        numero_contacto: cotizacion.numero_contacto,
        localidad: cotizacion.localidad
      };

      // 4. Verificar si ya existe un cupón de pago activo para esta cotización
      const [cuponesExistentes] = await db.execute(`
        SELECT * FROM cupones_pago 
        WHERE cotizacion_id = ? AND estado IN ('pendiente', 'activo')
        ORDER BY fecha_creacion DESC
        LIMIT 1
      `, [cotizacion_id]);

      let cuponExistente = null;
      if (cuponesExistentes.length > 0) {
        cuponExistente = cuponesExistentes[0];
        
        // Verificar si aún está vigente
        const fechaVencimiento = new Date(cuponExistente.fecha_vencimiento);
        const ahora = new Date();
        
        if (fechaVencimiento > ahora) {
          console.log('📋 Ya existe un cupón de pago vigente, usando existente');
          
          // Si se solicita enviar por WhatsApp, reenviarlo
          if (enviar_whatsapp && telefono) {
            const mensajeFormateado = mercadoPagoService.formatearUrlParaCompartir(
              cuponExistente.checkout_url, 
              cotizacion, 
              prospecto
            );

            try {
              await whatsappService.enviarMensaje(telefono, mensajeFormateado.mensaje);
              
              // Actualizar registro de envío
              await db.execute(`
                UPDATE cupones_pago 
                SET ultimo_envio_whatsapp = NOW(), contador_envios = contador_envios + 1
                WHERE id = ?
              `, [cuponExistente.id]);

              console.log('✅ Cupón de pago reenviado por WhatsApp');
            } catch (whatsappError) {
              console.error('❌ Error reenviando cupón por WhatsApp:', whatsappError);
            }
          }

          return res.json({
            success: true,
            message: 'Cupón de pago existente reutilizado',
            data: {
              cupon_id: cuponExistente.id,
              preferencia_id: cuponExistente.preferencia_id,
              checkout_url: cuponExistente.checkout_url,
              fecha_vencimiento: cuponExistente.fecha_vencimiento,
              total: cuponExistente.total,
              whatsapp_enviado: enviar_whatsapp && telefono,
              reutilizado: true
            }
          });
        }
      }

      // 5. Crear nueva preferencia de pago
      const configuracion = {
        vencimiento_dias,
        descripcion_adicional,
        metodos_pago_permitidos: metodos_pago,
        incluir_datos_personales: true
      };

      const preferenciaResult = await mercadoPagoService.crearPreferenciaPago(
        cotizacion, 
        prospecto, 
        configuracion
      );

      // 6. Guardar cupón en base de datos
      const fechaVencimientoMySQL = new Date(preferenciaResult.fecha_vencimiento).toISOString().slice(0, 19).replace('T', ' ');
      
      const [insertResult] = await db.execute(`
        INSERT INTO cupones_pago (
          cotizacion_id, prospecto_id, preferencia_id, checkout_url, 
          external_reference, total, fecha_vencimiento, estado, 
          metadatos, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', ?, NOW())
      `, [
        cotizacion_id,
        prospecto.id,
        preferenciaResult.preferencia_id,
        preferenciaResult.checkout_url,
        preferenciaResult.external_reference,
        preferenciaResult.total,
        fechaVencimientoMySQL,
        JSON.stringify(preferenciaResult.metadatos)
      ]);

      const cuponId = insertResult.insertId;

      // 7. Enviar por WhatsApp si se solicita
      let whatsappEnviado = false;
      if (enviar_whatsapp && telefono) {
        try {
          const mensajeFormateado = mercadoPagoService.formatearUrlParaCompartir(
            preferenciaResult.checkout_url, 
            cotizacion, 
            prospecto
          );

          await whatsappService.enviarMensaje(telefono, mensajeFormateado.mensaje);
          
          // Actualizar registro con envío exitoso
          await db.execute(`
            UPDATE cupones_pago 
            SET primer_envio_whatsapp = NOW(), ultimo_envio_whatsapp = NOW(), contador_envios = 1
            WHERE id = ?
          `, [cuponId]);

          whatsappEnviado = true;
          console.log('✅ Cupón de pago enviado por WhatsApp exitosamente');
        } catch (whatsappError) {
          console.error('❌ Error enviando cupón por WhatsApp:', whatsappError);
          // No fallar la operación completa por error de WhatsApp
        }
      }

      console.log('✅ Cupón de pago generado exitosamente:', preferenciaResult.preferencia_id);

      res.json({
        success: true,
        message: 'Cupón de pago generado exitosamente',
        data: {
          cupon_id: cuponId,
          preferencia_id: preferenciaResult.preferencia_id,
          checkout_url: preferenciaResult.checkout_url,
          fecha_vencimiento: preferenciaResult.fecha_vencimiento,
          total: preferenciaResult.total,
          external_reference: preferenciaResult.external_reference,
          whatsapp_enviado: whatsappEnviado,
          reutilizado: false
        }
      });

    } catch (error) {
      console.error('❌ Error en generarCuponPago:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Reenviar cupón de pago por WhatsApp
   */
  async reenviarCuponWhatsApp(req, res) {
    try {
      const { cupon_id } = req.params;
      const { telefono } = req.body;

      if (!telefono) {
        return res.status(400).json({
          success: false,
          message: 'Número de teléfono es requerido'
        });
      }

      // Obtener datos del cupón
      const [cuponRows] = await db.execute(`
        SELECT cp.*, c.*, p.nombre, p.apellido, pl.nombre as plan_nombre
        FROM cupones_pago cp
        JOIN cotizaciones c ON cp.cotizacion_id = c.id
        JOIN prospectos p ON cp.prospecto_id = p.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE cp.id = ?
      `, [cupon_id]);

      if (cuponRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cupón de pago no encontrado'
        });
      }

      const cupon = cuponRows[0];

      // Verificar que el cupón esté activo
      if (cupon.estado !== 'activo') {
        return res.status(400).json({
          success: false,
          message: 'El cupón de pago no está activo'
        });
      }

      // Verificar vigencia
      const fechaVencimiento = new Date(cupon.fecha_vencimiento);
      const ahora = new Date();

      if (fechaVencimiento <= ahora) {
        return res.status(400).json({
          success: false,
          message: 'El cupón de pago ha expirado'
        });
      }

      // Preparar datos para el mensaje
      const cotizacion = { 
        plan_nombre: cupon.plan_nombre, 
        total_final: cupon.total 
      };
      const prospecto = { 
        nombre: cupon.nombre, 
        apellido: cupon.apellido 
      };

      // Formatear y enviar mensaje
      const mensajeFormateado = mercadoPagoService.formatearUrlParaCompartir(
        cupon.checkout_url, 
        cotizacion, 
        prospecto
      );

      await whatsappService.enviarMensaje(telefono, mensajeFormateado.mensaje);

      // Actualizar contador de envíos
      await db.execute(`
        UPDATE cupones_pago 
        SET ultimo_envio_whatsapp = NOW(), contador_envios = contador_envios + 1
        WHERE id = ?
      `, [cupon_id]);

      res.json({
        success: true,
        message: 'Cupón de pago reenviado por WhatsApp exitosamente'
      });

    } catch (error) {
      console.error('❌ Error en reenviarCuponWhatsApp:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error enviando cupón por WhatsApp'
      });
    }
  }

  /**
   * Obtener historial de cupones de pago de un prospecto
   */
  async obtenerCuponesPorProspecto(req, res) {
    try {
      const { prospecto_id } = req.params;

      const [cupones] = await db.execute(`
        SELECT 
          cp.*,
          c.plan_id,
          pl.nombre as plan_nombre,
          c.total_final as cotizacion_total
        FROM cupones_pago cp
        JOIN cotizaciones c ON cp.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE cp.prospecto_id = ?
        ORDER BY cp.fecha_creacion DESC
      `, [prospecto_id]);

      res.json({
        success: true,
        data: cupones
      });

    } catch (error) {
      console.error('❌ Error obteniendo cupones:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo historial de cupones'
      });
    }
  }

  /**
   * Webhook para recibir notificaciones de MercadoPago
   */
  async webhookMercadoPago(req, res) {
    try {
      console.log('🔔 Webhook MercadoPago recibido:', req.body);

      const { type, data } = req.body;

      if (type === 'payment') {
        const paymentId = data.id;
        
        // Obtener información del pago
        const pagoInfo = await mercadoPagoService.obtenerPago(paymentId);
        const externalReference = pagoInfo.external_reference;

        if (externalReference) {
          // Actualizar estado del cupón según el estado del pago
          let nuevoEstado = 'pendiente';
          
          switch (pagoInfo.status) {
            case 'approved':
              nuevoEstado = 'pagado';
              break;
            case 'rejected':
              nuevoEstado = 'rechazado';
              break;
            case 'cancelled':
              nuevoEstado = 'cancelado';
              break;
            case 'pending':
            case 'in_process':
              nuevoEstado = 'pendiente';
              break;
          }

          // Actualizar cupón en base de datos
          await db.execute(`
            UPDATE cupones_pago 
            SET estado = ?, payment_id = ?, estado_pago = ?, fecha_pago = ?
            WHERE external_reference = ?
          `, [
            nuevoEstado,
            paymentId,
            pagoInfo.status,
            nuevoEstado === 'pagado' ? new Date() : null,
            externalReference
          ]);

          console.log(`✅ Cupón actualizado: ${externalReference} -> ${nuevoEstado}`);
        }
      }

      // Siempre responder 200 para confirmar recepción
      res.status(200).json({ received: true });

    } catch (error) {
      console.error('❌ Error en webhook MercadoPago:', error);
      res.status(200).json({ received: true, error: true });
    }
  }
}

module.exports = new CuponPagoController();
