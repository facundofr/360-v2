const db = require('../config/db');
const ExcelJS = require('exceljs');
const path = require('path');

async function testExportWithDebug() {
  try {
    console.log('🧪 Ejecutando exportación de prueba con debug completo...\n');
    
    // Simular parámetros de exportación
    const configuracion = {
      formato: 'excel',
      incluir_polizas: 'true', // Como string, tal como viene del frontend
      incluir_documentos: 'true',
      incluir_familiares: 'false'
    };
    
    console.log('📊 Configuración de prueba:', configuracion);
    console.log('🔍 Tipos de datos:', {
      incluir_polizas: typeof configuracion.incluir_polizas,
      incluir_documentos: typeof configuracion.incluir_documentos
    });
    
    // Query para prospectos
    const query = `
      SELECT 
        pr.*,
        ta.etiqueta as tipo_afiliacion_nombre,
        u.first_name as vendedor_nombre,
        u.last_name as vendedor_apellido,
        u.email as vendedor_email
      FROM prospectos pr
      LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
      LEFT JOIN asignaciones a ON pr.id = a.id_prospecto
      LEFT JOIN users u ON a.id_vendedor = u.id
      WHERE 1=1
      ORDER BY pr.id DESC
      LIMIT 5
    `;
    
    const [prospectos] = await db.execute(query);
    console.log(`📋 Encontrados ${prospectos.length} prospectos para prueba`);
    
    // Obtener pólizas
    let polizasData = {};
    const prospectoIds = prospectos.map(p => p.id);
    
    if (prospectoIds.length > 0) {
      const polizasQuery = `
        SELECT 
          p.*,
          pl.nombre as plan_nombre
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE p.prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
        AND p.deleted_at IS NULL
        ORDER BY p.id DESC
      `;
      
      const [polizas] = await db.execute(polizasQuery, prospectoIds);
      console.log(`📋 Encontradas ${polizas.length} pólizas`);
      
      polizas.forEach(poliza => {
        if (!polizasData[poliza.prospecto_id]) {
          polizasData[poliza.prospecto_id] = [];
        }
        polizasData[poliza.prospecto_id].push(poliza);
      });
      
      // Mostrar detalles de pólizas
      polizas.forEach(poliza => {
        console.log(`  📋 Póliza ${poliza.id}: prospecto=${poliza.prospecto_id}, hash=${poliza.pdf_hash}`);
      });
    }
    
    // Obtener documentos
    let documentosData = {};
    const polizaIds = Object.values(polizasData).flat().map(p => p.id);
    
    if (polizaIds.length > 0) {
      const documentosQuery = `
        SELECT 
          d.*,
          d.poliza_id
        FROM poliza_documentos d
        WHERE d.poliza_id IN (${polizaIds.map(() => '?').join(',')})
        ORDER BY d.id DESC
      `;
      
      const [documentos] = await db.execute(documentosQuery, polizaIds);
      console.log(`📄 Encontrados ${documentos.length} documentos`);
      
      documentos.forEach(doc => {
        if (!documentosData[doc.poliza_id]) {
          documentosData[doc.poliza_id] = [];
        }
        documentosData[doc.poliza_id].push(doc);
      });
      
      // Mostrar detalles de documentos
      documentos.forEach(doc => {
        console.log(`  📄 Documento ${doc.id}: póliza=${doc.poliza_id}, hash=${doc.public_hash}`);
      });
    }
    
    // Procesar datos como en el exportController
    const baseUrl = 'https://wspflows.cober.online';
    const datosExportacion = prospectos.map(prospecto => {
      const polizasProspecto = polizasData[prospecto.id] || [];
      
      const registro = {
        'ID Prospecto': prospecto.id,
        'Nombre': prospecto.nombre,
        'Apellido': prospecto.apellido,
        'Email': prospecto.correo,
        'Teléfono': prospecto.numero_contacto,
        'Estado': prospecto.estado,
        'Vendedor': `${prospecto.vendedor_nombre} ${prospecto.vendedor_apellido}`,
      };
      
      // Agregar pólizas y URLs
      registro['Cantidad Pólizas'] = polizasProspecto.length;
      
      console.log(`🔍 Procesando prospecto ${prospecto.id} con ${polizasProspecto.length} pólizas`);
      
      polizasProspecto.forEach((poliza, index) => {
        const suffix = polizasProspecto.length > 1 ? ` ${index + 1}` : '';
        
        registro[`Póliza${suffix} - Número`] = poliza.numero_poliza_oficial || poliza.numero_poliza;
        registro[`Póliza${suffix} - Estado`] = poliza.estado;
        registro[`Póliza${suffix} - Plan`] = poliza.plan_nombre;
        registro[`Póliza${suffix} - ID`] = poliza.id;
        
        // URLs críticas - ESTAS SON LAS IMPORTANTES
        registro[`Póliza${suffix} - URL PDF Privada`] = `${baseUrl}/api/polizas/${poliza.id}/pdf`;
        registro[`Póliza${suffix} - URL PDF Pública`] = poliza.pdf_hash ? `${baseUrl}/api/polizas/pdf/${poliza.pdf_hash}` : 'No disponible';
        registro[`Póliza${suffix} - Hash PDF`] = poliza.pdf_hash || 'No disponible';
        
        console.log(`📋 AGREGANDO COLUMNAS DE PÓLIZA ${poliza.id}:`);
        console.log(`   Columna: Póliza${suffix} - URL PDF Privada = ${registro[`Póliza${suffix} - URL PDF Privada`]}`);
        console.log(`   Columna: Póliza${suffix} - URL PDF Pública = ${registro[`Póliza${suffix} - URL PDF Pública`]}`);
        
        // Documentos
        const docsPoliza = documentosData[poliza.id] || [];
        registro[`Póliza${suffix} - Documentos`] = docsPoliza.length;
        
        console.log(`📄 AGREGANDO ${docsPoliza.length} DOCUMENTOS:`);
        
        docsPoliza.forEach((doc, docIndex) => {
          registro[`Póliza${suffix} - Doc${docIndex + 1} - Nombre`] = doc.nombre_original;
          registro[`Póliza${suffix} - Doc${docIndex + 1} - Tipo`] = doc.tipo_documento;
          registro[`Póliza${suffix} - Doc${docIndex + 1} - URL Privada`] = `${baseUrl}/api/poliza-documentos/download/${doc.id}`;
          registro[`Póliza${suffix} - Doc${docIndex + 1} - URL Pública`] = doc.public_hash ? `${baseUrl}/poliza-documentos/public/${doc.public_hash}` : 'No disponible';
          registro[`Póliza${suffix} - Doc${docIndex + 1} - Hash Público`] = doc.public_hash || 'No disponible';
          
          console.log(`   Columna: Póliza${suffix} - Doc${docIndex + 1} - URL Privada = ${registro[`Póliza${suffix} - Doc${docIndex + 1} - URL Privada`]}`);
          console.log(`   Columna: Póliza${suffix} - Doc${docIndex + 1} - URL Pública = ${registro[`Póliza${suffix} - Doc${docIndex + 1} - URL Pública`]}`);
        });
      });
      
      return registro;
    });
    
    console.log(`\n📊 Total de registros procesados: ${datosExportacion.length}`);
    
    // 🔧 CORRECCIÓN: Generar headers completos basados en todos los registros
    let allHeaders = new Set();
    datosExportacion.forEach(registro => {
      Object.keys(registro).forEach(key => allHeaders.add(key));
    });
    const headersCompletos = Array.from(allHeaders);
    
    console.log(`� Headers completos generados: ${headersCompletos.length} columnas`);
    console.log(`🔗 Columnas de URLs: ${headersCompletos.filter(h => h.includes('URL')).length}`);
    
    // Mostrar todas las columnas que se generaron
    console.log(`\n📋 Todas las columnas generadas (${headersCompletos.length}):`);
    headersCompletos.forEach((header, index) => {
      console.log(`${index + 1}. ${header}`);
    });
    
    // Filtrar solo las columnas de URLs
    const urlColumns = headersCompletos.filter(h => h.includes('URL') || h.includes('Hash'));
    console.log(`\n🔗 Columnas de URLs encontradas (${urlColumns.length}):`);
    urlColumns.forEach((col, index) => {
      console.log(`${index + 1}. ${col}`);
    });
    
    // Mostrar valores de URLs del registro con pólizas
    const registroConPolizas = datosExportacion.find(r => r['Cantidad Pólizas'] > 0);
    if (registroConPolizas) {
      console.log(`\n📄 URLs del prospecto ${registroConPolizas['ID Prospecto']} (tiene ${registroConPolizas['Cantidad Pólizas']} pólizas):`);
      Object.entries(registroConPolizas).forEach(([key, value]) => {
        if (key.includes('URL') || key.includes('Hash')) {
          console.log(`  🔗 ${key}: ${value}`);
        }
      });
    }
    
    // Normalizar todos los registros para que tengan todas las columnas
    const datosNormalizados = datosExportacion.map(registro => {
      const registroCompleto = {};
      headersCompletos.forEach(header => {
        registroCompleto[header] = registro[header] || '';
      });
      return registroCompleto;
    });

    // Crear archivo Excel de prueba
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Prueba URLs');
    
    // Agregar encabezados usando los headers completos
    worksheet.addRow(headersCompletos);
    
    // Agregar datos normalizados
    datosNormalizados.forEach(registro => {
      const row = headersCompletos.map(header => registro[header] || '');
      worksheet.addRow(row);
    });
    
    // Ajustar ancho de columnas
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
    
    // Guardar archivo
    const fileName = `prueba_urls_debug_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp_exports', fileName);
    
    await workbook.xlsx.writeFile(filePath);
    console.log(`\n✅ Archivo de prueba generado: ${filePath}`);
    
  } catch (error) {
    console.error('❌ Error en prueba de exportación:', error);
  } finally {
    process.exit();
  }
}

testExportWithDebug();
