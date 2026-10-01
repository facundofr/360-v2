const db = require('../config/db');

const EMPRESA_NOMBRE = 'Cober | Medicina Privada';
const TOTAL_MENSAJES = 4;

// Minutos desde la asignación en los que debe salir cada mensaje (índice = mensaje-1).
// Mensaje 1 sale 15 min después del mensaje de cierre de la confirmación (no
// en el mismo instante). Mensaje 4 (chequeo de contacto, sin info) sale 30 min
// después del último mensaje informativo (mensaje 3).
const OFFSETS_MINUTOS = [15, 80, 160, 190];

const MENSAJES_TEXTO = {
  1: (nombre) =>
    `¡Hola ${nombre}! 👋 Mientras tu asesor de ${EMPRESA_NOMBRE} se pone en contacto, te contamos todo lo que podés hacer con la app: turnos en minutos, autorizaciones sin demoras, videoconsultas y más.\n\n👉 https://cobertouch.cober.online/#conoce`,
  2: (nombre) =>
    `${nombre}, te dejamos nuestros planes y precios para que los vayas mirando 📋\n\n👉 https://cober.online/#prices`,
  3: (nombre) =>
    `Para que compares en detalle qué incluye cada plan (especialistas, guardias, farmacia y más) armamos este comparador 👇\n\n👉 https://medicina-privada.online/cober360/index.html#comparar`,
};

const NutricionLeadsService = {
  TOTAL_MENSAJES,

  // ─── Arranque: se llama desde finalizarValidacion cuando status === 'urgente' ─
  // No manda nada acá — solo agenda el mensaje 1 para 15 min después. El cron
  // (procesarPendientes) es quien efectivamente lo manda, igual que el resto.
  async iniciarNutricion(prospecto, vendedorId) {
    const ahora = new Date();

    await db.query(
      `INSERT INTO validacion_nutricion (prospecto_id, vendedor_id, asignado_at, mensajes_enviados, proximo_envio_at)
       VALUES (?, ?, ?, 0, ?)`,
      [prospecto.id, vendedorId, ahora, new Date(ahora.getTime() + OFFSETS_MINUTOS[0] * 60000)]
    );
  },

  // ─── Lookup por teléfono (webhook entrante) ────────────────────────────────
  async buscarNutricionActivaPorTelefono(telefono) {
    const limpio = String(telefono || '').replace(/\D/g, '');
    if (!limpio) return null;
    const sufijo = limpio.slice(-10);

    const [rows] = await db.query(
      `SELECT n.*
       FROM validacion_nutricion n
       JOIN prospectos p ON p.id = n.prospecto_id
       WHERE n.activo = 1
         AND (
           REPLACE(p.numero_contacto, '+', '') = ?
           OR REPLACE(p.numero_contacto, '+', '') LIKE CONCAT('%', ?)
         )
       ORDER BY n.id DESC
       LIMIT 1`,
      [limpio, sufijo]
    );
    return rows[0] || null;
  },

  // ─── Cierre por confirmación positiva del usuario ("Sí, ya me contactaron") ─
  async confirmarContactoPorUsuario(nutricionId) {
    await db.query(
      `UPDATE validacion_nutricion SET activo = 0, motivo_cierre = 'usuario_confirmo' WHERE id = ?`,
      [nutricionId]
    );
  },

  // ─── Cierre por respuesta negativa ("No, todavía no") — pide disculpas y reavisa al vendedor ─
  async registrarFaltaDeContacto(nutricion) {
    const WhatsAppService = require('./whatsappService');
    const NotificationsService = require('./notificationsService');

    const [[prospecto]] = await db.query('SELECT * FROM prospectos WHERE id = ?', [nutricion.prospecto_id]);
    if (!prospecto) return;

    await db.query(
      `UPDATE validacion_nutricion SET activo = 0, motivo_cierre = 'usuario_nego_contacto' WHERE id = ?`,
      [nutricion.id]
    );

    await WhatsAppService.enviarMensaje(
      prospecto.numero_contacto,
      `Disculpá la demora, ${prospecto.nombre} 🙏 Ya le avisamos a tu asesor para que se comunique con vos a la brevedad.`,
      process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR
    );

    try {
      await NotificationsService.notificarAsignacionProspecto(nutricion.vendedor_id, {
        id: prospecto.id,
        nombre: prospecto.nombre,
        apellido: prospecto.apellido,
        numero_contacto: prospecto.numero_contacto,
        estado: 'Lead (validado - interesado)',
      });
    } catch (notificationError) {
      console.error('⚠️ Error re-notificando vendedor tras falta de contacto:', notificationError.message);
    }
  },

  // ─── Cron: manda el próximo mensaje pendiente o corta si el vendedor ya escribió ─
  async procesarPendientes() {
    const [pendientes] = await db.query(
      `SELECT * FROM validacion_nutricion WHERE activo = 1 AND proximo_envio_at <= NOW()`
    );

    for (const n of pendientes) {
      try {
        const [[yaContactado]] = await db.query(
          `SELECT cm.id
           FROM chat_mensajes cm
           JOIN chat_conversaciones_whatsapp cc ON cc.id = cm.conversacion_id
           WHERE cc.prospecto_id = ? AND cm.origen = 'vendedor' AND cm.tipo = 'enviado'
             AND cm.created_at > ?
           LIMIT 1`,
          [n.prospecto_id, n.asignado_at]
        );

        if (yaContactado) {
          await db.query(
            `UPDATE validacion_nutricion SET activo = 0, motivo_cierre = 'vendedor_contacto' WHERE id = ?`,
            [n.id]
          );
          continue;
        }

        const [[prospecto]] = await db.query('SELECT * FROM prospectos WHERE id = ?', [n.prospecto_id]);
        if (!prospecto) continue;

        const numeroMensaje = n.mensajes_enviados + 1;
        const WhatsAppService = require('./whatsappService');

        if (numeroMensaje < TOTAL_MENSAJES) {
          await WhatsAppService.enviarMensaje(
            prospecto.numero_contacto,
            MENSAJES_TEXTO[numeroMensaje](prospecto.nombre),
            process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR
          );
        } else {
          await WhatsAppService.enviarConTemplate(
            prospecto.numero_contacto,
            process.env.TWILIO_TEMPLATE_NUTRICION_CIERRE,
            { '1': prospecto.nombre, '2': EMPRESA_NOMBRE },
            process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR
          );
        }

        // Al mandar el cierre (mensaje 4) la fila sigue activa — recién se
        // desactiva cuando el usuario responde alguno de los dos botones
        // (webhook) o el vendedor le escribe por su cuenta (chequeo de arriba).
        // Si se pusiera activo=0 acá, el webhook ya no la encontraría y los
        // botones de la plantilla de cierre quedarían sin respuesta.
        const completado = numeroMensaje >= TOTAL_MENSAJES;
        const proximoEnvio = completado
          ? null
          : new Date(new Date(n.asignado_at).getTime() + OFFSETS_MINUTOS[numeroMensaje] * 60000);

        await db.query(
          `UPDATE validacion_nutricion SET mensajes_enviados = ?, proximo_envio_at = ? WHERE id = ?`,
          [numeroMensaje, proximoEnvio, n.id]
        );
      } catch (err) {
        console.error(`⚠️ Error procesando nutrición ${n.id}:`, err.message);
      }
    }
  },
};

module.exports = NutricionLeadsService;
