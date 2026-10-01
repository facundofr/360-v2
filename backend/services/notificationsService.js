const admin = require('firebase-admin');
const db = require('../config/db');

// Inicializar Firebase Admin si no está ya inicializado
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin inicializado correctamente');
    console.log('🔧 Firebase Admin apps:', admin.apps.length);
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
} else {
  console.log('✅ Firebase Admin ya estaba inicializado. Apps:', admin.apps.length);
}

// Las notificaciones push nunca llevan teléfonos: el payload pasa por Firebase y
// queda en los dispositivos de los vendedores. Se quitan los campos de teléfono
// de `data` y se enmascara cualquier número de 8+ dígitos en título, cuerpo y
// valores (p. ej. un cliente que escribe su celular en el mensaje de WhatsApp).
const CAMPO_TELEFONO = /tel[eé]fono|phone|celular|numero_contacto|whatsapp/i;
const NUMERO_LARGO = /\+?\(?\d[\d\s().-]{6,}\d/g;
const TELEFONO_OCULTO = '[tel. oculto]';

function ocultarTelefonos(texto) {
  if (typeof texto !== 'string') return texto;
  return texto.replace(NUMERO_LARGO, (m) => (m.replace(/\D/g, '').length >= 8 ? TELEFONO_OCULTO : m));
}

function sanitizarDatos(datos = {}) {
  const limpio = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (CAMPO_TELEFONO.test(clave)) continue;
    limpio[clave] = ocultarTelefonos(valor);
  }
  return limpio;
}

