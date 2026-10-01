/**
 * Servicio de integración con VaFirma - Versión Estandarizada v1.0
 * Documentación API: v1.5.0
 * 
 * TIPOS DE FIRMA SOPORTADOS:
 * - Simple: sin requisitos adicionales
 * - Biometric: requiere validación facial
 * - Biometric_Liveness: validación facial con liveness
 * - Advanced: firma avanzada
 * 
 * USO BÁSICO:
 *   const vaFirmaService = require('./services/vaFirmaSerice');
 *   const resultado = await vaFirmaService.solicitarFirma({
 *     pdfBase64: 'base64-content',
 *     fileName: 'documento.pdf',
 *     signerName: 'Juan Pérez',
 *     signerEmail: 'juan@example.com',
 *     emailSubject: 'Documento para firmar',
 *     requireBiometric: true  // Para pedir validación facial
 *   });
 */

const axios = require('axios');
const { baseUrl, buildAuthHeaders, generateJWT, authMode } = require('../config/vafirma');

/**
 * Solicita firma electrónica de un documento
 * 
 * @param {Object} options - Opciones de la solicitud
 * @param {string} options.pdfBase64 - Contenido del PDF en base64 (REQUERIDO)
 * @param {string} options.fileName - Nombre del archivo (REQUERIDO)
 * @param {string} options.signerName - Nombre del firmante (REQUERIDO)
 * @param {string} options.signerEmail - Email del firmante (REQUERIDO)
 * @param {string} options.emailSubject - Asunto del email (REQUERIDO)
 * @param {string} [options.emailMessage] - Mensaje adicional en el email
 * @param {boolean} [options.requireBiometric=false] - Si true, usa signSubType='Biometric' (foto del rostro)
 * @param {number} [options.signaturePageIndex=0] - Página donde ubicar la firma (0=primera)
 * @param {number} [options.signaturePageX=50] - Posición X en píxeles
 * @param {number} [options.signaturePageY=50] - Posición Y en píxeles
 * @param {string} [options.dni] - DNI/Documento del firmante
 * @param {string} [options.whatsapp] - Teléfono WhatsApp del firmante
 * @param {string} [options.signatureType='Simple'] - Tipo: 'Simple' o 'Advanced'
 * @param {string} [options.signatureSubType='Simple'] - Subtipo (se sobrescribe si requireBiometric=true)
 * @param {string} [options.docOriginId] - ID origen (auto-generado si no se proporciona)
 * @param {string} [options.callbackUrl] - URL para webhook de notificación
 * @param {number} [options.solDiasNotificacion] - Días para renotificar
 * 
 * @returns {Promise<Object>} {success, data, status}
 * 
 * @example
 * // Firma simple sin biometría
 * const res = await solicitarFirma({
 *   pdfBase64: pdf,
 *   fileName: 'contrato.pdf',
 *   signerName: 'Juan',
 *   signerEmail: 'juan@example.com',
 *   emailSubject: 'Contrato para firmar'
 * });
 * 
 * @example
 * // Firma con validación facial requerida
 * const res = await solicitarFirma({
 *   pdfBase64: pdf,
 *   fileName: 'contrato.pdf',
 *   signerName: 'Juan',
 *   signerEmail: 'juan@example.com',
 *   emailSubject: 'Contrato para firmar',
 *   requireBiometric: true,  // ← Pide foto del rostro
 *   dni: '12345678',
 *   whatsapp: '+34600000000'
 * });
 */
