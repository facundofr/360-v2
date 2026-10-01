const db = require('../config/db');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateFullURLReport() {
  try {
    console.log('📊 Generando reporte completo de URLs...');
    
    // Query para obtener toda la información
    const query = `
      SELECT 
        pr.id as prospecto_id,
        pr.nombre as prospecto_nombre,
        pr.apellido as prospecto_apellido,
        pr.correo as prospecto_email,
        pr.numero_contacto as prospecto_telefono,
        p.id as poliza_id,
        p.numero_poliza,
        p.numero_poliza_oficial,
        p.pdf_hash,
        p.estado as poliza_estado,
        p.created_at as poliza_fecha,
        d.id as documento_id,
        d.nombre_original as documento_nombre,
        d.tipo_documento,
        d.public_hash as documento_hash
      FROM prospectos pr
      LEFT JOIN polizas p ON pr.id = p.prospecto_id
      LEFT JOIN poliza_documentos d ON p.id = d.poliza_id
      WHERE p.deleted_at IS NULL
      ORDER BY pr.id, p.id, d.id
    `;
    
    const [rows] = await db.execute(query);
    console.log(`📋 Obtenidos ${rows.length} registros de la base de datos`);
    
    // Procesar datos para el reporte
    const baseUrl = 'https://wspflows.cober.online';
    const reporteData = [];
    
    rows.forEach(row => {
      const registro = {
        'ID Prospecto': row.prospecto_id,
        'Nombre Prospecto': `${row.prospecto_nombre} ${row.prospecto_apellido}`,
        'Email Prospecto': row.prospecto_email,
        'Teléfono Prospecto': row.prospecto_telefono,
        'ID Póliza': row.poliza_id,
        'Número Póliza': row.numero_poliza_oficial || row.numero_poliza,
        'Estado Póliza': row.poliza_estado,
        'Fecha Póliza': row.poliza_fecha,
        'Hash PDF Póliza': row.pdf_hash,
        'URL PDF Póliza Privada': row.poliza_id ? `${baseUrl}/api/polizas/${row.poliza_id}/pdf` : '',
        'URL PDF Póliza Pública': row.pdf_hash ? `${baseUrl}/api/polizas/pdf/${row.pdf_hash}` : 'Sin hash',
        'ID Documento': row.documento_id || '',
        'Nombre Documento': row.documento_nombre || '',
        'Tipo Documento': row.tipo_documento || '',
        'Hash Documento': row.documento_hash || '',
        'URL Documento Privada': row.documento_id ? `${baseUrl}/api/poliza-documentos/download/${row.documento_id}` : '',
        'URL Documento Pública': row.documento_hash ? `${baseUrl}/poliza-documentos/public/${row.documento_hash}` : 'Sin hash'
      };
      
      reporteData.push(registro);
    });
    
    // Crear archivo Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('URLs Completas');
    
    if (reporteData.length > 0) {
      const headers = Object.keys(reporteData[0]);
      worksheet.addRow(headers);
      
      // Estilo para encabezados
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } };
      });
      
      // Agregar datos
      reporteData.forEach(registro => {
        const row = headers.map(header => registro[header] || '');
        worksheet.addRow(row);
      });
      
      // Ajustar ancho de columnas
      worksheet.columns.forEach(column => {
        column.width = 20;
      });
    }
    
    // Guardar archivo
    const fileName = `reporte_urls_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'temp_exports', fileName);
    
    // Crear directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`✅ Reporte generado: ${filePath}`);
    console.log(`📊 Total de registros: ${reporteData.length}`);
    
    // Estadísticas
    const polizasConHash = reporteData.filter(r => r['Hash PDF Póliza']).length;
    const documentosConHash = reporteData.filter(r => r['Hash Documento']).length;
    
    console.log(`📋 Pólizas con hash: ${polizasConHash}`);
    console.log(`📄 Documentos con hash: ${documentosConHash}`);
    
    // Mostrar ejemplos de URLs
    console.log('\n🔗 Ejemplos de URLs generadas:');
    
    const polizasEjemplo = reporteData.filter(r => r['URL PDF Póliza Pública'] !== 'Sin hash').slice(0, 3);
    polizasEjemplo.forEach(r => {
      console.log(`📋 Póliza ${r['ID Póliza']}: ${r['URL PDF Póliza Pública']}`);
    });
    
    const documentosEjemplo = reporteData.filter(r => r['URL Documento Pública'] !== 'Sin hash').slice(0, 3);
    documentosEjemplo.forEach(r => {
      console.log(`📄 Documento ${r['ID Documento']}: ${r['URL Documento Pública']}`);
    });
    
  } catch (error) {
    console.error('❌ Error generando reporte:', error);
  } finally {
    process.exit();
  }
}

generateFullURLReport();
