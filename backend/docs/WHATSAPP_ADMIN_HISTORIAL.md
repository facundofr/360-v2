# Funcionalidad de Historial de Chat WhatsApp - Admin

## 📋 Descripción General

Se ha implementado la funcionalidad completa para que los administradores puedan consultar el historial de conversaciones de WhatsApp de los prospectos directamente desde el panel de administración.

## 🗄️ Estructura de Base de Datos

### Tabla: `chat_conversaciones_whatsapp`
Almacena las conversaciones de WhatsApp iniciadas con prospectos.

**Campos principales:**
- `id`: ID único de la conversación
- `numero_conversacion`: Número de conversación (formato: CONV-YYYYMMDD-XXXX)
- `telefono`: Número de teléfono del prospecto
- `prospecto_id`: ID del prospecto (puede ser NULL)
- `poliza_id`: ID de la póliza relacionada (puede ser NULL)
- `vendedor_id`: ID del vendedor asignado
- `estado`: Estado de la conversación (activa, pausada, cerrada)
- `tipo_origen`: Origen de la conversación (cotizacion, poliza, manual)
- `twilio_conversation_sid`: SID de Twilio (si aplica)
- `ultima_actividad`: Timestamp de última actividad
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

### Tabla: `chat_mensajes`
Almacena los mensajes individuales de cada conversación.

**Campos principales:**
- `id`: ID único del mensaje
- `conversacion_id`: ID de la conversación a la que pertenece
- `mensaje`: Contenido del mensaje
- `tipo`: Tipo de mensaje (enviado, recibido, sistema)
- `origen`: Origen del mensaje (vendedor, cliente, sistema, whatsapp)
- `twilio_message_sid`: SID del mensaje en Twilio
- `estado_entrega`: Estado de entrega (pendiente, enviado, entregado, leido, fallido)
- `metadata`: Información adicional en formato JSON
- `created_at`: Fecha de creación
- `archivo_url`: URL del archivo adjunto (si existe)
- `archivo_tipo`: Tipo MIME del archivo
- `archivo_nombre`: Nombre del archivo
- `archivo_tamaño`: Tamaño del archivo en bytes

## 🛣️ Rutas del Backend

### 1. Obtener conversaciones por teléfono
```
GET /api/admin/whatsapp/conversaciones/:telefono
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "numero_conversacion": "CONV-20250911-0001",
      "telefono": "1135725178",
      "prospecto_id": null,
      "poliza_id": null,
      "vendedor_id": 82,
      "estado": "activa",
      "tipo_origen": "cotizacion",
      "ultima_actividad": "2025-09-11T10:30:39.000Z",
      "created_at": "2025-09-11T10:29:22.000Z",
      "vendedor_nombre": "Juan",
      "vendedor_apellido": "Pérez",
      "vendedor_email": "juan.perez@example.com",
      "prospecto_nombre": "Franco",
      "prospecto_apellido": "Test",
      "total_mensajes": 15,
      "ultimo_mensaje": "Gracias por la información",
      "fecha_ultimo_mensaje": "2025-09-11T10:30:39.000Z"
    }
  ],
  "total": 1
}
```

### 2. Obtener mensajes de una conversación
```
GET /api/admin/whatsapp/conversacion/:conversacionId/mensajes
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "conversacion_id": 5,
      "contenido": "👋 Hola Franco Test, Te contactamos desde Cober...",
      "tipo": "enviado",
      "origen": "vendedor",
      "twilio_message_sid": "MM60b441d7dbf30e22a20b745eaeb46aa0",
      "estado": "enviado",
      "metadata": null,
      "fecha_envio": "2025-09-11T10:29:22.000Z",
      "archivo_url": null,
      "archivo_tipo": null,
      "archivo_nombre": null,
      "archivo_tamaño": null,
      "numero_conversacion": "CONV-20250911-0001",
      "telefono": "1135725178",
      "conversacion_estado": "activa",
      "vendedor_nombre": "Juan",
      "vendedor_apellido": "Pérez"
    }
  ],
  "total": 15
}
```

## 📝 Controlador (adminController.js)

### Método: `getConversacionesPorTelefono`
- Obtiene todas las conversaciones asociadas a un número de teléfono
- Incluye información del vendedor, prospecto y póliza relacionada
- Cuenta el total de mensajes por conversación
- Obtiene el último mensaje de cada conversación

### Método: `getMensajesConversacion`
- Obtiene todos los mensajes de una conversación específica
- Incluye información de archivos adjuntos
- Parsea metadata JSON automáticamente
- Ordena mensajes cronológicamente

## 🎨 Frontend (ProspectosAdmin.jsx)

### Componente: Modal de Conversaciones WhatsApp

**Estados:**
- `modalConversaciones`: Controla visibilidad del modal
- `prospectoConversaciones`: Prospecto seleccionado
- `conversacionesProspecto`: Lista de conversaciones
- `conversacionSeleccionada`: Conversación activa en vista de mensajes
- `mensajesConversacion`: Mensajes de la conversación activa
- `loadingConversaciones`: Estado de carga de conversaciones
- `loadingMensajes`: Estado de carga de mensajes

**Funciones principales:**

#### `handleEnviarWhatsApp(prospecto)`
Abre el modal de conversaciones y carga todas las conversaciones del prospecto.

```javascript
const handleEnviarWhatsApp = async (prospecto) => {
  // 1. Activa estado de carga
  // 2. Obtiene token de autenticación
  // 3. Hace petición GET a /api/admin/whatsapp/conversaciones/:telefono
  // 4. Actualiza estados con los datos recibidos
  // 5. Abre el modal
  // 6. Maneja errores con SweetAlert2
}
```

