const db = require('../../config/db');
const validator = require('validator');
const { SQL_MATCH_TELEFONO, sufijoTelefono } = require('../../utils/telefonoProspecto');

// 🌎 NORMALIZACIÓN DE NÚMEROS PARA WHATSAPP ARGENTINA
const normalizarNumeroWhatsApp = (numero) => {
  if (!numero) return null;
  
  // Remover espacios, paréntesis, guiones, +
  let numerolimpio = numero.replace(/[\s\(\)\-\+]/g, '');
  
  // Si tiene menos de 10 dígitos, probablemente es un número inválido
  if (numerolimpio.length < 10) {
    return numero; // Devolver original para que falle en validación
  }
  
  // Si comienza con 0, es número nacional argentino (ej: 0223... o 011...)
  if (numerolimpio.startsWith('0')) {
    // Remover el 0 al inicio y agregar código de país
    numerolimpio = '54' + numerolimpio.substring(1);
  }
  // Si ya tiene código de país 54, dejarlo así
  else if (numerolimpio.startsWith('54')) {
    // Ya tiene formato correcto
  }
  // Si no tiene código de país, es número nacional
  else {
    // Si tiene 11 dígitos y comienza con 11, es Buenos Aires (11 + 8 dígitos celular)
    if (numerolimpio.length === 11 && numerolimpio.startsWith('11')) {
      numerolimpio = '54' + numerolimpio;
    }
    // Si tiene 10 dígitos, puede ser:
    // - Provincia sin el 0 del área (ej: 3743505847 = Corrientes 37 + 43505847)
    // - Buenos Aires sin el 11 (ej: 1173931525 pero sin el 11 = solo 73931525)
    else if (numerolimpio.length === 10) {
      // Los primeros 2 dígitos serían el código de área provincial (siempre son entre 11-89)
      // Buenos Aires = 11 (ya manejado arriba)
      // Otras provincias = 22-89 sin el 0 del área
      const areaCode = numerolimpio.substring(0, 2);
      const areaCodeNum = parseInt(areaCode);
      
      // Si comienza con un código de área válido (21-89 sin el 0), es provincia
      if (areaCodeNum >= 21 && areaCodeNum <= 89) {
        // Es un número de provincia: agregar 0 + área + número
        numerolimpio = '54' + numerolimpio;
      } else {
        // Es un número incompleto, lo normalizamos igual
        numerolimpio = '54' + numerolimpio;
      }
    }
    // Si tiene 9 dígitos, probablemente es un número de celular sin el prefijo de área
    else if (numerolimpio.length === 9) {
      // Asumir que es Buenos Aires (11) + los 9 dígitos
      numerolimpio = '541' + numerolimpio;
    }
  }
  
  // Formatear como +54... para WhatsApp
  return '+' + numerolimpio;
};

// 🔍 VALIDAR DUPLICADOS - Para uso desde el controller
// Devuelve advertencias de duplicados detectados (sin bloquear entrada)
const validarDuplicadosEstatica = async (correo, numero_contacto) => {
  const advertencias = [];
  
  // Validar correo duplicado
  if (correo) {
    const correoNormalizado = validator.normalizeEmail(correo);
    const [correoExistente] = await db.query(
      'SELECT id, nombre, apellido FROM prospectos WHERE LOWER(correo) = LOWER(?) LIMIT 1',
      [correoNormalizado]
    );
    
    if (correoExistente && correoExistente.length > 0) {
      advertencias.push(`Email duplicado (Prospecto #${correoExistente[0].id}: ${correoExistente[0].nombre} ${correoExistente[0].apellido})`);
    }
  }
  
  // Validar número de contacto duplicado
  if (numero_contacto) {
    const sufijo = sufijoTelefono(numero_contacto);
    const [numeroExistente] = sufijo ? await db.query(
      `SELECT id, nombre, apellido FROM prospectos WHERE ${SQL_MATCH_TELEFONO} LIMIT 1`,
      [sufijo]
    ) : [[]];
    
    if (numeroExistente && numeroExistente.length > 0) {
      advertencias.push(`Teléfono duplicado (Prospecto #${numeroExistente[0].id}: ${numeroExistente[0].nombre} ${numeroExistente[0].apellido})`);
    }
  }
  
  return advertencias;
};

