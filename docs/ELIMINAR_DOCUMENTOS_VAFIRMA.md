# Eliminación de Documentos Firmados en VAFirma - Implementación Completa

## 📋 Descripción

Sistema para eliminar solicitudes de firma y documentos firmados de VAFirma cuando:
- Una póliza está **pendiente de firmar** → Eliminar solicitud y reenviar
- Una póliza está **ya firmada pero mal** → Eliminar documento de VAFirma y generar nueva versión

---

## 🎯 Funcionalidades Implementadas

### Backend

#### 1. **Servicio VAFirma** (`backend/services/vaFirmaService.js`)
```javascript
eliminarDocumento(docUUID, docOriginId)
```
- Llama a `DELETE /v1/ext/signatures/me/` con parámetros query
- Soporta `docUUID` o `docOriginId`
- Retorna `{success, data, status}`

#### 2. **Controlador** (`backend/controllers/vafirmaController.js`)

**a) Eliminar Solicitud de Firma:**
```javascript
eliminarSolicitudFirma(polizaId)
```
- Elimina registro en tabla `polizas_vafirma_envios`
- Permite reenviar la póliza a firmar nuevamente
- Sin contactar a VAFirma

**b) Eliminar Documento Firmado:**
```javascript
eliminarDocumentoFirmado(polizaId, docUUID, docOriginId)
```
- Llama a VAFirma DELETE para eliminar el documento
- Limpia registro en BD
- Permite generar y enviar nueva versión

#### 3. **Rutas** (`backend/routes/vafirmaRoutes.js`)

```javascript
DELETE /api/vafirma/solicitud/:polizaId
- Elimina solicitud de firma
- Requiere autenticación
- Permite reenviar a firmar

DELETE /api/vafirma/documento-firmado/:polizaId?docUUID=xxx
- Elimina documento de VAFirma + BD
- Parámetro query: docUUID o docOriginId
- Requiere autenticación
```

---

### Frontend

#### 1. **Hook** (`frontend/src/hooks/useEliminarDocumentoFirma.js`)

```javascript
const { 
  eliminarSolicitud,      // Para pólizas pendientes
  eliminarDocumentoFirmado, // Para pólizas ya firmadas
  loading, 
  error 
} = useEliminarDocumentoFirma();
```

**Métodos:**
- `eliminarSolicitud(polizaId)` → Reenviar a firmar
- `eliminarDocumentoFirmado(polizaId, docUUID)` → Nueva versión

#### 2. **Componente Botones** (`frontend/src/components/buttons/BotonesEliminarFirma.jsx`)

```jsx
<BotonesEliminarFirma 
  poliza={poliza}
  onActualizar={fetchPolizas}
  size="sm"
  variant="outline"
/>
```

**Características:**
- Muestra botón **"Reenviar"** si estado es `pending`
- Muestra botón **"Eliminar Doc"** si estado es `signed`
- Confirmación con SweetAlert2
- Loading states
- Tooltip informativo

---

## 🔄 Flujo de Uso

### Caso 1: Reenviar Solicitud Pendiente

1. Usuario hizo click en "Reenviar"
2. Sistema pregunta confirmación
3. Elimina registro en `polizas_vafirma_envios`
4. Póliza vuelve a estado "sin enviar"
5. Usuario puede enviar nuevamente a firmar

### Caso 2: Eliminar Documento Firmado Mal

1. Usuario hizo click en "Eliminar Doc"
2. Sistema pregunta confirmación
3. Llama `DELETE /v1/ext/signatures/me/?docUUID=xxx`
4. VAFirma elimina el documento
5. Sistema elimina registro en BD
6. Usuario puede generar nueva versión y reenviar

---

## 🗄️ Base de Datos

**Tabla:** `polizas_vafirma_envios`

```sql
- id (PK)
- poliza_id (FK)
- doc_uuid (UNIQUE) ← Se usa para eliminar de VAFirma
- estado_firma (pending, signed, rejected, expired)
- email_firmante
- telefono_firmante
- requiere_biometria
- tipo_firma
- enviado_en
- firmado_en
- usuario_id
```

**Operación:** `DELETE FROM polizas_vafirma_envios WHERE poliza_id = ?`

---

## 🛠️ Integración en PolizasBackOffice

Para agregar los botones en la tabla/tarjetas de pólizas:

```jsx
import BotonesEliminarFirma from '../../buttons/BotonesEliminarFirma';

// En la columna de acciones:
<BotonesEliminarFirma 
  poliza={poliza}
  onActualizar={() => fetchPolizas()}
  size="sm"
/>
```

---

## 📊 Estados de Póliza y Acciones Disponibles

| Estado Firma | Botón Visible | Acción | Resultado |
|--------------|--------------|--------|-----------|
| `null` | ❌ No | - | - |
| `pending` | ✅ "Reenviar" | Elimina BD | Reenviar a firmar |
| `signed` | ✅ "Eliminar Doc" | DELETE VAFirma + BD | Nueva versión |
| `rejected` | ❌ No | - | - |
| `expired` | ❌ No | - | - |

---

## ⚠️ Notas Importantes

1. **docUUID** se guarda en `polizas_vafirma_envios.doc_uuid`
2. El campo `referencia_vafirma` puede usarse para identificar en UI
3. Si VAFirma falla (timeout, error), se limpia BD igual
4. No hay recuperación si falla a mitad - transacciones recomendadas
5. Audit log recomendado para registrar eliminaciones

---

## ✅ Testing

```bash
# Probar eliminación de solicitud
curl -X DELETE http://localhost:3001/api/vafirma/solicitud/123 \
  -H "Authorization: Bearer TOKEN"

# Probar eliminación de documento
curl -X DELETE "http://localhost:3001/api/vafirma/documento-firmado/123?docUUID=abc-123" \
  -H "Authorization: Bearer TOKEN"
```

---

## 🎨 UI/UX Mejoras

- ✅ Tooltips informativos
- ✅ Confirmación con SweetAlert2
- ✅ Loading spinner
- ✅ Alertas de éxito/error
- ✅ Responsivo (oculta texto en mobile)
- ✅ Iconos claros (Redo para reenviar, Trash para eliminar)

---
