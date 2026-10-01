const Supervisor = require('../../models/supervisor/supervisorModel');

const listAllProspectos = async (req, res) => {
    try {
        const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
        console.log('📋 Supervisor obteniendo prospectos de sus vendedores:', supervisor_id);
        
        const prospectos = await Supervisor.getAllProspectos(supervisor_id); // ✅ Filtrar por supervisor
        res.status(200).json(prospectos);
    } catch (error) {
        console.error("Error al listar prospectos:", error);
        res.status(500).json({ message: "Error al obtener los prospectos." });
    }
};

const getEstadisticas = async (req, res) => {
    try {
        const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
        console.log('📊 Supervisor obteniendo estadísticas de sus vendedores:', supervisor_id);
        
        const estadisticas = await Supervisor.getEstadisticas(supervisor_id); // ✅ Filtrar por supervisor
        res.status(200).json({
            success: true,
            data: estadisticas
        });
    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener las estadísticas." 
        });
    }
};

const getDatosGrafica = async (req, res) => {
    try {
        const supervisor_id = req.user.id; // ✅ ID del supervisor logueado
        console.log('📈 Supervisor obteniendo datos de gráfica de sus vendedores:', supervisor_id);
        
        const datosGrafica = await Supervisor.getDatosGrafica(supervisor_id); // ✅ Filtrar por supervisor
        res.status(200).json({
            success: true,
            data: datosGrafica
        });
    } catch (error) {
        console.error("Error al obtener datos de gráfica:", error);
        res.status(500).json({ 
            success: false,
            message: "Error al obtener los datos de la gráfica." 
        });
    }
};

const cambiarEstadoProspecto = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, motivo } = req.body;
        const user_id = req.user.id;

        console.log('🔄 Supervisor cambiando estado de prospecto:', { 
            prospecto_id: id,
            estado_nuevo: estado, 
            motivo: motivo,
            supervisor_id: user_id
        });

        // ✅ VALIDAR estados permitidos según la tabla asignaciones
        const estadosValidos = [
            'Lead', '1º Contacto', 'WhatsApp enviado', 'Llamada telefónica', 'Conversación iniciada por WhatsApp',
            'Promoción aplicada', 'Calificado Cotización', 'Calificado Póliza',
            'Calificado Pago', 'Póliza iniciada', 'Póliza generada', 'Póliza enviada a supervisor',
            'Póliza pendiente a firma', 'Póliza firmada', 'Venta', 'Fuera de zona', 'Fuera de edad',
            'Preexistencia', 'Reafiliación', 'No contesta', 'prueba interna',
            'Ya es socio', 'Busca otra Cobertura', 'Teléfono erróneo',
            'No le interesa (económico)', 'No le interesa cartilla', 'No busca cobertura médica'
        ];

        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Estado no válido',
                estado_recibido: estado,
                estados_validos: estadosValidos
            });
        }

        // ✅ Verificar que el prospecto pertenezca a un vendedor asignado al supervisor
        // Llamar al modelo para cambiar el estado del prospecto
        const resultado = await Supervisor.cambiarEstadoProspecto(id, estado, motivo, user_id);
        
        res.json({
            success: true,
            message: 'Estado del prospecto actualizado correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error cambiando estado del prospecto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: error.message
        });
    }
};

module.exports = {
    listAllProspectos,
    getEstadisticas,
    getDatosGrafica,
    cambiarEstadoProspecto
};