const db = require('../config/db');

async function testFamiliaresDocuments() {
  try {
    console.log('🧪 PRUEBA: Verificando documentos de familiares\n');
    
    // Buscar prospectos que tengan familiares
    const [prospectos] = await db.execute(`
      SELECT DISTINCT pr.id, pr.nombre, pr.apellido 
      FROM prospectos pr
      INNER JOIN familiares f ON pr.id = f.prospecto_id
      LIMIT 3
    `);
    
    console.log(`📋 Encontrados ${prospectos.length} prospectos con familiares`);
    
    for (const prospecto of prospectos) {
      console.log(`\n👨‍👩‍👧‍👦 PROSPECTO ${prospecto.id}: ${prospecto.nombre} ${prospecto.apellido}`);
      
      // Obtener familiares
      const [familiares] = await db.execute(`
        SELECT * FROM familiares WHERE prospecto_id = ?
      `, [prospecto.id]);
      
      console.log(`   Familiares: ${familiares.length}`);
      familiares.forEach((fam, idx) => {
        console.log(`   ${idx + 1}. ID: ${fam.id}, Nombre: ${fam.nombre}, Vínculo: ${fam.vinculo}, Edad: ${fam.edad}`);
      });
      
      // Obtener pólizas del prospecto
      const [polizas] = await db.execute(`
        SELECT id FROM polizas WHERE prospecto_id = ? AND deleted_at IS NULL
      `, [prospecto.id]);
      
      if (polizas.length > 0) {
        const polizaId = polizas[0].id;
        console.log(`   Póliza ID: ${polizaId}`);
        
        // Obtener documentos de la póliza
        const [documentos] = await db.execute(`
          SELECT id, tipo_documento, integrante_index, public_hash, nombre_original
          FROM poliza_documentos 
          WHERE poliza_id = ?
          ORDER BY integrante_index, tipo_documento
        `, [polizaId]);
        
        console.log(`   📄 Documentos encontrados: ${documentos.length}`);
        
        // Agrupar documentos por integrante_index
        const docsPorIntegrante = {};
        documentos.forEach(doc => {
          const idx = doc.integrante_index;
          if (!docsPorIntegrante[idx]) {
            docsPorIntegrante[idx] = [];
          }
          docsPorIntegrante[idx].push(doc);
        });
        
        console.log(`   📊 Documentos agrupados por integrante_index:`);
        Object.entries(docsPorIntegrante).forEach(([idx, docs]) => {
          console.log(`     integrante_index ${idx}: ${docs.length} documentos`);
          docs.forEach(doc => {
            console.log(`       - ${doc.tipo_documento}: ${doc.nombre_original} (hash: ${doc.public_hash ? '✅' : '❌'})`);
          });
        });
        
        // Simular la lógica de matching
        console.log(`\n   🔄 SIMULANDO MATCHING DE DOCUMENTOS:`);
        familiares.forEach((familiar, index) => {
          console.log(`     Familiar ${index + 1} (ID: ${familiar.id}, Nombre: ${familiar.nombre})`);
          
          // Probar diferentes índices
          const posiblesIndices = [index, index + 1, familiar.id];
          
          let encontrado = false;
          for (const idx of posiblesIndices) {
            const docs = documentos.filter(doc => 
              doc.integrante_index === idx && doc.public_hash
            );
            if (docs.length > 0) {
              console.log(`       ✅ Encontrados ${docs.length} docs con integrante_index=${idx}`);
              docs.forEach(doc => {
                console.log(`         - ${doc.tipo_documento}: hash=${doc.public_hash.substring(0, 8)}...`);
              });
              encontrado = true;
              break;
            } else {
              console.log(`       ❌ No hay docs con integrante_index=${idx}`);
            }
          }
          
          if (!encontrado) {
            console.log(`       ⚠️ No se encontraron documentos para este familiar`);
          }
        });
      } else {
        console.log(`   ⚠️ No hay pólizas para este prospecto`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  } finally {
    process.exit();
  }
}

testFamiliaresDocuments();
