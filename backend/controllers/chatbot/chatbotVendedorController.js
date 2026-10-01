const { OpenAI } = require('openai');
const ChatbotVendedorModel = require('../../models/chatbot/chatbotVendedorModel');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Procesar mensaje del vendedor
const procesarMensajeVendedor = async (req, res) => {
  try {
    const { mensaje, conversacionId } = req.body;
    const vendedorId = req.user.id; // Obtenido del token JWT
    
    // Obtener o crear conversación
    let idConversacion = conversacionId;
    if (!idConversacion) {
      idConversacion = await ChatbotVendedorModel.crearConversacion(vendedorId);
    }
    
    // Obtener historial de la conversación
    const historial = await ChatbotVendedorModel.obtenerHistorial(idConversacion);
    const historialOpenAI = historial.map(m => ({ 
      role: m.rol, 
      content: m.contenido 
    }));
    
    // Añadir mensaje actual
    historialOpenAI.push({ role: "user", content: mensaje });
    
    // Sistema de prompts especializado para vendedores
    const systemPrompt = `
      Eres un asistente virtual especializado para vendedores de planes de salud COBER 360.
      Tu función es ayudar a los vendedores con información sobre:
      
      📋 CAPACIDADES:
      1. CONSULTAR PRECIOS: Por edad, plan, año
      2. INFORMACIÓN DE PROMOCIONES: Descuentos activos y vigencias
      3. BASE DE PRESTADORES: Por zona, especialidad, plan
      4. COMPARAR PLANES: Ventajas, precios, cobertura
      5. RECOMENDACIONES: Sugerir el mejor plan según perfil
      
      🎯 OBJETIVO:
      - Proporcionar información rápida y precisa
      - Ayudar en la venta con datos actualizados
      - Facilitar consultas durante llamadas con clientes
      - NO crear leads ni guardar datos de prospectos
      
      📊 TIPOS DE CONSULTA:
      - "precios para edad X" → Buscar precios por edad
      - "promociones activas" → Mostrar descuentos vigentes
      - "prestadores en [zona]" → Listar prestadores por localidad
      - "plan [X] vs [Y]" → Comparar planes específicos
      - "especialista en [área]" → Buscar por especialidad
      
      🗣️ ESTILO:
      - Conciso y profesional
      - Datos específicos y actualizados
      - Fácil de leer durante una llamada
      - Incluir precios exactos y fechas cuando sea relevante
      
      ⚠️ IMPORTANTE:
      - Solo consulta información, NO crea leads
      - Proporciona datos precisos para cerrar ventas
      - Si no tienes la información, ofrece consultar la base de datos
    `;
    
    // Configurar funciones disponibles para el asistente
    const functionsConfig = [
      {
        name: "consultar_precios",
        description: "Consulta precios de planes por edad",
        parameters: {
          type: "object",
          properties: {
            edad: { 
              type: "number", 
              description: "Edad del prospecto" 
            },
            plan_id: { 
              type: "number", 
              description: "ID del plan específico (opcional)",
              nullable: true 
            },
            anio: { 
              type: "number", 
              description: "Año de la lista de precios (opcional, default: actual)",
              nullable: true 
            }
          },
          required: ["edad"]
        }
      },
      {
        name: "obtener_promociones",
        description: "Obtiene las promociones activas",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "buscar_prestadores",
        description: "Busca prestadores por zona, plan o especialidad",
        parameters: {
          type: "object",
          properties: {
            plan_id: { 
              type: "number", 
              description: "ID del plan (opcional)",
              nullable: true 
            },
            localidad: { 
              type: "string", 
              description: "Localidad o zona (opcional)",
              nullable: true 
            },
            especialidad: { 
              type: "string", 
              description: "Especialidad médica (opcional)",
              nullable: true 
            }
          },
          required: []
        }
      },
      {
        name: "comparar_planes",
        description: "Compara todos los planes disponibles para una edad",
        parameters: {
          type: "object",
          properties: {
            edad: { 
              type: "number", 
              description: "Edad para comparar precios" 
            },
            anio: { 
              type: "number", 
              description: "Año de comparación (opcional)",
              nullable: true 
            }
          },
          required: ["edad"]
        }
      },
      {
        name: "obtener_planes",
        description: "Obtiene lista de todos los planes disponibles",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ];
    
    // Llamada a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        ...historialOpenAI
      ],
      functions: functionsConfig,
      function_call: "auto",
      temperature: 0.1 // Más determinístico para datos precisos
    });
    
    const respuesta = completion.choices[0].message;
    
    // Guardar mensaje del usuario
    await ChatbotVendedorModel.guardarMensaje(
      idConversacion, 
      'user', 
      mensaje
    );
    
    let contenidoRespuesta = respuesta.content || "Procesando tu consulta...";
    let tipoConsulta = null;
    let datosConsulta = null;
    
    // Procesar function calls
    if (respuesta.function_call) {
      const nombreFuncion = respuesta.function_call.name;
      const argumentos = JSON.parse(respuesta.function_call.arguments);
      
      tipoConsulta = nombreFuncion;
      datosConsulta = argumentos;
      
      try {
        switch (nombreFuncion) {
          case "consultar_precios":
            const precios = await ChatbotVendedorModel.obtenerPrecios(
              argumentos.edad, 
              argumentos.anio, 
              argumentos.plan_id
            );
            
            if (precios.length > 0) {
              contenidoRespuesta = formatearRespuestaPrecios(precios, argumentos.edad);
            } else {
              contenidoRespuesta = `No encontré precios para edad ${argumentos.edad}. Verifica la edad o consulta al administrador.`;
            }
            break;
            
          case "obtener_promociones":
            const promociones = await ChatbotVendedorModel.obtenerPromociones();
            contenidoRespuesta = formatearRespuestaPromociones(promociones);
            break;
            
          case "buscar_prestadores":
            let prestadores;
            if (argumentos.especialidad) {
              prestadores = await ChatbotVendedorModel.buscarPorEspecialidad(argumentos.especialidad);
            } else {
              prestadores = await ChatbotVendedorModel.obtenerPrestadores(
                argumentos.plan_id, 
                argumentos.localidad
              );
            }
            contenidoRespuesta = formatearRespuestaPrestadores(prestadores, argumentos);
            break;
            
          case "comparar_planes":
            const comparacion = await ChatbotVendedorModel.compararPlanes(
              argumentos.edad, 
              argumentos.anio
            );
            contenidoRespuesta = formatearRespuestaComparacion(comparacion, argumentos.edad);
            break;
            
          case "obtener_planes":
            const planes = await ChatbotVendedorModel.obtenerPlanes();
            contenidoRespuesta = formatearRespuestaPlanes(planes);
            break;
            
          default:
            contenidoRespuesta = "Función no reconocida. ¿Puedes reformular tu consulta?";
        }
      } catch (error) {
        console.error(`Error en función ${nombreFuncion}:`, error);
        contenidoRespuesta = `Error al consultar ${nombreFuncion.replace('_', ' ')}: ${error.message}`;
      }
    }
    
    // Guardar respuesta del asistente
    await ChatbotVendedorModel.guardarMensaje(
      idConversacion, 
      'assistant', 
      contenidoRespuesta,
      tipoConsulta,
      datosConsulta
    );
    
    res.status(200).json({
      mensaje: contenidoRespuesta,
      conversacionId: idConversacion,
      tipoConsulta,
      datosConsulta
    });
    
  } catch (error) {
    console.error("Error en chatbot vendedor:", error);
    res.status(500).json({ 
      message: "Error al procesar consulta",
      error: error.message 
    });
  }
};

