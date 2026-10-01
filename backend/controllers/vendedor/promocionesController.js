const db = require('../../config/db');
const historialController = require('./historialController'); // Importar el controlador de historial

const aplicarPromocion = async (req, res) => {
    const { id: prospectoId } = req.params;
    const { promocionId } = req.body;
    const vendedorId = req.user.id;

    try {
        // Iniciar transacción
        await db.query('START TRANSACTION');

        // Verificar si la promoción existe y está activa
        const [promocion] = await db.query('SELECT * FROM promociones WHERE id = ? AND activa = 1 FOR UPDATE', [promocionId]);
        if (!promocion.length) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Promoción no encontrada o inactiva.' });
        }

        // Bloquear el prospecto durante toda la operación
        const [prospecto] = await db.query('SELECT id, origen FROM prospectos WHERE id = ? FOR UPDATE', [prospectoId]);
        if (!prospecto.length) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Prospecto no encontrado.' });
        }

        // Los prospectos que vienen del flujo de Reafiliación sólo pueden
        // cotizarse con el 55% de descuento — ninguna otra promoción.
        const esDescuento55 = promocion[0].tipo === 'descuento' && Number(promocion[0].descuento_porcentaje) === 55;
        if (prospecto[0].origen === 'Reafiliacion' && !esDescuento55) {
            await db.query('ROLLBACK');
            return res.status(403).json({
                message: 'Este prospecto viene de Reafiliación: sólo se le puede aplicar la promoción del 55% de descuento.'
            });
        }

        // Verificar si ya existe una promoción aplicada a este prospecto
        const [existePromocion] = await db.query(
            'SELECT * FROM prospectos_promociones WHERE prospecto_id = ? FOR UPDATE', 
            [prospectoId]
        );

        // Eliminar promociones anteriores si existen
        if (existePromocion.length > 0) {
            await db.query('DELETE FROM prospectos_promociones WHERE prospecto_id = ?', [prospectoId]);
        }

        // Asociar la nueva promoción al prospecto
        await db.query(
            'INSERT INTO prospectos_promociones (prospecto_id, promocion_id) VALUES (?, ?)', 
            [prospectoId, promocionId]
        );

        // Recalcular todas las cotizaciones del prospecto
        await recalcularCotizaciones(prospectoId, promocion[0]);

        // Registrar la acción en el historial
        const etiquetaAccion = promocion[0].tipo === 'incremento' ? 'incremento' : 'descuento';
        await historialController.registrarAccion(
            prospectoId,
            vendedorId,
            'APLICAR_PROMOCION',
            `Se aplicó la promoción "${promocion[0].nombre}" con ${promocion[0].descuento_porcentaje}% de ${etiquetaAccion}`
        );

        // 🔄 Actualizar estado en asignaciones a 'Promoción aplicada'
        const fechaHoraTextoPromo = new Date().toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        await db.query(
            `UPDATE asignaciones SET estado = 'Promoción aplicada', comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
            [
                `Promoción "${promocion[0].nombre}" aplicada (${promocion[0].descuento_porcentaje}% de ${etiquetaAccion}) el ${fechaHoraTextoPromo}`,
                prospectoId,
                vendedorId
            ]
        );

        await db.query('COMMIT');

        // Sincronizar estado en Google Sheets (después del commit)
        try {
            const GoogleSheetsService = require('../../services/googleSheetsService');
            await GoogleSheetsService.actualizarAsignacionEnSheet(prospectoId);
            console.log(`📊 Estado 'Promoción aplicada' sincronizado en Google Sheets para prospecto ${prospectoId}`);
        } catch (errSheet) {
            console.error('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
        }

        res.status(200).json({
            message: 'Promoción aplicada correctamente y cotizaciones actualizadas.',
            promocion: promocion[0]
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al aplicar promoción:', error);
        res.status(500).json({ message: 'Error al aplicar promoción.' });
    }
};

// Función para recalcular todas las cotizaciones de un prospecto
const recalcularCotizaciones = async (prospectoId, promocion) => {
    // 1. Obtener todas las cotizaciones del prospecto con bloqueo
    const [cotizaciones] = await db.query(
        'SELECT id, plan_id FROM cotizaciones WHERE prospecto_id = ? FOR UPDATE', 
        [prospectoId]
    );
    
    const descuentoPorcentaje = promocion.descuento_porcentaje;
    const esIncremento = promocion.tipo === 'incremento';
    const signoPromocion = esIncremento ? -1 : 1;

    for (const cotizacion of cotizaciones) {
        // 2. Obtener todos los detalles de la cotización
        const [detalles] = await db.query(
            'SELECT * FROM cotizaciones_detalles WHERE cotizacion_id = ?',
            [cotizacion.id]
        );

        let totalBruto = 0;
        let totalDescuentoAporte = 0;
        let totalDescuentoPromocion = 0;

        // 3. Recalcular cada detalle
        for (const detalle of detalles) {
            const precioBase = parseFloat(detalle.precio_base) || 0;
            const descuentoAporte = parseFloat(detalle.descuento_aporte) || 0;
            const precioConAporte = precioBase - descuentoAporte;
            // Positivo = descuento (resta del precio), negativo = incremento (suma al precio)
            const descuentoPromocion = parseFloat((precioConAporte * (descuentoPorcentaje / 100) * signoPromocion).toFixed(2));
            const precioFinal = Math.max(precioConAporte - descuentoPromocion, 0);

            // Actualizar el detalle correctamente con el nombre de la promoción
            await db.query(`
                UPDATE cotizaciones_detalles
                SET descuento_promocion = ?,
                    promocion_aplicada = ?,
                    precio_final = ?
                WHERE id = ?
            `, [
                descuentoPromocion,
                `Promoción "${promocion.nombre}" (${esIncremento ? '+' : '-'}${descuentoPorcentaje}%)`,
                precioFinal,
                detalle.id
            ]);
            
            totalBruto += precioBase;
            totalDescuentoAporte += descuentoAporte;
            totalDescuentoPromocion += descuentoPromocion;
        }
        
        // 4. Calcular totales correctamente con números parseados
        const totalDescuento = parseFloat((totalDescuentoAporte + totalDescuentoPromocion).toFixed(2));
        const totalFinal = Math.max(totalBruto - totalDescuento, 0);
        
        // 5. Actualizar la cotización principal
        await db.query(`
            UPDATE cotizaciones
            SET total_bruto = ?,
                total_descuento_aporte = ?,
                total_descuento_promocion = ?,
                total_descuento = ?,
                total_final = ?
            WHERE id = ?
        `, [
            totalBruto,
            totalDescuentoAporte,
            totalDescuentoPromocion,
            totalDescuento, // Ahora es un número correctamente formateado
            totalFinal,
            cotizacion.id
        ]);
    }
};

// Método para obtener todas las promociones activas
const getPromociones = async (req, res) => {
    try {
        const [promociones] = await db.query('SELECT * FROM promociones WHERE activa = 1');
        res.status(200).json(promociones);
    } catch (error) {
        console.error('Error al obtener promociones:', error);
        res.status(500).json({ message: 'Error al obtener promociones.' });
    }
};

const getCotizacionConPromociones = async (req, res) => {
    const { prospectoId } = req.params;

    try {
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

        if (!cotizaciones.length) {
            return res.status(404).json({ message: 'No se encontraron cotizaciones para este prospecto.' });
        }

        res.status(200).json(cotizaciones);
    } catch (error) {
        console.error('Error al obtener cotizaciones con promociones:', error);
        res.status(500).json({ message: 'Error al obtener cotizaciones con promociones.' });
    }
};

// Obtener promoción actual de un prospecto
const getPromocionActual = async (req, res) => {
    const { prospectoId } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT p.* 
            FROM promociones p
            JOIN prospectos_promociones pp ON p.id = pp.promocion_id
            WHERE pp.prospecto_id = ?
        `, [prospectoId]);

        if (!rows.length) {
            return res.status(200).json({ message: 'No hay promoción aplicada', promocion: null });
        }

        res.status(200).json({ promocion: rows[0] });
    } catch (error) {
        console.error('Error al obtener promoción actual:', error);
        res.status(500).json({ message: 'Error al obtener promoción actual.' });
    }
};

module.exports = { aplicarPromocion, getPromociones, getCotizacionConPromociones, getPromocionActual };