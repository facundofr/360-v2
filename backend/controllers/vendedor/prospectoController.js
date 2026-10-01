const validator = require('validator');
const Prospecto = require('../../models/vendedor/prospectoModel');
const db = require('../../config/db');
const { registrarAccion } = require('./historialController');
const FormLead = require('../../models/formLead/formModel');
const whatsappService = require('../../services/whatsappService');
const NotificationsService = require('../../services/notificationsService');
const GoogleSheetsService = require('../../services/googleSheetsService');
const DuplicadosService = require('../../services/DuplicadosService');

// 🌎 NORMALIZACIÓN DE NÚMEROS PARA WHATSAPP ARGENTINA (igual a FormLead)
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

// Funciones de validación reutilizables
const validarDatosProspecto = (data) => {
    const errores = [];

    // Validar campos obligatorios
    if (!data.nombre || !data.apellido || !data.numero_contacto || !data.localidad) {
        errores.push("Faltan campos obligatorios (nombre, apellido, número de contacto o localidad).");
    }

    // Validar formato y longitud de campos de texto
    if (data.nombre && (data.nombre.length < 2 || data.nombre.length > 100 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.nombre))) {
        errores.push("El nombre debe tener entre 2 y 100 caracteres y contener solo letras.");
    }

    if (data.apellido && (data.apellido.length < 2 || data.apellido.length > 100 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.apellido))) {
        errores.push("El apellido debe tener entre 2 y 100 caracteres y contener solo letras.");
    }

    // Validar correo electrónico
    if (data.correo && !validator.isEmail(data.correo)) {
        errores.push("El formato del correo electrónico es inválido.");
    }

    // Validar número de contacto (teléfono)
    if (data.numero_contacto && !/^[\d\s\(\)\+\-]{8,20}$/.test(data.numero_contacto)) {
        errores.push("El formato del número de contacto es inválido. Debe contener entre 8 y 20 caracteres numéricos.");
    }

    // Validar edad
    if (data.edad !== undefined && data.edad !== null && data.edad !== '') {
        if (!validator.isInt(data.edad.toString(), { min: 0, max: 120 })) {
            errores.push("La edad debe ser un número entero entre 0 y 120.");
        }
    }

    // Validar localidad
    if (data.localidad && (data.localidad.length < 2 || data.localidad.length > 100)) {
        errores.push("La localidad debe tener entre 2 y 100 caracteres.");
    }

    // Validar sueldo bruto
    if (data.sueldo_bruto !== undefined && data.sueldo_bruto !== null && data.sueldo_bruto !== '') {
        if (!validator.isFloat(data.sueldo_bruto.toString(), { min: 0, max: 10000000 })) {
            errores.push("El sueldo bruto debe ser un número positivo menor a 10,000,000.");
        }
    }

    // Validar tipo de afiliación
    if (data.tipo_afiliacion_id !== undefined && data.tipo_afiliacion_id !== null && data.tipo_afiliacion_id !== '') {
        if (!validator.isInt(data.tipo_afiliacion_id.toString(), { min: 1, max: 10 })) {
            errores.push("El tipo de afiliación seleccionado no es válido.");
        }
    }

    // Validar categoría monotributo
    if (data.categoria_monotributo) {
        const categoriasValidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"];
        if (!categoriasValidas.includes(data.categoria_monotributo)) {
            errores.push("La categoría de monotributo seleccionada no es válida.");
        }
    }

    return errores;
};

