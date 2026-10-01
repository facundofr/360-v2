const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio si no existe
const createUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/polizas/documentos');
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // No usar req.body porque multer procesa el archivo ANTES de parsear el body
    // Usar un nombre basado en timestamp + random para evitar colisiones
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `doc_${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

// Filtros de archivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG) y PDF.'), false);
  }
};

// Configuración final
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

module.exports = upload;