const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

// 🗑️ MEMORY MANAGER para prevenir memory leaks (DESHABILITADO)
// const memoryManager = require('./utils/memoryManager');

// 🛡️ IMPORTAR MIDDLEWARES DE SEGURIDAD
const { 
    helmetConfig, 
    sanitizeInput, 
    securityLogger, 
    suspiciousIpDetection,
    validateRequiredHeaders
} = require('./middlewares/securityMiddleware');
const { apiLimiter, failedAttemptLimiter } = require('./middlewares/rateLimiters');
const { sanitizeInputs, preventSQLInjection } = require('./middlewares/validators');

// 🛡️ NUEVO: IMPORTAR SEGURIDAD AVANZADA
const advancedSecurity = require('./middlewares/advancedSecurity');

// ✅ NUEVO: IMPORTAR MIDDLEWARE DE TRACKING DE ACTIVIDAD
const { trackUserActivity, forceTrackActivity } = require('./middlewares/activityTracker');

const app = express();

// 🛡️ APLICAR HELMET PARA HEADERS DE SEGURIDAD
app.use(helmetConfig);

// 🛡️ LOGGING DE SEGURIDAD
app.use(morgan('combined')); // Log detallado en producción
app.use(securityLogger);

// ✅ CONFIGURAR LÍMITES EN EXPRESS (ANTES DE MIDDLEWARES DE SEGURIDAD)
app.use(express.json({ 
    limit: '50mb', // Reducido de 50mb por seguridad
    verify: (req, res, buf) => {
        // Verificar que el JSON sea válido
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ error: 'JSON inválido', code: 'INVALID_JSON' });
        }
    }
}));

app.use(express.urlencoded({ 
    limit: '10mb', 
    extended: true,
    parameterLimit: 100 // Limitar número de parámetros
}));

// 🖼️ SERVIR ARCHIVOS ESTÁTICOS (ANTES DE MIDDLEWARES DE SEGURIDAD)
app.use('/static', express.static(__dirname + '/utils/img'));

// � SERVIR ARCHIVOS DE WHATSAPP (uploads)
app.use('/uploads/whatsapp', express.static(__dirname + '/uploads/whatsapp'));
app.use('/api/uploads/whatsapp', express.static(__dirname + '/uploads/whatsapp'));


// �🔄 RUTAS WEBHOOKS - DEBEN IR ANTES DE LOS MIDDLEWARES DE SEGURIDAD
const webhookRoutes = require('./routes/webhookRoutes');

// Middleware específico para webhooks (menos restrictivo)
app.use('/webhooks', (req, res, next) => {
  console.log(`📨 Webhook recibido: ${req.method} ${req.path} desde ${req.ip}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body);
  next();
}, webhookRoutes);

// TAMBIÉN configurar la ruta con /api para compatibilidad con Twilio
app.use('/api/webhooks', (req, res, next) => {
  console.log(`📨 API Webhook recibido: ${req.method} ${req.path} desde ${req.ip}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body);
  next();
}, webhookRoutes);
app.use('/api/webhooks', (req, res, next) => {
  console.log(`📨 API Webhook recibido: ${req.method} ${req.path} desde ${req.ip}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body);
  next();
}, webhookRoutes);

// También mantener la ruta sin /api para compatibilidad
app.use('/webhooks', (req, res, next) => {
  console.log(`📨 Webhook recibido: ${req.method} ${req.path} desde ${req.ip}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body);
  next();
}, webhookRoutes);

// �🛡️ MIDDLEWARES DE SEGURIDAD (APLICAR DESPUÉS DE WEBHOOKS)
// Función para excluir rutas de webhooks de los middlewares de seguridad
const excludeWebhooks = (middleware) => {
  return (req, res, next) => {
    if (req.path.startsWith('/webhooks/')) {
      return next();
    }
    return middleware(req, res, next);
  };
};

// 🛡️ DETECCIÓN DE IPs SOSPECHOSAS (EXCLUIR WEBHOOKS)
app.use(excludeWebhooks(suspiciousIpDetection));

// 🛡️ NUEVO: MIDDLEWARE DE SEGURIDAD AVANZADO (EXCLUIR WEBHOOKS)
app.use(excludeWebhooks(advancedSecurity.securityMiddleware()));

// 🛡️ RATE LIMITING GLOBAL (EXCLUIR WEBHOOKS)
app.use(excludeWebhooks(apiLimiter));
app.use(excludeWebhooks(failedAttemptLimiter));

