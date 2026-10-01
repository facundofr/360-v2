// Orquestador de Capa 3 (Pasos 1-6 del diseño). Unidad de procesamiento: conversación
// completa, en orden cronológico, con ventana de contexto de mensajes ya clasificados.
// Lee de: features_mensaje, planes, prestadores (solo SELECT).
// Escribe en: features_mensaje (solo columnas semánticas) y
// features_mensaje_historial_clasificacion. Nunca toca tablas operativas.

const db = require('../../config/db');
const reglas = require('./reglas');
const { clasificarMensaje, MODELO, PROMPT_VERSION, TAXONOMIA_VERSION, obtenerYResetearReintentos } = require('./clasificadorIA');
const { validar } = require('./validaciones');
const { redactarParaLog } = require('./enmascarado');
const { UMBRAL_OBJECION_OTRO } = require('./config');

const VENTANA_CONTEXTO = 5;

// contiene_objecion=1 pero el modelo no precisó la categoría: si confía lo suficiente en
// que hay objeción, se asume 'otro'; si no, se deja null y validar() la rechaza (queda
// pendiente de revisión en vez de persistirse con categoría nula) — ajuste pedido explícitamente
// tras el piloto, en vez de la advertencia blanda que había antes.
function resolverObjecionPrincipal(resultado) {
  if (!resultado.contiene_objecion) return null;
  if (resultado.objecion_principal) return resultado.objecion_principal;
  return resultado.confianza >= UMBRAL_OBJECION_OTRO ? 'otro' : null;
}

function versionActual() {
  return `${MODELO}__prompt_${PROMPT_VERSION}__taxonomia_${TAXONOMIA_VERSION}`;
}

let _catalogoPlanes = null;
let _catalogoPrestadores = null;

async function cargarCatalogos() {
  if (_catalogoPlanes && _catalogoPrestadores) return;
  const [planes] = await db.query('SELECT nombre FROM planes');
  const [prestadores] = await db.query('SELECT nombre FROM prestadores');
  _catalogoPlanes = planes.map(p => p.nombre);
  _catalogoPrestadores = prestadores.map(p => p.nombre);
}

// Selecciona conversaciones con al menos un mensaje pendiente (no procesado con la
// versión vigente, y no protegido por revisión manual).
async function obtenerMensajesPendientes(conversacionId, { forzarReprocesar = false } = {}) {
  const version = versionActual();
  const condicionVersion = forzarReprocesar
    ? '1=1'
    : '(capa2_procesado = 0 OR capa2_modelo_version IS NULL OR capa2_modelo_version <> ?)';
  // El orden de los params debe seguir el orden literal de aparición de los `?` en el
  // SQL final: primero conversacion_id = ?, después el ? dentro de condicionVersion.
  const params = forzarReprocesar ? [conversacionId] : [conversacionId, version];

  const [filas] = await db.query(
    `SELECT mensaje_id, conversacion_id, prospecto_id, autor, mensaje_texto,
            orden_mensaje_humano, minutos_hasta_siguiente_mensaje,
            capa2_procesado, capa2_modelo_version, revision_manual, etapa_embudo
     FROM features_mensaje
     WHERE conversacion_id = ?
       AND revision_manual = 0
       AND ${condicionVersion}
     ORDER BY orden_mensaje_humano ASC`,
    params
  );
  return filas;
}

// Todos los mensajes de la conversación en orden (incluye ya procesados), para dar
// contexto continuo aunque el lote actual solo re-procese un subconjunto.
async function obtenerTodosLosMensajes(conversacionId) {
  const [filas] = await db.query(
    `SELECT mensaje_id, autor, mensaje_texto, orden_mensaje_humano, etapa_embudo, tipo_mensaje
     FROM features_mensaje
     WHERE conversacion_id = ?
     ORDER BY orden_mensaje_humano ASC`,
    [conversacionId]
  );
  return filas;
}

function aplicarReglas(mensaje) {
  const contienePregunta = reglas.detectarPregunta(mensaje.mensaje_texto);
  const contieneEmail = reglas.extraerEmail(mensaje.mensaje_texto);
  const contieneTelefono = reglas.extraerTelefono(mensaje.mensaje_texto);
  return {
    contiene_pregunta: contienePregunta,
    fecha_mencionada: reglas.extraerFecha(mensaje.mensaje_texto),
    horario_mencionado: reglas.extraerHorario(mensaje.mensaje_texto),
    precio_mencionado: reglas.extraerMonto(mensaje.mensaje_texto),
    porcentaje_mencionado: reglas.extraerPorcentaje(mensaje.mensaje_texto),
    edad_mencionada: reglas.extraerEdad(mensaje.mensaje_texto),
    cantidad_integrantes_mencionada: reglas.extraerCantidadIntegrantes(mensaje.mensaje_texto),
    conversacion_estancada: reglas.conversacionEstancada(mensaje.minutos_hasta_siguiente_mensaje),
    _contieneEmailORTelefono: (contieneEmail || contieneTelefono) ? 1 : 0,
  };
}

