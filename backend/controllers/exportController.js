const db = require('../config/db');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');

const ExportController = {
  // Exportar prospectos con sus pólizas
  async exportarProspectos(req, res) {
    try {
      const { 
        formato = 'excel', // 'excel' o 'csv'
        incluir_polizas = true,
        incluir_documentos = true,
        incluir_familiares = false,
        fecha_desde,
        fecha_hasta,
        estado_prospecto,
        vendedor_id
      } = req.query;

      console.log('📊 Exportando prospectos con configuración:', {
        formato, incluir_polizas, incluir_documentos, incluir_familiares
      });

      // Query base para prospectos
      let whereConditions = ['1=1'];
      let queryParams = [];

      // Filtros según el rol
      if (req.user.role === 'vendedor') {
        whereConditions.push('a.id_vendedor = ?');
        queryParams.push(req.user.id);
      } else if (vendedor_id && vendedor_id !== 'todos') {
        whereConditions.push('a.id_vendedor = ?');
        queryParams.push(vendedor_id);
      }

      // Filtros de fecha
      if (fecha_desde) {
        whereConditions.push('DATE(pr.fecha_registro) >= ?');
        queryParams.push(fecha_desde);
      }
      if (fecha_hasta) {
        whereConditions.push('DATE(pr.fecha_registro) <= ?');
        queryParams.push(fecha_hasta);
      }

      // Filtro de estado
      if (estado_prospecto && estado_prospecto !== 'todos') {
        whereConditions.push('pr.estado = ?');
        queryParams.push(estado_prospecto);
      }

      const whereClause = whereConditions.join(' AND ');

      // Query principal - incluir datos de asignaciones y cotizaciones
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
        WHERE ${whereClause}
        ORDER BY pr.id DESC
      `;

      const [prospectos] = await db.execute(query, queryParams);

      // Obtener cotizaciones con nombre del plan y total_final
      let cotizacionesData = {};
      const prospectoIds = prospectos.map(p => p.id);
      if (prospectoIds.length > 0) {
        const cotizacionesQuery = `
          SELECT 
            c.*,
            pl.nombre as plan_nombre,
            c.total_final
          FROM cotizaciones c
          LEFT JOIN planes pl ON c.plan_id = pl.id
          WHERE c.prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
          ORDER BY c.id DESC
        `;
        const [cotizaciones] = await db.execute(cotizacionesQuery, prospectoIds);
        
        cotizaciones.forEach(cotizacion => {
          if (!cotizacionesData[cotizacion.prospecto_id]) {
            cotizacionesData[cotizacion.prospecto_id] = [];
          }
          cotizacionesData[cotizacion.prospecto_id].push(cotizacion);
        });
      }

      // Obtener pólizas si está habilitado
      let polizasData = {};
      if (incluir_polizas === 'true') {
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
          
          polizas.forEach(poliza => {
            if (!polizasData[poliza.prospecto_id]) {
              polizasData[poliza.prospecto_id] = [];
            }
            polizasData[poliza.prospecto_id].push(poliza);
          });
        }
      }

      // Obtener documentos si está habilitado
      let documentosData = {};
      if (incluir_documentos === 'true') {
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
          
          documentos.forEach(doc => {
            if (!documentosData[doc.poliza_id]) {
              documentosData[doc.poliza_id] = [];
            }
            documentosData[doc.poliza_id].push(doc);
          });
        }
      }

      // Obtener familiares si está habilitado
      let familiaresData = {};
      if (incluir_familiares === 'true') {
        const prospectoIds = prospectos.map(p => p.id);
        if (prospectoIds.length > 0) {
          const familiaresQuery = `
            SELECT * FROM familiares 
            WHERE prospecto_id IN (${prospectoIds.map(() => '?').join(',')})
            ORDER BY id DESC
          `;
          const [familiares] = await db.execute(familiaresQuery, prospectoIds);
          
          familiares.forEach(familiar => {
            if (!familiaresData[familiar.prospecto_id]) {
              familiaresData[familiar.prospecto_id] = [];
            }
            familiaresData[familiar.prospecto_id].push(familiar);
          });
        }
      }

      // 🔧 PASO 1: Determinar el número máximo de familiares para generar headers completos
      let maxFamiliares = 0;
      let maxCotizaciones = 0;

      // Calcular máximos para generar headers completos
      prospectos.forEach(prospecto => {
        const familiaresProspecto = familiaresData[prospecto.id] || [];
        maxFamiliares = Math.max(maxFamiliares, familiaresProspecto.length);
        
        const cotizacionesProspecto = cotizacionesData[prospecto.id] || [];
        maxCotizaciones = Math.max(maxCotizaciones, cotizacionesProspecto.length);
      });

      console.log(`📊 Máximos calculados: ${maxFamiliares} familiares, ${maxCotizaciones} cotizaciones`);

      // 🔧 PASO 2: Generar headers completos basados en los máximos
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

      // Agregar headers de cotizaciones
      for (let i = 0; i < maxCotizaciones; i++) {
        const suffix = maxCotizaciones > 1 ? ` ${i + 1}` : '';
        headersCompletos.push(
          `Cotización${suffix} - Plan`,
          `Cotización${suffix} - Total`
        );
      }

      // Agregar headers de póliza
      if (incluir_polizas === 'true') {
        headersCompletos.push(
          'Póliza Número',
          'Póliza Estado',
          'Póliza Plan',
          'URL Póliza',
          'URL DNI Frente',
          'URL DNI Dorso',
          'URL Recibo Sueldo'
        );
      }

      // Agregar headers de familiares si está habilitado
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

      console.log(`🏷️ Headers estructurados: ${headersCompletos.length} columnas`);

      // 🔧 NUEVA LÓGICA: Procesar datos con estructura específica
      const datosExportacion = prospectos.map(prospecto => {
        const baseUrl = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online');
        
        // Inicializar registro con headers fijos
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
        cotizacionesProspecto.forEach((cotizacion, index) => {
          const suffix = maxCotizaciones > 1 ? ` ${index + 1}` : '';
          registro[`Cotización${suffix} - Plan`] = cotizacion.plan_nombre || '';
          registro[`Cotización${suffix} - Total`] = cotizacion.total_final || '';
        });

        // Datos de póliza
        if (incluir_polizas === 'true') {
          const polizasProspecto = polizasData[prospecto.id] || [];
          if (polizasProspecto.length > 0) {
            const poliza = polizasProspecto[0]; // Tomar la primera póliza
            
            registro['Póliza Número'] = poliza.numero_poliza_oficial || poliza.numero_poliza || '';
            registro['Póliza Estado'] = poliza.estado || '';
            registro['Póliza Plan'] = poliza.plan_nombre || '';
            
            // URL de póliza solo si tiene hash
            if (poliza.pdf_hash) {
              registro['URL Póliza'] = `${baseUrl}/api/polizas/pdf/${poliza.pdf_hash}`;
            }

            // Obtener documentos específicos por tipo del titular
            if (incluir_documentos === 'true') {
              const docsPoliza = documentosData[poliza.id] || [];
              
              // Buscar documentos específicos del titular (integrante_index null o 0)
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
          }
        }

        // Agregar datos de familiares si está habilitado
        if (incluir_familiares === 'true') {
          const familiaresProspecto = familiaresData[prospecto.id] || [];
          
          familiaresProspecto.forEach((familiar, index) => {
            registro[`Familiar ${index + 1} - Nombre`] = familiar.nombre || '';
            registro[`Familiar ${index + 1} - Edad`] = familiar.edad || '';
            registro[`Familiar ${index + 1} - Vínculo`] = familiar.vinculo || '';
            
            // Buscar documentos del familiar
            const polizasProspecto = polizasData[prospecto.id] || [];
            if (polizasProspecto.length > 0 && incluir_documentos === 'true') {
              const poliza = polizasProspecto[0];
              const docsPoliza = documentosData[poliza.id] || [];
              
              // Los familiares usan integrante_index empezando desde 0
              // El index del array JavaScript coincide con el integrante_index de la BD
              const docsFamiliar = docsPoliza.filter(doc => 
                doc.integrante_index === index && doc.public_hash
              );

              const dniFrenteFam = docsFamiliar.find(doc => doc.tipo_documento === 'dni_frente');
              const dniDorsoFam = docsFamiliar.find(doc => doc.tipo_documento === 'dni_dorso');
              const reciboSueldoFam = docsFamiliar.find(doc => doc.tipo_documento === 'recibo_sueldo');

              if (dniFrenteFam) {
                registro[`Familiar ${index + 1} - URL DNI Frente`] = `${baseUrl}/poliza-documentos/public/${dniFrenteFam.public_hash}`;
              }
              if (dniDorsoFam) {
                registro[`Familiar ${index + 1} - URL DNI Dorso`] = `${baseUrl}/poliza-documentos/public/${dniDorsoFam.public_hash}`;
              }
              if (reciboSueldoFam) {
                registro[`Familiar ${index + 1} - URL Recibo Sueldo`] = `${baseUrl}/poliza-documentos/public/${reciboSueldoFam.public_hash}`;
              }
            }
          });
        }

        return registro;
      });

      console.log(`📊 Preparados ${datosExportacion.length} registros para exportar`);

      // Generar archivo según formato
      if (formato === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Prospectos');

        // 🔧 USAR HEADERS COMPLETOS EN LUGAR DEL PRIMER REGISTRO
        if (headersCompletos.length > 0) {
          worksheet.addRow(headersCompletos);

          // Estilo para encabezados
          const headerRow = worksheet.getRow(1);
          headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } };
          });

          // Agregar datos usando headers completos
          datosExportacion.forEach(registro => {
            const row = headersCompletos.map(header => registro[header] || '');
            worksheet.addRow(row);
          });

          // Ajustar ancho de columnas
          worksheet.columns.forEach(column => {
            column.width = 15;
          });
        }

        // Configurar respuesta
        const fileName = `prospectos_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        await workbook.xlsx.write(res);
        res.end();
        
      } else {
        // Formato CSV - también usar headers completos
        const parser = new Parser({ fields: headersCompletos });
        const csv = parser.parse(datosExportacion);
        
        const fileName = `prospectos_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send('\ufeff' + csv); // BOM para UTF-8
      }

    } catch (error) {
      console.error('❌ Error exportando prospectos:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor', 
        details: error.message 
      });
    }
  },

  // Obtener estadísticas para configuración de exportación
  async obtenerEstadisticasExportacion(req, res) {
    try {
      let whereConditions = ['1=1'];
      let queryParams = [];

      // Filtrar según el rol
      if (req.user.role === 'vendedor') {
        whereConditions.push('a.id_vendedor = ?');
        queryParams.push(req.user.id);
      }

      const whereClause = whereConditions.join(' AND ');

      // Contar prospectos
      const [prospectos] = await db.execute(`
        SELECT COUNT(*) as total FROM prospectos pr 
        LEFT JOIN asignaciones a ON pr.id = a.id_prospecto
        WHERE ${whereClause}
      `, queryParams);

      // Contar pólizas
      const [polizas] = await db.execute(`
        SELECT COUNT(*) as total FROM polizas p 
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id 
        LEFT JOIN asignaciones a ON pr.id = a.id_prospecto
        WHERE ${whereClause} AND p.deleted_at IS NULL
      `, queryParams);

      // Contar documentos
      const [documentos] = await db.execute(`
        SELECT COUNT(*) as total FROM poliza_documentos d
        LEFT JOIN polizas p ON d.poliza_id = p.id
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN asignaciones a ON pr.id = a.id_prospecto
        WHERE ${whereClause} AND p.deleted_at IS NULL
      `, queryParams);

      // Estados de prospectos
      const [estados] = await db.execute(`
        SELECT pr.estado, COUNT(*) as cantidad FROM prospectos pr 
        LEFT JOIN asignaciones a ON pr.id = a.id_prospecto
        WHERE ${whereClause} GROUP BY pr.estado ORDER BY cantidad DESC
      `, queryParams);

      res.json({
        success: true,
        data: {
          total_prospectos: prospectos[0].total,
          total_polizas: polizas[0].total,
          total_documentos: documentos[0].total,
          estados: estados
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor', 
        details: error.message 
      });
    }
  }
};

module.exports = ExportController;
