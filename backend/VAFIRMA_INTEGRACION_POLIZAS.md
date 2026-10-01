# Integración de Envío de Pólizas a Firma - VaFirma

## Resumen
Sistema centralizado para enviar pólizas a firma electrónica con validación biométrica (foto del rostro). Reutilizable en vendedor, supervisor y backoffice.

## Flujo de Uso

1. **Usuario hace click en "Enviar a Firma"**
   - Abre modal con campos de email y teléfono del prospecto
   - Pre-llena con datos de la póliza

2. **Modal de Confirmación**
   - Valida email (formato correcto)
   - Valida teléfono (mínimo 10 dígitos)
   - Permite editar si es necesario

3. **Envío a Firma**
   - Convierte póliza a PDF en base64
   - Enía a backend para registrar
   - Backend llama a VaFirma
   - Registra en BD

4. **Notificación al Prospecto**
   - Recibe email con enlace de firma
   - Pide validación facial (foto)
   - Luego pide firma

## Componentes Creados

### Frontend

#### 1. Hook: `useEnviarPolizaFirma.js`
```javascript
import { useEnviarPolizaFirma } from '../../hooks/useEnviarPolizaFirma';

const { enviarAFirma, loading, error } = useEnviarPolizaFirma();

// Usar:
const resultado = await enviarAFirma(poliza, email, telefono);
if (resultado.success) {
  // Éxito - mostrar notificación
}
```

#### 2. Modal: `ConfirmarDatosProspectoModal.jsx`
```javascript
import ConfirmarDatosProspectoModal from '../../components/modals/ConfirmarDatosProspectoModal';

<ConfirmarDatosProspectoModal
  show={showModal}
  poliza={poliza}
  loading={loading}
  onConfirmar={(email, telefono) => handleEnvio(email, telefono)}
  onCancelar={() => setShowModal(false)}
/>
```

#### 3. Botón Reutilizable: `BotonEnviarFirma.jsx`
```javascript
import BotonEnviarFirma from '../../components/buttons/BotonEnviarFirma';

<BotonEnviarFirma 
  poliza={poliza}
  onExito={(resultado) => {
    showToast('Póliza enviada a firma');
  }}
  onError={(error) => {
    showToast(error, 'danger');
  }}
  size="sm"
  variant="info"
/>
```

### Backend

#### 1. Controller: `vafirmaController.js`
- `enviarPolizaFirma()` - Envía póliza a VaFirma
- `consultarEstadoFirma()` - Consulta estado de firma
- `descargarPolizaFirmada()` - Descarga PDF firmado
- `webhookVaFirma()` - Recibe notificaciones de VaFirma

#### 2. Rutas: `vafirmaRoutes.js`
- `POST /api/vafirma/enviar-poliza` - Enviar
- `GET /api/vafirma/estado/:polizaId` - Consultar estado
- `GET /api/vafirma/descargar-firmada/:polizaId` - Descargar
- `POST /api/vafirma/webhook` - Webhook (sin auth)

#### 3. Tabla BD: `polizas_vafirma_envios`
Registra todos los envíos a firma:
- `poliza_id` - ID de póliza
- `doc_uuid` - UUID de VaFirma
- `estado_firma` - pending, signed, rejected, expired
- `email_firmante` - Email del prospecto
- `telefono_firmante` - Teléfono confirmado
- `requiere_biometria` - Siempre 1 (verdadero)
- `tipo_firma` - Simple (siempre)

## Instalación

### 1. Crear tabla en BD
```bash
cd /var/www/cober360/backend
node -e "
const { createTableVaFirmaEnvios } = require('./migrations/20260107_create_vafirma_envios_table');
createTableVaFirmaEnvios().then(() => process.exit(0));
"
```

### 2. Archivos ya creados
- ✅ Backend: `/backend/controllers/vafirmaController.js`
- ✅ Backend: `/backend/routes/vafirmaRoutes.js`
- ✅ Backend: `/backend/migrations/20260107_create_vafirma_envios_table.js`
- ✅ Backend: `server.js` - Rutas integradas
- ✅ Frontend: `/frontend/src/hooks/useEnviarPolizaFirma.js`
- ✅ Frontend: `/frontend/src/components/modals/ConfirmarDatosProspectoModal.jsx`
- ✅ Frontend: `/frontend/src/components/buttons/BotonEnviarFirma.jsx`

## Integración en Vistas

### En Vendedor (PolizasDashboard.jsx)

```javascript
import BotonEnviarFirma from '../../components/buttons/BotonEnviarFirma';

// En las acciones de la tarjeta de póliza:
<BotonEnviarFirma 
  poliza={poliza}
  onExito={() => {
    showToastMessage('Póliza enviada a firma exitosamente');
    // Opcional: recargar lista
  }}
  onError={(error) => {
    showToastMessage(error, 'danger');
  }}
  size="sm"
  variant="info"
/>
```

