# Replicación de Funcionalidades VaFirma en Módulo Supervisor

## Estado Actual: ✅ COMPLETADO

Las funcionalidades de firma electrónica (VaFirma) han sido replicadas completamente en el módulo de Supervisor. Supervisor ahora tiene las mismas capacidades que BackOffice para gestionar firmas electrónicas.

---

## Funcionalidades Implementadas

### 1. ✅ Envío de Pólizas a Firma (BotonEnviarFirma)

**Ubicaciones:**
- **Tabla de pólizas:** Primera columna de acciones
- **Vista tarjetas:** Footer de cada tarjeta
- **Modal de edición:** Tab "Firma Electrónica"

**Características:**
- Modal de confirmación de datos del prospecto (email y teléfono)
- Validación de datos mínimos antes de enviar
- Polling automático cada 10 segundos por 5 minutos
- Auto-actualización cuando la póliza es firmada
- Callbacks de éxito y error
- Estados visuales: Enviando, Pendiente, Firmada
- Restricción de rol: Solo Supervisor y BackOffice pueden enviar

**Código:**
```jsx
<BotonEnviarFirma 
  poliza={poliza}
  size="sm"
  showLabel={false}
  userRole="supervisor"
  onExito={() => {
    fetchPolizas();
  }}
  onError={(error) => {
    console.error('Error al enviar a firma:', error);
  }}
/>
```

