const db = require('../../config/db');

class ChatbotModel {
  // Crear nueva conversación
  static async crearConversacion(usuarioId) {
    try {
      const [result] = await db.query(
        'INSERT INTO chatbot_conversaciones (usuario_id, creado_en) VALUES (?, NOW())',
        [usuarioId]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error al crear conversación:', error);
      throw error;
    }
  }
  
  // Obtener conversaciones de un usuario
  static async obtenerConversaciones(usuarioId) {
    try {
      const [conversaciones] = await db.query(
        `SELECT c.*, p.nombre, p.apellido 
         FROM chatbot_conversaciones c
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         WHERE c.usuario_id = ?
         ORDER BY c.creado_en DESC`,
        [usuarioId]
      );
      return conversaciones;
    } catch (error) {
      console.error('Error al obtener conversaciones:', error);
      throw error;
    }
  }

  // Métodos adicionales según necesites
}

module.exports = ChatbotModel;