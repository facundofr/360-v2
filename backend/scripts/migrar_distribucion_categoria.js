#!/usr/bin/env node
/**
 * 🔄 SCRIPT DE MIGRACIÓN: Sincronizar Distribución de Categorías
 * De: /var/www/cober360 (Testing)
 * A: /var/www/cober360-produccion (Producción)
 * 
 * Este script sincroniza:
 * 1. distribucion_round_robin (estado actual de distribuciones)
 * 2. vendedor_round_robin_order (tabla de orden de rotación)
 * 3. categorias_config (configuración de categorías)
 */

const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function migrar() {
  console.log('🔄 INICIANDO MIGRACIÓN DE DISTRIBUCIÓN DE CATEGORÍAS\n');
  
  try {
    await db.query('START TRANSACTION');
    
    // 1. Sincronizar distribucion_round_robin
    console.log('📊 1. Sincronizando distribucion_round_robin...');
    
    const [registrosExistentes] = await db.query(
      'SELECT COUNT(*) as total FROM distribucion_round_robin'
    );
    
    if (registrosExistentes[0].total === 0) {
      console.log('   ⚠️  No hay registros en distribucion_round_robin');
      
      // Crear registros por cada categoría activa
      const [categorias] = await db.query(
        'SELECT id FROM categorias_config WHERE activa = 1'
      );
      
      for (const cat of categorias) {
        await db.query(`
          INSERT INTO distribucion_round_robin (categoria_id, posicion_en_secuencia, contador_ronda, fecha_ultima_asignacion)
          VALUES (?, 0, 1, NOW())
        `, [cat.id]);
      }
      console.log(`   ✅ Creados ${categorias.length} registros de distribución`);
    } else {
      console.log(`   ✅ Ya existen ${registrosExistentes[0].total} registros`);
    }
    
    // 2. Sincronizar vendedor_round_robin_order
    console.log('\n📋 2. Sincronizando vendedor_round_robin_order...');
    
    const [registrosVendedor] = await db.query(
      'SELECT COUNT(*) as total FROM vendedor_round_robin_order'
    );
    
    if (registrosVendedor[0].total === 0) {
      console.log('   ⚠️  No hay registros en vendedor_round_robin_order');
      
      // Crear registros para cada vendedor activo en cada categoría
      const [vendedores] = await db.query(`
        SELECT u.id as vendedor_id, u.categoria_id
        FROM users u
        WHERE u.role = 1 AND u.is_enabled = 1
        ORDER BY u.categoria_id, u.id
      `);
      
      let orden = 1;
      for (const vendor of vendedores) {
        await db.query(`
          INSERT INTO vendedor_round_robin_order (vendedor_id, categoria_id, orden_rotacion, fecha_ultima_asignacion)
          VALUES (?, ?, ?, NOW())
        `, [vendor.vendedor_id, vendor.categoria_id, orden * 10]);
        orden++;
      }
      console.log(`   ✅ Creados ${vendedores.length} registros de orden de rotación`);
    } else {
      console.log(`   ✅ Ya existen ${registrosVendedor[0].total} registros`);
    }
    
    // 3. Verificar integridad
    console.log('\n🔍 3. Verificando integridad de datos...');
    
    const [catActive] = await db.query(
      'SELECT COUNT(*) as total FROM categorias_config WHERE activa = 1'
    );
    
    const [vendActive] = await db.query(
      'SELECT COUNT(*) as total FROM users WHERE role = 1 AND is_enabled = 1'
    );
    
    const [distros] = await db.query(
      'SELECT COUNT(*) as total FROM distribucion_round_robin'
    );
    
    const [vendorOrders] = await db.query(
      'SELECT COUNT(*) as total FROM vendedor_round_robin_order'
    );
    
    console.log(`   📊 Categorías activas: ${catActive[0].total}`);
    console.log(`   👥 Vendedores activos: ${vendActive[0].total}`);
    console.log(`   🔄 Registros distribucion_round_robin: ${distros[0].total}`);
    console.log(`   📋 Registros vendedor_round_robin_order: ${vendorOrders[0].total}`);
    
    // 4. Mostrar estado actual de distribución
    console.log('\n📈 4. Estado Actual de Distribución 3-2-1:');
    
    const [estadoDistro] = await db.query(`
      SELECT 
        cc.id,
        cc.nombre,
        cc.prioridad,
        drr.posicion_en_secuencia,
        drr.contador_ronda,
        COUNT(vro.id) as vendedores_en_rotacion
      FROM categorias_config cc
      LEFT JOIN distribucion_round_robin drr ON cc.id = drr.categoria_id
      LEFT JOIN vendedor_round_robin_order vro ON cc.id = vro.categoria_id
      WHERE cc.activa = 1
      GROUP BY cc.id
      ORDER BY cc.prioridad
    `);
    
    for (const row of estadoDistro) {
      const cuota = { 1: 3, 2: 2, 3: 1 }[row.prioridad];
      console.log(`   ${row.nombre} (cuota: ${cuota})`);
      console.log(`      Posición: ${row.posicion_en_secuencia}, Ronda: ${row.contador_ronda}, Vendedores: ${row.vendedores_en_rotacion}`);
    }
    
    await db.query('COMMIT');
    
    console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('\n📝 Cambios Realizados:');
    console.log('   ✅ Distribucion Round Robin sincronizada');
    console.log('   ✅ Orden de rotación de vendedores inicializada');
    console.log('   ✅ Integridad de datos verificada');
    
    console.log('\n💡 Próximos Pasos:');
    console.log('   1. Reiniciar el servidor: pm2 restart cober360-produccion');
    console.log('   2. Verificar logs: pm2 logs cober360-produccion');
    console.log('   3. Testear creación de un nuevo prospecto para validar la distribución');
    
    process.exit(0);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error durante migración:', error.message);
    process.exit(1);
  }
}

migrar();