### En Supervisor (PolizasSupervisor.jsx)

```javascript
import BotonEnviarFirma from '../../../components/buttons/BotonEnviarFirma';

// En acciones de póliza:
<BotonEnviarFirma 
  poliza={poliza}
  onExito={() => {
    showToastMessage('Póliza enviada a firma');
  }}
  onError={(error) => {
    showToastMessage(error, 'danger');
  }}
/>
```

### En Back Office (PolizasBackOffice.jsx)

```javascript
import BotonEnviarFirma from '../../../components/buttons/BotonEnviarFirma';

// En acciones de póliza:
<BotonEnviarFirma 
  poliza={poliza}
  onExito={() => {
    showToastMessage('Póliza enviada a firma');
  }}
  onError={(error) => {
    showToastMessage(error, 'danger');
  }}
/>
```

## Características

✅ **Validación centralizada**
- Valida email del prospecto
- Valida teléfono (mínimo 10 dígitos)
- Permite editar antes de enviar

✅ **Envío a VaFirma**
- Firma Simple
- Requiere validación biométrica (FACE)
- Foto del rostro obligatoria
- Documento de identidad requerido

✅ **Registro en BD**
- Guarda UUID de VaFirma
- Registra estado de firma
- Webhook para actualizar estado

✅ **Reutilizable**
- Mismo código en 3 módulos
- Sin duplicación
- Fácil mantener y actualizar

✅ **UX Clara**
- Modal de confirmación
- Mensajes de error informativos
- Loading states
- Toast notifications

## Estados de Firma

| Estado | Significado |
|--------|------------|
| `pending` | Pendiente de firma |
| `signed` | Póliza firmada ✅ |
| `rejected` | Prospecto rechazó ❌ |
| `expired` | Link expiró ⏰ |

## Consultar Estado

```javascript
// Desde frontend
const response = await fetch(`/api/vafirma/estado/${polizaId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();
console.log(data.estadoVaFirma); // Estado actual
```

## Descargar Póliza Firmada

```javascript
// Solo si estado === 'signed'
const response = await fetch(`/api/vafirma/descargar-firmada/${polizaId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();
// data.document contiene PDF base64
```

## Webhook de VaFirma

Configurar en VaFirma para que notifique a:
```
https://tudominio.com/api/vafirma/webhook
```

Recibirá:
```json
{
  "docUUID": "xxx-xxx-xxx",
  "status": "signed",
  "signed_at": "2026-01-07T10:30:00Z"
}
```

## Troubleshooting

### PDF no se convierte
- Verificar que `poliza.pdf_hash` existe
- Si no existe, usar `window.open` para descargar primero

### Email no llega
- Verificar configuración de email en VaFirma
- Revisar spam/promotions
- Usar `emailMessage` más descriptivo

### Teléfono rechazado
- Debe tener al menos 10 dígitos
- Se valida automáticamente en modal

### Validación facial falla
- Verificar que dispositivo tenga cámara
- Revisar permisos de cámara en navegador
- Probar en HTTPS (VaFirma puede requerirlo)

## Variables de Entorno

Backend `.env`:
```env
VAFIRMA_API_URL=https://api.vafirma.com/api
VAFIRMA_AUTH_MODE=basic
VAFIRMA_USERNAME=tu_usuario
VAFIRMA_PASSWORD=tu_contraseña
API_URL=https://tudominio.com
```

Frontend `.env`:
```env
VITE_API_URL=https://tudominio.com
```

## Testing

```bash
# Ejecutar en backend
cd /var/www/cober360/backend
node test_vafirma_simple_plus_face.js

# Para prueba interactiva
node backend/test_vafirma_prueba.js
```

## Cambios Realizados

### Backend
- ✅ Creado controller `vafirmaController.js`
- ✅ Creado rutas `vafirmaRoutes.js`
- ✅ Integrado en `server.js`
- ✅ Migration para tabla BD

### Frontend
- ✅ Hook `useEnviarPolizaFirma.js`
- ✅ Modal `ConfirmarDatosProspectoModal.jsx`
- ✅ Botón `BotonEnviarFirma.jsx`

### Servicios
- ✅ `vaFirmaSerice.js` - Ya existente y estandarizado
- ✅ Soporte para `requireBiometric: true`

## Próximos Pasos

1. **Integrar en 3 vistas**
   - Agregar `BotonEnviarFirma` en vendedor
   - Agregar `BotonEnviarFirma` en supervisor
   - Agregar `BotonEnviarFirma` en backoffice

2. **Crear modal para ver estado**
   - Mostrar estado en tiempo real
   - Opción de descargar si está firmado
   - Reintent si expiró

3. **Crear reportes**
   - Pólizas enviadas a firma
   - Pólizas por firmar
   - Pólizas ya firmadas
   - Estadísticas de VaFirma

## Versión
v1.0 - Centralizado y listo para integración

## Fecha
7 de enero de 2026
