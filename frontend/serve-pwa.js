import { createServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3443; // Puerto HTTPS para pruebas PWA

// Servir archivos estáticos desde dist
app.use(express.static('dist'));

// Manejar rutas SPA - siempre devolver index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Configuración HTTPS (certificados self-signed para desarrollo)
const httpsOptions = {
  key: readFileSync('./server.key', 'utf8').catch(() => null),
  cert: readFileSync('./server.crt', 'utf8').catch(() => null)
};

// Si no existen certificados, dar instrucciones para crearlos
if (!existsSync('./server.key') || !existsSync('./server.crt')) {
  console.log('🔒 Certificados HTTPS no encontrados.');
  console.log('\n📋 Para probar la PWA necesitas HTTPS. Ejecuta estos comandos:');
  console.log('\n🔧 Crear certificados self-signed:');
  console.log('   openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes -subj "/C=AR/ST=CABA/L=Buenos Aires/O=Cober360/CN=localhost"');
  console.log('\n▶️  Luego ejecuta nuevamente:');
  console.log('   node serve-pwa.js');
  console.log('\n⚠️  NOTA: Acepta el certificado en el navegador cuando aparezca la advertencia de seguridad.');
  process.exit(1);
}

// Crear servidor HTTPS
const server = createServer(httpsOptions, app);

server.listen(port, () => {
  console.log('🚀 Servidor PWA iniciado');
  console.log(`🌐 URL: https://localhost:${port}`);
  console.log(`📱 Para probar en móvil: https://[tu-ip]:${port}`);
  console.log('\n✅ Funcionalidades PWA disponibles:');
  console.log('   • 🔄 Service Worker (cache offline)');
  console.log('   • 📱 Instalación como app móvil');
  console.log('   • 🔔 Notificaciones push (próximamente)');
  console.log('   • 🎨 Splash screen personalizada');
  console.log('\n💡 PRUEBAS:');
  console.log('   1. Abre en Chrome/Edge/Safari');
  console.log('   2. Ve a DevTools > Application > Manifest');
  console.log('   3. Busca el botón "Instalar app" en la barra de direcciones');
  console.log('   4. Prueba funcionamiento offline (DevTools > Network > Offline)');
});

// Manejo de errores
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Puerto ${port} en uso. Prueba con otro puerto.`);
  } else {
    console.log('❌ Error del servidor:', err.message);
  }
});
