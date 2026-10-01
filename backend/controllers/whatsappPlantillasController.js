const whatsappService = require('../services/whatsappService');
const ChatService = require('../services/chatService');
const { validationResult } = require('express-validator');
const db = require('../config/db');

/**
 * Función auxiliar para buscar conversación por teléfono y vendedor
 */
const buscarConversacionPorTelefono = async (telefono, vendedorId) => {
    if (!telefono || !vendedorId) {
        console.log('⚠️ Parámetros faltantes para buscar conversación:', { telefono, vendedorId });
        return null;
    }

    const telefonoNormalizado = telefono.replace(/[^0-9]/g, '');
    
    const [conversaciones] = await db.execute(
        `SELECT id FROM chat_conversaciones_whatsapp 
         WHERE telefono LIKE ? AND vendedor_id = ? AND estado IN ('activa', 'pausada')
         ORDER BY ultima_actividad DESC LIMIT 1`,
        [`%${telefonoNormalizado}%`, vendedorId]
    );

    return conversaciones.length > 0 ? conversaciones[0].id : null;
};

/**
 * Función auxiliar para enviar plantilla y guardar en chat
 */
const enviarPlantillaYGuardar = async (telefono, vendedorId, mensajeTexto, enviarFuncion) => {
    try {
        console.log('📤 Iniciando envío de plantilla:', { telefono, vendedorId, mensajeTexto: mensajeTexto.substring(0, 50) + '...' });

        // Enviar por WhatsApp
        const resultado = await enviarFuncion();
        
        // Buscar conversación existente
        const conversacionId = await buscarConversacionPorTelefono(telefono, vendedorId);
        
        if (conversacionId) {
            console.log('💾 Guardando mensaje en conversación:', conversacionId);
            
            // Guardar mensaje en la base de datos del chat
            await ChatService.registrarMensaje({
                conversacion_id: conversacionId,
                mensaje: mensajeTexto,
                tipo: 'enviado',
                origen: 'vendedor',
                twilio_message_sid: resultado.sid,
                estado_entrega: 'enviado'
            });

            // Actualizar actividad de la conversación
            await db.execute(
                `UPDATE chat_conversaciones_whatsapp SET ultima_actividad = NOW() WHERE id = ?`,
                [conversacionId]
            );

            console.log('✅ Mensaje guardado exitosamente en la conversación');
        } else {
            console.log('⚠️ No se encontró conversación existente para el teléfono:', telefono);
        }

        return resultado;
    } catch (error) {
        console.error('❌ Error en enviarPlantillaYGuardar:', error);
        throw error;
    }
};

/**
 * Obtener lista de plantillas disponibles
 */
const obtenerPlantillas = async (req, res) => {
    try {
        console.log('📋 Obteniendo plantillas de WhatsApp disponibles...');
        
        if (!whatsappService.isServiceAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        const todasLasPlantillas = whatsappService.getPlantillasDisponibles();
        
        // Filtrar solo las plantillas habilitadas para envío manual desde el chat
        const plantillasHabilitadas = {
            saludo_inicial: todasLasPlantillas.saludoInicial || todasLasPlantillas.saludo_inicial,
            seguimiento_cotizacion: todasLasPlantillas.seguimiento_cotizacion,
            seguimiento_poliza: todasLasPlantillas.seguimiento_poliza,
            informacion_adicional: todasLasPlantillas.informacion_adicional,
            cierre_conversacion: todasLasPlantillas.cierre_conversacion
        };

        res.status(200).json({
            success: true,
            message: 'Plantillas obtenidas exitosamente',
            plantillas: plantillasHabilitadas
        });

    } catch (error) {
        console.error('❌ Error al obtener plantillas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener plantillas',
            error: error.message
        });
    }
};

/**
 * Enviar plantilla de saludo inicial
 */
