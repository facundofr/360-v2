# 📋 DOCUMENTACIÓN DEL MÓDULO REFRITOS

## 🎯 ¿Qué es el módulo Refritos?

El módulo **Refritos** es una campaña de **reciclado de datos** dentro del sistema Cober360. Permite cargar un archivo CSV o XLSX con prospectos que ya han sido contactados anteriormente, distribuirlos equitativamente entre todos los vendedores activos, y rastrear su progresión a través de múltiples intentos de contacto.

### Características principales:

✅ **Carga masiva**: Importar datos desde archivos CSV o XLSX  
✅ **Distribución automática**: Round-robin entre vendedores activos  
✅ **Marcado como reciclado**: Badge visual en la tarjeta del prospecto  
✅ **Reasignación automática**: Si un vendedor marca "No contesta", se reasigna al siguiente vendedor  
✅ **Eliminación del flujo**: Después de pasar por todos los vendedores sin contacto  
✅ **Historial completo**: Rastrear todas las asignaciones y cambios de estado  
✅ **Estadísticas**: Monitorear el desempeño de la campaña  

---

## 📊 ESTRUCTURA DEL ARCHIVO CSV/XLSX

El archivo debe incluir **al menos las siguientes columnas obligatorias**. Puedes agregar columnas opcionales si están disponibles.

### Columnas Obligatorias:

| Columna | Tipo | Longitud | Descripción | Ejemplo |
|---------|------|----------|-------------|---------|
| `nombre` | Texto | 2-50 caracteres | Nombre del prospecto | Juan |
| `apellido` | Texto | 2-50 caracteres | Apellido del prospecto | Pérez |
| `edad` | Número | 1-120 | Edad del prospecto | 35 |
| `numero_contacto` | Texto | 8-20 caracteres | Teléfono/WhatsApp | +541173931525 o 11 7393-1525 |
| `correo` | Email | válido | Correo electrónico | juan@example.com |
| `localidad` | Texto | 2-100 caracteres | Ciudad/localidad | Buenos Aires |

### Columnas Opcionales:

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `tipo_afiliacion_id` | Número | Si no se envía, se usa 1 = Particular/Autónomo | 1 |
| `sueldo_bruto` | Número | Sueldo bruto anual/mensual | 50000 |
| `categoria_monotributo` | Texto | Categoría (si es monotributista) | A, B, C, D, etc. |
| `comentario` | Texto | Notas adicionales | Interesado en cobertura médica |

---

## 🏢 TABLA DE TIPOS DE AFILIACIÓN

| ID | Tipo | Descripción |
|----|------|-------------|
| 1 | Particular/Autónomo | Sin relación de dependencia |
| 2 | Con Recibo de Sueldo | Empleado en relación de dependencia |
| 3 | Monotributista | Monotributo |

---

## 📝 EJEMPLO DE ARCHIVO CSV

```csv
nombre,apellido,numero_contacto,localidad,edad,tipo_afiliacion_id,correo,sueldo_bruto,categoria_monotributo,comentario
Juan,Pérez,+541173931525,Buenos Aires,35,2,juan@email.com,50000,,Interesado en cobertura médica
María,García,223-456-7890,La Plata,28,1,maria@email.com,,,Llamar después de las 18
Carlos,López,0223987654,Mar del Plata,42,3,carlos@email.com,,B,Es monotributista
Ana,Martínez,1147382910,CABA,55,2,ana@email.com,75000,,Prefiere WhatsApp
```

---

## 📝 EJEMPLO DE ARCHIVO XLSX

El archivo XLSX debe tener **una única hoja** con los mismos datos. Las columnas pueden estar en cualquier orden, siempre que tengan los nombres exactos.

---

## 🚀 CÓMO USAR EL MÓDULO

### 1️⃣ Acceder al módulo

En el sidebar del admin, buscar la opción **"Refritos"** 

### 2️⃣ Cargar archivo

1. Click en **"Cargar archivo"**
2. Seleccionar un archivo CSV o XLSX
3. El sistema validará cada fila:
   - ✅ Si todos los datos son válidos → Se ingresa en la BD como "Lead" marcado como reciclado
   - ❌ Si hay errores → Se muestra el error específico para esa fila
  - ❌ Si faltan columnas obligatorias → El backend responde 400 con `columnas_faltantes` indicando cuáles faltan
4. Ver resumen de importación (exitosos, errores)

### 3️⃣ Distribución automática

Después de cargar:
- Cada prospecto se distribuye a un vendedor diferente (round-robin)
- Se genera una cotización automática
- Se crea un registro en la tabla `asignaciones`
- El prospecto aparece en el panel del vendedor con badge **"♻️ RECICLADO"**

### 4️⃣ Flujo de contacto

