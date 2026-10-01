const db = require('../../config/db');

const getTiposAfiliacion = async (req, res) => {
    try {
        const [tipos] = await db.query('SELECT id, nombre, etiqueta, requiere_sueldo, requiere_categoria, categorias FROM tipos_afiliacion');
        res.json(tipos);
    } catch (error) {
        console.error("Error al obtener tipos de afiliación:", error);
        res.status(500).json({ message: "Error al obtener los tipos de afiliación." });
    }
};

module.exports = { getTiposAfiliacion };