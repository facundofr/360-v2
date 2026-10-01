# 🚀 GUÍA RÁPIDA - MÓDULO REFRITOS

## ¿Qué es?

**Refritos** = Campaña de reciclado de datos. Carga prospectos antiguos, distribúyelos entre vendedores automáticamente, y reasígnalos cuando no los contacten.

---

## ✅ Estado Actual

**Backend**: ✅ COMPLETAMENTE IMPLEMENTADO  
**BD**: ✅ LISTA (columna `es_reciclado` agregada)  
**Documentación**: ✅ COMPLETA  
**Frontend**: ⏳ PENDIENTE (ver sección "Frontend")

---

## 📂 ARCHIVOS BACKEND CREADOS

```
backend/
├── models/admin/
│   └── refritosModel.js          ✅ Lógica de refritos
├── controllers/admin/
│   └── refritosController.js     ✅ Endpoints
└── routes/admin/
    └── refritosRoutes.js          ✅ Rutas
```

---

## 📡 ENDPOINTS DISPONIBLES

```bash
# Cargar archivo
POST /admin/refritos/cargar
Body: FormData { archivo: file.csv }

# Reasignar a otro vendedor
POST /admin/refritos/reasignar
Body: { prospectoId: 5234 }

# Eliminar del flujo
POST /admin/refritos/eliminar-flujo
Body: { prospectoId: 5234 }

# Obtener historial
GET /admin/refritos/historial/5234

# Ver estadísticas
GET /admin/refritos/estadisticas

# Refritos de un vendedor
GET /admin/refritos/vendedor/12
```

---

## 📊 ESTRUCTURA DEL ARCHIVO CSV

**Columnas obligatorias:**
- `nombre` - Nombre del prospecto
- `apellido` - Apellido del prospecto
- `numero_contacto` - Teléfono (ej: +541173931525)
- `localidad` - Ciudad/localidad
- `tipo_afiliacion_id` - 1, 2 o 3 (ver tabla abajo)

**Columnas opcionales:**
- `edad` - Edad (0-120)
- `correo` - Email
- `sueldo_bruto` - Sueldo anual/mensual
- `categoria_monotributo` - A, B, C, D, E, F, G, H, I, J, K
- `comentario` - Notas

### Tipos de afiliación:
```
1 = Particular/Autónomo
2 = Con Recibo de Sueldo
3 = Monotributista
```

### Ejemplo de CSV:
```csv
nombre,apellido,numero_contacto,localidad,edad,tipo_afiliacion_id,correo
Juan,Pérez,+541173931525,Buenos Aires,35,2,juan@email.com
María,García,223-456-7890,La Plata,28,1,maria@email.com
Carlos,López,0223987654,Mar del Plata,42,3,carlos@email.com
```

**→ Ver archivo completo**: `/docs/ejemplo_refritos.csv`

---

## 🔄 FLUJO DE TRABAJO

### 1️⃣ Admin carga archivo
```
Admin → Cargar CSV → Validar datos → Crear prospectos
```

### 2️⃣ Sistema distribuye automáticamente
```
Cada prospecto → Asignar a vendedor (round-robin) → Notificar vendedor
```

### 3️⃣ Vendedor recibe refrito
```
Vendedor ve badge "♻️ RECICLADO" → 
Intenta contactar →
Si marca "No contesta" → Reasignar a otro vendedor
```

### 4️⃣ Después de pasar por todos los vendedores
```
Si TODOS marcan "No contesta" → Eliminar del flujo
```

---

## 📋 DOCUMENTACIÓN COMPLETA

| Archivo | Descripción |
|---------|-------------|
| `/docs/REFRITOS_DOCUMENTACION.md` | Documentación completa + endpoints + validaciones |
| `/docs/REFRITOS_INTEGRACION_FRONTEND.md` | Cómo integrar en frontend + ejemplos React |
| `/docs/REFRITOS_IMPLEMENTACION_COMPLETA.md` | Resumen técnico de todo lo implementado |
| `/docs/ejemplo_refritos.csv` | 15 ejemplos listos para usar |

---

## 🧪 TESTING RÁPIDO

### 1. Descargar ejemplo
```bash
cp /var/www/cober360/docs/ejemplo_refritos.csv ~/Downloads/
```

### 2. Cargar en API (curl)
```bash
curl -X POST http://localhost:4000/admin/refritos/cargar \
  -H "Authorization: Bearer <token_admin>" \
  -F "archivo=@ejemplo_refritos.csv"
```

### 3. Ver estadísticas
```bash
curl http://localhost:4000/admin/refritos/estadisticas \
  -H "Authorization: Bearer <token_admin>"
```

### 4. Ver refritos de un vendedor
```bash
curl http://localhost:4000/admin/refritos/vendedor/12 \
  -H "Authorization: Bearer <token_admin>"
```

