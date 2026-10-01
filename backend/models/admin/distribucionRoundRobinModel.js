const db = require('../../config/db');

const DistribucionRoundRobin = {
  // 🆕 DISTRIBUCIÓN 3-2-1 CÍCLICA EXACTA
  // Expert: 3 casos por ronda | Senior: 2 casos por ronda | Junior: 1 caso por ronda
  async getNextVendedor(categoriaId = null) {
    await db.query('START TRANSACTION');
    
    try {
      // 📊 Obtener información de categorías y vendedores
      const [categorias] = await db.query(`
        SELECT id, nombre, capacidad_maxima, prioridad 
        FROM categorias_config 
        WHERE activa = 1
        ORDER BY prioridad ASC
      `);

      if (categorias.length === 0) {
        throw new Error("No hay categorías activas configuradas");
      }

      // 🔄 Mapeo de cuotas por categoría
      const cuotasPorCategoria = {
        1: { nombre: 'Expert', cuota: 3 },  // Prioridad 1 = 3 casos
        2: { nombre: 'Senior', cuota: 2 },  // Prioridad 2 = 2 casos
        3: { nombre: 'Junior', cuota: 1 }   // Prioridad 3 = 1 caso
      };

      // 📋 Construir secuencia de distribución cíclica
      // Ejemplo con 1 Expert, 1 Senior, 1 Junior:
      // [Expert, Expert, Expert, Senior, Senior, Junior]
      const secuenciaDistribucion = [];
      for (const categoria of categorias) {
        const cuota = cuotasPorCategoria[categoria.prioridad]?.cuota || 1;
        for (let i = 0; i < cuota; i++) {
          secuenciaDistribucion.push(categoria.id);
        }
      }

      // 📊 Obtener posición global actual (usar categoría 1 como referencia)
      const [distribucionGlobal] = await db.query(`
        SELECT posicion_en_secuencia, contador_ronda
        FROM distribucion_round_robin 
        WHERE categoria_id = 1 FOR UPDATE
      `);

      const posicionActual = (distribucionGlobal[0]?.posicion_en_secuencia || 0) % secuenciaDistribucion.length;
      const siguienteCategoriaId = secuenciaDistribucion[posicionActual];
      const contadorRonda = distribucionGlobal[0]?.contador_ronda || 1;

      console.log(`🔄 Distribución 3-2-1 - Posición: ${posicionActual}, Categoría: ${siguienteCategoriaId}, Secuencia: ${secuenciaDistribucion.join('→')}`);

      // 👥 Obtener vendedores de la siguiente categoría (sin validar capacidad)
      const [vendedoresCategoría] = await db.query(`
        SELECT u.id, u.first_name, u.last_name, u.categoria_id,
               COUNT(CASE WHEN p.origen != 'Vendedor-App' THEN a.id END) as current_load,
               cc.nombre as categoria_nombre
        FROM users u
        LEFT JOIN asignaciones a ON u.id = a.id_vendedor
        LEFT JOIN prospectos p ON p.id = a.id_prospecto
        LEFT JOIN categorias_config cc ON u.categoria_id = cc.id
        WHERE u.role = 1 AND u.is_enabled = 1 AND u.categoria_id = ?
        GROUP BY u.id
        ORDER BY u.id ASC
      `, [siguienteCategoriaId]);

      if (vendedoresCategoría.length === 0) {
        console.warn(`⚠️ Sin vendedores disponibles en categoría ${siguienteCategoriaId}, buscando alternativa...`);
        
        // Si no hay disponibles, buscar en cualquier categoría
        const [vendedoresAlternativa] = await db.query(`
          SELECT u.id, u.first_name, u.last_name, u.categoria_id,
                 COUNT(CASE WHEN p.origen != 'Vendedor-App' THEN a.id END) as current_load,
                 cc.nombre as categoria_nombre,
                 cc.prioridad
          FROM users u
          LEFT JOIN asignaciones a ON u.id = a.id_vendedor
          LEFT JOIN prospectos p ON p.id = a.id_prospecto
          LEFT JOIN categorias_config cc ON u.categoria_id = cc.id
          WHERE u.role = 1 AND u.is_enabled = 1 AND cc.activa = 1
          GROUP BY u.id
          ORDER BY current_load ASC, cc.prioridad ASC, u.id ASC
          LIMIT 1
        `);

        if (vendedoresAlternativa.length === 0) {
          await db.query('ROLLBACK');
          throw new Error("❌ No hay vendedores disponibles en el sistema");
        }

        const vendedor = vendedoresAlternativa[0];
        console.log(`✅ Asignado a vendedor alternativo: ${vendedor.first_name} (${vendedor.categoria_nombre})`);
        
        await db.query('COMMIT');
        return vendedor;
      }

      // 🎯 Obtener el siguiente vendedor en round-robin dentro de la categoría
      // Obtener el último vendedor de ESTA CATEGORÍA específicamente
      const [ultimoVendedorData] = await db.query(`
        SELECT ultimo_vendedor_id
        FROM distribucion_round_robin 
        WHERE categoria_id = ?
      `, [siguienteCategoriaId]);

      const ultimoVendedorIdParaCategoria = ultimoVendedorData[0]?.ultimo_vendedor_id;
      let vendedorSeleccionado;

      if (ultimoVendedorIdParaCategoria && vendedoresCategoría.some(v => v.id === ultimoVendedorIdParaCategoria)) {
        // El último vendedor de esta categoría existe, buscar el siguiente
        const indexUltimo = vendedoresCategoría.findIndex(v => v.id === ultimoVendedorIdParaCategoria);
        vendedorSeleccionado = vendedoresCategoría[(indexUltimo + 1) % vendedoresCategoría.length];
      } else {
        // Primera asignación de esta categoría, comenzar desde el primero
        vendedorSeleccionado = vendedoresCategoría[0];
      }

      console.log(`✅ Distribución 3-2-1 - Asignado: ${vendedorSeleccionado.first_name} (${vendedorSeleccionado.categoria_nombre}) | Prospectos: ${vendedorSeleccionado.current_load}`);

      // 📝 Actualizar posición global para TODAS las categorías Y el último vendedor para la categoría actual
      const nuevaPosicion = (posicionActual + 1) % secuenciaDistribucion.length;
      const nuevoContadorRonda = nuevaPosicion === 0 ? contadorRonda + 1 : contadorRonda;

      // Actualizar la posición en todas las categorías
      for (const categoria of categorias) {
        // Solo actualizar ultimo_vendedor_id si es la categoría actual
        await db.query(`
          UPDATE distribucion_round_robin 
          SET posicion_en_secuencia = ?,
              contador_ronda = ?,
              ultimo_vendedor_id = CASE WHEN categoria_id = ? THEN ? ELSE ultimo_vendedor_id END,
              fecha_ultima_asignacion = NOW()
          WHERE categoria_id = ?
        `, [nuevaPosicion, nuevoContadorRonda, siguienteCategoriaId, vendedorSeleccionado.id, categoria.id]);
      }

      await db.query('COMMIT');
      return vendedorSeleccionado;

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Error en distribución 3-2-1:', error);
      throw error;
    }
  },

  // 📊 Obtener estado actual de la distribución 3-2-1
  async getEstadoDistribucion() {
    const [estado] = await db.query(`
      SELECT 
        cc.id,
        cc.nombre,
        cc.prioridad,
        cc.capacidad_maxima,
        drr.posicion_en_secuencia,
        drr.contador_ronda,
        drr.ultimo_vendedor_id,
        CONCAT(u.first_name, ' ', u.last_name) as ultimo_vendedor_nombre,
        drr.fecha_ultima_asignacion
      FROM categorias_config cc
      LEFT JOIN distribucion_round_robin drr ON cc.id = drr.categoria_id
      LEFT JOIN users u ON drr.ultimo_vendedor_id = u.id
      WHERE cc.activa = 1
      ORDER BY cc.prioridad ASC
    `);

    const cuotas = { 1: 3, 2: 2, 3: 1 };
    
    return {
      distribucion: estado,
      secuenciaEsperada: estado.map(e => {
        const cuota = cuotas[e.prioridad];
        return `${e.nombre}(${cuota})`;
      }).join(' → '),
      timestamp: new Date()
    };
  },

  // 🔄 Resetear distribución 3-2-1 para una nueva ronda
  async resetearDistribucion3_2_1() {
    try {
      await db.query('START TRANSACTION');
      
      const [categorias] = await db.query(`
        SELECT id FROM categorias_config WHERE activa = 1
      `);

      for (const cat of categorias) {
        await db.query(`
          UPDATE distribucion_round_robin 
          SET ultimo_vendedor_id = NULL, 
              posicion_en_secuencia = 0,
              contador_ronda = contador_ronda + 1,
              fecha_ultima_asignacion = NOW()
          WHERE categoria_id = ?
        `, [cat.id]);
      }

      await db.query('COMMIT');
      console.log('✅ Distribución 3-2-1 reseteada - Nueva ronda iniciada');
      return { success: true, message: 'Nueva ronda de distribución iniciada' };
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('❌ Error reseteando distribución:', error);
      throw error;
    }
  },

  // 📊 Obtener estadísticas detalladas de distribución
  async getEstadisticasDistribucion() {
    const [stats] = await db.query(`
      SELECT 
        cc.id as categoria_id,
        cc.nombre as categoria_nombre,
        cc.capacidad_maxima,
        COUNT(u.id) as total_vendedores,
        SUM(CASE WHEN u.is_enabled = 1 THEN 1 ELSE 0 END) as vendedores_activos,
        COALESCE(SUM(
          (SELECT COUNT(*) FROM asignaciones a JOIN prospectos p ON p.id = a.id_prospecto WHERE a.id_vendedor = u.id AND p.origen != 'Vendedor-App')
        ), 0) as total_prospectos,
        ROUND(AVG(
          (SELECT COUNT(*) FROM asignaciones a JOIN prospectos p ON p.id = a.id_prospecto WHERE a.id_vendedor = u.id AND p.origen != 'Vendedor-App')
        ), 2) as promedio_prospectos_por_vendedor,
        drr.ultimo_vendedor_id,
        CONCAT(uv.first_name, ' ', uv.last_name) as ultimo_vendedor_nombre,
        drr.fecha_ultima_asignacion
      FROM categorias_config cc
      LEFT JOIN users u ON cc.id = u.categoria_id AND u.role = 1
      LEFT JOIN distribucion_round_robin drr ON cc.id = drr.categoria_id
      LEFT JOIN users uv ON drr.ultimo_vendedor_id = uv.id
      WHERE cc.activa = 1
      GROUP BY cc.id
      ORDER BY cc.prioridad ASC
    `);

    return stats;
  },

  // Reset del round-robin para una categoría
  async resetRoundRobin(categoriaId) {
    await db.query(`
      UPDATE distribucion_round_robin 
      SET ultimo_vendedor_id = NULL, fecha_ultima_asignacion = NULL
      WHERE categoria_id = ?
    `, [categoriaId]);
  },

  // Obtener la carga actual de vendedores por categoría
  async getCargaVendedores(categoriaId = null) {
    let query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.categoria_id,
        cc.nombre as categoria_nombre,
        cc.capacidad_maxima,
        COUNT(CASE WHEN p.origen != 'Vendedor-App' THEN a.id END) as current_load,
        ROUND((COUNT(CASE WHEN p.origen != 'Vendedor-App' THEN a.id END) / cc.capacidad_maxima) * 100, 2) as porcentaje_carga,
        u.is_enabled
      FROM users u
      LEFT JOIN asignaciones a ON u.id = a.id_vendedor
      LEFT JOIN prospectos p ON p.id = a.id_prospecto
      LEFT JOIN categorias_config cc ON u.categoria_id = cc.id
      WHERE u.role = 1
    `;

    const params = [];
    if (categoriaId) {
      query += ` AND u.categoria_id = ?`;
      params.push(categoriaId);
    }

    query += `
      GROUP BY u.id
      ORDER BY cc.prioridad ASC, current_load ASC, u.first_name ASC
    `;

    const [carga] = await db.query(query, params);
    return carga;
  }
};

module.exports = DistribucionRoundRobin;