function resolverEntidadesCatalogo(salidaIA) {
  const plan = reglas.matchearCatalogo(salidaIA.plan_mencionado_texto, _catalogoPlanes);
  const prestador = reglas.matchearCatalogo(salidaIA.prestador_mencionado_texto, _catalogoPrestadores);
  const competidor = reglas.matchearCatalogo(salidaIA.competidor_mencionado_texto, reglas.COMPETIDORES_CURADOS);
  // No existe catálogo dedicado de obras sociales en el sistema operativo: se resuelve
  // contra el mismo listado curado de competidores (documentado en el reporte del piloto).
  const obraSocial = reglas.matchearCatalogo(salidaIA.obra_social_mencionada_texto, reglas.COMPETIDORES_CURADOS);
  return { plan, prestador, competidor, obraSocial };
}

const COLUMNAS_AUDITABLES = [
  'tipo_mensaje','intencion_principal','tema_principal','etapa_embudo','nivel_interes',
  'estado_emocional_prospecto','objecion_principal','contiene_objecion','contiene_decision',
  'contiene_intencion_compra','contiene_intencion_abandono','requiere_seguimiento',
  'requiere_respuesta','responde_pregunta_anterior','contiene_pregunta',
  'proxima_accion_sugerida','contiene_informacion_personal','contiene_datos_sensibles',
  'plan_mencionado','obra_social_mencionada','competidor_mencionado','prestador_mencionado',
  'edad_mencionada','cantidad_integrantes_mencionada','fecha_mencionada','horario_mencionado',
  'precio_mencionado','porcentaje_mencionado','conversacion_estancada','confianza_clasificacion',
  'grupo_familiar_detalle',
];

async function persistir(mensaje, valores, meta) {
  const sets = [];
  const params = [];
  for (const col of COLUMNAS_AUDITABLES) {
    if (Object.prototype.hasOwnProperty.call(valores, col)) {
      sets.push(`${col} = ?`);
      params.push(valores[col]);
    }
  }
  sets.push('capa2_procesado = 1', 'capa2_procesado_at = NOW()', 'capa2_modelo_version = ?');
  params.push(meta.modeloVersion, mensaje.mensaje_id);

  await db.query(
    `UPDATE features_mensaje SET ${sets.join(', ')} WHERE mensaje_id = ? AND revision_manual = 0`,
    params
  );

  const auditorias = COLUMNAS_AUDITABLES
    .filter(col => Object.prototype.hasOwnProperty.call(valores, col))
    .map(col => [
      mensaje.mensaje_id, mensaje.conversacion_id, col, null,
      valores[col] === null || valores[col] === undefined ? null : String(valores[col]),
      meta.modelo, meta.promptVersion, meta.taxonomiaVersion, meta.confianza, 'ia',
    ]);

  if (auditorias.length) {
    await db.query(
      `INSERT INTO features_mensaje_historial_clasificacion
       (mensaje_id, conversacion_id, columna, valor_anterior, valor_nuevo, modelo_utilizado, version_prompt, version_taxonomia, confianza, origen_modificacion)
       VALUES ?`,
      [auditorias]
    );
  }
}

