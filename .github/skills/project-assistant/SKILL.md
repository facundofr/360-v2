---
name: project-assistant
description: "Asistente de desarrollo para el proyecto Cober360 (CRM de seguros / prepagos de salud). Usar cuando: agregar nueva funcionalidad, crear rutas/controladores/modelos, crear componentes React, aplicar patrones del proyecto, entender la arquitectura full-stack, agregar migraciones SQL, o seguir convenciones existentes del codebase."
argument-hint: "Describe la feature o tarea que necesitas implementar"
---

# Project Assistant — Cober360

## Descripción del proyecto
CRM de prepagos de salud / seguros con 4 roles de usuario: **Vendedor, Supervisor, Admin y BackOffice**. Gestiona prospectos (leads), pólizas, cotizaciones, firma electrónica (VaFirma), pagos (MercadoPago), WhatsApp (Twilio), notificaciones push (Firebase) y sincronización con Google Sheets.

**URL producción**: `https://360.cober.online`  
**Ruta frontend (basename)**: `/afiliaciones`  
**Puerto backend**: `4001`

---

## Stack Técnico

### Backend (`/backend/`)
- **Runtime**: Node.js + Express 4
- **Base de datos**: MySQL2 con pool (`connectionLimit: 50`, `dateStrings: true`)
- **Auth**: JWT (`jsonwebtoken`) + blacklist de tokens + bcryptjs
- **Validación**: `validator` (en modelos), `express-validator` (en middlewares)
- **Seguridad**: `helmet`, `express-rate-limit`, `express-mongo-sanitize`, sanitización de inputs
- **Tiempo real**: `socket.io` 4
- **Jobs**: `node-cron`
- **Email**: `nodemailer` (SMTP Gmail, puerto 587)
- **WhatsApp**: `twilio`
- **Pagos**: `mercadopago` v2
- **PDFs**: `pdfkit` + `puppeteer`
- **Google**: `googleapis` (Sheets, Drive)
- **Push**: `firebase-admin`
- **Firma electrónica**: VaFirma (integración externa)
- **Archivos**: `multer` v2

### Frontend (`/frontend/src/`)
- **Framework**: React 19 + Vite 6
- **Router**: `react-router-dom` v7 con `basename="/afiliaciones"`
- **UI**: React-Bootstrap 2 + MUI v7
- **HTTP**: Axios con interceptor global de sesión expirada
- **Alertas**: SweetAlert2
- **Gráficos**: Chart.js, ECharts, Recharts, MUI X Charts
- **Mapas**: Leaflet + react-leaflet
- **Íconos**: react-icons, lucide-react, FontAwesome, MUI Icons
- **Auth storage**: `localStorage` (`token`)
- **PDFs**: `react-pdf`
- **WebSocket cliente**: `socket.io-client`

---

## Estructura de directorios

