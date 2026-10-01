const db = require('../config/db');
const { sanitizarNombre } = require('../utils/nombreProspecto');

const BOT_VALIDADOR_USER_EMAIL = 'bot-validador@cober.internal';
const EMPRESA_NOMBRE = 'Cober | Medicina Privada';

const ESTADO_ESPERANDO_APERTURA = 'Pendiente validación WhatsApp';
const ESTADO_ESPERANDO_CONFIRMACION = 'Validación: esperando confirmación';

const TIPO_AFILIACION = {
  1: 'Particular/autónomo',
  2: 'Con recibo de sueldo',
  3: 'Monotributista',
};

function formatearTipoAfiliacion(tipoAfiliacionId) {
  return TIPO_AFILIACION[tipoAfiliacionId] || 'No especificado';
}

function formatearComposicionFamiliar(familiares) {
  if (!Array.isArray(familiares) || familiares.length === 0) {
    return 'Solo titular';
  }
  const conteo = {};
  for (const f of familiares) {
    const vinculo = f.vinculo || 'familiar';
    conteo[vinculo] = (conteo[vinculo] || 0) + 1;
  }
  const partes = Object.entries(conteo).map(([vinculo, cantidad]) =>
    cantidad > 1 ? `${cantidad} ${vinculo}s` : vinculo
  );
  return `Titular + ${partes.join(' + ')}`;
}

// ─── Normalización de respuestas del usuario (portado de bot-wss-baileys) ─────
// El chequeo negativo va primero en ambas: "no_interesado" contiene "interesado"
// como substring, e "incorrectos" contiene "correctos" — si se revisara la lista
// positiva primero, el botón negativo matchearía mal.

function normalizarAperturaResponse(text) {
  const t = (text || '').trim().toLowerCase();
  const si = ['interesado', 'si, estoy interesado', 'sí, estoy interesado', 'si', 'sí', 'me interesa'];
  const no = ['no_interesado', 'no, no estoy interesado', 'no', 'no me interesa'];
  if (no.some((k) => t === k || t.includes(k))) return 'NO_INTERESADO';
  if (si.some((k) => t === k || t.includes(k))) return 'INTERESADO';
  return null;
}

function normalizarConfirmacionResponse(text) {
  const t = (text || '').trim().toLowerCase();
  // Botones del template vigente (HX65e0778e58b6a5de91da10011b47291b), payload
  // ids 'urgente'/'averiguando': ya no preguntan si los datos están correctos,
  // preguntan urgencia de compra. Ambas respuestas son leads válidos.
  const urgente = ['urgente', 'lo antes posible'];
  const averiguando = ['averiguando', 'solo estoy averiguando'];
  if (averiguando.some((k) => t === k || t.includes(k))) return 'AVERIGUANDO';
  if (urgente.some((k) => t === k || t.includes(k))) return 'URGENTE';
  return null;
}