**Archivo:**
[PolizasSupervisor.jsx](../frontend/src/components/features/supervisor/PolizasSupervisor.jsx#L1114) - Líneas 1114-1125 (tabla) y 1218-1229 (tarjetas)

---

### 2. ✅ Visualización de Estado de Firma (BadgeEstadoFirma)

**Ubicaciones:**
- **Tab Firma Electrónica:** Información del estado
- **Modal de edición:** Header del tab

**Estados mostrados:**
- `pending` - Pendiente de firma ⏳
- `signed` - Póliza firmada ✅
- `rejected` - Rechazo de firma ❌
- `expired` - Expirada ⏱️

**Código:**
```jsx
{polizaEdicion?.estado_firma && (
  <BadgeEstadoFirma estado={polizaEdicion.estado_firma} />
)}
```

**Archivo:**
[PolizasSupervisor.jsx](../frontend/src/components/features/supervisor/PolizasSupervisor.jsx#L3232) - Líneas 3232, 3265

---

### 3. ✅ Carga de Póliza Firmada (CargarPolizaFirmadaModal)

**Ubicaciones:**
- **Tab Firma Electrónica:** Botón "📄 Cargar Póliza Firmada" (visible cuando `estado_firma === 'signed'`)

**Características:**
- Upload de PDF firmado
- Auto-actualización de Google Sheets con enlace de descarga
- Cambio automático de estado a `venta_cerrada` cuando se carga
- Validación de formato PDF
- Feedback visual con spinner y mensajes de éxito/error

**Código:**
```jsx
<CargarPolizaFirmadaModal 
  show={modalCargarPolizaFirmada}
  onHide={() => setModalCargarPolizaFirmada(false)}
  polizaId={polizaParaCargar?.id}
  numeroPoliza={polizaParaCargar?.numero_poliza}
  onSuccess={handlePolizaFirmadaCargada}
/>
```

**Archivo:**
[PolizasSupervisor.jsx](../frontend/src/components/features/supervisor/PolizasSupervisor.jsx#L3248) - Línea 3248

---

### 4. ✅ Información Detallada de Firma

**Ubicaciones:**
- **Tab Firma Electrónica:** Card "Estado de la Firma"

**Datos mostrados:**
- Estado de firma actual (badge visual)
- Referencia VaFirma (UUID del documento)
- Fecha de envío a firma
- Fecha de firma completada
- Link de descarga si está firmada

**Código:**
```jsx
{polizaEdicion?.estado_firma && (
  <Card className="bg-light">
    <Card.Body>
      <h6 className="mb-3">Estado de la Firma</h6>
      <Row>
        <Col md={6} className="mb-3">
          <strong>Estado:</strong>
          <div className="mt-2">
            <BadgeEstadoFirma estado={polizaEdicion.estado_firma} />
          </div>
        </Col>
        <Col md={6} className="mb-3">
          <strong>Referencia VaFirma:</strong>
          <div className="mt-2">
            {polizaEdicion.referencia_vafirma ? (
              <code className="text-break">{polizaEdicion.referencia_vafirma}</code>
            ) : (
              <span className="text-muted">-</span>
            )}
          </div>
        </Col>
        {/* ... más campos */}
      </Row>
    </Card.Body>
  </Card>
)}
```

**Archivo:**
[PolizasSupervisor.jsx](../frontend/src/components/features/supervisor/PolizasSupervisor.jsx#L3257) - Líneas 3257-3285

---

## Comparativa: BackOffice vs Supervisor

| Funcionalidad | BackOffice | Supervisor |
|---|---|---|
| Enviar a firma | ✅ | ✅ |
| Ver estado de firma | ✅ | ✅ |
| Badge estado | ✅ | ✅ |
| Cargar póliza firmada | ✅ | ✅ |
| Info detallada | ✅ | ✅ |
| Editar póliza | ✅ | ✅ |
| Cambiar estado | ✅ | ✅ |
| Ver documentos | ✅ | ✅ |
| Ver historial | ✅ | ✅ |

---

## Cambios Realizados

### Frontend

**Archivo:** [PolizasSupervisor.jsx](../frontend/src/components/features/supervisor/PolizasSupervisor.jsx)

#### 1. Imports (Línea 10-12)
```jsx
import CargarPolizaFirmadaModal from '../../modals/CargarPolizaFirmadaModal';
import BotonEnviarFirma from '../../buttons/BotonEnviarFirma';
import BadgeEstadoFirma from '../../badges/BadgeEstadoFirma';
```

#### 2. Tabla de pólizas - Botón VaFirma (Línea 1114)
Agregado BotonEnviarFirma al inicio de la lista de acciones con `userRole="supervisor"`

#### 3. Vista tarjetas - Botón VaFirma (Línea 1218)
Agregado BotonEnviarFirma en el Card.Footer con `userRole="supervisor"`

#### 4. Modal de edición - Tab Firma Electrónica (Línea 3201+)
- Tab title con badge de estado
- Alert informativo
- Botón de envío a firma
- Card con información detallada del estado

---

## Flujo de Trabajo: Supervisor

### Envío a Firma
```
1. Supervisor ve la tabla de pólizas
2. Haz clic en el botón de "paper plane" (enviar a firma)
3. Modal solicita confirmación de email y teléfono
4. Sistema envía a VaFirma y comienza polling automático
5. Mientras se firme, los datos se actualizan cada 10s
6. Cuando está firmada, se muestra badge "✅ Firmada"
```

### Carga de Póliza Firmada
```
1. Una vez que VaFirma reporta "signed", aparece botón "📄 Cargar Póliza Firmada"
2. Supervisor hace clic y abre modal de carga
3. Selecciona el PDF firmado y lo carga
4. Sistema:
   - Guarda el documento
   - Actualiza estado a "venta_cerrada"
   - Actualiza Google Sheets con enlace
   - Muestra confirmación
```

---

## Técnicas Utilizadas

### React Hooks
- `useState()` - Gestión de estados modales
- `useEffect()` - Efectos secundarios
- Custom hooks: `useEnviarPolizaFirma()`, `useEstadoFirmaPoliza()`

### Bootstrap Components
- Modal - Confirmación de datos
- Tab - Secciones dentro del modal de edición
- Badge - Estados visuales
- Button - Acciones

### Icons
- FaPaperPlane - Enviar a firma
- FaFileUpload - Cargar póliza

### API Integration
- POST `/vafirma/enviar-poliza` - Solicitar firma
- GET `/vafirma/estado/:polizaId` - Consultar estado
- POST `/polizas/documentos/firmada/cargar` - Cargar PDF firmado

---

## Configuración Backend

No se requieren cambios en backend para Supervisor. Los endpoints existentes ya soportan:
- Acceso basado en rol (supervisor)
- Envío a VaFirma con datos biométricos opcionales
- Polling automático
- Carga de documentos firmados

---

## Testing

Para verificar que las funcionalidades funcionen correctamente:

### 1. Enviar a Firma
```bash
1. Ir a Supervisor > Pólizas
2. Buscar una póliza en estado "asesor"
3. Hacer clic en el botón de envío (paper plane)
4. Confirmar datos del prospecto
5. Verificar que se envíe exitosamente
```

### 2. Ver Estado
```bash
1. Abrir la póliza en edición
2. Ir a Tab "Firma Electrónica"
3. Verificar que muestre estado actual
4. Si está pending, esperar a que se firme
```

### 3. Cargar Póliza Firmada
```bash
1. Una vez que estado_firma = 'signed'
2. Hacer clic en "Cargar Póliza Firmada"
3. Seleccionar PDF firmado
4. Verificar que se cargue y Google Sheets se actualice
```

---

## Notas Importantes

1. **Role Restriction:** El botón `BotonEnviarFirma` solo se muestra para roles `supervisor` y `backoffice`. Vendedor ve solo un chip informativo del estado.

2. **Auto-polling:** Cuando se envía a firma, el sistema automáticamente consulta el estado cada 10 segundos durante 5 minutos.

3. **Email Fallback:** Si el prospecto no tiene email, se usa un alias controlado `firma+poliza{id}@cober360.com` para que VaFirma pueda procesar la solicitud.

4. **Google Sheets:** Cuando se carga la póliza firmada, Google Sheets se actualiza automáticamente con el enlace de descarga.

5. **Estado Final:** Al cargar la póliza firmada, el estado automáticamente cambia a `venta_cerrada`.

---

## Archivos Relacionados

- [BotonEnviarFirma.jsx](../frontend/src/components/buttons/BotonEnviarFirma.jsx)
- [BadgeEstadoFirma.jsx](../frontend/src/components/badges/BadgeEstadoFirma.jsx)
- [CargarPolizaFirmadaModal.jsx](../frontend/src/components/modals/CargarPolizaFirmadaModal.jsx)
- [ConfirmarDatosProspectoModal.jsx](../frontend/src/components/modals/ConfirmarDatosProspectoModal.jsx)
- [vaFirmaService.js](../backend/services/vaFirmaSerice.js)
- [vafirmaController.js](../backend/controllers/vafirmaController.js)

---

## Fecha de Implementación
19 de Enero, 2026

## Estado
✅ COMPLETADO Y TESTEABLE
