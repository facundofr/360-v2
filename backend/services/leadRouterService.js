const axios = require('axios');
const leadRouterConfig = require('../config/leadRouter');

// Proxy genérico: reenvía method/subpath/body/query al Lead Router,
// autenticado como backend confiable (X-Service-Key) en nombre del admin
// que ya está logueado acá (X-Acting-User, solo para auditoría del lado
// del router — la autenticación real es la service key).
async function proxy({ method, subpath, body, query, actingUser }) {
  const url = `${leadRouterConfig.baseUrl}${subpath}`;
  const respuesta = await axios({
    method,
    url,
    data: body,
    params: query,
    timeout: 10000,
    headers: {
      'X-Service-Key': leadRouterConfig.serviceKey,
      'X-Acting-User': actingUser || '',
    },
    validateStatus: () => true, // dejamos que el controller decida qué hacer con cualquier status
  });
  return { status: respuesta.status, data: respuesta.data };
}

module.exports = { proxy };
