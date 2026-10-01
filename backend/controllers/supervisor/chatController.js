const db = require('../../config/db');

const SupervisorChatController = {
  // ✅ Obtener conversaciones por prospecto (para supervisores)
  async obtenerConversacionesPorProspecto(req, res) {
    try {
      const { prospecto_id } = req.params;
      const supervisor_id = req.user.id; // Extraer ID del supervisor del token JWT

      // Obtener información del prospecto (con restricción de supervisor-vendedor)
      const [prospecto] = await db.execute(
        `SELECT 
          p.id, 
          p.nombre, 
          p.apellido, 
          p.numero_contacto as telefono,
          p.correo,
          p.localidad,
          a.estado,
          a.id_vendedor,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_nombre
         FROM prospectos p
         LEFT JOIN asignaciones a ON p.id = a.id_prospecto
         LEFT JOIN users v ON a.id_vendedor = v.id
         WHERE p.id = ? AND v.supervisor_id = ?`,
        [prospecto_id, supervisor_id]
      );

      if (prospecto.length === 0) {
        return res.status(404).json({
          error: 'Prospecto no encontrado',
          message: 'No se encontró información del prospecto o no tiene acceso a este prospecto'
        });
      }

      // Obtener conversaciones del prospecto con datos relacionados (filtrado por supervisor)
      const [conversaciones] = await db.execute(
        `SELECT 
          c.id,
          c.numero_conversacion,
          c.telefono as telefono_cliente,
          c.estado,
          c.tipo_origen,
          c.ultima_actividad,
          c.created_at as fecha_conversacion,
          c.poliza_id,
          c.vendedor_id,
          pol.numero_poliza,
          pol.numero_poliza_oficial,
          pol.estado as poliza_estado,
          CONCAT(v.first_name, ' ', v.last_name) as vendedor_asignado,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id) as total_mensajes,
          (SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id = c.id AND estado_entrega != 'leido' AND tipo = 'recibido') as mensajes_no_leidos
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN polizas pol ON c.poliza_id = pol.id
         LEFT JOIN users v ON c.vendedor_id = v.id
         WHERE c.prospecto_id = ? AND v.supervisor_id = ?
         ORDER BY c.created_at DESC`,
        [prospecto_id, supervisor_id]
      );

      // Obtener últimos mensajes de cada conversación
      const conversacionesConMensajes = await Promise.all(
        conversaciones.map(async (conv) => {
          const [ultimoMensaje] = await db.execute(
            `SELECT 
              mensaje as contenido,
              tipo,
              origen,
              created_at
             FROM chat_mensajes 
             WHERE conversacion_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          // Obtener el último mensaje del cliente y del bot/vendedor por separado
          const [ultimoMensajeCliente] = await db.execute(
            `SELECT mensaje 
             FROM chat_mensajes 
             WHERE conversacion_id = ? AND tipo = 'recibido' 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          const [ultimoMensajeVendedor] = await db.execute(
            `SELECT mensaje 
             FROM chat_mensajes 
             WHERE conversacion_id = ? AND tipo = 'enviado' 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [conv.id]
          );

          return {
            ...conv,
            ultimo_mensaje: ultimoMensaje.length > 0 ? ultimoMensaje[0] : null,
            mensaje_cliente: ultimoMensajeCliente.length > 0 ? ultimoMensajeCliente[0].mensaje : null,
            respuesta_bot: ultimoMensajeVendedor.length > 0 ? ultimoMensajeVendedor[0].mensaje : null,
            notas: null // Campo para futuras notas
          };
        })
      );

      res.json({
        success: true,
        data: {
          prospecto: prospecto[0],
          conversaciones: conversacionesConMensajes
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo conversaciones por prospecto (supervisor):', error);
      res.status(500).json({
        error: 'Error obteniendo conversaciones',
        message: error.message
      });
    }
  },

  // ✅ Obtener mensajes de una conversación (para supervisores)
  async obtenerMensajes(req, res) {
    try {
      const { conversacion_id } = req.params;
      const limite = parseInt(req.query.limite) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const supervisor_id = req.user.id; // Extraer ID del supervisor del token JWT

      // Verificar que la conversación existe y pertenece a un vendedor del supervisor
      const [conversacion] = await db.execute(
        `SELECT 
          c.id,
          c.numero_conversacion,
          c.telefono,
          c.estado,
          c.prospecto_id,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         LEFT JOIN users v ON c.vendedor_id = v.id
         WHERE c.id = ? AND v.supervisor_id = ?`,
        [conversacion_id, supervisor_id]
      );

      if (conversacion.length === 0) {
        return res.status(404).json({
          error: 'Conversación no encontrada o no tiene acceso a esta conversación'
        });
      }

      // Obtener mensajes de la conversación
      const [mensajes] = await db.execute(
        `SELECT 
          id,
          conversacion_id,
          mensaje as contenido,
          tipo,
          origen as tipo_contenido,
          metadata,
          twilio_message_sid as mensaje_whatsapp_id,
          created_at,
          estado_entrega as leido,
          estado_entrega as entregado
         FROM chat_mensajes 
         WHERE conversacion_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [conversacion_id, limite, offset]
      );

      res.json({
        success: true,
        data: {
          conversacion: conversacion[0],
          mensajes: mensajes.reverse() // Invertir para mostrar cronológicamente
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo mensajes (supervisor):', error);
      res.status(500).json({
        error: 'Error obteniendo mensajes',
        message: error.message
      });
    }
  },

  // ✅ Crear nueva conversación (para supervisores)
  async crearConversacion(req, res) {
    try {
      const { prospecto_id, tipo_origen = 'manual', poliza_id = null } = req.body;
      const supervisor_id = req.user.id; // Extraer ID del supervisor del token JWT

      // Verificar que el prospecto existe y pertenece a un vendedor del supervisor
      const [prospecto] = await db.execute(
        `SELECT 
          p.id, 
          p.nombre, 
          p.apellido, 
          p.numero_contacto,
          a.id_vendedor
         FROM prospectos p
         LEFT JOIN asignaciones a ON p.id = a.id_prospecto
         LEFT JOIN users v ON a.id_vendedor = v.id
         WHERE p.id = ? AND v.supervisor_id = ?`,
        [prospecto_id, supervisor_id]
      );

      if (prospecto.length === 0) {
        return res.status(404).json({
          error: 'Prospecto no encontrado o no tiene acceso a este prospecto'
        });
      }

      // Generar número de conversación único
      const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const [ultimaConversacion] = await db.execute(
        `SELECT numero_conversacion FROM chat_conversaciones_whatsapp 
         WHERE numero_conversacion LIKE 'CONV-${fechaHoy}-%' 
         ORDER BY id DESC LIMIT 1`
      );

      let numeroSecuencial = 1;
      if (ultimaConversacion.length > 0) {
        const ultimoNumero = ultimaConversacion[0].numero_conversacion;
        const secuencial = parseInt(ultimoNumero.split('-')[2]);
        numeroSecuencial = secuencial + 1;
      }

      const numeroConversacion = `CONV-${fechaHoy}-${numeroSecuencial.toString().padStart(4, '0')}`;

      // Crear la conversación
      const [resultado] = await db.execute(
        `INSERT INTO chat_conversaciones_whatsapp 
         (numero_conversacion, telefono, prospecto_id, poliza_id, vendedor_id, tipo_origen, estado, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'activa', NOW(), NOW())`,
        [
          numeroConversacion,
          prospecto[0].numero_contacto,
          prospecto_id,
          poliza_id,
          prospecto[0].id_vendedor || null, // Asignar al vendedor del prospecto si existe
          tipo_origen
        ]
      );

      const conversacionId = resultado.insertId;

      // Obtener la conversación creada con todos los datos
      const [nuevaConversacion] = await db.execute(
        `SELECT 
          c.*,
          p.nombre as prospecto_nombre,
          p.apellido as prospecto_apellido
         FROM chat_conversaciones_whatsapp c
         LEFT JOIN prospectos p ON c.prospecto_id = p.id
         WHERE c.id = ?`,
        [conversacionId]
      );

      res.status(201).json({
        success: true,
        message: 'Conversación creada exitosamente',
        data: nuevaConversacion[0]
      });

    } catch (error) {
      console.error('❌ Error creando conversación (supervisor):', error);
      res.status(500).json({
        error: 'Error creando conversación',
        message: error.message
      });
    }
  }
};

module.exports = SupervisorChatController;