// 🛡️ SANITIZACIÓN DE INPUTS (EXCLUIR WEBHOOKS)
app.use(excludeWebhooks(sanitizeInput)); // MongoDB sanitize
app.use(excludeWebhooks(sanitizeInputs)); // Sanitización personalizada
app.use(excludeWebhooks(preventSQLInjection)); // Prevenir SQL injection

// 🛡️ VALIDACIÓN DE HEADERS (EXCLUIR WEBHOOKS)
app.use(excludeWebhooks(validateRequiredHeaders));

// Lista de orígenes permitidos
const allowedOrigins = [
  'https://cober360.vercel.app',
  'https://frontendnuevo.vercel.app',
  'http://192.168.56.1',
  'http://172.16.0.68',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://localhost:3000',
  process.env.BASE_URL || `https://${process.env.DOMAIN}`,
  'https://medicina-privada.online', // Mantener para desarrollo local
  'https://360.cober.online', // ✅ NUEVO: Dominio de producción
  'https://360.cober.online/afiliaciones', // ✅ NUEVO: Subdominio específico de afiliaciones
];

// Configuración CORS mejorada con soporte para webhooks
app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como aplicaciones móviles, curl, webhooks)
    if (!origin) return callback(null, true);

    // Verificar si el origen está en la lista de permitidos
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origen bloqueado por CORS:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Twilio-Signature']
}));

app.use(cookieParser());
app.use(express.json());

// 📊 MIDDLEWARE DE MONITOREO DE PERFORMANCE (DESHABILITADO)
// const performanceMonitor = require('./utils/performanceMonitor');
// app.use(performanceMonitor.trackingMiddleware());

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const prospectoRoutes = require('./routes/vendedor/prospectoRoutes');
const sessionRoutes = require('./routes/session/sessionRoutes');
const supervisorRoutes = require('./routes/supervisor/supervisorRoutes');
const formRoutes = require('./routes/formLead/formRoutes');
const tipoAfiliacionRoutes = require('./routes/vendedor/tipoAfiliacionRoutes');
const localidadesRoutes = require('./routes/vendedor/localidadesRoutes');
const historialRoutes = require('./routes/vendedor/historialRoutes');
const listaPreciosRoutes = require('./routes/admin/listaPreciosRoutes');
const cotizacionesRoutes = require('./routes/cotizaciones/cotizaciones');
const promocionesRoutes = require('./routes/vendedor/promocionesRoutes');
const chatbotRoutes = require('./routes/chatbot/chatbotRoutes');
const chatbotVendedorRoutes = require('./routes/chatbot/chatbotVendedorRoutes');
const polizaRoutes = require('./routes/poliza/polizaRoutes');
const polizaDocumentosRoutes = require('./routes/poliza/polizaDocumentosRoutes');
const prestadorRoutes = require('./routes/admin/prestadorRoutes');
const exportRoutes = require('./routes/exportRoutes');
const categoriasRoutes = require('./routes/admin/categoriasRoutes');
const cuponPagoRoutes = require('./routes/cuponPagoRoutes');
const backOfficeRoutes = require('./routes/backoffice/backOfficeRoutes');
const rateLimitRoutes = require('./routes/admin/rateLimitRoutes');
const trazabilidadRoutes = require('./routes/admin/trazabilidadRoutes');
const sessionStatusRoutes = require('./routes/sessionStatusRoutes');
const chatRoutes = require('./routes/vendedor/chatRoutes');
const whatsappPlantillasRoutes = require('./routes/whatsappPlantillasRoutes');
const adminMetricasRoutes = require('./routes/adminMetricas');
// const performanceRoutes = require('./routes/performanceRoutes'); // DESHABILITADO
// const nacionalidadRoutes = require('./routes/utils/nacionalidadRoutes');

// ✅ MIDDLEWARE DE TRACKING DE ACTIVIDAD (APLICAR A TODAS LAS RUTAS AUTENTICADAS)
app.use((req, res, next) => {
  // Excluir webhooks y rutas de autenticación
  if (req.path.startsWith('/webhooks') || req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) {
    return next();
  }
  
  // Aplicar tracking de actividad
  trackUserActivity(req, res, next);
});

