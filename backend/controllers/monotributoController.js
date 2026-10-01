const db = require("../config/db");

// Obtener todas las categorías de monotributo
const obtenerCategorias = async (req, res) => {
  try {
    const [categorias] = await db.query(
      "SELECT * FROM categorias_monotributo ORDER BY letra ASC"
    );
    res.json(categorias);
  } catch (error) {
    console.error("Error al obtener categorías de monotributo:", error);
    res.status(500).json({ message: "Error al obtener las categorías de monotributo" });
  }
};

// Obtener una categoría por ID
const obtenerCategoriaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const [categorias] = await db.query(
      "SELECT * FROM categorias_monotributo WHERE id = ?",
      [id]
    );
    
    if (categorias.length === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    
    res.json(categorias[0]);
  } catch (error) {
    console.error("Error al obtener categoría:", error);
    res.status(500).json({ message: "Error al obtener la categoría" });
  }
};

// Crear nueva categoría
const crearCategoria = async (req, res) => {
  const { letra, aporte_presuntivo } = req.body;
  
  if (!letra || !aporte_presuntivo) {
    return res.status(400).json({ 
      message: "Por favor proporciona todos los campos requeridos" 
    });
  }
  
  try {
    // Verificar si la letra ya existe
    const [existente] = await db.query(
      "SELECT id FROM categorias_monotributo WHERE letra = ?",
      [letra.toUpperCase()]
    );
    
    if (existente.length > 0) {
      return res.status(400).json({ 
        message: `La categoría ${letra} ya existe` 
      });
    }
    
    const [result] = await db.query(
      "INSERT INTO categorias_monotributo (letra, aporte_presuntivo) VALUES (?, ?)",
      [letra.toUpperCase(), aporte_presuntivo]
    );
    
    res.status(201).json({
      message: "Categoría creada correctamente",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ message: "Error al crear la categoría" });
  }
};

// Actualizar categoría
const actualizarCategoria = async (req, res) => {
  const { id } = req.params;
  const { letra, aporte_presuntivo } = req.body;
  
  if (!letra || !aporte_presuntivo) {
    return res.status(400).json({ 
      message: "Por favor proporciona todos los campos requeridos" 
    });
  }
  
  try {
    // Verificar si la categoría existe
    const [categoriaExistente] = await db.query(
      "SELECT id FROM categorias_monotributo WHERE id = ?",
      [id]
    );
    
    if (categoriaExistente.length === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    
    // Verificar si la nueva letra ya está en uso por otra categoría
    const [letraExistente] = await db.query(
      "SELECT id FROM categorias_monotributo WHERE letra = ? AND id != ?",
      [letra.toUpperCase(), id]
    );
    
    if (letraExistente.length > 0) {
      return res.status(400).json({ 
        message: `La categoría ${letra} ya existe` 
      });
    }
    
    await db.query(
      "UPDATE categorias_monotributo SET letra = ?, aporte_presuntivo = ? WHERE id = ?",
      [letra.toUpperCase(), aporte_presuntivo, id]
    );
    
    res.json({ message: "Categoría actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar la categoría" });
  }
};

// Eliminar categoría
const eliminarCategoria = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await db.query(
      "DELETE FROM categorias_monotributo WHERE id = ?",
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    
    res.json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar la categoría" });
  }
};

// Aplicar aumento porcentual a todas las categorías
const aplicarAumento = async (req, res) => {
  const { porcentaje } = req.body;
  
  if (!porcentaje || isNaN(porcentaje) || porcentaje <= 0) {
    return res.status(400).json({ 
      message: "Por favor proporciona un porcentaje válido" 
    });
  }
  
  try {
    const factor = 1 + (parseFloat(porcentaje) / 100);
    
    await db.query(
      "UPDATE categorias_monotributo SET aporte_presuntivo = ROUND(aporte_presuntivo * ?, 2)",
      [factor]
    );
    
    res.json({ 
      message: `Aumento del ${porcentaje}% aplicado correctamente a todas las categorías` 
    });
  } catch (error) {
    console.error("Error al aplicar aumento:", error);
    res.status(500).json({ message: "Error al aplicar el aumento" });
  }
};

module.exports = {
  obtenerCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  aplicarAumento,
};
