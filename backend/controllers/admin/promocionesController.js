const db = require("../../config/db");

const parseBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n"].includes(v)) return false;
  }
  return defaultValue;
};

const validarDatos = (body) => {
  const errores = [];
  const nombre = (body.nombre || "").trim();
  const descripcion = (body.descripcion || "").trim();
  const descuento = Number(body.descuento_porcentaje);
  const activa = parseBoolean(body.activa, true);

  if (!nombre) errores.push("El nombre es obligatorio.");
  if (!descripcion) errores.push("La descripción es obligatoria.");
  if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) {
    errores.push("El descuento debe estar entre 0 y 100.");
  }

  return { errores, datos: { nombre, descripcion, descuento_porcentaje: descuento, activa } };
};

exports.list = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM promociones ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error al listar promociones:", error);
    res.status(500).json({ message: "Error al obtener las promociones." });
  }
};

exports.getById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query("SELECT * FROM promociones WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ message: "Promoción no encontrada." });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener promoción:", error);
    res.status(500).json({ message: "Error al obtener la promoción." });
  }
};

exports.create = async (req, res) => {
  const { errores, datos } = validarDatos(req.body);
  if (errores.length) return res.status(400).json({ message: errores.join(" ") });

  try {
    const [result] = await db.query(
      "INSERT INTO promociones (nombre, descripcion, descuento_porcentaje, activa) VALUES (?, ?, ?, ?)",
      [datos.nombre, datos.descripcion, datos.descuento_porcentaje, datos.activa]
    );

    const [created] = await db.query("SELECT * FROM promociones WHERE id = ?", [result.insertId]);
    res.status(201).json({ message: "Promoción creada correctamente.", promocion: created[0] });
  } catch (error) {
    console.error("Error al crear promoción:", error);
    res.status(500).json({ message: "Error al crear la promoción." });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { errores, datos } = validarDatos(req.body);
  if (errores.length) return res.status(400).json({ message: errores.join(" ") });

  try {
    const [exists] = await db.query("SELECT id FROM promociones WHERE id = ?", [id]);
    if (!exists.length) return res.status(404).json({ message: "Promoción no encontrada." });

    await db.query(
      "UPDATE promociones SET nombre = ?, descripcion = ?, descuento_porcentaje = ?, activa = ? WHERE id = ?",
      [datos.nombre, datos.descripcion, datos.descuento_porcentaje, datos.activa, id]
    );

    const [updated] = await db.query("SELECT * FROM promociones WHERE id = ?", [id]);
    res.json({ message: "Promoción actualizada correctamente.", promocion: updated[0] });
  } catch (error) {
    console.error("Error al actualizar promoción:", error);
    res.status(500).json({ message: "Error al actualizar la promoción." });
  }
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  try {
    const [exists] = await db.query("SELECT id FROM promociones WHERE id = ?", [id]);
    if (!exists.length) return res.status(404).json({ message: "Promoción no encontrada." });

    await db.query("DELETE FROM promociones WHERE id = ?", [id]);
    res.json({ message: "Promoción eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar promoción:", error);
    res.status(500).json({ message: "Error al eliminar la promoción." });
  }
};
