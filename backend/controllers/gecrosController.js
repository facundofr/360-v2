const gecrosService = require('../services/gecrosService');
const db = require('../config/db');

// ⚠️ TEMPORAL (2026-09-21): la API de Gecros (apis.cober.com.ar) responde 503.
// Se desactivan todas las consultas para que el alta/cotización no se frene.
// Para reactivar: poner GECROS_HABILITADO = true (y el flag del frontend en
// frontend/src/components/config.js).
const GECROS_HABILITADO = true;
const RESPUESTA_DESHABILITADA = {
  success: false,
  disponible: false,
  message: 'Consulta a Gecros deshabilitada temporalmente: la API del proveedor no está disponible.',
};

class GecrosController {
  /**
   * Consulta el historial de un afiliado por DNI y guarda el estado
   */
  async consultarPorDni(req, res) {
    try {
      // ⚠️ TEMPORAL: sin llamada a Gecros ni escritura de gecros_estado.
      // Se responde en el formato que el formulario ya entiende, para que muestre
      // un cartel neutro en vez de un error rojo.
      if (!GECROS_HABILITADO) {
        return res.status(200).json({
          success: true,
          disponible: false,
          estado: 'Consulta no disponible',
          consultado_at: new Date().toISOString(),
        });
      }

      const { dni } = req.params;
      const { prospectoId } = req.query; // ID del prospecto para actualizar

      if (!dni || dni.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'DNI requerido',
        });
      }

      const resultado = await gecrosService.getAfiliadoByDni(dni);

      // Extraer solo el estado de cobertura. Un mismo DNI puede tener varios registros
      // (p. ej. baja como HIJO/A y alta como TITULAR): si alguno está vigente, vale ese.
      let estado = 'Sin información';
      const registros = Array.isArray(resultado.data) ? resultado.data : [];
      if (registros.length > 0) {
        const vigente = registros.find(r => (r.estado || '').toLowerCase().startsWith('con cobertura'));
        estado = (vigente || registros[0]).estado || 'Sin información';
      }

      // Si se proporciona prospectoId, siempre guardar en la base de datos
      if (prospectoId) {
        await db.query(
          'UPDATE prospectos SET gecros_estado = ?, gecros_consultado_at = NOW() WHERE id = ?',
          [estado, prospectoId]
        );
      }

      return res.status(200).json({
        success: true,
        estado: estado,
        consultado_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error al consultar Gecros por DNI:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al consultar el historial en Gecros',
        error: error.message,
      });
    }
  }

  /**
   * Consulta el historial de un afiliado por CUIL
   */
  async consultarPorCuil(req, res) {
    try {
      // ⚠️ TEMPORAL: Gecros deshabilitado.
      if (!GECROS_HABILITADO) {
        return res.status(503).json(RESPUESTA_DESHABILITADA);
      }

      const { cuil } = req.params;

      if (!cuil || cuil.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'CUIL requerido',
        });
      }

      const resultado = await gecrosService.getAfiliadoByCuil(cuil);

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error('Error al consultar Gecros por CUIL:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al consultar el historial en Gecros',
        error: error.message,
      });
    }
  }

  /**
   * Búsqueda flexible de afiliados
   */
  async buscarAfiliados(req, res) {
    try {
      // ⚠️ TEMPORAL: Gecros deshabilitado.
      if (!GECROS_HABILITADO) {
        return res.status(503).json(RESPUESTA_DESHABILITADA);
      }

      const { benNom, benApe, cuil, numero, docId } = req.query;

      const params = {};
      if (benNom) params.benNom = benNom;
      if (benApe) params.benApe = benApe;
      if (cuil) params.cuil = cuil;
      if (numero) params.numero = numero;
      if (docId) params.docId = docId;

      if (Object.keys(params).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar al menos un parámetro de búsqueda',
        });
      }

      const resultado = await gecrosService.searchAfiliados(params);

      return res.status(200).json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      console.error('Error al buscar en Gecros:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al buscar en Gecros',
        error: error.message,
      });
    }
  }

  /**
   * Descarga la credencial del afiliado
   */
  async descargarCredencial(req, res) {
    try {
      // ⚠️ TEMPORAL: Gecros deshabilitado.
      if (!GECROS_HABILITADO) {
        return res.status(503).json(RESPUESTA_DESHABILITADA);
      }

      const { benId } = req.params;

      if (!benId) {
        return res.status(400).json({
          success: false,
          message: 'benId requerido',
        });
      }

      const credencial = await gecrosService.getCredencial(benId);

      // Configurar headers para descargar la imagen
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="credencial_${benId}.jpg"`,
      });

      return res.send(credencial);
    } catch (error) {
      console.error('Error al descargar credencial de Gecros:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al descargar credencial de Gecros',
        error: error.message,
      });
    }
  }
}

module.exports = new GecrosController();