// Procesa una conversación completa. Devuelve métricas + errores (no lanza excepción
// por mensaje individual: un mensaje con error no detiene el resto del lote).
async function procesarConversacion(conversacionId, { forzarReprocesar = false } = {}) {
  await cargarCatalogos();

  const pendientes = await obtenerMensajesPendientes(conversacionId, { forzarReprocesar });
  if (pendientes.length === 0) {
    return { conversacionId, procesados: 0, rechazados: 0, errores: [] };
  }

  const todos = await obtenerTodosLosMensajes(conversacionId);
  const idxPorMensajeId = new Map(todos.map((m, i) => [m.mensaje_id, i]));

  let procesados = 0;
  let rechazados = 0;
  const errores = [];
  const advertencias = [];
  const tokens = { prompt: 0, completion: 0 };
  let reintentos = 0;

  for (const mensaje of pendientes) {
    try {
      const idx = idxPorMensajeId.get(mensaje.mensaje_id);
      const previos = todos.slice(Math.max(0, idx - VENTANA_CONTEXTO), idx);
      const etapaAnterior = [...previos].reverse().find(m => m.etapa_embudo)?.etapa_embudo || null;

      const reglasAplicadas = aplicarReglas(mensaje);

      const { resultado, modelo, promptVersion, taxonomiaVersion, tokensPrompt, tokensCompletion } =
        await clasificarMensaje({ mensajesPrevios: previos, mensajeActual: mensaje });
      reintentos += obtenerYResetearReintentos();

      tokens.prompt += tokensPrompt;
      tokens.completion += tokensCompletion;

      const entidades = resolverEntidadesCatalogo(resultado);
      const objecionPrincipal = resolverObjecionPrincipal(resultado);

      const valoresFinales = {
        tipo_mensaje: resultado.tipo_mensaje,
        intencion_principal: resultado.intencion_principal,
        tema_principal: resultado.tema_principal,
        etapa_embudo: resultado.etapa_embudo,
        nivel_interes: mensaje.autor === 'cliente' ? resultado.nivel_interes : null,
        estado_emocional_prospecto: mensaje.autor === 'cliente' ? resultado.estado_emocional_prospecto : null,
        objecion_principal: objecionPrincipal,
        contiene_objecion: resultado.contiene_objecion ? 1 : 0,
        contiene_decision: resultado.contiene_decision ? 1 : 0,
        contiene_intencion_compra: resultado.contiene_intencion_compra ? 1 : 0,
        contiene_intencion_abandono: resultado.contiene_intencion_abandono ? 1 : 0,
        requiere_seguimiento: resultado.requiere_seguimiento ? 1 : 0,
        requiere_respuesta: resultado.requiere_respuesta ? 1 : 0,
        responde_pregunta_anterior: resultado.responde_pregunta_anterior ? 1 : 0,
        contiene_pregunta: reglasAplicadas.contiene_pregunta,
        proxima_accion_sugerida: resultado.proxima_accion_sugerida,
        contiene_informacion_personal: (resultado.contiene_informacion_personal || reglasAplicadas._contieneEmailORTelefono) ? 1 : 0,
        contiene_datos_sensibles: resultado.contiene_datos_sensibles ? 1 : 0,
        plan_mencionado: entidades.plan,
        obra_social_mencionada: entidades.obraSocial,
        competidor_mencionado: entidades.competidor,
        prestador_mencionado: entidades.prestador,
        edad_mencionada: reglasAplicadas.edad_mencionada,
        cantidad_integrantes_mencionada: reglasAplicadas.cantidad_integrantes_mencionada,
        fecha_mencionada: reglasAplicadas.fecha_mencionada,
        horario_mencionado: reglasAplicadas.horario_mencionado,
        precio_mencionado: reglasAplicadas.precio_mencionado,
        porcentaje_mencionado: reglasAplicadas.porcentaje_mencionado,
        conversacion_estancada: reglasAplicadas.conversacion_estancada,
        confianza_clasificacion: resultado.confianza,
        grupo_familiar_detalle: resultado.grupo_familiar_detalle_texto
          ? String(resultado.grupo_familiar_detalle_texto).slice(0, 255)
          : null,
      };

      // Se valida el resultado YA resuelto por el pipeline (objecion_principal con el
      // default aplicado), no la salida cruda del modelo.
      const resultadoParaValidar = { ...resultado, objecion_principal: objecionPrincipal };
      const validacion = validar({ ...mensaje, etapa_embudo_anterior: etapaAnterior }, resultadoParaValidar);

      if (!validacion.valido) {
        rechazados++;
        errores.push({
          mensajeId: mensaje.mensaje_id,
          tipo: 'validacion',
          detalle: validacion.errores.join('; ') || `baja confianza (${resultado.confianza})`,
          preview: redactarParaLog(mensaje.mensaje_texto),
        });
        continue;
      }

      if (validacion.advertencias.length) {
        advertencias.push({
          mensajeId: mensaje.mensaje_id,
          detalle: validacion.advertencias.join('; '),
          preview: redactarParaLog(mensaje.mensaje_texto),
        });
      }

      await persistir(mensaje, valoresFinales, {
        modelo, promptVersion, taxonomiaVersion,
        modeloVersion: versionActual(),
        confianza: resultado.confianza,
      });

      // Actualiza la copia en memoria para que el resto de la conversación en este
      // mismo run tenga contexto de etapa/tipo ya resuelto.
      todos[idx].etapa_embudo = resultado.etapa_embudo;
      todos[idx].tipo_mensaje = resultado.tipo_mensaje;

      procesados++;
    } catch (err) {
      errores.push({
        mensajeId: mensaje.mensaje_id,
        tipo: 'excepcion',
        detalle: err.message,
        preview: redactarParaLog(mensaje.mensaje_texto),
      });
    }
  }

  return { conversacionId, procesados, rechazados, errores, advertencias, tokens, reintentos };
}

async function procesarLote(conversacionIds, opts = {}) {
  const resultados = [];
  for (const id of conversacionIds) {
    const r = await procesarConversacion(id, opts);
    resultados.push(r);
  }
  return resultados;
}

module.exports = { procesarConversacion, procesarLote, versionActual, cargarCatalogos };
