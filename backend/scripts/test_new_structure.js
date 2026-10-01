const db = require('../config/db');
const ExcelJS = require('exceljs');
const path = require('path');

async function testNewExportStructure() {
  try {
    console.log('🧪 PRUEBA: Nueva estructura de exportación limpia\n');
    
    // Configuración
    const configuracion = {
      incluir_polizas: 'true',
      incluir_documentos: 'true',
      incluir_familiares: 'false'
    };
    
    console.log('📊 Configuración:', configuracion);
    
    // Query principal con asignaciones
    const query = `
      SELECT 
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
      WHERE 1=1
      ORDER BY pr.id DESC
      LIMIT 5
    `;
    
    const [prospectos] = await db.execute(query);
    console.log(`📋 Encontrados ${prospectos.length} prospectos`);
    
    // Obtener cotizaciones
    let cotizacionesData = {};
    const prospectoIds = prospectos.map(p => p.id);
    
    if (prospectoIds.length > 0) {
      const cotizacionesQuery = `
        SELECT 
          c.*,
          pl.nombre as plan_nombre
        FROM cotizaciones c
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE c.prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
        ORDER BY c.id DESC
      `;
      const [cotizaciones] = await db.execute(cotizacionesQuery, prospectoIds);
      console.log(`💰 Encontradas ${cotizaciones.length} cotizaciones`);
      
      cotizaciones.forEach(cotizacion => {
        if (!cotizacionesData[cotizacion.prospecto_id]) {
          cotizacionesData[cotizacion.prospecto_id] = [];
        }
        cotizacionesData[cotizacion.prospecto_id].push(cotizacion);
      });
    }
    
    // Obtener pólizas
    let polizasData = {};
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
      
      // Mostrar tipos de documentos encontrados
      const tiposDoc = [...new Set(documentos.map(d => d.tipo_documento))];
      console.log(`📋 Tipos de documentos: ${tiposDoc.join(', ')}`);
    }
    
    // 🔧 NUEVA ESTRUCTURA: Headers fijos
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
      'Fecha Registro',
      'Cotizaciones',
      'Póliza Número',
      'Póliza Estado',
      'Póliza Plan',
      'URL Póliza',
      'URL DNI Frente',
      'URL DNI Dorso', 
      'URL Recibo Sueldo'
    ];
    
    console.log(`🏷️ Headers estructura limpia: ${headersCompletos.length} columnas`);
    
    // Procesar datos con nueva estructura
    const baseUrl = 'https://wspflows.cober.online';
    const datosExportacion = prospectos.map(prospecto => {
      
      // Inicializar registro
      const registro = {};
      headersCompletos.forEach(header => {
        registro[header] = '';
      });

      // Datos básicos del prospecto
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

      // Datos de cotizaciones
      const cotizacionesProspecto = cotizacionesData[prospecto.id] || [];
      registro['Cotizaciones'] = cotizacionesProspecto.length;

      // Datos de la primera póliza
      const polizasProspecto = polizasData[prospecto.id] || [];
      if (polizasProspecto.length > 0) {
        const poliza = polizasProspecto[0];
        
        registro['Póliza Número'] = poliza.numero_poliza_oficial || poliza.numero_poliza || '';
        registro['Póliza Estado'] = poliza.estado || '';
        registro['Póliza Plan'] = poliza.plan_nombre || '';
        
        // URL de póliza solo si tiene hash
        if (poliza.pdf_hash) {
          registro['URL Póliza'] = `${baseUrl}/api/polizas/pdf/${poliza.pdf_hash}`;
        }

        // Obtener documentos específicos por tipo
        const docsPoliza = documentosData[poliza.id] || [];
        
        // Buscar documentos específicos por tipo
        const dniFrente = docsPoliza.find(doc => 
          doc.tipo_documento === 'dni_frente' && doc.public_hash
        );
        const dniDorso = docsPoliza.find(doc => 
          doc.tipo_documento === 'dni_dorso' && doc.public_hash
        );
        const reciboSueldo = docsPoliza.find(doc => 
          doc.tipo_documento === 'recibo_sueldo' && doc.public_hash
        );

        // Solo agregar URLs si tienen hash público
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

      return registro;
    });
    
    console.log(`📊 Registros procesados: ${datosExportacion.length}`);
    
    // Mostrar ejemplo de datos procesados
    const registroEjemplo = datosExportacion.find(r => r['URL Póliza'] !== '');
    if (registroEjemplo) {
      console.log(`\n📋 EJEMPLO DE REGISTRO PROCESADO (Prospecto ${registroEjemplo['ID Prospecto']}):`);
      Object.entries(registroEjemplo).forEach(([key, value]) => {
        if (value && value !== '') {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
    
    // Crear archivo Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Estructura Limpia');
    
    // Usar headers completos
    worksheet.addRow(headersCompletos);
    
    // Estilo para encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } };
    });
    
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
    const fileName = `estructura_limpia_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp_exports', fileName);
    
    await workbook.xlsx.writeFile(filePath);
    console.log(`\n✅ Archivo con nueva estructura: ${filePath}`);
    
    // Resumen final
    const urlsGeneradas = datosExportacion.reduce((count, registro) => {
      if (registro['URL Póliza']) count++;
      if (registro['URL DNI Frente']) count++;
      if (registro['URL DNI Dorso']) count++;
      if (registro['URL Recibo Sueldo']) count++;
      return count;
    }, 0);
    
    console.log(`\n📊 RESUMEN NUEVA ESTRUCTURA:`);
    console.log(`   Headers: ${headersCompletos.length} columnas fijas`);
    console.log(`   Registros: ${datosExportacion.length}`);
    console.log(`   URLs generadas: ${urlsGeneradas}`);
    console.log(`   ✅ Solo URLs con hash incluidas`);
    console.log(`   ✅ Columnas de hash eliminadas`);
    console.log(`   ✅ Estructura simplificada y limpia`);
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    process.exit();
  }
}

testNewExportStructure();
