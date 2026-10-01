const express = require('express');
const router = express.Router();
const ChatController = require('../../controllers/vendedor/chatController');
const { authenticateToken } = require('../../middlewares/authMiddleware');
const { notificationLimiter } = require('../../middlewares/rateLimiters'); // 🔔 Rate limiter específico
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 📎 Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/whatsapp');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'video/mp4',
    'video/3gpp',
    'audio/mpeg',
    'audio/ogg',
    'audio/aac',
    'audio/amr'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  },
  fileFilter: fileFilter
});

// 🛡️ Todas las rutas requieren autenticación
router.use(authenticateToken);

// 📋 Obtener conversaciones del vendedor (con rate limiter específico para polling)
router.get('/conversaciones', notificationLimiter, ChatController.obtenerConversaciones);

// ✅ NUEVO: Obtener conversaciones por prospecto
router.get('/conversaciones/prospecto/:prospecto_id', ChatController.obtenerConversacionesPorProspecto);

// 💬 Obtener mensajes de una conversación
router.get('/conversaciones/:id/mensajes', ChatController.obtenerMensajes);

// 📤 Enviar mensaje
router.post('/conversaciones/:id/mensajes', ChatController.enviarMensaje);

// 📎 Enviar mensaje con archivo adjunto
router.post('/conversaciones/:id/mensajes/archivo', upload.single('archivo'), ChatController.enviarMensajeConArchivo);

// ✅ Marcar mensajes como leídos
router.patch('/conversaciones/:id/marcar-leidos', ChatController.marcarComoLeidos);

// �🔄 Cambiar estado de conversación
router.patch('/conversaciones/:id/estado', ChatController.cambiarEstado);

// 📝 Obtener plantillas
router.get('/plantillas', ChatController.obtenerPlantillas);

// ➕ Crear plantilla personalizada
router.post('/plantillas', ChatController.crearPlantilla);

// � Verificar si un número está registrado como prospecto
router.get('/verificar-numero/:telefono', ChatController.verificarNumeroRegistrado);

// �📊 Obtener estadísticas (con rate limiter específico para polling)
router.get('/estadisticas', notificationLimiter, ChatController.obtenerEstadisticas);

module.exports = router;
