const axios = require("axios");
const https = require("https");
require("dotenv").config();

const GECROS_TOKEN_URL = process.env.GECROS_TOKEN_URL || "https://apis.cober.com.ar/connect/token";
const GECROS_API_BASE_URL = process.env.GECROS_API_BASE_URL || "https://apis.cober.com.ar";

const clientConfig = {
  grant_type: process.env.GECROS_GRANT_TYPE || "password",
  client_id: process.env.GECROS_CLIENT_ID || "gecros",
  username: process.env.GECROS_USERNAME,
  password: process.env.GECROS_PASSWORD,
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let cachedToken = null;
let tokenExpiry = null;

/**
 * Obtiene un token de autenticación de Gecros
 * @returns {Promise<string>} Token de acceso
 */
async function getAuthToken() {
  try {
    // Si el token está en caché y aún es válido, devolverlo
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
      console.log("Usando token en caché");
      return cachedToken;
    }

    const body = new URLSearchParams(clientConfig);

    const response = await axios.post(GECROS_TOKEN_URL, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      httpsAgent,
    });

    cachedToken = response.data.access_token;
    // Asumir que el token expira en 1 hora (ajustar según la respuesta)
    tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000;

    console.log("Token obtenido exitosamente");
    return cachedToken;
  } catch (error) {
    console.error("Error al obtener token de Gecros:", error.message);
    throw new Error(`Error de autenticación Gecros: ${error.message}`);
  }
}

/**
 * Busca afiliado por DNI
 * @param {string} dni - DNI del cliente
 * @returns {Promise<object>} Datos del afiliado
 */
async function getAfiliadoByDni(dni) {
  try {
    if (!dni || dni.trim() === "") {
      throw new Error("DNI requerido");
    }

    const token = await getAuthToken();
    const endpoint = `${GECROS_API_BASE_URL}/api/Afiliados`;

    const response = await axios.get(endpoint, {
      params: { docId: dni },
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    return response.data;
  } catch (error) {
    console.error("Error al buscar afiliado por DNI:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    throw new Error(`Error al buscar afiliado Gecros: ${error.message}`);
  }
}

/**
 * Busca afiliado por CUIL
 * @param {string} cuil - CUIL del cliente
 * @returns {Promise<object>} Datos del afiliado
 */
async function getAfiliadoByCuil(cuil) {
  try {
    if (!cuil || cuil.trim() === "") {
      throw new Error("CUIL requerido");
    }

    const token = await getAuthToken();
    const endpoint = `${GECROS_API_BASE_URL}/api/Afiliados/AfiliadoByCuil/${encodeURIComponent(cuil)}`;

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    return response.data;
  } catch (error) {
    console.error("Error al buscar afiliado por CUIL:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    throw new Error(`Error al buscar afiliado Gecros: ${error.message}`);
  }
}

/**
 * Busca afiliados con parámetros opcionales
 * @param {object} params - Parámetros de búsqueda (benNom, benApe, cuil, numero, docId)
 * @returns {Promise<object>} Lista de afiliados
 */
async function searchAfiliados(params = {}) {
  try {
    const token = await getAuthToken();
    const endpoint = `${GECROS_API_BASE_URL}/api/Afiliados`;

    const response = await axios.get(endpoint, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    return response.data;
  } catch (error) {
    console.error("Error al buscar afiliados:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    throw new Error(`Error al buscar afiliados Gecros: ${error.message}`);
  }
}

/**
 * Descarga la credencial del afiliado (imagen)
 * @param {number} benId - ID del beneficiario
 * @returns {Promise<Buffer>} Imagen de la credencial en formato buffer
 */
async function getCredencial(benId) {
  try {
    if (!benId) {
      throw new Error("benId requerido");
    }

    const token = await getAuthToken();
    const endpoint = `${GECROS_API_BASE_URL}/api/appbenef/${benId}/credencial`;

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      httpsAgent,
      responseType: 'arraybuffer' // Para recibir la imagen como buffer
    });

    return response.data;
  } catch (error) {
    console.error("Error al descargar credencial:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      
      // Intentar decodificar el error si es un buffer
      let errorMessage = error.message;
      if (error.response.data) {
        try {
          const errorData = Buffer.isBuffer(error.response.data) 
            ? JSON.parse(error.response.data.toString()) 
            : error.response.data;
          errorMessage = errorData.errors ? errorData.errors.join(', ') : errorData.message || error.message;
          console.error("Error de API:", errorMessage);
        } catch (parseError) {
          console.error("No se pudo parsear el error de la API");
        }
      }
      throw new Error(`Error al descargar credencial Gecros: ${errorMessage}`);
    }
    throw new Error(`Error al descargar credencial Gecros: ${error.message}`);
  }
}

/**
 * Realiza una prueba de conexión a la API de Gecros
 * @returns {Promise<boolean>} true si la conexión es exitosa
 */
async function testConnection() {
  try {
    const token = await getAuthToken();
    console.log("Conexión exitosa a Gecros");
    return true;
  } catch (error) {
    console.error("Error en prueba de conexión:", error.message);
    return false;
  }
}

module.exports = {
  getAuthToken,
  getAfiliadoByDni,
  getAfiliadoByCuil,
  searchAfiliados,
  getCredencial,
  testConnection,
};
