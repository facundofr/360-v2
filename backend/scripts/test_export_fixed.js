const db = require('../config/db');
const ExcelJS = require('exceljs');
const path = require('path');

async function testExportFixed() {
  try {
    console.log('🧪 PRUEBA: Exportación con headers completos y URLs corregidas\n');
    
    // Simular configuración
    const configuracion = {
      incluir_polizas: 'true',
      incluir_documentos: 'true',
      incluir_familiares: 'false'
    };
    
    console.log('📊 Configuración:', configuracion);
    
    // Query para prospectos (limitado para prueba)
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
      LIMIT 10
    `;
    
    const [prospectos] = await db.execute(query);
    console.log(`📋 Encontrados ${prospectos.length} prospectos`);
    
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
    }
    
    // 🔧 APLICAR LA LÓGICA CORREGIDA
    
    // PASO 1: Calcular máximos
    let maxPolizas = 0;
    let maxDocumentosPorPoliza = 0;
    
    prospectos.forEach(prospecto => {
      const polizasProspecto = polizasData[prospecto.id] || [];
      maxPolizas = Math.max(maxPolizas, polizasProspecto.length);
      
      polizasProspecto.forEach(poliza => {
        const docsPoliza = documentosData[poliza.id] || [];
        maxDocumentosPorPoliza = Math.max(maxDocumentosPorPoliza, docsPoliza.length);
      });
    });
    
    console.log(`📊 Máximos: ${maxPolizas} pólizas, ${maxDocumentosPorPoliza} docs/póliza`);
    
    // PASO 2: Generar headers completos
    const headersBase = [
      'ID Prospecto',
      'Nombre',
      'Apellido', 
      'Email',
      'Teléfono',
      'Estado',
      'Vendedor',
      'Fecha Registro'
    ];

    let headersCompletos = [...headersBase];

    // Headers de pólizas
    if (configuracion.incluir_polizas === 'true') {
      headersCompletos.push('Cantidad Pólizas');
      
      for (let i = 0; i < maxPolizas; i++) {
        const suffix = maxPolizas > 1 ? ` ${i + 1}` : '';
        headersCompletos.push(
          `Póliza${suffix} - ID`,
          `Póliza${suffix} - Número`,
          `Póliza${suffix} - Estado`,
          `Póliza${suffix} - Plan`,
          `Póliza${suffix} - Hash PDF`,
          `Póliza${suffix} - URL PDF Privada`,
          `Póliza${suffix} - URL PDF Pública`
        );

        // Headers de documentos
        if (configuracion.incluir_documentos === 'true') {
          headersCompletos.push(`Póliza${suffix} - Documentos`);
          
          for (let j = 0; j < maxDocumentosPorPoliza; j++) {
            headersCompletos.push(
              `Póliza${suffix} - Doc${j + 1} - ID`,
              `Póliza${suffix} - Doc${j + 1} - Nombre`,
              `Póliza${suffix} - Doc${j + 1} - Tipo`,
              `Póliza${suffix} - Doc${j + 1} - Hash`,
              `Póliza${suffix} - Doc${j + 1} - URL Privada`,
              `Póliza${suffix} - Doc${j + 1} - URL Pública`
            );
          }
        }
      }
    }
    
    console.log(`🏷️ Headers completos: ${headersCompletos.length} columnas`);
    
    // PASO 3: Procesar datos con headers completos
    const baseUrl = 'https://wspflows.cober.online';
    const datosExportacion = prospectos.map(prospecto => {
      const polizasProspecto = polizasData[prospecto.id] || [];
      
      // Inicializar registro con TODOS los headers
      const registro = {};
      headersCompletos.forEach(header => {
        registro[header] = '';
      });

      // Llenar datos básicos
      registro['ID Prospecto'] = prospecto.id;
      registro['Nombre'] = prospecto.nombre || '';
      registro['Apellido'] = prospecto.apellido || '';
      registro['Email'] = prospecto.correo || '';
      registro['Teléfono'] = prospecto.numero_contacto || '';
      registro['Estado'] = prospecto.estado || '';
      registro['Vendedor'] = `${prospecto.vendedor_nombre || ''} ${prospecto.vendedor_apellido || ''}`.trim();
      registro['Fecha Registro'] = prospecto.fecha_registro || '';

      // Llenar datos de pólizas
      if (configuracion.incluir_polizas === 'true') {
        registro['Cantidad Pólizas'] = polizasProspecto.length;
        
        polizasProspecto.forEach((poliza, index) => {
          const suffix = maxPolizas > 1 ? ` ${index + 1}` : '';
          
          registro[`Póliza${suffix} - ID`] = poliza.id;
          registro[`Póliza${suffix} - Número`] = poliza.numero_poliza_oficial || poliza.numero_poliza || '';
          registro[`Póliza${suffix} - Estado`] = poliza.estado || '';
          registro[`Póliza${suffix} - Plan`] = poliza.plan_nombre || '';
          registro[`Póliza${suffix} - Hash PDF`] = poliza.pdf_hash || 'No disponible';
          registro[`Póliza${suffix} - URL PDF Privada`] = `${baseUrl}/api/polizas/${poliza.id}/pdf`;
          registro[`Póliza${suffix} - URL PDF Pública`] = poliza.pdf_hash 
            ? `${baseUrl}/api/polizas/pdf/${poliza.pdf_hash}` 
            : 'No disponible';

          // Llenar documentos
          if (configuracion.incluir_documentos === 'true') {
            const docsPoliza = documentosData[poliza.id] || [];
            registro[`Póliza${suffix} - Documentos`] = docsPoliza.length;
            
            docsPoliza.forEach((doc, docIndex) => {
              registro[`Póliza${suffix} - Doc${docIndex + 1} - ID`] = doc.id;
              registro[`Póliza${suffix} - Doc${docIndex + 1} - Nombre`] = doc.nombre_original || '';
              registro[`Póliza${suffix} - Doc${docIndex + 1} - Tipo`] = doc.tipo_documento || '';
              registro[`Póliza${suffix} - Doc${docIndex + 1} - Hash`] = doc.public_hash || 'No disponible';
              registro[`Póliza${suffix} - Doc${docIndex + 1} - URL Privada`] = `${baseUrl}/api/poliza-documentos/download/${doc.id}`;
              registro[`Póliza${suffix} - Doc${docIndex + 1} - URL Pública`] = doc.public_hash 
                ? `${baseUrl}/poliza-documentos/public/${doc.public_hash}` 
                : 'No disponible';
            });
          }
        });
      }

      return registro;
    });
    
    console.log(`📊 Registros procesados: ${datosExportacion.length}`);
    
    // Verificar que todos los registros tienen las mismas columnas
    const primerasCols = Object.keys(datosExportacion[0] || {}).length;
    const ultimasCols = Object.keys(datosExportacion[datosExportacion.length - 1] || {}).length;
    console.log(`🔍 Consistencia: primer registro=${primerasCols} cols, último registro=${ultimasCols} cols`);
    
    // Mostrar ejemplos de URLs generadas
    console.log('\n🔗 EJEMPLOS DE URLs GENERADAS:');
    
    const registroConPolizas = datosExportacion.find(r => r['Cantidad Pólizas'] > 0);
    if (registroConPolizas) {
      console.log(`📋 Prospecto ${registroConPolizas['ID Prospecto']} (${registroConPolizas['Cantidad Pólizas']} pólizas):`);
      
      Object.entries(registroConPolizas).forEach(([key, value]) => {
        if (key.includes('URL') && value && value !== '' && value !== 'No disponible') {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
    
    // Crear archivo Excel de prueba
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Prueba Corregida');
    
    // Usar headers completos
    worksheet.addRow(headersCompletos);
    
    // Agregar datos
    datosExportacion.forEach(registro => {
      const row = headersCompletos.map(header => registro[header] || '');
      worksheet.addRow(row);
    });
    
    // Ajustar ancho de columnas
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
    
    // Guardar archivo
    const fileName = `export_corregido_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp_exports', fileName);
    
    await workbook.xlsx.writeFile(filePath);
    console.log(`\n✅ Archivo corregido generado: ${filePath}`);
    
    // Análisis final
    const urlColumns = headersCompletos.filter(h => h.includes('URL'));
    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`   Total headers: ${headersCompletos.length}`);
    console.log(`   Headers de URL: ${urlColumns.length}`);
    console.log(`   Registros: ${datosExportacion.length}`);
    console.log(`   Máx pólizas: ${maxPolizas}`);
    console.log(`   Máx docs/póliza: ${maxDocumentosPorPoliza}`);
    
    console.log(`\n🏷️ Columnas de URL generadas:`);
    urlColumns.forEach((col, i) => console.log(`   ${i + 1}. ${col}`));
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    process.exit();
  }
}

testExportFixed();
