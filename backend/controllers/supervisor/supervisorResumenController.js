const SupervisorResumen = require('../../models/supervisor/supervisorResumenModel');
const db = require('../../config/db'); // ✅ Agregar conexión DB

const getResumen = async (req, res) => {
  try {
    const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
    console.log('📊 Supervisor obteniendo resumen de sus vendedores:', supervisor_id);
    
    const resumen = await SupervisorResumen.getResumen(supervisor_id); // ✅ Filtrar por supervisor
    res.status(200).json(resumen);
  } catch (error) {
    console.error("Error al obtener resumen:", error);
    res.status(500).json({ message: "Error al obtener el resumen." });
  }
};

const getMetricasPorVendedor = async (req, res) => {
  try {
    const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
    console.log('📈 Supervisor obteniendo métricas de sus vendedores:', supervisor_id);
    
    const metricas = await SupervisorResumen.getMetricasPorVendedor(supervisor_id); // ✅ Solo vendedores asignados
    res.status(200).json(metricas);
  } catch (error) {
    console.error("Error al obtener métricas por vendedor:", error);
    res.status(500).json({ message: "Error al obtener las métricas por vendedor." });
  }
};

const getCotizacionesPorProspecto = async (req, res) => {
    try {
        const { prospectoId } = req.params;
        const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
        
        console.log('📋 Supervisor obteniendo cotizaciones del prospecto:', { supervisor_id, prospectoId });

        // ✅ FILTRO JERÁRQUICO: Solo cotizaciones de prospectos de vendedores asignados
        const [cotizaciones] = await db.execute(
            `SELECT c.*, cd.*
             FROM cotizaciones c
             LEFT JOIN cotizaciones_detalles cd ON c.id = cd.cotizacion_id
             INNER JOIN prospectos p ON c.prospecto_id = p.id
             INNER JOIN users v ON p.user_id = v.id AND v.supervisor_id = ?
             WHERE c.prospecto_id = ?`,
            [supervisor_id, prospectoId]
        );

        if (cotizaciones.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: "Prospecto no encontrado o no asignado a sus vendedores" 
            });
        }

        res.status(200).json(cotizaciones);
    } catch (error) {
        console.error("Error al obtener cotizaciones:", error);
        res.status(500).json({ message: "Error al obtener las cotizaciones." });
    }
};

module.exports = {
  getResumen,
  getMetricasPorVendedor,
  getCotizacionesPorProspecto,
};