### Backend
```
backend/
├── server.js               # Entry point, registra todas las rutas bajo /api/
├── config/
│   ├── db.js               # Pool MySQL2 (importar con: const db = require('../config/db'))
│   ├── multer.js           # Configuración de uploads
│   ├── vafirma.js          # Config VaFirma
│   └── metricasConfig.js
├── constants/
│   └── roles.js            # ROLES = { VENDEDOR:1, SUPERVISOR:2, ADMIN:3, BACK_OFFICE:4 }
├── routes/                 # Express Router — SOLO endpoints + middlewares
│   ├── authRoutes.js
│   ├── vafirmaRoutes.js
│   ├── webhookRoutes.js    # Webhooks van ANTES de los middlewares de seguridad
│   ├── admin/
│   ├── backoffice/
│   ├── chatbot/
│   ├── cotizaciones/
│   ├── formLead/
│   ├── googleSheets/
│   ├── poliza/
│   ├── session/
│   ├── supervisor/
│   ├── utils/
│   └── vendedor/
│       ├── prospectoRoutes.js
│       ├── polizasRoutes.js
│       ├── historialRoutes.js
│       ├── chatRoutes.js
│       ├── cotizacionesRoutes.js (tipoAfiliacionRoutes.js, localidadesRoutes.js)
│       └── refritosRoutes.js
├── controllers/            # Lógica request/response
│   ├── authController.js
│   ├── vafirmaController.js
│   ├── admin/              # dashboardAdminController, vendedoresAdminController, etc.
│   ├── backoffice/         # backOfficeController, polizasBackOfficeController, etc.
│   ├── poliza/             # polizaController, polizaPDFController, polizaVendedorController
│   ├── supervisor/         # supervisorController, vendedoresController
│   └── vendedor/           # prospectoController, cotizacionesController, chatController
├── models/
│   ├── userModel.js        # CRUD usuarios con validación y bcrypt
│   ├── vendedor/
│   │   ├── prospectoModel.js   # Con validación interna + RefritosVisibilityService
│   │   └── historialModel.js
│   ├── poliza/
│   │   ├── polizaModel.js
│   │   └── polizaDocumentosModel.js
│   └── formLead/
│       └── formModel.js
├── services/
│   ├── emailService.js          # Nodemailer (vars: EMAIL_USER, EMAIL_PASS, SMTP_HOST)
│   ├── whatsappService.js       # Twilio WhatsApp
│   ├── googleSheetsService.js   # Google Sheets API
│   ├── googleSheetsPolizasService.js
│   ├── googleDriveBackupService.js
│   ├── mercadoPagoService.js    # Pagos MP
│   ├── notificationsService.js  # Firebase push
│   ├── vaFirmaService.js        # Firma electrónica pólizas
│   ├── chatService.js
│   ├── ReasignacionService.js   # Round-robin de leads
│   ├── RefritosVisibilityService.js
│   ├── publicListaPreciosService.js
│   ├── recaptchaService.js
│   └── activeUsersWebSocket.js  # Socket.io usuarios activos
├── middlewares/
│   ├── authMiddleware.js        # authenticateToken, authenticateRoles
│   ├── roleMiddleware.js        # roleMiddleware([ROLES.ADMIN, ROLES.SUPERVISOR])
│   ├── rateLimiters.js          # apiLimiter, failedAttemptLimiter
│   ├── securityMiddleware.js    # helmetConfig, sanitizeInput, securityLogger
│   ├── advancedSecurity.js      # Detección avanzada de amenazas
│   ├── duplicatePreventionMiddleware.js
│   ├── activityTracker.js       # trackUserActivity, forceTrackActivity
│   ├── activeUsersLimiter.js
│   └── validators.js            # sanitizeInputs, preventSQLInjection
├── migrations/                  # Archivos .sql/.js de cambios de schema
├── jobs/
│   ├── ReasignacionAutomaticaJob.js
│   ├── googleDriveBackupJob.js
│   ├── securityTasks.js
│   └── sincronizarEstadosFirmaJob.js
└── utils/
    ├── tokenBlacklist.js
    ├── pdfGenerator.js
    ├── performanceMonitor.js
    └── holidays.js
```

### Frontend
```
frontend/src/
├── App.jsx                     # Router principal, providers, interceptor axios
├── components/
│   ├── common/
│   │   ├── AuthContext.jsx     # AuthProvider — contexto global de auth
│   │   ├── ProtectedRoute.jsx  # AdminRoute, SupervisorRoute, VendedorRoute, BackOfficeRoute, GuestRoute
│   │   ├── NavBar.jsx
│   │   ├── SessionManager.jsx  # Detecta inactividad / expiración
│   │   ├── ChatWidget.jsx
│   │   ├── ManualWidget.jsx
│   │   ├── CargaDocumentosModal.jsx
│   │   └── NotificationsInitializer.jsx
│   ├── features/
│   │   ├── auth/               # Login, Register, ResetPassword, RequestReset, VerifyEmail
│   │   ├── lead/               # FormularioLead.jsx (RUTA PÚBLICA /formulario-lead)
│   │   ├── vendedor/           # ProspectosDashboard, ProspectoDetalle, PolizaForm, WhatsAppVista
│   │   ├── supervisor/         # SupervisorDashboard, SupervisorResumen, PolizasSupervisor
│   │   ├── admin/              # AdminDashboard, PolizasAdmin, UsuariosAdmin, RefritosAdmin, etc.
│   │   └── backoffice/         # BackOfficeDashboard, ProspectosBackOffice, PolizasBackOffice
│   ├── admin/                  # SecurityDashboard, ActiveUsersMonitor
│   ├── modals/
│   ├── badges/
│   └── buttons/
├── contexts/
│   └── NotificationContext.jsx # NotificationProvider
├── hooks/
│   ├── usePageVisibility.js
│   └── useUserActivity.js      # Heartbeat cada 2 minutos
├── services/
│   ├── notificationsService.js
│   ├── refritosService.js
│   └── nacionalidadService.js
└── utils/
    └── sessionExpiredManager.js # Evita múltiples modales de sesión expirada
```

---

## Comandos del servidor

