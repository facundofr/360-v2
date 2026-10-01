const upload = require('../../config/multer');
const PolizaDocumentosModel = require('../../models/poliza/polizaDocumentosModel');
const path = require('path');
const db = require('../../config/db');
const fs = require('fs').promises;
const multer = require('multer');

const PolizaDocumentosController = {
  // Subir documento
  async subirDocumento(req, res) {
    try {
      console.log('📁 Subiendo documento:', req.body);
      console.log('📁 Archivo recibido:', req.file);
      
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo' });
      }

      const { poliza_id, tipo_documento, integrante_index } = req.body;
      const vendedor_id = req.user.id;

      // Corregir el parseo de integrante_index:
      let integranteIndexFinal = null;
      if (integrante_index !== undefined && integrante_index !== null && integrante_index !== '' && integrante_index !== 'null') {
        const parsed = parseInt(integrante_index);
        if (!isNaN(parsed)) {
          integranteIndexFinal = parsed;
        }
      }

      // Guardar en BD
      const guardarRes = await PolizaDocumentosModel.guardar({
        poliza_id: parseInt(poliza_id),
        tipo_documento,
        integrante_index: integranteIndexFinal,
        nombre_original: req.file.originalname,
        nombre_archivo: req.file.filename,
        ruta_archivo: req.file.path,
        tipo_mime: req.file.mimetype,
        tamaño_bytes: req.file.size,
        subido_por: vendedor_id
      });

      console.log('✅ Documento guardado con ID:', guardarRes.id, 'hash público:', guardarRes.public_hash);

      // Construir URL pública para acceso (misma base que PDFs)
      const publicUrl = `${req.protocol}://${req.get('host')}/api/polizas/documentos/${guardarRes.public_hash}`;

      res.json({
        success: true,
        documento_id: guardarRes.id,
        public_hash: guardarRes.public_hash,
        public_url: publicUrl,
        nombre_archivo: req.file.filename,
        nombre_original: req.file.originalname,
        tamaño: req.file.size,
        tipo_mime: req.file.mimetype
      });

    } catch (error) {
      console.error('❌ Error subiendo documento:', error);
      res.status(500).json({ 
        error: 'Error al subir el documento',
        message: error.message 
      });
    }
  },

  // Obtener documentos de una póliza
  async obtenerDocumentos(req, res) {
    try {
      const { poliza_id } = req.params;
      const documentos = await PolizaDocumentosModel.obtenerPorPoliza(poliza_id);
      
      res.json(documentos);
    } catch (error) {
      console.error('❌ Error obteniendo documentos:', error);
      res.status(500).json({ error: 'Error al obtener documentos' });
    }
  },

  // Descargar documento
  async descargarDocumento(req, res) {
    try {
      const { documento_id } = req.params;

      const [documento] = await db.query('SELECT * FROM poliza_documentos WHERE id = ?', [documento_id]);

      if (documento.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      const rutaArchivo = path.join(__dirname, '../../uploads/polizas/documentos', documento[0].nombre_archivo);

      if (!require('fs').existsSync(rutaArchivo)) {
        return res.status(404).json({ error: 'Archivo físico no encontrado' });
      }

      res.download(rutaArchivo, documento[0].nombre_original);
      
    } catch (error) {
      console.error('❌ Error descargando documento:', error);
      res.status(500).json({ error: 'Error al descargar documento' });
    }
  },

  // Eliminar documento
  async eliminarDocumento(req, res) {
    try {
      const { documento_id } = req.params;
      
      await PolizaDocumentosModel.eliminar(documento_id);
      
      res.json({ success: true, message: 'Documento eliminado correctamente' });
      
    } catch (error) {
      console.error('❌ Error eliminando documento:', error);
      res.status(500).json({ error: 'Error al eliminar documento' });
    }
  }
  ,
  // Descargar documento por hash público (sin autenticación)
  async descargarPorHash(req, res) {
    try {
      const { hash } = req.params;
      console.log('🔓 [descargarPorHash] Iniciando - Hash:', hash, 'Type:', typeof hash);

      // Usar el modelo para obtener por hash público
      const documento = await PolizaDocumentosModel.obtenerPorHashPublico(hash);
      console.log('🔓 [descargarPorHash] Documento encontrado:', documento ? `ID ${documento.id}` : 'null');

      if (!documento) {
        console.log('🔓 [descargarPorHash] No se encontró documento con hash:', hash);
        return res.status(404).json({ error: 'Documento no encontrado', hash_buscado: hash });
      }

      // ✅ CORRECCIÓN: Usar la ruta_archivo de la BD directamente si es absoluta
      let rutaArchivo;
      if (documento.ruta_archivo && path.isAbsolute(documento.ruta_archivo)) {
        rutaArchivo = documento.ruta_archivo;
      } else {
        // Fallback al método anterior por compatibilidad
        rutaArchivo = path.join(__dirname, '../../uploads/polizas/documentos', documento.nombre_archivo);
      }

      console.log('🔓 [descargarPorHash] Ruta archivo:', rutaArchivo);

      if (!require('fs').existsSync(rutaArchivo)) {
        console.log('❌ [descargarPorHash] Archivo no encontrado:', rutaArchivo);
        return res.status(404).json({ error: 'Archivo físico no encontrado', ruta: rutaArchivo });
      }

      // Forzar inline en el navegador para imágenes/pdf
      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.sendFile(rutaArchivo);

    } catch (error) {
      console.error('❌ Error descargando documento por hash:', error);
      res.status(500).json({ error: 'Error al descargar documento' });
    }
  },

  // ✅ NUEVA FUNCIÓN: Actualizar documento para vendedores
  async actualizarDocumento(req, res) {
    // Usar multer middleware manualmente
    upload.single('documento')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'El archivo es demasiado grande. Máximo 10MB permitido.'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Error al subir archivo: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      try {
        const { documentoId } = req.params;
        const { motivo_actualizacion } = req.body;
        const vendedor_id = req.user.id;

        console.log('📝 Vendedor actualizando documento:', { documentoId, vendedor_id });

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionó archivo'
          });
        }

        if (!motivo_actualizacion || motivo_actualizacion.trim() === '') {
          // Eliminar archivo subido si no se proporciona motivo
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error eliminando archivo:', unlinkError);
          }
          return res.status(400).json({
            success: false,
            message: 'El motivo de actualización es obligatorio'
          });
        }

        // Verificar que el documento existe y pertenece a una póliza del vendedor
        const [documentoExistente] = await db.execute(
          `SELECT pd.*, p.created_by 
           FROM poliza_documentos pd 
           JOIN polizas p ON pd.poliza_id = p.id 
           WHERE pd.id = ? AND p.created_by = ?`,
          [documentoId, vendedor_id]
        );

        if (documentoExistente.length === 0) {
          // Eliminar archivo subido si el documento no existe o no pertenece al vendedor
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error eliminando archivo:', unlinkError);
          }
          return res.status(404).json({
            success: false,
            message: 'Documento no encontrado o no tiene permisos para actualizarlo'
          });
        }

        const documento = documentoExistente[0];

        // Eliminar archivo anterior usando la ruta absoluta guardada en DB
        try {
          const archivoAnterior = documento.ruta_archivo && path.isAbsolute(documento.ruta_archivo)
            ? documento.ruta_archivo
            : path.join(__dirname, '../../uploads/polizas/documentos', documento.nombre_archivo);
          await fs.unlink(archivoAnterior);
          console.log('🗑️ Archivo anterior eliminado:', archivoAnterior);
        } catch (unlinkError) {
          console.warn('⚠️ No se pudo eliminar archivo anterior:', unlinkError.message);
        }

        // Actualizar información del documento en la base de datos
        const updateQuery = `
          UPDATE poliza_documentos 
          SET 
            nombre_archivo = ?,
            nombre_original = ?,
            ruta_archivo = ?,
            tipo_mime = ?,
            tamaño_bytes = ?,
            updated_at = CURRENT_TIMESTAMP,
            actualizado_por = ?
          WHERE id = ?
        `;

        const rutaAbsoluta = path.resolve(req.file.path);

        await db.execute(updateQuery, [
          req.file.filename,
          req.file.originalname,
          rutaAbsoluta,
          req.file.mimetype,
          req.file.size,
          vendedor_id,
          documentoId
        ]);

        // Registrar la actualización en un log (historial)
        try {
          await db.execute(
            `INSERT INTO poliza_documentos_historial 
             (documento_id, accion, motivo, usuario_id, archivo_anterior, archivo_nuevo, created_at) 
             VALUES (?, 'actualizado', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              documentoId,
              motivo_actualizacion,
              vendedor_id,
              documento.nombre_archivo,
              req.file.filename
            ]
          );
        } catch (logError) {
          console.warn('⚠️ Error registrando historial:', logError.message);
        }

        console.log('✅ Documento actualizado exitosamente por vendedor:', {
          id: documentoId,
          archivo_nuevo: req.file.filename,
          archivo_anterior: documento.nombre_archivo,
          motivo: motivo_actualizacion
        });

        res.json({
          success: true,
          message: 'Documento actualizado correctamente',
          data: {
            id: documentoId,
            nombre_archivo: req.file.filename,
            nombre_original: req.file.originalname,
            tipo_mime: req.file.mimetype,
            tamaño_bytes: req.file.size,
            motivo_actualizacion
          }
        });

      } catch (error) {
        console.error('❌ Error actualizando documento:', error);
        
        // Eliminar archivo subido en caso de error
        if (req.file) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error eliminando archivo:', unlinkError);
          }
        }

        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: error.message
        });
      }
    });
  },

  // 🆕 Cargar póliza firmada
  async cargarPolizaFirmada(req, res) {
    try {
      console.log('📋 Cargando póliza firmada:', req.body);
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No se recibió ningún archivo' 
        });
      }

      // Validar que sea PDF
      if (req.file.mimetype !== 'application/pdf') {
        // Eliminar archivo
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ 
          success: false, 
          error: 'Solo se aceptan archivos PDF' 
        });
      }

      // Validar tamaño (máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        // Eliminar archivo
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ 
          success: false, 
          error: 'El archivo no puede ser mayor a 10MB' 
        });
      }

      const { poliza_id } = req.body;
      const usuario_id = req.user.id;

      if (!poliza_id) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ 
          success: false, 
          error: 'poliza_id es requerido' 
        });
      }

      // Guardar en BD como tipo 'poliza_firmada'
      const guardarRes = await PolizaDocumentosModel.guardar({
        poliza_id: parseInt(poliza_id),
        tipo_documento: 'poliza_firmada',
        integrante_index: null,
        nombre_original: req.file.originalname,
        nombre_archivo: req.file.filename,
        ruta_archivo: req.file.path,
        tipo_mime: 'application/pdf',
        tamaño_bytes: req.file.size,
        subido_por: usuario_id
      });

      console.log('✅ Póliza firmada guardada con ID:', guardarRes.id);

      // 🔄 ACTUALIZAR ESTADO DE LA PÓLIZA A 'venta_cerrada'
      try {
        await db.query(
          'UPDATE polizas SET estado = ?, fecha_cambio_estado = NOW() WHERE id = ?',
          ['venta_cerrada', poliza_id]
        );
        console.log(`✅ Póliza ${poliza_id} marcada como venta_cerrada`);
      } catch (updateErr) {
        console.warn('⚠️ Error al actualizar estado de póliza:', updateErr.message);
      }

      // 🔄 Sincronizar estado del lead (asignaciones) a 'Venta' al cargar la póliza firmada
      try {
        const [polizaInfo] = await db.query(
          'SELECT prospecto_id, created_by, numero_poliza, numero_poliza_oficial FROM polizas WHERE id = ?',
          [poliza_id]
        );
        const infoPoliza = polizaInfo && polizaInfo[0];
        if (infoPoliza && infoPoliza.prospecto_id && infoPoliza.created_by) {
          const fechaHoraTextoVenta = new Date().toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          await db.query(
            `UPDATE asignaciones SET estado = 'Venta', comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
            [
              `Póliza ${infoPoliza.numero_poliza_oficial || infoPoliza.numero_poliza} firmada y cargada el ${fechaHoraTextoVenta}`,
              infoPoliza.prospecto_id,
              infoPoliza.created_by
            ]
          );
          console.log(`✅ Estado de asignación actualizado a 'Venta' para prospecto ${infoPoliza.prospecto_id}`);
          // Sincronizar estado en Google Sheets
          try {
            const GoogleSheetsService = require('../../services/googleSheetsService');
            await GoogleSheetsService.actualizarAsignacionEnSheet(infoPoliza.prospecto_id);
            console.log(`📊 Estado 'Venta' sincronizado en Google Sheets para prospecto ${infoPoliza.prospecto_id}`);
          } catch (errSheet) {
            console.warn('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
          }
        }
      } catch (asignacionError) {
        console.warn('⚠️ Error al actualizar estado de asignación:', asignacionError.message);
      }

      // Generar URL pública
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const publicUrl = `${baseUrl}/api/polizas/documentos/public/${guardarRes.public_hash}`;

      // Obtener información de la póliza
      const [poliza] = await db.query(
        'SELECT numero_poliza FROM polizas WHERE id = ?',
        [poliza_id]
      );

      const numeropoliza = poliza && poliza.length > 0 ? poliza[0].numero_poliza : 'N/A';

      // Intentar actualizar Google Sheets (no bloquea si falla)
      try {
        const googleSheetsService = require('../../services/googleSheetsPolizasService');
        await googleSheetsService.agregarPolizaCerrada(parseInt(poliza_id));
        console.log('✅ Google Sheets actualizado para póliza:', poliza_id);
      } catch (sheetsError) {
        console.warn('⚠️ Error al actualizar Google Sheets:', sheetsError.message);
      }

      // 📊 Sincronizar estado 'Venta' en planilla de prospectos
      try {
        const [polizaInfo] = await db.query('SELECT prospecto_id FROM polizas WHERE id = ?', [poliza_id]);
        if (polizaInfo && polizaInfo.length > 0 && polizaInfo[0].prospecto_id) {
          const GoogleSheetsService = require('../../services/googleSheetsService');
          await GoogleSheetsService.actualizarAsignacionEnSheet(polizaInfo[0].prospecto_id);
          console.log('📊 Planilla de prospectos sincronizada para prospecto:', polizaInfo[0].prospecto_id);
        }
      } catch (prospectoSheetError) {
        console.warn('⚠️ Error sincronizando planilla de prospectos:', prospectoSheetError.message);
      }

      res.json({
        success: true,
        mensaje: 'Póliza firmada cargada exitosamente',
        documento_id: guardarRes.id,
        public_hash: guardarRes.public_hash,
        public_url: publicUrl,
        nombre_archivo: req.file.filename,
        nombre_original: req.file.originalname,
        tamaño: req.file.size,
        tipo_mime: 'application/pdf',
        numero_poliza: numeropoliza,
        numero_poliza_oficial: numeropoliza
      });

    } catch (error) {
      console.error('❌ Error cargando póliza firmada:', error);
      
      // Eliminar archivo en caso de error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error eliminando archivo:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        error: 'Error al cargar la póliza firmada',
        mensaje: error.message
      });
    }
  }
};

module.exports = PolizaDocumentosController;