class NotificationsService {
  /**
   * Guardar o actualizar token FCM para un usuario
   * @param {number} userId - ID del usuario
   * @param {string} token - Token FCM
   * @param {object} deviceInfo - Información del dispositivo
   */
  async guardarTokenFCM(userId, token, deviceInfo = {}) {
    try {
      if (!userId || !token) {
        throw new Error('userId y token son requeridos');
      }

      // 🔍 VERIFICAR SI EL TOKEN YA EXISTE (cualquier usuario)
      const [tokenExistente] = await db.query(
        'SELECT id, user_id FROM user_fcm_tokens WHERE token = ?',
        [token]
      );

      if (tokenExistente.length > 0) {
        // Si el token existe para OTRO usuario, eliminarlo primero
        if (tokenExistente[0].user_id !== userId) {
          console.log(`🔄 Token ya existe para usuario ${tokenExistente[0].user_id}, reasignando a usuario ${userId}`);
          await db.query('DELETE FROM user_fcm_tokens WHERE token = ?', [token]);
        } else {
          // Token ya existe para este usuario, solo actualizar
          await db.query(
            'UPDATE user_fcm_tokens SET last_seen = NOW(), device = ?, platform = ?, app_version = ? WHERE user_id = ? AND token = ?',
            [
              deviceInfo.device ? deviceInfo.device.substring(0, 255) : null,
              deviceInfo.platform ? deviceInfo.platform.substring(0, 50) : null,
              deviceInfo.appVersion ? deviceInfo.appVersion.substring(0, 50) : null,
              userId,
              token
            ]
          );
          console.log(`✅ Token FCM actualizado para usuario ${userId}`);
          return { nuevo: false, token };
        }
      }

      // Insertar nuevo token (o reinsertar después de eliminar)
      const appVersion = deviceInfo.appVersion 
        ? deviceInfo.appVersion.substring(0, 50) 
        : null;
      
      await db.query(
        `INSERT INTO user_fcm_tokens 
         (user_id, token, device, platform, app_version, last_seen)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          token,
          deviceInfo.device ? deviceInfo.device.substring(0, 255) : null,
          deviceInfo.platform ? deviceInfo.platform.substring(0, 50) : null,
          appVersion
        ]
      );

      console.log(`✅ Nuevo token FCM guardado para usuario ${userId}`);

      // Limpiar tokens viejos, dejar solo los 3 más recientes
      await db.query(
        `DELETE FROM user_fcm_tokens
         WHERE user_id = ? AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM user_fcm_tokens
             WHERE user_id = ?
             ORDER BY last_seen DESC
             LIMIT 3
           ) AS keep
         )`,
        [userId, userId]
      );

      return { nuevo: true, token };
    } catch (error) {
      console.error('❌ Error guardando token FCM:', error);
      throw error;
    }
  }

  /**
   * Enviar notificación push a un usuario
   * @param {number} userId - ID del usuario a notificar
   * @param {string} titulo - Título de la notificación
   * @param {string} mensaje - Cuerpo del mensaje
   * @param {object} datos - Datos adicionales
   */
  async enviarNotificacionUsuario(usuarioId, titulo, mensaje, datos = {}) {
    try {
      console.log(`📤 Enviando notificación a usuario ${usuarioId}`);
      
      // Obtener tokens únicos y más recientes del usuario (máximo 3)
      const [tokens] = await db.query(
        `SELECT token FROM user_fcm_tokens 
         WHERE user_id = ? AND is_revoked = FALSE
         GROUP BY token
         ORDER BY MAX(last_seen) DESC
         LIMIT 3`,
        [usuarioId]
      );

      const tokenList = tokens.map(t => t.token);
      console.log(`🔑 Tokens únicos encontrados: ${tokenList.length} para usuario ${usuarioId}`);

      if (tokenList.length === 0) {
        console.warn(`⚠️ No hay tokens registrados para el usuario ${usuarioId}`);
        return { enviadas: 0, fallidas: 0 };
      }

      const payload = {
        notification: {
          title: ocultarTelefonos(titulo),
          body: ocultarTelefonos(mensaje)
        },
        data: {
          ...sanitizarDatos(datos),
          timestamp: new Date().toISOString()
        }
      };

      let enviadas = 0;
      let fallidas = 0;

      for (let i = 0; i < tokenList.length; i++) {
        const token = tokenList[i];
        console.log(`🔍 Enviando a token ${i + 1}/${tokenList.length}:`, token.substring(0, 20) + '...');
        
        try {
          const response = await admin.messaging().send({ ...payload, token });
          console.log(`   ✅ Enviado:`, response);
          enviadas++;
        } catch (error) {
          fallidas++;
          console.error(`   ❌ Error token ${i + 1}: ${error.code} - ${error.message}`);
          
          // Limpiar tokens inválidos o no registrados
          const esTokenInvalido = [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered'
          ].includes(error.code);

          if (esTokenInvalido) {
            try {
              await db.query(
                'DELETE FROM user_fcm_tokens WHERE token = ?',
                [token]
              );
              console.log(`   🗑️ Token inválido eliminado de la BD`);
            } catch (deleteError) {
              console.error(`   Error al eliminar token:`, deleteError.message);
            }
          }
        }
      }

      console.log(`📊 Resumen: ${enviadas} enviadas, ${fallidas} fallidas`);
      return { enviadas, fallidas };
    } catch (error) {
      console.error('❌ Error en enviarNotificacionUsuario:', error);
      throw error;
    }
  }

  /**
   * Enviar notificación a múltiples usuarios (broadcast)
   * @param {array} userIds - Array de IDs de usuarios
   * @param {string} titulo
   * @param {string} mensaje
   * @param {object} datos
   */
  async enviarNotificacionMultiple(userIds, titulo, mensaje, datos = {}) {
    try {
      const resultados = [];

      for (const userId of userIds) {
        const resultado = await this.enviarNotificacionUsuario(
          userId,
          titulo,
          mensaje,
          datos
        );
        resultados.push({ userId, ...resultado });
      }

      return resultados;
    } catch (error) {
      console.error('❌ Error enviando notificaciones múltiples:', error);
      throw error;
    }
  }

  /**
   * Notificar cuando se asigna un nuevo prospecto
   * @param {number} vendedorId - ID del vendedor
   * @param {object} prospecto - Datos del prospecto
   */
  async notificarAsignacionProspecto(vendedorId, prospecto) {
    try {
      const titulo = '🎯 Nuevo Prospecto Asignado';
      const mensaje = `Se te ha asignado a ${prospecto.nombre} ${prospecto.apellido}`;
      const datos = {
        tipo: 'prospecto_asignado',
        prospecto_id: String(prospecto.id),
        vendedor_id: String(vendedorId),
        nombre: prospecto.nombre,
        apellido: prospecto.apellido,
        estado: prospecto.estado || 'Lead'
      };

      const resultado = await this.enviarNotificacionUsuario(
        vendedorId,
        titulo,
        mensaje,
        datos
      );

      console.log(`✅ Notificación de asignación enviada a vendedor ${vendedorId}`);
      return resultado;
    } catch (error) {
      console.error('❌ Error notificando asignación de prospecto:', error);
      throw error;
    }
  }

  /**
   * Notificar mensaje nuevo de WhatsApp
   * @param {number} vendedorId - ID del vendedor
   * @param {string} contactoNombre - Nombre del contacto
   * @param {string} ultimoMensaje - Último mensaje recibido
   * @param {number} conversacionId - ID de la conversación
   */
  async notificarMensajeWhatsApp(vendedorId, contactoNombre, ultimoMensaje, conversacionId) {
    try {
      const titulo = '💬 Nuevo mensaje de WhatsApp';
      const mensaje = `${contactoNombre}: ${ultimoMensaje.substring(0, 50)}${ultimoMensaje.length > 50 ? '...' : ''}`;
      const datos = {
        tipo: 'mensaje_whatsapp',
        conversacion_id: String(conversacionId),
        vendedor_id: String(vendedorId),
        contacto: contactoNombre
      };

      const resultado = await this.enviarNotificacionUsuario(
        vendedorId,
        titulo,
        mensaje,
        datos
      );

      console.log(`✅ Notificación de WhatsApp enviada a vendedor ${vendedorId}`);
      return resultado;
    } catch (error) {
      console.error('❌ Error notificando mensaje WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Revocar un token FCM (marcar como no válido)
   * @param {string} token
   */
  async revocarToken(token) {
    try {
      await db.query(
        'UPDATE user_fcm_tokens SET is_revoked = 1 WHERE token = ?',
        [token]
      );
      console.log('✅ Token revocado');
    } catch (error) {
      console.error('❌ Error revocando token:', error);
      throw error;
    }
  }

  /**
   * Obtener tokens activos de un usuario
   * @param {number} userId
   */
  async obtenerTokensUsuario(userId) {
    try {
      const [tokens] = await db.query(
        `SELECT token, device, platform, last_seen 
         FROM user_fcm_tokens 
         WHERE user_id = ? AND is_revoked = 0
         ORDER BY last_seen DESC`,
        [userId]
      );
      return tokens;
    } catch (error) {
      console.error('❌ Error obteniendo tokens:', error);
      throw error;
    }
  }

  /**
   * Eliminar token FCM
   * @param {string} token
   */
  async eliminarToken(token) {
    try {
      await db.query(
        'DELETE FROM user_fcm_tokens WHERE token = ?',
        [token]
      );
      console.log('✅ Token eliminado');
    } catch (error) {
      console.error('❌ Error eliminando token:', error);
      throw error;
    }
  }
}

module.exports = new NotificationsService();
