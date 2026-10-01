const FormLead = require('../../models/formLead/formModel');
const db = require('../../config/db');
const NotificationsService = require('../../services/notificationsService');
const GoogleSheetsService = require('../../services/googleSheetsService');
const DuplicadosService = require('../../services/DuplicadosService');
const ReAsignacionAutomatica = require('../../models/ReAsignacionAutomatica');
const ValidacionWhatsappService = require('../../services/validacionWhatsappService');

const determinarTipoGrupoFamiliar = (familiares) => {
  if (!familiares || familiares.length === 0) return "INDIVIDUAL";
  const tienePareja = familiares.some(f => f.vinculo === "pareja/conyuge");
  if (tienePareja) return "CÓNYUGE";
  const tieneHijo = familiares.some(f => f.vinculo === "hijo/a");
  if (tieneHijo) return "HIJO";
  const tieneFamiliarCargo = familiares.some(f => f.vinculo === "familiar a cargo");
  if (tieneFamiliarCargo) return "FAMILIAR A CARGO";
  return "INDIVIDUAL";
};

const createLead = async (req, res) => {
  try {
    const data = req.body;

    // --- VALIDACIÓN DE DATOS DEL LEAD Y FAMILIARES ---
    // Validar datos del lead principal
    const erroresLead = FormLead.validarDatosLead(data);

    // Validar familiares si existen
    let erroresFamiliares = [];
    if (Array.isArray(data.familiares) && data.familiares.length > 0) {
      data.familiares.forEach((fam, idx) => {
        const errs = FormLead.validarFamiliar(fam);
        if (errs.length > 0) {
          erroresFamiliares.push(...errs.map(e => `Familiar #${idx + 1}: ${e}`));
        }
      });
    }

    // Si hay errores, devolverlos al frontend
    const todosErrores = [...erroresLead, ...erroresFamiliares];
    if (todosErrores.length > 0) {
      return res.status(400).json({
        message: "Error de validación",
        errores: todosErrores
      });
    }
    // --- FIN VALIDACIÓN ---

    // 1. Crear prospecto
    const prospectoResult = await FormLead.createLead(data);
    
    // Manejar resultado (puede ser ID simple o objeto con metadata de duplicado)
    let prospectoId;
    let esDuplicado = false;
    let motivoDuplicado = null;
    let prospectoOriginalId = null;

    if (typeof prospectoResult === 'object' && prospectoResult.esDuplicado) {
      prospectoId = prospectoResult.id;
      esDuplicado = true;
      motivoDuplicado = prospectoResult.motivoDuplicado;
      prospectoOriginalId = prospectoResult.prospectoOriginalId;
      console.log(`⚠️ Prospecto duplicado creado: ID ${prospectoId} - ${motivoDuplicado}`);
    } else {
      prospectoId = prospectoResult;
    }

    // 2. Guardar familiares si existen
    if (Array.isArray(data.familiares) && data.familiares.length > 0) {
      for (const fam of data.familiares) {
        await FormLead.addFamiliar(prospectoId, fam);
      }
    }

    // 3. Detectar tipo de grupo familiar y guardar en tabla grupos_familiares
    const tipoGrupo = determinarTipoGrupoFamiliar(data.familiares);
    await FormLead.guardarGrupoFamiliar(prospectoId, tipoGrupo);

    // 4. Detectar edad y verificar regla > 65
    const edadTitular = Number(data.edad);
    const esMayor65 = Number.isFinite(edadTitular) && edadTitular > 65;

    // 5. Actualizar estado en prospectos si es mayor de 65
    if (esMayor65) {
      await db.query(
        'UPDATE prospectos SET estado = ? WHERE id = ?',
        ['Fuera de edad', prospectoId]
      );
    }

    // 6. Reglas de asignación: No asignar si es mayor de 65 o es duplicado
    let asignado = false;
    let vendedorId = null;
    let estadoAsignacion = null;
    let derivadoAValidacion = false;

    // 🔍 Circuito de validación por WhatsApp: si está activo y hay cupo diario
    // disponible, el prospecto se manda a validar antes de asignarlo a un vendedor.
    if (!esMayor65 && !esDuplicado && data.numero_contacto) {
      try {
        const configValidacion = await ValidacionWhatsappService.getConfig();
        if (configValidacion.activo) {
          const entraAlCupo = await ValidacionWhatsappService.intentarReservarCupo(configValidacion.cupo_diario);
          if (entraAlCupo) {
            // Usar la fila recién insertada (ya con el teléfono normalizado por
            // FormLead.createLead) en vez de los campos crudos del formulario.
            const [[prospectoInsertado]] = await db.query(
              'SELECT * FROM prospectos WHERE id = ?',
              [prospectoId]
            );

            await ValidacionWhatsappService.enviarTemplateApertura(prospectoInsertado);

            await db.query(
              `UPDATE prospectos SET estado = 'Pendiente validación WhatsApp', validacion_enviada_at = NOW() WHERE id = ?`,
              [prospectoId]
            );

            derivadoAValidacion = true;
            estadoAsignacion = 'Pendiente validación WhatsApp';
            console.log(`📲 Prospecto ${prospectoId} derivado al validador de WhatsApp (cupo diario)`);
          }
        }
      } catch (validacionError) {
        // Si el bot no responde u otro error, el lead sigue el camino normal (no queda colgado)
        console.warn(`⚠️ No se pudo derivar prospecto ${prospectoId} al validador, sigue flujo normal: ${validacionError.message}`);
      }
    }

    // ⛔ La edad manda sobre cualquier otra rama: un mayor de 65 no se asigna nunca, ni como
    // dato nuevo ni como reingreso de dato repetido. Antes esta condición cubría sólo la
    // asignación normal y el `else if (esDuplicado)` de abajo no volvía a mirar la edad: como al
    // original +65 justamente NO se le asigna vendedor, evaluarReingreso lo leía como "nunca
    // trabajado" y reingresaba al duplicado asignándolo (pisando además su estado con 'Lead').
    // Alcanzaba con que la persona volviera a cargar el formulario para saltear la regla.
    if (esMayor65) {
      estadoAsignacion = 'Fuera de edad';
      console.info(`Prospecto ${prospectoId} con edad ${edadTitular} no será autoasignado por regla (>65)${esDuplicado ? ' - duplicado: tampoco reingresa' : ''}.`);
    } else if (!derivadoAValidacion && !esDuplicado) {
      try {
        vendedorId = await FormLead.autoasignarVendedor(prospectoId, data.estado, data.comentario);
        asignado = true;
        estadoAsignacion = data.estadoInicial || data.estado || 'Lead';

        // 📤 ENVIAR NOTIFICACIÓN DE ASIGNACIÓN
        try {
          const prospectoData = {
            id: prospectoId,
            nombre: data.nombre,
            apellido: data.apellido,
            numero_contacto: data.numero_contacto,
            estado: estadoAsignacion
          };
          await NotificationsService.notificarAsignacionProspecto(vendedorId, prospectoData);
          console.log(`📱 Notificación de asignación enviada al vendedor ${vendedorId}`);
        } catch (notificationError) {
          console.error('⚠️ Error al enviar notificación de asignación:', notificationError.message);
        }
      } catch (asignacionError) {
        // Si no hay vendedores disponibles u otro error, el lead se crea sin asignación
        console.warn(`⚠️ No se pudo autoasignar vendedor para prospecto ${prospectoId}: ${asignacionError.message}`);
        estadoAsignacion = 'Sin asignar';
      }
    } else if (derivadoAValidacion) {
      // Ya logueado arriba — la asignación queda pendiente del resultado de la validación
    } else {
      // 🔁 Evaluar si el original quedó "sin evolución" y este duplicado puede reingresar como dato nuevo
      const evaluacion = await DuplicadosService.evaluarReingreso(prospectoOriginalId);

      if (evaluacion.reingresable) {
        const nuevoVendedor = await ReAsignacionAutomatica.obtenerVendedorDisponible(evaluacion.idVendedorOriginal);

        if (nuevoVendedor) {
          // visible_refrito = 1: si el prospecto original ya tenía es_reciclado=1, garantiza que
          // esta nueva asignación sea visible de inmediato en el dashboard del nuevo vendedor
          // (ver filtro en prospectoModel.js findAll). Antes quedaba en el default 0 y el lead
          // reingresado se volvía invisible cuando es_reciclado no era 0.
          await db.query(
            `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado, visible_refrito)
             VALUES (?, ?, 'Lead', ?, NOW(), 1)`,
            [prospectoId, nuevoVendedor.id, `Reingreso automático - dato repetido sin evolución (${evaluacion.motivo})`]
          );

          const numeroNormalizado = FormLead.normalizarNumeroWhatsApp(data.numero_contacto);
          const [contadorRows] = await db.query(
            'SELECT COALESCE(MAX(veces_reciclado), 0) + 1 AS contador FROM prospectos WHERE numero_contacto = ?',
            [numeroNormalizado]
          );
          const vecesReciclado = contadorRows[0].contador;

          // No se marca es_reciclado para que el lead se vea de inmediato en el dashboard
          // del vendedor (como dato nuevo) en vez de quedar en la cola de refritos.
          await db.query(
            'UPDATE prospectos SET estado = ?, veces_reciclado = ? WHERE id = ?',
            ['Lead', vecesReciclado, prospectoId]
          );

          await db.query(
            `INSERT INTO reasignacion_auditoria (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, motivo, razon_automatica)
             VALUES (?, ?, ?, ?, ?)`,
            [prospectoId, evaluacion.idVendedorOriginal, nuevoVendedor.id, 'Reingreso automático de dato repetido', evaluacion.motivo]
          );

          asignado = true;
          vendedorId = nuevoVendedor.id;
          estadoAsignacion = 'Lead';

          try {
            await NotificationsService.notificarAsignacionProspecto(vendedorId, {
              id: prospectoId,
              nombre: data.nombre,
              apellido: data.apellido,
              numero_contacto: data.numero_contacto,
              estado: 'Lead'
            });
          } catch (notificationError) {
            console.error('⚠️ Error al enviar notificación de reingreso:', notificationError.message);
          }

          console.info(`Prospecto ${prospectoId} reingresado como dato nuevo y asignado a vendedor ${vendedorId}: ${evaluacion.motivo}`);
        } else {
          estadoAsignacion = 'Dato repetido';
          console.warn(`Prospecto ${prospectoId} era reingresable pero no hay vendedores disponibles - queda como Dato repetido`);
        }
      } else {
        estadoAsignacion = 'Dato repetido';
        console.info(`Prospecto ${prospectoId} marcado como duplicado: ${motivoDuplicado} - ${evaluacion.motivo}`);
      }
    }

    // 7. Generar cotización automática (SIEMPRE, excepto si > 65)
    let cotizado = false;
    if (!esMayor65) {
      // El prospecto ya está insertado (paso 1): si la cotización falla acá hay que
      // responder 201 igual. Antes un error de cotización (ej. un familiar > 65, que
      // categorias_edad no cubre) devolvía 500 y el compensador de leads reintentaba
      // cada hora desde su outbox, creando un prospecto nuevo en cada intento
      // (visto: 460 copias del mismo lead en Bariloche).
      try {
        await FormLead.cotizarLead(prospectoId);
        cotizado = true;
      } catch (cotizacionError) {
        console.error(`⚠️ Prospecto ${prospectoId} creado pero no se pudo cotizar:`, cotizacionError.message);
      }
    } else {
      console.info(`Prospecto ${prospectoId} con edad ${edadTitular} no será cotizado por regla (>65).`);
    }

    // ℹ️ RECOPILAR TODAS LAS ADVERTENCIAS (del modelo + middleware)
    const advertenciasModelo = await FormLead.validarDuplicados(data.correo, data.numero_contacto);
    const advertenciasMiddleware = req.duplicateWarnings || [];
    const todasAdvertencias = [...advertenciasMiddleware, ...advertenciasModelo];

    // La edad se evalúa primero: un +65 duplicado no se cotiza ni se asigna, así que el mensaje
    // de "dato repetido" (que da por hecho la cotización) no aplica.
    const message = esMayor65
      ? "Lead creado correctamente (sin asignación ni cotización por edad > 65)."
      : esDuplicado
      ? (asignado
        ? "Lead creado y cotizado correctamente (dato repetido reingresado y reasignado por falta de evolución del original)."
        : "Lead creado y cotizado correctamente (marcado como 'Dato repetido' - sin asignación de vendedor).")
      : "Lead creado, asignado y cotizado correctamente";

    // 📱 Registrar preferencia WhatsApp automáticamente para leads del flujo WA
    if (data.origen === 'flujo-wss') {
      try {
        await db.query(
          `INSERT INTO preferencias_entrega_cotizacion (prospecto_id, canal, numero_contacto, fecha_registro, estado)
           VALUES (?, 'whatsapp', ?, NOW(), 'pendiente')
           ON DUPLICATE KEY UPDATE canal = 'whatsapp', numero_contacto = VALUES(numero_contacto)`,
          [prospectoId, data.numero_contacto || null]
        );
        console.log(`📱 Preferencia WhatsApp registrada para prospecto ${prospectoId}`);
      } catch (prefError) {
        console.warn('⚠️ No se pudo registrar preferencia WhatsApp:', prefError.message);
      }
    }

    // 📊 SINCRONIZAR CON GOOGLE SHEETS (origen: Formulario Web)
    try {
      await GoogleSheetsService.agregarProspecto(prospectoId);
      console.log(`📊 Prospecto ${prospectoId} sincronizado con Google Sheets [${data.origen || 'Formulario Web'}]`);
    } catch (sheetsError) {
      console.error('⚠️ Error sincronizando con Google Sheets:', sheetsError.message);
      // No fallar la creación del prospecto si la sincronización falla
    }

    res.status(201).json({
      message,
      prospectoId,
      asignado,
      cotizado,
      esDuplicado,
      motivoDuplicado,
      estadoAsignacion,
      advertencias: todasAdvertencias.length > 0 ? todasAdvertencias : null
    });
  } catch (error) {
    console.error("Error al crear lead:", error);
    // Si el error es de validación lanzado desde el modelo
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({
        message: "Error de validación",
        errores: error.errores
      });
    }
    res.status(500).json({ message: "Error al crear el lead" });
  }
};

