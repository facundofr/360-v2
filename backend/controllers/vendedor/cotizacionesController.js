// Suponiendo que tienes un método getCotizacionesByProspectoId o similar:

const getCotizacionesByProspectoId = async (req, res) => {
    const { prospectoId } = req.params;
    
    try {
        // Primero obtener las cotizaciones
        const [cotizaciones] = await db.query(`
            SELECT c.*, 
                   p.nombre AS promocion_nombre, 
                   p.descripcion AS promocion_descripcion, 
                   p.descuento_porcentaje
            FROM cotizaciones c
            LEFT JOIN prospectos_promociones pp ON c.prospecto_id = pp.prospecto_id
            LEFT JOIN promociones p ON pp.promocion_id = p.id
            WHERE c.prospecto_id = ?
        `, [prospectoId]);
        
        // Para cada cotización, obtener sus detalles
        for (let i = 0; i < cotizaciones.length; i++) {
            const [detalles] = await db.query(`
                SELECT * FROM cotizaciones_detalles 
                WHERE cotizacion_id = ?
            `, [cotizaciones[i].id]);
            
            cotizaciones[i].detalles = detalles;
        }
        
        res.status(200).json(cotizaciones);
    } catch (error) {
        console.error('Error al obtener cotizaciones:', error);
        res.status(500).json({ message: 'Error al obtener cotizaciones.' });
    }
};