// Fuente única de verdad de las taxonomías de Capa 3.
// Se usa para: (a) poblar taxonomia_valores, (b) validar salidas del modelo,
// (c) construir la sección fija del prompt. No editar valores sin bumpear VERSION.

const VERSION = 'v1';

const TAXONOMIAS = {
  tipo_mensaje: {
    descripcion: 'Acto de habla dominante del mensaje',
    valores: {
      saludo: 'Apertura social sin contenido comercial',
      presentacion: 'El vendedor se identifica a si mismo o a la empresa',
      pregunta: 'Pide informacion o confirmacion de forma generica',
      respuesta: 'Contesta directamente una pregunta previa del otro autor',
      pedido_de_informacion: 'Pregunta especificamente orientada a obtener un dato del prospecto',
      entrega_de_informacion: 'Aporta un dato objetivo sin que medie pregunta directa',
      explicacion: 'Desarrollo con razonamiento o justificacion',
      seguimiento: 'Retoma la conversacion tras inactividad sin aportar informacion nueva',
      objecion: 'El cliente plantea una razon para no avanzar',
      respuesta_a_objecion: 'El vendedor responde especificamente a una objecion',
      negociacion: 'Se discuten condiciones buscando un acuerdo',
      cierre: 'Orientado a formalizar la decision de compra',
      despedida: 'Cierre social sin contenido comercial',
      agradecimiento: 'Expresion de gratitud',
      otro: 'No encaja en ninguna categoria anterior',
    },
    prioridad: ['objecion','respuesta_a_objecion','cierre','negociacion','pedido_de_informacion','pregunta','entrega_de_informacion','explicacion','respuesta','seguimiento','presentacion','saludo','agradecimiento','despedida','otro'],
  },

  intencion_principal: {
    descripcion: 'Objetivo comercial perseguido con el mensaje',
    valores: {
      descubrir_necesidad: 'Indagar que busca el prospecto',
      calificar_prospecto: 'Verificar si cumple criterios (edad, zona, presupuesto)',
      solicitar_informacion: 'Pedir datos necesarios para cotizar/avanzar',
      brindar_informacion: 'Entregar datos solicitados o no',
      resolver_duda: 'Aclarar un malentendido o pregunta tecnica',
      convencer: 'Argumentar a favor de una decision de compra',
      reducir_incertidumbre: 'Bajar el riesgo percibido',
      generar_confianza: 'Construir relacion',
      generar_urgencia: 'Motivar una decision rapida',
      recuperar_conversacion: 'Reactivar un prospecto inactivo',
      coordinar_turno: 'Agendar una cita presencial/estudio medico',
      coordinar_llamada: 'Agendar una llamada telefonica',
      presentar_propuesta: 'Comunicar el plan/cotizacion concreta',
      cerrar_venta: 'Formalizar el acuerdo',
      otro: 'No encaja en ninguna categoria anterior',
    },
    prioridad: ['cerrar_venta','presentar_propuesta','convencer','reducir_incertidumbre','generar_urgencia','calificar_prospecto','descubrir_necesidad','resolver_duda','solicitar_informacion','brindar_informacion','coordinar_turno','coordinar_llamada','recuperar_conversacion','generar_confianza','otro'],
  },

  tema_principal: {
    descripcion: 'Asunto concreto del mensaje',
    valores: {
      precio: 'Costo del plan/cuota',
      cobertura: 'Que cubre o no cubre el plan',
      cartilla: 'Prestadores disponibles',
      plan: 'Caracteristicas generales del plan',
      edad: 'Edad de titular o familiares',
      localidad: 'Zona geografica',
      grupo_familiar: 'Composicion del grupo familiar',
      preexistencias: 'Condiciones de salud previas',
      documentacion: 'Papeles/tramites requeridos',
      medios_de_pago: 'Forma de pago',
      competencia: 'Otra empresa u obra social',
      turnos: 'Coordinacion de citas',
      afiliacion: 'Proceso de alta/afiliacion',
      beneficios: 'Beneficios adicionales del plan',
      promociones: 'Descuentos o promociones vigentes',
      otro: 'No encaja en ninguna categoria anterior',
    },
    prioridad: ['precio','preexistencias','competencia','cobertura','cartilla','plan','medios_de_pago','documentacion','afiliacion','grupo_familiar','promociones','beneficios','turnos','localidad','edad','otro'],
  },

  etapa_embudo: {
    descripcion: 'Momento del proceso comercial en que ocurre el mensaje',
    valores: {
      contacto_inicial: 'Primeros mensajes, sin intercambio sustantivo aun',
      descubrimiento: 'Se esta entendiendo que busca el prospecto',
      calificacion: 'Se evalua si cumple condiciones',
      recopilacion_de_datos: 'Se piden/entregan datos para cotizar',
      cotizacion: 'Se presenta o discute un precio/plan concreto',
      resolucion_de_objeciones: 'El prospecto plantea reparos y el vendedor responde',
      negociacion: 'Se ajustan condiciones',
      decision: 'El prospecto evalua explicitamente si avanza',
      cierre: 'Se formaliza la venta',
      postventa: 'Mensajes posteriores a la venta',
    },
    prioridad: null, // se resuelve por secuencia, no por prioridad de contenido (ver diseño Capa 3, sección 4)
  },

  nivel_interes: {
    descripcion: 'Intencion de compra normalizada del prospecto (solo autor=cliente)',
    valores: {
      muy_alto: 'Pide avanzar activamente (cerrar, pagar, coordinar)',
      alto: 'Preguntas especificas de avance sin reparos',
      medio: 'Responde pero sin iniciativa propia, o mezcla interes con dudas',
      bajo: 'Respuestas cortas, demoras largas, señales de desinteres sin cortar contacto',
      perdido: 'Expresa explicitamente no continuar, o deja de responder tras señales negativas',
    },
    prioridad: null, // depende de contexto conversacional, no de prioridad de contenido
  },

  estado_emocional_prospecto: {
    descripcion: 'Tono comercial del prospecto (no clinico) — solo autor=cliente',
    valores: {
      interesado: 'Muestra interes activo',
      indeciso: 'Duda entre opciones',
      confundido: 'No entiende algo explicado',
      preocupado: 'Inquietud sobre un aspecto puntual (cobertura, exclusiones)',
      apurado: 'Urgencia, mensajes cortos, pide rapidez',
      molesto: 'Fastidio o queja explicita',
      desconfiado: 'Duda de la legitimidad/seriedad',
      satisfecho: 'Conformidad explicita',
      neutral: 'Sin carga emocional evidente',
    },
    prioridad: ['molesto','desconfiado','preocupado','confundido','apurado','indeciso','interesado','satisfecho','neutral'],
  },

  objecion_principal: {
    descripcion: 'Razon concreta para no avanzar (NULL si contiene_objecion=0)',
    valores: {
      precio: 'Costo alto / no puede pagar',
      preexistencias: 'Teme que una condicion previa no este cubierta',
      cobertura: 'No cubre lo que necesita',
      competencia: 'Menciona otra empresa/obra social',
      confianza: 'Duda de la legitimidad de la empresa',
      cartilla: 'Prestadores no le convienen / no tiene el suyo',
      forma_de_pago: 'Medios ofrecidos no le sirven',
      documentacion: 'No tiene o no quiere presentar papeles',
      tiempo: 'No es el momento, quiere pensarlo',
      otro: 'No encaja en ninguna categoria anterior',
    },
    prioridad: ['precio','preexistencias','cobertura','competencia','confianza','cartilla','forma_de_pago','documentacion','tiempo','otro'],
  },

  proxima_accion_sugerida: {
    descripcion: 'Que deberia hacer el vendedor a continuacion (metadato, no se acciona en esta etapa)',
    valores: {
      enviar_cotizacion: 'Corresponde presentar precio/plan concreto',
      resolver_objecion: 'Hay una objecion abierta sin responder',
      pedir_dato_faltante: 'Falta un dato necesario para avanzar',
      coordinar_turno: 'Corresponde agendar cita',
      insistir: 'El prospecto esta inactivo pero no perdido',
      escalar_a_supervisor: 'Requiere intervencion de un supervisor',
      cerrar_venta: 'Esta en condiciones de cerrarse',
      ninguna_accion_requerida: 'No hay accion pendiente identificable',
    },
    prioridad: ['resolver_objecion','pedir_dato_faltante','enviar_cotizacion','coordinar_turno','cerrar_venta','insistir','escalar_a_supervisor','ninguna_accion_requerida'],
  },
};

function valoresValidos(taxonomia) {
  return Object.keys(TAXONOMIAS[taxonomia].valores);
}

function esValorValido(taxonomia, valor) {
  if (valor === null || valor === undefined) return true;
  return valoresValidos(taxonomia).includes(valor);
}

module.exports = { VERSION, TAXONOMIAS, valoresValidos, esValorValido };