#### `handleVerConversacion(conversacion)`
Carga los mensajes de una conversación específica.

```javascript
const handleVerConversacion = async (conversacion) => {
  // 1. Activa estado de carga
  // 2. Obtiene token de autenticación
  // 3. Hace petición GET a /api/admin/whatsapp/conversacion/:id/mensajes
  // 4. Actualiza estados con los mensajes recibidos
  // 5. Cambia vista a mensajes individuales
  // 6. Maneja errores con SweetAlert2
}
```

#### `handleVolverAConversaciones()`
Regresa a la vista de lista de conversaciones.

#### `handleNuevaConversacion()`
Abre WhatsApp Web para iniciar nueva conversación.

### Visualización

**Vista de conversaciones:**
- Lista todas las conversaciones del prospecto
- Muestra estado (activa, pausada, cerrada)
- Indica tipo de origen (cotización, póliza, manual)
- Cuenta total de mensajes
- Muestra último mensaje y fecha
- Incluye información del vendedor asignado

**Vista de mensajes:**
- Mensajes ordenados cronológicamente
- Diferencia visual entre enviados y recibidos
- Muestra estado de entrega
- Indica origen del mensaje
- Muestra archivos adjuntos si existen
- Formato de fecha localizado (es-AR)

## 🎯 Funciones Auxiliares

### `formatearFecha(fecha)`
Formatea fechas al formato argentino (DD/MM/YYYY HH:mm)

### `getEstadoConversacion(estado)`
Retorna objeto con texto y variante de color para badges de estado.

### `getEstadoTexto(estado)`
Convierte estados de entrega a texto legible en español.

### `getTipoOrigen(tipo)`
Convierte tipos de mensaje a texto legible.

### `getTipoOrigenIcon(tipo)`
Retorna el componente de icono correspondiente al tipo.

## 🔒 Seguridad

- ✅ Autenticación requerida con JWT
- ✅ Verificación de rol de administrador
- ✅ Validación de parámetros en backend
- ✅ Rate limiting aplicado a todas las rutas admin
- ✅ Sanitización de datos
- ✅ Logs de auditoría para consultas

## 📊 Estadísticas Actuales

- **Conversaciones registradas:** 102
- **Mensajes totales:** 234
- **Estados de conversación:** activa, pausada, cerrada
- **Tipos de mensaje:** enviado, recibido, sistema
- **Orígenes soportados:** vendedor, cliente, sistema, whatsapp

## 🚀 Uso desde el Frontend

### Paso 1: Acceder al panel de prospectos
Navegar a Admin Dashboard > Prospectos

### Paso 2: Buscar el prospecto
Usar filtros para localizar el prospecto deseado

### Paso 3: Abrir conversaciones
Click en el botón de WhatsApp (icono verde) en la columna de acciones

### Paso 4: Ver conversaciones
- Se muestra lista de todas las conversaciones
- Click en una conversación para ver mensajes

### Paso 5: Ver detalles de mensajes
- Mensajes ordenados cronológicamente
- Información completa de cada mensaje
- Estado de entrega visible

## 🔧 Mantenimiento

### Logs importantes:
```bash
# Consulta de conversaciones
📞 Admin consultando conversaciones para teléfono: [telefono]

# Consulta de mensajes
💬 Admin consultando mensajes de conversación: [id]

# Errores
❌ Error al obtener conversaciones de WhatsApp: [error]
❌ Error al obtener mensajes de la conversación: [error]
```

### Queries de diagnóstico:
```sql
-- Verificar conversaciones por teléfono
SELECT * FROM chat_conversaciones_whatsapp WHERE telefono = '1135725178';

-- Verificar mensajes de conversación
SELECT * FROM chat_mensajes WHERE conversacion_id = 5 ORDER BY created_at ASC;

-- Estadísticas generales
SELECT 
  estado,
  COUNT(*) as total,
  COUNT(DISTINCT vendedor_id) as vendedores_unicos,
  COUNT(DISTINCT telefono) as telefonos_unicos
FROM chat_conversaciones_whatsapp
GROUP BY estado;
```

## ✅ Testing

### Pruebas recomendadas:

1. **Conversaciones existentes:**
   - Verificar que se cargan todas las conversaciones del prospecto
   - Verificar información del vendedor
   - Verificar conteo de mensajes

2. **Mensajes:**
   - Verificar orden cronológico
   - Verificar diferenciación visual enviado/recibido
   - Verificar estados de entrega
   - Verificar archivos adjuntos

3. **Estados:**
   - Conversaciones activas
   - Conversaciones pausadas
   - Conversaciones cerradas

4. **Errores:**
   - Prospecto sin conversaciones
   - Conversación sin mensajes
   - Token inválido
   - Teléfono inválido

## 📝 Notas Adicionales

- Los administradores pueden ver conversaciones de cualquier vendedor
- No se requiere que el prospecto esté activo en el sistema
- Los mensajes se almacenan permanentemente para auditoría
- La metadata JSON puede contener información adicional de Twilio
- Los archivos adjuntos se almacenan en el servidor y se referencian por URL

## 🔄 Actualizaciones Futuras

Posibles mejoras:
- [ ] Filtros por estado de conversación
- [ ] Búsqueda de mensajes por contenido
- [ ] Exportación de conversaciones a PDF
- [ ] Estadísticas de conversaciones por vendedor
- [ ] Responder desde el panel de admin
- [ ] Notificaciones en tiempo real
- [ ] Vista de archivos multimedia inline