// ===============================================
// FUNCIONES DE FORMATEO DE RESPUESTAS
// ===============================================

function formatearRespuestaPrecios(precios, edad) {
  let respuesta = `💰 **PRECIOS PARA EDAD ${edad} AÑOS**\n\n`;
  
  const planesSinDuplicar = {};
  precios.forEach(precio => {
    if (!planesSinDuplicar[precio.plan_nombre]) {
      planesSinDuplicar[precio.plan_nombre] = precio;
    }
  });
  
  Object.values(planesSinDuplicar).forEach(precio => {
    respuesta += `🔹 **${precio.plan_nombre}**: $${precio.precio.toLocaleString()}\n`;
    if (precio.tipo_familia) {
      respuesta += `   Tipo familia: ${precio.tipo_familia}\n`;
    }
    respuesta += `   Rango edad: ${precio.edad_min}-${precio.edad_max} años\n\n`;
  });
  
  respuesta += `📅 Año: ${precios[0]?.anio || new Date().getFullYear()}\n`;
  respuesta += `💡 *Tip: Estos precios pueden tener descuentos por promociones activas*`;
  
  return respuesta;
}

function formatearRespuestaPromociones(promociones) {
  if (promociones.length === 0) {
    return "❌ No hay promociones activas en este momento.";
  }
  
  let respuesta = "🎉 **PROMOCIONES ACTIVAS**\n\n";
  
  promociones.forEach(promo => {
    respuesta += `🏷️ **${promo.nombre}**\n`;
    respuesta += `   💸 Descuento: ${promo.descuento_porcentaje}%\n`;
    if (promo.descripcion) {
      respuesta += `   📝 ${promo.descripcion}\n`;
    }
    if (promo.fecha_fin) {
      respuesta += `   ⏰ Válida hasta: ${new Date(promo.fecha_fin).toLocaleDateString()}\n`;
    }
    respuesta += "\n";
  });
  
  respuesta += "💡 *Aplica estas promociones para mejorar tu propuesta de venta*";
  
  return respuesta;
}

