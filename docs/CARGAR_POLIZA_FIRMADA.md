# 📋 Funcionalidad: Cargar Póliza Firmada

## Descripción General
Se ha agregado un nuevo flujo para que los usuarios de Back Office carguen las pólizas firmadas electrónicamente (PDFs) directamente en el sistema. Una vez cargada, el enlace se actualiza automáticamente en Google Sheets en la columna "Póliza Completa".

## Componentes Implementados

### 1. **Backend - Endpoint**
**Ruta:** `POST /api/polizas/documentos/firmada/cargar`

**Autenticación:** JWT Token requerido

**Parámetros:**
- `poliza_id` (form-data): ID de la póliza
- `poliza_firmada` (file): Archivo PDF (máximo 10MB)

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "mensaje": "Póliza firmada cargada exitosamente",
  "documento_id": 123,
  "public_hash": "abc123def456",
  "public_url": "https://wspflows.cober.online/api/polizas/documentos/public/abc123def456",
  "nombre_archivo": "poliza_1234.pdf",
  "nombre_original": "poliza_1234.pdf",
  "tamaño": 2048000,
  "tipo_mime": "application/pdf",
  "numero_poliza": "POL-2026-001",
  "numero_poliza_oficial": "POL-2026-001"
}
```

### 2. **Frontend - Componente Modal**
**Archivo:** `src/components/modals/CargarPolizaFirmadaModal.jsx`

**Características:**
- Drag & drop para subir archivos
- Validación de archivo (solo PDF)
- Límite de tamaño (10MB)
- Barra de progreso durante la carga
- Mensajes de error/éxito claros
- Actualización automática de Google Sheets

**Props:**
```jsx
<CargarPolizaFirmadaModal
  show={boolean}              // Mostrar/ocultar modal
  onHide={function}           // Callback al cerrar
  polizaId={number}           // ID de la póliza
  numeroPoliza={string}       // Número de póliza (para mostrar)
  onSuccess={function}        // Callback después de éxito
/>
```

### 3. **Frontend - Integración en BackOffice**
**Archivo:** `src/components/features/backoffice/PolizasBackOffice.jsx`

**Cambios:**
- Estado para gestionar el modal: `modalCargarPolizaFirmada`
- Estado para póliza seleccionada: `polizaParaCargar`
- Función `handleAbrirCargarPolizaFirmada()` para abrir modal
- Función `handlePolizaFirmadaCargada()` callback de éxito
- Botón en la tabla de acciones con ícono de upload (FaFileUpload)

**Ubicación del Botón:**
- Entre el botón de "Ver documentos" y "Cambiar estado"
- Color: `outline-success`
- Ícono: `FaFileUpload`

## Flujo de Trabajo

```
1. Usuario Back Office abre tabla de pólizas
   ↓
2. Busca póliza a cargar y hace clic en botón ⬆️ (Upload)
   ↓
3. Se abre modal "Cargar Póliza Firmada"
   ↓
4. Usuario arrastra o selecciona archivo PDF
   ↓
5. Modal valida: formato (PDF) + tamaño (≤10MB)
   ↓
6. Usuario hace clic en "Cargar Póliza Firmada"
   ↓
7. Backend:
   - Recibe archivo
   - Crea hash público único
   - Guarda en tabla poliza_documentos (tipo: 'poliza_firmada')
   - Genera URL pública para descargar
   - Intenta actualizar Google Sheets automáticamente
   ↓
8. Frontend:
   - Muestra barra de progreso
   - Muestra mensaje de éxito
   - Cierra modal automáticamente (2 segundos)
   - Recarga la lista de pólizas
   ↓
