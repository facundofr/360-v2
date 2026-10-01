const BackOfficeModel = require('../../models/backoffice/backOfficeModel');
// Dashboard principal de Back Office
const getDashboard = async (req, res) => {
  try {
    // Aceptar múltiples alias para compatibilidad: periodo/periodType y anio/year y mes/month
  const periodType = (req.query.periodType || req.query.periodo || 'month').toString();
  const year = parseInt(req.query.year || req.query.anio || new Date().getFullYear(), 10);
  const month = req.query.month || req.query.mes; // puede ser undefined para 'year' o 'day'
  const date = req.query.date || req.query.fecha; // para periodo 'day'

  const estadisticas = await BackOfficeModel.getEstadisticasGenerales({ periodType, year, month, date });
    
    res.json({
      success: true,
      data: estadisticas
    });
  } catch (error) {
    console.error('Error al obtener dashboard de Back Office:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard',
      error: error.message
    });
  }
};

// Obtener todos los supervisores con sus equipos
const getSupervisores = async (req, res) => {
  try {
    const supervisores = await BackOfficeModel.getSupervisoresConEquipos();
    
    res.json({
      success: true,
      data: supervisores
    });
  } catch (error) {
    console.error('Error al obtener supervisores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener supervisores',
      error: error.message
    });
  }
};

// Obtener detalles de un supervisor específico y su equipo
const getDetallesSupervisor = async (req, res) => {
  try {
    const { id, supervisorId } = req.params;
    const supervisorIdToUse = id || supervisorId;
    
    const detalles = await BackOfficeModel.getDetallesSupervisor(supervisorIdToUse);
    
    if (!detalles) {
      return res.status(404).json({
        success: false,
        message: 'Supervisor no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: detalles
    });
  } catch (error) {
    console.error('Error al obtener detalles del supervisor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del supervisor',
      error: error.message
    });
  }
};

// Asignar vendedor a supervisor (o quitar supervisor)
const asignarVendedor = async (req, res) => {
  try {
    const { vendedorId, supervisorId } = req.body;
    
    if (!vendedorId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere vendedorId'
      });
    }
    
    // supervisorId puede ser null para quitar el supervisor
    const asignado = await BackOfficeModel.asignarVendedorASupervisor(vendedorId, supervisorId || null);
    
    if (!asignado) {
      return res.status(404).json({
        success: false,
        message: 'Vendedor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: supervisorId ? 'Vendedor asignado al supervisor correctamente' : 'Supervisor removido del vendedor correctamente'
    });
  } catch (error) {
    console.error('Error al asignar/quitar vendedor de supervisor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al modificar asignación de supervisor',
      error: error.message
    });
  }
};

// Obtener vendedores sin supervisor asignado
const getVendedoresSinSupervisor = async (req, res) => {
  try {
    const vendedores = await BackOfficeModel.getVendedoresSinSupervisor();
    
    res.json({
      success: true,
      data: vendedores
    });
  } catch (error) {
    console.error('Error al obtener vendedores sin supervisor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vendedores sin supervisor',
      error: error.message
    });
  }
};

// Obtener métricas de rendimiento por período
const getMetricasRendimiento = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    // Valores por defecto: último mes
    const inicio = fechaInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fin = fechaFin || new Date().toISOString().split('T')[0];
    
    const metricas = await BackOfficeModel.getMetricasRendimiento(inicio, fin);
    
    res.json({
      success: true,
      data: {
        periodo: { fechaInicio: inicio, fechaFin: fin },
        metricas: metricas
      }
    });
  } catch (error) {
    console.error('Error al obtener métricas de rendimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas de rendimiento',
      error: error.message
    });
  }
};

// Funciones adicionales para nuevas métricas
const getAnalisisEmbudo = async (req, res) => {
  try {
    const embudo = await BackOfficeModel.getAnalisisEmbudo();
    
    res.json({
      success: true,
      data: embudo
    });
  } catch (error) {
    console.error('Error al obtener análisis de embudo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener análisis de embudo',
      error: error.message
    });
  }
};

const getRendimientoVendedores = async (req, res) => {
  try {
    const { supervisor_id, dias = 30 } = req.query;
    const rendimiento = await BackOfficeModel.getRendimientoVendedores(supervisor_id, parseInt(dias));
    
    res.json({
      success: true,
      data: rendimiento
    });
  } catch (error) {
    console.error('Error al obtener rendimiento de vendedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rendimiento de vendedores',
      error: error.message
    });
  }
};

