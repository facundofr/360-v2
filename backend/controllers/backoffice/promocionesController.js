const PromocionesModel = require("../../models/backoffice/promocionesModel");

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

const TIPOS_VALIDOS = ["descuento", "incremento"];

const validarDatos = (body) => {
  const errores = [];
  const nombre = (body.nombre || "").trim();
  const descripcion = (body.descripcion || "").trim();
  const descuento = Number(body.descuento_porcentaje);
  const activa = parseBoolean(body.activa, true);
  const tipo = TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : "descuento";

  if (!nombre) errores.push("El nombre es obligatorio.");
  if (!descripcion) errores.push("La descripción es obligatoria.");
  if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) {
    errores.push("El porcentaje debe estar entre 0 y 100.");
  }

  return { errores, datos: { nombre, descripcion, descuento_porcentaje: descuento, tipo, activa } };
};

// Obtener todas las promociones (disponible para backoffice y supervisor)
exports.list = async (req, res) => {
  try {
    const promociones = await PromocionesModel.obtenerTodas();
    res.json(promociones);
  } catch (error) {
    console.error("Error al listar promociones:", error);
    res.status(500).json({ message: "Error al obtener las promociones." });
  }
};

// Obtener solo promociones activas (para mostrar en UI)
exports.activas = async (req, res) => {
  try {
    const promociones = await PromocionesModel.obtenerActivas();
    res.json(promociones);
  } catch (error) {
    console.error("Error al listar promociones activas:", error);
    res.status(500).json({ message: "Error al obtener las promociones activas." });
  }
};

// Obtener una promoción por ID (disponible para backoffice y supervisor)
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

// Crear promoción (solo backoffice - rol 4)
exports.create = async (req, res) => {
  const { errores, datos } = validarDatos(req.body);
  if (errores.length) {
    return res.status(400).json({ message: errores.join(" ") });
  }

  try {
    const db = require("../../config/db");
    const [result] = await db.query(
      "INSERT INTO promociones (nombre, descripcion, descuento_porcentaje, tipo, activa) VALUES (?, ?, ?, ?, ?)",
      [datos.nombre, datos.descripcion, datos.descuento_porcentaje, datos.tipo, datos.activa]
    );

    const [created] = await db.query("SELECT * FROM promociones WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json({
      message: "Promoción creada correctamente.",
      promocion: created[0],
    });
  } catch (error) {
    console.error("Error al crear promoción:", error);
    res.status(500).json({ message: "Error al crear la promoción." });
  }
};

// Actualizar promoción (solo backoffice - rol 4)
exports.update = async (req, res) => {
  const { id } = req.params;
  const { errores, datos } = validarDatos(req.body);
  if (errores.length) {
    return res.status(400).json({ message: errores.join(" ") });
  }

  try {
    const db = require("../../config/db");
    const [exists] = await db.query("SELECT id FROM promociones WHERE id = ?", [id]);
    if (!exists.length) {
      return res.status(404).json({ message: "Promoción no encontrada." });
    }

    await db.query(
      "UPDATE promociones SET nombre = ?, descripcion = ?, descuento_porcentaje = ?, tipo = ?, activa = ? WHERE id = ?",
      [datos.nombre, datos.descripcion, datos.descuento_porcentaje, datos.tipo, datos.activa, id]
    );

    const [updated] = await db.query("SELECT * FROM promociones WHERE id = ?", [id]);
    res.json({
      message: "Promoción actualizada correctamente.",
      promocion: updated[0],
    });
  } catch (error) {
    console.error("Error al actualizar promoción:", error);
    res.status(500).json({ message: "Error al actualizar la promoción." });
  }
};

// Eliminar promoción (solo backoffice - rol 4)
exports.remove = async (req, res) => {
  const { id } = req.params;
  try {
    const db = require("../../config/db");
    const [exists] = await db.query("SELECT id FROM promociones WHERE id = ?", [id]);
    if (!exists.length) {
      return res.status(404).json({ message: "Promoción no encontrada." });
    }

    await db.query("DELETE FROM promociones WHERE id = ?", [id]);
    res.json({ message: "Promoción eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar promoción:", error);
    res.status(500).json({ message: "Error al eliminar la promoción." });
  }
};