**Cuando el vendedor recibe un refrito:**
- ✅ Si lo contacta → Sigue el flujo normal (Lead → Contacto → etc.)
- ❌ Si marca como "No contesta" → 
  - Sistema reasigna automáticamente al siguiente vendedor
  - Se mantiene un historial de intentos
  - Si ha pasado por TODOS los vendedores sin contacto → Se marca como "No contesta" y se elimina

---

## 📊 VALIDACIONES Y REGLAS

### Validación de datos:

1. **Nombre y Apellido**
   - Mínimo 2 caracteres
   - Máximo 50 caracteres
   - Solo letras, espacios y caracteres acentuados
   - No se permiten números ni caracteres especiales

2. **Número de contacto**
   - Mínimo 8 caracteres
   - Máximo 20 caracteres
   - Se normaliza automáticamente para WhatsApp Argentina
   - Formatos aceptados:
     - `+541173931525` (con código de país)
     - `223456789` (sin código de país, se agrega 54)
     - `0223456789` (con 0 inicial, se convierte a formato internacional)
     - `11 7393-1525` (con espacios y guiones, se limpian)

3. **Localidad**
   - Mínimo 2 caracteres
   - Máximo 100 caracteres

4. **Correo (obligatorio)**
  - Debe ser un email válido
  - Se normaliza automáticamente

5. **Edad (obligatoria)**
  - Debe ser un número entre 1 y 120

6. **Tipo de afiliación**
  - Si no se envía, se usa por defecto `1 = Particular/Autónomo`
  - Válidos: 1, 2 o 3
  - Define cómo se calcula el descuento de aporte

7. **Sueldo bruto (opcional)**
   - Debe ser un número positivo
   - Se usa para calcular descuento si tipo_afiliacion_id = 2

8. **Categoría monotributo (opcional)**
   - Válidas: A, B, C, D, E, F, G, H, I, J, K, "A exento", "B exento"
   - Solo se valida si tipo_afiliacion_id = 3

### Reglas especiales:

- ✅ **No se bloquea por duplicados**: Si el contacto ya existe (por número normalizado), no se inserta un nuevo prospecto. Se reutiliza el existente, se marca `es_reciclado = 1` y se establece `origen = 'Refrito - Reasignación'` si estaba vacío, y se crea una nueva asignación por round-robin.
- ✅ **Se marcan como reciclados**: Campo `es_reciclado = true` en BD (tanto nuevos como duplicados)
- 📊 **Se genera cotización automática**: Para ingresos nuevos. En duplicados no se vuelve a cotizar.
- 🔄 **Origen**: Nuevos registran `origen = 'Refrito - Campaña'`. Duplicados registran `origen = 'Refrito - Reasignación'` si no tenían origen.

---

## 🗄️ MODIFICACIONES EN LA BASE DE DATOS

### Nueva columna en tabla `prospectos`:

```sql
ALTER TABLE prospectos ADD COLUMN es_reciclado BOOLEAN DEFAULT FALSE;
```

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `es_reciclado` | BOOLEAN | FALSE | Indica si el prospecto fue ingresado como reciclado |

### Campo `origen` ya existente:

Cuando se carga un refrito nuevo:
- `origen = 'Refrito - Campaña'`

Cuando el contacto ya existía y se reasigna por refrito (duplicado):
- `origen = 'Refrito - Reasignación'` (solo si estaba vacío)

---

## 📡 ENDPOINTS DE LA API

### 1. Cargar archivo de refritos

```http
POST /admin/refritos/cargar
Content-Type: multipart/form-data

archivo: <file.csv o file.xlsx>
```

**Response exitoso:**
```json
{
  "message": "Archivo procesado exitosamente",
  "resultados": {
    "exitosos": [
      {
        "fila": 1,
        "prospectoId": 5234,
        "nombre": "Juan",
        "apellido": "Pérez",
        "vendedorAsignado": "Carlos Gómez",
        "vendedorId": 12,
        "estado": "Ingresado como Reciclado"
      }
    ],
    "errores": [
      {
        "fila": 2,
        "nombre": "María",
        "errores": ["Número de contacto inválido"]
      }
    ],
    "totalProcesados": 1
  },
  "resumen": {
    "totalProcesados": 1,
    "exitosos": 1,
    "errores": 1
  }
}
```

### 2. Reasignar refrito no contactado

```http
POST /admin/refritos/reasignar
Content-Type: application/json

{
  "prospectoId": 5234
}
```

**Response:**
```json
{
  "message": "Refrito reasignado exitosamente",
  "resultado": {
    "prospectoId": 5234,
    "vendedorAnterior": 12,
    "vendedorNuevo": 14,
    "mensaje": "Refrito reasignado exitosamente al vendedor 14"
  }
}
```

### 3. Eliminar refrito del flujo

```http
POST /admin/refritos/eliminar-flujo
Content-Type: application/json

{
  "prospectoId": 5234
}
```

