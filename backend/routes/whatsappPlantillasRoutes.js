const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const whatsappPlantillasController = require('../controllers/whatsappPlantillasController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Middleware para todas las rutas - requiere autenticación
router.use(authenticateToken);

/**
 * @route GET /api/whatsapp/plantillas
 * @desc Obtener lista de plantillas disponibles
 * @access Vendedores, Supervisores y Administradores
 */
router.get('/plantillas', whatsappPlantillasController.obtenerPlantillas);

/**
 * @route POST /api/whatsapp/saludo-inicial
 * @desc Enviar plantilla de saludo inicial
 * @access Vendedores, Supervisores y Administradores
 */
router.post('/saludo-inicial', [
    body('telefono')
        .notEmpty()
        .withMessage('El teléfono es requerido')
        .custom((telefono) => String(telefono).replace(/\D/g, '').length >= 10)
        .withMessage('Formato de teléfono inválido'),
    body('nombreVendedor')
        .notEmpty()
        .withMessage('El nombre del vendedor es requerido')
        .isLength({ min: 2, max: 50 })
        .withMessage('El nombre del vendedor debe tener entre 2 y 50 caracteres'),
    body('nombreCliente')
        .notEmpty()
        .withMessage('El nombre del cliente es requerido')
        .isLength({ min: 2, max: 50 })
        .withMessage('El nombre del cliente debe tener entre 2 y 50 caracteres')
], whatsappPlantillasController.enviarSaludoInicial);

/**
 * @route POST /api/whatsapp/seguimiento-cotizacion
 * @desc Enviar plantilla de seguimiento de cotización
 * @access Vendedores, Supervisores y Administradores
 */
router.post('/seguimiento-cotizacion', [
    body('telefono')
        .notEmpty()
        .withMessage('El teléfono es requerido')
        .custom((telefono) => String(telefono).replace(/\D/g, '').length >= 10)
        .withMessage('Formato de teléfono inválido'),
    body('nombreCliente')
        .notEmpty()
        .withMessage('El nombre del cliente es requerido')
        .isLength({ min: 2, max: 50 })
        .withMessage('El nombre del cliente debe tener entre 2 y 50 caracteres')
], whatsappPlantillasController.enviarSeguimientoCotizacion);

/**
 * @route POST /api/whatsapp/seguimiento-poliza
 * @desc Enviar plantilla de seguimiento de póliza
 * @access Vendedores, Supervisores y Administradores
 */
router.post('/seguimiento-poliza', [
    body('telefono')
        .notEmpty()
        .withMessage('El teléfono es requerido')
        .custom((telefono) => String(telefono).replace(/\D/g, '').length >= 10)
        .withMessage('Formato de teléfono inválido'),
    body('nombreCliente')
        .notEmpty()
        .withMessage('El nombre del cliente es requerido')
        .isLength({ min: 2, max: 50 })
        .withMessage('El nombre del cliente debe tener entre 2 y 50 caracteres')
], whatsappPlantillasController.enviarSeguimientoPoliza);

/**
 * @route POST /api/whatsapp/informacion-adicional
 * @desc Enviar plantilla de información adicional
 * @access Vendedores, Supervisores y Administradores
 */
router.post('/informacion-adicional', [
    body('telefono')
        .notEmpty()
        .withMessage('El teléfono es requerido')
        .custom((telefono) => String(telefono).replace(/\D/g, '').length >= 10)
        .withMessage('Formato de teléfono inválido')
], whatsappPlantillasController.enviarInformacionAdicional);

/**
 * @route POST /api/whatsapp/cierre-conversacion
 * @desc Enviar plantilla de cierre de conversación
 * @access Vendedores, Supervisores y Administradores
 */
router.post('/cierre-conversacion', [
    body('telefono')
        .notEmpty()
        .withMessage('El teléfono es requerido')
        .custom((telefono) => String(telefono).replace(/\D/g, '').length >= 10)
        .withMessage('Formato de teléfono inválido')
], whatsappPlantillasController.enviarCierreConversacion);

module.exports = router;
