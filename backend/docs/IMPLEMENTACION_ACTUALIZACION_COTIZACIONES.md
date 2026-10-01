# Resumen: Funcionalidad de Actualización de Cotizaciones

## ✅ Implementado

### 1. **Backend** - Nuevo Endpoint
**Archivo:** `backend/controllers/cotizaciones/cotizacionesController.js`

✨ Nueva función: `recalcularCotizacion(req, res)`
- Recalcula precios con valores actuales
- Aplica promociones vigentes
- Actualiza todos los detalles e integrantes
- Usa transacciones SQL para seguridad
- Retorna nuevos totales

**Ruta:** `POST /api/cotizaciones/{cotizacionId}/recalcular`

---

### 2. **Frontend** - Nuevo Componente
**Archivo:** `frontend/src/components/features/vendedor/ProspectoDetalle.jsx`

✨ Nueva función: `handleRecalcularCotizacion(cotizacion)`
- Solicita confirmación al usuario
- Muestra spinner de carga
- Llama al endpoint del backend
- Muestra resultados con nuevos totales
- Recarga cotizaciones automáticamente

✨ Nuevo estado: `recalculandoCotizacion`
- Controla qué cotización se está recalculando
- Desactiva el botón durante procesamiento

✨ Nuevo botón en interfaz
- Ubicación: En cada tarjeta de cotización
- Etiqueta: "Actualizar Precios"
- Color: Azul (info)
- Icono: FaEdit
- Tooltip: "Actualizar precios con valores actuales del sistema"

---

## 📊 Flujo de Datos

```
Usuario en Prospecto
    ↓
Ve cotización antigua
    ↓
Clic en "Actualizar Precios"
    ↓
Modal de confirmación
    ↓ (Confirmar)
POST /cotizaciones/{id}/recalcular
    ↓
Backend recalcula:
  • Obtiene precios actuales de listas_precios
  • Aplica promociones vigentes
  • Recalcula cada integrante
  • Actualiza totales
    ↓
Respuesta con nuevos totales
    ↓
Frontend muestra resultado
    ↓
Recarga cotizaciones
    ↓
UI actualizada ✅
```

---

## 🔧 Cambios Específicos

### Backend Changes

**Archivo:** `backend/routes/cotizaciones/cotizaciones.js`
```javascript
// Antes:
const { listarCotizaciones, listarTodasLasCotizaciones, aplicarLey19032 } = require(...);

// Después:
const { listarCotizaciones, listarTodasLasCotizaciones, aplicarLey19032, recalcularCotizacion } = require(...);

// Nueva ruta:
router.post("/:cotizacionId/recalcular", authenticateToken, recalcularCotizacion);
```

**Archivo:** `backend/controllers/cotizaciones/cotizacionesController.js`
```javascript
// Agregada función completa de recalcularCotizacion con:
// - Validación de cotización
// - Obtención de detalles
// - Búsqueda de precios actuales
// - Aplicación de promociones
// - Actualización de base de datos
// - Manejo de errores con transacciones
```

---

### Frontend Changes

**Archivo:** `frontend/src/components/features/vendedor/ProspectoDetalle.jsx`

1. **Nuevo estado (línea ~67):**
```javascript
const [recalculandoCotizacion, setRecalculandoCotizacion] = useState(null);
```

2. **Nueva función (línea ~318):**
```javascript
const handleRecalcularCotizacion = async (cotizacion) => {
  // Confirmación
  // Loading
  // API call
  // Mostrar resultado
  // Recargar
}
```

3. **Nuevo botón (línea ~1220):**
```javascript
<OverlayTrigger placement="top" overlay={<Tooltip>...}>
  <Button
    variant="info"
    size="sm"
    onClick={() => handleRecalcularCotizacion(cotizacion)}
    disabled={recalculandoCotizacion === cotizacion.id}
  >
    {recalculandoCotizacion === cotizacion.id ? (
      <>
        <Spinner animation="border" size="sm" className="me-1" />
        Actualizando...
      </>
    ) : (
      <>
        <FaEdit className="me-1" />
        Actualizar Precios
      </>
    )}
  </Button>
</OverlayTrigger>
```

---

## 🎯 Casos de Uso

### Caso 1: Cotización Antigua
- Prospecto con cotización de noviembre con precios desactualizados
- Usuario hace clic en "Actualizar Precios"
- Sistema recalcula con precios actuales de enero
- Nuevos totales se muestran al usuario

### Caso 2: Cambio de Precios
- Acaban de actualizar precios base de planes
- Prospectos con cotizaciones antiguas pueden actualizarlas
- Sin necesidad de cotizar nuevamente

### Caso 3: Nueva Promoción
- Se agrega nueva promoción a prospecto
- Próxima actualización refleja la new promoción
- Cálculos incluyen descuentos vigentes

---

## 📈 Validaciones

✅ **Backend:**
- Cotización debe existir
- Debe tener al menos un detalle
- Usuario debe estar autenticado
- Transacción SQL garantiza integridad

✅ **Frontend:**
- Solicita confirmación antes de cambiar datos
- Desactiva botón durante procesamiento
- Valida respuesta del servidor
- Maneja errores de red

---

## 🚀 Prueba Rápida

1. **Prospecto con cotización:** Jorge GOMEZ (ID: 4694)
2. **Cotizaciones:** 18868, 18869, 18870, 18871
3. **Pasos:**
   - Ir a ProspectoDetalle/4694
   - Ver cotizaciones
   - Clic en "Actualizar Precios"
   - Confirmar
   - Ver nuevos totales

---

## 📝 Documentación

Ver: `/docs/ACTUALIZACION_COTIZACIONES.md` para documentación completa

---

## ⚠️ Notas Importantes

- Mantiene estructura original de integrantes
- Aplica promociones vigentes automáticamente
- Usa transacciones para garantizar consistencia
- Requiere autenticación
- Retorna detalles de cambios en respuesta

---

**Implementación completada:** ✅ 27 de enero de 2026
**Archivos modificados:** 3
**Nuevas funciones:** 2 (1 backend, 1 frontend)
**Nuevas rutas:** 1
**Nuevo estado:** 1
**Errores detectados:** 0