```bash
# Reiniciar el backend (producción) — nombre: cober360-produccion (ID 4)
pm2 restart cober360-produccion   # o: pm2 restart 4

# Ver logs del backend
pm2 logs cober360-produccion

# Ver estado de todos los procesos PM2
pm2 status
```

---

## Roles y permisos

```js
// backend/constants/roles.js
const ROLES = {
    VENDEDOR:   1,
    SUPERVISOR: 2,
    ADMIN:      3,
    BACK_OFFICE: 4,
};
```

| Rol | ID | Dashboard frontend |
|---|---|---|
| Vendedor | 1 | `/vendedor` |
| Supervisor | 2 | `/supervisor` |
| Admin | 3 | `/admin` |
| BackOffice | 4 | `/backoffice` |

---

## Config y variables de entorno

### Backend (`.env`)
```
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
EMAIL_USER=          # Gmail
EMAIL_PASS=          # App password Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
BASE_URL=https://360.cober.online
API_BASE_URL=https://360.cober.online/api
FRONTEND_URL=https://360.cober.online
```

### Frontend (`frontend/src/components/config.js`)
```js
export const API_URL = "https://360.cober.online/api";
export const LOCAL_API_URL = "http://localhost:4001";
export const WS_URL = "https://360.cober.online";
export const ENDPOINTS = {
    AUTH:           `${API_URL}/auth`,
    ADMIN:          `${API_URL}/admin`,
    PROSPECTOS:     `${API_URL}/prospectos`,
    TIPOS_AFILIACION: `${API_URL}/tipos_afiliacion`,
    LEAD:           `${API_URL}/lead`,
    PERFORMANCE:    `${LOCAL_API_URL}/performance`,
    BASE_URL:       WS_URL,
};
```

**Regla**: nunca hardcodear URLs. Siempre importar `API_URL` / `ENDPOINTS` desde `../../config` (o la ruta relativa correcta).

---

## Patrones de código

### Patrón de ruta (backend)
```js
// routes/dominio/featureRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/authMiddleware');
const roleMiddleware = require('../../middlewares/roleMiddleware');
const ROLES = require('../../constants/roles');
const controller = require('../../controllers/dominio/featureController');

// Pública
router.get('/public', controller.getPublic);

// Autenticada
router.get('/', authenticateToken, controller.getAll);

// Con rol específico
router.post('/', authenticateToken, roleMiddleware([ROLES.ADMIN]), controller.create);
router.put('/:id', authenticateToken, roleMiddleware([ROLES.ADMIN, ROLES.SUPERVISOR]), controller.update);

module.exports = router;
```

### Patrón de controlador (backend)
```js
// controllers/dominio/featureController.js
const Model = require('../../models/dominio/featureModel');

exports.getAll = async (req, res) => {
  try {
    const data = await Model.findAll(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('Error en getAll:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

exports.create = async (req, res) => {
  try {
    // Validar antes de escribir en DB
    const errores = validarDatos(req.body);
    if (errores.length > 0) {
      return res.status(400).json({ errores });
    }
    const id = await Model.create(req.body, req.user.id);
    res.status(201).json({ id, message: 'Creado correctamente' });
  } catch (err) {
    console.error('Error en create:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
```

### Patrón de modelo (backend)
```js
// models/dominio/featureModel.js
const db = require('../../config/db');
const validator = require('validator');

function validarDatos(data) {
  const errores = [];
  if (!data.nombre || data.nombre.length < 2) errores.push("Nombre inválido.");
  return errores;
}

const FeatureModel = {
  async findAll(userId) {
    const [rows] = await db.query(
      'SELECT * FROM tabla WHERE user_id = ? AND activo = 1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM tabla WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(data, userId) {
    const errores = validarDatos(data);
    if (errores.length) { const err = new Error("Validación"); err.errores = errores; throw err; }
    const [result] = await db.query(
      'INSERT INTO tabla (nombre, user_id, created_at) VALUES (?, ?, NOW())',
      [validator.escape(data.nombre), userId]
    );
    return result.insertId;
  },
};

module.exports = FeatureModel;
```

### Registrar ruta en `backend/server.js`
```js
const featureRoutes = require('./routes/dominio/featureRoutes');
app.use('/api/feature', featureRoutes);
```
> **Nota**: los webhooks se registran **antes** de los middlewares de seguridad globales.

---

