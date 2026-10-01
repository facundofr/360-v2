const CategoriaConfig = require('../../models/admin/categoriaConfigModel');
const DistribucionRoundRobin = require('../../models/admin/distribucionRoundRobinModel');

// Obtener todas las categorías
const getCategorias = async (req, res) => {
  try {
    const categorias = await CategoriaConfig.findAll();
    res.json(categorias);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener categorías',
      error: error.message 
    });
  }
};

// Obtener una categoría por ID
const getCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const categoria = await CategoriaConfig.findById(id);
    
    if (!categoria) {
      return res.status(404).json({ 
        success: false, 
        message: 'Categoría no encontrada' 
      });
    }

    // Obtener vendedores de esta categoría
    const vendedores = await CategoriaConfig.getVendedoresByCategoria(id);
    categoria.vendedores = vendedores;

    res.json(categoria);
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener categoría',
      error: error.message 
    });
  }
};

// Crear nueva categoría
const createCategoria = async (req, res) => {
  try {
    const { nombre, descripcion, prioridad } = req.body;

    // Validaciones básicas
    if (!nombre || !prioridad) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y prioridad son requeridos'
      });
    }

    const categoriaId = await CategoriaConfig.create({
      nombre,
      descripcion,
      prioridad: parseInt(prioridad)
    });

    res.status(201).json({
      success: true,
      message: 'Categoría creada correctamente',
      categoriaId
    });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear categoría: ' + error.message
    });
  }
};

// Actualizar categoría
const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, prioridad, activa } = req.body;

    const updated = await CategoriaConfig.update(id, {
      nombre,
      descripcion,
      prioridad: prioridad ? parseInt(prioridad) : undefined,
      activa
    });

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'Categoría no encontrada' 
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar categoría: ' + error.message
    });
  }
};

// Eliminar categoría
const deleteCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await CategoriaConfig.delete(id);

    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        message: 'Categoría no encontrada' 
      });
    }

    res.json({
      success: true,
      message: 'Categoría eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar categoría: ' + error.message
    });
  }
};

// Obtener estadísticas de distribución
const getEstadisticasDistribucion = async (req, res) => {
  try {
    const estadisticas = await DistribucionRoundRobin.getEstadisticasDistribucion();
    res.json(estadisticas);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas',
      error: error.message 
    });
  }
};

// Obtener carga de vendedores
const getCargaVendedores = async (req, res) => {
  try {
    const { categoriaId } = req.query;
    const carga = await DistribucionRoundRobin.getCargaVendedores(categoriaId);
    res.json(carga);
  } catch (error) {
    console.error('Error al obtener carga de vendedores:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener carga de vendedores',
      error: error.message 
    });
  }
};

// Reset del round-robin para una categoría
const resetRoundRobin = async (req, res) => {
  try {
    const { id } = req.params;
    
    await DistribucionRoundRobin.resetRoundRobin(id);

    res.json({
      success: true,
      message: 'Round-robin reiniciado correctamente para la categoría'
    });
  } catch (error) {
    console.error('Error al reiniciar round-robin:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al reiniciar round-robin',
      error: error.message 
    });
  }
};

// Obtener estado actual de distribución 3-2-1
const getEstadoDistribucion3_2_1 = async (req, res) => {
  try {
    const estado = await DistribucionRoundRobin.getEstadoDistribucion();
    res.json({
      success: true,
      data: estado,
      mensaje: "📊 Distribución 3-2-1 en tiempo real"
    });
  } catch (error) {
    console.error('Error al obtener estado de distribución:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estado de distribución',
      error: error.message 
    });
  }
};

// Resetear distribución 3-2-1 para iniciar nueva ronda
const resetearDistribucion3_2_1 = async (req, res) => {
  try {
    const resultado = await DistribucionRoundRobin.resetearDistribucion3_2_1();
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    console.error('Error al resetear distribución:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al resetear distribución',
      error: error.message 
    });
  }
};

// Asignar o quitar categoría a vendedor
const asignarCategoriaVendedor = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    let { categoriaId } = req.body;

    const db = require('../../config/db');

    const updatedBy = req.user?.id || null;

    // Si categoriaId es null/''/undefined, quitar categoría (setear NULL)
    if (categoriaId === null || categoriaId === undefined || categoriaId === '') {
      const [result] = await db.query(
        'UPDATE users SET categoria_id = NULL, updated_at = NOW(), updated_by = ? WHERE id = ? AND role = 1',
        [updatedBy, vendedorId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vendedor no encontrado'
        });
      }

      return res.json({
        success: true,
        message: 'Categoría removida correctamente del vendedor'
      });
    }

    // Normalizar a número si viene como string
    categoriaId = parseInt(categoriaId, 10);
    if (Number.isNaN(categoriaId)) {
      return res.status(400).json({
        success: false,
        message: 'categoriaId inválido'
      });
    }

    // Verificar que la categoría existe
    const categoria = await CategoriaConfig.findById(categoriaId);
    if (!categoria) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Actualizar la categoría del vendedor
    const [result] = await db.query(
      'UPDATE users SET categoria_id = ?, updated_at = NOW(), updated_by = ? WHERE id = ? AND role = 1',
      [categoriaId, updatedBy, vendedorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendedor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Categoría asignada correctamente al vendedor'
    });
  } catch (error) {
    console.error('Error al asignar categoría:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al asignar categoría: ' + error.message
    });
  }
};

module.exports = {
  getCategorias,
  getCategoria,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  getEstadisticasDistribucion,
  getCargaVendedores,
  resetRoundRobin,
  asignarCategoriaVendedor,
  getEstadoDistribucion3_2_1,
  resetearDistribucion3_2_1
};
