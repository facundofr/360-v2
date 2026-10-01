# 📋 Job de Sincronización de Estados de Firma - VaFirma

## Descripción
Job automático que sincroniza periódicamente el estado de las solicitudes de firma con VaFirma.

**Problema que resuelve:**
- Si el webhook de VaFirma falla o no actualiza correctamente, las pólizas quedan como "pendiente" aunque ya estén firmadas
- Este job consulta VaFirma cada X minutos para actualizar automáticamente cualquier `pending` que ya esté `signed`

## Ubicación
- **Archivo**: `backend/jobs/sincronizar-estado-firma.js`
- **Punto de entrada**: `backend/server.js` (se inicia automáticamente al arrancar)

## Funcionalidad

### ¿Qué hace?
1. Busca TODOS los registros en `polizas_vafirma_envios` con `estado_firma = 'pending'` (de los últimos 7 días)
2. Consulta VaFirma para cada `doc_uuid` pendiente
3. Si VaFirma retorna `signed`, `firmado`, `completed`, etc., actualiza el registro a `signed`
4. Si VaFirma retorna `rejected` o `expired`, también actualiza

### Intervalo
- Se ejecuta **cada 5 minutos** (configurable)
- Primera ejecución: inmediatamente al iniciar (carga rápida)
- Consulta máximo **50 registros por ciclo** para no saturar VaFirma

### Filtros
- Solo sincroniza `pending` de los **últimos 7 días**
- Evita consultar solicitudes antiguas que ya deberían estar resueltas
- Si necesitas sincronizar más atrás, ajusta el `INTERVAL 7 DAY` en la query

---

## Logs y Monitoreo

Los logs aparecen en la consola del servidor con prefix `[Sync Firma]`:

```
🔄 [Sync Firma] Iniciando sincronización de estados pendientes con VaFirma...
📋 [Sync Firma] Encontrados X registros pendientes. Consultando VaFirma...
✅ [Sync Firma] Actualizado: póliza 155, docUUID 9ab2517b-... → signed
⏸️  [Sync Firma] Sin cambio: póliza 166, docUUID 51bddd ... sigue pending
📊 [Sync Firma] Sincronización completada: X actualizados, Y errores
```

---

## Configuración

### Cambiar intervalo de sincronización

**Ubicación**: `backend/jobs/sincronizar-estado-firma.js`, línea 8:

```javascript
const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos
```

**Ejemplos:**
- `1 * 60 * 1000` → cada 1 minuto (más agresivo, consume más recursos)
- `15 * 60 * 1000` → cada 15 minutos (más relajado)
- `60 * 60 * 1000` → cada 1 hora (muy relajado)

### Cambiar límite de registros por ciclo

**Ubicación**: línea 24:

```javascript
LIMIT 50  // ← cambiar este número
```

Aumentar si hay muchos pendientes; reducir si VaFirma es lento.

### Cambiar rango de días a sincronizar

**Ubicación**: línea 20:

```javascript
AND enviado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)  // ← cambiar 7 DAY
```

Ejemplos:
- `INTERVAL 30 DAY` → sincronizar últimos 30 días
- `INTERVAL 1 DAY` → sincronizar solo hoy
- Remover la condición para sincronizar TODO (no recomendado)

---

## Ejecución Manual

Si necesitas sincronizar manualmente sin esperar el siguiente ciclo:

```bash
# Desde el directorio backend:
node jobs/sincronizar-estado-firma.js
```

O desde Node.js:

```javascript
const SincronizarEstadoFirmaJob = require('./jobs/sincronizar-estado-firma');
await SincronizarEstadoFirmaJob.sincronizarEstadosFirma();
```

---

## Cómo se integra con el resto del sistema

### Flujo completo de firma:
1. **Usuario envía póliza a firma** → se crea registro con `estado_firma = 'pending'`
2. **Cliente firma en VaFirma** → VaFirma debería disparar webhook con `signed`
3. **Si webhook falla** → job sincroniza automáticamente cada 5 minutos
4. **Dashboard Back Office** → muestra estado agregado (ya detecta cualquier `signed` con TRIM+LOWER)

### Endpoints relacionados:
- `GET /api/vafirma/estado/:polizaId` → consulta estado agregado por póliza
- `GET /api/vafirma/estado-doc/:docUUID` → sincroniza y devuelve estado de un docUUID específico
- Listado Back Office → muestra `estado_firma` considerando todos los envíos

---

## Troubleshooting

### "El job no está sincronizando"
1. Verifica los logs al iniciar servidor: busca `✅ Job de sincronización de firma iniciado`
2. Si no aparece, revisa que `server.js` tenga el require e `iniciarJob()`
3. Corrobora que VaFirma responde a consultas (prueba endpoint `GET /api/vafirma/estado-doc/:docUUID`)

### "Sigue mostrando pendiente aunque esté firmada"
1. El job actualiza `polizas_vafirma_envios` en la BD
2. Si el dashboard no refleja cambios, recarga caché del navegador
3. Verifica que `estado_firma` sea exactamente `'signed'` (sin espacios): `SELECT estado_firma FROM polizas_vafirma_envios WHERE poliza_id = X`

### "Demasiados errores de VaFirma"
- Reduce la frecuencia (aumenta intervalo)
- Reduce `LIMIT` de registros por ciclo
- Valida credenciales de VaFirma en `.env`

---

## Casos de uso

### Caso 1: Cliente firmó pero el webhook no llegó
- **Antes**: póliza seguía como "pendiente a firma" en dashboard
- **Después**: job sincroniza al próximo ciclo, aparece como "firmada" ✅

### Caso 2: Múltiples reenvíos
- Si se reenviaron 3 solicitudes y se firmó la última (o la primera)
- Job consulta todas, encuentra LA que está signed, actualiza esa
- Dashboard muestra "firmada" correctamente con agregados

### Caso 3: Solicitud expirada
- Si la solicitud expiró en VaFirma
- Job actualiza el registro a `expired`
- Dashboard puede mostrar estado especial (requiere UI update)

---

## Próximas mejoras opcionales

1. **Notificaciones**: enviar email si una póliza pasa de `pending` a `signed`
2. **Auto-avance de estado**: cuando una póliza se firma, automáticamente cambiar su estado a `venta_cerrada` (opcional)
3. **Webhook mejorado**: aumentar reintentos y validación de payload de VaFirma
4. **Métricas**: registrar cuántas sincronizaciones se hicieron, promedio de tiempo, etc.

---

## Dependencias
- `db` (conexión a BD)
- `vaFirmaService` (consultas a VaFirma)

Ambas ya disponibles en el proyecto.