const FormLead = {
  // Función de validación para el lead principal
  validarDatosLead(data) {
    const errores = [];
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.length < 2 || data.nombre.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.nombre)) {
      errores.push("El nombre debe tener entre 2 y 50 caracteres y contener solo letras.");
    }
    if (!data.apellido || typeof data.apellido !== 'string' || data.apellido.length < 2 || data.apellido.length > 50 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.apellido)) {
      errores.push("El apellido debe tener entre 2 y 50 caracteres y contener solo letras.");
    }
    if (!data.numero_contacto || typeof data.numero_contacto !== 'string' || !/^[\d\s\(\)\+\-]{8,20}$/.test(data.numero_contacto)) {
      errores.push("El formato del número de contacto es inválido. Debe contener entre 8 y 20 caracteres numéricos.");
    } else {
      const numeroNormalizado = normalizarNumeroWhatsApp(data.numero_contacto);
      const soloDigitos = numeroNormalizado.replace(/\D/g, '');
      const nacional = soloDigitos.slice(-10);
      const digitosUnicos = new Set(nacional).size;
      const esSecuencial = ['0123456789', '1234567890', '9876543210', '0987654321'].includes(nacional);
      if (!numeroNormalizado.startsWith('+54') || soloDigitos.length < 12 || soloDigitos.length > 13 || digitosUnicos < 3 || esSecuencial) {
        errores.push("El número de teléfono ingresado no parece ser un número de Argentina válido. Verificá que el código de área y el número estén completos.");
      }
    }
    if (!data.localidad || typeof data.localidad !== 'string' || data.localidad.length < 2 || data.localidad.length > 100) {
      errores.push("La localidad debe tener entre 2 y 100 caracteres.");
    }
    if (data.correo && !validator.isEmail(data.correo)) {
      errores.push("El formato del correo electrónico es inválido.");
    }
    if (data.edad !== undefined && data.edad !== null && data.edad !== '') {
      if (!validator.isInt(data.edad.toString(), { min: 0, max: 120 })) {
        errores.push("La edad debe ser un número entero entre 0 y 120.");
      }
    }
    if (data.sueldo_bruto !== undefined && data.sueldo_bruto !== null && data.sueldo_bruto !== '') {
      if (!validator.isFloat(data.sueldo_bruto.toString(), { min: 0, max: 10000000 })) {
        errores.push("El sueldo bruto debe ser un número positivo menor a 10,000,000.");
      }
    }
    if (data.tipo_afiliacion_id !== undefined && data.tipo_afiliacion_id !== null && data.tipo_afiliacion_id !== '') {
      if (!validator.isInt(data.tipo_afiliacion_id.toString(), { min: 1, max: 10 })) {
        errores.push("El tipo de afiliación seleccionado no es válido.");
      }
    }
    if (data.categoria_monotributo) {
      const categoriasValidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"];
      if (!categoriasValidas.includes(data.categoria_monotributo)) {
        errores.push("La categoría de monotributo seleccionada no es válida.");
      }
    }
    return errores;
  },

  // Función de validación para familiares
  validarFamiliar(familiar) {
    const errores = [];
    const vinculosPermitidos = ["pareja/conyuge", "hijo/a", "familiar a cargo"];
    if (!familiar.vinculo || !vinculosPermitidos.includes(familiar.vinculo)) {
      errores.push("El vínculo del familiar no es válido.");
    }
    if (!familiar.nombre || typeof familiar.nombre !== 'string' || familiar.nombre.length < 2 || familiar.nombre.length > 50 || !/^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s\-]+$/.test(familiar.nombre)) {
      errores.push("El nombre del familiar debe tener entre 2 y 50 caracteres y contener solo letras, números, espacios o guiones.");
    }
    if (familiar.edad === undefined || familiar.edad === null || !validator.isInt(familiar.edad.toString(), { min: 0, max: 120 })) {
      errores.push("La edad del familiar debe ser un número entero entre 0 y 120.");
    }
    // Regla de negocio: hijo/a se cubre como HIJO hasta los 25 años inclusive (25 años y 11 meses)
    if (familiar.vinculo === "hijo/a" && familiar.edad !== undefined && familiar.edad !== null && Number(familiar.edad) > 25) {
      errores.push('Un hijo/a puede tener hasta 25 años inclusive. Para mayores de 25 años, seleccione el vínculo "familiar a cargo".');
    }
    // ✅ REQUERIR TIPO_AFILIACION_ID SOLO PARA PAREJA/CONYUGE
    if (familiar.vinculo === "pareja/conyuge") {
      if (!familiar.tipo_afiliacion_id || familiar.tipo_afiliacion_id === null || familiar.tipo_afiliacion_id === '') {
        errores.push("El tipo de afiliación es obligatorio para pareja/cónyuge.");
      } else if (!validator.isInt(familiar.tipo_afiliacion_id.toString(), { min: 1, max: 10 })) {
        errores.push("El tipo de afiliación del familiar no es válido.");
      }
      
      if (familiar.sueldo_bruto !== undefined && familiar.sueldo_bruto !== null && familiar.sueldo_bruto !== '') {
        if (!validator.isFloat(familiar.sueldo_bruto.toString(), { min: 0, max: 10000000 })) {
          errores.push("El sueldo bruto del familiar debe ser un número positivo menor a 10,000,000.");
        }
      }
      if (familiar.categoria_monotributo) {
        const categoriasValidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"];
        if (!categoriasValidas.includes(familiar.categoria_monotributo)) {
          errores.push("La categoría de monotributo del familiar no es válida.");
        }
      }
    }
    // ✅ PERMITIR TIPO_AFILIACION_ID PARA HIJO/A Y FAMILIAR A CARGO (opcional)
    if (["hijo/a", "familiar a cargo"].includes(familiar.vinculo)) {
      if (familiar.tipo_afiliacion_id !== undefined && familiar.tipo_afiliacion_id !== null && familiar.tipo_afiliacion_id !== '') {
        if (!validator.isInt(familiar.tipo_afiliacion_id.toString(), { min: 1, max: 10 })) {
          errores.push("El tipo de afiliación del familiar no es válido.");
        }
      }
      if (familiar.sueldo_bruto !== undefined && familiar.sueldo_bruto !== null && familiar.sueldo_bruto !== '') {
        if (!validator.isFloat(familiar.sueldo_bruto.toString(), { min: 0, max: 10000000 })) {
          errores.push("El sueldo bruto del familiar debe ser un número positivo menor a 10,000,000.");
        }
      }
      if (familiar.categoria_monotributo) {
        const categoriasValidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"];
        if (!categoriasValidas.includes(familiar.categoria_monotributo)) {
          errores.push("La categoría de monotributo del familiar no es válida.");
        }
      }
    }
    return errores;
  },

  // Guarda el lead principal en la tabla prospectos
  async createLead(data) {
    // Validación estricta de datos
    const errores = this.validarDatosLead(data);
    if (errores.length > 0) {
      const err = new Error("Error de validación");
      err.errores = errores;
      throw err;
    }

    // Validación de campos obligatorios
    if (!data.nombre || !data.apellido || !data.numero_contacto || !data.localidad) {
      throw new Error("Faltan campos obligatorios: nombre, apellido, número de contacto y localidad son requeridos.");
    }

    // 🔍 DETECTAR DUPLICADOS - MARCAR PERO PERMITIR INGRESO Y COTIZACIÓN
    // Si correo duplicado: Marcar como duplicado (sin validación de días)
    // Si número duplicado: Marcar como duplicado (sin validación de días)
    
    let esDuplicado = false;
    let motivoDuplicado = [];
    let prospectoExistenteId = null;
    
    // Validar correo duplicado
    if (data.correo) {
      const correoNormalizado = validator.normalizeEmail(data.correo);
      // Preferir como "original" un prospecto que NO sea 'Dato repetido': si se compara
      // contra otro duplicado sin asignación, evaluarReingreso lo trata como reingresable
      // y el tercer intento con el mismo dato termina asignado (bug de datos repetidos).
      const [correoExistente] = await db.query(
        `SELECT id, nombre, apellido, fecha_registro FROM prospectos
         WHERE LOWER(correo) = LOWER(?)
         ORDER BY (estado = 'Dato repetido') ASC, fecha_hora_registro DESC, id DESC
         LIMIT 1`,
        [correoNormalizado]
      );
      
      if (correoExistente && correoExistente.length > 0) {
        const fechaRegistro = new Date(correoExistente[0].fecha_registro);
        const diasTranscurridos = Math.floor((new Date() - fechaRegistro) / (1000 * 60 * 60 * 24));
        
        esDuplicado = true;
        motivoDuplicado.push(`Email duplicado (Prospecto #${correoExistente[0].id} - ${diasTranscurridos} días)`);
        prospectoExistenteId = correoExistente[0].id;
        console.warn(`
╔════════════════════════════════════════════════════════════╗
║ ⚠️  DUPLICADO DETECTADO - EMAIL                          ║
╠════════════════════════════════════════════════════════════╣
║ Email: ${correoNormalizado}
║ Prospecto existente: ${correoExistente[0].nombre} ${correoExistente[0].apellido} (ID: ${correoExistente[0].id})
║ Registrado hace: ${diasTranscurridos} días
║ Acción: INGRESAR Y COTIZAR - Sin asignar vendedor
╚════════════════════════════════════════════════════════════╝
        `);
      }
    }
    
    // Validar número de contacto duplicado
    if (data.numero_contacto) {
      // Se compara por sufijo de 10 dígitos y no por subcadena del número normalizado:
      // los prospectos de alta en frío por WhatsApp quedan guardados como '+549…' y los
      // de este formulario como '+54…', así que el LIKE contiguo nunca los cruzaba y
      // entraban como alta nueva sin marcar 'Dato repetido'. Ver utils/telefonoProspecto.js
      const sufijo = sufijoTelefono(data.numero_contacto);

      // Igual que con el correo: preferir un original que no sea 'Dato repetido'
      const [numeroExistente] = sufijo ? await db.query(
        `SELECT id, nombre, apellido, fecha_registro FROM prospectos
         WHERE ${SQL_MATCH_TELEFONO}
         ORDER BY (estado = 'Dato repetido') ASC, fecha_hora_registro DESC, id DESC
         LIMIT 1`,
        [sufijo]
      ) : [[]];
      
      if (numeroExistente && numeroExistente.length > 0) {
        const fechaRegistro = new Date(numeroExistente[0].fecha_registro);
        const diasTranscurridos = Math.floor((new Date() - fechaRegistro) / (1000 * 60 * 60 * 24));
        
        esDuplicado = true;
        motivoDuplicado.push(`Teléfono duplicado (Prospecto #${numeroExistente[0].id} - ${diasTranscurridos} días)`);
        if (!prospectoExistenteId) prospectoExistenteId = numeroExistente[0].id;
        console.warn(`
╔════════════════════════════════════════════════════════════╗
║ ⚠️  DUPLICADO DETECTADO - TELÉFONO                       ║
╠════════════════════════════════════════════════════════════╣
║ Teléfono: +${numeroLimpio}
║ Prospecto existente: ${numeroExistente[0].nombre} ${numeroExistente[0].apellido} (ID: ${numeroExistente[0].id})
║ Registrado hace: ${diasTranscurridos} días
║ Acción: INGRESAR Y COTIZAR - Sin asignar vendedor
╚════════════════════════════════════════════════════════════╝
        `);
      }
    }

    // Validación de correo electrónico
    if (!validator.isEmail(data.correo || "")) {
      throw new Error("Correo inválido.");
    }

    // Validación de edad
    if (data.edad && (!validator.isInt(data.edad.toString(), { min: 0, max: 120 }) || isNaN(data.edad))) {
      throw new Error("Edad inválida. Debe ser un número entre 0 y 120.");
    }

    // Validación de sueldo bruto
    if (data.sueldo_bruto && (!validator.isNumeric(data.sueldo_bruto.toString()) || data.sueldo_bruto < 0)) {
      throw new Error("Sueldo bruto inválido. Debe ser un número positivo.");
    }

    // Validación de categoría monotributo
    if (data.categoria_monotributo && !validator.isAlphanumeric(data.categoria_monotributo.replace(/\s/g, ""))) {
      throw new Error("Categoría monotributo inválida.");
    }

    // Validación de tipo de afiliación
    if (!data.tipo_afiliacion_id || isNaN(data.tipo_afiliacion_id)) {
      throw new Error("Tipo de afiliación inválido. Debe ser un número válido.");
    }

    // Sanitización
    const nombre = validator.escape(data.nombre);
    const apellido = validator.escape(data.apellido);
    // 📱 NORMALIZAR NÚMERO PARA WHATSAPP (Argentina)
    const numero_contacto = normalizarNumeroWhatsApp(data.numero_contacto);
    const correo = validator.normalizeEmail(data.correo);
    const localidad = validator.escape(data.localidad);
    const comentario = data.comentario || null;

    const edad = data.edad ? Number(data.edad) : null;
    const tipo_afiliacion_id = Number(data.tipo_afiliacion_id);
    const sueldo_bruto = data.sueldo_bruto ? Number(data.sueldo_bruto) : null;
    const categoria_monotributo = data.categoria_monotributo ? validator.escape(data.categoria_monotributo) : null;
    // Origen queda inmutable tras el insert (trigger before_update_prospectos_origen),
    // por eso hay que fijarlo acá y no en un UPDATE posterior.
    const origen = data.origen ? validator.escape(String(data.origen)) : 'Formulario Web';
    const dni = data.dni ? validator.escape(String(data.dni)) : null;

    // Inserta el lead en prospectos
    const [result] = await db.query(
      `INSERT INTO prospectos (nombre, apellido, edad, tipo_afiliacion_id, sueldo_bruto, categoria_monotributo, numero_contacto, correo, localidad, comentario, estado, origen, dni)
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
        esDuplicado ? 'Dato repetido' : 'Lead',
        origen,
        dni
      ]
    );

    const prospectoId = result.insertId;

    // 🔄 Si es duplicado, actualizar el estado a "Dato repetido"
    if (esDuplicado) {
      await db.query(
        'UPDATE prospectos SET estado = ? WHERE id = ?',
        ['Dato repetido', prospectoId]
      );
      
      return {
        id: prospectoId,
        esDuplicado: true,
        motivoDuplicado: motivoDuplicado.join(', '),
        prospectoOriginalId: prospectoExistenteId
      };
    }

    return prospectoId;
  },

  async addFamiliar(prospectoId, familiar) {
    // Validación estricta de datos de familiar
    const errores = this.validarFamiliar(familiar);
    if (errores.length > 0) {
      const err = new Error("Error de validación en familiar");
      err.errores = errores;
      throw err;
    }

    // Validación de campos obligatorios
    if (!familiar.vinculo || !familiar.nombre || !familiar.edad) {
      throw new Error("Datos de familiar incompletos: vínculo, nombre y edad son requeridos.");
    }

    // Validación de edad
    if (!validator.isInt(familiar.edad.toString(), { min: 0, max: 120 }) || isNaN(familiar.edad)) {
      throw new Error("Edad de familiar inválida. Debe ser un número entre 0 y 120.");
    }

    // ✅ Validación de tipo de afiliación - PERMITIR PARA PAREJA, HIJO/A Y FAMILIAR A CARGO
    if (["pareja/conyuge", "hijo/a", "familiar a cargo"].includes(familiar.vinculo)) {
      if (familiar.tipo_afiliacion_id && isNaN(familiar.tipo_afiliacion_id)) {
        throw new Error("Tipo de afiliación inválido para el familiar.");
      }
    }

    // Validación de sueldo bruto
    if (familiar.sueldo_bruto && (!validator.isNumeric(familiar.sueldo_bruto.toString()) || familiar.sueldo_bruto < 0)) {
      throw new Error("Sueldo bruto de familiar inválido. Debe ser un número positivo.");
    }

    // Validación de categoría monotributo
    if (familiar.categoria_monotributo && !validator.isAlphanumeric(familiar.categoria_monotributo.replace(/\s/g, ""))) {
      throw new Error("Categoría monotributo de familiar inválida.");
    }

    // Sanitización
    const vinculo = familiar.vinculo;
    const nombre = validator.escape(familiar.nombre);
    const edad = Number(familiar.edad);
    // ✅ Asignar tipo_afiliacion_id = 1 (Particular/autónomo) por defecto para hijo/a y familiar_a_cargo si no se proporciona
    let tipo_afiliacion_id = familiar.tipo_afiliacion_id ? Number(familiar.tipo_afiliacion_id) : null;
    if ((vinculo === "hijo/a" || vinculo === "familiar a cargo") && !tipo_afiliacion_id) {
      tipo_afiliacion_id = 1; // Particular/autónomo por defecto
    }
    const sueldo_bruto = familiar.sueldo_bruto ? Number(familiar.sueldo_bruto) : null;
    const categoria_monotributo = familiar.categoria_monotributo ? validator.escape(familiar.categoria_monotributo) : null;

    await db.query(
      `INSERT INTO familiares 
        (prospecto_id, vinculo, nombre, edad, tipo_afiliacion_id, sueldo_bruto, categoria_monotributo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        prospectoId,
        vinculo,
        nombre,
        edad,
        tipo_afiliacion_id,
        sueldo_bruto,
        categoria_monotributo
      ]
    );
  },

  async autoasignarVendedor(prospectoId, estado, comentario, categoriaPreferida = null) {
    const DistribucionRoundRobin = require('../admin/distribucionRoundRobinModel');
    
    // Iniciar transacción para garantizar consistencia
    await db.query('START TRANSACTION');
    
    try {
      // Usar el sistema de round-robin para obtener el siguiente vendedor
      const vendedor = await DistribucionRoundRobin.getNextVendedor(categoriaPreferida);

      if (!vendedor) {
        await db.query('ROLLBACK');
        throw new Error("No hay vendedores disponibles en el sistema");
      }

      const vendedorId = vendedor.id;

      await db.query(
        `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado)
         VALUES (?, ?, ?, ?, NOW())`,
        [prospectoId, vendedorId, estado || 'Lead', comentario || null]
      );
      
      // Confirmar la transacción
      await db.query('COMMIT');

      // 📧 Notificar al vendedor por email (no bloqueante: no debe afectar el alta del lead)
      (async () => {
        try {
          const [[prospectoInfo]] = await db.query(
            'SELECT nombre, apellido, origen FROM prospectos WHERE id = ?',
            [prospectoId]
          );
          const [[usuarioInfo]] = await db.query(
            'SELECT email FROM users WHERE id = ?',
            [vendedorId]
          );
          if (usuarioInfo?.email) {
            const emailService = require('../../services/emailService');
            await emailService.enviarNotificacionLeadAsignado({
              to: usuarioInfo.email,
              vendedorNombre: `${vendedor.first_name} ${vendedor.last_name}`,
              leadNombre: `${prospectoInfo.nombre} ${prospectoInfo.apellido}`,
              leadOrigen: prospectoInfo.origen || 'No especificado',
              prospectoId
            });
          }
        } catch (emailError) {
          console.error(`❌ No se pudo notificar por email al vendedor ${vendedorId}:`, emailError.message);
        }
      })();

      return vendedorId;
    } catch (error) {
      // En caso de error, deshacer cambios
      await db.query('ROLLBACK');
      throw error;
    }
  },

  async guardarGrupoFamiliar(prospectoId, tipoGrupo) {
    const query = `
      INSERT INTO grupos_familiares (prospecto_id, tipo_grupo)
      VALUES (?, ?)
    `;
    await db.query(query, [prospectoId, tipoGrupo]);
  },

  async cotizarLead(prospectoId) {
    // Eliminar cotizaciones y detalles previos
    await db.query('DELETE FROM cotizaciones_detalles WHERE cotizacion_id IN (SELECT id FROM cotizaciones WHERE prospecto_id = ?)', [prospectoId]);
    await db.query('DELETE FROM cotizaciones WHERE prospecto_id = ?', [prospectoId]);

    const anio = new Date().getFullYear();

    // Mapear tipo de afiliación
    const TIPO_AFILIACION = {
      1: "Particular/autónomo",
      2: "Con recibo de sueldo",
      3: "Monotributista",
    };

    // Validar prospecto
    const [prospectoRows] = await db.query('SELECT * FROM prospectos WHERE id = ?', [prospectoId]);
    const prospecto = prospectoRows[0];
    if (!prospecto) throw new Error("Prospecto no encontrado.");

    if (!prospecto.tipo_afiliacion_id || isNaN(prospecto.tipo_afiliacion_id)) {
      throw new Error("Tipo de afiliación inválido para el titular.");
    }

    const [familiares] = await db.query('SELECT * FROM familiares WHERE prospecto_id = ?', [prospectoId]);

    // ✅ Asignar tipo_afiliacion_id = 1 por defecto para hijo/a y familiar_a_cargo si es NULL
    for (const familiar of familiares) {
      if (!familiar.tipo_afiliacion_id || isNaN(familiar.tipo_afiliacion_id)) {
        if (familiar.vinculo === "hijo/a" || familiar.vinculo === "familiar a cargo") {
          familiar.tipo_afiliacion_id = 1; // Particular/autónomo por defecto
        } else {
          throw new Error(`Tipo de afiliación inválido para el familiar ${familiar.nombre}.`);
        }
      }
    }

    // Detectar si hay pareja/conyuge
    const tienePareja = familiares.some(f => f.vinculo === "pareja/conyuge");

    // Crear lista de integrantes
    const integrantes = [
      {
        persona: `${prospecto.nombre} ${prospecto.apellido}`,
        vinculo: "Titular",
        edad: Number(prospecto.edad),
        tipo_familia_id: tienePareja ? 2 : 1, // Si hay pareja, usar cónyuge
        tipo_afiliacion_id: prospecto.tipo_afiliacion_id ? Number(prospecto.tipo_afiliacion_id) : (() => { throw new Error("tipo_afiliacion_id no puede ser NULL para el titular"); })(),
        sueldo_bruto: prospecto.sueldo_bruto || null,
        categoria_monotributo: prospecto.categoria_monotributo || null,
      },
      ...familiares.map(f => ({
        persona: f.nombre,
        vinculo: f.vinculo === "pareja/conyuge" ? "cónyuge" : f.vinculo,
        edad: Number(f.edad),
        tipo_familia_id: 
          f.vinculo === "pareja/conyuge" ? 2 :
          f.vinculo === "hijo/a" ? 3 :
          f.vinculo === "familiar a cargo" ? 4 :
          1, // Individual por defecto
        tipo_afiliacion_id: 
          (f.tipo_afiliacion_id && !isNaN(f.tipo_afiliacion_id) ? Number(f.tipo_afiliacion_id) : 1),
        sueldo_bruto: f.sueldo_bruto || null,
        categoria_monotributo: f.categoria_monotributo || null,
      }))
    ];

    const [planes] = await db.query('SELECT id, nombre FROM planes');
    const resultados = [];

    for (const plan of planes) {
      const planId = plan.id; // Definir planId aquí
      let totalBruto = 0;
      let totalDescuentoAporte = 0;
      let totalDescuentoPromocion = 0;
      const detalles = [];

      for (const integrante of integrantes) {

        if (isNaN(integrante.edad) || integrante.edad < 0) {
          throw new Error(`Edad inválida para el integrante ${integrante.persona}`);
        }

        const [categoriaRows] = await db.query(
          'SELECT id FROM categorias_edad WHERE ? BETWEEN edad_min AND edad_max LIMIT 1',
          [integrante.edad]
        );

        let categoriaId;
        if (categoriaRows.length) {
          categoriaId = categoriaRows[0].id;
        } else {
          // Fallback: usar la categoría de mayor edad disponible
          const [maxCatRows] = await db.query(
            'SELECT id FROM categorias_edad ORDER BY edad_max DESC LIMIT 1'
          );
          if (!maxCatRows.length) {
            throw new Error(`No se encontró ninguna categoría de edad definida`);
          }
          categoriaId = maxCatRows[0].id;
          console.warn(`⚠️ Edad ${integrante.edad} sin categoría exacta para ${integrante.persona} — usando categoría máxima (id: ${categoriaId})`);
        }

        // 🔧 FIX: Buscar precio para el año actual, si no existe usar el año más reciente disponible
        let [precioRows] = await db.query(
          'SELECT precio FROM listas_precios WHERE plan_id = ? AND categoria_id = ? AND tipo_familia_id = ? AND anio = ? LIMIT 1',
          [plan.id, categoriaId, integrante.tipo_familia_id, anio]
        );
        
        // Fallback: si no hay precio para el año actual, buscar el año más reciente
        if (!precioRows.length || !precioRows[0]?.precio) {
          const [fallbackRows] = await db.query(
            'SELECT precio, anio FROM listas_precios WHERE plan_id = ? AND categoria_id = ? AND tipo_familia_id = ? ORDER BY anio DESC LIMIT 1',
            [plan.id, categoriaId, integrante.tipo_familia_id]
          );
          if (fallbackRows.length > 0) {
            precioRows = fallbackRows;
            console.log(`⚠️ Usando precios del año ${fallbackRows[0].anio} para plan ${plan.id}, categoría ${categoriaId}, tipo familia ${integrante.tipo_familia_id}`);
          }
        }
        
        const precioBase = parseFloat(precioRows[0]?.precio || 0);

        let descuentoAporte = 0;
        let motivoDescuento = "Sin aporte";
        let promocionAplicada = null;
        let descuentoPromocion = 0;

        // ✅ APLICAR APORTE A TITULAR, PAREJA, CÓNYUGE E HIJOS
        if (integrante.vinculo === "Titular" || integrante.vinculo === "cónyuge" || integrante.vinculo === "pareja/conyuge" || integrante.vinculo === "hijo/a" || integrante.vinculo === "familiar a cargo") {
          if (integrante.tipo_afiliacion_id === 2) {
            descuentoAporte = Math.round((integrante.sueldo_bruto || 0) * 0.06732 * 100) / 100;
            motivoDescuento = "Recibo de sueldo";
          } else if (integrante.tipo_afiliacion_id === 3) {
            const [monotributoRows] = await db.query(
              'SELECT aporte_presuntivo FROM categorias_monotributo WHERE letra = ?',
              [integrante.categoria_monotributo]
            );
            descuentoAporte = parseFloat(monotributoRows[0]?.aporte_presuntivo || 0);
            motivoDescuento = "Monotributo";
          }
        }

        // Los prospectos de Reafiliación se cotizan siempre al 55% de descuento
        // (regla de negocio), no con la promo general id=1 que usa el resto.
        const [promocionRows] = prospecto.origen === 'Reafiliacion'
          ? await db.query(
              "SELECT nombre, descuento_porcentaje, tipo FROM promociones WHERE tipo = 'descuento' AND descuento_porcentaje = 55 AND activa = 1 LIMIT 1"
            )
          : await db.query(
              'SELECT nombre, descuento_porcentaje, tipo FROM promociones WHERE id = 1 AND activa = 1 LIMIT 1'
            );
        if (promocionRows.length > 0) {
          const promocion = promocionRows[0];
          const precioConAporte = precioBase - descuentoAporte;
          const signoPromocion = promocion.tipo === 'incremento' ? -1 : 1;
          // Positivo = descuento (resta del precio), negativo = incremento (suma al precio)
          descuentoPromocion = precioConAporte * (promocion.descuento_porcentaje / 100) * signoPromocion;
          // Incluir el porcentaje en el texto: el resto del sistema (autocompletado del
          // formulario de póliza y el PDF) extrae el % de este string con una regex.
          promocionAplicada = `${promocion.nombre} (${promocion.tipo === 'incremento' ? '+' : '-'}${promocion.descuento_porcentaje}%)`;
        }

        const precioFinal = parseFloat(Math.max(precioBase - descuentoAporte - descuentoPromocion, 0).toFixed(2));
        totalBruto += precioBase;
        totalDescuentoAporte += descuentoAporte;
        totalDescuentoPromocion += descuentoPromocion;

        detalles.push({
          persona: integrante.persona,
          vinculo: integrante.vinculo,
          edad: integrante.edad,
          tipo_afiliacion_id: integrante.tipo_afiliacion_id,
          tipo_afiliacion: TIPO_AFILIACION[integrante.tipo_afiliacion_id] || "Sin datos",
          precio_base: precioBase,
          descuento_aporte: descuentoAporte,
          promocion_aplicada: promocionAplicada,
          descuento_promocion: descuentoPromocion,
          precio_final: precioFinal,
        });
      }

      totalBruto = parseFloat(totalBruto.toFixed(2));
      totalDescuentoAporte = parseFloat(totalDescuentoAporte.toFixed(2));
      totalDescuentoPromocion = parseFloat(totalDescuentoPromocion.toFixed(2));
      const totalFinal = parseFloat((totalBruto - totalDescuentoAporte - totalDescuentoPromocion).toFixed(2));

      const queryCotizacion = `
        INSERT INTO cotizaciones (prospecto_id, plan_id, total_bruto, total_descuento_aporte, total_descuento_promocion, total_descuento, total_final, anio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [resultCotizacion] = await db.query(queryCotizacion, [
        prospectoId,
        planId,
        totalBruto,
        totalDescuentoAporte,
        totalDescuentoPromocion,
        totalDescuentoAporte + totalDescuentoPromocion,
        totalFinal,
        new Date().getFullYear(),
      ]);

      const cotizacionId = resultCotizacion.insertId; // Obtener el ID de la cotización principal

      // Inserción en la tabla cotizaciones_detalles
      for (const detalle of detalles) {
        const queryDetalles = `
          INSERT INTO cotizaciones_detalles 
          (cotizacion_id, persona, vinculo, edad, tipo_afiliacion_id, precio_base, descuento_aporte, descuento_promocion, promocion_aplicada, precio_final)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.query(queryDetalles, [
          cotizacionId,
          detalle.persona,
          detalle.vinculo,
          detalle.edad,
          detalle.tipo_afiliacion_id,
          detalle.precio_base,
          detalle.descuento_aporte,
          detalle.descuento_promocion,
          detalle.promocion_aplicada,
          detalle.precio_final,
        ]);
      }

      resultados.push({
        plan_nombre: plan.nombre,
        total_bruto: totalBruto,
        total_descuento_aporte: totalDescuentoAporte,
        total_descuento_promocion: totalDescuentoPromocion,
        total_final: totalFinal,
        detalles,
      });
    }

    return resultados;
  }
};

// 📤 EXPORTAR TAMBIÉN LAS FUNCIONES DE UTILIDAD
module.exports = FormLead;
module.exports.normalizarNumeroWhatsApp = normalizarNumeroWhatsApp;

// ✅ Agregar validarDuplicados como método estático del objeto FormLead
FormLead.validarDuplicados = validarDuplicadosEstatica;