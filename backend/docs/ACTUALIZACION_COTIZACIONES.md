# 🔄 Función de Actualización de Cotizaciones con Precios Actuales

## Descripción
Se ha implementado una nueva funcionalidad que permite **actualizar cotizaciones antiguas con los precios actuales del sistema**. Esto es útil cuando hay prospectos con cotizaciones desactulizadas y se necesita recalcular los valores con la información de precios y promociones vigente.

## Características

✅ **Recalcula automáticamente:**
- Precios base según edad y tipo de afiliación actual
- Descuentos de promociones vigentes
- Totales de la cotización (bruto, descuentos, final)

✅ **Mantiene:**
- Integrantes de la cotización (titular, familiares)
- Promociones aplicables al prospecto
- Estructura de la cotización original

✅ **Interfaz amigable:**
- Botón intuitivo en cada cotización
- Confirmación antes de actualizar
- Feedback visual con resultados actualizados

---

## Uso

### En el Frontend (ProspectoDetalle.jsx)

1. **Ubicación del botón:**
   - En la vista de detalle de un prospecto
   - En cada tarjeta de cotización
   - Botón azul "Actualizar Precios" junto a los botones de "Generar Póliza" y "Enviar"

2. **Pasos para usar:**
   - Ingresar a un prospecto con cotizaciones
   - Hacer clic en el botón "Actualizar Precios" en la cotización deseada
   - Confirmar la acción en el modal
   - El sistema recalculará y mostrará los nuevos totales

### Ejemplo de uso:
```javascript
// El usuario hace clic en "Actualizar Precios"
handleRecalcularCotizacion(cotizacion)

// Se abre un modal de confirmación
// El usuario confirma
// Se envía POST a /cotizaciones/{id}/recalcular

// Resultado: 
// ✅ Precios actualizados
// ✅ Detalles recalculados
// ✅ Cotización sincronizada
```

---

## Endpoints API

### Recalcular Cotización
```
POST /api/cotizaciones/{cotizacionId}/recalcular
```

**Headers requeridos:**
```javascript
Authorization: Bearer {token}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Cotización recalculada exitosamente con precios actuales",
  "data": {
    "cotizacion_id": 18868,
    "integrantes_actualizados": 3,
    "nuevos_totales": {
      "total_bruto": 563602.23,
      "total_descuento": 253621.00,
      "total_final": 309981.23
    }
  }
}
```

**Errores posibles:**
- **404**: Cotización no encontrada
- **400**: La cotización no tiene detalles
- **500**: Error interno del servidor

---

## Implementación Técnica

### Backend (Controllers/cotizacionesController.js)

**Nueva función:** `recalcularCotizacion(req, res)`

Proceso:
1. Verifica que la cotización existe
2. Obtiene todos los detalles de la cotización actual
3. Inicia una transacción de base de datos
4. Para cada detalle:
   - Busca el precio actual en `listas_precios`
   - Aplica promociones vigentes del prospecto
   - Recalcula descuentos y precio final
   - Actualiza el detalle en BD
5. Recalcula y actualiza los totales de la cotización
6. Confirma la transacción

**Seguridad:**
- Requiere autenticación (`authenticateToken`)
- Usa transacciones SQL para garantizar integridad
- Rollback automático en caso de error

### Frontend (ProspectoDetalle.jsx)

**Nueva función:** `handleRecalcularCotizacion(cotizacion)`

Proceso:
1. Solicita confirmación al usuario
2. Setea estado de carga `recalculandoCotizacion`
3. Realiza POST a endpoint de recalcular
4. Muestra resultado con nuevos totales
5. Recarga las cotizaciones
6. Limpia estado de carga

**Estados agregados:**
```javascript
const [recalculandoCotizacion, setRecalculandoCotizacion] = useState(null)
```

**Validación visual:**
- Botón deshabilitado durante procesamiento
- Spinner de carga mientras se recalcula
- Tooltips descriptivos

---

## Base de Datos - Consultas Utilizadas

### 1. Verificar cotización
```sql
SELECT c.id, c.prospecto_id, c.plan_id
FROM cotizaciones c
WHERE c.id = ?
```

### 2. Obtener detalles de cotización
```sql
SELECT cd.id, cd.persona, cd.vinculo, cd.edad, cd.tipo_afiliacion_id
FROM cotizaciones_detalles cd
WHERE cd.cotizacion_id = ?
```

### 3. Obtener precio actual
```sql
SELECT lp.precio
FROM listas_precios lp
WHERE lp.plan_id = ? 
  AND lp.tipo_afiliacion_id = ?
  AND lp.edad_minima <= ? 
  AND lp.edad_maxima >= ?
```

### 4. Obtener promoción vigente
```sql
SELECT p.id, p.nombre, p.porcentaje_descuento
FROM promociones p
WHERE p.id = ? AND p.activa = 1
```

### 5. Actualizar detalle
```sql
UPDATE cotizaciones_detalles 
SET precio_base = ?, 
    descuento_promocion = ?,
    precio_final = ?,
    promocion_aplicada = ?
WHERE id = ?
```

