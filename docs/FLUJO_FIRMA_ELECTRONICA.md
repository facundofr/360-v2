# 📋 Sistema de Firma Electrónica con VaFirma - Flujo Completo

## 📊 Estados del Sistema

### Estados de Firma (Backend - `polizas_vafirma_envios.estado_firma`)

| Estado | Descripción | UI |
|--------|-------------|-----|
| `null` | Póliza no enviada a firma | Muestra botón "Enviar a Firma" |
| `pending` | Enviada, esperando firma del prospecto | Badge amarillo "Pendiente de firma" |
| `signed` | Firmado exitosamente | Badge verde "Póliza firmada" + Botón descarga |
| `rejected` | Rechazado por el prospecto | Badge rojo "Firma rechazada" |
| `expired` | Plazo expirado | Badge gris "Firma expirada" |

---

## 🔄 Flujo Completo

### 1️⃣ **Envío de Póliza a Firma**

**Acción del usuario:** Click en "Enviar a Firma"

**Frontend:**
```javascript
// hooks/useEnviarPolizaFirma.js
const { enviarAFirma, loading, error } = useEnviarPolizaFirma();

await enviarAFirma(poliza, emailConfirmado, telefonoConfirmado);
```

**Backend:**
```javascript
// POST /api/vafirma/enviar-poliza
// controllers/vafirmaController.js -> enviarPolizaFirma()

1. Convertir póliza a PDF base64
2. Solicitar firma a VaFirma (vaFirmaService.solicitarFirma)
3. Recibir docUUID de VaFirma
4. Guardar registro en polizas_vafirma_envios:
   - poliza_id
   - doc_uuid
   - estado_firma = 'pending'
   - email_firmante
   - telefono_firmante
```

**Base de Datos:**
```sql
INSERT INTO polizas_vafirma_envios 
(poliza_id, doc_uuid, estado_firma, email_firmante, telefono_firmante)
VALUES (123, 'abc-uuid-123', 'pending', 'juan@email.com', '+5491112345678');
```

**Resultado:**
- ✅ El prospecto recibe email con link para firmar
- ✅ El prospecto recibe mensaje WhatsApp (si se configuró)
- ✅ Se requiere validación facial (biométrica)

---

### 2️⃣ **Consulta de Estado**

**Frontend:**
```javascript
// hooks/useEstadoFirmaPoliza.js
const { 
  estadoFirma, 
  consultarEstado, 
  estaFirmada, 
  estaPendiente 
} = useEstadoFirmaPoliza(polizaId);

// Consulta inicial
useEffect(() => {
  consultarEstado();
}, []);

// Polling cada 30 segundos (opcional)
useEffect(() => {
  const interval = setInterval(consultarEstado, 30000);
  return () => clearInterval(interval);
}, []);
```

**Backend:**
```javascript
// GET /api/vafirma/estado/:polizaId
// controllers/vafirmaController.js -> consultarEstadoFirma()

1. Buscar doc_uuid en polizas_vafirma_envios
2. Consultar estado en VaFirma (vaFirmaService.consultarEstado)
3. Retornar estado combinado (local + VaFirma)
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "polizaId": 123,
    "docUUID": "abc-uuid-123",
    "estadoLocal": "pending",
    "estadoVaFirma": { /* datos de VaFirma */ },
    "emailFirmante": "juan@email.com"
  }
}
```

---

### 3️⃣ **Actualización de Estado (Webhook)**

**VaFirma → Backend:**
```javascript
// POST /api/vafirma/webhook
// controllers/vafirmaController.js -> webhookVaFirma()

{
  "docUUID": "abc-uuid-123",
  "status": "signed",
  "signed_at": "2026-01-09T15:30:00Z"
}
```

**Backend:**
```sql
UPDATE polizas_vafirma_envios
SET estado_firma = 'signed', 
    firmado_en = NOW(),
    actualizado_en = NOW()
WHERE doc_uuid = 'abc-uuid-123';
```

**Estados VaFirma → Estados Locales:**
| VaFirma | Local | Descripción |
|---------|-------|-------------|
| `signed` | `signed` | Firmado exitosamente |
| `rejected` | `rejected` | Rechazado |
| `expired` | `expired` | Expirado |
| `pending` | `pending` | Pendiente |

---

### 4️⃣ **Descarga de Póliza Firmada**

**Acción del usuario:** Click en "Descargar firmada"

**Condición:** Solo disponible si `estado_firma = 'signed'`

**Frontend:**
```javascript
// components/buttons/BotonDescargarPolizaFirmada.jsx
const descargarPolizaFirmada = async () => {
  const response = await fetch(`/api/vafirma/descargar-firmada/${polizaId}`);
  const resultado = await response.json();
  
  // Convertir base64 a Blob y descargar
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadFile(blob, `Poliza_${polizaId}_Firmada.pdf`);
};
```

