const db = require('../config/db');
const NotificationsService = require('./notificationsService');

class RefritosVisibilityService {
  /**
   * Promover el siguiente refrito en cola cuando el actual sale del estado Lead
   * @param {number} vendedorId - ID del vendedor
   * @returns {Promise<Object>} Resultado de la promoción
   */
  static async promoverSiguienteRefrito(vendedorId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // 1. Obtener el siguiente refrito en cola (el más antiguo en estado Lead)
      const [siguienteRefrito] = await connection.query(`
        SELECT a.id, a.id_prospecto
        FROM asignaciones a
        INNER JOIN prospectos p ON p.id = a.id_prospecto
        WHERE a.id_vendedor = ?
          AND p.es_reciclado = 1
          AND a.estado = 'Lead'
          AND a.visible_refrito = 0
        ORDER BY a.fecha_asignacion ASC
        LIMIT 1
      `, [vendedorId]);

      if (siguienteRefrito.length === 0) {
        await connection.commit();
        return {
          success: true,
          message: 'No hay más refritos en cola',
          nuevoVisible: null
        };
      }

      // 2. Marcar el siguiente como visible
      await connection.query(`
        UPDATE asignaciones
        SET visible_refrito = 1
        WHERE id = ?
      `, [siguienteRefrito[0].id]);

      // Obtener datos del prospecto y notificar asignación visible
      try {
        const [pRows] = await connection.query(`
          SELECT p.id, p.nombre, p.apellido, p.numero_contacto, p.estado
          FROM prospectos p
          WHERE p.id = ?
          LIMIT 1
        `, [siguienteRefrito[0].id_prospecto]);
        if (pRows && pRows.length > 0) {
          await NotificationsService.notificarAsignacionProspecto(vendedorId, pRows[0]);
        }
      } catch (nerr) {
        console.warn('⚠️  No se pudo enviar notificación FCM al promover refrito:', nerr.message);
      }

      await connection.commit();

      return {
        success: true,
        message: 'Siguiente refrito promovido',
        nuevoVisible: siguienteRefrito[0]
      };

    } catch (error) {
      await connection.rollback();
      console.error('Error al promover siguiente refrito:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Autocorrección: si el vendedor no tiene ningún refrito visible en Lead pero sí tiene cola,
   * promueve el siguiente. Cubre los caminos que sacan al refrito de Lead con un UPDATE directo
   * sin pasar por onCambioEstadoProspecto (registrar llamada, cotización, promociones, WhatsApp...),
   * que dejaban al vendedor sin refrito para gestionar y la cola trabada.
   * @param {number} vendedorId - ID del vendedor
   */
  static async asegurarRefritoVisible(vendedorId) {
    try {
      const [[{ visibles }]] = await db.query(`
        SELECT COUNT(*) AS visibles
        FROM asignaciones a
        INNER JOIN prospectos p ON p.id = a.id_prospecto
        WHERE a.id_vendedor = ?
          AND p.es_reciclado = 1
          AND a.estado = 'Lead'
          AND a.visible_refrito = 1
      `, [vendedorId]);

      if (visibles > 0) return;

      const resultado = await this.promoverSiguienteRefrito(vendedorId);
      if (resultado.nuevoVisible) {
        console.log(`♻️ Refrito ${resultado.nuevoVisible.id_prospecto} promovido para vendedor ${vendedorId}: no tenía ninguno visible en Lead`);
      }
    } catch (error) {
      console.error('Error al asegurar refrito visible:', error);
      // No bloquear la carga de la lista del vendedor
    }
  }

  /**
   * Hook para ejecutar cuando cambia el estado de un prospecto reciclado
   * @param {number} prospectoId - ID del prospecto
   * @param {string} nuevoEstado - Nuevo estado del prospecto
   * @param {number|null} vendedorId - ID del vendedor que hizo el cambio (opcional, se busca si no se pasa)
   * @returns {Promise<void>}
   */
  static async onCambioEstadoProspecto(prospectoId, nuevoEstado, vendedorId = null) {
    try {
      // Solo actuar si el prospecto es reciclado y sale del estado Lead
      const [prospecto] = await db.query(`
        SELECT es_reciclado FROM prospectos WHERE id = ?
      `, [prospectoId]);

      if (!prospecto[0] || !prospecto[0].es_reciclado) {
        return; // No es un refrito, no hacer nada
      }

      if (nuevoEstado === 'Lead') {
        return; // Sigue en Lead, no hacer nada
      }

      // Obtener la asignación correcta: del vendedor específico, o la más reciente
      let asignacion;
      if (vendedorId) {
        const [rows] = await db.query(`
          SELECT id_vendedor, visible_refrito 
          FROM asignaciones 
          WHERE id_prospecto = ? AND id_vendedor = ?
          ORDER BY fecha_asignacion DESC 
          LIMIT 1
        `, [prospectoId, vendedorId]);
        asignacion = rows;
      } else {
        const [rows] = await db.query(`
          SELECT id_vendedor, visible_refrito 
          FROM asignaciones 
          WHERE id_prospecto = ? 
          ORDER BY fecha_asignacion DESC 
          LIMIT 1
        `, [prospectoId]);
        asignacion = rows;
      }

      if (asignacion.length === 0) {
        return; // No hay asignación, no hacer nada
      }

      const { id_vendedor, visible_refrito } = asignacion[0];

      // 🔄 REASIGNACIÓN AUTOMÁTICA: Si el estado es "No contesta", reasignar a otro vendedor
      // En este caso también se promueve la cola del vendedor actual (perdió su visible)
      if (nuevoEstado === 'No contesta') {
        console.log(`🔄 Refrito ${prospectoId} marcado como "No contesta" por vendedor ${id_vendedor} - Iniciando reasignación automática...`);
        await this.reasignarRefritoNoContesta(prospectoId, id_vendedor);
        // Promover siguiente en cola para el vendedor que marcó No contesta
        if (visible_refrito === 1) {
          await this.promoverSiguienteRefrito(id_vendedor);
          console.log(`✅ Siguiente refrito promovido para vendedor ${id_vendedor} tras No contesta`);
        }
        return;
      }

      // Para cualquier otro estado: el refrito sigue siendo del vendedor pero sale de Lead.
      // Si estaba visible, promover el siguiente de su cola.
      if (visible_refrito === 1) {
        await this.promoverSiguienteRefrito(id_vendedor);
        console.log(`✅ Siguiente refrito promovido para vendedor ${id_vendedor} tras cambio de estado a ${nuevoEstado}`);
      }

    } catch (error) {
      console.error('Error en hook de cambio de estado:', error);
      // No lanzar error para no bloquear el cambio de estado
    }
  }

  /**
   * 🔄 REASIGNAR REFRITO POR "NO CONTESTA"
   * Busca el siguiente vendedor y crea una nueva asignación
   * Si ya pasó por todos los vendedores, marca como definitivo
   * @param {number} prospectoId - ID del prospecto
   * @param {number} vendedorActualId - ID del vendedor actual
   */
  static async reasignarRefritoNoContesta(prospectoId, vendedorActualId) {
    try {
      // 1. Obtener historial de vendedores que ya intentaron contactar este refrito
      const [historialAsignaciones] = await db.query(`
        SELECT DISTINCT id_vendedor 
        FROM asignaciones 
        WHERE id_prospecto = ?
      `, [prospectoId]);

      const vendedoresQueYaIntentaron = historialAsignaciones.map(a => a.id_vendedor);

      // 2. Obtener todos los vendedores activos
      const [vendedoresActivos] = await db.query(`
        SELECT id, first_name, last_name
        FROM users
        WHERE role = 1 AND is_enabled = 1
        ORDER BY id ASC
      `);

      if (vendedoresActivos.length === 0) {
        console.log(`⚠️ No hay vendedores activos disponibles`);
        return;
      }

      // 3. Filtrar vendedores que NO han intentado contactar este refrito
      const vendedoresDisponibles = vendedoresActivos.filter(
        v => !vendedoresQueYaIntentaron.includes(v.id)
      );

      // 4. Si ya pasó por todos los vendedores → marcar como definitivo "No contesta"
      if (vendedoresDisponibles.length === 0) {
        console.log(`🔴 Refrito ${prospectoId} ya pasó por TODOS los vendedores (${vendedoresQueYaIntentaron.length}). Marcando como definitivo.`);
        
        // Actualizar comentario indicando que es definitivo
        await db.query(`
          UPDATE asignaciones 
          SET comentario = CONCAT(IFNULL(comentario, ''), ' | ⛔ DEFINITIVO: Pasó por todos los vendedores sin contacto')
          WHERE id_prospecto = ? 
          ORDER BY fecha_asignacion DESC 
          LIMIT 1
        `, [prospectoId]);

        // Registrar en historial
        await this.registrarEnHistorial(prospectoId, vendedorActualId, 
          `⛔ Refrito marcado como "No contesta" DEFINITIVO. Pasó por ${vendedoresQueYaIntentaron.length} vendedores sin contacto exitoso.`
        );

        return {
          success: false,
          motivo: 'TODOS_VENDEDORES_INTENTARON',
          mensaje: `Refrito ya pasó por todos los ${vendedoresQueYaIntentaron.length} vendedores disponibles`
        };
      }

      // 5. Seleccionar siguiente vendedor (round-robin entre los disponibles)
      const indiceActual = vendedoresActivos.findIndex(v => v.id === vendedorActualId);
      let siguienteVendedor = null;

      // Buscar el siguiente vendedor disponible en orden circular
      for (let i = 1; i <= vendedoresActivos.length; i++) {
        const indice = (indiceActual + i) % vendedoresActivos.length;
        const candidato = vendedoresActivos[indice];
        if (!vendedoresQueYaIntentaron.includes(candidato.id)) {
          siguienteVendedor = candidato;
          break;
        }
      }

      if (!siguienteVendedor) {
        siguienteVendedor = vendedoresDisponibles[0]; // Fallback al primero disponible
      }

      // 6. Actualizar la asignación del vendedor actual a 'No contesta' y ocultar
      await db.query(`
        UPDATE asignaciones
        SET estado = 'No contesta', visible_refrito = 0, fecha_estado = NOW()
        WHERE id_prospecto = ? AND id_vendedor = ?
        ORDER BY fecha_asignacion DESC
        LIMIT 1
      `, [prospectoId, vendedorActualId]);

      // 7. Verificar si el nuevo vendedor ya tiene un refrito visible en Lead
      const [tieneVisible] = await db.query(`
        SELECT COUNT(*) as total
        FROM asignaciones a
        INNER JOIN prospectos p ON p.id = a.id_prospecto AND p.es_reciclado = 1
        WHERE a.id_vendedor = ? AND a.estado = 'Lead' AND a.visible_refrito = 1
      `, [siguienteVendedor.id]);
      const debeSerVisible = tieneVisible[0].total === 0;

      // 8. Crear nueva asignación para el siguiente vendedor
      await db.query(`
        INSERT INTO asignaciones (id_prospecto, id_vendedor, estado, comentario, fecha_estado, visible_refrito)
        VALUES (?, ?, 'Lead', ?, NOW(), ?)
      `, [
        prospectoId,
        siguienteVendedor.id,
        `♻️ Reasignación automática (intento ${vendedoresQueYaIntentaron.length + 1}/${vendedoresActivos.length}) - Vendedor anterior no pudo contactar`,
        debeSerVisible ? 1 : 0
      ]);

      // 8. Registrar en historial
      await this.registrarEnHistorial(prospectoId, siguienteVendedor.id,
        `♻️ Refrito REASIGNADO automáticamente de vendedor ID ${vendedorActualId} a ${siguienteVendedor.first_name} ${siguienteVendedor.last_name} (intento ${vendedoresQueYaIntentaron.length + 1}/${vendedoresActivos.length})`
      );

      console.log(`✅ Refrito ${prospectoId} reasignado: Vendedor ${vendedorActualId} → ${siguienteVendedor.id} (${siguienteVendedor.first_name} ${siguienteVendedor.last_name})`);
      console.log(`   📊 Intento ${vendedoresQueYaIntentaron.length + 1} de ${vendedoresActivos.length} vendedores`);

      return {
        success: true,
        vendedorAnterior: vendedorActualId,
        vendedorNuevo: siguienteVendedor.id,
        vendedorNombre: `${siguienteVendedor.first_name} ${siguienteVendedor.last_name}`,
        intentoNumero: vendedoresQueYaIntentaron.length + 1,
        totalVendedores: vendedoresActivos.length,
        esVisible: debeSerVisible
      };

    } catch (error) {
      console.error('❌ Error al reasignar refrito:', error);
      // No lanzar error para no bloquear el flujo
    }
  }

  /**
   * 📝 Registrar acción en historial de prospectos
   */
  static async registrarEnHistorial(prospectoId, vendedorId, descripcion) {
    try {
      await db.query(`
        INSERT INTO prospecto_historial (prospecto_id, accion, descripcion, usuario_id, fecha)
        VALUES (?, 'REASIGNACION_REFRITO', ?, ?, NOW())
      `, [prospectoId, descripcion, vendedorId]);
    } catch (error) {
      // Si falla el historial, no es crítico - solo log
      console.log('⚠️ No se pudo registrar en historial:', error.message);
    }
  }

  /**
   * Obtener el refrito visible actual para un vendedor
   * @param {number} vendedorId - ID del vendedor
   * @returns {Promise<Object|null>} Refrito visible o null
   */
  static async obtenerRefritoVisible(vendedorId) {
    try {
      const [refrito] = await db.query(`
        SELECT 
          p.id,
          p.nombre,
          p.apellido,
          p.edad,
          p.numero_contacto,
          p.correo,
          p.localidad,
          p.origen,
          p.estado,
          a.fecha_asignacion,
          a.comentario
        FROM asignaciones a
        INNER JOIN prospectos p ON p.id = a.id_prospecto
        WHERE a.id_vendedor = ?
          AND p.es_reciclado = 1
          AND a.estado = 'Lead'
          AND a.visible_refrito = 1
        LIMIT 1
      `, [vendedorId]);

      return refrito.length > 0 ? refrito[0] : null;
    } catch (error) {
      console.error('Error al obtener refrito visible:', error);
      throw error;
    }
  }

  /**
   * Contar refritos en cola para un vendedor
   * @param {number} vendedorId - ID del vendedor
   * @returns {Promise<number>} Cantidad de refritos en cola
   */
  static async contarRefritosEnCola(vendedorId) {
    try {
      const [resultado] = await db.query(`
        SELECT COUNT(*) as total
        FROM asignaciones a
        INNER JOIN prospectos p ON p.id = a.id_prospecto
        WHERE a.id_vendedor = ?
          AND p.es_reciclado = 1
          AND a.estado = 'Lead'
          AND a.visible_refrito = 0
      `, [vendedorId]);

      return resultado[0].total;
    } catch (error) {
      console.error('Error al contar refritos en cola:', error);
      throw error;
    }
  }
}

module.exports = RefritosVisibilityService;