const validarFamiliares = (familiares) => {
    const errores = [];
    
    if (!Array.isArray(familiares)) {
        return ["El formato de familiares es inválido."];
    }

    const vinculosPermitidos = ["pareja/conyuge", "hijo/a", "familiar a cargo"];
    
    familiares.forEach((familiar, index) => {
        // Validar campos obligatorios (edad puede ser null = menor de 1 año)
        if (!familiar.vinculo || !familiar.nombre) {
            errores.push(`Familiar #${index + 1}: Faltan campos obligatorios (vínculo y nombre).`);
        }

        // Validar vínculo
        if (familiar.vinculo && !vinculosPermitidos.includes(familiar.vinculo)) {
            errores.push(`Familiar #${index + 1}: El vínculo '${familiar.vinculo}' no es válido.`);
        }

        // Validar nombre
        if (familiar.nombre && (familiar.nombre.length < 2 || familiar.nombre.length > 100 || !/^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s\-]+$/.test(familiar.nombre))) {
            errores.push(`Familiar #${index + 1}: El nombre debe tener entre 2 y 100 caracteres y contener solo letras, números, espacios o guiones.`);
        }

        // Validar edad
        if (familiar.edad !== undefined && familiar.edad !== null) {
            if (!validator.isInt(familiar.edad.toString(), { min: 0, max: 120 })) {
                errores.push(`Familiar #${index + 1}: La edad debe ser un número entero entre 0 y 120.`);
            }
        }
  
        // Regla de negocio: hijo/a se cubre como HIJO hasta los 25 años inclusive (25 años y 11 meses)
        if (familiar.vinculo === "hijo/a" && familiar.edad !== undefined && familiar.edad !== null && familiar.edad !== '' && Number(familiar.edad) > 25) {
            errores.push(`Familiar #${index + 1}: Un hijo/a puede tener hasta 25 años inclusive. Para mayores de 25 años, use el vínculo "familiar a cargo".`);
        }

        // ✅ Para pareja/cónyuge, hijo/a y familiar_a_cargo, validar campos adicionales opcionales
        if (["pareja/conyuge", "hijo/a", "familiar a cargo"].includes(familiar.vinculo)) {
            // Validar tipo de afiliación (solo si se proporciona)
            if (familiar.tipo_afiliacion_id !== undefined && familiar.tipo_afiliacion_id !== null && familiar.tipo_afiliacion_id !== '') {
                if (!validator.isInt(familiar.tipo_afiliacion_id.toString(), { min: 1, max: 10 })) {
                    errores.push(`Familiar #${index + 1}: El tipo de afiliación seleccionado no es válido.`);
                }
            }

            // Validar sueldo bruto (solo si se proporciona)
            if (familiar.sueldo_bruto !== undefined && familiar.sueldo_bruto !== null && familiar.sueldo_bruto !== '') {
                if (!validator.isFloat(familiar.sueldo_bruto.toString(), { min: 0, max: 10000000 })) {
                    errores.push(`Familiar #${index + 1}: El sueldo bruto debe ser un número positivo menor a 10,000,000.`);
                }
            }

            // Validar categoría monotributo (solo si se proporciona)
            if (familiar.categoria_monotributo) {
                const categoriasValidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"];
                if (!categoriasValidas.includes(familiar.categoria_monotributo)) {
                    errores.push(`Familiar #${index + 1}: La categoría de monotributo seleccionada no es válida.`);
                }
            }
        }
    });
    
    return errores;
};

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

