const db = require('../config/db');
const ExcelJS = require('exceljs');
const path = require('path');

async function testFinalExportFix() {
  try {
    console.log('🧪 PRUEBA: Verificando corrección de URLs de familiares\n');
    
    // Simular lógica del exportController corregida
    const incluir_familiares = 'true';
    const maxFamiliares = 2; // Simulando máximo
    
    // Generar headers corregidos
    const headersCompletos = [
      'ID Prospecto',
      'Nombre',
      'Apellido'
    ];

    // Headers de familiares CORREGIDOS
    if (incluir_familiares === 'true') {
      for (let i = 0; i < maxFamiliares; i++) {
        headersCompletos.push(
          `Familiar ${i + 1} - Nombre`,
          `Familiar ${i + 1} - Edad`,
          `Familiar ${i + 1} - Vínculo`,
          `Familiar ${i + 1} - URL DNI Frente`,
          `Familiar ${i + 1} - URL DNI Dorso`,
          `Familiar ${i + 1} - URL Recibo Sueldo`
        );
      }
    }
    
    console.log('🏷️ Headers generados:');
    headersCompletos.forEach((header, idx) => {
      if (header.includes('URL')) {
        console.log(`  ${idx + 1}. ${header} ✅`);
      } else {
        console.log(`  ${idx + 1}. ${header}`);
      }
    });
    
    // Simular llenado de datos
    const baseUrl = 'https://wspflows.cober.online';
    const registro = {};
    headersCompletos.forEach(header => {
      registro[header] = '';
    });
    
    // Llenar datos de ejemplo
    registro['ID Prospecto'] = 318;
    registro['Nombre'] = 'JUAN';
    registro['Apellido'] = 'TEST';
    
    // Simular familiares
    const familiares = [
      { nombre: 'TEST HIJO', edad: 3, vinculo: 'hijo/a' }
    ];
    
    familiares.forEach((familiar, index) => {
      registro[`Familiar ${index + 1} - Nombre`] = familiar.nombre;
      registro[`Familiar ${index + 1} - Edad`] = familiar.edad;
      registro[`Familiar ${index + 1} - Vínculo`] = familiar.vinculo;
      
      // Simular URLs encontradas
      registro[`Familiar ${index + 1} - URL DNI Frente`] = `${baseUrl}/poliza-documentos/public/hash123frente`;
      registro[`Familiar ${index + 1} - URL DNI Dorso`] = `${baseUrl}/poliza-documentos/public/hash123dorso`;
      registro[`Familiar ${index + 1} - URL Recibo Sueldo`] = `${baseUrl}/poliza-documentos/public/hash123recibo`;
    });
    
    console.log('\n📊 Datos del registro:');
    Object.entries(registro).forEach(([key, value]) => {
      if (key.includes('Familiar') && value) {
        if (key.includes('URL')) {
          console.log(`  ${key}: ${value} ✅`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
    });
    
    // Verificar que las claves coinciden
    const headersURL = headersCompletos.filter(h => h.includes('Familiar') && h.includes('URL'));
    const datosURL = Object.keys(registro).filter(k => k.includes('Familiar') && k.includes('URL') && registro[k] !== '');
    
    console.log(`\n🔍 VERIFICACIÓN:`);
    console.log(`  Headers de URLs de familiares: ${headersURL.length}`);
    console.log(`  Datos de URLs de familiares: ${datosURL.length}`);
    console.log(`  Coincidencia: ${headersURL.length === datosURL.length ? '✅' : '❌'}`);
    
    // Crear Excel de prueba
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test Corregido');
    
    worksheet.addRow(headersCompletos);
    
    const row = headersCompletos.map(header => registro[header] || '');
    worksheet.addRow(row);
    
    worksheet.columns.forEach(column => {
      column.width = 25;
    });
    
    const fileName = `test_familiares_corregido_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp_exports', fileName);
    
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`\n✅ Archivo de prueba generado: ${filePath}`);
    console.log(`📋 Columnas totales: ${headersCompletos.length}`);
    console.log(`🔗 URLs de familiares: ${headersURL.length}`);
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    process.exit();
  }
}

testFinalExportFix();
