# Manejo de Conversaciones WhatsApp en Refritos

## 📋 Tablas Relacionadas

### Tabla Principal: `chat_conversaciones_whatsapp`
Almacena todas las conversaciones de WhatsApp ligadas a prospectos:
- `id` - ID de la conversación
- `prospecto_id` - Referencia al prospecto
- `telefono` - Número de teléfono del contacto
- `numero_conversacion` - ID de la conversación en WhatsApp
- `estado` - Estado actual (activa, finalizada, etc.)
- `tipo_origen` - Cómo inició la conversación (sistema, usuario, etc.)
- `created_at` - Fecha de creación
- `updated_at` - Fecha de actualización

### Tabla Secundaria: `chat_mensajes`
Almacena los mensajes individuales:
- `id` - ID del mensaje
- `conversacion_id` - Referencia a `chat_conversaciones_whatsapp`
- `tipo` - 'enviado' o 'recibido'
- `contenido` - Texto del mensaje
- `archivo_url` - URL si es un archivo adjunto
- `created_at` - Fecha de creación

---

## 🎯 Escenario: Refrito con Prospecto Existente

### Situación:
```
1. Prospecto "Juan García" (numero_contacto: +5491234567890)
   ├─ ID: 42
   ├─ Vendedor Anterior: Carlos (ID: 5)
   └─ Conversación WhatsApp: 
       ├─ ID: 128
       ├─ 15 mensajes previos
       └─ Estado: activa

2. Se carga refrito con Juan García
   ├─ Nuevo Vendedor asignado: Mario (ID: 8)
   ├─ ¿Qué pasa con la conversación?
```

---

## 🔄 Opciones de Manejo

### **OPCIÓN A: Transferir Conversación al Nuevo Vendedor** ✅ RECOMENDADA

**Ventajas:**
- ✅ Preserva el contexto histórico
- ✅ No se pierden mensajes previos
- ✅ El nuevo vendedor ve todo el historial
- ✅ Continuidad en la relación con el cliente

**Implementación:**
```javascript
// En RefritosModel.js
async transferirConversacionWhatsApp(prospectoId, nuevoVendedorId) {
    const query = `
        UPDATE chat_conversaciones_whatsapp 
        SET vendedor_id = ? 
        WHERE prospecto_id = ?
    `;
    await db.query(query, [nuevoVendedorId, prospectoId]);
}
```

**Flujo en `procesarArchivoRefritos()`:**
```javascript
// Cuando se detecta prospecto duplicado:
1. Obtener prospecto_id del registro existente
2. Asignar a nuevo vendedor mediante round-robin
3. Transferir conversación WhatsApp al nuevo vendedor
4. Crear registro en asignaciones con fecha nueva
5. Actualizar es_reciclado = 1
```

---

### **OPCIÓN B: Eliminar Conversación y Resetear** ⚠️

**Ventajas:**
- ✅ El nuevo vendedor comienza "limpio"
- ✅ No hay confusión de históricos

**Desventajas:**
- ❌ Se pierden todos los mensajes
- ❌ No hay referencia del trabajo anterior
- ❌ Puede causar confusión al cliente

**Implementación:**
```javascript
async eliminarConversacionWhatsApp(prospectoId) {
    // Eliminar mensajes primero (FK constraint)
    const query1 = `
        DELETE cm FROM chat_mensajes cm
        JOIN chat_conversaciones_whatsapp ccw ON cm.conversacion_id = ccw.id
        WHERE ccw.prospecto_id = ?
    `;
    
    // Luego eliminar conversación
    const query2 = `
        DELETE FROM chat_conversaciones_whatsapp 
        WHERE prospecto_id = ?
    `;
    
    await db.query(query1, [prospectoId]);
    await db.query(query2, [prospectoId]);
}
```

---

### **OPCIÓN C: Marcar Conversación como "Migrada"** 🔄 ALTERNATIVA

**Ventajas:**
- ✅ Preserva histórico pero marca transición
- ✅ Nuevo vendedor ve que hay historial anterior
- ✅ Se pueden agregar notas de migración

**Implementación:**
```javascript
async marcarConversacionMigrada(prospectoId, nuevoVendedorId, vendedorAnterior) {
    // Actualizar conversación
    const query = `
        UPDATE chat_conversaciones_whatsapp 
        SET vendedor_id = ?, estado = 'migrada_para_reciclado'
        WHERE prospecto_id = ?
    `;
    await db.query(query, [nuevoVendedorId, prospectoId]);
    
    // Agregar mensaje de sistema notificando el cambio
    const query2 = `
        INSERT INTO chat_mensajes 
        (conversacion_id, tipo, contenido, created_at)
        SELECT id, 'sistema', 
               CONCAT('Prospecto reasignado a nuevo vendedor. Anteriormente con: ', ?), 
               NOW()
        FROM chat_conversaciones_whatsapp
        WHERE prospecto_id = ?
    `;
    await db.query(query2, [vendedorAnterior, prospectoId]);
}
```