**Response:**
```json
{
  "message": "Refrito eliminado del flujo",
  "prospectoId": 5234
}
```

### 4. Obtener historial de asignaciones

```http
GET /admin/refritos/historial/5234
```

**Response:**
```json
{
  "prospectoId": 5234,
  "historial": [
    {
      "id": 1,
      "id_vendedor": 12,
      "vendedor": "Carlos Gómez",
      "estado": "Lead",
      "fecha_asignacion": "2026-01-14T10:30:00",
      "comentario": "Refrito - Campaña de reciclado"
    },
    {
      "id": 2,
      "id_vendedor": 14,
      "vendedor": "Ana Rodríguez",
      "estado": "Lead",
      "fecha_asignacion": "2026-01-14T11:15:00",
      "comentario": "Reasignado - No contactado en intento anterior"
    }
  ]
}
```

### 5. Obtener estadísticas de refritos

```http
GET /admin/refritos/estadisticas
```

**Response:**
```json
{
  "message": "Estadísticas de refritos",
  "estadisticas": {
    "total_refritos": 150,
    "pendientes": 45,
    "ventas": 12,
    "sin_contacto": 87,
    "contactados": 6
  }
}
```

### 6. Obtener refritos asignados a un vendedor

```http
GET /admin/refritos/vendedor/12
```

**Response:**
```json
{
  "vendedorId": 12,
  "totalRefritos": 5,
  "refritos": [
    {
      "id": 5234,
      "nombre": "Juan",
      "apellido": "Pérez",
      "numero_contacto": "+541173931525",
      "correo": "juan@example.com",
      "localidad": "Buenos Aires",
      "estado": "Lead",
      "es_reciclado": true,
      "fecha_asignacion": "2026-01-14T10:30:00",
      "intentos_asignacion": 1
    }
  ]
}
```

### 7. Listar todos los refritos (asignación actual)

```http
GET /admin/refritos/listar
```

**Response:**
```json
{
  "total": 2,
  "refritos": [
    {
      "id": 5234,
      "nombre": "Juan",
      "apellido": "Pérez",
      "numero_contacto": "+541173931525",
      "correo": "juan@example.com",
      "localidad": "Buenos Aires",
      "estado": "Lead",
      "id_vendedor": 12,
      "vendedor": "Carlos Gómez",
      "fecha_asignacion": "2026-01-14T10:30:00"
    }
  ]
}
```

---

## 🖼️ UI/SIDEBAR

En el sidebar del admin, agregar opción:

```
├── Admin
│   ├── Dashboard
│   ├── Vendedores
│   ├── Supervisores
│   ├── 🥚 Refritos          ← NUEVA OPCIÓN
│   │   ├── Cargar archivo
│   │   ├── Estadísticas
│   │   └── Ver histórico
│   ├── Categorías
│   ├── Lista de Precios
│   └── ...
```

**Icono**: 🥚 (huevo reciclado)

---

## ⚠️ CONSIDERACIONES IMPORTANTES

1. **Omisión de duplicados**: Los refritos ignoran la validación de duplicados. Esto es **intencional** para permitir reciclado de datos antiguos.

2. **Distribución equitativa**: El sistema usa **round-robin** para distribuir equitativamente entre vendedores.

3. **Edad > 65**: 
   - Si el refrito tiene edad > 65, **NO se autoasigna** y **NO se cotiza** (igual que leads normales)
   - Se puede reasignar manualmente

4. **Cotización automática**: Cada refrito genera automáticamente una cotización al ser ingresado.

5. **Historial completo**: Se mantiene un registro de TODAS las asignaciones para auditoría y seguimiento.

6. **Email de notificación**: Al vendedor le llega notificación (FCM) cuando se le asigna un refrito.

7. **Eliminación del flujo**: Solo se elimina después de pasar por TODOS los vendedores sin contacto.

---

## 🔍 TROUBLESHOOTING

### Error: "Solo se permiten archivos CSV, XLSX o XLS"
- Verificar que el archivo tiene la extensión correcta
- Renombrar si es necesario

### Error: "No hay vendedores activos disponibles"
- Verificar que hay vendedores con:
  - `rol = 'vendedor'`
  - `estado = 1` (activo)
  - `activo = 1`

### Error: "Teléfono duplicado" / "Email duplicado"
- En refritos no se bloquea por duplicado: se reutiliza el prospecto, se marca como reciclado y se reasigna.
- Si aparece este error, revisar la normalización del número y el formato del email.

### Los refritos no aparecen en el panel del vendedor
- Verificar que la asignación se creó correctamente
- Revisar `tabla asignaciones`
- Verificar que `es_reciclado = true` en `tabla prospectos`

---

## 📞 SOPORTE

Para reportar problemas o solicitudes de mejora:
- Equipo de desarrollo: backend@cober360.com
- Documentación: Ver archivo REFRITOS_INTEGRACION.md