### 6. Actualizar totales de cotización
```sql
UPDATE cotizaciones 
SET total_bruto = ?, 
    total_descuento = ?,
    total_descuento_promocion = ?,
    total_final = ?
WHERE id = ?
```

---

## Casos de Uso

### Caso 1: Prospecto con cotización antigua
**Problema:** Jorge tiene una cotización de noviembre con precios desactualizados

**Solución:**
1. Entrar a detalle de Jorge (prospecto 4694)
2. Ver cotización de Plan 1 con precio $183,421.96 (antiguo)
3. Hacer clic en "Actualizar Precios"
4. Confirmar en el modal
5. Sistema recalcula con precios actuales
6. Nuevo total: $195,000.00 (ejemplo)

### Caso 2: Cambio de precios en el sistema
**Problema:** Acaban de actualizar los precios base de los planes

**Solución:**
1. Todos los prospectos con cotizaciones antiguas pueden actualizarlas
2. Sin necesidad de volver a cotizar desde cero
3. Mantiene la estructura de integrantes
4. Aplica promociones actuales automáticamente

### Caso 3: Prospecto con promoción nueva
**Problema:** Se aplicó una nueva promoción al prospecto y sus cotizaciones no la reflejan

**Solución:**
1. La próxima vez que se actualice la cotización
2. Se aplicará la nueva promoción vigente
3. Los cálculos se harán con ambas promociones (si aplica)

---

## Estados y Transiciones

```
Cotización Antigua
    ↓
Usuario hace clic "Actualizar Precios"
    ↓
Modal de Confirmación
    ↓ (Confirmar)
Recalculando... (spinner)
    ↓
API procesa recalcular
    ↓
Éxito: Mostrar nuevos totales
    ↓ (OK)
Cotización Actualizada ✅
    ↓
Recargar vista con precios nuevos
```

---

## Notas Importantes

⚠️ **Validaciones:**
- La cotización debe tener al menos un detalle
- Los precios deben existir en `listas_precios` para la edad/tipo de afiliación
- Se requiere autenticación

📝 **Registros:**
- Se logging en consola del servidor el progreso
- Los cambios se almacenan en BD con timestamp actualizado
- La tabla de cotizaciones registra `updated_at` automáticamente

🔄 **Transacciones:**
- Usa transacciones SQL para integridad
- Rollback automático si hay error
- No queda en estado parcial

---

## Archivos Modificados

### Backend:
- `controllers/cotizaciones/cotizacionesController.js` - Agregada función `recalcularCotizacion`
- `routes/cotizaciones/cotizaciones.js` - Agregada ruta POST `/:cotizacionId/recalcular`

### Frontend:
- `components/features/vendedor/ProspectoDetalle.jsx`
  - Agregado estado: `recalculandoCotizacion`
  - Agregada función: `handleRecalcularCotizacion`
  - Agregado botón "Actualizar Precios" en cada cotización

---

## Testing

Para probar la funcionalidad:

1. **Crear prospecto con cotización antigua:**
   ```bash
   # Usar prospecto 4694 (Jorge GOMEZ)
   # Cotizaciones: 18868, 18869, 18870, 18871
   ```

2. **Verificar precios antes:**
   ```javascript
   GET /api/lead/4694/cotizaciones?detalles=1
   // Ver total_final original
   ```

3. **Actualizar cotización:**
   ```javascript
   POST /api/cotizaciones/18868/recalcular
   Authorization: Bearer {token}
   ```

4. **Verificar cambios:**
   ```javascript
   GET /api/lead/4694/cotizaciones?detalles=1
   // Verificar nuevo total_final
   // Verificar nuevos precios en detalles
   ```

---

## Flujo Completo

```mermaid
graph TD
    A[Usuario abre prospecto] --> B[Ve cotizaciones]
    B --> C[Botón "Actualizar Precios"]
    C --> D[Clic en botón]
    D --> E[Modal de confirmación]
    E -->|Confirmar| F[setRecalculandoCotizacion]
    E -->|Cancelar| G[Fin]
    F --> H[POST /cotizaciones/:id/recalcular]
    H --> I{Éxito?}
    I -->|No| J[Mostrar error]
    I -->|Sí| K[Mostrar nuevos totales]
    K --> L[fetchCotizaciones]
    L --> M[UI actualizada]
    J --> N[setRecalculandoCotizacion = null]
    M --> N
```

---

## Soporte y Debugging

**Si no funciona:**

1. Verificar que la cotización existe en BD
2. Verificar que existen precios en `listas_precios` para esas edades/tipos
3. Revisar logs del servidor: `backend/logs/`
4. Verificar token de autenticación
5. Comprobar que la promoción existe y está activa

**Logs útiles:**
```javascript
console.log('🔄 Recalculando cotización:', cotizacionId);
console.log('✅ Detalles encontrados:', detallesActuales.length);
console.log('💰 Nuevo total bruto:', totalBruto);
```

---

**Fecha de implementación:** 27 de enero de 2026  
**Versión:** 1.0  
**Estado:** ✅ Producción