### Patrón de componente feature (frontend)
```jsx
// components/features/dominio/MiComponente.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';   // ajustar ruta relativa
import Swal from 'sweetalert2';
import { Spinner } from 'react-bootstrap';

const MiComponente = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API_URL}/feature`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setData(res.data))
      .catch(() => Swal.fire('Error', 'No se pudo cargar', 'error'));
  }, []);

  const handleAction = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/feature`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Swal.fire('✅ Éxito', 'Operación completada', 'success');
    } catch (error) {
      const msg = error.response?.data?.message || 'Error inesperado';
      Swal.fire('Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return ( /* JSX */ );
};

export default MiComponente;
```

### Ruta protegida en `App.jsx`
```jsx
// Agregar dentro de <Routes> en frontend/src/App.jsx
import MiComponente from "./components/features/dominio/MiComponente";
import { AdminRoute } from './components/common/ProtectedRoute';

// Ruta protegida por rol:
<Route path="/admin/feature" element={
  <AdminRoute><MiComponente /></AdminRoute>
} />

// Ruta pública:
<Route path="/feature-publica" element={<MiComponente />} />
```

---

## Middlewares disponibles

| Middleware | Import | Uso |
|---|---|---|
| `authenticateToken` | `middlewares/authMiddleware` | Valida JWT, requiere `Authorization: Bearer <token>` |
| `roleMiddleware([ROLES.X])` | `middlewares/roleMiddleware` | Restringe a roles específicos (array de IDs numéricos) |
| `apiLimiter` | `middlewares/rateLimiters` | Rate limiting general |
| `failedAttemptLimiter` | `middlewares/rateLimiters` | Para endpoints de login |
| `sanitizeInputs` | `middlewares/validators` | Sanitiza inputs contra XSS |
| `preventSQLInjection` | `middlewares/validators` | Previene SQL injection básica |
| `duplicatePreventionMiddleware` | `middlewares/duplicatePreventionMiddleware` | Previene leads duplicados |
| `trackUserActivity` | `middlewares/activityTracker` | Registra actividad del usuario |

**Token en request**: `req.user` contiene los datos del JWT decodificado (`id`, `role`, etc.)

---

## Servicios disponibles en backend

| Servicio | Archivo | Qué hace |
|---|---|---|
| `emailService.js` | `services/` | Envío de emails con nodemailer (SMTP Gmail 587) |
| `whatsappService.js` | `services/` | Envío de mensajes WhatsApp vía Twilio |
| `googleSheetsService.js` | `services/` | R/W a Google Sheets general |
| `googleSheetsPolizasService.js` | `services/` | Sincronización de pólizas a Sheets |
| `googleDriveBackupService.js` | `services/` | Backup automático a Drive |
| `mercadoPagoService.js` | `services/` | Preferencias de pago MP |
| `notificationsService.js` | `services/` | Push notifications Firebase |
| `vaFirmaService.js` | `services/` | Firma electrónica de pólizas |
| `chatService.js` | `services/` | Lógica del chat interno |
| `ReasignacionService.js` | `services/` | Round-robin de asignación de leads |
| `RefritosVisibilityService.js` | `services/` | Visibilidad de refritos |
| `recaptchaService.js` | `services/` | Validación reCAPTCHA v2/v3 |
| `activeUsersWebSocket.js` | `services/` | Monitor de usuarios activos via Socket.io |

---

## Validación en modelos

Todos los modelos usan validación con `validator` antes de ejecutar queries:

```js
const validator = require('validator');

function validarDatos(data) {
  const errores = [];
  if (!data.nombre || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.nombre)) 
    errores.push("Nombre inválido.");
  if (data.correo && !validator.isEmail(data.correo)) 
    errores.push("Email inválido.");
  if (data.edad !== undefined && !validator.isInt(String(data.edad), { min: 0, max: 120 })) 
    errores.push("Edad debe ser entre 0 y 120.");
  return errores;
}
```

Si hay errores, se lanza `err.errores = errores` y el controlador devuelve `res.status(400).json({ errores })`.  
En el frontend se muestran con:
```jsx
const erroresList = errores.map(e => `<li>${e}</li>`).join('');
Swal.fire({ title: '❌ Error', html: `<ul>${erroresList}</ul>`, icon: 'warning' });
```

---

## Datos del dominio (negocio)

### Tipos de afiliación
```js
// ID numérico (guardado en DB)
{ id: 1, etiqueta: "Particular/autónomo",   requiere_sueldo: 0, requiere_categoria: 0 }
{ id: 2, etiqueta: "Con recibo de sueldo",  requiere_sueldo: 1, requiere_categoria: 0 }
{ id: 3, etiqueta: "Monotributista",        requiere_sueldo: 0, requiere_categoria: 1 }
```

