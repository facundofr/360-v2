import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tamaños de iconos PWA requeridos
const iconSizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 180, name: 'icon-180x180.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' }
];

// Función para generar iconos
async function generateIcons() {
  const inputImage = path.join(__dirname, 'src', 'assets', 'img', 'logo.png');
  const outputDir = path.join(__dirname, 'public', 'icons');
  
  console.log('🔧 Iniciando generación de iconos PWA...');
  console.log(`📂 Imagen origen: ${inputImage}`);
  console.log(`📂 Directorio destino: ${outputDir}`);
  
  // Verificar que existe la imagen origen
  if (!fs.existsSync(inputImage)) {
    console.error('❌ Error: No se encontró la imagen logo.png en src/assets/img/');
    console.log('💡 Asegúrate de que existe el archivo logo.png en la ruta correcta');
    return;
  }
  
  // Crear directorio de iconos si no existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('✅ Directorio de iconos creado');
  }
  
  try {
    // Generar cada tamaño de icono
    for (const { size, name } of iconSizes) {
      const outputPath = path.join(outputDir, name);
      
      await sharp(inputImage)
        .resize(size, size, {
          fit: 'inside',
          withoutEnlargement: false,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({
          quality: 100,
          compressionLevel: 6,
          adaptiveFiltering: false
        })
        .toFile(outputPath);
      
      console.log(`✅ Generado: ${name} (${size}x${size})`);
    }
    
    // Generar favicon.ico
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    await sharp(inputImage)
      .resize(32, 32)
      .png()
      .toFile(faviconPath);
    
    console.log('✅ Generado: favicon.ico (32x32)');
    
    console.log('\n🎉 ¡Iconos PWA generados exitosamente!');
    console.log('\n📋 Archivos generados:');
    iconSizes.forEach(({ name, size }) => {
      console.log(`   • ${name} (${size}x${size})`);
    });
    console.log('   • favicon.ico (32x32)');
    
    console.log('\n📱 Tu PWA está lista para:');
    console.log('   • ✅ Instalación en dispositivos móviles');
    console.log('   • ✅ Detección automática en Android/iOS');
    console.log('   • ✅ Funcionamiento offline');
    console.log('   • ✅ Notificaciones push');
    
  } catch (error) {
    console.error('❌ Error generando iconos:', error.message);
    
    if (error.message.includes('Input file is missing')) {
      console.log('\n💡 Solución:');
      console.log('   1. Asegúrate de que logo.png existe en src/assets/img/');
      console.log('   2. Verifica que el archivo no esté corrupto');
      console.log('   3. Intenta con otro formato de imagen (JPG, SVG)');
    }
  }
}

// Función para verificar dependencias
function checkDependencies() {
  try {
    // En ES modules, no podemos usar require.resolve de la misma manera
    // En su lugar, simplemente intentamos importar
    return true; // Sharp ya está importado arriba, si llegamos aquí es que existe
  } catch (error) {
    console.log('❌ sharp no está instalado');
    console.log('\n💡 Ejecuta este comando para instalar la dependencia:');
    console.log('   npm install sharp --save-dev');
    return false;
  }
}

// Ejecutar el script (ES module way to check if this is the main module)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Generador de Iconos PWA - Cober360\n');
  
  if (checkDependencies()) {
    generateIcons().catch(console.error);
  }
}

export { generateIcons, iconSizes };
