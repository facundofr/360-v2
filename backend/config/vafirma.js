/**
 * Config y utilidades de autenticación para VaFirma
 * Modos soportados: basic | bearer | jwt
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

function normalizeBaseUrl(url) {
  if (!url) return 'https://api.vafirma.com/api';
  return url.replace(/\/+$/, '');
}

const config = {
  baseUrl: normalizeBaseUrl(process.env.VAFIRMA_API_URL || 'https://api.vafirma.com/api'),
  authMode: (process.env.VAFIRMA_AUTH_MODE || '').toLowerCase()
    || (process.env.VAFIRMA_USERNAME && process.env.VAFIRMA_PASSWORD ? 'basic'
      : (process.env.VAFIRMA_BEARER_TOKEN ? 'bearer' : 'jwt')),
  // Basic
  username: process.env.VAFIRMA_USERNAME,
  password: process.env.VAFIRMA_PASSWORD,
  // Bearer
  bearerToken: process.env.VAFIRMA_BEARER_TOKEN,
  // JWT legacy
  apiKey: process.env.VAFIRMA_API_KEY,
  issuer: process.env.VAFIRMA_ISSUER,
  secret: process.env.VAFIRMA_JWT_SECRET
};

function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.issuer,
    iat: now,
    exp: now + 15 * 60, // 15 minutos
    aud: 'vafirma-app',
    sub: 'vafirma-app'
  };
  return jwt.sign(payload, config.secret, { algorithm: 'HS256' });
}

function buildAuthHeaders() {
  if (config.authMode === 'basic') {
    const creds = Buffer.from(`${config.username}:${config.password || ''}`).toString('base64');
    return { Authorization: `Basic ${creds}` };
  }
  if (config.authMode === 'bearer') {
    const headers = { Authorization: `Bearer ${config.bearerToken}` };
    if (config.apiKey) headers['x-api-key'] = config.apiKey;
    return headers;
  }
  // jwt
  const token = generateJWT();
  const headers = { Authorization: `Bearer ${token}` };
  if (config.apiKey) headers['x-api-key'] = config.apiKey;
  return headers;
}

module.exports = {
  baseUrl: config.baseUrl,
  buildAuthHeaders,
  generateJWT,
  authMode: config.authMode
};
