/**
 * Controller para manejar envío de pólizas a VaFirma
 * Integra conversión a PDF y envío a firma
 */

const { nombreParaFirma } = require('../utils/nombreProspecto');

// Cargar el servicio de forma lazy para evitar problemas con PM2
let vaFirmaService;
const getVaFirmaService = () => {
  if (!vaFirmaService) {
    vaFirmaService = require('../services/vaFirmaService');
  }
  return vaFirmaService;
};

const db = require('../config/db');
const PolizaPDFController = require('./poliza/polizaPDFController');
const PolizaModel = require('../models/poliza/polizaModel');
const Historial = require('../models/vendedor/historialModel');

// 🔄 Sincroniza el estado de asignaciones (vista del vendedor) con los eventos del flujo de firma
async function sincronizarEstadoAsignacionPorFirma(polizaId, nuevoEstadoAsignacion, accion, descripcion) {
  try {
    const [rows] = await db.query('SELECT prospecto_id, created_by FROM polizas WHERE id = ?', [polizaId]);
    const poliza = rows && rows[0];
    if (!poliza || !poliza.prospecto_id || !poliza.created_by) return;

    const fechaHoraTextoFirma = new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const comentarioFirma = `${descripcion} el ${fechaHoraTextoFirma}`;

    await db.query(
      `UPDATE asignaciones SET estado = ?, comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
      [nuevoEstadoAsignacion, comentarioFirma, poliza.prospecto_id, poliza.created_by]
    );
    await Historial.registrarAccion(poliza.prospecto_id, poliza.created_by, accion, descripcion);
    console.log(`✅ Estado de asignación actualizado a '${nuevoEstadoAsignacion}' para prospecto ${poliza.prospecto_id}`);

    // Sincronizar estado en Google Sheets
    try {
      const GoogleSheetsService = require('../services/googleSheetsService');
      await GoogleSheetsService.actualizarAsignacionEnSheet(poliza.prospecto_id);
      console.log(`📊 Estado '${nuevoEstadoAsignacion}' sincronizado en Google Sheets para prospecto ${poliza.prospecto_id}`);
    } catch (errSheet) {
      console.error('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
    }
  } catch (err) {
    console.error('⚠️ Error sincronizando estado de asignación desde el flujo de firma:', err.message);
  }
}

/**
 * Enviar póliza a firma VaFirma
 * POST /api/vafirma/enviar-poliza
 * 
 * Coordenadas de firma pueden venir en el body o se usarán las estándar
 */
const enviarPolizaFirma = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      pdfBase64,
      fileName,
      signerName: signerNameCrudo,
      signerEmail,
      emailSubject,
      emailMessage,
      dni,
      // whatsapp, // 🔕 Deshabilitado: solo email
      polizaId,
      requireBiometric = true,
      signatureType = 'Simple',
      signaturePageIndex,    // Opcional: coordenadas personalizadas
      signaturePageX,        // Opcional: coordenadas personalizadas
      signaturePageY         // Opcional: coordenadas personalizadas
    } = req.body;

    // El nombre del firmante llega del cliente, y para los prospectos de alta en frío
    // por WhatsApp arrastra el ProfileName crudo (hubo firmantes '💖' en la base). Se
    // sanea acá y no solo en el frontend porque este endpoint es el que habla con VaFirma.
    const signerName = nombreParaFirma(signerNameCrudo, '');

    // Validar datos requeridos
    if (!pdfBase64 || !fileName || !signerNameCrudo || !signerEmail || !emailSubject) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos (pdfBase64, fileName, signerName, signerEmail, emailSubject)'
      });
    }

    if (!polizaId) {
      return res.status(400).json({
        success: false,
        error: 'polizaId es requerido para registrar el envío'
      });
    }

    console.log(`📧 Iniciando envío de póliza #${polizaId} a VaFirma`);
    // console.log(`📱 WhatsApp recibido del frontend: "${whatsapp}"`);

    // ✅ OBTENER DATOS DE LA PÓLIZA PARA CALCULAR COORDENADAS
    let polizaData = null;
    try {
      polizaData = await PolizaModel.obtenerCompleta(polizaId);
      if (polizaData) {
        // Parsear integrantes si vienen como string
        if (typeof polizaData.integrantes === 'string') {
          polizaData.integrantes = JSON.parse(polizaData.integrantes);
        }
        // Parsear declaración_salud si viene como string
        if (typeof polizaData.declaracion_salud === 'string') {
          polizaData.declaracion_salud = JSON.parse(polizaData.declaracion_salud);
        }
      }
    } catch (error) {
      console.log('⚠️ No se pudo obtener datos de póliza para coordenadas:', error.message);
    }

    // ✅ OBTENER COORDENADAS DE FIRMA (estándar o personalizadas)
    const coordenadasEstandar = PolizaPDFController.obtenerCoordenadasFirma(polizaData);
    const pageIndex = signaturePageIndex !== undefined ? signaturePageIndex : coordenadasEstandar.pageIndex;
    const pageX = signaturePageX !== undefined ? signaturePageX : coordenadasEstandar.x;
    const pageY = signaturePageY !== undefined ? signaturePageY : coordenadasEstandar.y;

    console.log(`📍 Usando coordenadas de firma: página=${pageIndex}, x=${pageX}, y=${pageY}`);

    // Solicitar firma a VaFirma
    const docOriginId = `COBER360-POLIZA-${polizaId}-${Date.now()}`;
    const resultadoVaFirma = await getVaFirmaService().solicitarFirma({
      pdfBase64,
      fileName,
      signerName,
      signerEmail,
      emailSubject,
      emailMessage,
      dni,
      // whatsapp: undefined, // No enviar por WhatsApp
      requireBiometric,
      signatureType: 'Simple',
      signaturePageIndex: pageIndex,
      signaturePageX: pageX,
      signaturePageY: pageY,
      docOriginId,
      callbackUrl: `${process.env.API_BASE_URL || process.env.BASE_URL + '/api' || 'http://localhost:4001/api'}/vafirma/webhook`
    });

    if (!resultadoVaFirma.success) {
      console.error('❌ Error en VaFirma:', resultadoVaFirma.error);
      return res.status(500).json({
        success: false,
        error: 'No se pudo enviar la póliza a VaFirma',
        details: resultadoVaFirma.error
      });
    }

    console.log('🔍 Respuesta completa de VaFirma:', JSON.stringify(resultadoVaFirma, null, 2));

    // Extraer docUUID
    const docUUID = resultadoVaFirma.data[0]?.docUUID;
    const linkFirma = resultadoVaFirma.data[0]?.link;

    console.log(`📋 Datos extraídos - docUUID: ${docUUID}, linkFirma: ${linkFirma}`);

    if (!docUUID) {
      console.error('❌ No se recibió docUUID');
      return res.status(500).json({
        success: false,
        error: 'Error: No se recibió referencia de VaFirma'
      });
    }

    // Registrar envío en base de datos
    try {
      console.log(`💾 Intentando guardar en BD: polizaId=${polizaId}, docUUID=${docUUID}`);
      // 🔒 Política de reenvío segura: NO borrar historial.
      // En su lugar, expirar solicitudes previas pendientes para esta póliza.
      await db.query(
        `UPDATE polizas_vafirma_envios
         SET estado_firma = 'expired', actualizado_en = NOW()
         WHERE poliza_id = ? AND TRIM(LOWER(estado_firma)) = 'pending'`,
        [polizaId]
      );
      
      const query = `
        INSERT INTO polizas_vafirma_envios 
        (poliza_id, doc_uuid, doc_origin_id, estado_firma, email_firmante, telefono_firmante, 
         requiere_biometria, tipo_firma, enviado_en, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        ON DUPLICATE KEY UPDATE
        doc_uuid = VALUES(doc_uuid),
        doc_origin_id = VALUES(doc_origin_id),
        estado_firma = 'pending',
        enviado_en = NOW(),
        intentos = intentos + 1
      `;

      const result = await db.query(query, [
        polizaId,
        docUUID,
        docOriginId,
        'pending',
        signerEmail,
        null, // Solo email
        requireBiometric ? 1 : 0,
        signatureType,
        userId
      ]);

      console.log(`✅ Envío registrado en BD: polizaId=${polizaId}, docUUID=${docUUID}`);
      console.log(`📊 Resultado BD:`, { affectedRows: result.affectedRows, insertId: result.insertId });

      // 🔄 Actualizar estado en asignaciones a 'Póliza pendiente a firma'
      await sincronizarEstadoAsignacionPorFirma(
        polizaId,
        'Póliza pendiente a firma',
        'poliza_enviada_firmar',
        `Póliza enviada a firmar a ${signerEmail}`
      );
    } catch (dbErr) {
      console.error('❌ Error al registrar en BD:', dbErr.message);
      console.error('Stack:', dbErr.stack);
      // No fallar la operación si la BD falla
    }

    // Retornar respuesta exitosa
    return res.json({
      success: true,
      message: 'Póliza enviada a firma exitosamente',
      data: {
        docUUID,
        linkFirma,
        polizaId,
        emailFirmante: signerEmail,
        requiereBiometria: requireBiometric,
        tipoFirma: signatureType,
        coordenadasFirma: { pageIndex, pageX, pageY },
        enviado: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error en enviarPolizaFirma:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al enviar póliza a firma'
    });
  }
};

/**
 * Consultar estado de firma de una póliza
 * GET /api/vafirma/estado/:polizaId
 */
const consultarEstadoFirma = async (req, res) => {
  try {
    const { polizaId } = req.params;

    // Obtener estado agregado y elegir docUUID representativo
    const [aggRows] = await db.query(
      `SELECT 
        MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed') THEN 1 ELSE 0 END) AS any_signed,
        MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('pending') THEN 1 ELSE 0 END) AS any_pending
       FROM polizas_vafirma_envios WHERE poliza_id = ?`,
      [polizaId]
    );

    const anySigned = aggRows?.[0]?.any_signed === 1;
    const anyPending = aggRows?.[0]?.any_pending === 1;

    // Elegir el doc de referencia: último firmado > último pendiente > último envío
    let pickQuery = '';
    if (anySigned) {
      pickQuery = `SELECT doc_uuid, estado_firma, email_firmante, requiere_biometria
                   FROM polizas_vafirma_envios
                   WHERE poliza_id = ? AND TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed')
                   ORDER BY firmado_en DESC, enviado_en DESC
                   LIMIT 1`;
    } else if (anyPending) {
      pickQuery = `SELECT doc_uuid, estado_firma, email_firmante, requiere_biometria
                   FROM polizas_vafirma_envios
                   WHERE poliza_id = ? AND TRIM(LOWER(estado_firma)) IN ('pending')
                   ORDER BY enviado_en DESC
                   LIMIT 1`;
    } else {
      pickQuery = `SELECT doc_uuid, estado_firma, email_firmante, requiere_biometria
                   FROM polizas_vafirma_envios
                   WHERE poliza_id = ?
                   ORDER BY enviado_en DESC
                   LIMIT 1`;
    }

    const [rows] = await db.query(pickQuery, [polizaId]);
    const registro = rows && rows.length > 0 ? rows[0] : null;

    if (!registro || !registro.doc_uuid) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró registro de envío para esta póliza'
      });
    }

    const estadoLocalAgregado = anySigned ? 'signed' : (anyPending ? 'pending' : registro.estado_firma || null);

    console.log(`🔍 Consultando estado de póliza ${polizaId} - docUUID: ${registro.doc_uuid}, estado agregado: ${estadoLocalAgregado}`);

    // Consultar estado en VaFirma (opcional, no bloquea si falla)
    const estado = await getVaFirmaService().consultarEstado(registro.doc_uuid);

    console.log(`📡 Respuesta VaFirma:`, { success: estado.success, data: estado.data });

    // 🔄 AUTO-ACTUALIZACIÓN: Si VaFirma retorna un estado diferente, actualizar BD
    let estadoActualizado = estadoLocalAgregado;
    
    if (estado.success && estado.data) {
      // Extraer estado de VaFirma (puede estar en diferentes campos)
      let estadoVaFirma = null;
      
      if (typeof estado.data === 'string') {
        estadoVaFirma = estado.data;
      } else if (estado.data.status) {
        estadoVaFirma = estado.data.status;
      } else if (estado.data.state) {
        estadoVaFirma = estado.data.state;
      } else if (estado.data.estadoLocal) {
        estadoVaFirma = estado.data.estadoLocal;
      }
      
      console.log(`📡 Estado retornado por VaFirma (crudo):`, JSON.stringify(estado.data));
      console.log(`📡 Estado parseado:`, estadoVaFirma);
      
      if (estadoVaFirma) {
        // Mapear estados de VaFirma a nuestro formato
        // Soportar múltiples variantes: "SIGNED", "signed", "Signed", etc.
        const mapeoEstados = {
          'SIGNED': 'signed',
          'signed': 'signed',
          'Signed': 'signed',
          'firmado': 'signed',
          'FIRMADO': 'signed',
          'completed': 'signed',
          'COMPLETED': 'signed',
          'PENDING': 'pending',
          'pending': 'pending',
          'Pending': 'pending',
          'REJECTED': 'rejected',
          'rejected': 'rejected',
          'Rejected': 'rejected',
          'EXPIRED': 'expired',
          'expired': 'expired',
          'Expired': 'expired'
        };
        
        const nuevoEstado = mapeoEstados[estadoVaFirma] || estadoVaFirma.toLowerCase();
        
        console.log(`🔄 Estado mapeado: ${estadoVaFirma} → ${nuevoEstado} (BD agregado actual: ${estadoLocalAgregado})`);
        
        // Si el estado cambió, actualizar BD
        if (nuevoEstado !== estadoLocalAgregado) {
          try {
            const updateQuery = `
              UPDATE polizas_vafirma_envios 
              SET estado_firma = ?, 
                  actualizado_en = NOW(),
                  firmado_en = CASE WHEN ? = 'signed' THEN NOW() ELSE firmado_en END
              WHERE poliza_id = ? AND doc_uuid = ?
            `;
            
            const [updateResult] = await db.query(updateQuery, [nuevoEstado, nuevoEstado, polizaId, registro.doc_uuid]);
            
            console.log(`✅ Estado actualizado en BD: poliza ${polizaId} - ${registro.estado_firma} → ${nuevoEstado} (affected: ${updateResult.affectedRows})`);
            estadoActualizado = nuevoEstado;

            // 🔄 Si quedó firmada, sincronizar el estado del prospecto en asignaciones
            if (nuevoEstado === 'signed') {
              await sincronizarEstadoAsignacionPorFirma(
                polizaId,
                'Póliza firmada',
                'poliza_firmada',
                'El cliente firmó la póliza'
              );
            }
          } catch (updateErr) {
            console.error('⚠️ Error al actualizar estado en BD:', updateErr.message);
          }
        } else {
          console.log(`⏸️ Estado sin cambios: sigue siendo "${estadoActualizado}"`);
        }
      }
    } else if (!estado.success) {
      console.warn(`⚠️ VaFirma no retornó estado válido:`, estado.error);
    }

    // ✅ CAMBIO: Siempre retornar el estado local, incluso si VaFirma falla
    // Esto permite que el frontend muestre el badge basado en la BD local
    return res.json({
      success: true,
      data: {
        polizaId,
        docUUID: registro.doc_uuid,
        estadoLocal: estadoActualizado,
        estadoVaFirma: estado.success ? estado.data : null,
        emailFirmante: registro.email_firmante,
        requiereBiometria: registro.requiere_biometria,
        // ✅ Indicar si hubo error al consultar VaFirma
        errorVaFirma: !estado.success ? estado.error : null
      }
    });

  } catch (error) {
    console.error('❌ Error en consultarEstadoFirma:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Descargar póliza firmada
 * GET /api/vafirma/descargar-firmada/:polizaId
 */
const descargarPolizaFirmada = async (req, res) => {
  try {
    const { polizaId } = req.params;
    console.log(`📥 Solicitando descarga de póliza ${polizaId}`);

    // Elegir el último documento firmado (si existe)
    const [signedRows] = await db.query(
      `SELECT doc_uuid, estado_firma
       FROM polizas_vafirma_envios
       WHERE poliza_id = ? AND TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed')
       ORDER BY firmado_en DESC, enviado_en DESC
       LIMIT 1`,
      [polizaId]
    );

    const registro = signedRows && signedRows.length > 0 ? signedRows[0] : null;

    if (!registro || !registro.doc_uuid) {
      console.log(`⚠️ No hay documentos firmados para póliza ${polizaId}`);
      return res.status(400).json({
        success: false,
        error: 'La póliza aún no ha sido firmada'
      });
    }

    console.log(`📋 DocUUID firmado: ${registro.doc_uuid}`);

    // Descargar de VaFirma
    console.log(`📥 Descargando PDF de VaFirma para docUUID: ${registro.doc_uuid}`);
    const resultado = await getVaFirmaService().descargarDocumento(registro.doc_uuid);

    if (!resultado.success) {
      console.error(`❌ Error en descarga de VaFirma:`, resultado.error);
      return res.status(500).json({
        success: false,
        error: 'Error al descargar documento firmado',
        details: resultado.error
      });
    }

    // Verificar que tenemos datos
    const pdfBuffer = resultado.data;
    console.log(`✅ PDF recibido, tamaño: ${pdfBuffer.length} bytes`);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error(`❌ Buffer vacío recibido de VaFirma`);
      return res.status(500).json({
        success: false,
        error: 'Error: PDF vacío recibido de VaFirma'
      });
    }

    // Devolver el PDF binary
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Poliza_${polizaId}_Firmada.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log(`📤 Enviando PDF de ${pdfBuffer.length} bytes al cliente`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error en descargarPolizaFirmada:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Webhook para recibir notificaciones de VaFirma
 * POST /api/vafirma/webhook
 */
const webhookVaFirma = async (req, res) => {
  try {
    // Log completo del payload para diagnóstico
    console.log(`📬 Webhook VaFirma recibido - Body:`, JSON.stringify(req.body, null, 2));

    const docUUID = req.body.docUUID || req.body.doc_uuid;
    const docOriginId = req.body.docOriginId || req.body.doc_origin_id;
    const status = req.body.status;
    const signed_at = req.body.signed_at || req.body.signedAt;

    console.log(`📬 Webhook parseado: docUUID=${docUUID}, docOriginId=${docOriginId}, status=${status}`);

    if ((!docUUID && !docOriginId) || !status) {
      console.warn('⚠️ Webhook recibido con datos incompletos:', req.body);
      return res.status(200).json({ error: 'Datos incompletos', received: req.body });
    }

    // Mapeo de estados documentados por VaFirma a estados internos
    const STATUS_MAP = {
      'FIRMADO':      'signed',
      'RECHAZADO':    'rejected',
      'APROBADO':     'approved',
      'NO_APROBADO':  'not_approved',
      // compatibilidad con valores legacy
      'signed':       'signed',
      'rejected':     'rejected',
      'completed':    'signed',
      'firmado':      'signed',
    };
    const estadoNormalizado = STATUS_MAP[status] || status.toLowerCase();
    const esFirmado = estadoNormalizado === 'signed';
    const esRechazado = estadoNormalizado === 'rejected';

    // Buscar el registro: primero por docUUID, luego por docOriginId
    const whereClause = docUUID ? 'doc_uuid = ?' : 'doc_origin_id = ?';
    const whereParam = docUUID || docOriginId;

    const updateQuery = `
      UPDATE polizas_vafirma_envios
      SET estado_firma = ?,
          actualizado_en = NOW(),
          firmado_en = CASE WHEN ? = 'signed' THEN COALESCE(?, NOW()) ELSE firmado_en END
      WHERE ${whereClause}
    `;

    const [result] = await db.query(updateQuery, [
      estadoNormalizado,
      estadoNormalizado,
      signed_at || null,
      whereParam
    ]);

    console.log(`✅ Estado actualizado a '${estadoNormalizado}' (affectedRows: ${result?.affectedRows})`);

    // Sincronizar asignaciones según el estado
    if (esFirmado || esRechazado) {
      const [envioRows] = await db.query(
        `SELECT poliza_id FROM polizas_vafirma_envios WHERE ${whereClause}`,
        [whereParam]
      );
      const polizaId = envioRows?.[0]?.poliza_id;
      if (polizaId) {
        if (esFirmado) {
          await sincronizarEstadoAsignacionPorFirma(
            polizaId, 'Póliza firmada', 'poliza_firmada', 'El cliente firmó la póliza'
          );
        } else {
          await sincronizarEstadoAsignacionPorFirma(
            polizaId, 'Póliza rechazada', 'poliza_rechazada', 'El cliente rechazó la firma'
          );
        }
        // Notificar en tiempo real a los clientes suscritos a esa póliza
        try {
          const activeUsersWS = require('../services/activeUsersWebSocket');
          activeUsersWS.emitFirmaActualizada(polizaId, estadoNormalizado);
        } catch (e) {
          console.warn('⚠️ No se pudo emitir evento WebSocket:', e.message);
        }
      }
    }

    return res.json({ success: true, message: 'Webhook procesado', estadoNormalizado });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Eliminar solicitud de firma (BD) - Para reenviar a firmar
 * DELETE /api/vafirma/solicitud/:polizaId
 */
const eliminarSolicitudFirma = async (req, res) => {
  try {
    const { polizaId } = req.params;

    if (!polizaId) {
      return res.status(400).json({
        success: false,
        error: 'Falta polizaId'
      });
    }

    // Seguridad: si ya hay alguna firmada, no permitir borrar historial
    const [agg] = await db.query(
      `SELECT 
         MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('signed','firmado','completed') THEN 1 ELSE 0 END) AS any_signed,
         MAX(CASE WHEN TRIM(LOWER(estado_firma)) IN ('pending') THEN 1 ELSE 0 END) AS any_pending
       FROM polizas_vafirma_envios WHERE poliza_id = ?`,
      [polizaId]
    );

    const anySigned = agg?.[0]?.any_signed === 1;

    if (anySigned) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un documento firmado para esta póliza. Por seguridad no se eliminan los registros.'
      });
    }

    // En lugar de borrar, marcar como expiradas las pendientes (preserva historial)
    const [upd] = await db.query(
      `UPDATE polizas_vafirma_envios
       SET estado_firma = 'expired', actualizado_en = NOW()
       WHERE poliza_id = ? AND TRIM(LOWER(estado_firma)) = 'pending'`,
      [polizaId]
    );

    console.log(`✅ Solicitudes pendientes marcadas como expiradas (affected: ${upd.affectedRows}).`);

    return res.json({
      success: true,
      message: 'Solicitudes pendientes marcadas como expiradas. Ahora puedes reenviar a firma sin borrar historial.'
    });
  } catch (error) {
    console.error('❌ Error al eliminar solicitud:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al eliminar solicitud de firma'
    });
  }
};

/**
 * Eliminar documento firmado de VaFirma + Solicitud en BD
 * DELETE /api/vafirma/documento-firmado/:polizaId
 * 
 * Query params: docUUID o docOriginId (uno de los dos)
 */
const eliminarDocumentoFirmado = async (req, res) => {
  try {
    const { polizaId } = req.params;
    const { docUUID, docOriginId } = req.query;

    if (!polizaId) {
      return res.status(400).json({
        success: false,
        error: 'Falta polizaId'
      });
    }

    if (!docUUID && !docOriginId) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar docUUID o docOriginId'
      });
    }

    console.log(`🗑️  Iniciando eliminación de documento firmado para póliza ${polizaId}`);
    console.log(`   docUUID: ${docUUID}, docOriginId: ${docOriginId}`);

    // 1️⃣ Obtener datos de BD
    const query = `
      SELECT id, doc_uuid, estado_firma 
      FROM polizas_vafirma_envios 
      WHERE poliza_id = ?
      ORDER BY enviado_en DESC 
      LIMIT 1
    `;

    const [rows] = await db.query(query, [polizaId]);
    const registro = rows && rows.length > 0 ? rows[0] : null;

    if (!registro) {
      return res.status(404).json({
        success: false,
        error: 'No hay registro de firma para esta póliza'
      });
    }

    // Usar el docUUID de la query o el del BD
    const docUUIDFinal = docUUID || registro.doc_uuid;

    if (!docUUIDFinal) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró docUUID para esta póliza'
      });
    }

    // 2️⃣ Llamar a VAFirma para eliminar documento
    let vaFirmaEliminado = false;
    let mensajeVaFirma = '';

    try {
      const vaFirmaService = getVaFirmaService();
      const respuesta = await vaFirmaService.eliminarDocumento(docUUIDFinal, docOriginId);

      if (respuesta.success) {
        vaFirmaEliminado = true;
        mensajeVaFirma = '✅ Documento eliminado de VAFirma';
        console.log(`${mensajeVaFirma}:`, respuesta);
      } else {
        mensajeVaFirma = `⚠️  No se pudo eliminar de VAFirma: ${respuesta.error}`;
        console.log(mensajeVaFirma);
      }
    } catch (vaFirmaErr) {
      mensajeVaFirma = `⚠️  Error consultando VAFirma: ${vaFirmaErr.message}`;
      console.error(mensajeVaFirma);
      // No fallar si VAFirma falla, continuar con BD
    }

    // 3️⃣ Limpiar BD (eliminar solicitud y documentos relacionados)
    try {
      await db.query(
        'DELETE FROM polizas_vafirma_envios WHERE poliza_id = ?',
        [polizaId]
      );
      console.log(`✅ Registro eliminado de polizas_vafirma_envios`);

      // Opcional: Limpiar documentos si hay tabla de documentos
      // await db.query('DELETE FROM documentos WHERE poliza_id = ? AND tipo_documento = ?', [polizaId, 'vafirma']);
    } catch (dbErr) {
      console.error('❌ Error al limpiar BD:', dbErr);
      // Continuar aunque falle
    }

    console.log(`✅ Documento firmado eliminado correctamente`);

    return res.json({
      success: true,
      message: 'Documento firmado eliminado. Ahora puedes generar y enviar una nueva versión.',
      data: {
        polizaId,
        docUUID: docUUIDFinal,
        vaFirmaEliminado,
        mensajeVaFirma,
        estadoAnterior: registro.estado_firma
      }
    });
  } catch (error) {
    console.error('❌ Error al eliminar documento:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al eliminar documento firmado'
    });
  }
};

