const PolizaModel = require('../../models/poliza/polizaModel');
const Historial = require('../../models/vendedor/historialModel');
const db = require('../../config/db');

const PolizaController = {
  // Crear póliza definitiva
  async crear(req, res) {
    try {
      const {
        prospecto_id,
        cotizacion_id,
        form,
        estado = 'asesor',
        motivo_cambio_estado = 'Póliza completada por vendedor'
      } = req.body;

      console.log('📋 Creando póliza con estado:', estado);
      console.log('🔍 DEBUG CONTROLLER - form.saludTerminos recibido:', JSON.stringify(form.saludTerminos, null, 2));
      
      // Debug específico de respuestas
      if (form.saludTerminos?.respuestas) {
        console.log('📋 Respuestas detectadas en controller:', Object.keys(form.saludTerminos.respuestas));
        Object.keys(form.saludTerminos.respuestas).forEach(integranteIndex => {
          const respuestasIntegrante = form.saludTerminos.respuestas[integranteIndex];
          const respuestasSi = Object.keys(respuestasIntegrante).filter(
            preguntaId => respuestasIntegrante[preguntaId].respuesta === 'si'
          );
          if (respuestasSi.length > 0) {
            console.log(`✅ CONTROLLER - Integrante ${integranteIndex} - Respuestas SÍ:`, respuestasSi);
          }
        });
      }

      // Validar datos básicos
      if (!prospecto_id || !cotizacion_id || !form) {
        return res.status(400).json({
          error: 'Datos incompletos',
          message: 'Se requieren prospecto_id, cotizacion_id y form'
        });
      }

      // Validar que todos los pasos estén completos usando el modelo
      const validacion = PolizaModel.validarFormularioCompleto(form);
      if (!validacion.valido) {
        return res.status(400).json({
          error: 'Formulario incompleto',
          message: validacion.errores
        });
      }

      // Crear póliza usando el modelo
      const resultado = await PolizaModel.crear({
        prospecto_id,
        cotizacion_id,
        form,
        created_by: req.user?.id || null,
        estado: estado,
        motivo_cambio_estado: motivo_cambio_estado
      });

      // Registrar cambio de estado en historial
      await PolizaModel.registrarCambioEstado(resultado.id, {
        estado_anterior: 'borrador',
        estado_nuevo: estado,
        motivo: motivo_cambio_estado,
        user_id: req.user?.id || null
      });

      console.log('✅ Póliza creada con ID:', resultado.id, 'Estado:', resultado.estado);

      // 🔄 Actualizar estado en asignaciones a 'Póliza generada'
      try {
        const vendedorId = req.user?.id || null;
        if (vendedorId) {
          const fechaHoraTextoPoliza = new Date().toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          const comentarioPoliza = `Póliza ${resultado.numero_poliza || ''} generada el ${fechaHoraTextoPoliza}`;
          await db.query(
            `UPDATE asignaciones SET estado = 'Póliza generada', comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
            [comentarioPoliza, prospecto_id, vendedorId]
          );
          await Historial.registrarAccion(
            prospecto_id,
            vendedorId,
            'poliza_generada',
            `Póliza ${resultado.numero_poliza || ''} generada`
          );
          // Sincronizar estado en Google Sheets
          try {
            const GoogleSheetsService = require('../../services/googleSheetsService');
            await GoogleSheetsService.actualizarAsignacionEnSheet(prospecto_id);
            console.log(`📊 Estado 'Póliza generada' sincronizado en Google Sheets para prospecto ${prospecto_id}`);
          } catch (errSheet) {
            console.error('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
          }
        }
      } catch (errEstado) {
        console.error('⚠️ Error actualizando estado a Póliza generada:', errEstado.message);
      }

      res.status(201).json({
        success: true,
        message: 'Póliza creada exitosamente',
        data: {
          id: resultado.id,
          numero_poliza: resultado.numero_poliza,
          estado: resultado.estado,
          mensaje_estado: PolizaController.getMensajeEstado(resultado.estado),
          pdf_url: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/${resultado.id}/pdf`
        }
      });

    } catch (error) {
      console.error('❌ Error creando póliza:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  },

  // Obtener póliza completa
  async obtenerCompleta(req, res) {
    try {
      const { id } = req.params;
      
      const poliza = await PolizaModel.obtenerCompleta(id);
      
      if (!poliza) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      res.json(poliza);
    } catch (error) {
      console.error('Error obteniendo póliza:', error);
      if (error.message === 'Póliza no encontrada') {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }
      res.status(500).json({ error: 'Error obteniendo póliza' });
    }
  },

  // ✅ NUEVO: Obtener pólizas por prospecto
  async obtenerPorProspecto(req, res) {
    try {
      const { prospecto_id } = req.params;
      
      const query = `
        SELECT 
          p.id,
          p.numero_poliza,
          p.numero_poliza_oficial,
          p.prospecto_id,
          p.cotizacion_id,
          c.plan_id,
          p.estado,
          p.requiere_auditoria_medica,
          c.total_final,
          p.created_at,
          plan.nombre as plan_nombre
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes plan ON c.plan_id = plan.id
        WHERE p.prospecto_id = ? AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
      `;

      const [polizas] = await db.execute(query, [prospecto_id]);

      // ✅ DEBUG: Verificar que requiere_auditoria_medica esté presente
      console.log('🔍 DEBUG - Pólizas obtenidas:', polizas.map(p => ({
        id: p.id,
        numero_poliza_oficial: p.numero_poliza_oficial,
        requiere_auditoria_medica: p.requiere_auditoria_medica
      })));

      res.json({
        success: true,
        data: polizas
      });
    } catch (error) {
      console.error('Error obteniendo pólizas por prospecto:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error obteniendo pólizas por prospecto',
        message: error.message 
      });
    }
  },

  // Listar todas las pólizas (para admin)
  async listar(req, res) {
    try {
      const { page = 1, limit = 20, estado, desde, hasta } = req.query;
      
      const polizas = await PolizaModel.listar({
        page: parseInt(page),
        limit: parseInt(limit),
        estado,
        desde,
        hasta
      });

      res.json(polizas);
    } catch (error) {
      console.error('Error listando pólizas:', error);
      res.status(500).json({ error: 'Error listando pólizas' });
    }
  },

  // Actualizar estado de póliza
  async actualizarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, observaciones } = req.body;

      const resultado = await PolizaModel.actualizarEstado(id, estado, observaciones);

      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: resultado
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      res.status(500).json({ error: 'Error actualizando estado' });
    }
  },

  // ✅ NUEVO: CAMBIAR ESTADO DE PÓLIZA
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, motivo_cambio_estado } = req.body;
      const user_id = req.user.id;

      // Validar estado
      const estadosValidos = [
        'borrador', 'pendiente_revision', 'en_revision', 'pendiente_documentos',
        'pendiente_autorizacion', 'autorizada', 'enviada_cliente', 'firmada',
        'activa', 'rechazada', 'cancelada', 'vencida'
      ];

      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          error: 'Estado no válido',
          estado_recibido: estado,
          estados_validos: estadosValidos
        });
      }

      // Obtener estado actual
      const polizaActual = await PolizaModel.obtenerCompleta(id);
      if (!polizaActual) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // Validar transición de estado
      const transicionValida = PolizaController.validarTransicionEstado(
        polizaActual.estado, 
        estado
      );

      if (!transicionValida.valida) {
        return res.status(400).json({
          error: 'Transición de estado no válida',
          estado_actual: polizaActual.estado,
          estado_solicitado: estado,
          razon: transicionValida.razon
        });
      }

      // Actualizar estado
      await PolizaModel.actualizarEstado(id, {
        estado: estado,
        estado_anterior: polizaActual.estado,
        motivo_cambio_estado: motivo_cambio_estado,
        revisado_por: user_id,
        fecha_revision: new Date()
      });

      // Registrar historial
      await PolizaModel.registrarCambioEstado(id, {
        estado_nuevo: estado,
        estado_anterior: polizaActual.estado,
        motivo: motivo_cambio_estado,
        user_id: user_id
      });

      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: {
          id: id,
          estado_anterior: polizaActual.estado,
          estado_nuevo: estado,
          mensaje: PolizaController.getMensajeEstado(estado)
        }
      });

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      res.status(500).json({
        error: 'Error cambiando estado',
        message: error.message
      });
    }
  },

  // ✅ NUEVO: VALIDAR TRANSICIONES DE ESTADO
  validarTransicionEstado(estadoActual, estadoNuevo) {
    const transicionesValidas = {
      'borrador': ['pendiente_revision', 'cancelada'],
      'pendiente_revision': ['en_revision', 'pendiente_documentos', 'rechazada'],
      'en_revision': ['pendiente_autorizacion', 'pendiente_documentos', 'rechazada'],
      'pendiente_documentos': ['pendiente_revision', 'cancelada'],
      'pendiente_autorizacion': ['autorizada', 'rechazada'],
      'autorizada': ['enviada_cliente'],
      'enviada_cliente': ['firmada', 'vencida'],
      'firmada': ['activa'],
      'activa': ['cancelada', 'vencida'],
      'rechazada': ['pendiente_revision'], // Permite reactivar si se corrige
      'cancelada': [], // Estado final
      'vencida': ['cancelada'] // Solo puede cancelarse
    };

    const estadosPermitidos = transicionesValidas[estadoActual] || [];
    
    return {
      valida: estadosPermitidos.includes(estadoNuevo),
      razon: estadosPermitidos.includes(estadoNuevo) 
        ? null 
        : `No se puede cambiar de '${estadoActual}' a '${estadoNuevo}'. Estados permitidos: ${estadosPermitidos.join(', ')}`
    };
  },

  // ✅ NUEVO: MENSAJES AMIGABLES PARA ESTADOS
  getMensajeEstado(estado) {
    const mensajes = {
      'borrador': 'Póliza en proceso de creación',
      'pendiente_revision': 'Pendiente de revisión por supervisor',
      'en_revision': 'Siendo revisada por el equipo médico',
      'pendiente_documentos': 'Faltan documentos del cliente',
      'pendiente_autorizacion': 'Pendiente autorización médica',
      'autorizada': 'Autorizada, lista para envío',
      'enviada_cliente': 'Enviada al cliente para firma',
      'firmada': 'Firmada por el cliente',
      'activa': 'Póliza activa y vigente',
      'rechazada': 'Rechazada por auditoría médica',
      'cancelada': 'Cancelada',
      'vencida': 'Vencida por falta de pago'
    };
    
    return mensajes[estado] || 'Estado desconocido';
  },

  // ✅ NUEVO: OBTENER HISTORIAL DE ESTADOS
  async obtenerHistorialEstados(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          h.*,
          u.first_name as usuario_nombre,
          u.last_name as usuario_apellido
        FROM poliza_estados_historial h
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.poliza_id = ?
        ORDER BY h.created_at DESC
      `;

      const [historial] = await db.execute(query, [id]);

      res.json({
        success: true,
        data: historial
      });

    } catch (error) {
      console.error('❌ Error obteniendo historial:', error);
      res.status(500).json({
        error: 'Error obteniendo historial de estados',
        message: error.message
      });
    }
  },

  // ... resto de métodos existentes sin cambios ...
};

module.exports = PolizaController;