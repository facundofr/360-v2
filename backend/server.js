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

// Lista de orígenes permitidos
const allowedOrigins = [
  'https://360v2-virid.vercel.app',  
  'http://192.168.56.1',
  'http://172.16.0.68',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://localhost:3000',
  'https://cober360.com',
  process.env.BASE_URL || `https://${process.env.DOMAIN}`,
  'https://medicina-privada.online',
  'https://360.cober.online',
  'https://360.cober.online/afiliaciones',
];

// ✅ CORS DEBE APLICARSE ANTES QUE CUALQUIER MIDDLEWARE DE SEGURIDAD
// para que todas las respuestas de error incluyan el header Access-Control-Allow-Origin
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
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

app.use(cookieParser());
app.use(express.json());

// 📊 MIDDLEWARE DE MONITOREO DE PERFORMANCE (DESHABILITADO)
// const performanceMonitor = require('./utils/performanceMonitor');
// app.use(performanceMonitor.trackingMiddleware());

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const vendedoresAdminRoutes = require('./routes/admin/vendedoresAdminRoutes');
const supervisoresAdminRoutes = require('./routes/admin/supervisoresAdminRoutes');
const prospectoRoutes = require('./routes/vendedor/prospectoRoutes');
const sessionRoutes = require('./routes/session/sessionRoutes');
const supervisorRoutes = require('./routes/supervisor/supervisorRoutes');
const formRoutes = require('./routes/formLead/formRoutes');
const tipoAfiliacionRoutes = require('./routes/vendedor/tipoAfiliacionRoutes');
const localidadesRoutes = require('./routes/vendedor/localidadesRoutes');
const historialRoutes = require('./routes/vendedor/historialRoutes');
const refritosVendedorRoutes = require('./routes/vendedor/refritosRoutes');
const listaPreciosRoutes = require('./routes/admin/listaPreciosRoutes');
const monotributoRoutes = require('./routes/monotributo');
const promocionesAdminRoutes = require('./routes/admin/promocionesRoutes');
const cotizacionesRoutes = require('./routes/cotizaciones/cotizaciones');
const promocionesRoutes = require('./routes/vendedor/promocionesRoutes');
const chatbotRoutes = require('./routes/chatbot/chatbotRoutes');
const chatbotVendedorRoutes = require('./routes/chatbot/chatbotVendedorRoutes');
const polizaRoutes = require('./routes/poliza/polizaRoutes');
const polizaDocumentosRoutes = require('./routes/poliza/polizaDocumentosRoutes');
const prestadorRoutes = require('./routes/admin/prestadorRoutes');
const exportRoutes = require('./routes/exportRoutes');
const categoriasRoutes = require('./routes/admin/categoriasRoutes');
const validacionWhatsappRoutes = require('./routes/admin/validacionWhatsappRoutes');
const cuponPagoRoutes = require('./routes/cuponPagoRoutes');
const backOfficeRoutes = require('./routes/backoffice/backOfficeRoutes');
const rateLimitRoutes = require('./routes/admin/rateLimitRoutes');
const trazabilidadRoutes = require('./routes/admin/trazabilidadRoutes');
const sessionStatusRoutes = require('./routes/sessionStatusRoutes');
const chatRoutes = require('./routes/vendedor/chatRoutes');
const polizasVendedorRoutes = require('./routes/vendedor/polizasRoutes'); // ✅ NUEVO: Rutas de pólizas para vendedor
const whatsappPlantillasRoutes = require('./routes/whatsappPlantillasRoutes');
const adminMetricasRoutes = require('./routes/adminMetricas');
const fcmRoutes = require('./routes/fcmRoutes');
const vafirmaRoutes = require('./routes/vafirmaRoutes');
const refritosRoutes = require('./routes/admin/refritosRoutes'); // ✅ NUEVO: Rutas de refritos
const compensadorRoutes = require('./routes/admin/compensadorRoutes'); // ✅ NUEVO: Dashboard del compensador de leads (proxy al Lead Router)
const gecrosRoutes = require('./routes/gecrosRoutes'); // ✅ NUEVO: Rutas de Gecros
const dashboardMetricasRoutes = require('./routes/admin/dashboardMetricasRoutes'); // ✅ NUEVO: Dashboard de métricas
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

// 🌐 RUTAS PÚBLICAS (ANTES DE RUTAS AUTENTICADAS)
app.use('/api/public/lista-precios', listaPreciosRoutes);
app.use('/public/lista-precios', listaPreciosRoutes); // Ruta alternativa sin /api



// 🥚 RUTAS DE REFRITOS deben ir ANTES de /admin genérico para no ser atrapadas por 404 de ese router
app.use('/admin/refritos', refritosRoutes);
app.use('/api/admin/refritos', refritosRoutes);

// 🚦 COMPENSADOR DE LEADS — proxy al Lead Router, mismo motivo que refritos arriba
app.use('/admin/compensador', compensadorRoutes);
app.use('/api/admin/compensador', compensadorRoutes);

// 📊 RUTAS DE DASHBOARD MÉTRICAS
app.use('/admin/dashboard', dashboardMetricasRoutes);
app.use('/api/admin/dashboard', dashboardMetricasRoutes);

