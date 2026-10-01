const axios = require('axios');

class MercadoPagoService {
  constructor() {
    this.accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    this.baseUrl = process.env.MERCADOPAGO_BASE_URL || 'https://api.mercadopago.com';
    this.webhookUrl = process.env.MERCADOPAGO_WEBHOOK_URL;
    
    // Validar configuración
    if (!this.accessToken) {
      console.warn('⚠️  Access Token de MercadoPago no configurado. El servicio de pagos no estará disponible.');
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    console.log('✅ Servicio de MercadoPago configurado correctamente');
  }

  /**
   * Crear preferencia de pago para una cotización
   */
  async crearPreferenciaPago(cotizacion, prospecto, configuracion = {}) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de MercadoPago no configurado correctamente');
      }

      if (!cotizacion || !prospecto) {
        throw new Error('Cotización y prospecto son requeridos');
      }

      // Configuración por defecto
      const config = {
        vencimiento_dias: 7, // 7 días por defecto
        descripcion_adicional: '',
        incluir_datos_personales: true,
        metodos_pago_permitidos: ['credit_card', 'debit_card', 'account_money', 'ticket'],
        ...configuracion
      };

      // Preparar items de la cotización
      const items = [];
      
      if (cotizacion.detalles && cotizacion.detalles.length > 0) {
        // Si tiene detalles, agregar cada persona por separado
        cotizacion.detalles.forEach((detalle, index) => {
          items.push({
            id: `cotizacion_${cotizacion.id}_detalle_${index}`,
            title: `${cotizacion.plan_nombre} - ${detalle.persona || detalle.vinculo}`,
            description: `Cobertura médica ${cotizacion.plan_nombre} para ${detalle.persona || detalle.vinculo} (${detalle.vinculo})`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: parseFloat(detalle.precio_final || 0)
          });
        });
      } else {
        // Fallback: crear un item para toda la cotización
        items.push({
          id: `cotizacion_${cotizacion.id}`,
          title: `${cotizacion.plan_nombre} - Cobertura Familiar`,
          description: `Cobertura médica ${cotizacion.plan_nombre} ${config.descripcion_adicional}`.trim(),
          quantity: 1,
          currency_id: 'ARS',
          unit_price: parseFloat(cotizacion.total_final || 0)
        });
      }

