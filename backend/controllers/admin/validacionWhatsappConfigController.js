const ValidacionWhatsappService = require('../../services/validacionWhatsappService');

const getConfig = async (req, res) => {
  try {
    const config = await ValidacionWhatsappService.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error al obtener config de validación WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Error al obtener la configuración' });
  }
};

const actualizarConfig = async (req, res) => {
  try {
    if (req.user.role !== 3) { // 3 = administrador
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const { activo, cupo_diario } = req.body;

    if (cupo_diario !== undefined && (!Number.isInteger(cupo_diario) || cupo_diario < 0)) {
      return res.status(400).json({ success: false, message: 'cupo_diario debe ser un entero >= 0' });
    }

    const actual = await ValidacionWhatsappService.getConfig();
    const config = await ValidacionWhatsappService.actualizarConfig({
      activo: activo !== undefined ? activo : actual.activo,
      cupo_diario: cupo_diario !== undefined ? cupo_diario : actual.cupo_diario,
    });

    console.log(`⚙️ Config de validación WhatsApp actualizada por usuario ${req.user.id}: activo=${config.activo}, cupo_diario=${config.cupo_diario}`);

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error al actualizar config de validación WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar la configuración' });
  }
};

const getMetricas = async (req, res) => {
  try {
    const metricas = await ValidacionWhatsappService.getMetricas();
    res.json({ success: true, data: metricas });
  } catch (error) {
    console.error('Error al obtener métricas de validación WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Error al obtener las métricas' });
  }
};

const getProspectos = async (req, res) => {
  try {
    const { page = 1, limit = 20, estado, search } = req.query;
    const data = await ValidacionWhatsappService.getProspectos({
      page: Number(page),
      limit: Number(limit),
      estado: estado || undefined,
      search: search || undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener prospectos de validación WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Error al obtener los prospectos' });
  }
};

const getConversacion = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await ValidacionWhatsappService.getConversacion(id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'No se encontró conversación de WhatsApp para este prospecto' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener conversación de validación WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Error al obtener la conversación' });
  }
};

module.exports = { getConfig, actualizarConfig, getMetricas, getProspectos, getConversacion };
