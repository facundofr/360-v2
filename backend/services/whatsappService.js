const axios = require('axios');
const twilio = require('twilio');

// ✅ Lista blanca de tipos MIME permitidos
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'video/mp4',
  'video/3gpp',
  'audio/mpeg',
  'audio/ogg',
  'audio/aac',
  'audio/amr'
]);

// ✅ Tamaño máximo permitido (MB) configurable por env; por defecto 20MB
const MAX_MEDIA_MB = parseInt(process.env.WHATSAPP_MAX_UPLOAD_MB || '20', 10);
const MAX_MEDIA_BYTES = MAX_MEDIA_MB * 1024 * 1024;

class WhatsAppService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    
    // Template SID para cotizaciones
    this.COTIZACION_TEMPLATE_SID = 'HX70d33e4bd86cc9704ff51ffe5ee21c35';
    
    // Template SID para pólizas
    this.POLIZA_TEMPLATE_SID = 'HX8fb1275dfade61ec754f6f1879954140';
    
    // Template SID para primer contacto (inicio)
    this.INICIO_TEMPLATE_SID = 'HX7c5d36e1b72e30d011422151bd8f954a';
    
    // 🔄 Template SID para Saludo Inicial / Recontacto (Respuesta Rápida)
    this.SALUDO_INICIAL_SID = 'HXa9cc9972e7bb72e1af807c046f20341b';
    
    // Validar que las credenciales estén configuradas
    if (!this.accountSid || !this.authToken || !this.whatsappNumber) {
      console.warn('⚠️  Credenciales de Twilio no configuradas. El servicio de WhatsApp no estará disponible.');
      this.isConfigured = false;
      return;
    }

    // Validar formato del Account SID
    if (!this.accountSid.startsWith('AC')) {
      console.error('❌ Account SID de Twilio debe comenzar con "AC"');
      this.isConfigured = false;
      return;
    }

    try {
      this.client = twilio(this.accountSid, this.authToken);
      this.isConfigured = true;
      console.log('✅ Servicio de WhatsApp configurado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando cliente de Twilio:', error);
      this.isConfigured = false;
    }

    // El número del validador vive en una subcuenta de Twilio aparte (no la
    // cuenta principal) — mandar/recibir contenido desde ese número requiere
    // un cliente autenticado con las credenciales de esa subcuenta, si no
    // Twilio devuelve 63007 "could not find a Channel with the specified From".
    this.numeroValidador = process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR;
    const subSid = process.env.TWILIO_SUBACCOUNT_SID_VALIDADOR;
    const subToken = process.env.TWILIO_SUBACCOUNT_AUTH_TOKEN_VALIDADOR;
    if (subSid && subToken) {
      try {
        this.subaccountClient = twilio(subSid, subToken);
      } catch (error) {
        console.error('❌ Error inicializando cliente de subcuenta del validador:', error);
      }
    }
  }

  // Devuelve el cliente de Twilio correcto según desde qué número se manda.
  _clientPara(fromNumber) {
    if (fromNumber && this.numeroValidador && fromNumber === this.numeroValidador && this.subaccountClient) {
      return this.subaccountClient;
    }
    return this.client;
  }

  async enviarMensaje(parametros, mensaje, fromNumber) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      // Manejar ambos formatos: objeto o parámetros separados
      let telefono, mensajeTexto;
      if (typeof parametros === 'object' && parametros !== null) {
        telefono = parametros.telefono;
        mensajeTexto = parametros.mensaje || mensaje;
      } else {
        telefono = parametros;
        mensajeTexto = mensaje;
      }

      if (!telefono || !mensajeTexto) {
        throw new Error('Teléfono y mensaje son requeridos');
      }

      // Asegurar que el número tenga el formato correcto
      let numeroFormateado = String(telefono).replace(/[^0-9]/g, ''); // Convertir a string y limpiar
      
      console.log(`🔍 Número original: ${telefono}, Número limpio: ${numeroFormateado}`);
      
      // Verificar que tenemos un número válido después de la limpieza
      if (!numeroFormateado || numeroFormateado.length < 8) {
        throw new Error(`Número de teléfono inválido o muy corto: ${numeroFormateado} (longitud: ${numeroFormateado.length})`);
      }

      // Agregar código de país y el 9 de móvil si no lo tiene (Argentina)
      if (!numeroFormateado.startsWith('54')) {
        if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      } else if (!numeroFormateado.startsWith('549')) {
        // Tiene prefijo AR pero falta el 9 de móvil: 541xxxxxxx → 5491xxxxxxx
        numeroFormateado = '549' + numeroFormateado.slice(2);
      }

      // Agregar el símbolo + al principio
      numeroFormateado = '+' + numeroFormateado;

      const numeroOrigen = fromNumber || this.whatsappNumber;
      console.log(`📱 Enviando WhatsApp desde ${numeroOrigen} hacia ${numeroFormateado}`);

      const message = await this._clientPara(fromNumber).messages.create({
        from: `whatsapp:${numeroOrigen}`,
        to: `whatsapp:${numeroFormateado}`,
        body: mensajeTexto,
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log(`✅ WhatsApp enviado exitosamente. SID: ${message.sid}`);
      
      return { 
        success: true, 
        message: 'Mensaje enviado por WhatsApp',
        message_id: message.sid,
        sid: message.sid
      };
      
    } catch (error) {
      console.error('❌ Error enviando WhatsApp:', error);
      
      // Manejar errores específicos de Twilio
      if (error.code === 21211) {
        throw new Error('Número de teléfono inválido');
      } else if (error.code === 21408) {
        throw new Error('No se puede enviar a este número de WhatsApp');
      } else if (error.code === 21614) {
        throw new Error('Número de WhatsApp no válido o no verificado');
      }
      
      throw error;
    }
  }

  // Método para verificar la configuración
  isServiceAvailable() {
    return this.isConfigured;
  }

  // Método para enviar usando template (si tienes templates aprobados)
  async enviarConTemplate(telefono, templateSid, variables = {}, fromNumber) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      let numeroFormateado = String(telefono).replace(/[^0-9]/g, ''); // Convertir a string y limpiar
      
      // Verificar que tenemos un número válido después de la limpieza
      if (!numeroFormateado || numeroFormateado.length < 8) {
        throw new Error('Número de teléfono inválido o muy corto');
      }

      // Agregar código de país y el 9 de móvil si no lo tiene (Argentina)
      if (!numeroFormateado.startsWith('54')) {
        if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      } else if (!numeroFormateado.startsWith('549')) {
        // Tiene prefijo AR pero falta el 9 de móvil: 541xxxxxxx → 5491xxxxxxx
        numeroFormateado = '549' + numeroFormateado.slice(2);
      }

      // Agregar el símbolo + al principio
      numeroFormateado = '+' + numeroFormateado;

      const message = await this._clientPara(fromNumber).messages.create({
        from: `whatsapp:${fromNumber || this.whatsappNumber}`,
        to: `whatsapp:${numeroFormateado}`,
        contentSid: templateSid,
        contentVariables: JSON.stringify(variables),
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log(`✅ WhatsApp template enviado. SID: ${message.sid}`);
      
      return { 
        success: true, 
        message: 'Template enviado por WhatsApp',
        sid: message.sid
      };
      
    } catch (error) {
      console.error('❌ Error enviando template WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Enviar cotización usando template aprobado de WhatsApp
   * @param {string} telefono - Número de teléfono del destinatario
   * @param {object} datosCotizacion - Datos de la cotización
   * @returns {Promise<object>} - Resultado del envío
   */
  async enviarCotizacion(telefono, datosCotizacion) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      // Validar datos requeridos
      const {
        nombreCliente,
        nombrePlan,
        grupoFamiliar,
        tipoAfiliacion,
        totalBruto,
        descuentoAporte,
        descuentoPromocion,
        totalFinal
      } = datosCotizacion;

      if (!nombreCliente || !nombrePlan || !grupoFamiliar || !tipoAfiliacion || 
          totalBruto === undefined || descuentoAporte === undefined || 
          descuentoPromocion === undefined || totalFinal === undefined) {
        throw new Error('Datos de cotización incompletos');
      }

      // Formatear números de teléfono
      let numeroFormateado = String(telefono).replace(/[^0-9]/g, '');
      
      console.log(`🔍 Número original: ${telefono}, Número limpio: ${numeroFormateado}`);
      
      if (!numeroFormateado || numeroFormateado.length < 8) {
        throw new Error(`Número de teléfono inválido o muy corto: ${numeroFormateado}`);
      }

      // Agregar código de país y el 9 de móvil si no lo tiene (Argentina)
      if (!numeroFormateado.startsWith('54')) {
        if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      } else if (!numeroFormateado.startsWith('549')) {
        // Tiene prefijo AR pero falta el 9 de móvil: 541xxxxxxx → 5491xxxxxxx
        numeroFormateado = '549' + numeroFormateado.slice(2);
      }

      numeroFormateado = '+' + numeroFormateado;

      // Formatear valores monetarios
      // Nota: es-AR produce U+00A0 (espacio duro) que Twilio rechaza → se reemplaza
      const formatearMoneda = (valor) => {
        return new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 2
        }).format(valor).replace(/\u00a0/g, ' ');
      };

      // Preparar variables del template
      const variables = {
        "1": nombreCliente,                           // {{1}} - Nombre del cliente
        "2": nombrePlan,                              // {{2}} - Plan
        "3": grupoFamiliar,                           // {{3}} - Grupo Familiar
        "4": tipoAfiliacion,                          // {{4}} - Tipo de Afiliación
        "5": formatearMoneda(totalBruto),             // {{5}} - Total Bruto
        "6": formatearMoneda(descuentoAporte),        // {{6}} - Descuento Aporte
        "7": formatearMoneda(descuentoPromocion),     // {{7}} - Descuento Promoción
        "8": formatearMoneda(totalFinal)              // {{8}} - TOTAL FINAL
      };

      console.log(`📱 Enviando cotización WhatsApp desde ${this.whatsappNumber} hacia ${numeroFormateado}`);
      console.log(`📋 Variables del template:`, variables);

      const message = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${numeroFormateado}`,
        contentSid: this.COTIZACION_TEMPLATE_SID,
        contentVariables: JSON.stringify(variables),
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log(`✅ Cotización WhatsApp enviada exitosamente. SID: ${message.sid}`);
      
      return { 
        success: true, 
        message: 'Cotización enviada por WhatsApp usando template aprobado',
        message_id: message.sid,
        sid: message.sid,
        template_used: this.COTIZACION_TEMPLATE_SID,
        recipient: numeroFormateado
      };
      
    } catch (error) {
      console.error('❌ Error enviando cotización WhatsApp:', error);
      
      // Manejar errores específicos de Twilio
      if (error.code === 21211) {
        throw new Error('Número de teléfono inválido');
      } else if (error.code === 21408) {
        throw new Error('No se puede enviar a este número de WhatsApp');
      } else if (error.code === 21614) {
        throw new Error('Número de WhatsApp no válido o no verificado');
      } else if (error.code === 21610) {
        throw new Error('Template de WhatsApp no válido o no aprobado');
      }
      
      throw error;
    }
  }

  /**
   * Enviar póliza usando template aprobado de WhatsApp
   * @param {string} telefono - Número de teléfono del destinatario
   * @param {object} datosPoliza - Datos de la póliza
   * @returns {Promise<object>} - Resultado del envío
   */
  async enviarPoliza(telefono, datosPoliza) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      // Validar datos requeridos
      const {
        nombreCliente,
        numeroPoliza,
        nombrePlan,
        totalMensual,
        linkDescarga
      } = datosPoliza;

      if (!nombreCliente || !numeroPoliza || !nombrePlan || 
          totalMensual === undefined || !linkDescarga) {
        throw new Error('Datos de póliza incompletos');
      }

      // Formatear números de teléfono
      let numeroFormateado = String(telefono).replace(/[^0-9]/g, '');
      
      console.log(`🔍 Número original: ${telefono}, Número limpio: ${numeroFormateado}`);
      
      if (!numeroFormateado || numeroFormateado.length < 8) {
        throw new Error(`Número de teléfono inválido o muy corto: ${numeroFormateado}`);
      }

      // Agregar código de país y el 9 de móvil si no lo tiene (Argentina)
      if (!numeroFormateado.startsWith('54')) {
        if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      } else if (!numeroFormateado.startsWith('549')) {
        // Tiene prefijo AR pero falta el 9 de móvil: 541xxxxxxx → 5491xxxxxxx
        numeroFormateado = '549' + numeroFormateado.slice(2);
      }

      numeroFormateado = '+' + numeroFormateado;

      // Formatear valores monetarios
      // Nota: es-AR produce U+00A0 (espacio duro) que Twilio rechaza → se reemplaza
      const formatearMoneda = (valor) => {
        return new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 2
        }).format(valor).replace(/\u00a0/g, ' ');
      };

      // Preparar variables del template
      const variables = {
        "1": nombreCliente,                           // {{1}} - Nombre del cliente
        "2": numeroPoliza,                            // {{2}} - Número de póliza
        "3": nombrePlan,                              // {{3}} - Plan
        "4": formatearMoneda(totalMensual),           // {{4}} - Total mensual
        "5": linkDescarga                             // {{5}} - Link de descarga
      };

      console.log(`📱 Enviando póliza WhatsApp desde ${this.whatsappNumber} hacia ${numeroFormateado}`);
      console.log(`📋 Variables del template de póliza:`, variables);

      const message = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${numeroFormateado}`,
        contentSid: this.POLIZA_TEMPLATE_SID,
        contentVariables: JSON.stringify(variables),
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log(`✅ Póliza WhatsApp enviada exitosamente. SID: ${message.sid}`);
      
      return { 
        success: true, 
        message: 'Póliza enviada por WhatsApp usando template aprobado',
        message_id: message.sid,
        sid: message.sid,
        template_used: this.POLIZA_TEMPLATE_SID,
        recipient: numeroFormateado
      };
      
    } catch (error) {
      console.error('❌ Error enviando póliza WhatsApp:', error);
      
      // Manejar errores específicos de Twilio
      if (error.code === 21211) {
        throw new Error('Número de teléfono inválido');
      } else if (error.code === 21408) {
        throw new Error('No se puede enviar a este número de WhatsApp');
      } else if (error.code === 21614) {
        throw new Error('Número de WhatsApp no válido o no verificado');
      } else if (error.code === 21610) {
        throw new Error('Template de WhatsApp no válido o no aprobado');
      }
      
      throw error;
    }
  }
  /**
   * Enviar primer contacto por WhatsApp usando plantilla aprobada
   * @param {string} telefono - Número de teléfono del destinatario
   * @param {string} nombreCompleto - Nombre completo del prospecto
   * @returns {Promise<object>} - Resultado del envío
   */
  async enviarPrimerContacto(telefono, nombreCompleto) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      // Formatear números de teléfono
      let numeroFormateado = String(telefono).replace(/[^0-9]/g, '');
      
      console.log(`� Número original: ${telefono}, Número limpio: ${numeroFormateado}`);
      
      if (!numeroFormateado || numeroFormateado.length < 8) {
        throw new Error(`Número de teléfono inválido o muy corto: ${numeroFormateado}`);
      }

      // Agregar código de país y el 9 de móvil si no lo tiene (Argentina)
      if (!numeroFormateado.startsWith('54')) {
        if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      } else if (!numeroFormateado.startsWith('549')) {
        // Tiene prefijo AR pero falta el 9 de móvil: 541xxxxxxx → 5491xxxxxxx
        numeroFormateado = '549' + numeroFormateado.slice(2);
      }

      numeroFormateado = '+' + numeroFormateado;

      // Preparar variables del template de inicio
      const variables = {
        "1": nombreCompleto  // {{1}} - Nombre completo del prospecto
      };

      console.log(`📱 Enviando primer contacto WhatsApp desde ${this.whatsappNumber} hacia ${numeroFormateado}`);
      console.log(`📋 Variables del template de inicio:`, variables);

      const message = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${numeroFormateado}`,
        contentSid: this.INICIO_TEMPLATE_SID,
        contentVariables: JSON.stringify(variables),
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log(`✅ Primer contacto WhatsApp enviado exitosamente. SID: ${message.sid}`);
      
      return { 
        success: true, 
        message: 'Primer contacto enviado por WhatsApp usando plantilla aprobada',
        message_id: message.sid,
        sid: message.sid,
        template_used: this.INICIO_TEMPLATE_SID,
        recipient: numeroFormateado
      };
      
    } catch (error) {
      console.error('❌ Error enviando primer contacto WhatsApp:', error);
      
      // Manejar errores específicos de Twilio
      if (error.code === 21211) {
        throw new Error('Número de teléfono inválido');
      } else if (error.code === 21408) {
        throw new Error('No se puede enviar a este número de WhatsApp');
      } else if (error.code === 21614) {
        throw new Error('Número de WhatsApp no válido o no verificado');
      } else if (error.code === 21610) {
        throw new Error('Template de WhatsApp no válido o no aprobado');
      }
      
      throw error;
    }
  }

  /**
   * Obtener plantillas disponibles para el frontend
   */
  getPlantillasDisponibles() {
    return {
      inicio: {
        sid: this.INICIO_TEMPLATE_SID,
        nombre: 'Primer Contacto',
        parametros: ['nombreCompleto']
      },
      cotizacion: {
        sid: this.COTIZACION_TEMPLATE_SID,
        nombre: 'Cotización',
        parametros: ['nombreCliente', 'nombrePlan', 'grupoFamiliar', 'tipoAfiliacion', 'totalBruto', 'descuentoAporte', 'descuentoPromocion', 'totalFinal']
      },
      poliza: {
        sid: this.POLIZA_TEMPLATE_SID,
        nombre: 'Póliza',
        parametros: ['nombreCliente', 'numeroPoliza', 'nombrePlan', 'totalMensual', 'linkDescarga']
      },
      saludoInicial: {
        sid: this.SALUDO_INICIAL_SID,
        nombre: 'Recontactar',
        parametros: ['cliente', 'vendedor']
      }
    };
  }

  /**
   * 🔄 Enviar Saludo Inicial / Recontacto (Respuesta Rápida)
   * @param {string} telefono - Número de teléfono del destinatario
   * @param {string} nombreVendedor - Nombre del vendedor
   * @param {string} nombreCliente - Nombre del cliente/prospecto
   * @returns {Promise<object>} - Resultado del envío
   */
  async enviarSaludoInicial(telefono, nombreVendedor, nombreCliente) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      console.log('📱 Enviando saludo inicial por WhatsApp...');
      console.log('📞 Teléfono:', telefono);
      console.log('👤 Vendedor:', nombreVendedor);
      console.log('👤 Cliente:', nombreCliente);

      // Formatear número de teléfono
      let numeroFormateado = telefono.replace(/\D/g, '');
      
      if (!numeroFormateado.startsWith('549')) {
        if (numeroFormateado.startsWith('54')) {
          numeroFormateado = '549' + numeroFormateado.substring(2);
        } else if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      }

      console.log('📱 Número formateado:', numeroFormateado);

      // Variables para la plantilla
      const variables = {
        cliente: nombreCliente || 'estimado cliente',
        vendedor: nombreVendedor || 'tu asesor de COBER'
      };

      console.log('📝 Variables de la plantilla:', variables);
      console.log('🆔 Template SID:', this.SALUDO_INICIAL_SID);

      // Enviar mensaje usando template
      const message = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:+${numeroFormateado}`,
        contentSid: this.SALUDO_INICIAL_SID,
        contentVariables: JSON.stringify(variables),
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log('✅ Saludo inicial enviado exitosamente');
      console.log('📬 Message SID:', message.sid);
      console.log('📊 Estado:', message.status);

      return {
        success: true,
        messageSid: message.sid,
        status: message.status,
        to: numeroFormateado,
        mensaje: '👋 Saludo inicial enviado correctamente'
      };

    } catch (error) {
      console.error('❌ Error enviando saludo inicial:', error);
      
      // Manejo de errores específicos de Twilio
      if (error.code === 21408) {
        throw new Error('Permisos insuficientes para enviar mensajes de WhatsApp');
      } else if (error.code === 21211) {
        throw new Error('Número de teléfono no válido');
      } else if (error.code === 21612) {
        throw new Error('No se puede enviar a este número de WhatsApp');
      } else if (error.code === 21614) {
        throw new Error('Número de WhatsApp no válido o no verificado');
      } else if (error.code === 21610) {
        throw new Error('Template de WhatsApp no válido o no aprobado');
      }
      
      throw error;
    }
  }

  /**
   * 🤖 Enviar Respuesta Automática cuando cliente envía primer mensaje
   * @param {string} telefono - Número de teléfono del destinatario
   * @returns {Promise<object>} - Resultado del envío
   */
  async enviarRespuestaAutomatica(telefono) {
    try {
      if (!this.isConfigured) {
        throw new Error('Servicio de WhatsApp no configurado correctamente');
      }

      console.log('🤖 Enviando respuesta automática por WhatsApp...');
      console.log('📞 Teléfono:', telefono);

      // Formatear número de teléfono
      let numeroFormateado = String(telefono).replace(/[^0-9]/g, '');
      
      if (!numeroFormateado.startsWith('54')) {
        if (numeroFormateado.startsWith('9')) {
          numeroFormateado = '54' + numeroFormateado;
        } else {
          numeroFormateado = '549' + numeroFormateado;
        }
      }

      // Agregar el símbolo + al principio
      numeroFormateado = '+' + numeroFormateado;

      console.log(`📱 Número formateado para respuesta automática: ${numeroFormateado}`);
      console.log(`🆔 Template SID para respuesta automática: HXdc747f3158ac33d69edfb215d06af32d`);

      // Enviar mensaje usando el template de respuesta automática
      const message = await this.client.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${numeroFormateado}`,
        contentSid: 'HXdc747f3158ac33d69edfb215d06af32d', // Template SID proporcionado
        contentVariables: JSON.stringify({}), // Sin variables, el template es fijo
        statusCallback: `${process.env.BASE_URL}/api/webhooks/whatsapp-status`
      });

      console.log(`✅ Respuesta automática enviada exitosamente. SID: ${message.sid}`);
      
      return { 
        success: true, 
        message: 'Respuesta automática enviada',
        message_id: message.sid,
        sid: message.sid,
        template_sid: 'HXdc747f3158ac33d69edfb215d06af32d',
        recipient: numeroFormateado
      };
      
    } catch (error) {
      console.error('❌ Error enviando respuesta automática:', error);
      
      // Manejar errores específicos de Twilio
      if (error.code === 21211) {
        throw new Error('Número de teléfono inválido');
      } else if (error.code === 21408) {
        throw new Error('No se puede enviar a este número de WhatsApp');
      } else if (error.code === 21614) {
        throw new Error('Número de WhatsApp no válido o no verificado');
      } else if (error.code === 21610) {
        throw new Error('Template de WhatsApp no válido o no aprobado');
      }
      
      throw error;
    }
  }

  /**
   * 📎 Descargar archivo multimedia desde Twilio
   * @param {string} mediaUrl - URL del archivo en Twilio
   * @param {string} mediaType - Tipo MIME del archivo
   * @returns {Promise<object>} - Datos del archivo descargado
   */
  async descargarArchivoMultimedia(mediaUrl, mediaType) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const crypto = require('crypto');

      console.log('📥 Descargando archivo multimedia desde Twilio...');
      console.log('🔗 URL:', mediaUrl);
      console.log('📄 Tipo:', mediaType);

      // Autenticación con Twilio (Basic Auth)
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      // Intentar obtener el content-type desde el servidor si no vino en el webhook
      let contentType = mediaType;

      // Descargar archivo como stream para evitar corrupción de binarios
      const downloadResponse = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': '*/*'
        },
        responseType: 'stream',
        decompress: true
      });

      contentType = contentType || downloadResponse.headers['content-type'] || 'application/octet-stream';

      const contentLengthHeader = downloadResponse.headers['content-length'];
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      console.log('✅ Archivo descargado (stream). Tipo:', contentType, '| Length:', contentLength || 'desconocido');

      // ✅ Validar MIME permitido
      if (!ALLOWED_MIME.has(contentType)) {
        // Normalizar image/jpg -> image/jpeg si corresponde
        if (!(contentType === 'image/jpg' && ALLOWED_MIME.has('image/jpeg'))) {
          throw new Error(`Tipo de archivo no permitido: ${contentType}`);
        }
      }

      // ✅ Validar tamaño si el servidor lo informa
      if (contentLength && contentLength > MAX_MEDIA_BYTES) {
        throw new Error(`Archivo excede el tamaño máximo (${MAX_MEDIA_MB}MB)`);
      }

      // Generar nombre único
      const timestamp = Date.now();
      const hash = crypto.randomBytes(8).toString('hex');
  const extension = this.obtenerExtension(contentType);
      const nombreArchivo = `recibido-${timestamp}-${hash}${extension}`;

      // Crear directorio si no existe
      const uploadDir = path.join(__dirname, '../uploads/whatsapp/recibidos');
      await fs.mkdir(uploadDir, { recursive: true });

      // Guardar archivo
      const rutaArchivo = path.join(uploadDir, nombreArchivo);
      // Guardar a disco via stream para preservar bytes
      await new Promise((resolve, reject) => {
        const writer = require('fs').createWriteStream(rutaArchivo);
        downloadResponse.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log('💾 Archivo guardado:', rutaArchivo);

      // URL pública
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  // Usar alias bajo /api para garantizar acceso público detrás de NGINX
  const urlPublica = `${baseUrl.replace(/\/$/, '')}/api/uploads/whatsapp/recibidos/${nombreArchivo}`;

      // Obtener tamaño real del archivo guardado
      const stat = await require('fs').promises.stat(rutaArchivo);

      // ✅ Revalidar tamaño real al terminar (por si no vino Content-Length)
      if (stat.size > MAX_MEDIA_BYTES) {
        await fs.unlink(rutaArchivo).catch(() => {});
        throw new Error(`Archivo excede el tamaño máximo (${MAX_MEDIA_MB}MB)`);
      }

      return {
        success: true,
        archivo_url: urlPublica,
        archivo_nombre: nombreArchivo,
        archivo_tipo: contentType,
        archivo_tamaño: stat.size,
        ruta_local: rutaArchivo
      };

    } catch (error) {
      console.error('❌ Error descargando archivo multimedia:', error);
      throw error;
    }
  }

  /**
   * 📄 Obtener extensión de archivo según tipo MIME
   * @param {string} mimeType - Tipo MIME del archivo
   * @returns {string} - Extensión del archivo con punto
   */
  obtenerExtension(mimeType) {
    const extensiones = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/aac': '.aac',
      'audio/amr': '.amr'
    };
    
    return extensiones[mimeType] || '.bin';
  }
}

module.exports = new WhatsAppService();