---

## 🎨 FRONTEND - PRÓXIMOS PASOS

### 1. Crear componentes React

**Ubicación recomendada:**
```
frontend/src/pages/admin/refritos/
├── CargarRefritos.jsx          # Subir archivo
├── EstadisticasRefritos.jsx    # Dashboard
└── HistoricoRefritos.jsx       # Auditoría
```

**Ver ejemplos**: `/docs/REFRITOS_INTEGRACION_FRONTEND.md`

### 2. Agregar al sidebar

```jsx
{
  icon: '🥚',
  label: 'Refritos',
  path: '/admin/refritos',
  submenu: [
    { label: 'Cargar archivo', path: '/admin/refritos/cargar' },
    { label: 'Estadísticas', path: '/admin/refritos/estadisticas' }
  ]
}
```

### 3. Agregar badges visuales

En la tarjeta del prospecto:
```jsx
{prospecto.es_reciclado && (
  <span className="badge bg-warning">♻️ RECICLADO</span>
)}
```

### 4. Agregar acciones

En panel del vendedor:
```jsx
<button onClick={() => reasignarRefrito(prospecto.id)}>
  🔄 Reasignar
</button>
```

---

## 🔐 PERMISOS

- ✅ Solo **admins** pueden:
  - Cargar refritos
  - Ver estadísticas
  - Reasignar manualmente
  - Ver histórico

- ✅ **Vendedores** pueden:
  - Ver refritos asignados (con badge)
  - Cambiar estado
  - Reasignación automática al marcar "No contesta"

---

## 🔍 VALIDACIONES

Se valida:
- ✅ Nombre (2-50 caracteres, letras)
- ✅ Apellido (2-50 caracteres, letras)
- ✅ Teléfono (8-20 caracteres, normaliza a WhatsApp)
- ✅ Localidad (2-100 caracteres)
- ✅ Email (formato válido)
- ✅ Edad (0-120)
- ✅ Tipo afiliación (1, 2, 3)
- ✅ Sueldo (número positivo)
- ✅ Categoría monotributo (A-K)

**NO se valida:**
- ❌ Duplicados (intencional, permite reciclado)

---

## ⚠️ CONSIDERACIONES

1. **Edad > 65**: No se cotiza ni se autoasigna (igual que leads)
2. **Duplicados omitidos**: Permite reciclado de datos antiguos
3. **Cotización automática**: Cada refrito se cotiza al ingresarse
4. **Historial completo**: Se mantiene registro de todas las asignaciones
5. **Round-robin**: Distribución equitativa entre vendedores
6. **Notificaciones FCM**: El vendedor recibe notificación al ser asignado

---

## 📊 DATOS GENERADOS AUTOMÁTICAMENTE

Cuando se carga un refrito:
- ✅ Se crea en tabla `prospectos` con `es_reciclado = true`
- ✅ Se asigna en tabla `asignaciones`
- ✅ Se genera cotización en tabla `cotizaciones`
- ✅ Se notifica al vendedor (FCM)
- ✅ Se guarda `origen = 'Refrito - Campaña'`

---

## 🐛 TROUBLESHOOTING

**Error: "No hay vendedores activos"**
→ Verificar que hay vendedores con `rol='vendedor'` y `estado=1`

**Error: "Archivo no válido"**
→ Usar CSV o XLSX, verificar extensión

**Error: "Campos faltantes"**
→ Ver tabla de estructura arriba, columnas obligatorias

**Error: "Teléfono inválido"**
→ Teléfono debe tener 8+ dígitos, ej: +541173931525

**Error: "Tipo afiliación inválido"**
→ Usar 1, 2 o 3

---

## 📞 SOPORTE

- **Documentación completa**: `/docs/REFRITOS_DOCUMENTACION.md`
- **Integración frontend**: `/docs/REFRITOS_INTEGRACION_FRONTEND.md`
- **Implementación técnica**: `/docs/REFRITOS_IMPLEMENTACION_COMPLETA.md`
- **Archivo de ejemplo**: `/docs/ejemplo_refritos.csv`

---

## ✅ CHECKLIST

Backend:
- [x] Modelo creado y funcional
- [x] Controlador creado
- [x] Rutas registradas
- [x] BD actualizada
- [x] Integración en server.js
- [x] Dependencias instaladas
- [x] Documentación completa

Frontend (próximo):
- [ ] Componentes React
- [ ] Integración en sidebar
- [ ] Badges visuales
- [ ] Acciones en vendedor
- [ ] Testing

---

**¿Listo para empezar?** ✅

1. Descargar ejemplo: `ejemplo_refritos.csv`
2. Cargarlo en la API
3. Ver estadísticas
4. Empezar con componentes frontend

¡Éxito! 🚀