const createProspecto = async (req, res) => {
    try {
        const data = req.body;

        // Validar datos del prospecto
        const erroresProspecto = validarDatosProspecto(data);
        
        // Validar familiares si existen
        let erroresFamiliares = [];
        if (Array.isArray(data.familiares) && data.familiares.length > 0) {
            erroresFamiliares = validarFamiliares(data.familiares);
        }

        // Si hay errores, devolver respuesta con lista de errores
        const todosErrores = [...erroresProspecto, ...erroresFamiliares];
        if (todosErrores.length > 0) {
            return res.status(400).json({ 
                message: "Error de validación", 
                errores: todosErrores 
            });
        }

        // Sanitización de datos principales
        data.nombre = validator.escape(data.nombre.trim());
        data.apellido = validator.escape(data.apellido.trim());
        // 📱 NORMALIZAR NÚMERO PARA WHATSAPP (Argentina) - igual a FormLead
        data.numero_contacto = normalizarNumeroWhatsApp(data.numero_contacto.trim());
        data.localidad = validator.escape(data.localidad.trim());
        if (data.correo) data.correo = validator.normalizeEmail(data.correo.trim());
        
        // Sanitización de familiares
        if (Array.isArray(data.familiares)) {
            data.familiares.forEach(familiar => {
                familiar.nombre = validator.escape(familiar.nombre.trim());
                if (familiar.categoria_monotributo) {
                    familiar.categoria_monotributo = validator.escape(familiar.categoria_monotributo);
                }
            });
        }

        // --- VALIDACIÓN DE EDAD MÁXIMA ---
        const edad = parseInt(data.edad);
        const esMayorDe65 = edad > 65;
        
        if (esMayorDe65) {
            console.log(`🚫 Prospecto mayor de 65 años detectado: ${data.nombre} (${edad} años) - No se generará cotización por restricción legal`);
        }
        // --- FIN VALIDACIÓN EDAD ---

        // 🔍 VERIFICAR DUPLICADOS - Buscar por email o teléfono
        let prospectoId = null;
        let esProspectoExistente = false;
        let prospectoExistenteInfo = null;
        let vendedoresAsignados = [];

        // Buscar por correo si existe
        if (data.correo) {
            const [correoExistente] = await db.query(
                'SELECT id, nombre, apellido FROM prospectos WHERE LOWER(correo) = LOWER(?) LIMIT 1',
                [data.correo]
            );
            if (correoExistente && correoExistente.length > 0) {
                prospectoId = correoExistente[0].id;
                esProspectoExistente = true;
                prospectoExistenteInfo = `(Prospecto #${correoExistente[0].id} existente: ${correoExistente[0].nombre} ${correoExistente[0].apellido})`;
                console.warn(`⚠️ Prospecto con correo duplicado detectado desde Vendedor-App: ${prospectoExistenteInfo}`);
            }
        }

        // Buscar por teléfono si no fue encontrado por correo
        if (!prospectoId && data.numero_contacto) {
            const numeroLimpio = data.numero_contacto.replace(/\D/g, ''); // Solo dígitos

            // Generar variantes del número para mejorar detección de duplicados:
            // - Número completo con código de país Argentina (+54 9 o +54)
            // - Últimos 10 dígitos (número local sin código de país)
            // - Últimos 8 dígitos (número sin código de área)
            const sufijo10 = numeroLimpio.slice(-10);
            const sufijo8  = numeroLimpio.slice(-8);

            const [numeroExistente] = await db.query(
                `SELECT id, nombre, apellido FROM prospectos
                 WHERE REGEXP_REPLACE(numero_contacto, '[^0-9]', '')
                       REGEXP CONCAT('(', ?, '$|', ?, '$|', ?, '$)')
                 LIMIT 1`,
                [numeroLimpio, sufijo10, sufijo8]
            );
            if (numeroExistente && numeroExistente.length > 0) {
                prospectoId = numeroExistente[0].id;
                esProspectoExistente = true;
                prospectoExistenteInfo = `(Prospecto #${numeroExistente[0].id} existente: ${numeroExistente[0].nombre} ${numeroExistente[0].apellido})`;
                console.warn(`⚠️ Prospecto con teléfono duplicado detectado desde Vendedor-App: ${prospectoExistenteInfo}`);
            }
        }

        // 📋 Si el prospecto existe, obtener lista de vendedores asignados
        if (prospectoId) {
            const [asignacionesExistentes] = await db.query(
                `SELECT DISTINCT a.id_vendedor, u.first_name, u.last_name 
                 FROM asignaciones a
                 LEFT JOIN users u ON a.id_vendedor = u.id
                 WHERE a.id_prospecto = ? 
                 ORDER BY a.fecha_asignacion DESC`,
                [prospectoId]
            );

            if (asignacionesExistentes && asignacionesExistentes.length > 0) {
                vendedoresAsignados = asignacionesExistentes.map(a => 
                    `${a.first_name || 'Vendedor'} ${a.last_name || ''} (ID: ${a.id_vendedor})`
                );
            }
        }

        // Si no existe prospecto duplicado, crear uno nuevo
        if (!prospectoId) {
            const tipoGrupo = determinarTipoGrupoFamiliar(data.familiares);
            // 📊 Establecer origen (permitir especificarlo desde frontend, por defecto "Vendedor-App")
            if (!data.origen) {
                data.origen = 'Vendedor-App';
            }
            const result = await Prospecto.create(data);
            prospectoId = result.insertId;

            // Guardar el tipo de grupo familiar
            await db.query(
                `INSERT INTO grupos_familiares (prospecto_id, tipo_grupo) VALUES (?, ?)`,
                [prospectoId, tipoGrupo]
            );

            // Crear familiares si existen
            if (Array.isArray(data.familiares) && data.familiares.length > 0) {
                await Prospecto.createFamiliares(prospectoId, data.familiares);
            }

            console.log(`✅ Nuevo prospecto creado desde Vendedor-App: ID ${prospectoId}`);
        } else {
            // Si el prospecto ya existe, actualizar familiares solo si es necesario
            console.info(`ℹ️ Prospecto existente detectado desde Vendedor-App: ${prospectoExistenteInfo}`);
        }

        // ⛔ Regla de edad: un mayor de 65 no entra al circuito comercial como Lead. El dato se
        // registra igual (lo cargó el vendedor a mano y necesita ver qué pasó con él), pero tanto
        // el prospecto como su asignación quedan en 'Fuera de edad': no cuenta como lead activo
        // ni lo toma el job de reasignación automática (que filtra por a.estado = 'Lead').
        if (esMayorDe65) {
            await db.query(
                'UPDATE prospectos SET estado = ? WHERE id = ?',
                ['Fuera de edad', prospectoId]
            );
        }

        // ✅ REGLA DE DUPLICADOS: mismo criterio que el formulario web (DuplicadosService)
        // Solo se permite que el vendedor se autoasigne el duplicado si el original
        // quedó "sin evolución" (Lead/1º Contacto/No contesta) por 14+ días.
        let reasignacionPermitida = true;
        let evaluacionDuplicado = null;
        let estadoActualAsignacion = null;
        let vendedorActualInfo = null;

        if (esProspectoExistente) {
            evaluacionDuplicado = await DuplicadosService.evaluarReingreso(prospectoId);
            reasignacionPermitida = evaluacionDuplicado.reingresable;
            estadoActualAsignacion = evaluacionDuplicado.estadoOriginal;

            if (evaluacionDuplicado.idVendedorOriginal) {
                const [vendedorRows] = await db.query(
                    'SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1',
                    [evaluacionDuplicado.idVendedorOriginal]
                );
                if (vendedorRows && vendedorRows.length > 0) {
                    vendedorActualInfo = `${vendedorRows[0].first_name || 'Vendedor'} ${vendedorRows[0].last_name || ''}`.trim() + ` (ID: ${evaluacionDuplicado.idVendedorOriginal})`;
                }
            }
        }

        // ✅ CREAR ASIGNACIÓN SOLO SI NO EXISTE y SI ESTÁ PERMITIDO
        if (reasignacionPermitida) {
            // Verificar si el vendedor ya tiene una asignación activa para este prospecto
            const [asignacionExistente] = await db.query(
                'SELECT id FROM asignaciones WHERE id_prospecto = ? AND id_vendedor = ? LIMIT 1',
                [prospectoId, req.user.id]
            );

            if (asignacionExistente && asignacionExistente.length > 0) {
                // Asignación ya existe - no crear nueva
                console.info(`ℹ️ Asignación ya existe para Prospecto #${prospectoId} y Vendedor #${req.user.id} - No se creará una nueva`);
            } else {
                // Crear la asignación solo si no existe
                // visible_refrito = 1: si el prospecto ya tenía es_reciclado=1 (o lo toma más abajo),
                // garantiza que sea visible de inmediato en el dashboard del vendedor (ver filtro
                // en prospectoModel.js findAll). Antes quedaba en el default 0 y el reingreso se
                // volvía invisible para el nuevo vendedor.
                await db.query(
                    `INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado, fecha_asignacion, visible_refrito) VALUES (?, ?, ?, ?, NOW(), NOW(), 1)`,
                    [prospectoId, req.user.id, esMayorDe65 ? 'Fuera de edad' : (data.estado || 'Lead'), data.comentario || null]
                );
                console.log(`✅ Nueva asignación creada para Prospecto #${prospectoId} y Vendedor #${req.user.id}`);

                if (esProspectoExistente) {
                    // Es un reingreso de dato repetido: auditar y trackear igual que en el formulario web
                    const [contadorRows] = await db.query(
                        'SELECT COALESCE(MAX(veces_reciclado), 0) + 1 AS contador FROM prospectos WHERE numero_contacto = ?',
                        [data.numero_contacto]
                    );
                    await db.query(
                        'UPDATE prospectos SET es_reciclado = 1, veces_reciclado = ? WHERE id = ?',
                        [contadorRows[0].contador, prospectoId]
                    );
                    await db.query(
                        `INSERT INTO reasignacion_auditoria (id_prospecto, id_vendedor_anterior, id_vendedor_nuevo, motivo, razon_automatica)
                         VALUES (?, ?, ?, ?, ?)`,
                        [prospectoId, evaluacionDuplicado.idVendedorOriginal, req.user.id, 'Reingreso de dato repetido desde Vendedor-App', evaluacionDuplicado.motivo]
                    );
                }
            }
        } else {
            console.info(`⛔ Reasignación bloqueada para Prospecto #${prospectoId}: ${evaluacionDuplicado.motivo}`);
        }

        // 📤 ENVIAR NOTIFICACIÓN DE ASIGNACIÓN
        try {
            const prospectoCreado = {
                id: prospectoId,
                nombre: data.nombre,
                apellido: data.apellido,
                numero_contacto: data.numero_contacto,
                estado: data.estado || 'Lead'
            };
            await NotificationsService.notificarAsignacionProspecto(req.user.id, prospectoCreado);
            console.log(`📱 Notificación de asignación enviada al vendedor ${req.user.id}`);
        } catch (notificationError) {
            console.error('⚠️ Error al enviar notificación de asignación:', notificationError.message);
            // No fallar la creación del prospecto si la notificación falla
        }

        // 📊 SINCRONIZAR CON GOOGLE SHEETS (origen: Vendedor-App)
        try {
            await GoogleSheetsService.agregarProspecto(prospectoId);
            console.log(`📊 Prospecto ${prospectoId} sincronizado con Google Sheets [Vendedor-App]`);
        } catch (sheetsError) {
            console.error('⚠️ Error sincronizando con Google Sheets:', sheetsError.message);
            // No fallar la creación del prospecto si la sincronización falla
        }

        // Solo generar cotización si NO es mayor de 65 años y si la operación lo amerita
        if (!esMayorDe65) {
            if (!esProspectoExistente || reasignacionPermitida) {
                // Generar cotización automática solo si es nuevo o si la reasignación está permitida
                const cotizaciones = await FormLead.cotizarLead(prospectoId);

                const message = esProspectoExistente
                    ? `Este contacto ya estaba en el sistema pero quedó estancado sin novedades (${evaluacionDuplicado.motivo}). Se te asignó para retomarlo.`
                    : "Prospecto creado correctamente y cotizado";

                return res.status(201).json({
                    message,
                    prospectoId,
                    esProspectoExistente,
                    esReingreso: !!esProspectoExistente,
                    vendedoresAsignados: vendedoresAsignados.length > 0 ? vendedoresAsignados : null,
                    reasignacionPermitida,
                    estadoActual: estadoActualAsignacion,
                    vendedorActual: vendedorActualInfo || null,
                    diasEstancado: evaluacionDuplicado ? evaluacionDuplicado.diasEstancado : null,
                    cotizaciones,
                });
            } else {
                // Duplicado con estado avanzado o aún dentro del plazo: no reasignar ni cotizar
                const message = `Este prospecto ya está siendo trabajado por ${vendedorActualInfo || 'otro vendedor'} en estado "${estadoActualAsignacion || 'N/D'}". No se reasignó (${evaluacionDuplicado.motivo}).`;
                return res.status(200).json({
                    message,
                    prospectoId,
                    esProspectoExistente: true,
                    esReingreso: false,
                    vendedoresAsignados: vendedoresAsignados.length > 0 ? vendedoresAsignados : null,
                    reasignacionPermitida: false,
                    estadoActual: estadoActualAsignacion,
                    vendedorActual: vendedorActualInfo || null,
                    diasEstancado: evaluacionDuplicado ? evaluacionDuplicado.diasEstancado : null
                });
            }
        } else {
            // Prospecto creado pero sin cotización por edad
            const message = esProspectoExistente
                ? `Prospecto existente detectado ${prospectoExistenteInfo} (sin cotización por restricción de edad +65 años)${vendedoresAsignados.length > 0 ? `. Asignado a: ${vendedoresAsignados.join(', ')}` : ''}`
                : "Prospecto creado correctamente (sin cotización por restricción de edad +65 años)";

            return res.status(201).json({
                message,
                prospectoId,
                esProspectoExistente,
                vendedoresAsignados: vendedoresAsignados.length > 0 ? vendedoresAsignados : null,
                reasignacionPermitida,
                estadoActual: estadoActualAsignacion,
                vendedorActual: vendedorActualInfo || null,
                warning: "Este prospecto no fue cotizado debido a restricciones legales para mayores de 65 años"
            });
        }
    } catch (error) {
        console.error("Error al crear prospecto:", error);
        res.status(500).json({ message: "Error al crear el prospecto." });
    }
};

