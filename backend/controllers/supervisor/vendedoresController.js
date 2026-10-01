const VendedorModel = require('../../models/supervisor/vendedorModel');
const validator = require('validator');

/**
 * Obtiene la lista de vendedores asignados al supervisor
 */
const getVendedores = async (req, res) => {
  try {
    const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
    console.log('📋 Supervisor obteniendo sus vendedores asignados:', supervisor_id);
    
    const vendedores = await VendedorModel.findAll(supervisor_id); // ✅ Pasar supervisor_id
    res.status(200).json(vendedores);
  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({ message: 'Error al obtener vendedores' });
  }
};

/**
 * Obtiene métricas detalladas de un vendedor específico (solo si está asignado al supervisor)
 */
const getVendedorMetricas = async (req, res) => {
  const { id } = req.params;
  const supervisor_id = req.user.id; // ✅ ID del supervisor logueado

  // Validar ID
  if (!id || !validator.isInt(id.toString(), { min: 1 })) {
    return res.status(400).json({ message: 'ID de vendedor inválido' });
  }

  console.log('📊 Supervisor obteniendo métricas del vendedor:', { supervisor_id, vendedor_id: id });

  try {
    const metricas = await VendedorModel.getMetricas(Number(id), supervisor_id); // ✅ Pasar supervisor_id
    res.status(200).json(metricas);
  } catch (error) {
    console.error('Error al obtener métricas del vendedor:', error);

    // Si es un error de validación, devolver 400
    if (error.message === 'ID de vendedor inválido' || error.message === 'Vendedor no asignado al supervisor') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error al obtener métricas del vendedor' });
  }
};

/**
 * Habilita un vendedor deshabilitado (solo si está asignado al supervisor)
 */
const enableVendedor = async (req, res) => {
  const { id } = req.params;
  const supervisor_id = req.user.id; // ✅ ID del supervisor logueado

  // Validar ID
  if (!id || !validator.isInt(id.toString(), { min: 1 })) {
    return res.status(400).json({ message: 'ID de vendedor inválido' });
  }

  console.log('✅ Supervisor habilitando vendedor:', { supervisor_id, vendedor_id: id });

  try {
    const result = await VendedorModel.enableVendedor(Number(id), supervisor_id); // ✅ Pasar supervisor_id
    res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('Error al habilitar vendedor:', error);

    // Si es un error de validación o registro no encontrado
    if (error.message === 'ID de vendedor inválido' || error.message === 'Vendedor no encontrado' || error.message === 'Vendedor no asignado al supervisor') {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error al habilitar vendedor' });
  }
};

module.exports = {
  getVendedores,
  getVendedorMetricas,
  enableVendedor
};