const getTendenciasTemporales = async (req, res) => {
  try {
    const { dias = 30 } = req.query;
    const tendencias = await BackOfficeModel.getTendenciasTemporales(parseInt(dias));
    
    res.json({
      success: true,
      data: tendencias
    });
  } catch (error) {
    console.error('Error al obtener tendencias temporales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tendencias temporales',
      error: error.message
    });
  }
};

const getAlertas = async (req, res) => {
  try {
    const alertas = await BackOfficeModel.getAlertas();
    
    res.json({
      success: true,
      data: alertas
    });
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas',
      error: error.message
    });
  }
};

// Obtener todos los vendedores
const getVendedores = async (req, res) => {
  try {
    const vendedores = await BackOfficeModel.getVendedores();
    
    res.json({
      success: true,
      data: vendedores
    });
  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vendedores',
      error: error.message
    });
  }
};

// Obtener detalles de un vendedor específico
const getDetallesVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const detalles = await BackOfficeModel.getDetallesVendedor(id);
    
    if (!detalles) {
      return res.status(404).json({
        success: false,
        message: 'Vendedor no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: detalles
    });
  } catch (error) {
    console.error('Error al obtener detalles del vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del vendedor',
      error: error.message
    });
  }
};

// Obtener métricas de un vendedor específico
const getMetricasVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const metricas = await BackOfficeModel.getMetricasVendedor(id);
    
    res.json({
      success: true,
      data: metricas
    });
  } catch (error) {
    console.error('Error al obtener métricas del vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas del vendedor',
      error: error.message
    });
  }
};

// Obtener prospectos de un vendedor específico
const getProspectosVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const prospectos = await BackOfficeModel.getProspectosVendedor(id);
    
    res.json({
      success: true,
      data: prospectos
    });
  } catch (error) {
    console.error('Error al obtener prospectos del vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener prospectos del vendedor',
      error: error.message
    });
  }
};

// Habilitar/deshabilitar vendedor
const toggleVendedorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BackOfficeModel.toggleVendedorStatus(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Vendedor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: `Vendedor ${result.is_enabled ? 'habilitado' : 'deshabilitado'} correctamente`,
      data: { is_enabled: result.is_enabled }
    });
  } catch (error) {
    console.error('Error al cambiar estado del vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del vendedor',
      error: error.message
    });
  }
};

// Eliminar vendedor
const eliminarVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BackOfficeModel.eliminarVendedor(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Vendedor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Vendedor eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar vendedor',
      error: error.message
    });
  }
};

// Reasignar prospectos
const reasignarProspectos = async (req, res) => {
  try {
    const { prospectos, nuevo_vendedor_id, vendedor_anterior_id } = req.body;
    
    if (!prospectos || !nuevo_vendedor_id || !vendedor_anterior_id) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren prospectos, nuevo_vendedor_id y vendedor_anterior_id'
      });
    }
    
    const realizado_por_id = req.user?.id || null;
    const result = await BackOfficeModel.reasignarProspectos(prospectos, nuevo_vendedor_id, vendedor_anterior_id, realizado_por_id);
    
    res.json({
      success: true,
      message: `${prospectos.length} prospectos reasignados correctamente`,
      data: result
    });
  } catch (error) {
    console.error('Error al reasignar prospectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reasignar prospectos',
      error: error.message
    });
  }
};

// Habilitar/deshabilitar supervisor
const toggleSupervisorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BackOfficeModel.toggleSupervisorStatus(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Supervisor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: `Supervisor ${result.is_enabled ? 'habilitado' : 'deshabilitado'} correctamente`,
      data: { is_enabled: result.is_enabled }
    });
  } catch (error) {
    console.error('Error al cambiar estado del supervisor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del supervisor',
      error: error.message
    });
  }
};

module.exports = {
  getDashboard,
  getSupervisores,
  getDetallesSupervisor,
  asignarVendedor,
  getVendedoresSinSupervisor,
  getMetricasRendimiento,
  getAnalisisEmbudo,
  getRendimientoVendedores,
  getTendenciasTemporales,
  getAlertas,
  toggleSupervisorStatus,
  getVendedores,
  getDetallesVendedor,
  getMetricasVendedor,
  getProspectosVendedor,
  toggleVendedorStatus,
  eliminarVendedor,
  reasignarProspectos
};