const getProspectos = async (req, res) => {
    // Sin cambios
    try {
        const prospectos = await Prospecto.findAll(req.user.id);
        res.status(200).json(prospectos);
    } catch (error) {
        console.error("Error al obtener prospectos:", error);
        res.status(500).json({ message: "Error al obtener los prospectos." });
    }
};

const getProspectoById = async (req, res) => {
    // Sin cambios
    try {
        const { id } = req.params;
        const prospecto = await Prospecto.findById(id, req.user.id);
        if (!prospecto) {
            return res.status(404).json({ message: "Prospecto no encontrado." });
        }
        res.status(200).json(prospecto);
    } catch (error) {
        console.error("Error al obtener prospecto:", error);
        res.status(500).json({ message: "Error al obtener el prospecto." });
    }
};

const updateProspecto = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        // Validar ID del prospecto
        if (!id || !validator.isInt(id.toString())) {
            return res.status(400).json({ message: "ID de prospecto inválido." });
        }

        // Validar datos del prospecto
        const erroresProspecto = validarDatosProspecto(data);

        // Validar familiares si existen
        let erroresFamiliares = [];
        if (Array.isArray(data.familiares) && data.familiares.length > 0) {
            erroresFamiliares = validarFamiliares(data.familiares);
        }

        // Si hay errores, devolver respuesta con lista de errores
        const todosErrores = [...erroresProspecto, ...erroresFamiliares];
        if (todosErrores.length > 0) {
            return res.status(400).json({ 
                message: "Error de validación", 
                errores: todosErrores 
            });
        }

        // Sanitización de datos
        if (data.nombre) data.nombre = validator.escape(data.nombre.trim());
        if (data.apellido) data.apellido = validator.escape(data.apellido.trim());
        // 📱 NORMALIZAR NÚMERO PARA WHATSAPP (Argentina) - igual a FormLead
        if (data.numero_contacto) data.numero_contacto = normalizarNumeroWhatsApp(data.numero_contacto.trim());
        if (data.localidad) data.localidad = validator.escape(data.localidad.trim());
        if (data.correo) data.correo = validator.normalizeEmail(data.correo.trim());
        if (data.comentario) data.comentario = data.comentario.trim();

        // Sanitización de familiares
        if (Array.isArray(data.familiares)) {
            data.familiares.forEach(familiar => {
                familiar.nombre = validator.escape(familiar.nombre.trim());
                if (familiar.categoria_monotributo) {
                    familiar.categoria_monotributo = validator.escape(familiar.categoria_monotributo);
                }
            });
        }

        // Validación de estado
        if (data.estado) {
            const estadosValidos = [
                'Lead',
                '1º Contacto',
                'WhatsApp enviado',
                'Llamada telefónica',
                'Conversación iniciada por WhatsApp',
                'Promoción aplicada',
                'Calificado Cotización',
                'Calificado Póliza',
                'Calificado Pago',
                'Póliza iniciada',
                'Póliza generada',
                'Póliza enviada a supervisor',
                'Póliza pendiente a firma',
                'Póliza firmada',
                'Venta',
                'No Interesado',
                'Fuera de zona',
                'Fuera de edad',
                'Preexistencia',
                'Reafiliación',
                'No contesta',
                'prueba interna',
                'Ya es socio',
                'Busca otra Cobertura',
                'Teléfono erróneo',
                'No le interesa (económico)',
                'No le interesa cartilla',
                'No busca cobertura médica'
            ];
            if (!estadosValidos.includes(data.estado)) {
                return res.status(400).json({ message: "Estado no válido." });
            }
        }

        // Actualiza los datos generales del prospecto
        await Prospecto.update(id, req.user.id, data);

        // Si se envía estado o comentario, actualiza en asignaciones
        if (data.estado !== undefined || data.comentario !== undefined) {
            await Prospecto.updateAsignacion(
                id,
                req.user.id,
                data.estado || 'Lead',
                data.comentario || ''
            );

            // Registrar acción en el historial
            await registrarAccion(
                id,
                req.user.id,
                "Cambio de estado",
                `Estado cambiado a "${data.estado}" con comentario: "${data.comentario}"`
            );

            // 📊 SINCRONIZAR CON GOOGLE SHEETS (actualizar estado)
            try {
                await GoogleSheetsService.actualizarAsignacionEnSheet(id);
                console.log(`📊 Estado actualizado en Google Sheets para prospecto ${id}`);
            } catch (sheetsError) {
                console.error('⚠️ Error sincronizando actualización de estado con Google Sheets:', sheetsError.message);
                // No fallar la actualización del prospecto si la sincronización falla
            }
        }

        res.status(200).json({ message: "Prospecto actualizado con éxito." });
    } catch (error) {
        console.error("Error al actualizar prospecto:", error);
        if (error.code === "PROSPECTO_NOT_OWNED") {
            // 🔁 El lead fue reasignado (automática o manualmente) mientras se editaba.
            // 409 explícito para que el frontend avise y recargue, en vez de que el
            // asesor crea que guardó cuando en realidad se hizo ROLLBACK completo.
            return res.status(409).json({
                message: "Este prospecto fue reasignado a otro vendedor y tu cambio no se guardó. Recargá la página para ver el estado actual.",
                code: "PROSPECTO_NOT_OWNED"
            });
        }
        if (error.message === "Prospecto no encontrado o no autorizado.") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Error al actualizar el prospecto." });
    }
};

