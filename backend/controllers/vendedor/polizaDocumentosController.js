const db = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuración de multer (consistente con config/multer.js global)
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/polizas/documentos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creando directorio:', error);
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const VendedorPolizaDocumentosController = {
  // Obtener documentos de una póliza del vendedor
  async obtenerDocumentosPoliza(req, res) {
    try {
      const { id: polizaId } = req.params;
      const vendedor_id = req.user.id;

      console.log('📄 Vendedor obteniendo documentos para póliza:', polizaId);
      
      if (!polizaId || isNaN(polizaId)) {
        return res.status(400).json({ 
          error: 'ID de póliza inválido',
          details: `Parámetro recibido: ${polizaId}` 
        });
      }

      // Verificar que la póliza pertenece al vendedor
      const [polizaCheck] = await db.execute(
        'SELECT id FROM polizas WHERE id = ? AND created_by = ?',
        [polizaId, vendedor_id]
      );

      if (polizaCheck.length === 0) {
        return res.status(403).json({ 
          error: 'No tiene acceso a esta póliza' 
        });
      }

      const query = `
        SELECT 
          d.id,
          d.tipo_documento,
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tamaño_bytes,
          d.tipo_mime,
          d.integrante_index,
          d.fecha_subida,
          d.observaciones,
          p.numero_poliza,
          p.numero_poliza_oficial,
          pr.nombre as titular_nombre,
          pr.apellido as titular_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        INNER JOIN prospectos pr ON p.prospecto_id = pr.id
        WHERE d.poliza_id = ?
        ORDER BY d.tipo_documento, d.integrante_index, d.fecha_subida DESC
      `;

      const [documentos] = await db.execute(query, [parseInt(polizaId)]);

      console.log(`📄 Encontrados ${documentos.length} documentos para póliza ${polizaId}`);

      const baseUrl = process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online');
      const documentosAgrupados = documentos.reduce((acc, doc) => {
        const tipo = doc.tipo_documento;
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push({
          id: doc.id,
          nombre_original: doc.nombre_original,
          nombre_archivo: doc.nombre_archivo,
          ruta_archivo: doc.ruta_archivo,
          tamaño_bytes: doc.tamaño_bytes,
          tipo_mime: doc.tipo_mime,
          integrante_index: doc.integrante_index,
          fecha_subida: doc.fecha_subida,
          observaciones: doc.observaciones || null,
          urls: {
            download: `${baseUrl}/api/vendedor/polizas/documentos/${doc.id}/download`,
            preview: `${baseUrl}/api/vendedor/polizas/documentos/${doc.id}/preview`
          }
        });
        
        // Log temporal para debug
        console.log(`[VENDEDOR] URL generada para documento ${doc.id}:`, {
          download: `${baseUrl}/api/vendedor/polizas/documentos/${doc.id}/download`,
          preview: `${baseUrl}/api/vendedor/polizas/documentos/${doc.id}/preview`
        });
        
        return acc;
      }, {});

      res.json({
        success: true,
        poliza_id: polizaId,
        numero_poliza: documentos[0]?.numero_poliza_oficial || null,
        titular: documentos[0] ? {
          nombre: documentos[0].titular_nombre,
          apellido: documentos[0].titular_apellido
        } : null,
        documentos: documentosAgrupados,
        total_documentos: documentos.length
      });

    } catch (error) {
      console.error('❌ Error obteniendo documentos de póliza:', error);
      res.status(500).json({ 
        error: 'Error obteniendo documentos',
        message: error.message 
      });
    }
  },

  // Cargar múltiples documentos
  async cargarMultiplesDocumentos(req, res) {
    const uploadMultiple = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 6
      },
      fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Solo se permiten archivos PDF, JPG, PNG, DOC y DOCX'));
        }
      }
    }).array('documentos', 6);

    uploadMultiple(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Máximo 6 documentos permitidos por carga.'
          });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Uno o más archivos son demasiado grandes. Máximo 10MB por archivo.'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Error al subir archivos: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      try {
        const polizaId = req.params.id;
        const { tipos_documento, observaciones } = req.body;
        const vendedor_id = req.user.id;
        
        console.log('📎 Vendedor cargando múltiples documentos para póliza:', {
          polizaId,
          cantidad_archivos: req.files?.length || 0,
          vendedor_id
        });

        // Verificar que la póliza pertenece al vendedor
        const polizaQuery = `SELECT p.*, pr.nombre as prospecto_nombre, pr.apellido as prospecto_apellido
           FROM polizas p
           LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
           WHERE p.id = ? AND p.created_by = ? AND p.deleted_at IS NULL`;

        const [polizaExistente] = await db.execute(polizaQuery, [polizaId, vendedor_id]);

        if (polizaExistente.length === 0) {
          if (req.files) {
            for (const file of req.files) {
              try {
                await fs.unlink(file.path);
              } catch (unlinkError) {
                console.error('Error eliminando archivo:', unlinkError);
              }
            }
          }
          return res.status(404).json({
            success: false,
            message: 'Póliza no encontrada o no tiene acceso a esta póliza'
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionaron archivos'
          });
        }

        let tiposDocumento = [];
        if (tipos_documento) {
          try {
            tiposDocumento = JSON.parse(tipos_documento);
          } catch (e) {
            console.error('Error parseando tipos_documento:', e);
            tiposDocumento = [];
          }
        }

        const [documentosExistentes] = await db.execute(
          'SELECT COUNT(*) as total FROM poliza_documentos WHERE poliza_id = ?',
          [polizaId]
        );

        const totalExistentes = documentosExistentes[0].total;
        const totalNuevos = req.files.length;

        if (totalExistentes + totalNuevos > 20) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (unlinkError) {
              console.error('Error eliminando archivo:', unlinkError);
            }
          }

          return res.status(400).json({
            success: false,
            message: `Límite de documentos alcanzado. Tiene ${totalExistentes} documentos y está intentando cargar ${totalNuevos}. Máximo permitido: 20.`
          });
        }

        const insertQuery = `
          INSERT INTO poliza_documentos (
            poliza_id, 
            tipo_documento, 
            nombre_original, 
            nombre_archivo, 
            ruta_archivo, 
            tamaño_bytes, 
            tipo_mime, 
            subido_por,
            observaciones,
            public_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const documentosCargados = [];
        const crypto = require('crypto');

        // Valores válidos del ENUM tipo_documento
        const TIPOS_VALIDOS = [
          'dni_frente','dni_dorso','recibo_sueldo','certificado_afip','otros',
          'poliza_firmada','auditoria_medica','documento_identidad_adicional',
          'comprobante_ingresos','autorizacion_debito','documento_adicional',
          'codem','formulario_f152','formulario_f184','constancia_inscripcion',
          'comprobante_pago_cuota','estudios_medicos'
        ];

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const tipoRaw = tiposDocumento[i] || 'documento_adicional';
          // Si el valor no es un ENUM válido (e.g. título libre), usar 'documento_adicional'
          // y guardar el título original en observaciones
          const tipoDoc = TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : 'documento_adicional';
          const obsDoc = TIPOS_VALIDOS.includes(tipoRaw) ? (observaciones || null) : tipoRaw;

          // Generar hash de 16 bytes = 32 caracteres hex (más corto)
          const publicHash = crypto.randomBytes(16).toString('hex');

          const rutaAbsoluta = path.resolve(file.path);

          const [result] = await db.execute(insertQuery, [
            polizaId,
            tipoDoc,
            file.originalname,
            file.filename,
            rutaAbsoluta,
            file.size,
            file.mimetype,
            vendedor_id,
            obsDoc,
            publicHash
          ]);

          documentosCargados.push({
            id: result.insertId,
            tipo: tipoDoc,
            nombre: file.originalname,
            tamaño: file.size
          });

          console.log(`✅ Documento ${i + 1}/${req.files.length} guardado:`, {
            id: result.insertId,
            tipo: tipoDoc,
            nombre: file.originalname
          });
        }

        console.log(`✅ ${documentosCargados.length} documentos cargados exitosamente para póliza ${polizaId}`);

        res.json({
          success: true,
          message: `${documentosCargados.length} documento(s) cargado(s) exitosamente`,
          data: {
            poliza_id: polizaId,
            numero_poliza: polizaExistente[0].numero_poliza_oficial || polizaExistente[0].numero_poliza,
            prospecto: `${polizaExistente[0].prospecto_nombre} ${polizaExistente[0].prospecto_apellido}`,
            documentos_cargados: documentosCargados.length,
            documentos: documentosCargados
          }
        });

      } catch (error) {
        console.error('❌ Error cargando documentos:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno al cargar documentos',
          error: error.message
        });
      }
    });
  },

  // Previsualizar documento
  async previsualizarDocumento(req, res) {
    try {
      const { documentoId } = req.params;
      const vendedor_id = req.user.id;

      const query = `
        SELECT 
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tipo_mime,
          d.tipo_documento,
          p.numero_poliza_oficial || p.numero_poliza as numero_poliza,
          pr.nombre as prospecto_nombre,
          pr.apellido as prospecto_apellido
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        INNER JOIN prospectos pr ON p.prospecto_id = pr.id
        WHERE d.id = ? AND p.created_by = ?
      `;

      const [documentos] = await db.execute(query, [documentoId, vendedor_id]);
      
      if (documentos.length === 0) {
        return res.status(404).json({ 
          error: 'Documento no encontrado o no tiene acceso a este documento' 
        });
      }

      const documento = documentos[0];
      const fs = require('fs');
      const rutaCompleta = documento.ruta_archivo;

      if (!fs.existsSync(rutaCompleta)) {
        console.error('❌ Archivo no encontrado:', rutaCompleta);
        return res.status(404).json({ 
          error: 'Archivo no encontrado en el servidor',
          ruta: rutaCompleta 
        });
      }

      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Documento-Tipo', documento.tipo_documento);
      res.setHeader('X-Poliza-Numero', documento.numero_poliza);
      res.setHeader('X-Prospecto-Nombre', `${documento.prospecto_nombre} ${documento.prospecto_apellido}`);

      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error previsualizando documento:', error);
      res.status(500).json({ 
        error: 'Error previsualizando documento',
        message: error.message 
      });
    }
  },

  // Descargar documento
  async descargarDocumento(req, res) {
    try {
      const { documentoId } = req.params;
      const vendedor_id = req.user.id;

      const query = `
        SELECT 
          d.nombre_original,
          d.nombre_archivo,
          d.ruta_archivo,
          d.tipo_mime,
          p.numero_poliza_oficial || p.numero_poliza as numero_poliza
        FROM poliza_documentos d
        INNER JOIN polizas p ON d.poliza_id = p.id
        WHERE d.id = ? AND p.created_by = ?
      `;

      const [documentos] = await db.execute(query, [documentoId, vendedor_id]);
      if (documentos.length === 0) {
        return res.status(404).json({ 
          error: 'Documento no encontrado o no tiene acceso a este documento' 
        });
      }

      const documento = documentos[0];
      const fs = require('fs');
      const rutaCompleta = documento.ruta_archivo;

      if (!fs.existsSync(rutaCompleta)) {
        console.error('❌ Archivo no encontrado:', rutaCompleta);
        return res.status(404).json({ 
          error: 'Archivo no encontrado en el servidor',
          ruta: rutaCompleta 
        });
      }

      res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_original}"`);
      res.setHeader('Content-Type', documento.tipo_mime);
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(rutaCompleta);

    } catch (error) {
      console.error('❌ Error descargando documento:', error);
      res.status(500).json({ 
        error: 'Error descargando documento',
        message: error.message 
      });
    }
  },

  // Obtener estadísticas de documentos
  async obtenerEstadisticasDocumentos(req, res) {
    try {
      const { id: polizaId } = req.params;
      const vendedor_id = req.user.id;

      // Verificar acceso a la póliza
      const [polizaData] = await db.execute(
        `SELECT p.numero_poliza_oficial || p.numero_poliza as numero_poliza
         FROM polizas p
         WHERE p.id = ? AND p.created_by = ? AND p.deleted_at IS NULL`,
        [polizaId, vendedor_id]
      );

      if (polizaData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Póliza no encontrada o no tiene acceso'
        });
      }

      const [estadisticas] = await db.execute(`
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(CASE WHEN pd.tipo_documento = 'poliza_firmada' THEN 1 END) as polizas_firmadas,
          COUNT(CASE WHEN pd.tipo_documento = 'auditoria_medica' THEN 1 END) as auditorias_medicas,
          COUNT(CASE WHEN pd.tipo_documento = 'documento_identidad_adicional' THEN 1 END) as documentos_identidad,
          COUNT(CASE WHEN pd.tipo_documento = 'comprobante_ingresos' THEN 1 END) as comprobantes_ingresos,
          COUNT(CASE WHEN pd.tipo_documento = 'autorizacion_debito' THEN 1 END) as autorizaciones_debito,
          COUNT(CASE WHEN pd.tipo_documento = 'documento_adicional' THEN 1 END) as documentos_adicionales,
          SUM(pd.tamaño_bytes) as tamaño_total_bytes,
          MAX(pd.fecha_subida) as ultimo_documento_subido,
          MIN(pd.fecha_subida) as primer_documento_subido
        FROM poliza_documentos pd
        INNER JOIN polizas p ON pd.poliza_id = p.id
        WHERE pd.poliza_id = ?
      `, [polizaId]);

      const stats = estadisticas[0];
      const tamañoTotalMB = stats.tamaño_total_bytes ? (stats.tamaño_total_bytes / (1024 * 1024)).toFixed(2) : 0;

      const documentosRequeridos = {
        poliza_firmada: stats.polizas_firmadas > 0,
        auditoria_medica: stats.auditorias_medicas > 0
      };

      const documentosCompletos = Object.values(documentosRequeridos).every(Boolean);

      res.json({
        success: true,
        data: {
          numero_poliza: polizaData[0].numero_poliza,
          total_documentos: stats.total_documentos,
          tamaño_total_mb: tamañoTotalMB,
          documentos_por_tipo: {
            poliza_firmada: stats.polizas_firmadas,
            auditoria_medica: stats.auditorias_medicas,
            documento_identidad_adicional: stats.documentos_identidad,
            comprobante_ingresos: stats.comprobantes_ingresos,
            autorizacion_debito: stats.autorizaciones_debito,
            documento_adicional: stats.documentos_adicionales
          },
          documentos_requeridos: documentosRequeridos,
          documentos_completos: documentosCompletos,
          ultimo_documento_subido: stats.ultimo_documento_subido,
          primer_documento_subido: stats.primer_documento_subido
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas de documentos',
        error: error.message
      });
    }
  },

  // ✅ Actualizar un documento (reemplazar archivo, con verificación de propiedad)
  async actualizarDocumento(req, res) {
    const uploadSingle = require('multer')({
      storage: storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: function (req, file, cb) {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Solo se permiten archivos PDF, JPG y PNG'));
      }
    }).single('documento');

    uploadSingle(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE'
            ? 'El archivo es demasiado grande. Máximo 10MB.'
            : err.message
        });
      }

      try {
        const { documentoId } = req.params;
        const { motivo_actualizacion } = req.body;
        const vendedor_id = req.user.id;

        if (!req.file) {
          return res.status(400).json({ success: false, message: 'No se proporcionó archivo' });
        }
        if (!motivo_actualizacion?.trim()) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({ success: false, message: 'El motivo de actualización es obligatorio' });
        }

        // Verificar propiedad del documento
        const [existing] = await db.execute(
          `SELECT pd.*, p.created_by, pd.ruta_archivo as ruta_anterior
           FROM poliza_documentos pd
           JOIN polizas p ON pd.poliza_id = p.id
           WHERE pd.id = ? AND p.created_by = ?`,
          [documentoId, vendedor_id]
        );

        if (existing.length === 0) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(404).json({
            success: false,
            message: 'Documento no encontrado o sin permiso para actualizarlo'
          });
        }

        const doc = existing[0];

        console.log('📂 [VENDEDOR UPDATE] Documento a actualizar:', {
          id: documentoId,
          ruta_anterior: doc.ruta_anterior,
          nuevo_archivo: req.file.originalname,
          nuevo_path: req.file.path
        });

        // Eliminar archivo anterior (best-effort)
        if (doc.ruta_anterior) {
          const fs2 = require('fs');
          if (fs2.existsSync(doc.ruta_anterior)) {
            await fs.unlink(doc.ruta_anterior).catch((e) =>
              console.warn('⚠️ No se pudo eliminar archivo anterior:', e.message)
            );
          } else {
            console.warn('ℹ️ Archivo anterior no existe en disco (ya fue eliminado):', doc.ruta_anterior);
          }
        }

        // Actualizar registro en BD (siempre guardar ruta absoluta)
        const rutaAbsoluta = path.resolve(req.file.path);
        console.log('💾 [VENDEDOR UPDATE] Guardando en DB - ruta absoluta:', rutaAbsoluta);
        await db.execute(
          `UPDATE poliza_documentos
           SET nombre_archivo = ?, nombre_original = ?, ruta_archivo = ?,
               tipo_mime = ?, tamaño_bytes = ?, updated_at = NOW()
           WHERE id = ?`,
          [req.file.filename, req.file.originalname, rutaAbsoluta,
           req.file.mimetype, req.file.size, documentoId]
        );
        console.log('✅ [VENDEDOR UPDATE] DB actualizada correctamente para doc:', documentoId);

        // Registrar historial (best-effort)
        await db.execute(
          `INSERT INTO poliza_documentos_historial
           (documento_id, accion, motivo, usuario_id, archivo_anterior, archivo_nuevo, created_at)
           VALUES (?, 'actualizado', ?, ?, ?, ?, NOW())`,
          [documentoId, motivo_actualizacion, vendedor_id, doc.nombre_archivo, req.file.filename]
        ).catch((e) => console.warn('Historial no registrado:', e.message));

        console.log('✅ Documento actualizado por vendedor:', documentoId);

        res.json({
          success: true,
          message: 'Documento actualizado correctamente',
          data: {
            id: documentoId,
            nombre_original: req.file.originalname,
            tipo_mime: req.file.mimetype,
            tamaño_bytes: req.file.size
          }
        });

      } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        console.error('❌ Error actualizando documento:', error);
        res.status(500).json({ success: false, message: error.message });
      }
    });
  },

  // ✅ Eliminar un documento (con verificación de propiedad)
  async eliminarDocumento(req, res) {
    try {
      const { documentoId } = req.params;
      const vendedor_id = req.user.id;

      // Verificar propiedad
      const [existing] = await db.execute(
        `SELECT pd.*, pd.ruta_archivo
         FROM poliza_documentos pd
         JOIN polizas p ON pd.poliza_id = p.id
         WHERE pd.id = ? AND p.created_by = ?`,
        [documentoId, vendedor_id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado o sin permiso para eliminarlo'
        });
      }

      const doc = existing[0];

      // Eliminar archivo físico
      if (doc.ruta_archivo) {
        await fs.unlink(doc.ruta_archivo).catch((e) =>
          console.warn('No se pudo eliminar archivo:', e.message)
        );
      }

      // Eliminar de BD
      await db.execute('DELETE FROM poliza_documentos WHERE id = ?', [documentoId]);

      console.log('✅ Documento eliminado por vendedor:', documentoId);
      res.json({ success: true, message: 'Documento eliminado correctamente' });

    } catch (error) {
      console.error('❌ Error eliminando documento:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Obtener tipos de documentos disponibles
  async obtenerTiposDocumentos(req, res) {
    try {
      const tiposDocumentos = [
        {
          valor: 'codem',
          etiqueta: 'CODEM',
          descripcion: 'Certificado de Domicilio Electrónico (CODEM)',
          requerido: false,
          icono: 'file-text'
        },
        {
          valor: 'formulario_f152',
          etiqueta: 'Formulario F152',
          descripcion: 'Formulario F152 - Constancia de ingresos',
          requerido: false,
          icono: 'form'
        },
        {
          valor: 'formulario_f184',
          etiqueta: 'Formulario F184',
          descripcion: 'Formulario F184 - Información complementaria',
          requerido: false,
          icono: 'form'
        },
        {
          valor: 'constancia_inscripcion',
          etiqueta: 'Constancia de Inscripción',
          descripcion: 'Constancia de inscripción en registros oficiales',
          requerido: false,
          icono: 'clipboard-check'
        },
        {
          valor: 'comprobante_pago_cuota',
          etiqueta: 'Comprobante de Pago de Cuota',
          descripcion: 'Comprobantes de pago de la cuota (pueden ser múltiples)',
          requerido: false,
          icono: 'receipt'
        },
        {
          valor: 'estudios_medicos',
          etiqueta: 'Estudios Médicos',
          descripcion: 'Resultados de estudios médicos y análisis',
          requerido: false,
          icono: 'activity'
        },
        {
          valor: 'poliza_firmada',
          etiqueta: 'Póliza Firmada',
          descripcion: 'Póliza firmada por el cliente',
          requerido: true,
          icono: 'file-text'
        },
        {
          valor: 'auditoria_medica',
          etiqueta: 'Auditoría Médica',
          descripcion: 'Resultado de la auditoría médica',
          requerido: true,
          icono: 'clipboard-list'
        },
        {
          valor: 'documento_identidad_adicional',
          etiqueta: 'Documento de Identidad Adicional',
          descripcion: 'DNI, pasaporte u otro documento de identidad',
          requerido: false,
          icono: 'identification'
        },
        {
          valor: 'autorizacion_debito',
          etiqueta: 'Autorización de Débito',
          descripcion: 'Autorización para débito automático',
          requerido: false,
          icono: 'credit-card'
        },
        {
          valor: 'documento_adicional',
          etiqueta: 'Documento Adicional',
          descripcion: 'Cualquier otro documento relacionado',
          requerido: false,
          icono: 'document-plus'
        }
      ];

      res.json({
        success: true,
        data: tiposDocumentos,
        total: tiposDocumentos.length
      });

    } catch (error) {
      console.error('❌ Error obteniendo tipos de documentos:', error);
      res.status(500).json({ 
        error: 'Error obteniendo tipos de documentos',
        message: error.message 
      });
    }
  }
};

module.exports = VendedorPolizaDocumentosController;