module.exports = {
  enviarPolizaFirma,
  consultarEstadoFirma,
  descargarPolizaFirmada,
  webhookVaFirma,
  eliminarSolicitudFirma,
  eliminarDocumentoFirmado,
  async consultarEstadoPorDocUUID(req, res) {
    try {
      const { docUUID } = req.params;
      if (!docUUID) {
        return res.status(400).json({ success: false, error: 'Falta docUUID' });
      }

      console.log(`🔍 Consultando estado por docUUID: ${docUUID}`);

      // Buscar registro local
      const [rows] = await db.query(
        'SELECT poliza_id, doc_uuid, estado_firma FROM polizas_vafirma_envios WHERE doc_uuid = ? LIMIT 1',
        [docUUID]
      );
      if (!rows || rows.length === 0) {
        console.warn('⚠️ No existe registro local para este docUUID');
      }

      // Consultar a VaFirma
      const estado = await getVaFirmaService().consultarEstado(docUUID);
      if (!estado.success) {
        return res.status(502).json({ success: false, error: 'Error consultando VaFirma', details: estado.error });
      }

      let estadoVaFirma = null;
      const data = estado.data;
      if (typeof data === 'string') estadoVaFirma = data;
      else if (data?.status) estadoVaFirma = data.status;
      else if (data?.state) estadoVaFirma = data.state;
      else if (data?.estadoLocal) estadoVaFirma = data.estadoLocal;

      const mapeo = {
        'SIGNED': 'signed', 'signed': 'signed', 'Signed': 'signed', 'firmado': 'signed', 'FIRMADO': 'signed',
        'completed': 'signed', 'COMPLETED': 'signed', 'completado': 'signed', 'COMPLETADO': 'signed',
        'PENDING': 'pending', 'pending': 'pending', 'Pending': 'pending',
        'REJECTED': 'rejected', 'rejected': 'rejected', 'Rejected': 'rejected',
        'EXPIRED': 'expired', 'expired': 'expired', 'Expired': 'expired'
      };
      const estadoNormalizado = mapeo[estadoVaFirma] || (estadoVaFirma ? estadoVaFirma.toLowerCase().trim() : null);

      if (estadoNormalizado) {
        await db.query(
          `UPDATE polizas_vafirma_envios
           SET estado_firma = ?, actualizado_en = NOW(),
               firmado_en = CASE WHEN ? = 'signed' THEN COALESCE(firmado_en, NOW()) ELSE firmado_en END
           WHERE doc_uuid = ?`,
          [estadoNormalizado, estadoNormalizado, docUUID]
        );
      }

      return res.json({
        success: true,
        data: {
          docUUID,
          estadoLocal: estadoNormalizado,
          estadoVaFirma: data
        }
      });

    } catch (error) {
      console.error('❌ Error en consultarEstadoPorDocUUID:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
