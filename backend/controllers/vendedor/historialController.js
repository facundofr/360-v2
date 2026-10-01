const Historial = require('../../models/vendedor/historialModel');

const registrarAccion = async (id_prospecto, id_vendedor, accion, descripcion) => {
  await Historial.registrarAccion(id_prospecto, id_vendedor, accion, descripcion);
};

const getHistorial = async (req, res) => {
  const { id } = req.params;
  try {
    const historial = await Historial.getHistorialPorProspecto(id);
    res.json(historial);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el historial." });
  }
};

module.exports = { registrarAccion, getHistorial };