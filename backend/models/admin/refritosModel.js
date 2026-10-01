const db = require('../../config/db');
const validator = require('validator');
const FormLead = require('../formLead/formModel');
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');
const NotificationsService = require('../../services/notificationsService');
const DuplicadosService = require('../../services/DuplicadosService');

// 🌎 NORMALIZACIÓN DE NÚMEROS PARA WHATSAPP ARGENTINA
const normalizarNumeroWhatsApp = (numero) => {
  if (!numero) return null;
  
  let numerolimpio = numero.replace(/[\s\(\)\-\+]/g, '');
  
  if (numerolimpio.length < 10) {
    return numero;
  }
  
  if (numerolimpio.startsWith('0')) {
    numerolimpio = '54' + numerolimpio.substring(1);
  }
  else if (numerolimpio.startsWith('54')) {
    // Ya tiene formato correcto
  }
  else {
    if (numerolimpio.length === 11 && numerolimpio.startsWith('11')) {
      numerolimpio = '54' + numerolimpio;
    }
    else if (numerolimpio.length === 10) {
      const areaCode = numerolimpio.substring(0, 2);
      const areaCodeNum = parseInt(areaCode);
      
      if (areaCodeNum >= 21 && areaCodeNum <= 89) {
        numerolimpio = '54' + numerolimpio;
      } else {
        numerolimpio = '54' + numerolimpio;
      }
    }
    else if (numerolimpio.length === 9) {
      numerolimpio = '541' + numerolimpio;
    }
  }
  
  return '+' + numerolimpio;
};

