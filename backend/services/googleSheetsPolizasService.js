const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

// ID del spreadsheet para pólizas cerradas
const POLIZAS_SPREADSHEET_ID = '1FM6NK_zDNPSsu5E0kTj6VBJVxnlx7MgcN-HY9RjZ0T8';
const SHEET_NAME = 'Finalizadas';

let sheetsClient = null;
let polizasSheetInitialized = false;

function parseServiceAccount() {
  // Prioridad: GOOGLE_SERVICE_ACCOUNT_KEY (JSON string) -> GOOGLE_SERVICE_ACCOUNT_FILE (path)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (err) {
      console.error('Error parseando GOOGLE_SERVICE_ACCOUNT_KEY:', err.message);
      throw err;
    }
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    const p = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
    if (!fs.existsSync(p)) throw new Error(`Archivo de credenciales no encontrado: ${p}`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  // No hay credenciales configuradas
  return null;
}

async function init() {
  if (sheetsClient) return sheetsClient;

  const credentials = parseServiceAccount();
  if (!credentials) {
    throw new Error('Credenciales de Google Service Account no configuradas. Use GOOGLE_SERVICE_ACCOUNT_KEY o GOOGLE_SERVICE_ACCOUNT_FILE');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

function formatDateForSheet(d) {
  if (!d) return '';
  
  // Si es una fecha en formato DATE (YYYY-MM-DD), parsearla correctamente
  if (typeof d === 'string' && d.includes('-') && !d.includes(':')) {
    const [yyyy, mm, dd] = d.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  
  // Si es DATETIME o timestamp
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTimeForSheet(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, yyyy, mm, dd, hours, minutes, seconds = '00'] = match;
      return `${dd}/${mm}/${yyyy} ${hours}:${minutes}:${seconds}`;
    }
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) return '';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hours}:${minutes}:${seconds}`;
}

function formatVigencia(mesIngreso) {
  if (!mesIngreso) return '';
  
  // Convertir YYYY-MM a MM-YYYY
  if (typeof mesIngreso === 'string' && mesIngreso.includes('-')) {
    const [yyyy, mm] = mesIngreso.split('-');
    return `${mm}-${yyyy}`;
  }
  
  return mesIngreso;
}

function formatCurrency(amount) {
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Obtener los enlaces a documentos de un integrante específico
 * @param {Array} documentos - Array de documentos de la póliza
 * @param {Number} integranteIndex - Índice del integrante (null o 0 para titular, 0+ para integrantes)
 * @returns {Object} Objeto con enlaces a todos los tipos de documentos
 */
function obtenerEnlacesDocumentos(documentos, integranteIndex) {
  const baseUrl = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online');
  
  const enlaces = {
    dni_frente: '',
    dni_dorso: '',
    recibo_sueldo: '',
    codem: '',
    formulario_f152: '',
    formulario_f184: '',
    constancia_inscripcion: '',
    comprobante_pago_cuota: '', // Puede tener múltiples, se separan con | 
    estudios_medicos: '' // Puede tener múltiples, se separan con |
  };

  if (!Array.isArray(documentos)) return enlaces;

  // Normalizar integranteIndex para comparación
  const normalizedIndex = integranteIndex === null ? null : parseInt(integranteIndex, 10);

  // Función auxiliar para obtener el enlace de un tipo de documento
  const obtenerEnlace = (tipo) => {
    const docs = documentos.filter(doc => 
      doc.tipo_documento === tipo && 
      doc.public_hash && 
      (doc.integrante_index == normalizedIndex || 
       (normalizedIndex === null && doc.integrante_index === null))
    );
    
    if (docs.length === 0) return '';
    
    // Si hay múltiples documentos (ej: comprobantes, estudios), separar con |
    return docs.map(doc => `${baseUrl}/poliza-documentos/public/${doc.public_hash}`).join(' | ');
  };

  // Obtener enlaces para todos los tipos
  enlaces.dni_frente = obtenerEnlace('dni_frente');
  enlaces.dni_dorso = obtenerEnlace('dni_dorso');
  enlaces.recibo_sueldo = obtenerEnlace('recibo_sueldo');
  enlaces.codem = obtenerEnlace('codem');
  enlaces.formulario_f152 = obtenerEnlace('formulario_f152');
  enlaces.formulario_f184 = obtenerEnlace('formulario_f184');
  enlaces.constancia_inscripcion = obtenerEnlace('constancia_inscripcion');
  enlaces.comprobante_pago_cuota = obtenerEnlace('comprobante_pago_cuota');
  enlaces.estudios_medicos = obtenerEnlace('estudios_medicos');

  return enlaces;
}

const GoogleSheetsPolizasService = {
  init,

  /**
   * Probar conexión con el spreadsheet de pólizas
   */
  async probarConexion() {
    const sheets = await init();
    const res = await sheets.spreadsheets.get({ spreadsheetId: POLIZAS_SPREADSHEET_ID });
    return { title: res.data.properties.title, url: res.data.spreadsheetUrl };
  },

  /**
   * Inicializa la hoja con headers para pólizas cerradas
   */
  async inicializarHoja() {
    if (polizasSheetInitialized) return true;

    try {
      const sheets = await init();

      const headers = [
        'ID de Prospecto',
        'Número Póliza Oficial',
        'Fecha de Solicitud',
        'Apellido',
        'Nombre',
        'Fecha Nacimiento',
        'Nacionalidad',
        'Tipo Documento',
        'Nro Documento',
        'Sexo',
        'Estado Civil',
        'Condición IVA',
        'Parentesco',
        'Localidad',
        'Calle',
        'Número',
        'Obra Social',
        'Vigencia',
        'Convenio',
        'Próximo Período a Abonar',
        'Fecha de Carga',
        'Precio Lista',
        'Bonificación',
        'Diferencia a Pagar',
        'Plan Seleccionado',
        'Póliza Completa',
        'DNI Frente',
        'DNI Dorso',
        'Recibo Sueldo',
        'CODEM',
        'Formulario F152',
        'Formulario F184',
        'Constancia Inscripción',
        'Comprobantes Pago',
        'Estudios Médicos'
      ];

      const sheetsData = await sheets.spreadsheets.get({ spreadsheetId: POLIZAS_SPREADSHEET_ID });
      let sheetId = null;
      
      for (const sheet of sheetsData.data.sheets) {
        if (sheet.properties.title === SHEET_NAME) {
          sheetId = sheet.properties.sheetId;
          console.log(`✅ Hoja "${SHEET_NAME}" ya existe (ID: ${sheetId})`);
          break;
        }
      }

      if (sheetId === null) {
        // Crear la hoja si no existe
        try {
          const addSheetReq = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: POLIZAS_SPREADSHEET_ID,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: SHEET_NAME,
                    gridProperties: { rowCount: 5000, columnCount: headers.length }
                  }
                }
              }]
            }
          });
          sheetId = addSheetReq.data.replies[0].addSheet.properties.sheetId;
          console.log(`✅ Hoja "${SHEET_NAME}" creada (ID: ${sheetId})`);
        } catch (createErr) {
          console.warn(`⚠️ No se pudo crear hoja "${SHEET_NAME}" (probablemente ya existe):`, createErr.message);
        }
      }

      // Insertar físicamente la nueva columna en hojas existentes para conservar la alineación.
      const currentHeaderResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: POLIZAS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
      });
      const currentFirstHeader = currentHeaderResponse.data.values?.[0]?.[0] || '';

      if (sheetId !== null && currentFirstHeader === 'Número Póliza Oficial') {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          resource: {
            requests: [{
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 1,
                },
                inheritFromBefore: false,
              },
            }],
          },
        });
        console.log(`✅ Columna "ID de Prospecto" insertada en "${SHEET_NAME}"`);
      }

      const currentHeadersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: POLIZAS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:AI1`,
      });
      const currentHeaders = currentHeadersResponse.data.values?.[0] || [];

      if (sheetId !== null && currentHeaders[24] === 'Póliza Completa') {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          resource: {
            requests: [{
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 24,
                  endIndex: 25,
                },
                inheritFromBefore: false,
              },
            }],
          },
        });
        console.log(`✅ Columna "Plan Seleccionado" insertada en "${SHEET_NAME}"`);
      }

      // SIEMPRE escribir headers en la primera fila (si están vacías o no)
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1:AI1`,
          valueInputOption: 'RAW',
          resource: {
            values: [headers],
          },
        });
        console.log(`✅ Headers de "${SHEET_NAME}" inicializados/actualizados`);
        polizasSheetInitialized = true;
      } catch (headerErr) {
        console.warn('⚠️ Error al escribir headers:', headerErr.message);
      }

      return true;
    } catch (err) {
      console.error('Error inicializando hoja de pólizas:', err.message);
      return false;
    }
  },

  /**
   * Agregar una póliza cerrada al sheet
   */
  async agregarPolizaCerrada(polizaId, motivoCierre = '') {
    try {
      const sheets = await init();

      // Inicializar la hoja si aún no existe o no tiene headers
      await this.inicializarHoja();

      console.log(`📋 Exportando póliza cerrada ${polizaId} a Google Sheets...`);

      // Obtener datos completos de la póliza (sin columnas que no existen)
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.prospecto_id,
          p.numero_poliza,
          p.numero_poliza_oficial,
          p.pdf_hash,
          p.estado,
          p.created_at,
          p.datos_personales,
          p.integrantes,
          p.cotizacion_id,
          pl.nombre AS plan_nombre
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE p.id = ?
      `, [polizaId]);

      // Obtener documentos de la póliza
      const [documentos] = await db.query(`
        SELECT 
          d.id,
          d.tipo_documento,
          d.nombre_original,
          d.integrante_index,
          d.public_hash
        FROM poliza_documentos d
        WHERE d.poliza_id = ?
      `, [polizaId]);

      // Obtener detalles de cotización para precios individuales
      let detallesCotizacion = [];
      if (rows[0].cotizacion_id) {
        const [detalles] = await db.query(`
          SELECT 
            cd.persona,
            cd.vinculo,
            cd.precio_base,
            cd.descuento_aporte,
            cd.descuento_promocion,
            cd.precio_final
          FROM cotizaciones_detalles cd
          WHERE cd.cotizacion_id = ?
        `, [rows[0].cotizacion_id]);
        detallesCotizacion = detalles;
      }

      if (!rows || rows.length === 0) {
        console.error('❌ Póliza no encontrada:', polizaId);
        return false;
      }

      const p = rows[0];

      // Parsear datos personales para obtener datos del titular
      let datosPersonales = {};
      try {
        if (p.datos_personales) {
          datosPersonales = typeof p.datos_personales === 'string' 
            ? JSON.parse(p.datos_personales) 
            : p.datos_personales;
        }
      } catch (e) {
        console.log('⚠️ Error parseando datos_personales:', e.message);
      }

      // Parsear integrantes
      let integrantes = [];
      try {
        if (p.integrantes) {
          integrantes = typeof p.integrantes === 'string' 
            ? JSON.parse(p.integrantes) 
            : p.integrantes;
        }
      } catch (e) {
        console.log('⚠️ Error parseando integrantes:', e.message);
      }

      // Función auxiliar para encontrar el detalle de cotización de una persona
      const obtenerDetallePrecio = (nombreCompleto, vinculo) => {
        if (!detallesCotizacion || detallesCotizacion.length === 0) {
          return { precio_base: 0, bonificacion: 0, precio_final: 0 };
        }

        // Normalizar vínculo para comparación
        const vinculoNormalizado = vinculo.toLowerCase().trim();
        const esConyugeOPareja = vinculoNormalizado.includes('cónyuge') || vinculoNormalizado.includes('conyuge') || vinculoNormalizado.includes('pareja');
        const esHijo = vinculoNormalizado.includes('hijo');
        const esTitular = vinculoNormalizado === 'titular';

        // Buscar detalle que coincida
        const detalle = detallesCotizacion.find(d => {
          const vinculoDetalle = (d.vinculo || '').toLowerCase().trim();
          const nombreDetalle = (d.persona || '').toLowerCase().trim();
          const nombreBuscado = (nombreCompleto || '').toLowerCase().trim();

          // Comparar por vínculo y/o nombre
          const vinculoCoincide = 
            (esTitular && vinculoDetalle === 'titular') ||
            (esConyugeOPareja && (vinculoDetalle.includes('cónyuge') || vinculoDetalle.includes('conyuge') || vinculoDetalle.includes('pareja'))) ||
            (esHijo && vinculoDetalle.includes('hijo')) ||
            (vinculoDetalle === vinculoNormalizado);

          const nombreCoincide = nombreDetalle === nombreBuscado;

          return vinculoCoincide || nombreCoincide;
        });

        if (detalle) {
          const precioBase = parseFloat(detalle.precio_base || 0);
          const descuentoAporte = parseFloat(detalle.descuento_aporte || 0);
          const descuentoPromocion = parseFloat(detalle.descuento_promocion || 0);
          const bonificacion = descuentoAporte + descuentoPromocion;
          const precioFinal = parseFloat(detalle.precio_final || 0);

          return {
            precio_base: precioBase,
            bonificacion: bonificacion,
            precio_final: precioFinal
          };
        }

        return { precio_base: 0, bonificacion: 0, precio_final: 0 };
      };

      // Preparar filas: una fila para el titular + una fila por cada integrante
      const filasAExportar = [];

      // Fila del TITULAR (integrante_index = null en BD)
      const enlacesTitular = obtenerEnlacesDocumentos(documentos, null);
      const baseUrl = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online');
      
      // 🔍 Obtener enlace de la póliza FIRMADA cargada (si existe), sino usar PDF original
      let enlacePolizaCompleta = '';
      const polizaFirmada = documentos.find(d => d.tipo_documento === 'poliza_firmada' && d.integrante_index === null);
      
      if (polizaFirmada && polizaFirmada.public_hash) {
        // Usar el enlace de la póliza firmada cargada
        enlacePolizaCompleta = `${baseUrl}/api/polizas/documentos/public/${polizaFirmada.public_hash}`;
        console.log(`✅ Usando póliza firmada cargada: ${enlacePolizaCompleta}`);
      } else if (p.pdf_hash) {
        // Fallback al PDF original si no hay póliza firmada cargada
        enlacePolizaCompleta = `${baseUrl}/api/polizas/pdf/${p.pdf_hash}`;
        console.log(`⚠️  No hay póliza firmada cargada, usando PDF original`);
      }
      
      // Obtener precios del titular
      const nombreCompletoTitular = `${datosPersonales.nombre || ''} ${datosPersonales.apellido || ''}`.trim();
      const preciosTitular = obtenerDetallePrecio(nombreCompletoTitular, 'Titular');
      
      const filaTitular = [
        p.prospecto_id || '', // ID de Prospecto
        p.numero_poliza_oficial || p.numero_poliza || '', // Número Póliza Oficial
        formatDateTimeForSheet(p.created_at), // Fecha de Solicitud
        datosPersonales.apellido || '', // Apellido Titular
        datosPersonales.nombre || '', // Nombre Titular
        formatDateForSheet(datosPersonales.fecha_nacimiento) || '', // Fecha Nacimiento Titular
        datosPersonales.nacionalidad || 'Argentina', // Nacionalidad Titular
        datosPersonales.tipo_documento || 'DNI', // Tipo Documento Titular
        datosPersonales.dni || datosPersonales.nro_documento || '', // Nro Documento Titular
        datosPersonales.sexo || '', // Sexo Titular
        datosPersonales.estado_civil || '', // Estado Civil Titular
        datosPersonales.condicion_iva || '', // Condición IVA Titular
        'Titular', // Parentesco
        datosPersonales.localidad || '', // Localidad
        datosPersonales.direccion || '', // Calle
        datosPersonales.numero || '', // Número
        datosPersonales.obra_social === 'Otra' ? (datosPersonales.obra_social_otra || '') : (datosPersonales.obra_social || ''), // Obra Social
        formatVigencia(datosPersonales.mes_ingreso), // Vigencia
        'Cober', // Convenio
        formatDateForSheet(datosPersonales.proximo_periodo_abonar) || '', // Próximo Período a Abonar
        formatDateTimeForSheet(p.created_at), // Fecha de Carga
        formatCurrency(preciosTitular.precio_base), // Precio Lista
        formatCurrency(preciosTitular.bonificacion), // Bonificación
        formatCurrency(preciosTitular.precio_final), // Diferencia a Pagar
        p.plan_nombre || '', // Plan Seleccionado
        enlacePolizaCompleta, // Enlace Póliza Completa
        enlacesTitular.dni_frente || '', // Enlace DNI Frente
        enlacesTitular.dni_dorso || '', // Enlace DNI Dorso
        enlacesTitular.recibo_sueldo || '', // Enlace Recibo Sueldo
        enlacesTitular.codem || '', // Enlace CODEM
        enlacesTitular.formulario_f152 || '', // Enlace Formulario F152
        enlacesTitular.formulario_f184 || '', // Enlace Formulario F184
        enlacesTitular.constancia_inscripcion || '', // Enlace Constancia Inscripción
        enlacesTitular.comprobante_pago_cuota || '', // Enlace Comprobantes Pago
        enlacesTitular.estudios_medicos || '' // Enlace Estudios Médicos
      ];

      filasAExportar.push(filaTitular);

      // Filas de INTEGRANTES (si existen)
      if (Array.isArray(integrantes) && integrantes.length > 0) {
        integrantes.forEach((integrante, index) => {
          // index es 0, 1, 2... para cada integrante
          const enlacesIntegrante = obtenerEnlacesDocumentos(documentos, index);
          
          // Obtener precios del integrante
          const nombreCompletoIntegrante = `${integrante.nombre || ''} ${integrante.apellido || ''}`.trim();
          const vinculoIntegrante = integrante.vinculo || integrante.parentesco || '';
          const preciosIntegrante = obtenerDetallePrecio(nombreCompletoIntegrante, vinculoIntegrante);
          
          const filaIntegrante = [
            p.prospecto_id || '', // ID de Prospecto
            p.numero_poliza_oficial || p.numero_poliza || '', // Mismo número de póliza
            formatDateTimeForSheet(p.created_at), // Fecha de Solicitud (misma del titular)
            integrante.apellido || '', // Apellido Integrante
            integrante.nombre || '', // Nombre Integrante
            formatDateForSheet(integrante.fecha_nacimiento) || '', // Fecha Nacimiento Integrante
            integrante.nacionalidad || 'Argentina', // Nacionalidad Integrante
            integrante.tipo_documento || 'DNI', // Tipo Documento Integrante
            integrante.dni || integrante.nro_documento || '', // Nro Documento Integrante
            integrante.sexo || '', // Sexo Integrante
            integrante.estado_civil || '', // Estado Civil Integrante
            integrante.condicion_iva || '', // Condición IVA Integrante
            vinculoIntegrante, // Parentesco
            integrante.localidad || datosPersonales.localidad || '', // Localidad
            integrante.direccion || datosPersonales.direccion || '', // Calle
            integrante.numero || datosPersonales.numero || '', // Número
            datosPersonales.obra_social === 'Otra' ? (datosPersonales.obra_social_otra || '') : (datosPersonales.obra_social || ''), // Obra Social (heredada del titular)
            formatVigencia(datosPersonales.mes_ingreso), // Vigencia
            'Cober', // Convenio
            formatDateForSheet(datosPersonales.proximo_periodo_abonar) || '', // Próximo Período a Abonar
            formatDateTimeForSheet(p.created_at), // Fecha de Carga
            formatCurrency(preciosIntegrante.precio_base), // Precio Lista
            formatCurrency(preciosIntegrante.bonificacion), // Bonificación
            formatCurrency(preciosIntegrante.precio_final), // Diferencia a Pagar
            p.plan_nombre || '', // Plan Seleccionado
            enlacePolizaCompleta, // Enlace Póliza Completa
            enlacesIntegrante.dni_frente || '', // Enlace DNI Frente
            enlacesIntegrante.dni_dorso || '', // Enlace DNI Dorso
            enlacesIntegrante.recibo_sueldo || '', // Enlace Recibo Sueldo
            enlacesIntegrante.codem || '', // Enlace CODEM
            enlacesIntegrante.formulario_f152 || '', // Enlace Formulario F152
            enlacesIntegrante.formulario_f184 || '', // Enlace Formulario F184
            enlacesIntegrante.constancia_inscripcion || '', // Enlace Constancia Inscripción
            enlacesIntegrante.comprobante_pago_cuota || '', // Enlace Comprobantes Pago
            enlacesIntegrante.estudios_medicos || '' // Enlace Estudios Médicos
          ];

          filasAExportar.push(filaIntegrante);
        });
      }

      // Verificar si la póliza ya existe en el sheet (por número de póliza oficial)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: POLIZAS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!B:B`,
      });

      const idsExistentes = new Set((response.data.values || []).slice(1).map(r => String(r[0] || '')));
      const numPolizaOficial = p.numero_poliza_oficial || p.numero_poliza;

      if (idsExistentes.has(String(numPolizaOficial))) {
        // Ya existe, actualizar solo la primera fila (titular)
        console.log(`ℹ️ Póliza ${numPolizaOficial} ya existe en sheet, actualizando...`);
        await this.actualizarPolizaEnSheet(numPolizaOficial, filaTitular);
      } else {
        // No existe, agregar todas las filas (titular + integrantes)
        await sheets.spreadsheets.values.append({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A2`,
          valueInputOption: 'RAW',
          resource: { values: filasAExportar },
        });
        console.log(`✅ Póliza ${numPolizaOficial} con ${filasAExportar.length} fila(s) agregada al sheet exitosamente`);
      }

      return true;
    } catch (err) {
      console.error('❌ Error agregando póliza cerrada al sheet:', err.message);
      return false;
    }
  },

  /**
   * Actualizar una póliza existente en el sheet
   */
  async actualizarPolizaEnSheet(numPolizaOficial, filaTitular) {
    try {
      const sheets = await init();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: POLIZAS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!B:B`,
      });

      const rowIndex = (response.data.values || []).findIndex(r => String(r[0] || '') === String(numPolizaOficial));
      
      if (rowIndex !== -1) {
        const actualRow = rowIndex + 1;
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A${actualRow}:AI${actualRow}`,
          valueInputOption: 'RAW',
          resource: {
            values: [filaTitular],
          },
        });
        console.log(`✅ Póliza ${numPolizaOficial} actualizada en sheet (fila ${actualRow})`);
      }
    } catch (err) {
      console.error('Error actualizando póliza en sheet:', err.message);
    }
  },

  /**
   * Completar el ID de prospecto en las filas que ya existen, sin agregar filas nuevas.
   */
  async completarIdsProspectosExistentes() {
    try {
      const sheets = await init();
      await this.inicializarHoja();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: POLIZAS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:AJ`,
      });
      const filasExistentes = response.data.values || [];

      const [polizas] = await db.query(`
        SELECT p.prospecto_id, p.numero_poliza, p.numero_poliza_oficial, p.created_at, pl.nombre AS plan_nombre
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE p.prospecto_id IS NOT NULL
      `);

      const prospectoPorPoliza = new Map();
      const planPorPoliza = new Map();
      const fechaPorPoliza = new Map();
      polizas.forEach(poliza => {
        if (poliza.numero_poliza) {
          prospectoPorPoliza.set(String(poliza.numero_poliza).trim(), poliza.prospecto_id);
          planPorPoliza.set(String(poliza.numero_poliza).trim(), poliza.plan_nombre || '');
          fechaPorPoliza.set(String(poliza.numero_poliza).trim(), formatDateTimeForSheet(poliza.created_at));
        }
        if (poliza.numero_poliza_oficial) {
          prospectoPorPoliza.set(String(poliza.numero_poliza_oficial).trim(), poliza.prospecto_id);
          planPorPoliza.set(String(poliza.numero_poliza_oficial).trim(), poliza.plan_nombre || '');
          fechaPorPoliza.set(String(poliza.numero_poliza_oficial).trim(), formatDateTimeForSheet(poliza.created_at));
        }
      });

      const esFecha = valor => /^\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(String(valor || '').trim());
      let actualizadas = 0;
      const noEncontradas = new Set();

      const filasNormalizadas = filasExistentes.map(fila => {
        let numeroPoliza;
        let filaNormalizada;

        if (esFecha(fila[1])) {
          // Fila creada por una instancia anterior: A tenía la póliza y B la fecha.
          numeroPoliza = String(fila[0] || '').trim();
          filaNormalizada = ['', ...fila];
        } else if (esFecha(fila[3])) {
          // Fila exportada después de crear la columna: B tenía el ID y C la póliza.
          numeroPoliza = String(fila[2] || '').trim();
          filaNormalizada = ['', ...fila.slice(2)];
        } else {
          // Fila histórica: B contiene la póliza y C la fecha de solicitud.
          numeroPoliza = String(fila[1] || '').trim();
          filaNormalizada = [...fila];
        }

        const prospectoId = prospectoPorPoliza.get(numeroPoliza);
        filaNormalizada[0] = prospectoId || '';
        filaNormalizada[2] = fechaPorPoliza.get(numeroPoliza) || filaNormalizada[2] || '';
        filaNormalizada[20] = fechaPorPoliza.get(numeroPoliza) || filaNormalizada[20] || '';
        filaNormalizada[24] = planPorPoliza.get(numeroPoliza) || '';

        if (prospectoId) {
          actualizadas++;
        } else if (numeroPoliza) {
          noEncontradas.add(numeroPoliza);
        }

        return Array.from({ length: 35 }, (_, index) => filaNormalizada[index] || '');
      });

      if (filasNormalizadas.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A2:AI${filasNormalizadas.length + 1}`,
          valueInputOption: 'RAW',
          resource: { values: filasNormalizadas },
        });

        await sheets.spreadsheets.values.clear({
          spreadsheetId: POLIZAS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!AJ2:AJ${filasNormalizadas.length + 1}`,
        });
      }

      console.log(`✅ IDs de prospecto completados: ${actualizadas}/${filasExistentes.length}`);
      if (noEncontradas.size > 0) {
        console.warn(`⚠️ Pólizas sin coincidencia: ${Array.from(noEncontradas).join(', ')}`);
      }

      return {
        actualizadas,
        total: filasExistentes.length,
        noEncontradas: Array.from(noEncontradas),
      };
    } catch (err) {
      console.error('❌ Error completando IDs de prospectos existentes:', err.message);
      return { actualizadas: 0, total: 0, error: err.message };
    }
  },

  /**
   * Sincronizar todas las pólizas cerradas (útil para migración inicial)
   */
  async sincronizarTodasLasCerradas() {
    try {
      console.log('🔄 Iniciando sincronización de todas las pólizas con venta cerrada...');

      // Inicializar hoja con headers
      await this.inicializarHoja();

      // Obtener todas las pólizas con venta cerrada (antes 'cerrada', ahora 'venta_cerrada')
      const [polizas] = await db.query(`
        SELECT id FROM polizas WHERE estado IN ('venta_cerrada', 'cerrada') ORDER BY fecha_cambio_estado DESC
      `);

      console.log(`📋 Encontradas ${polizas.length} pólizas cerradas para sincronizar`);

      let exitosas = 0;
      let fallidas = 0;

      for (const poliza of polizas) {
        const resultado = await this.agregarPolizaCerrada(poliza.id);
        if (resultado) {
          exitosas++;
        } else {
          fallidas++;
        }
        
        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 1100));
      }

      console.log(`✅ Sincronización completada: ${exitosas} exitosas, ${fallidas} fallidas`);
      return { exitosas, fallidas, total: polizas.length };
    } catch (err) {
      console.error('❌ Error en sincronización masiva:', err.message);
      return { exitosas: 0, fallidas: 0, error: err.message };
    }
  }
};

module.exports = GoogleSheetsPolizasService;