const deleteProspecto = async (req, res) => {
    // Sin cambios o función comentada si se ha eliminado esta funcionalidad
    try {
        const { id } = req.params;
        const result = await Prospecto.delete(id, req.user.id);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Prospecto no encontrado o no autorizado." });
        }
        res.status(200).json({ message: "Prospecto eliminado con éxito." });
    } catch (error) {
        console.error("Error al eliminar prospecto:", error);
        res.status(500).json({ message: "Error al eliminar el prospecto." });
    }
};

// ✅ NUEVO: Enviar primer contacto por WhatsApp
const enviarPrimerContactoWhatsApp = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        console.log(`🔍 Buscando prospecto ${id} para usuario ${userId}`);

        // Verificar que el prospecto existe y está asignado al vendedor
        const [prospecto] = await db.execute(
            `SELECT p.*, 
                    a.id_vendedor as vendedor_asignado,
                    u.supervisor_id,
                    v.first_name as vendedor_nombre,
                    v.last_name as vendedor_apellido
             FROM prospectos p 
             LEFT JOIN asignaciones a ON p.id = a.id_prospecto
             LEFT JOIN users u ON a.id_vendedor = u.id
             LEFT JOIN users v ON a.id_vendedor = v.id
             WHERE p.id = ? AND (a.id_vendedor = ? OR u.supervisor_id = ?)`,
            [id, userId, userId]
        );

        console.log(`📊 Resultado consulta prospecto: ${prospecto.length} registros encontrados`);
        if (prospecto.length > 0) {
            console.log(`✅ Prospecto encontrado: ${prospecto[0].nombre} ${prospecto[0].apellido}, vendedor_asignado: ${prospecto[0].vendedor_asignado}, supervisor_id: ${prospecto[0].supervisor_id}`);
        }

        if (prospecto.length === 0) {
            // Intentar una consulta más simple para debug
            const [prospectoSimple] = await db.execute(
                `SELECT p.*, 
                        a.id_vendedor as vendedor_asignado,
                        u.supervisor_id
                 FROM prospectos p 
                 LEFT JOIN asignaciones a ON p.id = a.id_prospecto
                 LEFT JOIN users u ON a.id_vendedor = u.id
                 WHERE p.id = ?`,
                [id]
            );
            
            console.log(`🔍 Debug - Prospecto existe: ${prospectoSimple.length > 0 ? 'SÍ' : 'NO'}`);
            if (prospectoSimple.length > 0) {
                console.log(`🔍 Debug - vendedor_asignado: ${prospectoSimple[0].vendedor_asignado}, supervisor_id: ${prospectoSimple[0].supervisor_id}, userId buscando: ${userId}`);
            }
            
            return res.status(404).json({ 
                success: false, 
                message: 'Prospecto no encontrado o no autorizado' 
            });
        }

        const prospectoData = prospecto[0];

        // Validar que tenga número de contacto
        if (!prospectoData.numero_contacto) {
            return res.status(400).json({ 
                success: false, 
                message: 'El prospecto no tiene número de contacto registrado' 
            });
        }

        // Verificar si ya existe una conversación WhatsApp activa
        // Preparar nombre completo del cliente
        const nombreCompleto = `${prospectoData.nombre} ${prospectoData.apellido}`;

        // Enviar mensaje de primer contacto usando WhatsApp Service
        const resultadoWhatsApp = await whatsappService.enviarPrimerContacto(
            prospectoData.numero_contacto,
            nombreCompleto
        );

        // Generar número de conversación único
        const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const [ultimaConversacion] = await db.execute(
            `SELECT numero_conversacion FROM chat_conversaciones_whatsapp 
             WHERE numero_conversacion LIKE 'CONV-${fechaHoy}-%' 
             ORDER BY id DESC LIMIT 1`
        );

        let numeroSecuencial = 1;
        if (ultimaConversacion.length > 0) {
            const ultimoNumero = ultimaConversacion[0].numero_conversacion;
            const secuencial = parseInt(ultimoNumero.split('-')[2]);
            numeroSecuencial = secuencial + 1;
        }

        const numeroConversacion = `CONV-${fechaHoy}-${numeroSecuencial.toString().padStart(4, '0')}`;

        // Crear nueva conversación de WhatsApp
        const [conversacion] = await db.execute(
            `INSERT INTO chat_conversaciones_whatsapp 
             (numero_conversacion, telefono, prospecto_id, vendedor_id, estado, tipo_origen) 
             VALUES (?, ?, ?, ?, 'activa', 'manual')`,
            [numeroConversacion, prospectoData.numero_contacto, id, userId]
        );

        const conversacionId = conversacion.insertId;

        // Registrar el mensaje enviado
        await db.execute(
            `INSERT INTO chat_mensajes 
             (conversacion_id, mensaje, tipo, origen, estado_entrega, twilio_message_sid) 
             VALUES (?, ?, 'enviado', 'vendedor', 'enviado', ?)`,
            [
                conversacionId,
                `👋 Hola ${nombreCompleto}, Te contactamos desde Cober | Medicina Privada por la consulta que realizaste en nuestra web 🌐. Si querés que un representante oficial se comunique con vos 📞 para brindarte más información ℹ️, respondé "Sí" ✅ a este mensaje.`,
                resultadoWhatsApp.message_id
            ]
        );

        // Registrar la acción en el historial
        await registrarAccion(
            id,
            userId,
            'whatsapp_primer_contacto',
            `Primer contacto enviado por WhatsApp al ${prospectoData.numero_contacto}`
        );

        // 🔄 ACTUALIZAR ESTADO A 'WhatsApp enviado' en tabla asignaciones
        try {
            const fechaHoraTextoWsp = new Date().toLocaleString('es-AR', {
                timeZone: 'America/Argentina/Buenos_Aires',
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            await db.execute(
                `UPDATE asignaciones
                 SET estado = 'WhatsApp enviado',
                     comentario = ?,
                     fecha_estado = NOW()
                 WHERE id_prospecto = ? AND id_vendedor = ?`,
                [`WhatsApp enviado el ${fechaHoraTextoWsp}`, id, userId]
            );
            console.log(`✅ Estado actualizado a 'WhatsApp enviado' para prospecto ${id}`);
        } catch (estadoErr) {
            console.error(`⚠️ Error actualizando estado:`, estadoErr.message);
            // No bloquear el envío si falla la actualización de estado
        }

        console.log(`✅ Primer contacto WhatsApp enviado al prospecto ${id}`);

        // 🆕 ACTUALIZACIÓN AUTOMÁTICA DEL SHEET: Sincronizar estado + columna P
        try {
            const GoogleSheetsService = require('../../services/googleSheetsService');
            console.log(`📊 Sincronizando Sheet completo para prospecto ${id} (estado + primer mensaje)`);
            
            // actualizarAsignacionEnSheet sincroniza el estado actualizado ('1º Contacto')
            // y también la fecha del primer mensaje desde la BD
            await GoogleSheetsService.actualizarAsignacionEnSheet(id);
            console.log(`✅ Sheet sincronizado exitosamente para prospecto ${id}`);
        } catch (err) {
            console.error(`⚠️ Error sincronizando Sheet para prospecto ${id}:`, err.message);
            // No bloquear el envío del mensaje si falla la sincronización
        }

        res.status(200).json({
            success: true,
            message: 'Primer contacto enviado por WhatsApp exitosamente',
            data: {
                prospecto_id: id,
                conversacion_id: conversacionId,
                whatsapp_sid: resultadoWhatsApp.message_id,
                numero_enviado: resultadoWhatsApp.recipient
            }
        });

    } catch (error) {
        console.error('❌ Error enviando primer contacto WhatsApp:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error interno del servidor al enviar WhatsApp',
            error: error.message 
        });
    }
};