      // Calcular fecha de vencimiento
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + config.vencimiento_dias);

      // Datos del pagador simplificados (solo si hay email válido)
      const payer = (prospecto.correo && prospecto.correo !== 'sin-email@cober360.com') ? {
        name: prospecto.nombre,
        surname: prospecto.apellido,
        email: prospecto.correo
      } : undefined;

      // Configurar métodos de pago simplificado
      const payment_methods = {
        installments: 12 // Máximo 12 cuotas
      };

      // Si se especifican métodos permitidos, excluir los demás
      if (config.metodos_pago_permitidos && config.metodos_pago_permitidos.length > 0) {
        const todosTipos = ['credit_card', 'debit_card', 'ticket', 'bank_transfer', 'account_money'];
        const excluidos = todosTipos.filter(tipo => !config.metodos_pago_permitidos.includes(tipo));
        payment_methods.excluded_payment_types = excluidos.map(tipo => ({ id: tipo }));
      }

      // Estructura de la preferencia simplificada
      const preference = {
        items: items,
        back_urls: {
          success: `https://wspflows.cober.online/`,
          failure: `https://wspflows.cober.online/`,
          pending: `https://wspflows.cober.online/`
        },
        auto_return: 'approved',
        external_reference: `cotizacion_${cotizacion.id}_prospecto_${prospecto.id}`,
        expires: true,
        expiration_date_to: fechaVencimiento.toISOString(),
        statement_descriptor: 'COBER360',
        metadata: {
          cotizacion_id: cotizacion.id,
          prospecto_id: prospecto.id,
          plan_nombre: cotizacion.plan_nombre || 'Plan Salud',
          fecha_creacion: new Date().toISOString()
        }
      };

      // Agregar payer solo si existe
      if (payer) {
        preference.payer = payer;
      }

      // Agregar payment_methods solo si hay restricciones
      if (payment_methods.excluded_payment_types && payment_methods.excluded_payment_types.length > 0) {
        preference.payment_methods = payment_methods;
      }

      // Agregar notification_url solo si está configurada
      if (this.webhookUrl) {
        preference.notification_url = this.webhookUrl;
      }

      console.log('📤 Creando preferencia de pago en MercadoPago:', {
        external_reference: preference.external_reference,
        total: items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
        items_count: items.length
      });

      // Llamada a la API de MercadoPago
      const response = await axios.post(
        `${this.baseUrl}/checkout/preferences`,
        preference,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `cotizacion_${cotizacion.id}_${Date.now()}`
          }
        }
      );

      const preferenciaCreada = response.data;

      console.log('✅ Preferencia de pago creada exitosamente:', {
        id: preferenciaCreada.id,
        init_point: preferenciaCreada.init_point
      });

      return {
        success: true,
        preferencia_id: preferenciaCreada.id,
        checkout_url: preferenciaCreada.init_point,
        sandbox_url: preferenciaCreada.sandbox_init_point,
        qr_code: null, // Se puede generar por separado si es necesario
        fecha_vencimiento: fechaVencimiento.toISOString(),
        external_reference: preference.external_reference,
        total: items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
        items: items,
        metadatos: preference.metadata || {}
      };

    } catch (error) {
      console.error('❌ Error creando preferencia de pago:', error);
      
      // Manejar errores específicos de MercadoPago
      if (error.response) {
        const { status, data } = error.response;
        console.error(`❌ Error ${status} de MercadoPago:`, data);
        
        if (status === 400) {
          throw new Error(`Datos inválidos para crear el pago: ${data.message || 'Revisar información de la cotización'}`);
        } else if (status === 401) {
          throw new Error('Token de acceso de MercadoPago inválido o expirado');
        } else if (status === 403) {
          throw new Error('Sin permisos para crear preferencias de pago');
        }
      }
      
      throw new Error(`Error al crear cupón de pago: ${error.message}`);
    }
  }

  /**
   * Obtener información de un pago por ID
   */
  async obtenerPago(paymentId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de MercadoPago no configurado');
      }

      const response = await axios.get(
        `${this.baseUrl}/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo información de pago:', error);
      throw error;
    }
  }

  /**
   * Obtener información de una preferencia
   */
  async obtenerPreferencia(preferenceId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de MercadoPago no configurado');
      }

      const response = await axios.get(
        `${this.baseUrl}/checkout/preferences/${preferenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo preferencia:', error);
      throw error;
    }
  }

  /**
   * Verificar si el servicio está disponible
   */
  isServiceAvailable() {
    return this.isConfigured;
  }

  /**
   * Generar QR Code para pago (requiere librería adicional)
   */
  async generarQRPago(preferenceId) {
    // TODO: Implementar generación de QR si es necesario
    // Requiere instalar qrcode: npm install qrcode
    console.log('🔄 Generación de QR no implementada aún');
    return null;
  }

  /**
   * Formatear URL de pago para compartir
   */
  formatearUrlParaCompartir(checkoutUrl, cotizacion, prospecto) {
    const mensaje = `
🏥 *COBER360 - Cupón de Pago*

Hola ${prospecto.nombre}! 👋

Tu cotización para el plan *${cotizacion.plan_nombre}* está lista para el pago.

💰 *Total a pagar:* $${this.formatearMoneda(cotizacion.total_final)}

🔗 *Link de pago seguro:*
${checkoutUrl}

✅ Pago 100% seguro con MercadoPago
💳 Aceptamos todas las tarjetas
📱 Pago desde tu celular

¿Tenés alguna consulta? ¡Escribinos!

_COBER360 - Tu salud, nuestra prioridad_ 🛡️
    `.trim();

    return {
      mensaje,
      url: checkoutUrl
    };
  }

  /**
   * Formatear moneda argentina
   */
  formatearMoneda(amount) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0).replace('ARS', '').trim();
  }
}

module.exports = new MercadoPagoService();