const getCotizaciones = async (req, res) => {
  try {
    const { id } = req.params;
    
    // En lugar de usar FormLead.cotizarLead(id), usa una consulta directa
    const [cotizaciones] = await db.query(`
      SELECT c.*, p.nombre AS plan_nombre
      FROM cotizaciones c
      LEFT JOIN planes p ON c.plan_id = p.id
      WHERE c.prospecto_id = ?
    `, [id]);
    
    // Para cada cotización, obtener sus detalles
    for (let i = 0; i < cotizaciones.length; i++) {
      const [detalles] = await db.query(`
        SELECT cd.*
        FROM cotizaciones_detalles cd
        WHERE cd.cotizacion_id = ?
      `, [cotizaciones[i].id]);
      
      cotizaciones[i].detalles = detalles;
    }
    
    res.status(200).json(cotizaciones);
  } catch (error) {
    console.error("Error al obtener cotizaciones:", error);
    res.status(500).json({ message: "Error al obtener las cotizaciones." });
  }
};

// 📞 Registrar preferencia de entrega de cotización
const registrarPreferenciaEntrega = async (req, res) => {
  try {
    const { id } = req.params;
    const { canal, numero_contacto, correo } = req.body;

    // Validar canal
    const canalesValidos = ['email', 'llamada', 'whatsapp'];
    if (!canal || !canalesValidos.includes(canal)) {
      return res.status(400).json({ message: "Canal de entrega no válido" });
    }

    // Validar que existe el prospecto
    const [prospecto] = await db.query('SELECT id, nombre, apellido FROM prospectos WHERE id = ?', [id]);
    if (!prospecto || prospecto.length === 0) {
      return res.status(404).json({ message: "Prospecto no encontrado" });
    }

    // Insertar preferencia
    const fechaRegistro = new Date();
    await db.query(
      `INSERT INTO preferencias_entrega_cotizacion (prospecto_id, canal, numero_contacto, correo, fecha_registro, estado)
       VALUES (?, ?, ?, ?, NOW(), 'pendiente')
       ON DUPLICATE KEY UPDATE
       canal = VALUES(canal),
       numero_contacto = VALUES(numero_contacto),
       correo = VALUES(correo),
       fecha_registro = NOW(),
       estado = 'pendiente'`,
      [id, canal, numero_contacto || null, correo || null]
    );

    console.log(`📋 Preferencia de entrega registrada - Prospecto: ${prospecto[0].nombre} ${prospecto[0].apellido}, Canal: ${canal}`);

    res.status(200).json({
      message: "Preferencia de entrega registrada exitosamente",
      canal,
      prospecto_id: id
    });
  } catch (error) {
    console.error("Error al registrar preferencia de entrega:", error);
    res.status(500).json({ message: "Error al registrar la preferencia de entrega" });
  }
};

// ─── Callback del validador de WhatsApp (bot-wss-baileys) ─────────────────────
//
// bot-wss-baileys llama a este endpoint cuando el prospecto termina el circuito
// de validación (confirmó los datos, pidió corregirlos, o dijo que no le interesa).
const recibirCallbackValidacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, phone } = req.body;

    const statusValidos = ['confirmed', 'requires_correction', 'not_interested'];
    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({ message: "Campo 'status' inválido o faltante" });
    }

    const [prospectoRows] = await db.query('SELECT id FROM prospectos WHERE id = ?', [id]);
    if (prospectoRows.length === 0) {
      return res.status(404).json({ message: "Prospecto no encontrado" });
    }

    const resultado = await ValidacionWhatsappService.finalizarValidacion(id, { status, phone });

    console.log(`✅ Callback de validación recibido para prospecto ${id}: status=${status}, validado=${resultado.validado}`);

    res.status(200).json({ message: "Callback procesado correctamente", ...resultado });
  } catch (error) {
    console.error("Error al procesar callback de validación:", error);
    res.status(500).json({ message: "Error al procesar el callback de validación" });
  }
};

module.exports = { createLead, getCotizaciones, registrarPreferenciaEntrega, recibirCallbackValidacion };