**Backend:**
```javascript
// GET /api/vafirma/descargar-firmada/:polizaId
// controllers/vafirmaController.js -> descargarPolizaFirmada()

1. Verificar que estado_firma = 'signed'
2. Descargar PDF de VaFirma (vaFirmaService.descargarDocumento)
3. Retornar PDF en base64
```

**Resultado:**
- ✅ Descarga archivo `Poliza_123_Firmada.pdf`
- ✅ El PDF incluye la firma electrónica del prospecto
- ✅ El PDF incluye evidencia biométrica (validación facial)

---

## 🎨 Impacto en la UI

### Componentes Afectados

#### 1. **BotonEnviarFirma**
```jsx
<BotonEnviarFirma 
  poliza={poliza}
  onExito={(resultado) => {
    console.log('Enviado:', resultado.docUUID);
    actualizarLista(); // Refrescar lista de pólizas
  }}
/>
```

**Comportamiento:**
- ❌ **No enviada:** Muestra botón azul "Enviar a Firma"
- ✅ **Enviada:** Oculta el botón, muestra badge de estado
- ✅ **Firmada:** Muestra badge verde + botón "Descargar firmada"

#### 2. **BadgeEstadoFirma**
```jsx
<BadgeEstadoFirma estado={estadoFirma?.estadoLocal} />
```

**Variantes visuales:**
- 🟡 `pending` → Badge amarillo con reloj
- 🟢 `signed` → Badge verde con check
- 🔴 `rejected` → Badge rojo con X
- ⚫ `expired` → Badge gris con triángulo

#### 3. **Cards de Pólizas (Vendedor/Supervisor/BackOffice)**

**Antes:**
```jsx
<Card>
  <Card.Body>
    <h5>Póliza #123</h5>
    <BotonEnviarFirma poliza={poliza} />
  </Card.Body>
</Card>
```

**Después:**
```jsx
<Card>
  <Card.Body>
    <h5>Póliza #123</h5>
    
    {/* El componente maneja automáticamente el estado */}
    <BotonEnviarFirma poliza={poliza} />
    
    {/* Esto muestra:
        - Botón "Enviar a Firma" si no está enviada
        - Badge "Pendiente" si está en pending
        - Badge "Firmada" + Botón descarga si está signed
    */}
  </Card.Body>
</Card>
```

---

## 🔧 Cambios en Backend

### Tabla Nueva: `polizas_vafirma_envios`

```sql
CREATE TABLE IF NOT EXISTS polizas_vafirma_envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  poliza_id INT NOT NULL UNIQUE,           -- ID de la póliza
  doc_uuid VARCHAR(255) NOT NULL UNIQUE,   -- UUID de VaFirma
  estado_firma VARCHAR(50) DEFAULT 'pending',
  email_firmante VARCHAR(255) NOT NULL,
  telefono_firmante VARCHAR(50),
  requiere_biometria TINYINT(1) DEFAULT 1,
  tipo_firma VARCHAR(50) DEFAULT 'Simple',
  enviado_en TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  firmado_en TIMESTAMP NULL,
  usuario_id INT,
  intentos INT DEFAULT 1,
  notas TEXT,
  
  INDEX idx_poliza_id (poliza_id),
  INDEX idx_doc_uuid (doc_uuid),
  INDEX idx_estado_firma (estado_firma),
  
  FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE
);
```

### Endpoints Nuevos

```javascript
// Enviar a firma (ya existía)
POST /api/vafirma/enviar-poliza
Body: { polizaId, pdfBase64, signerEmail, signerName, ... }
Response: { success, data: { docUUID, linkFirma } }

// ✅ NUEVO: Consultar estado
GET /api/vafirma/estado/:polizaId
Response: { success, data: { estadoLocal, estadoVaFirma, docUUID } }

// ✅ NUEVO: Descargar firmada
GET /api/vafirma/descargar-firmada/:polizaId
Response: { success, data: base64PDF }

// Webhook (ya existía)
POST /api/vafirma/webhook
Body: { docUUID, status, signed_at }
```

---

## 🔄 Cambios en Frontend

### Hooks Nuevos

#### `useEstadoFirmaPoliza(polizaId)`
```javascript
import useEstadoFirmaPoliza from '@/hooks/useEstadoFirmaPoliza';

const { 
  estadoFirma,       // Objeto con estadoLocal, docUUID, etc.
  consultarEstado,   // Función para consultar
  loading,           // Estado de carga
  error,             // Errores
  estaFirmada,       // () => boolean
  estaPendiente,     // () => boolean
  fueEnviada         // () => boolean
} = useEstadoFirmaPoliza(123);
```