app.use('/admin', adminRoutes);
app.use('/admin/vendedores', vendedoresAdminRoutes);
app.use('/admin/supervisores', supervisoresAdminRoutes);
app.use('/admin/rate-limits', rateLimitRoutes);
app.use('/admin/trazabilidad', trazabilidadRoutes);
// 📊 RUTAS DE REASIGNACIÓN AUTOMÁTICA
const reasignacionesRoutes = require('./routes/reasignaciones');
app.use('/reasignaciones', reasignacionesRoutes);
app.use('/api/reasignaciones', reasignacionesRoutes);
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
app.use('/monotributo', monotributoRoutes);
app.use('/api/monotributo', monotributoRoutes);
app.use('/admin/promociones', promocionesAdminRoutes);
// 🔧 Compatibilidad con prefijo /api
app.use('/api/admin/promociones', promocionesAdminRoutes);
app.use('/admin/categorias', categoriasRoutes);
app.use('/api/admin/lista-precios', listaPreciosRoutes);
app.use('/api/admin/categorias', categoriasRoutes);
app.use('/admin/validacion-whatsapp', validacionWhatsappRoutes);
app.use('/api/admin/validacion-whatsapp', validacionWhatsappRoutes);
app.use('/cotizaciones', cotizacionesRoutes);
app.use('/vendedor/refritos', refritosVendedorRoutes);
app.use('/vendedor', promocionesRoutes);
app.use('/vendedor', polizasVendedorRoutes); // ✅ NUEVO: Rutas de pólizas para vendedor (PATCH /vendedor/:id/enviar-supervisor)
app.use('/api/vendedor', polizasVendedorRoutes); // ✅ NUEVA: Compatibilidad con /api
app.use('/chatbot', chatbotRoutes);
app.use('/polizas', polizaRoutes);
app.use('/poliza-documentos', polizaDocumentosRoutes);
// ✅ NUEVA: Agregar rutas adicionales para compatibilidad
app.use('/api/polizas', polizaDocumentosRoutes);
// ✅ MONTAR RUTAS DE DOCUMENTOS EN /polizas/documentos DIRECTAMENTE
app.use('/polizas/documentos', polizaDocumentosRoutes);
app.use('/admin/prestadores', prestadorRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/chatbot-vendedor', chatbotVendedorRoutes);
app.use('/export', exportRoutes);
app.use('/cupones-pago', cuponPagoRoutes);
app.use('/chat', chatRoutes);
app.use('/whatsapp', whatsappPlantillasRoutes);
app.use('/fcm', fcmRoutes);
// 🔧 COMPATIBILIDAD: Ruta con prefijo /api para chat
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappPlantillasRoutes);
app.use('/api/fcm', fcmRoutes);
app.use('/vafirma', vafirmaRoutes);
app.use('/api/vafirma', vafirmaRoutes);
app.use('/admin', adminMetricasRoutes);
app.use('/api/admin', adminMetricasRoutes);
app.use('/gecros', gecrosRoutes); // ✅ NUEVO: Rutas de Gecros
app.use('/api/gecros', gecrosRoutes); // ✅ NUEVO: Rutas de Gecros con prefijo /api

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
app.use('/vendedor/polizas', require('./routes/vendedor/polizaDocumentosRoutes')); // ✅ Rutas de documentos para vendedor
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

// 📲 INICIALIZAR JOB DE FALLBACK DEL VALIDADOR DE WHATSAPP
const ValidacionFallbackJob = require('./jobs/ValidacionFallbackJob');
ValidacionFallbackJob.iniciar();

// 🌱 INICIALIZAR JOB DE NUTRICIÓN DE LEADS (post-validación, rama "urgente")
const NutricionLeadsJob = require('./jobs/NutricionLeadsJob');
NutricionLeadsJob.iniciar();

// 📊 INICIALIZAR JOB DE REASIGNACIÓN AUTOMÁTICA
const ReasignacionAutomaticaJob = require('./jobs/ReasignacionAutomaticaJob');
const ReasignacionService = require('./services/ReasignacionService');
(async () => {
  try {
    console.log('🔄 Iniciando sistema de reasignación automática...');
    // Inicializar tabla de auditoría
    await ReasignacionService.inicializarTablas();
    console.log('✅ Tabla de auditoría verificada');
    // Iniciar job de reasignación
    ReasignacionAutomaticaJob.iniciar();
    console.log('✅ Job de reasignación automática iniciado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando reasignación automática:', error);
    console.error('Stack trace:', error.stack);
  }
})();

// ☁️ INICIALIZAR JOB DE BACKUP A GOOGLE DRIVE
const GoogleDriveBackupJob = require('./jobs/googleDriveBackupJob');
GoogleDriveBackupJob.iniciar();

// 📋 JOB DE SINCRONIZACIÓN DE ESTADOS DE FIRMA CON VAFIRMA
// Fallback del webhook en tiempo real (websocket): sincroniza envíos de la última semana cada 20 minutos.
const SincronizarEstadosFirmaJob = require('./jobs/sincronizarEstadosFirmaJob');
try {
  console.log('🔄 Iniciando sincronización automática de estados de firma con VaFirma...');
  SincronizarEstadosFirmaJob.iniciarJob();
  console.log('✅ Job de sincronización de firma iniciado correctamente');
} catch (error) {
  console.error('❌ Error inicializando sincronización de firma:', error);
}

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
activeUsersWS.initNotificacionesNamespace();

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
