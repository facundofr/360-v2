const db = require('../../config/db');

// Obtener planes
exports.listarPlanes = async (req, res) => {
  try {
    const [planes] = await db.query('SELECT id, nombre FROM planes');
    res.json(planes);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los planes." });
  }
};

// Obtener categorías de edad
exports.listarCategorias = async (req, res) => {
  try {
    const [categorias] = await db.query('SELECT id, nombre FROM categorias_edad');
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las categorías." });
  }
};

// Obtener tipos de familia desde la tabla tipo_familia
exports.listarTiposFamilia = async (req, res) => {
  try {
    const [tipos] = await db.query('SELECT id, nombre FROM tipo_familia');
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los tipos de familia." });
  }
};