// 🔄 Recotizar prospecto
const recotizarProspecto = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        console.log(`🔄 Recotizando prospecto ${id}...`);

        // Verificar que el prospecto pertenece al vendedor
        const [prospecto] = await db.query(
            `SELECT p.* FROM prospectos p
             JOIN asignaciones a ON p.id = a.id_prospecto
             WHERE p.id = ? AND a.id_vendedor = ?`,
            [id, userId]
        );

        if (!prospecto || prospecto.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Prospecto no encontrado o no autorizado' 
            });
        }

        // Ejecutar recotización (usa la función del modelo FormLead)
        await FormLead.cotizarLead(id);

        // Registrar la acción
        await registrarAccion(
            id,
            userId,
            'recotizacion',
            'Prospecto recotizado por actualización de datos'
        );

        console.log(`✅ Prospecto ${id} recotizado exitosamente`);

        res.status(200).json({
            success: true,
            message: 'Prospecto recotizado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error recotizando prospecto:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al recotizar el prospecto',
            error: error.message 
        });
    }
};

// ☎️ NUEVO: Registrar llamada telefónica a prospecto
const registrarLlamada = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Validar que el prospecto existe
        const [prospectos] = await db.query(
            'SELECT id, nombre, apellido, numero_contacto FROM prospectos WHERE id = ?',
            [id]
        );

        if (!prospectos || prospectos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Prospecto no encontrado'
            });
        }

        // Solo el vendedor asignado puede registrar la llamada. Antes, si no tenía asignación
        // se le creaba una nueva: un vendedor con la pantalla desactualizada recuperaba un lead
        // que la reasignación automática ya le había sacado y quedaba asignado a dos vendedores.
        const [asignacionExiste] = await db.query(
            'SELECT id FROM asignaciones WHERE id_prospecto = ? AND id_vendedor = ? LIMIT 1',
            [id, userId]
        );

        if (!asignacionExiste || asignacionExiste.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Este prospecto ya no está asignado a vos (puede haber sido reasignado). Actualizá la lista.'
            });
        }

        const prospecto = prospectos[0];
        const ahora = new Date();
        const fechaHoraTexto = ahora.toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const comentarioLlamada = `Llamada telefónica registrada el ${fechaHoraTexto}`;

        // Registrar la acción en el historial con timestamp automático
        await registrarAccion(
            id,
            userId,
            'llamada_telefonica',
            `Llamada realizada al ${prospecto.numero_contacto || 'prospecto'}`
        );

        // 🔄 ACTUALIZAR ESTADO A 'Llamada telefónica' y COMENTARIO con fecha/hora en tabla asignaciones
        try {
            // La asignación ya se validó arriba: solo se actualiza, nunca se crea
            await db.execute(
                `UPDATE asignaciones
                 SET estado = 'Llamada telefónica',
                     comentario = ?,
                     fecha_estado = NOW()
                 WHERE id_prospecto = ? AND id_vendedor = ?`,
                [comentarioLlamada, id, userId]
            );
            console.log(`✅ Estado actualizado a 'Llamada telefónica' para prospecto ${id}`);
        } catch (estadoErr) {
            console.error(`⚠️ Error actualizando estado:`, estadoErr.message);
            // No bloquear el registro de llamada si falla la actualización de estado
        }
        
        console.log(`☎️ Llamada registrada para prospecto ${id}`);
        
        // Actualizar Google Sheets - Estado ('1º Contacto') + Columna Q (Registro de Llamada Telefónica)
        try {
            // Primero actualizar el estado (columnas A-P) con '1º Contacto'
            await GoogleSheetsService.actualizarAsignacionEnSheet(id);
            console.log(`✅ Estado actualizado en Sheet para prospecto ${id}`);
            // Luego sobrescribir columna Q con la hora de la llamada
            const sheetUpdated = await GoogleSheetsService.actualizarRegistroLlamadaEnSheet(id, ahora);
            if (sheetUpdated) {
                console.log(`✅ Registro de llamada actualizado en Sheet para prospecto ${id}`);
            } else {
                console.warn(`⚠️ No se pudo actualizar el registro de llamada en Sheet para prospecto ${id}`);
            }
        } catch (sheetErr) {
            console.error(`❌ Error actualizando Sheet:`, sheetErr.message);
            // No lanzar error - la llamada ya fue registrada en BD, es solo un bonus actualizar el Sheet
        }
        
        res.status(200).json({
            success: true,
            message: 'Llamada registrada exitosamente',
            data: {
                prospecto_id: id,
                prospecto_nombre: `${prospecto.nombre} ${prospecto.apellido}`,
                timestamp: ahora.toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Error registrando llamada:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al registrar la llamada',
            error: error.message 
        });
    }
};

module.exports = {
    createProspecto,
    getProspectos,
    getProspectoById,
    updateProspecto,
    deleteProspecto,
    enviarPrimerContactoWhatsApp,
    recotizarProspecto,
    registrarLlamada,
};