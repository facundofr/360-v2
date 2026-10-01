const db = require('../config/db');
const crypto = require('crypto');

async function generateDocumentHashes() {
  try {
    console.log('🔐 Iniciando generación de hashes para documentos...');
    
    // Obtener documentos sin public_hash
    const [documentosSinHash] = await db.execute(`
      SELECT id, poliza_id, nombre_original, tipo_documento 
      FROM poliza_documentos 
      WHERE public_hash IS NULL OR public_hash = ''
      ORDER BY id ASC
    `);
    
    console.log(`📄 Encontrados ${documentosSinHash.length} documentos sin hash público`);
    
    if (documentosSinHash.length === 0) {
      console.log('✅ Todos los documentos ya tienen hash público');
      return;
    }
    
    // Generar updates
    for (const doc of documentosSinHash) {
      const hash = crypto.randomBytes(16).toString('hex');
      
      await db.execute(`
        UPDATE poliza_documentos 
        SET public_hash = ? 
        WHERE id = ?
      `, [hash, doc.id]);
      
      console.log(`✅ Documento ${doc.id} (${doc.nombre_original}): hash ${hash} generado`);
    }
    
    console.log(`🎉 Proceso completado: ${documentosSinHash.length} documentos actualizados`);
    
    // Mostrar ejemplo de URLs generadas
    console.log('\n📄 Ejemplo de URLs generadas:');
    const [ejemplos] = await db.execute(`
      SELECT id, nombre_original, public_hash, poliza_id 
      FROM poliza_documentos 
      WHERE public_hash IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 3
    `);
    
    ejemplos.forEach(doc => {
      console.log(`🔗 Documento ${doc.id}: https://wspflows.cober.online/poliza-documentos/public/${doc.public_hash}`);
    });
    
  } catch (error) {
    console.error('❌ Error generando hashes de documentos:', error);
  } finally {
    process.exit();
  }
}

generateDocumentHashes();
