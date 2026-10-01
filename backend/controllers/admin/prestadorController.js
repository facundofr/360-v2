const Prestador = require('../../models/admin/prestadorModel');

exports.getAll = async (req, res) => {
  try {
    const prestadores = await Prestador.getAll();
    res.json(prestadores);
  } catch (error) {
    console.error("Error al obtener prestadores:", error);
    res.status(500).json({ message: "Error al obtener los prestadores." });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const prestador = await Prestador.getById(id);
    
    if (!prestador) {
      return res.status(404).json({ message: "Prestador no encontrado." });
    }
    
    // Obtener planes asignados
    const planesAsignados = await Prestador.getPlanesAsignados(id);
    prestador.planes_asignados = planesAsignados;
    
    res.json(prestador);
  } catch (error) {
    console.error("Error al obtener prestador:", error);
    if (error.message === "ID de prestador inválido.") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Error al obtener el prestador." });
  }
};

exports.create = async (req, res) => {
  try {
    const datos = {
      ...req.body,
      created_by: req.user.id
    };
    
    const prestadorId = await Prestador.create(datos);
    
    res.status(201).json({ 
      message: "Prestador creado correctamente.",
      id: prestadorId 
    });
  } catch (error) {
    console.error("Error al crear prestador:", error);
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({ 
        message: "Error de validación", 
        errores: error.errores 
      });
    }
    res.status(500).json({ message: "Error al crear el prestador." });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = {
      ...req.body,
      updated_by: req.user.id
    };
    
    await Prestador.update(id, datos);
    
    res.json({ message: "Prestador actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar prestador:", error);
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({ 
        message: "Error de validación", 
        errores: error.errores 
      });
    }
    if (error.message === "ID de prestador inválido.") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Error al actualizar el prestador." });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await Prestador.delete(id);
    
    res.json({ message: "Prestador eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar prestador:", error);
    if (error.message.includes("tiene planes asignados")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === "ID de prestador inválido.") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Error al eliminar el prestador." });
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    await Prestador.changeStatus(id, estado, req.user.id);
    
    res.json({ 
      message: `Prestador ${estado ? 'activado' : 'desactivado'} correctamente.` 
    });
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    if (error.message === "ID de prestador inválido.") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Error al cambiar el estado." });
  }
};

// Gestión de planes
exports.asignarPlan = async (req, res) => {
  try {
    const { prestadorId, planId } = req.params;
    const datos = req.body;
    
    await Prestador.asignarPlan(prestadorId, planId, datos);
    
    res.json({ message: "Plan asignado correctamente." });
  } catch (error) {
    console.error("Error al asignar plan:", error);
    res.status(500).json({ message: "Error al asignar el plan." });
  }
};

exports.desasignarPlan = async (req, res) => {
  try {
    const { prestadorId, planId } = req.params;
    
    await Prestador.desasignarPlan(prestadorId, planId);
    
    res.json({ message: "Plan desasignado correctamente." });
  } catch (error) {
    console.error("Error al desasignar plan:", error);
    res.status(500).json({ message: "Error al desasignar el plan." });
  }
};