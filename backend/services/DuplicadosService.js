const db = require('../config/db');

// Estados que se consideran "sin evolución real" del lead: si el original
// sigue en uno de estos estados, se lo trata como recuperable.
const ESTADOS_SIN_EVOLUCION = ['Lead', '1º Contacto', 'No contesta'];

// Días sin cambio de estado a partir de los cuales se considera que el
// original quedó estancado y el duplicado puede reingresar como dato nuevo.
const UMBRAL_DIAS_ESTANCADO = 14;

const DuplicadosService = {
  ESTADOS_SIN_EVOLUCION,
  UMBRAL_DIAS_ESTANCADO,

  /**
   * Evalúa si un prospecto duplicado puede reingresar como dato nuevo,
   * en base al estado y antigüedad de la última asignación del original.
   */
  async evaluarReingreso(idProspectoOriginal) {
    if (!idProspectoOriginal) {
      return {
        reingresable: true,
        motivo: 'No se encontró un prospecto original para comparar',
        estadoOriginal: null,
        diasEstancado: null,
        idVendedorOriginal: null
      };
    }

    const [ultimaAsignacion] = await db.query(
      `SELECT id_vendedor, estado, fecha_estado
       FROM asignaciones
       WHERE id_prospecto = ?
       ORDER BY fecha_asignacion DESC
       LIMIT 1`,
      [idProspectoOriginal]
    );

    if (!ultimaAsignacion || ultimaAsignacion.length === 0) {
      return {
        reingresable: true,
        motivo: 'El original nunca tuvo un vendedor asignado',
        estadoOriginal: null,
        diasEstancado: null,
        idVendedorOriginal: null
      };
    }

    const { id_vendedor: idVendedorOriginal, estado, fecha_estado } = ultimaAsignacion[0];
    const estadoOriginal = (estado || '').trim();
    const diasEstancado = Math.floor((new Date() - new Date(fecha_estado)) / (1000 * 60 * 60 * 24));

    if (!ESTADOS_SIN_EVOLUCION.includes(estadoOriginal)) {
      return {
        reingresable: false,
        motivo: `El original está en un estado avanzado ("${estadoOriginal}") - no se reingresa para no interferir`,
        estadoOriginal,
        diasEstancado,
        idVendedorOriginal
      };
    }

    if (diasEstancado < UMBRAL_DIAS_ESTANCADO) {
      return {
        reingresable: false,
        motivo: `El original todavía está dentro del plazo de gestión (${diasEstancado} días en "${estadoOriginal}", umbral ${UMBRAL_DIAS_ESTANCADO})`,
        estadoOriginal,
        diasEstancado,
        idVendedorOriginal
      };
    }

    return {
      reingresable: true,
      motivo: `Sin evolución tras ${diasEstancado} días en "${estadoOriginal}"`,
      estadoOriginal,
      diasEstancado,
      idVendedorOriginal
    };
  }
};

module.exports = DuplicadosService;
