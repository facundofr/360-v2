const cron = require('node-cron');
const ReAsignacionAutomatica = require('../models/ReAsignacionAutomatica');
const DistribucionRoundRobin = require('../models/admin/distribucionRoundRobinModel');
const Holidays = require('../utils/holidays');
const db = require('../config/db');
const emailService = require('../services/emailService');

class ReasignacionAutomaticaJob {
  static iniciar() {
    // Ejecutar cada 1 hora en días laborales (L-V)
    const job = cron.schedule('0 * * * 1-5', async () => {
      console.log('🔔 CRON TRIGGER - Iniciando ejecución de reasignaciones automáticas');
      console.log(`   Hora: ${new Date().toLocaleString('es-AR')}`);
      try {
        await this.ejecutarReasignaciones();
      } catch (error) {
        console.error('❌ Error en job de reasignación automática:', error);
        console.error('   Stack:', error.stack);
      }
    }, { timezone: 'America/Argentina/Buenos_Aires' });

    console.log('✅ Job de reasignación automática iniciado (cada 1 hora)');
    console.log(`   Próxima ejecución programada: cada 1 hora en punto (L-V)`);
    console.log(`   Horarios: en punto de cada hora, 00:00 a 23:00`);
    return job;
  }

  static async ejecutarReasignaciones() {
    const inicio = new Date();
    let reasignacionesRealizadas = 0;
    let errores = 0;

    try {
      // Defensa adicional: evitar ejecución fuera de días/horarios hábiles
      const now = new Date();
      const day = now.getDay(); // 0=Domingo, 6=Sábado
      const hour = now.getHours();
      if (day === 0 || day === 6 || hour < 9 || hour > 18) {
        console.log('⏸️ Fuera de días/horario hábil (L-V 9-18hs). Se omite ejecución automática.');
        return;
      }

      // Evitar correr en feriados nacionales (Argentina)
      const feriado = await Holidays.isHoliday(now);
      if (feriado) {
        console.log(`⏸️ Hoy es feriado nacional (${feriado.localName || feriado.name}). Se omite ejecución automática.`);
        return;
      }

      // 1. Obtener prospectos sin actividad por 4+ horas
      const prospectosSinActividad = await ReAsignacionAutomatica.obtenerProspectosSinActividad();

      console.log(`📊 Prospectos sin actividad encontrados: ${prospectosSinActividad.length}`);

      for (const prospecto of prospectosSinActividad) {
        try {
          // 2. Obtener vendedor por round-robin 3-2-1
          let vendedorSeleccionado = null;
          let nombreVendedor = '';

          try {
            const vendedorRR = await DistribucionRoundRobin.getNextVendedor();
            // Si el round-robin devuelve el mismo vendedor que se reasigna, hacer fallback
            if (vendedorRR && vendedorRR.id !== prospecto.id_vendedor) {
              vendedorSeleccionado = vendedorRR;
              nombreVendedor = `${vendedorRR.first_name} ${vendedorRR.last_name}`;
              console.log(`🔄 Round-robin 3-2-1 → ${nombreVendedor} (${vendedorRR.categoria_nombre || 'sin categoría'})`);
            } else {
              // Fallback: menor carga (excluye al vendedor actual)
              console.warn(`⚠️ Round-robin devolvió el mismo vendedor, usando fallback por menor carga`);
              const fallback = await ReAsignacionAutomatica.obtenerVendedorDisponible(prospecto.id_vendedor);
              if (fallback) {
                vendedorSeleccionado = fallback;
                nombreVendedor = fallback.nombre;
              }
            }
          } catch (rrError) {
            console.warn(`⚠️ Error en round-robin (${rrError.message}), usando fallback por menor carga`);
            const fallback = await ReAsignacionAutomatica.obtenerVendedorDisponible(prospecto.id_vendedor);
            if (fallback) {
              vendedorSeleccionado = fallback;
              nombreVendedor = fallback.nombre;
            }
          }

          if (!vendedorSeleccionado) {
            console.warn(`⚠️ No hay vendedor disponible para prospecto ${prospecto.id_prospecto}`);
            errores++;
            continue;
          }

          // 3. Reasignar prospecto
          await ReAsignacionAutomatica.reasignarProspecto(
            prospecto.id_prospecto,
            vendedorSeleccionado.id,
            prospecto.id_vendedor,
            // Se informan las horas hábiles, que son las que dispararon la reasignación, y no
            // las reales: un lead asignado a las 02:00 y reasignado a las 10:00 acumula 8 horas
            // reales pero solo 1 hábil. Quedaron registros históricos diciendo "durante 87hrs"
            // por contar el fin de semana entero.
            `Sin actividad durante ${Math.floor(prospecto.minutos_habiles_sin_actividad / 60)}hrs hábiles`,
            'automatica'
          );

          reasignacionesRealizadas++;
          console.log(
            `✅ Prospecto ${prospecto.id_prospecto} (${prospecto.nombre} ${prospecto.apellido}) ` +
            `reasignado a ${nombreVendedor}`
          );

          // 📧 Notificar al nuevo vendedor por email (no bloqueante)
          (async () => {
            try {
              const [[usuarioInfo]] = await db.query(
                'SELECT email FROM users WHERE id = ?',
                [vendedorSeleccionado.id]
              );
              if (usuarioInfo?.email) {
                await emailService.enviarNotificacionLeadAsignado({
                  to: usuarioInfo.email,
                  vendedorNombre: nombreVendedor,
                  leadNombre: `${prospecto.nombre} ${prospecto.apellido}`,
                  leadOrigen: prospecto.origen || 'No especificado',
                  prospectoId: prospecto.id_prospecto
                });
              }
            } catch (emailError) {
              console.error(`❌ No se pudo notificar por email al vendedor ${vendedorSeleccionado.id}:`, emailError.message);
            }
          })();
        } catch (error) {
          console.error(`❌ Error reasignando prospecto ${prospecto.id_prospecto}:`, error.message);
          errores++;
        }
      }

      const duracion = new Date() - inicio;
      console.log(
        `\n📈 REPORTE DE REASIGNACIONES:\n` +
        `   Reasignaciones realizadas: ${reasignacionesRealizadas}\n` +
        `   Errores: ${errores}\n` +
        `   Tiempo total: ${duracion}ms\n`
      );
    } catch (error) {
      console.error('Error crítico en reasignación automática:', error);
    }
  }

  // Método para ejecutar reasignaciones de forma manual (para testing)
  static async ejecutarManual() {
    console.log('🔄 Ejecutando reasignaciones manuales...');
    return this.ejecutarReasignaciones();
  }
}

module.exports = ReasignacionAutomaticaJob;
