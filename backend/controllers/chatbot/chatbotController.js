const db = require('../../config/db');
const FormLead = require('../../models/formLead/formModel');
const validator = require('validator');
const NotificationsService = require('../../services/notificationsService');

// Inicialización condicional de OpenAI
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
  try {
    const { OpenAI } = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI inicializado correctamente');
  } catch (error) {
    console.warn('⚠️ Error al inicializar OpenAI:', error.message);
  }
} else {
  console.warn('⚠️ OPENAI_API_KEY no configurada o inválida. El chatbot funcionará en modo degradado.');
}

// Función para determinar tipo de grupo familiar (reutilizando la lógica existente)
const determinarTipoGrupoFamiliar = (familiares) => {
  if (!familiares || familiares.length === 0) return "INDIVIDUAL";
  const tienePareja = familiares.some(f => f.vinculo === "pareja/conyuge");
  if (tienePareja) return "MATRIMONIO";
  const tieneHijo = familiares.some(f => f.vinculo === "hijo/a");
  if (tieneHijo) return "HIJO";
  const tieneFamiliarCargo = familiares.some(f => f.vinculo === "familiar a cargo");
  if (tieneFamiliarCargo) return "FAMILIAR A CARGO";
  return "INDIVIDUAL";
};

// Procesar mensaje y generar respuesta
const procesarMensaje = async (req, res) => {
  try {
    const { mensaje, conversacionId, usuarioId } = req.body;
    
    // Obtener historial de la conversación
    let historial = [];
    if (conversacionId) {
      const [mensajes] = await db.query(
        'SELECT rol, contenido FROM chatbot_mensajes WHERE conversacion_id = ? ORDER BY creado_en ASC',
        [conversacionId]
      );
      historial = mensajes.map(m => ({ role: m.rol, content: m.contenido }));
    }
    
    // Añadir mensaje actual al historial
    historial.push({ role: "user", content: mensaje });
    
    // Preparar contexto para OpenAI - Ajustado según el modelo de datos
    const systemPrompt = `
      Eres un asistente virtual especializado en cotizar planes de salud. 
      Tu objetivo es recopilar toda la información necesaria del prospecto de forma conversacional y amigable.
      
      CAMPOS OBLIGATORIOS que debes obtener:
      - nombre (string): Nombre del titular
      - apellido (string): Apellido del titular
      - numero_contacto (string): Número de teléfono válido
      - correo (string): Email válido
      - localidad (string): Lugar de residencia
      - edad (number): Edad del titular (entre 0 y 120)
      - tipo_afiliacion_id (number): 
          1 = Particular/autónomo
          2 = Con recibo de sueldo
          3 = Monotributista
      
      CAMPOS ADICIONALES según tipo_afiliacion_id:
      - Si es tipo 2 (Con recibo de sueldo): necesitas sueldo_bruto (number)
      - Si es tipo 3 (Monotributista): necesitas categoria_monotributo (string, letras A-K)
      
      INFORMACIÓN DE FAMILIARES (si aplica):
      Para cada familiar, necesitas:
      - vinculo: "pareja/conyuge", "hijo/a" o "familiar a cargo"
      - nombre: Nombre del familiar
      - edad: Edad del familiar (number)
      
      Si el familiar es "pareja/conyuge", también necesitas:
      - tipo_afiliacion_id (igual que el titular)
      - campos adicionales según tipo_afiliacion_id
      
      IMPORTANTE:
      1. Haz preguntas específicas una a la vez para evitar confusión
      2. Verifica que el correo tenga un formato válido
      3. Confirma los datos obtenidos antes de finalizar
      4. NO marques los datos como completos hasta verificar que tienes TODOS los campos obligatorios
      5. El tipo_afiliacion_id debe ser un número (1, 2 o 3)
      6. La edad debe ser un número entre 0 y 120
      
      EJEMPLO DE FLUJO DE CONVERSACIÓN:
      1. Solicita nombre y apellido
      2. Pregunta edad
      3. Consulta tipo de afiliación (explicando opciones)
      4. Según tipo, pide datos adicionales (sueldo o categoría monotributo)
      5. Pregunta por datos de contacto (teléfono, email, localidad)
      6. Consulta si tiene familiares para incluir
      7. Para cada familiar, obtén sus datos
      8. Resume la información y confirma
    `;
    
    // Enviar a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        ...historial
      ],
      functions: [
        {
          name: "extraer_datos_prospecto",
          description: "Extrae los datos del prospecto para cotización",
          parameters: {
            type: "object",
            properties: {
              nombre: { 
                type: "string", 
                description: "Nombre del titular" 
              },
              apellido: { 
                type: "string", 
                description: "Apellido del titular" 
              },
              edad: { 
                type: "number", 
                description: "Edad del titular (0-120)" 
              },
              tipo_afiliacion_id: { 
                type: "number", 
                description: "Tipo de afiliación: 1=Particular/autónomo, 2=Con recibo de sueldo, 3=Monotributista" 
              },
              sueldo_bruto: { 
                type: "number", 
                description: "Sueldo bruto mensual (solo para tipo_afiliacion_id=2)",
                nullable: true 
              },
              categoria_monotributo: { 
                type: "string", 
                description: "Categoría de monotributo A-K (solo para tipo_afiliacion_id=3)",
                nullable: true 
              },
              numero_contacto: { 
                type: "string", 
                description: "Número de teléfono" 
              },
              correo: { 
                type: "string", 
                description: "Correo electrónico válido" 
              },
              localidad: { 
                type: "string", 
                description: "Localidad de residencia" 
              },
              familiares: {
                type: "array",
                description: "Lista de familiares a incluir en la cotización",
                items: {
                  type: "object",
                  properties: {
                    vinculo: { 
                      type: "string", 
                      enum: ["pareja/conyuge", "hijo/a", "familiar a cargo"],
                      description: "Tipo de relación con el titular" 
                    },
                    nombre: { 
                      type: "string", 
                      description: "Nombre del familiar" 
                    },
                    edad: { 
                      type: "number", 
                      description: "Edad del familiar (0-120)" 
                    },
                    tipo_afiliacion_id: { 
                      type: "number", 
                      description: "Tipo de afiliación (solo para pareja/conyuge): 1=Particular, 2=Recibo sueldo, 3=Monotributo",
                      nullable: true 
                    },
                    sueldo_bruto: { 
                      type: "number", 
                      description: "Sueldo bruto mensual (solo para pareja con tipo_afiliacion_id=2)",
                      nullable: true 
                    },
                    categoria_monotributo: { 
                      type: "string", 
                      description: "Categoría monotributo A-K (solo para pareja con tipo_afiliacion_id=3)",
                      nullable: true 
                    }
                  },
                  required: ["vinculo", "nombre", "edad"]
                }
              },
              datos_completos: { 
                type: "boolean", 
                description: "Indica si se han recopilado todos los datos necesarios" 
              }
            },
            required: ["nombre", "apellido", "edad", "tipo_afiliacion_id", "numero_contacto", "correo", "localidad", "datos_completos"]
          }
        }
      ],
      function_call: "auto"
    });
    
    const respuesta = completion.choices[0].message;
    
    // Guardar conversación y mensajes
    let idConversacion = conversacionId;
    if (!idConversacion) {
      const [result] = await db.query(
        'INSERT INTO chatbot_conversaciones (usuario_id, creado_en) VALUES (?, NOW())',
        [usuarioId]
      );
      idConversacion = result.insertId;
    }
    
    // Guardar mensaje del usuario
    await db.query(
      'INSERT INTO chatbot_mensajes (conversacion_id, rol, contenido, creado_en) VALUES (?, ?, ?, NOW())',
      [idConversacion, 'user', mensaje]
    );
    
    // Guardar respuesta del asistente - asegurar que content no sea NULL
    const contenidoRespuesta = respuesta.content || 
      (respuesta.function_call ? "Estoy procesando tu información..." : 
      "Lo siento, no pude procesar tu solicitud correctamente.");

    await db.query(
      'INSERT INTO chatbot_mensajes (conversacion_id, rol, contenido, creado_en) VALUES (?, ?, ?, NOW())',
      [idConversacion, 'assistant', contenidoRespuesta]
    );
    
    // Verificar si tenemos datos completos para cotización
    let cotizacion = null;
    if (respuesta.function_call && respuesta.function_call.name === "extraer_datos_prospecto") {
      let datosProspecto;
      try {
        datosProspecto = JSON.parse(respuesta.function_call.arguments);
      } catch (error) {
        console.error("Error al parsear los datos:", error);
        return res.status(200).json({
          mensaje: "Hubo un error al procesar tus datos. ¿Podemos intentarlo de nuevo?",
          conversacionId: idConversacion,
          cotizacion: null
        });
      }
      
      if (datosProspecto.datos_completos) {
        // Validar datos antes de procesar
        try {
          // Verificar campos obligatorios
          if (!datosProspecto.nombre || !datosProspecto.apellido || 
              !datosProspecto.numero_contacto || !datosProspecto.localidad ||
              !datosProspecto.correo || !datosProspecto.edad || 
              !datosProspecto.tipo_afiliacion_id) {
            throw new Error("Faltan campos obligatorios.");
          }
          
          // Validar correo
          if (!validator.isEmail(datosProspecto.correo)) {
            throw new Error("El correo electrónico no es válido.");
          }
          
          // Validar edad
          if (isNaN(datosProspecto.edad) || datosProspecto.edad < 0 || datosProspecto.edad > 120) {
            throw new Error("La edad debe ser un número entre 0 y 120.");
          }
          
          // Validar tipo afiliación
          if (![1, 2, 3].includes(datosProspecto.tipo_afiliacion_id)) {
            throw new Error("Tipo de afiliación inválido.");
          }
          
          // Validar campos según tipo de afiliación
          if (datosProspecto.tipo_afiliacion_id === 2 && !datosProspecto.sueldo_bruto) {
            throw new Error("Para afiliados con recibo de sueldo, es necesario especificar el sueldo bruto.");
          }
          
          if (datosProspecto.tipo_afiliacion_id === 3 && !datosProspecto.categoria_monotributo) {
            throw new Error("Para monotributistas, es necesario especificar la categoría.");
          }
          
          // Validar familiares si existen
          if (Array.isArray(datosProspecto.familiares)) {
            for (const familiar of datosProspecto.familiares) {
              if (!familiar.nombre || !familiar.edad || !familiar.vinculo) {
                throw new Error(`Faltan datos obligatorios para el familiar ${familiar.nombre || "sin nombre"}.`);
              }
              
              if (isNaN(familiar.edad) || familiar.edad < 0 || familiar.edad > 120) {
                throw new Error(`La edad del familiar ${familiar.nombre} debe ser un número entre 0 y 120.`);
              }
              
              if (familiar.vinculo === "pareja/conyuge") {
                if (!familiar.tipo_afiliacion_id || ![1, 2, 3].includes(familiar.tipo_afiliacion_id)) {
                  throw new Error(`Tipo de afiliación inválido para ${familiar.nombre}.`);
                }
                
                if (familiar.tipo_afiliacion_id === 2 && !familiar.sueldo_bruto) {
                  throw new Error(`Para ${familiar.nombre} con recibo de sueldo, es necesario especificar el sueldo bruto.`);
                }
                
                if (familiar.tipo_afiliacion_id === 3 && !familiar.categoria_monotributo) {
                  throw new Error(`Para ${familiar.nombre} monotributista, es necesario especificar la categoría.`);
                }
              }
            }
          }
          
          // Eliminar campo datos_completos
          delete datosProspecto.datos_completos;
          
          // Generar cotización
          const prospectoId = await FormLead.createLead(datosProspecto);
          
          // Guardar familiares si existen
          if (Array.isArray(datosProspecto.familiares) && datosProspecto.familiares.length > 0) {
            for (const fam of datosProspecto.familiares) {
              await FormLead.addFamiliar(prospectoId, fam);
            }
          }
          
          // Detectar tipo de grupo familiar
          const tipoGrupo = determinarTipoGrupoFamiliar(datosProspecto.familiares);
          await FormLead.guardarGrupoFamiliar(prospectoId, tipoGrupo);
          
          // ⛔ Regla de edad: mismo criterio que el formulario web (ver formController).
          // Un mayor de 65 no entra al round-robin ni se cotiza; queda registrado como
          // 'Fuera de edad' para que lo vea BackOffice.
          const edadTitularChat = Number(datosProspecto.edad);
          const esMayor65Chat = Number.isFinite(edadTitularChat) && edadTitularChat > 65;

          if (esMayor65Chat) {
            await db.query(
              'UPDATE prospectos SET estado = ? WHERE id = ?',
              ['Fuera de edad', prospectoId]
            );

            await db.query(
              'UPDATE chatbot_conversaciones SET estado = "completada", prospecto_id = ? WHERE id = ?',
              [prospectoId, idConversacion]
            );

            const mensajeFueraDeEdad = "Gracias por tus datos. Por el momento no podemos generar una cotización online para personas mayores de 65 años. Un asesor se va a comunicar con vos para ver las alternativas disponibles.";

            await db.query(
              'INSERT INTO chatbot_mensajes (conversacion_id, rol, contenido, creado_en) VALUES (?, ?, ?, NOW())',
              [idConversacion, 'assistant', mensajeFueraDeEdad]
            );

            console.info(`Prospecto ${prospectoId} (chatbot) con edad ${edadTitularChat} no será autoasignado ni cotizado por regla (>65).`);

            return res.status(200).json({
              mensaje: mensajeFueraDeEdad,
              conversacionId: idConversacion,
              cotizacion: null
            });
          }

          // Asignar vendedor
          const vendedorId = await FormLead.autoasignarVendedor(prospectoId);
          
          // 📤 ENVIAR NOTIFICACIÓN DE ASIGNACIÓN
          try {
            const prospectoData = {
              id: prospectoId,
              nombre: datosProspecto.nombre,
              apellido: datosProspecto.apellido,
              numero_contacto: datosProspecto.numero_contacto,
              estado: 'Lead'
            };
            await NotificationsService.notificarAsignacionProspecto(vendedorId, prospectoData);
            console.log(`📱 Notificación de asignación enviada al vendedor ${vendedorId}`);
          } catch (notificationError) {
            console.error('⚠️ Error al enviar notificación de asignación desde chatbot:', notificationError.message);
            // No fallar la creación del prospecto si la notificación falla
          }
          
          // Generar cotización
          cotizacion = await FormLead.cotizarLead(prospectoId);
          
          // Marcar conversación como completada
          await db.query(
            'UPDATE chatbot_conversaciones SET estado = "completada", prospecto_id = ? WHERE id = ?',
            [prospectoId, idConversacion]
          );
          
          // Generar mensaje personalizado con el resumen de la cotización
          let mensajeCotizacion = "¡Excelente! He generado tu cotización. A continuación, un resumen:\n\n";
          
          if (cotizacion && cotizacion.length > 0) {
            const planEconomico = cotizacion.reduce((prev, current) => 
              prev.total_final < current.total_final ? prev : current, cotizacion[0]);
            
            mensajeCotizacion += `Plan más económico: ${planEconomico.plan_nombre}\n`;
            mensajeCotizacion += `Precio final: $${planEconomico.total_final}\n`;
            mensajeCotizacion += `Descuentos aplicados: $${planEconomico.total_descuento_aporte + planEconomico.total_descuento_promocion}\n\n`;
            mensajeCotizacion += "Un asesor se pondrá en contacto contigo para brindarte más detalles sobre todos los planes disponibles.";
            
            // Guardar mensaje con el resumen
            await db.query(
              'INSERT INTO chatbot_mensajes (conversacion_id, rol, contenido, creado_en) VALUES (?, ?, ?, NOW())',
              [idConversacion, 'assistant', mensajeCotizacion]
            );
          }
          
        } catch (error) {
          console.error("Error al procesar la cotización:", error);
          
          // Enviar mensaje de error personalizado
          const mensajeError = `Lo siento, hubo un problema: ${error.message} ¿Podrías proporcionar esa información nuevamente?`;
          
          await db.query(
            'INSERT INTO chatbot_mensajes (conversacion_id, rol, contenido, creado_en) VALUES (?, ?, ?, NOW())',
            [idConversacion, 'assistant', mensajeError]
          );
          
          return res.status(200).json({
            mensaje: mensajeError,
            conversacionId: idConversacion,
            cotizacion: null
          });
        }
      }
    }
    
    res.status(200).json({
      mensaje: contenidoRespuesta,
      conversacionId: idConversacion,
      cotizacion
    });
    
  } catch (error) {
    console.error("Error en el chatbot:", error);
    res.status(500).json({ message: "Error al procesar el mensaje" });
  }
};

// Obtener historial de conversación
const obtenerHistorial = async (req, res) => {
  try {
    const { conversacionId } = req.params;
    
    const [mensajes] = await db.query(
      'SELECT id, rol, contenido, creado_en FROM chatbot_mensajes WHERE conversacion_id = ? ORDER BY creado_en ASC',
      [conversacionId]
    );
    
    res.status(200).json(mensajes);
    
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).json({ message: "Error al obtener historial de conversación" });
  }
};

module.exports = {
  procesarMensaje,
  obtenerHistorial
};