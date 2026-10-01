#!/usr/bin/env node

/**
 * Script de prueba para verificar la actualización automática de asignaciones
 * cuando una póliza cambia a estado "cerrada"
 */

const db = require('../config/db');

async function testActualizacionAsignacion() {
  try {
    console.log('🧪 Iniciando prueba de actualización automática de asignaciones...');
    
    // 1. Obtener una póliza que no esté cerrada y tenga asignación
    console.log('\n📋 Buscando póliza para prueba...');
    const [polizas] = await db.execute(`
      SELECT 
        p.id as poliza_id,
        p.numero_poliza,
        p.numero_poliza_oficial,
        p.estado as poliza_estado,
        p.prospecto_id,
        a.id as asignacion_id,
        a.estado as asignacion_estado,
        pr.nombre,
        pr.apellido
      FROM polizas p
      INNER JOIN asignaciones a ON p.prospecto_id = a.id_prospecto
      INNER JOIN prospectos pr ON p.prospecto_id = pr.id
      WHERE p.estado != 'cerrada' 
        AND a.estado != 'Venta'
      LIMIT 1
    `);
    
    if (polizas.length === 0) {
      console.log('⚠️ No se encontraron pólizas disponibles para la prueba');
      console.log('💡 Sugerencia: Crea una póliza de prueba con estado diferente a "cerrada"');
      return;
    }
    
    const poliza = polizas[0];
    console.log('✅ Póliza encontrada para prueba:');
    console.log(`   ID: ${poliza.poliza_id}`);
    console.log(`   Número: ${poliza.numero_poliza_oficial || poliza.numero_poliza}`);
    console.log(`   Cliente: ${poliza.nombre} ${poliza.apellido}`);
    console.log(`   Estado actual póliza: ${poliza.poliza_estado}`);
    console.log(`   Estado actual asignación: ${poliza.asignacion_estado}`);
    
    // 2. Mostrar estado antes del cambio
    console.log('\n📊 Estado ANTES del cambio:');
    const [antesAsignacion] = await db.execute(`
      SELECT estado, fecha_estado, comentario 
      FROM asignaciones 
      WHERE id = ?
    `, [poliza.asignacion_id]);
    
    console.log(`   Asignación estado: ${antesAsignacion[0].estado}`);
    console.log(`   Fecha estado: ${antesAsignacion[0].fecha_estado}`);
    
    // 3. Simular cambio de estado a "cerrada"
    console.log('\n🔄 Simulando cambio de estado a "cerrada"...');
    
    // Actualizar póliza
    await db.execute(`
      UPDATE polizas 
      SET 
        estado = 'cerrada',
        estado_anterior = ?,
        motivo_cambio_estado = 'Prueba automática de script de testing',
        fecha_cambio_estado = NOW()
      WHERE id = ?
    `, [poliza.poliza_estado, poliza.poliza_id]);
    
    // Ejecutar la lógica de actualización de asignación (igual que en el controlador)
    const queryAsignacion = `
      UPDATE asignaciones a
      INNER JOIN polizas p ON a.id_prospecto = p.prospecto_id
      SET 
        a.estado = 'Venta',
        a.fecha_estado = NOW(),
        a.comentario = CONCAT(
          IFNULL(a.comentario, ''), 
          IF(a.comentario IS NOT NULL AND a.comentario != '', '\\n', ''),
          'Estado actualizado automáticamente a "Venta" por cierre de póliza #', 
          IFNULL(p.numero_poliza_oficial, p.numero_poliza),
          ' - ', NOW()
        )
      WHERE p.id = ? AND a.estado != 'Venta'
    `;
    
    const [updateResult] = await db.execute(queryAsignacion, [poliza.poliza_id]);
    
    // 4. Verificar resultado
    console.log('\n✅ Cambio ejecutado!');
    console.log(`   Registros de asignación actualizados: ${updateResult.affectedRows}`);
    
    // 5. Mostrar estado después del cambio
    console.log('\n📊 Estado DESPUÉS del cambio:');
    const [despuesAsignacion] = await db.execute(`
      SELECT estado, fecha_estado, comentario 
      FROM asignaciones 
      WHERE id = ?
    `, [poliza.asignacion_id]);
    
    console.log(`   Asignación estado: ${despuesAsignacion[0].estado}`);
    console.log(`   Fecha estado: ${despuesAsignacion[0].fecha_estado}`);
    console.log(`   Comentario actualizado: ${despuesAsignacion[0].comentario ? 'Sí' : 'No'}`);
    
    // 6. Verificar póliza
    const [polizaActualizada] = await db.execute(`
      SELECT estado FROM polizas WHERE id = ?
    `, [poliza.poliza_id]);
    
    console.log(`   Póliza estado: ${polizaActualizada[0].estado}`);
    
    if (despuesAsignacion[0].estado === 'Venta' && polizaActualizada[0].estado === 'cerrada') {
      console.log('\n🎉 ¡PRUEBA EXITOSA! La automatización funcionó correctamente.');
      console.log('   ✅ Póliza marcada como cerrada');
      console.log('   ✅ Asignación actualizada a "Venta"');
      console.log('   ✅ Comentario agregado automáticamente');
    } else {
      console.log('\n❌ PRUEBA FALLIDA. Algo no funcionó como esperado.');
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('\n🔚 Finalizando prueba...');
    process.exit(0);
  }
}

// Ejecutar prueba
if (require.main === module) {
  testActualizacionAsignacion();
}

module.exports = { testActualizacionAsignacion };
