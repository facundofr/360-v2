/**
 * Script de uso único para obtener el refresh_token de Google Drive OAuth2.
 *
 * Uso:
 *   1. Completar GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET en el .env
 *   2. Ejecutar: node backend/scripts/generateDriveToken.js
 *   3. Abrir la URL que aparece en pantalla, autorizar con tu cuenta de Google
 *   4. Pegar el código que devuelve Google
 *   5. Copiar el refresh_token al .env como GOOGLE_DRIVE_REFRESH_TOKEN
 */

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan GOOGLE_DRIVE_CLIENT_ID o GOOGLE_DRIVE_CLIENT_SECRET en el .env');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
  prompt: 'consent',
});

console.log('\n🔗 Abrí esta URL en tu navegador y autorizá con tu cuenta de Google:\n');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('📋 Pegá el código de autorización aquí: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    console.log('\n✅ Tokens obtenidos correctamente!\n');
    console.log('Agregá esta línea a tu .env:\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    if (!tokens.refresh_token) {
      console.warn('⚠️ No se recibió refresh_token. Revocá el acceso en https://myaccount.google.com/permissions y volvé a ejecutar el script.');
    }
  } catch (err) {
    console.error('❌ Error obteniendo tokens:', err.message);
  }
});
