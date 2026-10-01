const db = require('../../config/db');

// Obtener todas las localidades de Buenos Aires
const getLocalidadesBuenosAires = async (req, res) => {
    try {
        // Cambia el ID según corresponda en tu tabla provincias
        const [rows] = await db.query(
            'SELECT id, nombre FROM localidades WHERE provincia_id = ? ORDER BY nombre ASC',
            [1] // 1 = Buenos Aires (ajusta si tu id es diferente)
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error al obtener localidades:", error);
        res.status(500).json({ message: "Error al obtener las localidades." });
    }
};

module.exports = {
    getLocalidadesBuenosAires,
};