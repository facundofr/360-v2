# Fix: Cotización no se muestra correctamente en EditarPolizaModal

## Problema

En `EditarPolizaModal`, el paso **Datos Personales** (`PasoDatosPersonales`) no muestra
correctamente la tarjeta de cotización (plan, precio, promoción, grupo familiar) ni
auto-completa `porcentaje_promocion` y `forma_pago`, porque el estado `cotizacionInfo`
se construye con solo 3 campos en lugar del objeto completo que espera el componente.

`PasoDatosPersonales` necesita:
- `total_final`, `total_bruto`, `total_descuento_promocion` → para mostrar la tarjeta
- `detalles` (array de `cotizaciones_detalles`) → para mostrar grupo familiar y
  auto-completar `porcentaje_promocion` extrayendo el % del campo `promocion_aplicada`
- `tipo_afiliacion_id` / `tipo_afiliacion` → para detectar si es Particular y ocultar
  campos de empresa

Además, los endpoints de **supervisor** y **backoffice** devuelven una respuesta
**anidada** (`polizaData.cotizacion.total_final`, `polizaData.plan.nombre`,
`polizaData.prospecto.tipo_afiliacion_id`), mientras que el de **vendedor** devuelve
una respuesta **plana** (`polizaData.total_final`, `polizaData.plan_nombre`). El
frontend debe soportar ambas estructuras.

---

## Archivos a modificar

| Archivo | Rol |
|---|---|
| `backend/controllers/poliza/polizaVendedorController.js` | Endpoint vendedor `obtenerParaEditar` |
| `backend/controllers/supervisor/polizasController.js` | Endpoint supervisor `obtenerPolizaParaEdicion` |
| `backend/controllers/backoffice/polizasBackOfficeController.js` | Endpoint backoffice `obtenerPolizaParaEdicion` |
| `frontend/src/components/features/vendedor/modals/EditarPolizaModal.jsx` | Modal de edición (todos los roles) |

---

## Cambio 1 — Vendedor controller (`polizaVendedorController.js`)

**Función**: `obtenerParaEditar`  
**Dónde**: justo antes del `res.json(...)` final, después de verificar permisos.

Agregar una query adicional para obtener los detalles de la cotización y adjuntarlos
al objeto `poliza` antes de devolverlo:

```js
// Después de: const poliza = await PolizaModel.obtenerCompleta(id);
// Después de: verificar poliza.created_by === vendedor_id

if (poliza.cotizacion_id) {
  try {
    const [detalles] = await db.execute(`
      SELECT 
        cd.id,
        cd.persona,
        cd.vinculo,
        cd.edad,
        cd.tipo_afiliacion_id,
        cd.precio_base,
        cd.descuento_aporte,
        cd.descuento_promocion,
        cd.promocion_aplicada,
        cd.precio_final
      FROM cotizaciones_detalles cd
      WHERE cd.cotizacion_id = ?
      ORDER BY cd.id
    `, [poliza.cotizacion_id]);
    poliza.cotizacion_detalles = detalles;
  } catch (e) {
    console.warn('No se pudieron cargar detalles de cotización:', e.message);
    poliza.cotizacion_detalles = [];
  }
}

// Luego el res.json() existente (sin cambios)
res.json({ success: true, data: poliza });
```

> **Nota**: La tabla `cotizaciones_detalles` NO tiene columna `porcentaje_promocion`.
> Solo tiene `descuento_promocion` (decimal) y `promocion_aplicada` (varchar).
> El frontend extrae el % desde el texto de `promocion_aplicada` (ej: "Descuento 35%").

---

## Cambio 2 — Supervisor controller (`polizasController.js`)

**Función**: `obtenerPolizaParaEdicion`  
**Dónde**: después de `const poliza = polizas[0];`, antes de parsear campos JSON.

Agregar la misma query de detalles:

```js
// Después de: const poliza = polizas[0];

// Cargar detalles de cotización para EditarPolizaModal
let cotizacionDetalles = [];
if (poliza.cotizacion_id) {
  try {
    const [detalles] = await db.execute(`
      SELECT 
        cd.id, cd.persona, cd.vinculo, cd.edad, cd.tipo_afiliacion_id,
        cd.precio_base, cd.descuento_aporte, cd.descuento_promocion,
        cd.promocion_aplicada, cd.precio_final
      FROM cotizaciones_detalles cd
      WHERE cd.cotizacion_id = ?
      ORDER BY cd.id
    `, [poliza.cotizacion_id]);
    cotizacionDetalles = detalles;
  } catch (e) {
    console.warn('No se pudieron cargar detalles de cotización:', e.message);
  }
}

// Luego sigue el parseo de camposJson... (sin cambios)
```

Y en el objeto `polizaCompleta`, agregar `detalles` al objeto `cotizacion`:

```js
// Buscar este bloque en polizaCompleta:
cotizacion: {
  total_final: poliza.total_final,
  total_bruto: poliza.total_bruto,
  total_descuento_aporte: poliza.total_descuento_aporte,
  total_descuento_promocion: poliza.total_descuento_promocion
},

// Reemplazar por:
cotizacion: {
  total_final: poliza.total_final,
  total_bruto: poliza.total_bruto,
  total_descuento_aporte: poliza.total_descuento_aporte,
  total_descuento_promocion: poliza.total_descuento_promocion,
  detalles: cotizacionDetalles   // ← agregar esta línea
},
```

---

## Cambio 3 — Backoffice controller (`polizasBackOfficeController.js`)

**Función**: `obtenerPolizaParaEdicion`  
**Cambios**: idénticos al Cambio 2 (mismo patrón, misma ubicación).

---

## Cambio 4 — Frontend `EditarPolizaModal.jsx`

**Función**: `cargarDatosParaEditar`  
**Dónde**: el bloque `setCotizacionInfo({...})` al final de la función.

Reemplazar el `setCotizacionInfo` existente por uno que:
1. Use fallback para manejar estructura plana (vendedor) y anidada (supervisor/backoffice)
2. Incluya todos los campos que `PasoDatosPersonales` necesita

```jsx
// Antes del setDataLoadKey(prev => prev + 1)

const cot = polizaData.cotizacion || {};      // anidado (supervisor/backoffice)
const prosp = polizaData.prospecto || {};     // anidado (supervisor/backoffice)

setCotizacionInfo({
  id: polizaData.cotizacion_id,

  // tipo_afiliacion: plano (vendedor) o anidado en prospecto (supervisor/backoffice)
  tipo_afiliacion_id:        polizaData.tipo_afiliacion_id        || prosp.tipo_afiliacion_id,
  tipo_afiliacion_nombre:    polizaData.tipo_afiliacion_nombre    || prosp.tipo_afiliacion_nombre,
  tipo_afiliacion:           polizaData.tipo_afiliacion_nombre    || prosp.tipo_afiliacion_nombre,

  // plan: plano (vendedor) o anidado en plan (supervisor/backoffice)
  plan_nombre: polizaData.plan_nombre || polizaData.plan?.nombre,

  // totales: plano (vendedor) o anidado en cotizacion (supervisor/backoffice)
  total_final:               polizaData.total_final               ?? cot.total_final,
  total_bruto:               polizaData.total_bruto               ?? cot.total_bruto,
  total_descuento_aporte:    polizaData.total_descuento_aporte    ?? cot.total_descuento_aporte,
  total_descuento_promocion: polizaData.total_descuento_promocion ?? cot.total_descuento_promocion,

  // detalles de cotizaciones_detalles:
  // vendedor   → polizaData.cotizacion_detalles (campo plano adjuntado por el backend)
  // supervisor/backoffice → cot.detalles (dentro del objeto cotizacion anidado)
  detalles: polizaData.cotizacion_detalles || cot.detalles || []
});
```

---

## Verificación

1. Abrir `EditarPolizaModal` como **vendedor** → la tarjeta de cotización debe mostrar
   plan, precio final y descuento de promoción.
2. Abrir como **supervisor** o **backoffice** → misma tarjeta visible.
3. Si la cotización tiene promoción (ej: "Descuento 35%"), el campo
   `porcentaje_promocion` de Datos Personales debe auto-completarse.
4. Si hay más de 1 integrante en `cotizaciones_detalles`, debe aparecer el bloque
   "Grupo Familiar" con los vínculos.
5. `esParticular` debe detectarse correctamente y ocultar/mostrar los campos de empresa.