async function solicitarFirma(options) {
  const {
    pdfBase64,
    fileName,
    signerName,
    signerEmail,
    emailSubject,
    emailMessage = undefined,
    solDiasNotificacion = undefined,
    callbackUrl = undefined,
    disabledNotification = undefined,
    signaturePageIndex = 0,
    signaturePageX = 50,
    signaturePageY = 50,
    docOriginId = `COBER360-${Date.now()}`,
    // Tipos según doc: 'Simple' | 'Advanced'
    signatureType = 'Simple',
    // signatureSubType puede ser: 'Simple', 'Biometric', 'Biometric_Liveness', 'Advanced'
    signatureSubType = 'Simple',
    requireBiometric = false,
    // Datos adicionales del firmante
    whatsapp = null,
    dni = null,
    redirectUrl = undefined,
    signatureWidth = undefined,
    signatureHeight = undefined,
    signerParticipantType = undefined,
    signerParticipantIndex = undefined
  } = options;

  // Validar parámetros requeridos
  if (!pdfBase64 || !fileName || !signerName || !signerEmail || !emailSubject) {
    throw new Error('Faltan parámetros requeridos para solicitar firma');
  }

  // Headers de autenticación
  const authHeaders = buildAuthHeaders();

  // Determinar el subtipo de firma
  // Si requireBiometric es true, usar 'Biometric' en lugar de 'Simple'
  const finalSignatureSubType = requireBiometric ? 'Biometric' : signatureSubType;

  // Configurar receptor con coordenadas de firma
  const recipient = {
    signerName,
    signerEmail,
    signaturePageIndex,
    signaturePageX,
    signaturePageY,
    // Agregar campos adicionales
    ...(whatsapp ? { signerPhoneNumber: whatsapp } : {}),
    ...(dni ? { signerDocument: dni } : {}),
    ...(redirectUrl ? { redirectUrl } : {}),
    ...(typeof signatureWidth === 'number' ? { signatureWidth } : {}),
    ...(typeof signatureHeight === 'number' ? { signatureHeight } : {}),
    ...(signerParticipantType ? { signerParticipantType } : {}),
    ...(typeof signerParticipantIndex === 'number' ? { signerParticipantIndex } : {})
  };

  // Preparar body según esquema SignatureRequestMultiple de la API
  const body = {
    emailSubject,
    ...(emailMessage ? { emailMessage } : {}),
    ...(typeof solDiasNotificacion === 'number' ? { solDiasNotificacion } : {}),
    ...(callbackUrl ? { callbackUrl } : {}),
    ...(typeof disabledNotification === 'boolean' ? { disabledNotification } : {}),
    documents: [{
      file: {
        content: pdfBase64,
        name: fileName,
        contentType: "application/pdf"
      },
      fileName,
      signatureType,
      signatureSubType: finalSignatureSubType,
      recipients: [recipient],
      ...(docOriginId ? { docOriginId } : {})
    }],
    withLink: true
  };

  // Log del body para debug (sin el contenido base64)
  console.log('📤 Enviando a VaFirma:', JSON.stringify({
    ...body,
    documents: body.documents.map(doc => ({
      ...doc,
      file: { ...doc.file, content: '[BASE64_OMITIDO]' }
    }))
  }, null, 2));

  // Headers según documentación
  const headers = {
    ...authHeaders,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const url = `${baseUrl}/v1/ext/signatures/requestmultiple`;

  try {
    const response = await axios.post(url, body, { headers, timeout: 30000 });

    return {
      success: true,
      data: response.data,
      status: response.status
    };

  } catch (error) {
    console.error('Error al solicitar firma en VaFirma:', error.response?.data || error.message);

    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Consulta el estado de un documento
 * 
 * @param {string} docUUID - UUID del documento (retornado por solicitarFirma)
 * @returns {Promise<Object>} {success, data, status}
 * 
 * @example
 * const estado = await consultarEstado('bca4ca97-bba2-4ad6-91cf-91b624815840');
 * // Devuelve información del estado de firma, si fue completado, rechazado, etc.
 */
async function consultarEstado(docUUID) {
  if (!docUUID) {
    throw new Error('docUUID es requerido');
  }

  const url = `${baseUrl}/v1/ext/signatures/me/status`;
  const authHeaders = buildAuthHeaders();
  const headers = {
    ...authHeaders,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const response = await axios.get(url, {
      params: { docUUID },
      headers,
      timeout: 10000
    });

    return {
      success: true,
      data: response.data,
      status: response.status
    };

  } catch (error) {
    console.error('Error al consultar estado en VaFirma:', error.response?.data || error.message);

    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Descarga el documento ya firmado
 * 
 * @param {string} docUUID - UUID del documento
 * @returns {Promise<Object>} {success, data (Buffer), status}
 * 
 * @example
 * const resultado = await descargarDocumento('bca4ca97-bba2-4ad6-91cf-91b624815840');
 * // resultado.data contiene el PDF firmado como Buffer
 */
async function descargarDocumento(docUUID) {
  if (!docUUID) {
    throw new Error('docUUID es requerido');
  }

  const url = `${baseUrl}/v1/ext/signatures/me/download`;
  const authHeaders = buildAuthHeaders();

  try {
    const response = await axios.get(url, {
      params: { docUUID },
      headers: {
        ...authHeaders,
        'Accept': '*/*' // Aceptar cualquier tipo
      },
      responseType: 'arraybuffer', // Solicitar como binary
      timeout: 30000,
      transformResponse: [(data) => data] // No transformar la respuesta
    });

    return {
      success: true,
      data: response.data, // Ya es un Buffer de Node.js
      status: response.status
    };

  } catch (error) {
    console.error('Error al descargar documento de VaFirma:', error.response?.data || error.message);

    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Crear una validación biométrica independiente (sin documento)
 * Útil si necesitas validar identidad separada de la firma
 * 
 * @param {Object} options
 * @param {string} options.personName - Nombre de la persona (REQUERIDO)
 * @param {string} options.personEmail - Email de la persona (REQUERIDO)
 * @param {string} options.personPhoneNumber - Teléfono con WhatsApp (REQUERIDO)
 * @param {string} [options.validationType='FACE'] - Tipo: 'FACE' o 'LIVENESS'
 * @param {boolean} [options.useGestures=false] - Si true, pide gestos adicionales
 * @param {string} [options.emailSubject] - Asunto del email
 * @param {string} [options.emailMessage] - Mensaje del email
 * @param {number} [options.ttlToken=3600] - Vigencia en segundos
 * @param {number} [options.retries=3] - Máximo de intentos
 * 
 * @returns {Promise<Object>} {success, data (incluye bioUUID y link), status}
 * 
 * @example
 * const res = await crearValidacionBiometrica({
 *   personName: 'Juan Pérez',
 *   personEmail: 'juan@example.com',
 *   personPhoneNumber: '+34600000000',
 *   validationType: 'FACE',
 *   useGestures: true
 * });
 * // res.data.bioUUID - identificador de la validación
 * // res.data.link - enlace para que el usuario complete la validación
 */
async function crearValidacionBiometrica(options) {
  const {
    personName,
    personEmail,
    personPhoneNumber,
    validationType = 'FACE',
    useGestures,
    emailSubject,
    emailMessage,
    originId = `VAL-${Date.now()}`,
    redirectUrl,
    callbackUrl,
    ttlToken,
    retries
  } = options || {};

  if (!personName || !personEmail || !personPhoneNumber) {
    throw new Error('personName, personEmail y personPhoneNumber son requeridos');
  }

  const url = `${baseUrl}/v1/biometrics`;
  const authHeaders = buildAuthHeaders();
  const headers = {
    ...authHeaders,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const body = {
    personName,
    personEmail,
    personPhoneNumber,
    validationType,
    ...(typeof useGestures === 'boolean' ? { useGestures } : {}),
    ...(emailSubject ? { emailSubject } : {}),
    ...(emailMessage ? { emailMessage } : {}),
    originId,
    ...(redirectUrl ? { redirectUrl } : {}),
    ...(callbackUrl ? { callbackUrl } : {}),
    ...(typeof ttlToken === 'number' ? { ttlToken } : {}),
    ...(typeof retries === 'number' ? { retries } : {})
  };

  try {
    const response = await axios.post(url, body, { headers, timeout: 20000 });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error('Error creando validación biométrica en VaFirma:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Consultar el estado de una validación biométrica
 * 
 * @param {string} bioUUID - UUID de la validación (retornado por crearValidacionBiometrica)
 * @returns {Promise<Object>} {success, data, status}
 * 
 * @example
 * const estado = await consultarBiometria('c6d4e538-10d7-42bb-8008-a6c1382d7cb6');
 * // Devuelve si fue completada, en proceso, rechazada, etc.
 */
async function consultarBiometria(bioUUID) {
  if (!bioUUID) throw new Error('bioUUID es requerido');
  const url = `${baseUrl}/v1/biometrics/${bioUUID}`;
  const authHeaders = buildAuthHeaders();
  const headers = {
    ...authHeaders,
    'Accept': 'application/json'
  };
  try {
    const response = await axios.get(url, { headers, timeout: 15000 });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error('Error consultando biometría en VaFirma:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Eliminar documento de VaFirma
 * DELETE /v1/ext/signatures/me/
 * 
 * @param {string} docUUID - UUID del documento (REQUERIDO)
 * @param {string} [docOriginId] - ID origen del documento (alternativa a docUUID)
 * @returns {Promise<Object>} {success, data, status}
 */
const eliminarDocumento = async (docUUID, docOriginId) => {
  try {
    const url = `${baseUrl}/v1/ext/signatures/me/`;
    
    // Construir parámetros query
    const params = {};
    if (docUUID) params.docUUID = docUUID;
    if (docOriginId) params.docOriginId = docOriginId;

    console.log(`🔗 DELETE ${url}`);
    console.log(`📋 Parámetros:`, params);

    const headers = buildAuthHeaders();

    const response = await axios.delete(url, {
      params,
      headers,
      timeout: 10000
    });

    console.log(`✅ Documento eliminado de VaFirma:`, response.status);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error('❌ Error eliminando documento de VaFirma:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

module.exports = {
  solicitarFirma,
  consultarEstado,
  descargarDocumento,
  generateJWT,
  crearValidacionBiometrica,
  consultarBiometria,
  eliminarDocumento
};