9. Usuario puede descargar la póliza desde el enlace en Google Sheets
```

## Base de Datos

### Tabla: `poliza_documentos`
```sql
-- Campo nuevo/existente utilizado:
- id: INT PK
- poliza_id: INT (FK)
- tipo_documento: VARCHAR (valor: 'poliza_firmada')
- nombre_original: VARCHAR
- nombre_archivo: VARCHAR
- ruta_archivo: VARCHAR
- tipo_mime: VARCHAR (application/pdf)
- tamaño_bytes: INT
- public_hash: VARCHAR (hash único para acceso público)
- integrante_index: INT (NULL para póliza completa)
- subido_por: INT (FK usuarios)
- created_at: TIMESTAMP
```

## Google Sheets Integración

Cuando se carga una póliza firmada:

1. **Se actualiza automáticamente** el sheet "Finalizadas"
2. **Columna "Póliza Completa"** recibe el enlace público
3. **Formato URL:** `https://wspflows.cober.online/api/polizas/documentos/public/{public_hash}`
4. **Acceso:** Sin autenticación (público)

### Servicio: `googleSheetsPolizasService.js`
- Método existente: `agregarPolizaCerrada(polizaId)`
- Se reutiliza para actualizar el sheet después de cargar póliza

## Seguridad

1. **Autenticación:** Solo usuarios Back Office autenticados
2. **Validación de archivo:** 
   - Solo archivos PDF
   - Máximo 10MB
3. **Acceso público:**
   - URL con hash único y opaco
   - No expone rutas internas
4. **Control de usuario:**
   - Registra quién cargó el archivo (`subido_por`)

## Errores Comunes

### Error 1: "No se recibió ningún archivo"
**Causa:** El formulario no incluyó el archivo
**Solución:** Asegúrate de seleccionar un archivo antes de hacer clic en "Cargar"

### Error 2: "Solo se aceptan archivos PDF"
**Causa:** El archivo no es PDF
**Solución:** Convierte el archivo a PDF y vuelve a intentar

### Error 3: "El archivo no puede ser mayor a 10MB"
**Causa:** El PDF es muy grande
**Solución:** Comprime el PDF o divide en archivos más pequeños

### Error 4: "Google Sheets no se pudo actualizar"
**Advertencia no crítica:** El archivo se cargó correctamente, pero Google Sheets no fue actualizado
**Solución:** Verifica credenciales de Google en `.env`

## Variables de Entorno Requeridas

```env
# Frontend
VITE_API_URL=http://localhost:3000

# Backend
BASE_URL=https://wspflows.cober.online  # Para generar URLs públicas
DOMAIN=wspflows.cober.online            # Fallback si BASE_URL no está set
```

## Testing Manual

### Paso 1: Acceder a Back Office
1. Iniciar sesión como usuario Back Office
2. Ir a "Pólizas"

### Paso 2: Cargar Póliza
1. Buscar una póliza en estado "venta_cerrada" o similar
2. Hacer clic en botón ⬆️ (Upload)
3. Modal se abre

### Paso 3: Seleccionar y Cargar
1. Arrastra un PDF o haz clic para seleccionar
2. Valida que aparezca el nombre del archivo
3. Haz clic en "Cargar Póliza Firmada"
4. Espera a que termine

### Paso 4: Verificar Google Sheets
1. Abre el Google Sheet: [ID: 1FM6NK_zDNPSsu5E0kTj6VBJVxnlx7MgcN-HY9RjZ0T8]
2. Navega a la pestaña "Finalizadas"
3. Busca la póliza por número oficial
4. Verifica que "Póliza Completa" tenga un enlace clickeable

## Logs Útiles

### Backend
```bash
tail -f /var/www/cober360/backend/logs/*.log

# Búsqueda:
# - "📋 Cargando póliza firmada"
# - "✅ Póliza firmada guardada"
# - "✅ Google Sheets actualizado"
```

### Frontend (Console)
```javascript
// Ver requests
console.log('POST /api/polizas/documentos/firmada/cargar')

// Ver respuesta
// Ver mensaje de éxito en Toast
```

## Próximas Mejoras Potenciales

1. **Múltiples versiones:** Permitir carga de varias versiones de póliza firmada
2. **Auditoría:** Registrar quién cargó y cuándo
3. **Notificaciones:** Enviar email al vendedor cuando póliza se carga
4. **Validación:** Verificar que el PDF sea válido antes de guardar
5. **Presets:** Permitir descargar plantilla PDF vacía para rellenar
