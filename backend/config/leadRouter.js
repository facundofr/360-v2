// Config del Lead Router (compensador de leads entre Producción y Bariloche).
// Mismo patrón que config/vafirma.js: variables de entorno propias, sin
// mezclarse con las de otros servicios externos.
const config = {
  baseUrl: process.env.LEAD_ROUTER_API_URL || 'http://127.0.0.1:4007/leads-compensador/admin/api',
  serviceKey: process.env.LEAD_ROUTER_SERVICE_KEY,
};

module.exports = config;
