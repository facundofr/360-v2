const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

// ID por defecto (usada si GOOGLE_SHEETS_ID no está definido)
const DEFAULT_SPREADSHEET_ID = '17t4dxe-sKz4YTJHhbqmcidZsSWrzSiR024I_kyyqDw8';

let sheetsClient = null;
let SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || DEFAULT_SPREADSHEET_ID;

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

// Zona horaria de referencia: las fechas/horas en el Sheet siempre van en hora argentina.
// El contenedor corre en UTC, por eso NUNCA usar getHours()/getDate() sobre un Date "actual".
const SHEET_TIMEZONE = 'America/Argentina/Buenos_Aires';

function formatDateForSheet(d) {
  if (!d) return '';

  // Si es una fecha en formato DATE (YYYY-MM-DD), parsearla correctamente
  if (typeof d === 'string' && d.includes('-') && !d.includes(':')) {
    // Es un DATE, dividir y usar directamente
    const [yyyy, mm, dd] = d.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  // Si es un string DATETIME (YYYY-MM-DD HH:MM:SS de la BD), extraer la fecha literal
  if (typeof d === 'string') {
    const dateMatch = d.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      return `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`;
    }
  }

  // Es un Date (ej: new Date() para "ahora"): formatear en hora argentina
  const date = new Date(d);
  return date.toLocaleDateString('es-AR', {
    timeZone: SHEET_TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatTimeForSheet(d) {
  if (!d) return '';
  
  // Si es una cadena DATETIME (YYYY-MM-DD HH:MM:SS), parsearla correctamente
  if (typeof d === 'string') {
    // Intenta extraer HH:MM:SS si está en formato datetime
    const timeMatch = d.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
    }
  }
  
  // Es un Date (ej: new Date() para "ahora"): formatear en hora argentina
  const date = new Date(d);
  return date.toLocaleTimeString('es-AR', {
    timeZone: SHEET_TIMEZONE,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function formatDateTimeForSheet(d) {
  if (!d) return '';
  
  // Si es una cadena DATETIME (YYYY-MM-DD HH:MM:SS), extraer solo HH:MM:SS
  if (typeof d === 'string' && d.includes(':')) {
    const timeMatch = d.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
    }
  }
  
  // Es un Date (ej: new Date() para "ahora"): formatear en hora argentina
  const date = new Date(d);
  return date.toLocaleTimeString('es-AR', {
    timeZone: SHEET_TIMEZONE,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

const GoogleSheetsService = {
  init,

  async probarConexion() {
    const sheets = await init();
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    return { title: res.data.properties.title, url: res.data.spreadsheetUrl };
  },

  /**
   * Inicializa la hoja con headers
   */
  async inicializarHoja() {
    try {
      const sheets = await init();
      if (!SPREADSHEET_ID) {
        throw new Error('GOOGLE_SHEETS_ID no configurado');
      }

      const headers = [
        'ID',
        'Nombre',
        'Apellido',
        'Email',
        'Teléfono',
        'Localidad',
        'Edad',
        'Tipo Afiliación',
        'Estado',
        'Vendedor Asignado',
        'Fecha Registro',
        'Hora',
        'Fecha Asignación',
        'Origen',
        'Comentario',
        'Primer Mensaje (Fecha/Hora)'
      ];

      const sheetsData = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      let sheetId = null;
      
      for (const sheet of sheetsData.data.sheets) {
        if (sheet.properties.title === 'Prospectos') {
          sheetId = sheet.properties.sheetId;
          break;
        }
      }

      if (!sheetId) {
        const addSheetReq = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: 'Prospectos',
                  gridProperties: { rowCount: 2000, columnCount: 15 }
                }
              }
            }]
          }
        });
        sheetId = addSheetReq.data.replies[0].addSheet.properties.sheetId;
      }

      // Limpiar datos existentes (mantener headers)
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A2:P'
      });

      // Escribir headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A1:P1',
        valueInputOption: 'RAW',
        resource: {
          values: [headers],
        },
      });

      console.log('✅ Hoja "Prospectos" inicializada y limpiada');
      return true;
    } catch (err) {
      console.error('Error inicializando hoja:', err.message);
      return false;
    }
  },

  /**
   * Obtiene el primer mensaje enviado por el vendedor para cada prospecto
   * Retorna un Map: prospecto_id => fecha_timestamp
   */
  async obtenerPrimeirosMensajesPorProspectos(prospectoIds) {
    try {
      const [rows] = await db.query(`
        SELECT 
          p.id as prospecto_id,
          MIN(cm.created_at) as primer_mensaje_fecha
        FROM prospectos p
        LEFT JOIN chat_conversaciones_whatsapp ccw ON p.id = ccw.prospecto_id
        LEFT JOIN chat_mensajes cm ON ccw.id = cm.conversacion_id 
          AND cm.origen = 'vendedor'
        WHERE p.id IN (?)
        GROUP BY p.id
        ORDER BY p.id ASC
      `, [prospectoIds]);

      const mapa = new Map();
      for (const row of rows) {
        mapa.set(row.prospecto_id, row.primer_mensaje_fecha);
      }
      return mapa;
    } catch (err) {
      console.error('Error obteniendo primeros mensajes:', err.message);
      return new Map();
    }
  },

  /**
   * Agrega múltiples prospectos en un solo request (batch)
   */
  async agregarProspectosBatch(prospectoIds) {
    try {
      const sheets = await init();
      if (!SPREADSHEET_ID) {
        console.warn('GOOGLE_SHEETS_ID no configurado');
        return { success: false, error: 'GOOGLE_SHEETS_ID no configurado', agregados: 0, fallidos: prospectoIds.length };
      }

      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.correo,
          p.numero_contacto,
          p.localidad,
          p.edad,
          CASE 
            WHEN p.tipo_afiliacion_id = 1 THEN 'Particular/autónomo'
            WHEN p.tipo_afiliacion_id = 2 THEN 'Con recibo de sueldo'
            WHEN p.tipo_afiliacion_id = 3 THEN 'Monotributista'
            ELSE 'Sin datos'
          END as tipo_afiliacion,
          p.fecha_registro,
          p.fecha_hora_registro,
          COALESCE(a.estado, p.estado) AS estado,
          COALESCE(u.id, 0) as vendedor_id,
          COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Sin asignar') as vendedor_nombre,
          a.fecha_asignacion,
          a.comentario,
          p.origen
        FROM prospectos p
        LEFT JOIN asignaciones a ON a.id = (
          SELECT id FROM asignaciones
          WHERE id_prospecto = p.id
          ORDER BY fecha_asignacion DESC, id DESC
          LIMIT 1
        )
        LEFT JOIN users u ON a.id_vendedor = u.id
        WHERE p.id IN (?)
        ORDER BY p.fecha_registro ASC
      `, [prospectoIds]);

      if (!rows || rows.length === 0) {
        return { success: false, error: 'No se encontraron prospectos', agregados: 0, fallidos: prospectoIds.length };
      }

      // Obtener primeros mensajes para cada prospecto
      const primeirosMensajes = await this.obtenerPrimeirosMensajesPorProspectos(prospectoIds);

      // Obtener filas existentes en Google Sheets para evitar duplicados
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A:A',
      });

      const idsExistentes = new Set((response.data.values || []).slice(1).map(r => String(r[0] || '')));

      const values = [];
      let actualizados = 0;

      for (const p of rows) {
        // Prioridad: usar fecha_asignacion para obtener la hora (válida)
        // Solo usar fecha_hora_registro si fecha_asignacion no existe
        const fechaHora = p.fecha_asignacion || p.fecha_hora_registro;
        const fechaHoraFormateada = fechaHora ? formatDateTimeForSheet(fechaHora) : '';
        const origen = p.origen || 'Formulario Web';

        // Obtener primer mensaje del vendedor
        const primerMensajeFecha = primeirosMensajes.get(p.id);
        const primerMensajeFormato = primerMensajeFecha 
          ? formatDateForSheet(primerMensajeFecha) + ' ' + formatTimeForSheet(primerMensajeFecha)
          : '';

        const fila = [
          p.id,
          p.nombre || '',
          p.apellido || '',
          p.correo || '',
          p.numero_contacto || '',
          p.localidad || '',
          p.edad || '',
          p.tipo_afiliacion || '',
          p.estado || 'Lead',
          p.vendedor_nombre,
          formatDateForSheet(p.fecha_registro),
          fechaHoraFormateada,
          formatDateForSheet(p.fecha_asignacion),
          origen,
          p.comentario || '',
          primerMensajeFormato
        ];

        if (!idsExistentes.has(String(p.id))) {
          values.push(fila);
        } else {
          // Si ya existe, actualizar
          await this.actualizarProspectoEnSheet(p.id, fila);
          actualizados++;
        }
      }

      if (values.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Prospectos!A2',
          valueInputOption: 'USER_ENTERED',
          resource: { values },
        });
      }

      return { 
        success: true, 
        agregados: values.length, 
        actualizados: actualizados,
        fallidos: 0 
      };
    } catch (err) {
      console.error('Error agregando batch:', err.message);
      return { success: false, error: err.message, agregados: 0, fallidos: prospectoIds.length };
    }
  },

  async actualizarProspectoEnSheet(prospectoId, fila) {
    try {
      const sheets = await init();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A:A',
      });

      const rowIndex = (response.data.values || []).findIndex(r => String(r[0] || '') === String(prospectoId));
      
      console.log(`📊 actualizarProspectoEnSheet: Buscando prospecto ${prospectoId} - rowIndex=${rowIndex}`);
      
      if (rowIndex !== -1) {
        const actualRow = rowIndex + 1;
        
        console.log(`📊 Actualizando fila ${actualRow} con ${fila.length} columnas. Col P=${fila[15] || 'VACÍO'}`);
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Prospectos!A${actualRow}:P${actualRow}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [fila],
          },
        });
        
        console.log(`✅ Fila ${actualRow} actualizada exitosamente en Sheet`);
      } else {
        console.warn(`⚠️ Prospecto ${prospectoId} NO encontrado en Google Sheets (rowIndex=-1)`);
      }
    } catch (err) {
      console.error('Error actualizando prospecto:', err.message);
    }
  },

  /**
   * Agrega un prospecto por id (append row)
   * 
   * NOTAS SOBRE LAS FECHAS:
   * - p.fecha_registro: Fecha de ingreso del prospecto en la BD (tabla prospectos)
   * - p.fecha_asignacion: Fecha cuando se asignó a un vendedor (tabla asignaciones)
   * 
   * Si no hay asignación, fecha_asignacion será NULL
   */
  async agregarProspecto(prospectoId) {
    try {
      const sheets = await init();
      if (!SPREADSHEET_ID) {
        console.warn('GOOGLE_SHEETS_ID no configurado');
        return false;
      }

      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.correo,
          p.numero_contacto,
          p.localidad,
          p.edad,
          CASE 
            WHEN p.tipo_afiliacion_id = 1 THEN 'Particular/autónomo'
            WHEN p.tipo_afiliacion_id = 2 THEN 'Con recibo de sueldo'
            WHEN p.tipo_afiliacion_id = 3 THEN 'Monotributista'
            ELSE 'Sin datos'
          END as tipo_afiliacion,
          p.fecha_registro,
          p.fecha_hora_registro,
          COALESCE(a.estado, p.estado) AS estado,
          COALESCE(u.id, 0) as vendedor_id,
          COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Sin asignar') as vendedor_nombre,
          a.fecha_asignacion,
          a.comentario,
          p.origen
        FROM prospectos p
        LEFT JOIN asignaciones a ON a.id = (
          SELECT id FROM asignaciones
          WHERE id_prospecto = p.id
          ORDER BY fecha_asignacion DESC, id DESC
          LIMIT 1
        )
        LEFT JOIN users u ON a.id_vendedor = u.id
        WHERE p.id = ?
      `, [prospectoId]);

      if (!rows || rows.length === 0) return false;
      const p = rows[0];

      const fechaHora = p.fecha_asignacion || p.fecha_hora_registro;
      const fechaHoraFormateada = fechaHora ? formatDateTimeForSheet(fechaHora) : '';
      const origen = p.origen || 'Formulario Web';

      // Obtener primer mensaje del vendedor
      const primeirosMensajes = await this.obtenerPrimeirosMensajesPorProspectos([prospectoId]);
      const primerMensajeFecha = primeirosMensajes.get(prospectoId);
      const primerMensajeFormato = primerMensajeFecha 
        ? formatDateForSheet(primerMensajeFecha) + ' ' + formatTimeForSheet(primerMensajeFecha)
        : '';

      const fila = [
        p.id,
        p.nombre || '',
        p.apellido || '',
        p.correo || '',
        p.numero_contacto || '',
        p.localidad || '',
        p.edad || '',
        p.tipo_afiliacion || '',
        p.estado || 'Lead',
        p.vendedor_nombre,
        formatDateForSheet(p.fecha_registro),
        fechaHoraFormateada,
        formatDateForSheet(p.fecha_asignacion),
        origen,
        p.comentario || '',
        primerMensajeFormato
      ];

      // Verificar si ya existe
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A:A',
      });

      const idsExistentes = new Set((response.data.values || []).slice(1).map(r => String(r[0] || '')));

      if (idsExistentes.has(String(prospectoId))) {
        // Ya existe, actualizar
        await this.actualizarProspectoEnSheet(prospectoId, fila);
      } else {
        // No existe, agregar
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Prospectos!A2',
          valueInputOption: 'USER_ENTERED',
          resource: { values: [fila] },
        });
      }

      return true;
    } catch (err) {
      console.error('Error agregando prospecto:', err.message);
      return false;
    }
  },

  /**
   * Actualiza la asignación/estado de un prospecto buscando por ID en la columna A
   */
  async actualizarAsignacionEnSheet(prospectoId) {
    try {
      const sheets = await init();
      if (!SPREADSHEET_ID) {
        console.warn('GOOGLE_SHEETS_ID no configurado');
        return false;
      }

      const [resRows] = await db.query(`
        SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.correo,
          p.numero_contacto,
          p.localidad,
          p.edad,
          CASE 
            WHEN p.tipo_afiliacion_id = 1 THEN 'Particular/autónomo'
            WHEN p.tipo_afiliacion_id = 2 THEN 'Con recibo de sueldo'
            WHEN p.tipo_afiliacion_id = 3 THEN 'Monotributista'
            ELSE 'Sin datos'
          END as tipo_afiliacion,
          p.fecha_registro,
          p.fecha_hora_registro,
          COALESCE(a.estado, p.estado) AS estado,
          COALESCE(u.id, 0) as vendedor_id,
          COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Sin asignar') as vendedor_nombre,
          a.fecha_asignacion,
          a.comentario,
          p.origen
        FROM prospectos p
        LEFT JOIN asignaciones a ON a.id = (
          SELECT id FROM asignaciones
          WHERE id_prospecto = p.id
          ORDER BY fecha_asignacion DESC, id DESC
          LIMIT 1
        )
        LEFT JOIN users u ON a.id_vendedor = u.id
        WHERE p.id = ?
      `, [prospectoId]);

      if (!resRows || resRows.length === 0) return false;
      const p = resRows[0];

      const fechaHora = p.fecha_asignacion || p.fecha_hora_registro;
      const fechaHoraFormateada = fechaHora ? formatDateTimeForSheet(fechaHora) : '';
      const origen = p.origen || 'Formulario Web';

      // Obtener primer mensaje del vendedor
      const primeirosMensajes = await this.obtenerPrimeirosMensajesPorProspectos([prospectoId]);
      const primerMensajeFecha = primeirosMensajes.get(prospectoId);
      const primerMensajeFormato = primerMensajeFecha 
        ? formatDateForSheet(primerMensajeFecha) + ' ' + formatTimeForSheet(primerMensajeFecha)
        : '';

      const fila = [
        p.id,
        p.nombre || '',
        p.apellido || '',
        p.correo || '',
        p.numero_contacto || '',
        p.localidad || '',
        p.edad || '',
        p.tipo_afiliacion || '',
        p.estado || 'Lead',
        p.vendedor_nombre,
        formatDateForSheet(p.fecha_registro),
        fechaHoraFormateada,
        formatDateForSheet(p.fecha_asignacion),
        origen,
        p.comentario || '',
        primerMensajeFormato
      ];

      await this.actualizarProspectoEnSheet(prospectoId, fila);
      return true;
    } catch (err) {
      console.error('Error actualizando asignación:', err.message);
      return false;
    }
  },

  /**
   * Actualiza SOLO la columna P (Primer Mensaje) con la fecha/hora actual
   * Se usa cuando se envía el primer contacto WhatsApp
   */
  async actualizarPrimerMensajeEnSheet(prospectoId, fechaHora = null) {
    try {
      const sheets = await init();
      if (!SPREADSHEET_ID) {
        console.warn('GOOGLE_SHEETS_ID no configurado');
        return false;
      }

      // Obtener la fila del prospecto
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A:P',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(r => String(r[0] || '') === String(prospectoId));
      
      console.log(`📊 actualizarPrimerMensajeEnSheet: Buscando prospecto ${prospectoId} - rowIndex=${rowIndex}`);
      
      if (rowIndex === -1) {
        console.warn(`⚠️ Prospecto ${prospectoId} NO encontrado en Google Sheets`);
        return false;
      }

      const actualRow = rowIndex + 1;
      const fila = rows[rowIndex] || [];

      // No pisar la fecha si ya hay una cargada: debe quedar siempre la primera vez que se contactó
      if (fila[15]) {
        console.log(`📊 Columna P ya tiene fecha (${fila[15]}) para prospecto ${prospectoId}, no se sobrescribe`);
        return true;
      }

      // Usar la fecha/hora proporcionada o la actual
      const ahora = fechaHora || new Date();
      const fechaFormateada = formatDateForSheet(ahora) + ' ' + formatTimeForSheet(ahora);

      // Actualizar solo la columna P (índice 15)
      fila[15] = fechaFormateada;

      console.log(`📊 Actualizando fila ${actualRow} - Columna P con fecha: ${fechaFormateada}`);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Prospectos!A${actualRow}:P${actualRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [fila],
        },
      });
      
      console.log(`✅ Columna P actualizada exitosamente en fila ${actualRow}`);
      return true;
    } catch (err) {
      console.error('Error actualizando primer mensaje en Sheet:', err.message);
      return false;
    }
  },

  /**
   * Actualiza SOLO la columna Q (Registro de Llamada Telefónica) con la fecha/hora actual
   * Se usa cuando se registra una llamada telefónica
   */
  async actualizarRegistroLlamadaEnSheet(prospectoId, fechaHora = null) {
    try {
      const sheets = await init();
      if (!SPREADSHEET_ID) {
        console.warn('GOOGLE_SHEETS_ID no configurado');
        return false;
      }

      // Obtener la fila del prospecto
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Prospectos!A:Q',
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(r => String(r[0] || '') === String(prospectoId));
      
      console.log(`📊 actualizarRegistroLlamadaEnSheet: Buscando prospecto ${prospectoId} - rowIndex=${rowIndex}`);
      
      if (rowIndex === -1) {
        console.warn(`⚠️ Prospecto ${prospectoId} NO encontrado en Google Sheets`);
        return false;
      }

      const actualRow = rowIndex + 1;
      const fila = rows[rowIndex] || [];

      // No pisar la fecha si ya hay una cargada: debe quedar siempre la primera llamada, no la última
      if (fila[16]) {
        console.log(`📊 Columna Q ya tiene fecha (${fila[16]}) para prospecto ${prospectoId}, no se sobrescribe`);
        return true;
      }

      // Usar la fecha/hora proporcionada o la actual
      const ahora = fechaHora || new Date();
      const fechaFormateada = formatDateForSheet(ahora) + ' ' + formatTimeForSheet(ahora);

      // Actualizar solo la columna Q (índice 16)
      fila[16] = fechaFormateada;

      console.log(`📊 Actualizando fila ${actualRow} - Columna Q con fecha: ${fechaFormateada}`);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Prospectos!A${actualRow}:Q${actualRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [fila],
        },
      });
      
      console.log(`✅ Columna Q actualizada exitosamente en fila ${actualRow}`);
      return true;
    } catch (err) {
      console.error('Error actualizando registro de llamada en Sheet:', err.message);
      return false;
    }
  }
};

module.exports = GoogleSheetsService;