app.use('/admin', adminRoutes);
app.use('/admin/rate-limits', rateLimitRoutes);
app.use('/admin/trazabilidad', trazabilidadRoutes);
app.use('/session-status', sessionStatusRoutes);
app.use('/auth', authRoutes);
app.use('/prospectos', prospectoRoutes);
app.use('/sessions', sessionRoutes);
app.use('/supervisor', supervisorRoutes);
app.use('/backoffice', backOfficeRoutes);
// 🔧 RUTAS CON PREFIJO /api PARA COMPATIBILIDAD CON NGINX
app.use('/api/backoffice', backOfficeRoutes);
app.use('/lead', formRoutes);
app.use('/tipos_afiliacion', tipoAfiliacionRoutes);
app.use('/localidades', localidadesRoutes);
app.use('/prospectos', historialRoutes);
app.use('/admin/lista-precios', listaPreciosRoutes);
app.use('/admin/categorias', categoriasRoutes);
app.use('/cotizaciones', cotizacionesRoutes);
app.use('/vendedor', promocionesRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/polizas', polizaRoutes);
app.use('/poliza-documentos', polizaDocumentosRoutes);
app.use('/admin/prestadores', prestadorRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/chatbot-vendedor', chatbotVendedorRoutes);
app.use('/export', exportRoutes);
app.use('/cupones-pago', cuponPagoRoutes);
app.use('/chat', chatRoutes);
app.use('/whatsapp', whatsappPlantillasRoutes);
// 🔧 COMPATIBILIDAD: Ruta con prefijo /api para chat
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappPlantillasRoutes);
app.use('/admin', adminMetricasRoutes);
app.use('/api/admin', adminMetricasRoutes);
// 📊 MÉTRICAS DE PERFORMANCE (DESHABILITADO PARA EVITAR MEMORY LEAKS)
// app.use('/performance', performanceRoutes);
// app.use('/api/performance', performanceRoutes);

// 📊 DASHBOARD DE PERFORMANCE (DESHABILITADO)
// app.get('/dashboard', (req, res) => {
//     res.sendFile(__dirname + '/public/performance-dashboard.html');
// });
app.use('/security', require('./routes/securityRoutes'));
// app.use('/nacionalidades', nacionalidadRoutes);
app.use('/supervisor/polizas', require('./routes/supervisor/polizasRoutes'));
app.use('/polizas', require('./routes/poliza/polizaRoutes'));

// Configuración más segura de trust proxy
if (process.env.NODE_ENV === 'production') {
  // En producción, confiar solo en el primer proxy
  app.set('trust proxy', 1);
} else {
  // En desarrollo, configuración para localhost
  app.set('trust proxy', 'loopback');
}

// 🛡️ INICIALIZAR TAREAS DE SEGURIDAD
const SecurityTasks = require('./jobs/securityTasks');
SecurityTasks.init();

// 🏥 ENDPOINT DE HEALTH CHECK BÁSICO
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'cober360',
    uptime: process.uptime()
  });
});

// 🏥 ENDPOINT DE HEALTH CHECK DE SEGURIDAD
app.get('/health/security', async (req, res) => {
  const healthCheck = await SecurityTasks.healthCheck();
  res.status(healthCheck.status === 'healthy' ? 200 : 500).json(healthCheck);
});

// 🛡️ MIDDLEWARE DE MANEJO DE ERRORES GLOBAL
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  
  // No exponer detalles del error en producción
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(error.status || 500).json({
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { details: error.message, stack: error.stack })
  });
});

// 🛡️ MIDDLEWARE PARA RUTAS NO ENCONTRADAS
app.use('*', (req, res) => {
  console.warn(`🚨 Ruta no encontrada: ${req.method} ${req.originalUrl} desde IP: ${req.ip}`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    code: 'NOT_FOUND'
  });
});

const PORT = process.env.PORT || 4000;

// ✅ CREAR SERVIDOR HTTP Y CONFIGURAR WEBSOCKET
const http = require('http');
const server = http.createServer(app);

// ✅ INICIALIZAR WEBSOCKET PARA USUARIOS ACTIVOS
const activeUsersWS = require('./services/activeUsersWebSocket');
activeUsersWS.initialize(server);

server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP corriendo en puerto ${PORT}`);
  console.log(`🛡️ Sistema de seguridad activado`);
  console.log(`� WebSocket para usuarios activos disponible en: ws://localhost:${PORT}/admin`);
  console.log(`�🔍 Health check disponible en: http://localhost:${PORT}/health/security`);
});

// ✅ MANEJO GRACEFUL DE CIERRE
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  activeUsersWS.cleanup();
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  activeUsersWS.cleanup();
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});