### Categorías monotributo
`A, B, C, D, E, F, G, H, I, J, K, A exento, B exento`

### Vínculos familiares
`pareja/conyuge, hijo/a, familiar a cargo`

### Campos de prospecto
`nombre, apellido, edad, tipo_afiliacion_id, sueldo_bruto, categoria_monotributo, numero_contacto, correo, localidad, familiares[]`

### Normalización de teléfonos (Argentina)
Los números se normalizan a formato internacional `54XXXXXXXXXX` antes de enviar a WhatsApp (ver `normalizarNumeroWhatsApp` en `prospectoController.js`).

---

## Migraciones SQL

- Ubicación: `backend/migrations/`
- Naming: `YYYYMMDD_descripcion_accion.sql`
- Ejemplos reales:
  - `20260107_create_vafirma_envios_table.sql`
  - `20251113_add_origen_to_prospectos.sql`
  - `20251111_create_vendedor_round_robin_order.sql`
- Ejecutar: `mysql -u user -p cober360 < migrations/archivo.sql`
- Para migraciones programáticas: `.js` con `const db = require('../config/db')`

---

## Jobs (tareas programadas con node-cron)

| Job | Archivo | Frecuencia |
|---|---|---|
| Reasignación automática de leads | `ReasignacionAutomaticaJob.js` | Configurable |
| Backup a Google Drive | `googleDriveBackupJob.js` | Diario |
| Limpieza de seguridad (tokens expirados, etc.) | `securityTasks.js` | Periódico |
| Sincronizar estados de firma VaFirma | `sincronizarEstadosFirmaJob.js` | Periódico |

---

## Seguridad (OWASP)

El proyecto ya implementa:
- **Helmet** para headers HTTP seguros
- **Rate limiting** por IP y endpoint
- **Token blacklist** (logout invalida el token)
- **Validación** en modelos con `validator`
- **Sanitización** de inputs en middlewares
- **SQL parametrizado** siempre con `?` (nunca concatenar)
- **bcryptjs** para contraseñas
- **Detección de IPs sospechosas** (`advancedSecurity.js`)

Al agregar nueva funcionalidad: **nunca concatenar variables en queries SQL**, siempre usar `[value]` parametrizado.

---

## Procedimiento para nueva feature

### 1. Si requiere nueva tabla
```sql
-- migrations/YYYYMMDD_create_tabla_feature.sql
CREATE TABLE IF NOT EXISTS feature (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 2. Crear modelo
`backend/models/dominio/featureModel.js` — patrón con validaciones internas

### 3. Crear controlador
`backend/controllers/dominio/featureController.js` — try/catch + respuestas estandarizadas

### 4. Crear ruta
`backend/routes/dominio/featureRoutes.js` — con `authenticateToken` + `roleMiddleware` según corresponda

### 5. Registrar ruta en `server.js`
```js
app.use('/api/feature', require('./routes/dominio/featureRoutes'));
```

### 6. Crear componente React
`frontend/src/components/features/dominio/MiComponente.jsx`

### 7. Agregar ruta en `App.jsx`
Dentro de `<Routes>`, usando el `ProtectedRoute` correspondiente al rol

### 8. Agregar endpoint en `config.js` si es frecuente
```js
export const ENDPOINTS = {
  ...
  FEATURE: `${API_URL}/feature`,
};
```

---

## Convenciones del proyecto

1. **Nombres**: `camelCase` en JS/JSX, `snake_case` en SQL y nombres de columnas
2. **Errores backend**: `try/catch` + `console.error` + `res.status(500).json({ message: '...' })`
3. **Autenticación**: toda ruta privada usa `authenticateToken`; roles sensibles además `roleMiddleware([ROLES.X])`
4. **Alertas frontend**: SweetAlert2 (`Swal.fire`) para errores y confirmaciones
5. **Loading states**: siempre usar estado `loading` para prevenir doble submit
6. **Roles**: usar constantes de `constants/roles.js`, nunca números mágicos
7. **Subdirectorios por dominio**: `controllers/dominio/`, `routes/dominio/`, `models/dominio/`, `components/features/dominio/`
8. **Sin URLs hardcodeadas**: `API_URL` en frontend, `process.env` en backend
9. **Pool MySQL2**: `const [rows] = await db.query(sql, [params])` — siempre destructurar
10. **Exports de controladores**: `exports.nombreFuncion = async (req, res) => {}` (no clases)
11. **Modelos como objetos**: `const Model = { async findAll() {...} }; module.exports = Model;`