const RefritosModel = {
  /**
   * 📊 PROCESAR ARCHIVO CSV/XLS CON REFRITOS
   * 1. Valida cada fila de datos
   * 2. Omite la validación de duplicados (marca como reciclado)
   * 3. Ingresa todos los datos en la tabla prospectos
   * 4. Distribuye los refritos entre vendedores activos (round-robin)
   * 5. Marca cada prospecto como reciclado
   */
  async procesarArchivoRefritos(datosArray, onProgreso = null) {
    const resultados = {
      exitosos: [],
      errores: [],
      totalProcesados: 0
    };

    // Validar que hay datos
    if (!Array.isArray(datosArray) || datosArray.length === 0) {
      throw new Error("El archivo no contiene datos válidos");
    }

    // Obtener vendedores activos disponibles
    const [vendedoresActivos] = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email
      FROM users u
      WHERE u.role = 1
        AND u.is_enabled = 1
      ORDER BY u.id ASC
    `);

    if (vendedoresActivos.length === 0) {
      throw new Error("No hay vendedores activos disponibles para asignar refritos");
    }

    let indiceVendedor = 0;

    for (let i = 0; i < datosArray.length; i++) {
      const fila = datosArray[i];
      
      try {
        // Validar estructura mínima de datos
        const erroresValidacion = this.validarFilaRefrito(fila);
        if (erroresValidacion.length > 0) {
          resultados.errores.push({
            fila: i + 1,
            nombre: fila.nombre || 'Sin nombre',
            errores: erroresValidacion
          });
          continue;
        }

        // ⛔ Regla de edad: no se recicla ni se asigna un dato de más de 65 años (mismo criterio
        // que el formulario web y Vendedor-App). Se reporta como error de fila para que quede
        // visible en el resumen de la carga.
        const edadRefrito = Number(fila.edad);
        if (Number.isFinite(edadRefrito) && edadRefrito > 65) {
          resultados.errores.push({
            fila: i + 1,
            nombre: fila.nombre || 'Sin nombre',
            error: `Fuera de edad (${edadRefrito} años) - no se asigna por regla de +65`
          });
          continue;
        }

        // ============================================================
        // 🔍 VERIFICAR SI EL PROSPECTO YA EXISTE (OPCIÓN A: TRANSFERENCIA)
        // ============================================================
        const duplicado = await this.verificarDuplicado(fila.numero_contacto);
        let prospectoId;
        let esDuplicado = false;
        let vendedorAnterior = null;
        let evaluacionRefrito = null;

        if (duplicado) {
          // ✅ PROSPECTO YA EXISTE - Usar ID existente
          esDuplicado = true;
          prospectoId = duplicado.id;
          console.log(`📌 Refrito duplicado detectado: ID ${prospectoId} (${fila.nombre} ${fila.apellido})`);

          // ♻️ Marcar duplicado como reciclado para que cuente en estadísticas y muestre badge
          await db.query(
            `UPDATE prospectos
             SET es_reciclado = 1,
                 origen = CASE WHEN origen IS NULL OR origen = '' THEN 'Refrito - Reasignación' ELSE origen END
             WHERE id = ?`,
            [prospectoId]
          );

          // 🔒 Salvaguarda: mismo criterio que el formulario web y Vendedor-App (DuplicadosService)
          // Solo se reasigna si el original quedó "sin evolución" (Lead/1º Contacto/No contesta) por 14+ días
          evaluacionRefrito = await DuplicadosService.evaluarReingreso(prospectoId);
          if (!evaluacionRefrito.reingresable) {
            resultados.errores.push({
              fila: i + 1,
              nombre: fila.nombre || 'Sin nombre',
              error: `Duplicado no reingresable - ${evaluacionRefrito.motivo}`
            });
            // No continuar con asignación para este duplicado
            continue;
          }
        } else {
          // ❌ PROSPECTO NUEVO - Crear registro
          prospectoId = await this.crearProspectoReciclado(fila);

          // Agregar familiares si existen
          if (Array.isArray(fila.familiares) && fila.familiares.length > 0) {
            for (const familiar of fila.familiares) {
              try {
                const erroresFamiliar = FormLead.validarFamiliar(familiar);
                if (erroresFamiliar.length === 0) {
                  await FormLead.addFamiliar(prospectoId, familiar);
                }
              } catch (famError) {
                console.warn(`⚠️  Error al agregar familiar a prospecto ${prospectoId}:`, famError.message);
              }
            }
          }

          // Detectar tipo de grupo familiar
          const tipoGrupo = this.determinarTipoGrupoFamiliar(fila.familiares);
          await FormLead.guardarGrupoFamiliar(prospectoId, tipoGrupo);
        }

        // --- DISTRIBUIR A VENDEDOR (ROUND-ROBIN) ---
        const vendedor = vendedoresActivos[indiceVendedor];
        
        if (esDuplicado) {
          vendedorAnterior = evaluacionRefrito.idVendedorOriginal;
        }

        // 🔍 Verificar si este vendedor ya tiene un refrito visible
        const refritoVisibleActual = await RefritosVisibilityService.obtenerRefritoVisible(vendedor.id);
        const debeSerVisible = !refritoVisibleActual; // Solo visible si no tiene otro

        // Crear nueva asignación con control de visibilidad
        const [insertAsig] = await db.query(
          `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado, visible_refrito)
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [
            prospectoId,
            vendedor.id,
            'Lead',
            esDuplicado ? 'Refrito - Reasignación de prospecto existente' : 'Refrito - Campaña de reciclado',
            debeSerVisible ? 1 : 0
          ]
        );

        // 📊 Trackear reingreso y auditar (mismo criterio que Formulario Web y Vendedor-App)
        if (esDuplicado) {
          const numeroNormalizadoContador = normalizarNumeroWhatsApp(fila.numero_contacto);
          const [contadorRows] = await db.query(
            'SELECT COALESCE(MAX(veces_reciclado), 0) + 1 AS contador FROM prospectos WHERE numero_contacto = ?',
            [numeroNormalizadoContador]
          );
          await db.query(
            'UPDATE prospectos SET veces_reciclado = ? WHERE id = ?',
            [contadorRows[0].contador, prospectoId]
          );
          await db.query(
            `INSERT INTO reasignacion_auditoria (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, motivo, razon_automatica)
             VALUES (?, ?, ?, ?, ?)`,
            [prospectoId, vendedorAnterior, vendedor.id, 'Reingreso de dato repetido desde Refritos (CSV)', evaluacionRefrito.motivo]
          );
        }

        // 🔔 Notificar al vendedor si el refrito quedó visible
        if (debeSerVisible) {
          try {
            const [pRows] = await db.query(
              'SELECT id, nombre, apellido, numero_contacto, estado FROM prospectos WHERE id = ? LIMIT 1',
              [prospectoId]
            );
            if (pRows && pRows.length > 0) {
              await NotificationsService.notificarAsignacionProspecto(vendedor.id, pRows[0]);
            }
          } catch (nerr) {
            console.warn('⚠️  No se pudo enviar notificación FCM de asignación de refrito:', nerr.message);
          }
        }

        // ============================================================
        // 💬 OPCIÓN A: TRANSFERIR CONVERSACIÓN WHATSAPP SI EXISTE
        // ============================================================
        if (esDuplicado) {
          const conversacionActual = await this.obtenerConversacionActual(prospectoId);
          if (conversacionActual) {
            console.log(`💬 Transferiendo conversación WhatsApp del prospecto ${prospectoId}...`);
            await this.transferirConversacionWhatsApp(prospectoId, vendedor.id, vendedorAnterior);
          }
        }

        // Avanzar al siguiente vendedor (round-robin)
        indiceVendedor = (indiceVendedor + 1) % vendedoresActivos.length;

        // --- GENERAR COTIZACIÓN AUTOMÁTICA (solo si es nuevo) ---
        if (!esDuplicado) {
          try {
            await FormLead.cotizarLead(prospectoId);
          } catch (cotizError) {
            console.warn(`⚠️  Error al generar cotización para prospecto ${prospectoId}:`, cotizError.message);
          }
        }

        resultados.exitosos.push({
          fila: i + 1,
          prospectoId,
          nombre: fila.nombre,
          apellido: fila.apellido,
          vendedorAsignado: `${vendedor.first_name} ${vendedor.last_name}`,
          vendedorId: vendedor.id,
          esDuplicado: esDuplicado,
          vendedorAnterior: vendedorAnterior,
          conversacionTransferida: esDuplicado && await this.obtenerConversacionActual(prospectoId) ? true : false,
          estado: esDuplicado ? 'Reasignado como Reciclado' : 'Ingresado como Reciclado'
        });

        resultados.totalProcesados++;

      } catch (error) {
        resultados.errores.push({
          fila: i + 1,
          nombre: fila.nombre || 'Sin nombre',
          error: error.message
        });
      } finally {
        if (onProgreso) onProgreso(i + 1);
      }
    }

    return resultados;
  },

  /**
   * 🔍 VALIDAR ESTRUCTURA DE FILA REFRITO
   */
  validarFilaRefrito(fila) {
    const errores = [];

    // Validar nombre
    if (!fila.nombre || typeof fila.nombre !== 'string' || fila.nombre.length < 2) {
      errores.push("Nombre inválido o vacío");
    }

    // Validar apellido (opcional: si no viene se deja vacío)
    if (fila.apellido && (typeof fila.apellido !== 'string' || fila.apellido.length < 2)) {
      errores.push("Apellido inválido");
    }

    // Validar número de contacto (mínimo 10 dígitos útiles)
    if (!fila.numero_contacto || typeof fila.numero_contacto !== 'string') {
      errores.push("Número de contacto inválido o vacío");
    } else {
      const soloDigitos = fila.numero_contacto.replace(/\D/g, '');
      if (soloDigitos.length < 10) {
        errores.push("Número de contacto inválido: debe contener al menos 10 dígitos");
      }
    }

    // Validar localidad (opcional: si no viene se usa 'Sin especificar')
    if (!fila.localidad || typeof fila.localidad !== 'string' || fila.localidad.length < 2) {
      fila.localidad = 'Sin especificar';
    }

    // Validar email (OPCIONAL: si viene debe ser válido)
    if (fila.correo && fila.correo.toString().trim() !== '' && !validator.isEmail(fila.correo.toString().trim())) {
      errores.push("Correo electrónico inválido");
    }

    // Validar edad (OBLIGATORIA)
    if (!fila.edad || !validator.isInt(fila.edad.toString(), { min: 1, max: 120 })) {
      errores.push('Edad es obligatoria y debe ser un número entre 1 y 120 años');
    }

    // Tipo de afiliación: por defecto 1 (Particular/Autónomo) si no viene
    if (!fila.tipo_afiliacion_id || isNaN(fila.tipo_afiliacion_id)) {
      fila.tipo_afiliacion_id = 1;
    }

    return errores;
  },

  /**
   * � VERIFICAR SI PROSPECTO YA EXISTE (DUPLICADO)
   */
  async verificarDuplicado(numeroContacto) {
    const numeroNormalizado = normalizarNumeroWhatsApp(numeroContacto);
    const [resultado] = await db.query(
      'SELECT id, es_reciclado FROM prospectos WHERE numero_contacto = ? LIMIT 1',
      [numeroNormalizado]
    );
    return resultado && resultado.length > 0 ? resultado[0] : null;
  },

  /**
   * 💬 OBTENER CONVERSACIÓN WHATSAPP ACTUAL
   */
  async obtenerConversacionActual(prospectoId) {
    const [conversacion] = await db.query(
      `SELECT * FROM chat_conversaciones_whatsapp
       WHERE prospecto_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [prospectoId]
    );
    return conversacion && conversacion.length > 0 ? conversacion[0] : null;
  },

  /**
   * 🔄 TRANSFERIR CONVERSACIÓN WHATSAPP AL NUEVO VENDEDOR
   */
  async transferirConversacionWhatsApp(prospectoId, nuevoVendedorId, vendedorAnteriorId = null) {
    try {
      // Actualizar la conversación para que pertenezca al nuevo vendedor
      const queryTransferencia = `
        UPDATE chat_conversaciones_whatsapp 
        SET vendedor_id = ?, estado = 'activa'
        WHERE prospecto_id = ?
      `;
      await db.query(queryTransferencia, [nuevoVendedorId, prospectoId]);

      // Agregar mensaje de sistema en la conversación notificando el cambio
      const [conversacion] = await db.query(
        'SELECT id FROM chat_conversaciones_whatsapp WHERE prospecto_id = ? ORDER BY created_at DESC LIMIT 1',
        [prospectoId]
      );

      if (conversacion && conversacion.length > 0) {
        const mensajeNotificacion = vendedorAnteriorId 
          ? `Prospecto reasignado a nuevo vendedor. Anteriormente atendido por vendedor ID: ${vendedorAnteriorId}`
          : `Prospecto transferido a nuevo vendedor para seguimiento de reciclado`;

        await db.query(
          `INSERT INTO chat_mensajes (conversacion_id, tipo, contenido, created_at)
           VALUES (?, ?, ?, NOW())`,
          [conversacion[0].id, 'sistema', mensajeNotificacion]
        );
      }

      console.log(`✅ Conversación WhatsApp del prospecto ${prospectoId} transferida al vendedor ${nuevoVendedorId}`);
      return true;
    } catch (error) {
      console.warn(`⚠️  Error al transferir conversación WhatsApp: ${error.message}`);
      return false;
    }
  },

  /**
   * 💾 CREAR PROSPECTO RECICLADO
   * Omite validación de duplicados, marca como reciclado
   * ✅ AHORA MANEJA TRANSFERENCIA DE CONVERSACIÓN WHATSAPP
   */
  async crearProspectoReciclado(fila) {
    // Validación de datos
    const errores = FormLead.validarDatosLead(fila);
    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }

    // Sanitización (igual que en FormModel)
    const nombre = validator.escape(fila.nombre);
    const apellido = validator.escape(fila.apellido);
    const numero_contacto = normalizarNumeroWhatsApp(fila.numero_contacto);
    const correo = fila.correo ? validator.normalizeEmail(fila.correo) : null;
    const localidad = validator.escape(fila.localidad);
    const comentario = fila.comentario || null;

    const edad = fila.edad ? Number(fila.edad) : null;
    const tipo_afiliacion_id = Number(fila.tipo_afiliacion_id) || 1; // default Particular/Autónomo
    const sueldo_bruto = fila.sueldo_bruto ? Number(fila.sueldo_bruto) : null;
    const categoria_monotributo = fila.categoria_monotributo ? validator.escape(fila.categoria_monotributo) : null;

    // Insertar prospecto marcado como RECICLADO
    const [result] = await db.query(
      `INSERT INTO prospectos 
        (nombre, apellido, edad, tipo_afiliacion_id, sueldo_bruto, categoria_monotributo, 
         numero_contacto, correo, localidad, comentario, estado, es_reciclado, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        apellido,
        edad,
        tipo_afiliacion_id,
        sueldo_bruto,
        categoria_monotributo,
        numero_contacto,
        correo,
        localidad,
        comentario,
        'Lead',
        true, // ✅ MARCADO COMO RECICLADO
        'Refrito - Campaña'
      ]
    );

    return result.insertId;
  },

  /**
   * 📱 REASIGNAR REFRITO NO CONTACTADO
   * Cuando un vendedor marca como "No contesta", reasignar a siguiente vendedor
   * ✅ AHORA TRANSFIERE LA CONVERSACIÓN WHATSAPP TAMBIÉN
   */
  async reasignarRefritoNoContactado(prospectoId) {
    // Validar que es reciclado
    const [prospecto] = await db.query(
      'SELECT es_reciclado FROM prospectos WHERE id = ?',
      [prospectoId]
    );

    if (!prospecto || prospecto.length === 0 || !prospecto[0].es_reciclado) {
      throw new Error("Este prospecto no es un reciclado o no existe");
    }

    // Obtener asignación actual (incluyendo visible_refrito para saber si hay que promover el siguiente)
    const [asignacionActual] = await db.query(
      'SELECT id, id_vendedor, visible_refrito FROM asignaciones WHERE id_prospecto = ? ORDER BY fecha_asignacion DESC LIMIT 1',
      [prospectoId]
    );

    if (!asignacionActual || asignacionActual.length === 0) {
      throw new Error("No hay asignación registrada para este prospecto");
    }

    const vendedorActual = asignacionActual[0].id_vendedor;

    // Obtener vendedores activos
    const [vendedoresActivos] = await db.query(`
      SELECT u.id
      FROM users u
      WHERE u.role = 1
        AND u.is_enabled = 1
      ORDER BY u.id ASC
    `);

    if (vendedoresActivos.length === 0) {
      throw new Error("No hay vendedores disponibles");
    }

    // Encontrar siguiente vendedor
    let indiceActual = vendedoresActivos.findIndex(v => v.id === vendedorActual);
    if (indiceActual === -1) indiceActual = 0;

    const siguienteIndice = (indiceActual + 1) % vendedoresActivos.length;
    const vendedorSiguiente = vendedoresActivos[siguienteIndice];

    // Actualizar la asignación del vendedor actual a 'No contesta' antes de crear la nueva
    await db.query(
      `UPDATE asignaciones SET estado = 'No contesta', fecha_estado = NOW()
       WHERE id_prospecto = ? AND id_vendedor = ? AND estado = 'Lead'`,
      [prospectoId, vendedorActual]
    );

    // 🔍 Verificar si este vendedor ya tiene un refrito visible
    const refritoVisibleActual = await RefritosVisibilityService.obtenerRefritoVisible(vendedorSiguiente.id);
    const debeSerVisible = !refritoVisibleActual; // Solo visible si no tiene otro

    // Crear nueva asignación con control de visibilidad
    await db.query(
      `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado, visible_refrito)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [
        prospectoId,
        vendedorSiguiente.id,
        'Lead',
        'Reasignado - No contactado en intento anterior',
        debeSerVisible ? 1 : 0
      ]
    );

    // ============================================================
    // 💬 OPCIÓN A: TRANSFERIR CONVERSACIÓN WHATSAPP AL NUEVO VENDEDOR
    // ============================================================
    const conversacionActual = await this.obtenerConversacionActual(prospectoId);
    if (conversacionActual) {
      console.log(`💬 Transferiendo conversación WhatsApp del prospecto ${prospectoId} al nuevo vendedor...`);
      await this.transferirConversacionWhatsApp(prospectoId, vendedorSiguiente.id, vendedorActual);
    }

    // 🔄 Si el refrito reasignado era visible para el vendedor anterior, promover el siguiente de su cola
    if (asignacionActual[0].visible_refrito === 1) {
      try {
        await RefritosVisibilityService.promoverSiguienteRefrito(vendedorActual);
        console.log(`✅ Siguiente refrito promovido para vendedor ${vendedorActual} tras reasignación admin`);
      } catch (err) {
        console.warn('⚠️ No se pudo promover siguiente refrito tras reasignación admin:', err.message);
      }
    }

    return {
      prospectoId,
      vendedorAnterior: vendedorActual,
      vendedorNuevo: vendedorSiguiente.id,
      conversacionTransferida: conversacionActual ? true : false,
      mensaje: `Refrito reasignado exitosamente al vendedor ${vendedorSiguiente.id}. Conversación WhatsApp transferida.`
    };
  },

  /**
   * ❌ ELIMINAR REFRITO SIN CONTACTO
   * Si ha pasado por todos los vendedores sin contacto, eliminarlo del flujo
   */
  async eliminarRefritoSinContacto(prospectoId) {
    // Marcar como "No contesta" y sacar del flujo
    await db.query(
      'UPDATE prospectos SET estado = ? WHERE id = ?',
      ['No contesta', prospectoId]
    );

    console.log(`🗑️  Refrito ${prospectoId} marcado como "No contesta" - Eliminado del flujo`);
  },

  /**
   * 📋 OBTENER HISTORIAL DE ASIGNACIONES DE REFRITO
   */
  async obtenerHistorialRefrito(prospectoId) {
    const [asignaciones] = await db.query(`
      SELECT 
        a.id,
        a.id_vendedor,
        CONCAT(u.first_name, ' ', u.last_name) as vendedor,
        a.estado,
        a.fecha_asignacion,
        a.comentario
      FROM asignaciones a
      LEFT JOIN users u ON a.id_vendedor = u.id
      WHERE a.id_prospecto = ?
      ORDER BY a.fecha_asignacion DESC
    `, [prospectoId]);

    return asignaciones;
  },

  /**
   * 🎯 OBTENER ESTADÍSTICAS DE REFRITOS
   */
  async obtenerEstadisticasRefritos() {
    const [stats] = await db.query(`
      SELECT
        COUNT(DISTINCT p.id) as total_refritos,
        SUM(CASE WHEN a.estado = 'Lead' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN a.estado = 'Venta' THEN 1 ELSE 0 END) as ventas,
        SUM(CASE WHEN a.estado = 'No contesta' THEN 1 ELSE 0 END) as sin_contacto,
        SUM(CASE WHEN a.estado = '1º Contacto' THEN 1 ELSE 0 END) as contactados
      FROM prospectos p
      INNER JOIN asignaciones a ON p.id = a.id_prospecto
      WHERE p.es_reciclado = true
        AND a.id = (SELECT MAX(id) FROM asignaciones WHERE id_prospecto = p.id)
    `);

    // Desglose por estado y visibilidad
    const [desglose] = await db.query(`
      SELECT a.estado, a.visible_refrito, COUNT(*) as total
      FROM asignaciones a
      INNER JOIN prospectos p ON p.id = a.id_prospecto
      WHERE p.es_reciclado = 1
      GROUP BY a.estado, a.visible_refrito
      ORDER BY a.estado, a.visible_refrito
    `);

    const resultado = stats[0] || {
      total_refritos: 0,
      pendientes: 0,
      ventas: 0,
      sin_contacto: 0,
      contactados: 0
    };

    resultado.desglose_por_estado = desglose;

    return resultado;
  },

  /**
   * 🏆 OBTENER REFRITOS ASIGNADOS A UN VENDEDOR
   */
  async obtenerRefritosVendedor(vendedorId) {
    const [refritos] = await db.query(`
      SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.numero_contacto,
        p.correo,
        p.localidad,
        a.estado,
        p.es_reciclado,
        a.fecha_asignacion,
        COUNT(a2.id) as intentos_asignacion
      FROM prospectos p
      INNER JOIN asignaciones a ON p.id = a.id_prospecto
      LEFT JOIN asignaciones a2 ON p.id = a2.id_prospecto
      WHERE p.es_reciclado = true
        AND a.id_vendedor = ?
        AND a.id = (
          SELECT MAX(id) FROM asignaciones WHERE id_prospecto = p.id
        )
      GROUP BY p.id
      ORDER BY a.fecha_asignacion DESC
    `, [vendedorId]);

    return refritos;
  },

  /**
   * 📋 OBTENER TODOS LOS REFRITOS CON ASIGNACIÓN ACTUAL
   */
  async obtenerTodosRefritos() {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.numero_contacto,
        p.correo,
        p.localidad,
        a.estado,
        a.id_vendedor,
        CONCAT(u.first_name, ' ', u.last_name) AS vendedor,
        a.fecha_asignacion,
        a.comentario,
        (SELECT COUNT(DISTINCT id_vendedor) FROM asignaciones WHERE id_prospecto = p.id) AS total_intentos
      FROM prospectos p
      INNER JOIN asignaciones a ON p.id = a.id_prospecto
      INNER JOIN users u ON a.id_vendedor = u.id
      WHERE p.es_reciclado = true
        AND a.id = (
          SELECT MAX(id) FROM asignaciones WHERE id_prospecto = p.id
        )
      ORDER BY a.fecha_asignacion DESC
    `);
    return rows || [];
  },

  /**
   * 🔄 DETERMINAR TIPO DE GRUPO FAMILIAR
   */
  determinarTipoGrupoFamiliar(familiares) {
    if (!familiares || familiares.length === 0) return "INDIVIDUAL";
    
    const tienePareja = familiares.some(f => f.vinculo === "pareja/conyuge");
    if (tienePareja) return "CÓNYUGE";
    
    const tieneHijo = familiares.some(f => f.vinculo === "hijo/a");
    if (tieneHijo) return "HIJO";
    
    const tieneFamiliarCargo = familiares.some(f => f.vinculo === "familiar a cargo");
    if (tieneFamiliarCargo) return "FAMILIAR A CARGO";
    
    return "INDIVIDUAL";
  },

  /**
   * 📊 OBTENER REPORTE DE ASIGNACIONES POR VENDEDOR
   * Devuelve estado completo de refritos para cada vendedor
   */
  async obtenerReportePorVendedor() {
    const [vendedores] = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        COALESCE(SUM(CASE WHEN a.estado = 'Lead' AND a.visible_refrito = 1 THEN 1 ELSE 0 END), 0) as visible_actual,
        COALESCE(SUM(CASE WHEN a.estado = 'Lead' AND a.visible_refrito = 0 THEN 1 ELSE 0 END), 0) as en_cola,
        COALESCE(SUM(CASE WHEN a.estado = 'No contesta' THEN 1 ELSE 0 END), 0) as no_contesta,
        COALESCE(SUM(CASE WHEN a.estado NOT IN ('Lead', 'No contesta') THEN 1 ELSE 0 END), 0) as otros_estados,
        COUNT(a.id) as total_asignaciones
      FROM users u
      LEFT JOIN (
        SELECT asig.*
        FROM asignaciones asig
        INNER JOIN prospectos p ON p.id = asig.id_prospecto AND p.es_reciclado = 1
      ) a ON a.id_vendedor = u.id
      WHERE u.role = 1 AND u.is_enabled = 1
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY u.first_name ASC
    `);

    return vendedores;
  }
};

module.exports = RefritosModel;
module.exports.normalizarNumeroWhatsApp = normalizarNumeroWhatsApp;