### Componentes Nuevos

#### `BadgeEstadoFirma`
```javascript
import BadgeEstadoFirma from '@/components/badges/BadgeEstadoFirma';

<BadgeEstadoFirma estado="pending" />  // Badge amarillo
<BadgeEstadoFirma estado="signed" />   // Badge verde
<BadgeEstadoFirma estado="rejected" /> // Badge rojo
```

#### `BotonDescargarPolizaFirmada`
```javascript
import BotonDescargarPolizaFirmada from '@/components/buttons/BotonDescargarPolizaFirmada';

<BotonDescargarPolizaFirmada 
  polizaId={123}
  size="sm"
  showLabel={true}
/>
```

---

## 📱 Experiencia del Usuario (Prospecto)

### Flujo desde el lado del prospecto:

1. **Recibe Email de VaFirma:**
   - Asunto: "Póliza #POL-123 para firmar"
   - Mensaje: "Por favor, firma tu póliza POL-123. Se requiere validación de tu rostro."
   - Link para firmar

2. **Recibe WhatsApp (opcional):**
   - Mensaje con link directo

3. **Accede al link:**
   - Ve la póliza en PDF
   - Botón "Firmar"

4. **Proceso de firma:**
   - ✅ **Validación biométrica:** Toma foto de su rostro
   - ✅ **Liveness detection:** Verifica que es una persona real
   - ✅ **Firma electrónica:** Aplica firma al documento

5. **Confirmación:**
   - Ve mensaje de éxito
   - Recibe email con copia firmada

---

## 🚀 Mejoras Futuras

### Polling Inteligente
```javascript
// Consultar estado solo si está en 'pending'
useEffect(() => {
  if (estaPendiente()) {
    const interval = setInterval(consultarEstado, 30000);
    return () => clearInterval(interval);
  }
}, [estadoFirma]);
```

### Notificaciones en Tiempo Real
```javascript
// WebSocket para recibir actualizaciones instantáneas
useEffect(() => {
  const socket = io();
  socket.on('poliza-firmada', (data) => {
    if (data.polizaId === poliza.id) {
      consultarEstado();
      mostrarNotificacion('¡Póliza firmada!');
    }
  });
}, []);
```

### Historial de Firmas
```javascript
// Ver historial completo de intentos de firma
GET /api/vafirma/historial/:polizaId
Response: [{
  fecha: '2026-01-09T10:00:00Z',
  accion: 'enviado',
  usuario: 'vendedor@cober.com'
}, {
  fecha: '2026-01-09T15:30:00Z',
  accion: 'firmado',
  usuario: 'juan@cliente.com'
}]
```

---

## 📌 Resumen Ejecutivo

### ✅ Lo que se implementó:

1. **Backend:**
   - ✅ Tabla `polizas_vafirma_envios`
   - ✅ Endpoint para consultar estado
   - ✅ Endpoint para descargar firmada
   - ✅ Webhook para actualizar estado

2. **Frontend:**
   - ✅ Hook `useEstadoFirmaPoliza`
   - ✅ Componente `BadgeEstadoFirma`
   - ✅ Componente `BotonDescargarPolizaFirmada`
   - ✅ Actualización de `BotonEnviarFirma`

3. **Flujo completo:**
   - ✅ Envío de póliza con validación biométrica
   - ✅ Consulta automática de estado
   - ✅ Actualización por webhook
   - ✅ Descarga de póliza firmada
   - ✅ UI reactiva según el estado

### 🎯 Estados manejados:

- ❌ **No enviada:** Botón visible
- 🟡 **Pending:** Badge amarillo
- 🟢 **Signed:** Badge verde + botón descarga
- 🔴 **Rejected:** Badge rojo
- ⚫ **Expired:** Badge gris

### 🔗 Integración con VaFirma:

- ✅ API v1.5.0
- ✅ Validación biométrica (facial)
- ✅ Firma electrónica simple
- ✅ WhatsApp y Email
- ✅ Webhooks para actualizaciones

---

## 📞 Soporte

**Documentación VaFirma:**
- `/documentacionApi.md`

**Archivos clave:**
- Backend: `/backend/controllers/vafirmaController.js`
- Servicio: `/backend/services/vaFirmaService.js`
- Frontend: `/frontend/src/hooks/useEstadoFirmaPoliza.js`
- Componentes: `/frontend/src/components/buttons/BotonEnviarFirma.jsx`

**Rutas API:**
- `POST /api/vafirma/enviar-poliza`
- `GET /api/vafirma/estado/:polizaId`
- `GET /api/vafirma/descargar-firmada/:polizaId`
- `POST /api/vafirma/webhook`

---

✨ **Sistema completo de firma electrónica integrado con VaFirma**