const ValidacionWhatsappService = {
  TIPO_AFILIACION,
  ESTADO_ESPERANDO_APERTURA,
  ESTADO_ESPERANDO_CONFIRMACION,
  formatearTipoAfiliacion,
  formatearComposicionFamiliar,

  // ─── Config (toggle + cupo) ────────────────────────────────────────────────

  async getConfig() {
    const [rows] = await db.query('SELECT * FROM validacion_whatsapp_config ORDER BY id LIMIT 1');
    return rows[0] || { activo: 0, cupo_diario: 20 };
  },

  async actualizarConfig({ activo, cupo_diario }) {
    const config = await this.getConfig();
    await db.query(
      'UPDATE validacion_whatsapp_config SET activo = ?, cupo_diario = ? WHERE id = ?',
      [activo ? 1 : 0, cupo_diario, config.id]
    );
    return this.getConfig();
  },

  // ─── Cupo diario (contador atómico, evita condiciones de carrera) ─────────

  async intentarReservarCupo(cupoDiario) {
    const hoy = new Date().toISOString().slice(0, 10);
    await db.query(
      'INSERT IGNORE INTO validacion_piloto_contador (fecha, contador) VALUES (?, 0)',
      [hoy]
    );
    const [result] = await db.query(
      'UPDATE validacion_piloto_contador SET contador = contador + 1 WHERE fecha = ? AND contador < ?',
      [hoy, cupoDiario]
    );
    return result.affectedRows > 0;
  },

  // ─── Usuario de sistema (dueño temporal de la conversación) ───────────────

  async getBotValidadorUserId() {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [BOT_VALIDADOR_USER_EMAIL]);
    if (!rows[0]) {
      throw new Error(
        `Usuario de sistema '${BOT_VALIDADOR_USER_EMAIL}' no encontrado. ¿Se ejecutó la migración 20260710_validador_whatsapp.sql?`
      );
    }
    return rows[0].id;
  },

  // ─── Búsqueda de prospecto en validación por teléfono (para el webhook) ───

  async buscarProspectoEnValidacionPorTelefono(telefono) {
    const limpio = String(telefono || '').replace(/\D/g, '');
    if (!limpio) return null;
    const sufijo = limpio.slice(-10);

    const [rows] = await db.query(
      `SELECT * FROM prospectos
       WHERE estado IN (?, ?)
         AND (
           REPLACE(numero_contacto, '+', '') = ?
           OR REPLACE(numero_contacto, '+', '') LIKE CONCAT('%', ?)
         )
       ORDER BY validacion_enviada_at DESC
       LIMIT 1`,
      [ESTADO_ESPERANDO_APERTURA, ESTADO_ESPERANDO_CONFIRMACION, limpio, sufijo]
    );
    return rows[0] || null;
  },

  // ─── Alta en frío: alguien escribe al validador sin lead previo (webhook) ─
  async crearProspectoDesdeWhatsappEntrante(telefono, nombreWhatsapp) {
    const numeroFormateado = String(telefono).startsWith('+') ? telefono : `+${telefono}`;
    // El ProfileName lo escribe el usuario en su teléfono y llega sin ninguna validación
    // de formato, a diferencia del formulario web. Se sanea antes de guardar porque este
    // nombre termina siendo el firmante en VaFirma. Ver utils/nombreProspecto.js
    const nombre = sanitizarNombre(nombreWhatsapp, 'Cliente');

    const [result] = await db.query(
      `INSERT INTO prospectos (nombre, apellido, numero_contacto, origen, estado, validacion_enviada_at)
       VALUES (?, '', ?, 'WhatsApp entrante', ?, NOW())`,
      [nombre, numeroFormateado, ESTADO_ESPERANDO_APERTURA]
    );
    const [[prospecto]] = await db.query('SELECT * FROM prospectos WHERE id = ?', [result.insertId]);
    return prospecto;
  },

  // ─── Persistencia de la conversación en chat_mensajes / chat_conversaciones ─

  async _obtenerOCrearConversacion(prospectoId, telefono) {
    const [existente] = await db.query(
      "SELECT id FROM chat_conversaciones_whatsapp WHERE prospecto_id = ? AND tipo_origen = 'validacion' ORDER BY id DESC LIMIT 1",
      [prospectoId]
    );
    if (existente[0]) return existente[0].id;

    const botUserId = await this.getBotValidadorUserId();
    const numeroConversacion = `VAL-${Date.now()}`;
    const [result] = await db.query(
      `INSERT INTO chat_conversaciones_whatsapp
       (numero_conversacion, telefono, prospecto_id, vendedor_id, estado, tipo_origen)
       VALUES (?, ?, ?, ?, 'activa', 'validacion')`,
      [numeroConversacion, telefono, prospectoId, botUserId]
    );
    return result.insertId;
  },

  async _registrarMensaje(prospectoId, telefono, { origen, tipo, mensaje }) {
    try {
      const conversacionId = await this._obtenerOCrearConversacion(prospectoId, telefono);
      await db.query(
        `INSERT INTO chat_mensajes (conversacion_id, mensaje, tipo, origen, estado_entrega, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [conversacionId, mensaje || '', tipo, origen, tipo === 'recibido' ? 'leido' : 'enviado']
      );
    } catch (err) {
      console.error('⚠️ Error registrando mensaje de validación en chat_mensajes:', err.message);
    }
  },

  // ─── Envío de templates/textos (usa el WhatsAppService ya existente) ──────

  async enviarTemplateApertura(prospecto) {
    const WhatsAppService = require('./whatsappService');
    // La plantilla aprobada (validador_datos_1) solo tiene {{1}}=nombre — el
    // nombre de empresa está fijo en el body, no es variable. Mandar una
    // variable extra no declarada hace que Twilio rechace el envío (63013).
    await WhatsAppService.enviarConTemplate(prospecto.numero_contacto, process.env.TWILIO_TEMPLATE_VALIDACION_APERTURA, {
      '1': prospecto.nombre,
    }, process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR);
    await this._registrarMensaje(prospecto.id, prospecto.numero_contacto, {
      origen: 'sistema', tipo: 'enviado', mensaje: '[Template: apertura validación]',
    });
  },

  async enviarTemplateConfirmacion(prospecto) {
    const WhatsAppService = require('./whatsappService');
    const [familiares] = await db.query('SELECT vinculo FROM familiares WHERE prospecto_id = ?', [prospecto.id]);

    await WhatsAppService.enviarConTemplate(prospecto.numero_contacto, process.env.TWILIO_TEMPLATE_VALIDACION_DATOS, {
      '1': prospecto.nombre,
      '2': `${prospecto.nombre} ${prospecto.apellido}`.trim(),
      '3': prospecto.edad != null ? String(prospecto.edad) : 'No especificada',
      '4': formatearTipoAfiliacion(prospecto.tipo_afiliacion_id),
      '5': prospecto.localidad || 'No especificado',
      '6': formatearComposicionFamiliar(familiares),
    }, process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR);
    await this._registrarMensaje(prospecto.id, prospecto.numero_contacto, {
      origen: 'sistema', tipo: 'enviado', mensaje: '[Template: confirmación de datos]',
    });
  },

  async _enviarTexto(prospecto, mensaje) {
    const WhatsAppService = require('./whatsappService');
    await WhatsAppService.enviarMensaje(prospecto.numero_contacto, mensaje, process.env.TWILIO_WHATSAPP_NUMBER_VALIDADOR);
    await this._registrarMensaje(prospecto.id, prospecto.numero_contacto, {
      origen: 'sistema', tipo: 'enviado', mensaje,
    });
  },

  // ─── Máquina de estados de 2 pasos (llamada desde el webhook entrante) ────

  async procesarRespuestaValidacion(prospecto, textoCrudo) {
    const texto = (textoCrudo || '').trim();

    await this._registrarMensaje(prospecto.id, prospecto.numero_contacto, {
      origen: 'cliente', tipo: 'recibido', mensaje: texto,
    });

    if (prospecto.estado === ESTADO_ESPERANDO_APERTURA) {
      const intent = normalizarAperturaResponse(texto);

      if (!intent) {
        await this._enviarTexto(
          prospecto,
          'Para continuar, indicá una de estas opciones:\n\n• *Sí, estoy interesado*\n• *No, no estoy interesado*'
        );
        return;
      }

      if (intent === 'NO_INTERESADO') {
        await this.finalizarValidacion(prospecto.id, { status: 'not_interested' });
        await this._enviarTexto(
          prospecto,
          `Entendido, ${prospecto.nombre}. Gracias por avisarnos 🙌\n\nDejamos registrada tu respuesta y no vamos a continuar con el contacto por este medio.\n\nSi más adelante querés conocer opciones de cobertura médica o revisar planes disponibles, ${EMPRESA_NOMBRE} va a estar para ayudarte.`
        );
        return;
      }

      // INTERESADO → pasa al paso de confirmación de datos
      await db.query('UPDATE prospectos SET estado = ? WHERE id = ?', [ESTADO_ESPERANDO_CONFIRMACION, prospecto.id]);
      await this.enviarTemplateConfirmacion(prospecto);
      return;
    }

    if (prospecto.estado === ESTADO_ESPERANDO_CONFIRMACION) {
      const intent = normalizarConfirmacionResponse(texto);

      if (!intent) {
        await this._enviarTexto(
          prospecto,
          'Para continuar, indicá una de estas opciones:\n\n• *Lo antes posible*\n• *Solo estoy averiguando*'
        );
        return;
      }

      if (intent === 'URGENTE') {
        await this.finalizarValidacion(prospecto.id, { status: 'urgente' });
        await this._enviarTexto(
          prospecto,
          `¡Perfecto, ${prospecto.nombre}! Ya confirmamos tus datos ✅\n\nUn asesor de ${EMPRESA_NOMBRE} se va a contactar a la brevedad para avanzar con tu consulta.`
        );
        return;
      }

      // AVERIGUANDO
      await this.finalizarValidacion(prospecto.id, { status: 'averiguando' });
      await this._enviarTexto(
        prospecto,
        `¡Genial, ${prospecto.nombre}! Ya confirmamos tus datos ✅\n\nUn asesor de ${EMPRESA_NOMBRE} se va a contactar para brindarte toda la información que necesites, sin ningún compromiso.`
      );
      return;
    }

    // Cualquier otro estado ya es terminal — no respondemos.
  },

  // ─── Cierre de la validación (confirmado / corrección / no interesado / timeout) ─

  /**
   * status: 'urgente' | 'averiguando' | 'timeout' | 'confirmed' | 'requires_correction' | 'not_interested'
   * ('confirmed'/'requires_correction' quedan solo por compatibilidad con el
   * callback externo dormido de bot-wss-baileys, ver formController.js)
   */
  async finalizarValidacion(prospectoId, { status, comentario }) {
    const FormLead = require('../models/formLead/formModel');
    const NotificationsService = require('./notificationsService');

    const [prospectoRows] = await db.query('SELECT * FROM prospectos WHERE id = ?', [prospectoId]);
    const prospecto = prospectoRows[0];
    if (!prospecto) throw new Error(`Prospecto ${prospectoId} no encontrado`);

    const ESTADO_ASIGNA_VENDEDOR = {
      urgente: 'Lead (validado - interesado)',
      averiguando: 'Lead (validado - averiguando)',
      confirmed: 'Lead',
      timeout: 'Lead (sin respuesta a validación)',
    };

    if (ESTADO_ASIGNA_VENDEDOR[status]) {
      const estadoFinal = ESTADO_ASIGNA_VENDEDOR[status];

      // Igual que en formController.js/createLead: si no hay vendedores
      // disponibles, el prospecto no puede quedar colgado en el estado de
      // validación para siempre — se marca como validado igual, sin vendedor,
      // y requiere asignación manual (misma convención que "Sin asignar" del
      // flujo normal, que tampoco reintenta solo).
      let vendedorId = null;
      try {
        vendedorId = await FormLead.autoasignarVendedor(prospectoId, 'Lead', comentario || null);
      } catch (asignacionError) {
        console.warn(`⚠️ No se pudo autoasignar vendedor para prospecto ${prospectoId} tras validación: ${asignacionError.message}`);
      }

      await db.query(
        'UPDATE prospectos SET validado = 1, estado = ?, validacion_resuelta_at = NOW() WHERE id = ?',
        [estadoFinal, prospectoId]
      );

      if (vendedorId) {
        // La conversación de validación (si existe) pasa del usuario de sistema al vendedor real.
        await db.query(
          "UPDATE chat_conversaciones_whatsapp SET vendedor_id = ? WHERE prospecto_id = ? AND tipo_origen = 'validacion'",
          [vendedorId, prospectoId]
        );

        try {
          await NotificationsService.notificarAsignacionProspecto(vendedorId, {
            id: prospectoId,
            nombre: prospecto.nombre,
            apellido: prospecto.apellido,
            numero_contacto: prospecto.numero_contacto,
            estado: estadoFinal,
          });
        } catch (notificationError) {
          console.error('⚠️ Error al notificar asignación post-validación:', notificationError.message);
        }

        // 🌱 Nutrición: solo la rama "urgente" recibe el drip de 4 mensajes hasta
        // que el vendedor le escriba o el lead confirme el contacto.
        if (status === 'urgente') {
          try {
            const NutricionLeadsService = require('./nutricionLeadsService');
            await NutricionLeadsService.iniciarNutricion(prospecto, vendedorId);
          } catch (nutricionError) {
            console.error('⚠️ Error al iniciar nutrición de lead:', nutricionError.message);
          }
        }
      } else {
        console.warn(`⚠️ Prospecto ${prospectoId} quedó validado (${estadoFinal}) sin vendedor asignado — requiere asignación manual`);
      }

      await this._sincronizarSheet(prospectoId);

      return { validado: true, vendedorId };
    }

    // requires_correction / not_interested: no se asigna vendedor
    const estado = status === 'requires_correction' ? 'Corregir datos' : 'No interesado';
    await db.query(
      'UPDATE prospectos SET validado = 0, estado = ?, validacion_resuelta_at = NOW() WHERE id = ?',
      [estado, prospectoId]
    );

    await this._sincronizarSheet(prospectoId);

    return { validado: false, vendedorId: null };
  },

  // Hay que re-sincronizar al cerrar la validación o la asignación posterior nunca
  // se refleja en el Sheet. Se usa agregarProspecto (upsert) y no
  // actualizarAsignacionEnSheet (update-only) porque los dos orígenes que llegan acá
  // no comparten el mismo punto de partida:
  //   - Lead de formulario: la fila ya existe, creada al ingresar con "Sin asignar"
  //     (formController.js/createLead) → acá se actualiza.
  //   - Alta en frío por WhatsApp (crearProspectoDesdeWhatsappEntrante): no hubo
  //     ingreso previo, así que no hay fila que actualizar. Con update-only estos
  //     leads no llegaban nunca al Sheet — actualizarProspectoEnSheet loguea un
  //     warning y no hace nada cuando no encuentra el id.
  async _sincronizarSheet(prospectoId) {
    try {
      const GoogleSheetsService = require('./googleSheetsService');
      await GoogleSheetsService.agregarProspecto(prospectoId);
    } catch (sheetsError) {
      console.error(`⚠️ Error sincronizando prospecto ${prospectoId} en Google Sheets tras validación:`, sheetsError.message);
    }
  },

  // ─── Métricas para el panel admin ──────────────────────────────────────────

  async getMetricas() {
    const config = await this.getConfig();
    const hoy = new Date().toISOString().slice(0, 10);

    const [[cupoHoy]] = await db.query(
      'SELECT contador FROM validacion_piloto_contador WHERE fecha = ?',
      [hoy]
    );

    const [[totales]] = await db.query(`
      SELECT
        COUNT(*) AS total_enviados,
        SUM(estado IN (?, ?)) AS pendientes,
        SUM(estado IN ('Lead', 'Lead (validado - interesado)', 'Lead (validado - averiguando)')) AS confirmados,
        SUM(estado = 'Lead (validado - interesado)') AS urgentes,
        SUM(estado = 'Lead (validado - averiguando)') AS averiguando,
        SUM(estado = 'Lead (sin respuesta a validación)') AS timeout,
        SUM(estado = 'Corregir datos') AS corregir,
        SUM(estado = 'No interesado') AS no_interesado,
        AVG(
          CASE WHEN validacion_resuelta_at IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, validacion_enviada_at, validacion_resuelta_at)
          END
        ) AS tiempo_promedio_respuesta_minutos
      FROM prospectos
      WHERE validacion_enviada_at IS NOT NULL
    `, [ESTADO_ESPERANDO_APERTURA, ESTADO_ESPERANDO_CONFIRMACION]);

    const [tendencia] = await db.query(`
      SELECT
        DATE(validacion_enviada_at) AS fecha,
        COUNT(*) AS enviados,
        SUM(estado IN ('Lead', 'Lead (validado - interesado)', 'Lead (validado - averiguando)')) AS confirmados
      FROM prospectos
      WHERE validacion_enviada_at IS NOT NULL
        AND validacion_enviada_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE(validacion_enviada_at)
      ORDER BY fecha ASC
    `);

    const totalEnviados = Number(totales.total_enviados) || 0;
    const pendientes = Number(totales.pendientes) || 0;
    const resueltos = totalEnviados - pendientes;
    const confirmados = Number(totales.confirmados) || 0;
    const timeout = Number(totales.timeout) || 0;
    const corregir = Number(totales.corregir) || 0;
    const noInteresado = Number(totales.no_interesado) || 0;

    const pct = (n) => (resueltos > 0 ? Math.round((n / resueltos) * 1000) / 10 : null);

    const porEstadoGestion = await this.getMetricasPostAsignacion();

    return {
      cupo: {
        activo: !!config.activo,
        cupo_diario: config.cupo_diario,
        usado_hoy: cupoHoy?.contador || 0,
      },
      totales: {
        total_enviados: totalEnviados,
        pendientes,
        confirmados,
        urgentes: Number(totales.urgentes) || 0,
        averiguando: Number(totales.averiguando) || 0,
        timeout,
        corregir,
        no_interesado: noInteresado,
      },
      tasa_confirmacion_pct: pct(confirmados),
      tasa_timeout_pct: pct(timeout),
      tasa_no_interesado_pct: pct(noInteresado),
      tasa_corregir_pct: pct(corregir),
      resueltos,
      tiempo_promedio_respuesta_minutos: totales.tiempo_promedio_respuesta_minutos != null
        ? Math.round(Number(totales.tiempo_promedio_respuesta_minutos))
        : null,
      tendencia: tendencia.map((t) => ({
        fecha: t.fecha instanceof Date ? t.fecha.toISOString().slice(0, 10) : t.fecha,
        enviados: Number(t.enviados) || 0,
        confirmados: Number(t.confirmados) || 0,
      })),
      porEstadoGestion,
    };
  },

  // ─── Qué pasa con los prospectos DESPUÉS de asignarse a un vendedor ───────
  // Cruza el resultado de la validación (urgente / averiguando / otros —
  // timeout u otro cierre legacy que igual asigna vendedor) con el estado de
  // gestión vigente en `asignaciones` (pipeline comercial del vendedor).

  async getMetricasPostAsignacion() {
    const [rows] = await db.query(`
      WITH a_latest AS (
        SELECT a.id_prospecto, a.estado,
               ROW_NUMBER() OVER (PARTITION BY a.id_prospecto ORDER BY a.fecha_asignacion DESC, a.id DESC) rn
        FROM asignaciones a
      )
      SELECT
        CASE
          WHEN p.estado = 'Lead (validado - interesado)' THEN 'urgente'
          WHEN p.estado = 'Lead (validado - averiguando)' THEN 'averiguando'
          ELSE 'otros'
        END AS bucket,
        COALESCE(al.estado, 'Sin gestión') AS estado_gestion,
        COUNT(*) AS total
      FROM prospectos p
      LEFT JOIN a_latest al ON al.id_prospecto = p.id AND al.rn = 1
      WHERE p.validado = 1
      GROUP BY bucket, estado_gestion
      ORDER BY bucket, total DESC
    `);

    const buckets = { urgente: [], averiguando: [], otros: [] };
    for (const r of rows) {
      const key = buckets[r.bucket] ? r.bucket : 'otros';
      buckets[key].push({ estado: r.estado_gestion, total: Number(r.total) || 0 });
    }
    return buckets;
  },

  // ─── Listado paginado de todos los números derivados al validador ────────

  async getProspectos({ page = 1, limit = 20, estado, search } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = ['p.validacion_enviada_at IS NOT NULL'];
    const params = [];
    if (estado) {
      where.push('p.estado = ?');
      params.push(estado);
    }
    if (search) {
      where.push('(p.numero_contacto LIKE ? OR p.nombre LIKE ? OR p.apellido LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM prospectos p WHERE ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `SELECT p.id, p.nombre, p.apellido, p.numero_contacto, p.estado, p.validado,
              p.validacion_enviada_at, p.validacion_resuelta_at,
              EXISTS(
                SELECT 1 FROM chat_conversaciones_whatsapp c
                WHERE c.prospecto_id = p.id AND c.tipo_origen = 'validacion'
              ) AS tiene_conversacion
       FROM prospectos p
       WHERE ${whereSql}
       ORDER BY p.validacion_enviada_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return {
      total: Number(total) || 0,
      page: pageNum,
      limit: limitNum,
      rows,
    };
  },

  // ─── Conversación completa de WhatsApp de un prospecto (solo lectura) ────

  async getConversacion(prospectoId) {
    const [[conversacion]] = await db.query(
      `SELECT id, numero_conversacion, telefono, estado, created_at
       FROM chat_conversaciones_whatsapp
       WHERE prospecto_id = ? AND tipo_origen = 'validacion'
       ORDER BY id DESC LIMIT 1`,
      [prospectoId]
    );
    if (!conversacion) return null;

    const [mensajes] = await db.query(
      `SELECT id, mensaje, tipo, origen, estado_entrega, created_at
       FROM chat_mensajes
       WHERE conversacion_id = ?
       ORDER BY created_at ASC, id ASC`,
      [conversacion.id]
    );

    const [[prospecto]] = await db.query(
      `SELECT id, nombre, apellido, numero_contacto, estado
       FROM prospectos WHERE id = ?`,
      [prospectoId]
    );

    return { prospecto, conversacion, mensajes };
  },
};

module.exports = ValidacionWhatsappService;