---

## 📝 Recomendación de Implementación

**Opción elegida: A (Transferir Conversación)**

**Razones:**
1. Los clientes ya conocen al prospecto
2. Preserva el contexto de negociación
3. No confunde al cliente (sigue siendo el mismo número)
4. El nuevo vendedor puede ver qué se ofreció anteriormente
5. Es la práctica más profesional

---

## 🔧 Cambios Necesarios en RefritosModel.js

### 1. Detectar Prospecto Duplicado:
```javascript
async verificarDuplicado(numeroContacto) {
    const query = `
        SELECT id, es_reciclado FROM prospectos 
        WHERE numero_contacto = ?
        LIMIT 1
    `;
    const [result] = await db.query(query, [numeroContacto]);
    return result ? result : null;
}
```

### 2. Obtener Conversación Actual:
```javascript
async obtenerConversacionActual(prospectoId) {
    const query = `
        SELECT * FROM chat_conversaciones_whatsapp
        WHERE prospecto_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `;
    const [result] = await db.query(query, [prospectoId]);
    return result ? result : null;
}
```

### 3. Actualizar `procesarArchivoRefritos()`:
```javascript
async procesarArchivoRefritos(datosArray) {
    for (const fila of datosArray) {
        // Normalizar
        const filaNormalizada = this.normalizarFila(fila);
        
        // NUEVA LÓGICA: Verificar duplicado
        const duplicado = await this.verificarDuplicado(filaNormalizada.numero_contacto);
        
        if (duplicado) {
            // Ya existe el prospecto
            const prospectoId = duplicado.id;
            
            // Obtener vendedores activos
            const vendedores = await this.obtenerVendedoresActivos();
            const vendedorId = vendedores[Math.random() * vendedores.length | 0].id;
            
            // TRANSFERIR CONVERSACIÓN WhatsApp
            const conversacion = await this.obtenerConversacionActual(prospectoId);
            if (conversacion) {
                await this.transferirConversacionWhatsApp(prospectoId, vendedorId);
            }
            
            // Actualizar registro de prospecto
            await this.actualizarProspectoReciclado(prospectoId);
            
            // Crear nueva asignación
            await this.crearAsignacionReciclado(prospectoId, vendedorId);
        } else {
            // No existe, crear normalmente
            await this.crearProspectoReciclado(filaNormalizada);
        }
    }
}
```

---

## 📊 Flujo Visual

```
┌─────────────────────────────────────────┐
│   Cargar CSV con Refritos               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Para cada fila del CSV:               │
│   ¿Existe prospecto con ese teléfono?   │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
   ✅ SÍ             ❌ NO
   (Duplicado)      (Nuevo)
       │                │
       │                ▼
       │        ┌─────────────────────┐
       │        │ Crear Prospecto     │
       │        │ es_reciclado = 1    │
       │        │ Asignar Vendedor    │
       │        │ Crear Asignación    │
       │        └─────────────────────┘
       │
       ▼
  ┌──────────────────────────────────┐
  │ ¿Tiene conversación WhatsApp?    │
  └────────┬───────────────┬─────────┘
           │               │
        ✅ SÍ            ❌ NO
           │               │
           ▼               ▼
     ┌──────────────┐   Fin ✅
     │ Transferir   │
     │ conversación │
     │ al nuevo     │
     │ vendedor     │
     └────┬─────────┘
          │
          ▼
      ┌─────────────────┐
      │ Actualizar      │
      │ asignación      │
      │ (fecha, estado) │
      └────┬────────────┘
           │
           ▼
         Fin ✅
```

---

## 🧪 Prueba de Implementación

**Escenario de Prueba:**
1. Crear prospecto "Juan García" (+5491234567890) asignado a Carlos
2. Agregar mensajes WhatsApp a la conversación
3. Cargar CSV con Juan García como refrito
4. Verificar que:
   - ✅ Prospecto sea asignado a nuevo vendedor
   - ✅ Conversación sea transferida al nuevo vendedor
   - ✅ Mensajes anteriores sigan visibles
   - ✅ es_reciclado = 1 se establezca

---

## 📞 Consideraciones Importantes

1. **Vendedor no recibirá notificación automática** del cambio (implementar notificación si es necesario)
2. **El cliente NO sabe que fue reasignado** (el número sigue siendo el mismo)
3. **Historial está disponible para análisis** en reportes de supervisores
4. **Transacciones deben ser atómicas** (si falla una parte, rollback de todo)

---

## 🔐 Seguridad

- ✅ Validar que el usuario sea ADMIN antes de permitir cambios en WhatsApp
- ✅ Registrar en auditoría quién realizó la reasignación
- ✅ Validar que los vendedores sigan siendo activos
- ✅ Evitar transferencias hacia vendedores inactivos
