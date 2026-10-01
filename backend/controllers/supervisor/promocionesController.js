const PromocionesModel = require("../../models/supervisor/promocionesModel");

// Obtener todas las promociones (solo lectura)
exports.list = async (req, res) => {
  try {
    const promociones = await PromocionesModel.obtenerTodas();
    res.json(promociones);
  } catch (error) {
    console.error("Error al listar promociones:", error);
    res.status(500).json({ message: "Error al obtener las promociones." });
  }
};

// Obtener solo promociones activas
exports.activas = async (req, res) => {
  try {
    const promociones = await PromocionesModel.obtenerActivas();
    res.json(promociones);
  } catch (error) {
    console.error("Error al listar promociones activas:", error);
    res.status(500).json({ message: "Error al obtener las promociones activas." });
  }
};

// Obtener una promoción por ID
exports.getById = async (req, res) => {
  const { id } = req.params;
  try {
    const promocion = await PromocionesModel.obtenerPorId(id);
    if (!promocion) {
      return res.status(404).json({ message: "Promoción no encontrada." });
    }
    res.json(promocion);
  } catch (error) {
    console.error("Error al obtener promoción:", error);
    res.status(500).json({ message: "Error al obtener la promoción." });
  }
};
