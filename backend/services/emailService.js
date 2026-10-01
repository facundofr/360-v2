const nodemailer = require('nodemailer');
const axios = require('axios');

// ✅ Bases de URL desde variables de entorno
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4001').replace(/\/+$/, '');
const API_BASE_URL = (process.env.API_BASE_URL || `${BASE_URL}/api`).replace(/\/+$/, '');
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || BASE_URL).replace(/\/+$/, '');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      console.log('🔧 Inicializando transporter de email...');
      
      // ✅ VERIFICAR VARIABLES DE ENTORNO REQUERIDAS
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Variables de entorno EMAIL_USER y EMAIL_PASS son requeridas');
      }
      
      // ✅ CONFIGURACIÓN ROBUSTA CON TIMEOUTS AMPLIOS
      const transportConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true para 465, false para 587
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        // ⚡ CONFIGURACIONES DE TIMEOUT MEJORADAS
        connectionTimeout: 60000, // 60 segundos
        greetingTimeout: 30000,   // 30 segundos
        socketTimeout: 60000,     // 60 segundos
        // ⚡ CONFIGURACIONES DE POOL Y LÍMITES
        pool: false, // Deshabilitamos pool para evitar conexiones persistentes problemáticas
        maxConnections: 1,
        maxMessages: 1,
        // ⚡ CONFIGURACIONES TLS MEJORADAS PARA GMAIL
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        },
        // ⚡ DEBUG EN DESARROLLO
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development'
      };

      console.log('🔧 Configuración SMTP:', {
        host: transportConfig.host,
        port: transportConfig.port,
        secure: transportConfig.secure,
        user: transportConfig.auth.user ? '✅ Configurado' : '❌ Faltante'
      });

      // ✅ CREAR TRANSPORTER
      this.transporter = nodemailer.createTransport(transportConfig);

      // ✅ VERIFICAR CONEXIÓN CON TIMEOUT Y REINTENTOS
      await this.verificarConexionConReintentos();
      console.log('✅ Transporter de email inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando transporter:', error.message);
      this.transporter = null;
      
      // No lanzar error para que la aplicación siga funcionando
      console.log('⚠️ Email service funcionará en modo degradado - sin envío de emails');
    }
  }

  async verificarConexionConReintentos(maxReintentos = 3) {
    for (let intento = 1; intento <= maxReintentos; intento++) {
      try {
        console.log(`🔍 Verificando conexión SMTP - Intento ${intento}/${maxReintentos}`);
        
        // Verificar con timeout de 30 segundos
        await Promise.race([
          this.transporter.verify(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout verificando SMTP')), 30000)
          )
        ]);
        
        console.log('✅ Conexión SMTP verificada exitosamente');
        return true;
        
      } catch (error) {
        console.error(`❌ Error en intento ${intento}:`, error.message);
        
        if (intento === maxReintentos) {
          throw error;
        }
        
        // Esperar antes del siguiente intento
        const delay = intento * 2000;
        console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ✅ VERIFICAR TRANSPORTER ANTES DE USAR
  async ensureTransporter() {
    if (!this.transporter) {
      console.log('🔄 Transporter no disponible, intentando reinicializar...');
      await this.initializeTransporter();
    }
    
    if (!this.transporter) {
      throw new Error('Servicio de email no disponible. El servicio SMTP no está configurado correctamente.');
    }
    
    return this.transporter;
  }

  // ✅ FUNCIÓN MEJORADA PARA ENVIAR EMAILS CON REINTENTOS
  async enviarEmailConReintentos(mailOptions, maxReintentos = 3) {
    const transporter = await this.ensureTransporter();
    
    for (let intento = 1; intento <= maxReintentos; intento++) {
      try {
        console.log(`📧 Enviando email - Intento ${intento}/${maxReintentos} a: ${mailOptions.to}`);
        
        // Enviar con timeout de 45 segundos
        const result = await Promise.race([
          transporter.sendMail(mailOptions),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout enviando email')), 45000)
          )
        ]);

        console.log('✅ Email enviado exitosamente:', result.messageId);
        return result;
        
      } catch (error) {
        console.error(`❌ Error en intento ${intento}/${maxReintentos}:`, error.message);
        
        if (intento === maxReintentos) {
          throw error;
        }
        
        // Esperar antes del siguiente intento
        const delay = intento * 3000; // 3s, 6s, 9s...
        console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Si es error de conexión, reinicializar transporter
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
          console.log('🔄 Recreando transporter por error de conexión...');
          await this.initializeTransporter();
        }
      }
    }
  }

  async enviarPolizaPorEmail(email, poliza, polizaId) {
    try {
      // Generar el PDF como buffer
      const pdfBuffer = await this.generarPDFBuffer(polizaId);
      
      const mailOptions = {
        from: `"COBER 360" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `COBER - Póliza ${poliza.numero_poliza}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #8B2B8B; color: white; padding: 20px; text-align: center;">
              <h1>COBER</h1>
              <h2>Póliza Generada</h2>
            </div>
            
            <div style="padding: 20px; background-color: #f9f9f9;">
              <p>Estimado/a <strong>${poliza.prospecto_nombre} ${poliza.prospecto_apellido}</strong>,</p>
              
              <p>¡Su póliza ha sido generada exitosamente!</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #8B2B8B;">Detalles de la Póliza:</h3>
                <ul>
                  <li><strong>Número de Póliza:</strong> ${poliza.numero_poliza}</li>
                  <li><strong>Plan:</strong> ${poliza.plan_nombre || 'N/A'}</li>
                  <li><strong>Total:</strong> $${poliza.total_final?.toLocaleString('es-AR') || '0'}</li>
                  <li><strong>Fecha:</strong> ${new Date(poliza.created_at).toLocaleDateString('es-AR')}</li>
                </ul>
              </div>
              
              <p>Encontrará su póliza adjunta a este correo en formato PDF.</p>
              
              <p style="color: #666; font-size: 14px;">
                <strong>Importante:</strong> Guarde este documento en un lugar seguro. 
                Lo necesitará para cualquier trámite relacionado con su cobertura médica.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #8B2B8B; font-weight: bold;">¡Gracias por confiar en COBER!</p>
              </div>
            </div>
            
            <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p>© 2025 COBER - Todos los derechos reservados</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `Poliza-${poliza.numero_poliza}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      const info = await this.enviarEmailConReintentos(mailOptions);
      
      return { 
        success: true, 
        message: 'Email enviado exitosamente',
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error('❌ Error enviando email de póliza:', error);
      throw new Error(`No se pudo enviar el email: ${error.message}`);
    }
  }

  async generarPDFBuffer(polizaId) {
    try {
      // Usar la base del API definida en .env
      const response = await axios.get(
        `${API_BASE_URL}/polizas/${polizaId}/pdf`,
        {
          responseType: 'arraybuffer',
          headers: {
            'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`,
            'User-Agent': 'COBER-Internal-Service'
          },
          timeout: 30000 // 30 segundos de timeout
        }
      );
      
      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Error generando PDF buffer:', error);
      
      // Intento alternativo con URL local si falla la URL pública
      try {
        console.log('🔄 Intentando con URL local como respaldo...');
        const localResponse = await axios.get(
          `http://localhost:${process.env.PORT || 4001}/api/polizas/${polizaId}/pdf`,
          {
            responseType: 'arraybuffer',
            headers: {
              'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`,
              'User-Agent': 'COBER-Internal-Service'
            },
            timeout: 15000 // Timeout más corto para la opción de respaldo
          }
        );
        return Buffer.from(localResponse.data);
      } catch (secondError) {
        console.error('❌ También falló el intento con URL local:', secondError);
        throw new Error('No se pudo generar el PDF para el email');
      }
    }
  }

  // ✅ FUNCIÓN PARA VERIFICACIÓN DE CUENTA
  async sendVerificationEmail(email, token) {
    try {
      const verificationUrl = `${FRONTEND_BASE_URL}/verify-email/${token}`;
      
      const mailOptions = {
        from: `"COBER 360" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'COBER - Verificación de cuenta',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #8B2B8B; color: white; padding: 20px; text-align: center;">
              <h1>COBER</h1>
              <h2>Verificación de Cuenta</h2>
            </div>
            
            <div style="padding: 20px; background-color: #f9f9f9;">
              <p>¡Bienvenido/a a COBER!</p>
              
              <p>Para completar el registro de su cuenta, por favor haga clic en el siguiente enlace:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #8B2B8B; color: white; padding: 15px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Verificar Cuenta
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Si no puede hacer clic en el botón, copie y pegue el siguiente enlace en su navegador:
              </p>
              <p style="word-break: break-all; color: #8B2B8B;">${verificationUrl}</p>
              
              <p style="color: #999; font-size: 12px;">
                Este enlace expirará en 24 horas por seguridad.
              </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p>© 2025 COBER - Todos los derechos reservados</p>
            </div>
          </div>
        `
      };

      const info = await this.enviarEmailConReintentos(mailOptions);
      
      return { 
        success: true, 
        message: 'Email de verificación enviado exitosamente',
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error('❌ Error enviando email de verificación:', error);
      throw new Error(`No se pudo enviar el email de verificación: ${error.message}`);
    }
  }

  // ✅ FUNCIÓN PARA RECUPERO DE CONTRASEÑA
  async sendPasswordResetEmail(email, token) {
    try {
      const resetUrl = `${FRONTEND_BASE_URL}/reset-password/${token}`;
      
      const mailOptions = {
        from: `"COBER 360" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'COBER - Recuperación de contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #8B2B8B; color: white; padding: 20px; text-align: center;">
              <h1>COBER</h1>
              <h2>Recuperación de Contraseña</h2>
            </div>
            
            <div style="padding: 20px; background-color: #f9f9f9;">
              <p>Hemos recibido una solicitud para restablecer la contraseña de su cuenta.</p>
              
              <p>Para crear una nueva contraseña, haga clic en el siguiente enlace:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #8B2B8B; color: white; padding: 15px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Restablecer Contraseña
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Si no puede hacer clic en el botón, copie y pegue el siguiente enlace en su navegador:
              </p>
              <p style="word-break: break-all; color: #8B2B8B;">${resetUrl}</p>
              
              <p style="color: #999; font-size: 12px;">
                Este enlace expirará en 1 hora por seguridad.
              </p>
              
              <p style="color: #d9534f; font-size: 14px;">
                <strong>Si no solicitó este cambio, ignore este email.</strong>
              </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p>© 2025 COBER - Todos los derechos reservados</p>
            </div>
          </div>
        `
      };

      const info = await this.enviarEmailConReintentos(mailOptions);
      
      return { 
        success: true, 
        message: 'Email de recuperación enviado exitosamente',
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error('❌ Error enviando email de recuperación:', error);
      throw new Error(`No se pudo enviar el email de recuperación: ${error.message}`);
    }
  }

  // ✅ ENVIAR EMAIL DE BIENVENIDA
  async enviarEmailBienvenida({ to, user, verification_token, isCreatedByAdmin = false }) {
    try {
      const verificationUrl = `${FRONTEND_BASE_URL}/verify-email/${verification_token}`;
      
      const mailOptions = {
        from: `"COBER 360" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: '¡Bienvenido a COBER 360! - Verifica tu cuenta',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">COBER 360</h1>
              <p style="color: #e3e8ff; margin: 10px 0 0 0; font-size: 16px;">Sistema de Gestión de Leads</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px; background: white;">
              <h2 style="color: #333; margin-bottom: 20px;">¡Bienvenido/a ${user.first_name}!</h2>
              
              ${isCreatedByAdmin ? `
                <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #0066cc;">
                  <p style="margin: 0; color: #0066cc; font-weight: bold;">
                    🎉 Tu cuenta ha sido creada por un administrador
                  </p>
                </div>
              ` : ''}
              
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Te damos la bienvenida al sistema COBER 360. Tu cuenta ha sido configurada con los siguientes datos:
              </p>
              
              <!-- User Info Card -->
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #333; margin-top: 0;">📋 Información de tu cuenta:</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                  <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;"><strong>Nombre:</strong> ${user.first_name} ${user.last_name}</li>
                  <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;"><strong>Email:</strong> ${user.email}</li>
                  <li style="padding: 8px 0;"><strong>Rol:</strong> <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${user.role}</span></li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${verificationUrl}" 
                   style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);">
                  ✅ Verificar Email
                </a>
              </div>
              
              <!-- Important Notice -->
              <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #dc3545;">
                <p style="margin: 0; color: #721c24; font-size: 14px;">
                  <strong>⚠️ Importante:</strong> Este enlace de verificación expira en 24 horas.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #333; color: white; text-align: center; padding: 25px;">
              <p style="margin: 0; font-size: 14px;">© 2025 COBER 360 - Sistema de Gestión de Leads</p>
            </div>
          </div>
        `
      };

      const info = await this.enviarEmailConReintentos(mailOptions);
      console.log(`📧 Email de bienvenida enviado exitosamente a ${to}:`, info.messageId);
      return info;
      
    } catch (error) {
      console.error(`❌ Error enviando email de bienvenida a ${to}:`, error);
      throw new Error(`No se pudo enviar el email de bienvenida: ${error.message}`);
    }
  }

  // ✅ FUNCIÓN PARA EMAILS DE CONFIRMACIÓN GENÉRICOS
  async sendConfirmationEmail(email, options = {}) {
    try {
      const { subject = 'Confirmación - COBER 360', message = 'Su acción ha sido procesada exitosamente.' } = options;
      
      const mailOptions = {
        from: `"COBER 360" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #8B2B8B; color: white; padding: 20px; text-align: center;">
              <h1>COBER</h1>
              <h2>Confirmación</h2>
            </div>
            
            <div style="padding: 20px; background-color: #f9f9f9;">
              <p>${message}</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #d4edda; color: #155724; padding: 15px; 
                           border-radius: 5px; border: 1px solid #c3e6cb;">
                  ✅ Confirmación procesada exitosamente
                </div>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Si tiene alguna pregunta, no dude en contactarnos.
              </p>
            </div>
            
            <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p>© 2025 COBER - Todos los derechos reservados</p>
            </div>
          </div>
        `
      };

      const info = await this.enviarEmailConReintentos(mailOptions);
      
      return { 
        success: true, 
        message: 'Email de confirmación enviado exitosamente',
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error('❌ Error enviando email de confirmación:', error);
      throw new Error(`No se pudo enviar el email de confirmación: ${error.message}`);
    }
  }

  // ✅ NOTIFICACIÓN DE LEAD ASIGNADO A VENDEDOR
  async enviarNotificacionLeadAsignado({ to, vendedorNombre, leadNombre, leadOrigen, prospectoId }) {
    try {
      const leadUrl = `${FRONTEND_BASE_URL}/prospectos/${prospectoId}`;

      // La reasignación automática por inactividad excluye estos orígenes (ver
      // ReAsignacionAutomatica.obtenerProspectosSinActividad) — para esos casos no hay
      // deadline real, así que no mostramos una cuenta regresiva engañosa.
      const ORIGENES_SIN_REASIGNACION_AUTOMATICA = ['Vendedor-App', 'Refrito - Campaña'];
      const minutosLimite = 60;
      let countdownHtml = '';
      if (!ORIGENES_SIN_REASIGNACION_AUTOMATICA.includes(leadOrigen)) {
        // mailtimer.io: la duración de la cuenta regresiva se configura en su
        // dashboard (widget ZaSoUCqtEN), no acá — solo le pasamos cuándo arranca.
        // mailtimer.io interpreta "start" como hora local de Buenos Aires, no UTC —
        // se calcula con Intl para no depender de la zona horaria del servidor/contenedor.
        const partes = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Argentina/Buenos_Aires',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
        const start = `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}`;
        countdownHtml = `
              <!-- Countdown -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                <tr>
                  <td align="center">
                    <img src="https://i.mailtimer.io/ZaSoUCqtEN.gif?start=${start}" border="0" alt="Tiempo restante antes de la reasignación automática" style="max-width:100%; display:block; margin:0 auto;" />
                    <div style="margin-top:8px; font-size:12px; color:#6b7280; line-height:1.5;">
                      Si no ves la imagen: este lead se reasigna automáticamente a otro vendedor
                      si no lo gestionás dentro de los próximos ${minutosLimite} minutos.
                    </div>
                  </td>
                </tr>
              </table>`;
      }

      const mailOptions = {
        from: `"COBER 360" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Nuevo lead asignado: ${leadNombre}`,
        html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo lead asignado</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: #f4f6f8;
  font-family: Arial, Helvetica, sans-serif;
  color: #1f2937;
">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color: #f4f6f8; padding: 40px 20px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="
                 max-width: 580px;
                 background-color: #ffffff;
                 border-radius: 14px;
                 overflow: hidden;
                 border: 1px solid #e5e7eb;
               ">

          <!-- Header -->
          <tr>
            <td style="
              padding: 32px;
              background-color: #8B2B8B;
              color: #ffffff;
            ">

              <div style="
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 1px;
                color: #e8d4e7;
                margin-bottom: 14px;
              ">
                COBER 360
              </div>

              <div style="
                display: inline-block;
                padding: 6px 10px;
                margin-bottom: 14px;
                background-color: rgba(255, 255, 255, 0.18);
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.7px;
              ">
                Nueva oportunidad
              </div>

              <div style="
                font-size: 26px;
                font-weight: bold;
                line-height: 1.25;
              ">
                Tenés un nuevo lead para contactar
              </div>

              <div style="
                margin-top: 10px;
                font-size: 15px;
                line-height: 1.5;
                color: #e8d4e7;
              ">
                Ya fue asignado a tu cartera y está listo para ser gestionado.
              </div>

            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">

              <p style="
                margin: 0 0 24px 0;
                font-size: 16px;
                line-height: 1.6;
              ">
                Hola <strong>${vendedorNombre}</strong>,
              </p>

              <p style="
                margin: 0 0 26px 0;
                font-size: 16px;
                line-height: 1.6;
                color: #4b5563;
              ">
                Se te acaba de asignar una nueva oportunidad comercial.
                Te recomendamos gestionarla cuanto antes para aprovechar el interés del contacto.
              </p>

              <!-- Lead -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="
                       background-color: #f9fafb;
                       border: 1px solid #e5e7eb;
                       border-left: 4px solid #8B2B8B;
                       border-radius: 10px;
                       margin-bottom: 28px;
                     ">
                <tr>
                  <td style="padding: 24px;">

                    <div style="
                      font-size: 12px;
                      font-weight: bold;
                      text-transform: uppercase;
                      letter-spacing: 0.8px;
                      color: #8B2B8B;
                      margin-bottom: 16px;
                    ">
                      Lead asignado
                    </div>

                    <div style="
                      font-size: 22px;
                      font-weight: bold;
                      color: #111827;
                      margin-bottom: 8px;
                    ">
                      ${leadNombre}
                    </div>

                    <div style="
                      font-size: 14px;
                      color: #6b7280;
                    ">
                      Origen:
                      <strong style="color: #374151;">
                        ${leadOrigen}
                      </strong>
                    </div>

                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">

                    <a href="${leadUrl}"
                       target="_blank"
                       style="
                         display: block;
                         background-color: #8B2B8B;
                         color: #ffffff;
                         text-decoration: none;
                         padding: 15px 24px;
                         border-radius: 8px;
                         font-size: 16px;
                         font-weight: bold;
                       ">
                      Gestionar lead
                    </a>

                  </td>
                </tr>
              </table>
              ${countdownHtml}

              <!-- Operational message -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top: 24px;">
                <tr>
                  <td style="
                    padding: 16px;
                    background-color: #f3e8f3;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 1.5;
                    color: #6b1f6b;
                  ">
                    <strong>Importante:</strong>
                    cuanto menor sea el tiempo entre la asignación y el primer contacto,
                    mayor es la posibilidad de convertir la oportunidad.
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background-color: #333333;
              color: #ffffff;
              text-align: center;
              padding: 15px;
              font-size: 12px;
            ">
              © 2025 COBER 360 - Sistema de Gestión de Leads
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`
      };

      const info = await this.enviarEmailConReintentos(mailOptions);
      console.log(`📧 Notificación de lead asignado enviada a ${to}:`, info.messageId);
      return info;

    } catch (error) {
      console.error(`❌ Error enviando notificación de lead asignado a ${to}:`, error);
      throw new Error(`No se pudo enviar la notificación de lead asignado: ${error.message}`);
    }
  }

  // ✅ MÉTODO PARA PROBAR LA CONFIGURACIÓN
  async probarConfiguracion() {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }
      
      if (!this.transporter) {
        return { success: false, message: 'No se pudo inicializar el transporter' };
      }
      
      await this.verificarConexionConReintentos(1); // Solo 1 intento para la prueba
      return { success: true, message: 'Configuración de email verificada correctamente' };
      
    } catch (error) {
      console.error('❌ Error en configuración de email:', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ MÉTODO PARA VERIFICAR ESTADO DEL SERVICIO
  async verificarEstado() {
    const estado = await this.probarConfiguracion();
    return {
      disponible: estado.success,
      mensaje: estado.message,
      configuracion: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.EMAIL_USER || 'No configurado'
      }
    };
  }
}

module.exports = new EmailService();