const enviarSaludoInicial = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { telefono, nombreVendedor, nombreCliente } = req.body;
        const vendedorId = req.user.id;

        console.log(`📱 Enviando saludo inicial - Vendedor: ${vendedorId}, Teléfono: ${telefono}`);

        if (!whatsappService.isServiceAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        const resultado = await enviarPlantillaYGuardar(
            telefono,
            vendedorId,
            `Hola ${nombreCliente}, soy ${nombreVendedor} de Cober. Te escribo para retomar contacto: ¿seguís interesado/a en avanzar con tu plan de salud? Cualquier duda, estoy para ayudarte.`,
            () => whatsappService.enviarSaludoInicial(telefono, nombreVendedor, nombreCliente)
        );

        res.status(200).json({
            success: true,
            message: 'Saludo inicial enviado exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error al enviar saludo inicial:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al enviar saludo inicial',
            error: error.message
        });
    }
};

/**
 * Enviar plantilla de seguimiento de cotización
 */
const enviarSeguimientoCotizacion = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { telefono, nombreCliente } = req.body;
        const vendedorId = req.user.id;

        console.log(`📱 Enviando seguimiento de cotización - Vendedor: ${vendedorId}, Teléfono: ${telefono}`);

        if (!whatsappService.isServiceAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        const resultado = await enviarPlantillaYGuardar(
            telefono,
            vendedorId,
            `👋 Hola ${nombreCliente}, ¿Pudiste revisar la cotización que te envié 📄?`,
            () => whatsappService.enviarSeguimientoCotizacion(telefono, nombreCliente)
        );

        res.status(200).json({
            success: true,
            message: 'Seguimiento de cotización enviado exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error al enviar seguimiento de cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al enviar seguimiento de cotización',
            error: error.message
        });
    }
};

/**
 * Enviar plantilla de seguimiento de póliza
 */
const enviarSeguimientoPoliza = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { telefono, nombreCliente } = req.body;
        const vendedorId = req.user.id;

        console.log(`📱 Enviando seguimiento de póliza - Vendedor: ${vendedorId}, Teléfono: ${telefono}`);

        if (!whatsappService.isServiceAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        const resultado = await enviarPlantillaYGuardar(
            telefono,
            vendedorId,
            `👋 Hola ${nombreCliente}, ¿Recibiste correctamente tu póliza 📄✅?`,
            () => whatsappService.enviarSeguimientoPoliza(telefono, nombreCliente)
        );

        res.status(200).json({
            success: true,
            message: 'Seguimiento de póliza enviado exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error al enviar seguimiento de póliza:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al enviar seguimiento de póliza',
            error: error.message
        });
    }
};

/**
 * Enviar plantilla de información adicional
 */
const enviarInformacionAdicional = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { telefono } = req.body;
        const vendedorId = req.user.id;

        console.log(`📱 Enviando información adicional - Vendedor: ${vendedorId}, Teléfono: ${telefono}`);

        if (!whatsappService.isServiceAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        const resultado = await enviarPlantillaYGuardar(
            telefono,
            vendedorId,
            `💙 Si necesitás más información sobre tu plan de salud 🩺, podés contactarte con nosotros al 0800-888-COBER (26237) de lunes a viernes de 8 a 20hs. También podés escribirnos por WhatsApp 📱 o por email a info@cober.com.ar 📧.`,
            () => whatsappService.enviarInformacionAdicional(telefono)
        );

        res.status(200).json({
            success: true,
            message: 'Información adicional enviada exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error al enviar información adicional:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al enviar información adicional',
            error: error.message
        });
    }
};

/**
 * Enviar plantilla de cierre de conversación
 */
const enviarCierreConversacion = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { telefono } = req.body;
        const vendedorId = req.user.id;

        console.log(`📱 Enviando cierre de conversación - Vendedor: ${vendedorId}, Teléfono: ${telefono}`);

        if (!whatsappService.isServiceAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        const resultado = await enviarPlantillaYGuardar(
            telefono,
            vendedorId,
            `✅ Perfecto, cualquier otra consulta no dudes en escribirme 📩.`,
            () => whatsappService.enviarCierreConversacion(telefono)
        );

        res.status(200).json({
            success: true,
            message: 'Cierre de conversación enviado exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error al enviar cierre de conversación:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al enviar cierre de conversación',
            error: error.message
        });
    }
};

module.exports = {
    obtenerPlantillas,
    enviarSaludoInicial,
    enviarSeguimientoCotizacion,
    enviarSeguimientoPoliza,
    enviarInformacionAdicional,
    enviarCierreConversacion
};