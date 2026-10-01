const db = require('../../config/db');

const VendedorPolizasController = {
  // Enviar póliza a supervisor para revisión
  async enviarAlSupervisor(req, res) {
    const connection = await db.getConnection();
    
    try {
      const { id: polizaId } = req.params;
      const { motivo_cambio_estado } = req.body;
      const vendedor_id = req.user.id;

      console.log(`📤 Vendedor ${vendedor_id} enviando póliza ${polizaId} a supervisor`);
      console.log(`   Motivo: ${motivo_cambio_estado}`);

      // Validar entrada
      if (!polizaId || isNaN(polizaId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de póliza inválido'
        });
      }

      if (!motivo_cambio_estado || typeof motivo_cambio_estado !== 'string' || motivo_cambio_estado.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'El motivo de cambio de estado es requerido'
        });
      }

      // Iniciar transacción
      await connection.beginTransaction();

      // Verificar que la póliza existe y pertenece al vendedor
      const [poliza] = await connection.execute(
        'SELECT id, numero_poliza, estado, prospecto_id, created_by FROM polizas WHERE id = ? AND deleted_at IS NULL',
        [parseInt(polizaId)]
      );

      if (poliza.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'Póliza no encontrada'
        });
      }

      const polizaData = poliza[0];

      // Verificar que la póliza pertenece al vendedor logueado
      if (polizaData.created_by !== vendedor_id) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          error: 'No tiene permiso para enviar esta póliza'
        });
      }

      // Verificar que el estado actual es 'asesor'
      if (polizaData.estado !== 'asesor') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `La póliza debe estar en estado 'asesor' para ser enviada al supervisor. Estado actual: ${polizaData.estado}`
        });
      }

      // Actualizar estado de la póliza a 'supervisor'
      await connection.execute(
        'UPDATE polizas SET estado = ?, fecha_cambio_estado = NOW() WHERE id = ?',
        ['supervisor', parseInt(polizaId)]
      );

      // Registrar en historial de acciones usando id_prospecto
      if (polizaData.prospecto_id) {
        const descripcion = `Póliza ${polizaData.numero_poliza} enviada al supervisor. Motivo: ${motivo_cambio_estado}`;
        await connection.execute(
          `INSERT INTO historial_acciones
           (id_prospecto, id_vendedor, accion, descripcion)
           VALUES (?, ?, ?, ?)`,
          [
            polizaData.prospecto_id,
            vendedor_id,
            'Envío a Supervisor',
            descripcion
          ]
        );

        // 🔄 Actualizar estado en asignaciones a 'Póliza enviada a supervisor'
        const fechaHoraTextoEnvio = new Date().toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        await connection.execute(
          `UPDATE asignaciones SET estado = 'Póliza enviada a supervisor', comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
          [`Póliza ${polizaData.numero_poliza} enviada a supervisor el ${fechaHoraTextoEnvio}`, polizaData.prospecto_id, vendedor_id]
        );
      }

      // Confirmar transacción
      await connection.commit();

      // Sincronizar estado en Google Sheets (después del commit)
      if (polizaData.prospecto_id) {
        try {
          const GoogleSheetsService = require('../../services/googleSheetsService');
          await GoogleSheetsService.actualizarAsignacionEnSheet(polizaData.prospecto_id);
          console.log(`📊 Estado 'Póliza enviada a supervisor' sincronizado en Google Sheets para prospecto ${polizaData.prospecto_id}`);
        } catch (errSheet) {
          console.error('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
        }
      }

      const ahora = new Date();
      console.log(`✅ Póliza ${polizaId} enviada al supervisor exitosamente`);

      return res.status(200).json({
        success: true,
        message: 'Póliza enviada al supervisor exitosamente',
        data: {
          poliza_id: parseInt(polizaId),
          numero_poliza: polizaData.numero_poliza,
          estado_nuevo: 'supervisor',
          timestamp: ahora.toISOString()
        }
      });

    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('❌ Error en rollback:', rollbackError);
      }

      console.error('❌ Error enviando póliza al supervisor:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Error al enviar la póliza al supervisor',
        details: error.message
      });

    } finally {
      connection.release();
    }
  }
};

module.exports = VendedorPolizasController;