function formatearRespuestaPrestadores(prestadores, argumentos) {
  if (prestadores.length === 0) {
    let filtro = "";
    if (argumentos.localidad) filtro += ` en ${argumentos.localidad}`;
    if (argumentos.especialidad) filtro += ` especialistas en ${argumentos.especialidad}`;
    return `❌ No encontré prestadores${filtro}.`;
  }
  
  let respuesta = "🏥 **PRESTADORES DISPONIBLES**\n\n";
  
  if (argumentos.localidad) {
    respuesta += `📍 Zona: ${argumentos.localidad}\n`;
  }
  if (argumentos.especialidad) {
    respuesta += `🩺 Especialidad: ${argumentos.especialidad}\n`;
  }
  respuesta += "\n";
  
  // Agrupar por localidad
  const porLocalidad = prestadores.reduce((acc, prest) => {
    const loc = prest.localidad || 'Sin especificar';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(prest);
    return acc;
  }, {});
  
  Object.entries(porLocalidad).forEach(([localidad, prests]) => {
    respuesta += `📍 **${localidad}:**\n`;
    
    prests.slice(0, 10).forEach(prest => { // Máximo 10 por zona
      respuesta += `   🔹 ${prest.nombre}`;
      if (prest.especialidad) {
        respuesta += ` (${prest.especialidad})`;
      }
      if (prest.telefono) {
        respuesta += ` - 📞 ${prest.telefono}`;
      }
      respuesta += `\n`;
    });
    
    if (prests.length > 10) {
      respuesta += `   ... y ${prests.length - 10} más\n`;
    }
    respuesta += "\n";
  });
  
  respuesta += `📊 **Total encontrados:** ${prestadores.length}`;
  
  return respuesta;
}

function formatearRespuestaComparacion(comparacion, edad) {
  if (comparacion.length === 0) {
    return `❌ No encontré planes disponibles para edad ${edad} años.`;
  }
  
  let respuesta = `📊 **COMPARACIÓN DE PLANES - EDAD ${edad} AÑOS**\n\n`;
  
  // Ordenar por precio
  comparacion.sort((a, b) => a.precio - b.precio);
  
  comparacion.forEach((plan, index) => {
    const posicion = index === 0 ? "💰 MÁS ECONÓMICO" : 
                   index === comparacion.length - 1 ? "⭐ PREMIUM" : 
                   `${index + 1}º`;
    
    respuesta += `${posicion}: **${plan.plan_nombre}**\n`;
    respuesta += `   💵 Precio: $${plan.precio.toLocaleString()}\n`;
    respuesta += `   🏥 Prestadores: ${plan.total_prestadores}\n`;
    if (plan.descripcion) {
      respuesta += `   📝 ${plan.descripcion}\n`;
    }
    respuesta += "\n";
  });
  
  // Diferencia de precios
  if (comparacion.length > 1) {
    const diferencia = comparacion[comparacion.length - 1].precio - comparacion[0].precio;
    respuesta += `💡 **Diferencia entre el más caro y más barato:** $${diferencia.toLocaleString()}`;
  }
  
  return respuesta;
}

function formatearRespuestaPlanes(planes) {
  if (planes.length === 0) {
    return "❌ No se encontraron planes disponibles.";
  }
  
  let respuesta = "📋 **PLANES DISPONIBLES**\n\n";
  
  planes.forEach((plan, index) => {
    respuesta += `${index + 1}. **${plan.nombre}**`;
    if (plan.descripcion) {
      respuesta += `\n   📝 ${plan.descripcion}`;
    }
    respuesta += `\n   🆔 ID: ${plan.id}\n\n`;
  });
  
  respuesta += "💡 *Usa el ID del plan para consultas específicas de precios o prestadores*";
  
  return respuesta;
}

// Obtener conversaciones del vendedor
const obtenerConversacionesVendedor = async (req, res) => {
  try {
    const vendedorId = req.user.id;
    const conversaciones = await ChatbotVendedorModel.obtenerConversaciones(vendedorId);
    
    res.status(200).json(conversaciones);
  } catch (error) {
    console.error("Error al obtener conversaciones:", error);
    res.status(500).json({ message: "Error al obtener conversaciones" });
  }
};

// Obtener historial de conversación específica
const obtenerHistorialVendedor = async (req, res) => {
  try {
    const { conversacionId } = req.params;
    const vendedorId = req.user.id;
    
    // Verificar que la conversación pertenece al vendedor
    const [conversacion] = await db.query(
      'SELECT id FROM chatbot_vendedor_conversaciones WHERE id = ? AND vendedor_id = ?',
      [conversacionId, vendedorId]
    );
    
    if (conversacion.length === 0) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }
    
    const historial = await ChatbotVendedorModel.obtenerHistorial(conversacionId);
    res.status(200).json(historial);
    
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).json({ message: "Error al obtener historial" });
  }
};

module.exports = {
  procesarMensajeVendedor,
  obtenerConversacionesVendedor,
  obtenerHistorialVendedor
};