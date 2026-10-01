const db = require('../../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PolizaDocumentosModel = {
  // Guardar documento en BD
  async guardar(documentoData) {
    // Generar hash público único para acceder al documento
    const public_hash = crypto.randomBytes(16).toString('hex');

    const query = `
      INSERT INTO poliza_documentos 
      (poliza_id, tipo_documento, integrante_index, nombre_original, nombre_archivo, ruta_archivo, tipo_mime, tamaño_bytes, subido_por, public_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.query(query, [
      documentoData.poliza_id,
      documentoData.tipo_documento,
      documentoData.integrante_index,
      documentoData.nombre_original,
      documentoData.nombre_archivo,
      documentoData.ruta_archivo,
      documentoData.tipo_mime,
      documentoData.tamaño_bytes,
      documentoData.subido_por,
      public_hash
    ]);
    
    return { id: result.insertId, public_hash };
  },

  // Obtener documentos de una póliza
  async obtenerPorPoliza(poliza_id) {
    const query = `
      SELECT * FROM poliza_documentos 
      WHERE poliza_id = ? 
      ORDER BY integrante_index ASC, tipo_documento ASC
    `;
    
    const [rows] = await db.query(query, [poliza_id]);
    return rows;
  },

  // Obtener documento por hash público
  async obtenerPorHashPublico(hash) {
    const [rows] = await db.query('SELECT * FROM poliza_documentos WHERE public_hash = ?', [hash]);
    return rows.length ? rows[0] : null;
  },

  // Eliminar documento
  async eliminar(id) {
    // Primero obtener la info del archivo para eliminarlo físicamente
    const [documento] = await db.query('SELECT * FROM poliza_documentos WHERE id = ?', [id]);
    
    if (documento.length > 0) {
      const rutaCompleta = path.join(__dirname, '../../uploads/polizas/documentos', documento[0].nombre_archivo);

      // Eliminar archivo físico
      if (fs.existsSync(rutaCompleta)) {
        fs.unlinkSync(rutaCompleta);
      }

      // Eliminar registro de BD
      await db.query('DELETE FROM poliza_documentos WHERE id = ?', [id]);
    }

    return true;
  }
};

module.exports = PolizaDocumentosModel;