const db = require('../config/db');
const ExcelJS = require('exceljs');
const path = require('path');

async function testExportWithFamiliares() {
  try {
    console.log('🧪 PRUEBA FINAL: Exportación completa con familiares y documentos\n');
    
    // Configuración de prueba
    const configuracion = {
      incluir_polizas: 'true',
      incluir_documentos: 'true',
      incluir_familiares: 'true'
    };
    
    console.log('📊 Configuración:', configuracion);
    
    // Query para prospectos (solo los que tienen familiares)
    const query = `
      SELECT DISTINCT
        pr.*,
        ta.etiqueta as tipo_afiliacion_nombre,
        u.first_name as vendedor_nombre,
        u.last_name as vendedor_apellido,
        u.email as vendedor_email,
        a.estado as estado_asignacion,
        a.fecha_estado as fecha_estado_asignacion,
        a.comentario as comentario_asignacion
      FROM prospectos pr
      LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
      LEFT JOIN asignaciones a ON pr.id = a.id_prospecto
      LEFT JOIN users u ON a.id_vendedor = u.id
      INNER JOIN familiares f ON pr.id = f.prospecto_id
      WHERE 1=1
      ORDER BY pr.id DESC
      LIMIT 3
    `;
    
    const [prospectos] = await db.execute(query);
    console.log(`📋 Prospectos con familiares: ${prospectos.length}`);
    
    // Obtener datos relacionados
    const prospectoIds = prospectos.map(p => p.id);
    
    // Cotizaciones
    let cotizacionesData = {};
    if (prospectoIds.length > 0) {
      const [cotizaciones] = await db.execute(`
        SELECT 
          c.*,
          pl.nombre as plan_nombre,
          c.total_final
        FROM cotizaciones c
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE c.prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
        ORDER BY c.id DESC
      `, prospectoIds);
      
      cotizaciones.forEach(cotizacion => {
        if (!cotizacionesData[cotizacion.prospecto_id]) {
          cotizacionesData[cotizacion.prospecto_id] = [];
        }
        cotizacionesData[cotizacion.prospecto_id].push(cotizacion);
      });
    }
    
    // Pólizas
    let polizasData = {};
    if (prospectoIds.length > 0) {
      const [polizas] = await db.execute(`
        SELECT 
          p.*,
          pl.nombre as plan_nombre
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE p.prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
        AND p.deleted_at IS NULL
        ORDER BY p.id DESC
      `, prospectoIds);
      
      polizas.forEach(poliza => {
        if (!polizasData[poliza.prospecto_id]) {
          polizasData[poliza.prospecto_id] = [];
        }
        polizasData[poliza.prospecto_id].push(poliza);
      });
    }
    
    // Documentos
    let documentosData = {};
    const polizaIds = Object.values(polizasData).flat().map(p => p.id);
    if (polizaIds.length > 0) {
      const [documentos] = await db.execute(`
        SELECT 
          d.*,
          d.poliza_id
        FROM poliza_documentos d
        WHERE d.poliza_id IN (${polizaIds.map(() => '?').join(',')})
        ORDER BY d.id DESC
      `, polizaIds);
      
      documentos.forEach(doc => {
        if (!documentosData[doc.poliza_id]) {
          documentosData[doc.poliza_id] = [];
        }
        documentosData[doc.poliza_id].push(doc);
      });
    }
    
    // Familiares
    let familiaresData = {};
    if (prospectoIds.length > 0) {
      const [familiares] = await db.execute(`
        SELECT * FROM familiares 
        WHERE prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
        ORDER BY prospecto_id, id
      `, prospectoIds);
      
      familiares.forEach(familiar => {
        if (!familiaresData[familiar.prospecto_id]) {
          familiaresData[familiar.prospecto_id] = [];
        }
        familiaresData[familiar.prospecto_id].push(familiar);
      });
    }
    
    // Calcular máximos
    let maxFamiliares = 0;
    let maxCotizaciones = 0;
    
    prospectos.forEach(prospecto => {
      const familiaresProspecto = familiaresData[prospecto.id] || [];
      maxFamiliares = Math.max(maxFamiliares, familiaresProspecto.length);
      
      const cotizacionesProspecto = cotizacionesData[prospecto.id] || [];
      maxCotizaciones = Math.max(maxCotizaciones, cotizacionesProspecto.length);
    });
    
    console.log(`📊 Máximos: ${maxFamiliares} familiares, ${maxCotizaciones} cotizaciones`);
    
    // Generar headers
    const headersCompletos = [
      'ID Prospecto',
      'Nombre',
      'Apellido', 
      'Edad',
      'Email',
      'Teléfono',
      'Estado',
      'Localidad',
      'Tipo Afiliación',
      'Categoría Monotributo',
      'Grupo Familiar',
      'Comentario',
      'Vendedor',
      'Email Vendedor',
      'Fecha Registro'
    ];

    // Headers de cotizaciones
    for (let i = 0; i < maxCotizaciones; i++) {
      const suffix = maxCotizaciones > 1 ? ` ${i + 1}` : '';
      headersCompletos.push(
        `Cotización${suffix} - Plan`,
        `Cotización${suffix} - Total`
      );
    }

    // Headers de póliza
    headersCompletos.push(
      'Póliza Número',
      'Póliza Estado',
      'Póliza Plan',
      'URL Póliza',
      'URL DNI Frente',
      'URL DNI Dorso',
      'URL Recibo Sueldo'
    );

    // Headers de familiares
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
    
    console.log(`🏷️ Headers generados: ${headersCompletos.length} columnas`);
    
    // Mostrar headers de familiares generados
    const headersFamiliares = headersCompletos.filter(h => h.includes('Familiar'));
    console.log(`📋 Headers de familiares (${headersFamiliares.length}):`);
    headersFamiliares.forEach((header, i) => {
      console.log(`   ${i + 1}. ${header}`);
    });
    
    // Procesar datos
    const baseUrl = 'https://wspflows.cober.online';
    const datosExportacion = prospectos.map(prospecto => {
      const registro = {};
      headersCompletos.forEach(header => {
        registro[header] = '';
      });

      // Datos básicos
      registro['ID Prospecto'] = prospecto.id;
      registro['Nombre'] = prospecto.nombre || '';
      registro['Apellido'] = prospecto.apellido || '';
      registro['Edad'] = prospecto.edad || '';
      registro['Email'] = prospecto.correo || '';
      registro['Teléfono'] = prospecto.numero_contacto || '';
      registro['Estado'] = prospecto.estado_asignacion || prospecto.estado || '';
      registro['Localidad'] = prospecto.localidad || '';
      registro['Tipo Afiliación'] = prospecto.tipo_afiliacion_nombre || '';
      registro['Categoría Monotributo'] = prospecto.categoria_monotributo || '';
      registro['Grupo Familiar'] = prospecto.grupo_familiar || '';
      registro['Comentario'] = prospecto.comentario_asignacion || prospecto.comentario || '';
      registro['Vendedor'] = `${prospecto.vendedor_nombre || ''} ${prospecto.vendedor_apellido || ''}`.trim();
      registro['Email Vendedor'] = prospecto.vendedor_email || '';
      registro['Fecha Registro'] = prospecto.fecha_registro || '';

      // Cotizaciones
      const cotizacionesProspecto = cotizacionesData[prospecto.id] || [];
      cotizacionesProspecto.forEach((cotizacion, index) => {
        const suffix = maxCotizaciones > 1 ? ` ${index + 1}` : '';
        registro[`Cotización${suffix} - Plan`] = cotizacion.plan_nombre || '';
        registro[`Cotización${suffix} - Total`] = cotizacion.total_final || '';
      });

      // Póliza
      const polizasProspecto = polizasData[prospecto.id] || [];
      if (polizasProspecto.length > 0) {
        const poliza = polizasProspecto[0];
        
        registro['Póliza Número'] = poliza.numero_poliza_oficial || poliza.numero_poliza || '';
        registro['Póliza Estado'] = poliza.estado || '';
        registro['Póliza Plan'] = poliza.plan_nombre || '';
        
        if (poliza.pdf_hash) {
          registro['URL Póliza'] = `${baseUrl}/api/polizas/pdf/${poliza.pdf_hash}`;
        }

        // Documentos del titular
        const docsPoliza = documentosData[poliza.id] || [];
        
        const dniFrente = docsPoliza.find(doc => 
          doc.tipo_documento === 'dni_frente' && 
          doc.public_hash && 
          (doc.integrante_index === null || doc.integrante_index === 0)
        );
        const dniDorso = docsPoliza.find(doc => 
          doc.tipo_documento === 'dni_dorso' && 
          doc.public_hash && 
          (doc.integrante_index === null || doc.integrante_index === 0)
        );
        const reciboSueldo = docsPoliza.find(doc => 
          doc.tipo_documento === 'recibo_sueldo' && 
          doc.public_hash && 
          (doc.integrante_index === null || doc.integrante_index === 0)
        );

        if (dniFrente) {
          registro['URL DNI Frente'] = `${baseUrl}/poliza-documentos/public/${dniFrente.public_hash}`;
        }
        if (dniDorso) {
          registro['URL DNI Dorso'] = `${baseUrl}/poliza-documentos/public/${dniDorso.public_hash}`;
        }
        if (reciboSueldo) {
          registro['URL Recibo Sueldo'] = `${baseUrl}/poliza-documentos/public/${reciboSueldo.public_hash}`;
        }
      }

      // Familiares
      const familiaresProspecto = familiaresData[prospecto.id] || [];
      console.log(`\n👨‍👩‍👧‍👦 Prospecto ${prospecto.id} tiene ${familiaresProspecto.length} familiares`);
      
      familiaresProspecto.forEach((familiar, index) => {
        console.log(`   Familiar ${index + 1}: ${familiar.nombre} (ID: ${familiar.id})`);
        
        registro[`Familiar ${index + 1} - Nombre`] = familiar.nombre || '';
        registro[`Familiar ${index + 1} - Edad`] = familiar.edad || '';
        registro[`Familiar ${index + 1} - Vínculo`] = familiar.vinculo || '';
        
        // Documentos del familiar
        if (polizasProspecto.length > 0) {
          const poliza = polizasProspecto[0];
          const docsPoliza = documentosData[poliza.id] || [];
          
          const docsFamiliar = docsPoliza.filter(doc => 
            doc.integrante_index === index && doc.public_hash
          );
          
          console.log(`     Documentos con integrante_index=${index}: ${docsFamiliar.length}`);

          const dniFrenteFam = docsFamiliar.find(doc => doc.tipo_documento === 'dni_frente');
          const dniDorsoFam = docsFamiliar.find(doc => doc.tipo_documento === 'dni_dorso');
          const reciboSueldoFam = docsFamiliar.find(doc => doc.tipo_documento === 'recibo_sueldo');

          if (dniFrenteFam) {
            registro[`Familiar ${index + 1} - URL DNI Frente`] = `${baseUrl}/poliza-documentos/public/${dniFrenteFam.public_hash}`;
            console.log(`     ✅ DNI Frente: ${registro[`Familiar ${index + 1} - URL DNI Frente`]}`);
          }
          if (dniDorsoFam) {
            registro[`Familiar ${index + 1} - URL DNI Dorso`] = `${baseUrl}/poliza-documentos/public/${dniDorsoFam.public_hash}`;
            console.log(`     ✅ DNI Dorso: ${registro[`Familiar ${index + 1} - URL DNI Dorso`]}`);
          }
          if (reciboSueldoFam) {
            registro[`Familiar ${index + 1} - URL Recibo Sueldo`] = `${baseUrl}/poliza-documentos/public/${reciboSueldoFam.public_hash}`;
            console.log(`     ✅ Recibo Sueldo: ${registro[`Familiar ${index + 1} - URL Recibo Sueldo`]}`);
          }
        }
      });

      return registro;
    });
    
    console.log(`\n📊 Registros procesados: ${datosExportacion.length}`);
    
    // Crear Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Prueba Familiares');
    
    worksheet.addRow(headersCompletos);
    
    datosExportacion.forEach(registro => {
      const row = headersCompletos.map(header => registro[header] || '');
      worksheet.addRow(row);
    });
    
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
    
    // Guardar archivo
    const fileName = `export_familiares_final_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp_exports', fileName);
    
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`\n✅ Archivo generado: ${filePath}`);
    
    // Análisis de URLs de familiares generadas
    const urlsFamiliares = headersCompletos.filter(h => h.includes('Familiar') && (h.includes('DNI') || h.includes('Recibo')));
    console.log(`\n🔗 Headers de URLs de familiares: ${urlsFamiliares.length}`);
    urlsFamiliares.forEach((header, i) => {
      console.log(`   ${i + 1}. ${header}`);
    });
    
    // Contar URLs reales generadas
    let urlsRealesGeneradas = 0;
    datosExportacion.forEach((registro, idx) => {
      urlsFamiliares.forEach(urlHeader => {
        if (registro[urlHeader] && registro[urlHeader] !== '') {
          urlsRealesGeneradas++;
          console.log(`   ${idx + 1}. ${urlHeader}: ${registro[urlHeader]}`);
        }
      });
    });
    
    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`   Headers totales: ${headersCompletos.length}`);
    console.log(`   Headers de familiares: ${headersCompletos.filter(h => h.includes('Familiar')).length}`);
    console.log(`   URLs de familiares generadas: ${urlsRealesGeneradas}`);
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    process.exit();
  }
}

testExportWithFamiliares();
