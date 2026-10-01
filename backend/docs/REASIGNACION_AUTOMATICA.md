# 🔄 Sistema de Reasignación Automática de Prospectos

## 📋 Descripción General

Sistema automatizado para reasignar prospectos que **no tienen actividad** en horario laboral (lunes a viernes, 9-18 hrs) durante **más de 4 horas**.

## 🏗️ Arquitectura

### Componentes Principales

```
backend/
├── models/
│   └── ReAsignacionAutomatica.js      # Lógica de datos y consultas
├── services/
│   └── ReasignacionService.js         # Orquestación del servicio
├── jobs/
│   └── ReasignacionAutomaticaJob.js   # Job CRON que ejecuta automáticamente
├── routes/
│   └── reasignaciones.js              # API endpoints
└── migrations/
    └── create_reasignacion_auditoria.js  # Migración de BD
```

## 🗄️ Tabla de Base de Datos

### `reasignacion_auditoria`

```sql
CREATE TABLE reasignacion_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_prospecto INT NOT NULL,
  id_vendedor_anterior INT,
  id_vendedor_nuevo INT NOT NULL,
  motivo VARCHAR(255),
  fecha_reasignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  razon_automatica VARCHAR(255),
  FOREIGN KEY (id_prospecto) REFERENCES prospectos(id),
  FOREIGN KEY (id_vendedor_anterior) REFERENCES usuarios(id),
  FOREIGN KEY (id_vendedor_nuevo) REFERENCES usuarios(id),
  INDEX idx_prospecto (id_prospecto),
  INDEX idx_fecha (fecha_reasignacion)
);
```

**Campos:**
- `id_prospecto`: ID del prospecto reasignado
- `id_vendedor_anterior`: Vendedor que tenía el prospecto
- `id_vendedor_nuevo`: Nuevo vendedor asignado
- `motivo`: Razón de la reasignación (opcional)
- `fecha_reasignacion`: Fecha/hora de la reasignación
- `razon_automatica`: Detalles técnicos de por qué se reasignó

## ⚙️ Lógica de Funcionamiento

### 1️⃣ Detección de Prospectos Sin Actividad

**Criterios:**
- Estado: **`Lead`** (únicamente)
- Sin actividad registrada en `historial_acciones` en los últimos **4+ horas**
- Solo se ejecuta en horario laboral (L-V 9-18 hrs)

**Consulta:**
```sql
SELECT 
  a.id_prospecto,
  a.id_vendedor,
  TIMESTAMPDIFF(MINUTE, MAX(ha.fecha), NOW()) as minutos_sin_actividad
FROM asignaciones a
LEFT JOIN historial_acciones ha ON a.id_prospecto = ha.id_prospecto
WHERE a.estado = 'Lead'
AND HOUR(NOW()) >= 9 AND HOUR(NOW()) <= 18
AND DAYOFWEEK(NOW()) BETWEEN 2 AND 6
AND TIMESTAMPDIFF(MINUTE, MAX(ha.fecha), NOW()) >= 240
```

### 2️⃣ Selección del Nuevo Vendedor

**Estrategia: Round-Robin por carga de trabajo**

Se selecciona el vendedor con:
- ✅ Estado activo
- ✅ Rol: "Vendedor" o "Supervisor Vendedor"
- ✅ **Menor cantidad de prospectos en estado 'Lead'**

```sql
SELECT u.id, COUNT(a.id_prospecto) as cantidad_leads
FROM usuarios u
LEFT JOIN asignaciones a ON u.id = a.id_vendedor 
WHERE u.activo = 1 AND a.estado = 'Lead'
GROUP BY u.id
ORDER BY cantidad_leads ASC
LIMIT 1
```

### 3️⃣ Registro de Reasignación

Se registran **acciones transaccionales**:

1. **Actualizar asignación** → Cambiar vendedor en `asignaciones`
2. **Crear auditoría** → Registrar en `reasignacion_auditoria`
3. **Historial** → Registrar en `historial_acciones`
4. **Conversaciones WhatsApp** → Transferir propietario en `chat_conversaciones_whatsapp` (solo conversaciones activas) y dejar mensaje de sistema en `chat_mensajes`
5. **Chatbot** → Actualizar propietario en `chatbot_conversaciones` (si existe vinculación a ese prospecto)

```sql
UPDATE asignaciones SET id_vendedor = ?, fecha_asignacion = NOW() WHERE id_prospecto = ?
INSERT INTO reasignacion_auditoria (...) VALUES (...)
INSERT INTO historial_acciones (...) VALUES (...)
-- WhatsApp
UPDATE chat_conversaciones_whatsapp SET vendedor_id = ?, updated_at = NOW() WHERE prospecto_id = ? AND vendedor_id = ? AND estado = 'activa';
INSERT INTO chat_mensajes (conversacion_id, mensaje, tipo, origen) VALUES (?, 'Conversación transferida automáticamente', 'sistema', 'sistema');
-- Chatbot
UPDATE chatbot_conversaciones SET usuario_id = ? WHERE prospecto_id = ? AND usuario_id = ?;
```

## 🕐 Programación (CRON)

**Ejecución:** Cada 30 minutos en horario laboral

```javascript
// Patrón CRON: "*/30 9-18 * * 1-5"
// ├─ */30 = Cada 30 minutos
// ├─ 9-18 = Entre 9:00 AM y 6:59 PM
// ├─ * = Cualquier día del mes
// ├─ * = Cualquier mes
// └─ 1-5 = Lunes a Viernes (1=Lunes, 5=Viernes)
```

**Nota:** Si ejecuta el job a las 9:31 AM, será a las 9:31, 10:01, 10:31, 11:01, etc.

## 📡 API Endpoints

### 1. Obtener Prospectos Candidatos

```http
GET /api/reasignaciones/candidatos
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "total": 5,
  "candidatos": [
    {
      "id_asignacion": 123,
      "id_prospecto": 456,
      "id_vendedor": 789,
      "nombre": "Juan",
      "apellido": "Pérez",
      "minutos_sin_actividad": 245,
      "estado": "Lead"
    }
  ]
}
```

### 2. Obtener Vendedores Disponibles

```http
GET /api/reasignaciones/vendedores-disponibles?excluir_id=789
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "vendedor": {
    "id": 999,
    "nombre": "Carlos Martínez",
    "cantidad_leads": 5
  }
}
```

### 3. Reasignar Prospecto (Manual)

```http
POST /api/reasignaciones/reasignar
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "id_prospecto": 456,
  "id_vendedor_nuevo": 999,
  "id_vendedor_anterior": 789,
  "motivo": "Reasignación manual por bajo rendimiento"
}
```

**Respuesta:**
```json
{
  "success": true,
  "resultado": {
    "idProspecto": 456,
    "idVendedorAnterior": 789,
    "idVendedorNuevo": 999,
    "mensaje": "Reasignación completada correctamente"
  }
}
```

### 4. Obtener Historial de Reasignaciones

```http
GET /api/reasignaciones/historial?limite=20
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "total": 15,
  "historial": [
    {
      "id": 1,
      "id_prospecto": 456,
      "nombre": "Juan",
      "apellido": "Pérez",
      "vendedor_anterior": "María González",
      "vendedor_nuevo": "Carlos Martínez",
      "fecha_reasignacion": "2025-01-26T14:30:45.000Z",
      "razon_automatica": "Sin actividad en horario laboral (L-V 9-18hs, > 4hrs)"
    }
  ]
}
```

### 5. Obtener Estadísticas

```http
GET /api/reasignaciones/estadisticas?fecha_inicio=2025-01-20&fecha_fin=2025-01-26
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "estadisticas": [
    {
      "fecha": "2025-01-26",
      "total_reasignaciones": 8,
      "prospectos_reasignados": 8,
      "vendedores_receptores": 4
    }
  ]
}
```

### 6. Ejecutar Reasignaciones Manuales

```http
POST /api/reasignaciones/ejecutar-manual
Authorization: Bearer {admin-token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Reasignaciones manuales ejecutadas",
  "resultado": "Ejecución completada"
}
```

## 🚀 Instalación

### 1. Crear tabla en BD

```bash
cd /var/www/cober360
node backend/migrations/create_reasignacion_auditoria.js
```

**Salida esperada:**
```
✅ Tabla reasignacion_auditoria creada/verificada correctamente
✅ Migración completada exitosamente
```

### 2. Verificar instalación

```bash
mysql -h localhost -u cober360_user -p cober360 -e "DESC reasignacion_auditoria;"
```

### 3. Reiniciar servidor

```bash
# Si usas PM2:
pm2 restart cober360

# O si ejecutas directamente:
npm start
```

## 📊 Monitoreo

### Logs del Job

Se registran en los logs de la aplicación:

```
✅ Job de reasignación automática iniciado
📊 Prospectos sin actividad encontrados: 5
✅ Prospecto 456 (Juan Pérez) reasignado a Carlos Martínez
📈 REPORTE DE REASIGNACIONES:
   Reasignaciones realizadas: 5
   Errores: 0
   Tiempo total: 234ms
```

### Consultas SQL de Auditoría

```sql
-- Ver todas las reasignaciones
SELECT * FROM reasignacion_auditoria ORDER BY fecha_reasignacion DESC;

-- Reasignaciones hoy
SELECT * FROM reasignacion_auditoria 
WHERE DATE(fecha_reasignacion) = CURDATE();

-- Vendedor con más reasignaciones recibidas
SELECT id_vendedor_nuevo, COUNT(*) as total
FROM reasignacion_auditoria
GROUP BY id_vendedor_nuevo
ORDER BY total DESC;

-- Prospectos reasignados múltiples veces
SELECT id_prospecto, COUNT(*) as veces
FROM reasignacion_auditoria
GROUP BY id_prospecto
HAVING COUNT(*) > 1
ORDER BY veces DESC;
```

## ⚙️ Configuración Avanzada

### Modificar tiempo de espera (4 horas)

En [ReAsignacionAutomatica.js](../models/ReAsignacionAutomatica.js):

```javascript
// Cambiar 240 minutos (4 horas) por otro valor
AND TIMESTAMPDIFF(MINUTE, COALESCE(MAX(ha.fecha), a.fecha_asignacion), NOW()) >= 240

// Ejemplos:
// 60 = 1 hora
// 120 = 2 horas
// 180 = 3 horas
// 240 = 4 horas (actual)
// 300 = 5 horas
```

### Modificar horario laboral (9-18)

En [ReasignacionAutomaticaJob.js](../jobs/ReasignacionAutomaticaJob.js):

```javascript
// Cambiar patrón CRON
// Actual: "*/30 9-18 * * 1-5" (9 AM - 6:59 PM)
// Nuevas opciones:
// "*/30 8-20 * * 1-5"   = 8 AM - 8:59 PM
// "*/30 9-17 * * 1-5"   = 9 AM - 5:59 PM
// "*/30 10-19 * * 1-5"  = 10 AM - 7:59 PM
```

### Cambiar frecuencia de ejecución

```javascript
// Actual: Cada 30 minutos
cron.schedule('*/30 9-18 * * 1-5', async () => { ... });

// Otras opciones:
// "*/15 9-18 * * 1-5"   = Cada 15 minutos
// "0 * 9-18 * * 1-5"    = Cada hora en punto
// "0 */2 9-18 * * 1-5"  = Cada 2 horas
```

### Excluir vendedores específicos

Modificar consulta en `obtenerVendedorDisponible()`:

```javascript
sql += ` AND u.id NOT IN (123, 456, 789)`; // Excluir IDs
```

## 🐛 Troubleshooting

### El job no se ejecuta

1. **Verificar que está en horario laboral** (L-V 9-18)
2. **Revisar logs:** `pm2 logs cober360`
3. **Ejecutar manualmente:** `POST /api/reasignaciones/ejecutar-manual`

### No se reasignan prospectos

Verificar candidatos disponibles:
```bash
# 1. ¿Existen prospectos sin actividad?
GET /api/reasignaciones/candidatos

# 2. ¿Hay vendedores disponibles?
GET /api/reasignaciones/vendedores-disponibles

# 3. ¿El estado del prospecto es 'Lead' o '1º Contacto'?
SELECT * FROM asignaciones WHERE id_prospecto = 456;
```

### Error de tabla no existe

```bash
# Ejecutar migración nuevamente
node backend/migrations/create_reasignacion_auditoria.js
```

### Transacción fallida

Revisar logs y errores en BD:
```bash
# Ver último error en MySQL
mysql> SHOW ENGINE INNODB STATUS\G
```

## 📈 Casos de Uso

### Caso 1: Prospecto nuevamente entra al sistema

```
1. Sistema detecta: id_prospecto=456, sin actividad 4+ horas, L-V 9-18
2. Selecciona: vendedor con menor carga (ej: id_vendedor=999)
3. Reasigna: 456 → 999
4. Registra: auditoría + historial_acciones
5. Resultado: Nuevo vendedor notificado y toma acción
```

### Caso 2: Supervisión de rendimiento

Admin quiere ver:
- Qué vendedores reciben más reasignaciones
- Qué prospectos se reasignan múltiples veces
- Tendencias diarias/semanales

```
GET /api/reasignaciones/historial?limite=100
GET /api/reasignaciones/estadisticas?fecha_inicio=2025-01-20&fecha_fin=2025-01-26
```

### Caso 3: Reasignación manual

Admin detecta vendedor enfermo:
```
POST /api/reasignaciones/reasignar
{
  "id_prospecto": 456,
  "id_vendedor_nuevo": 999,
  "id_vendedor_anterior": 789,
  "motivo": "Vendedor en licencia médica"
}
```

## 📝 Notas Importantes

- ✅ **Transacciones ACID:** Todas las reasignaciones son atómicas
- ✅ **Auditoría completa:** Se registra vendedor anterior y nuevo
- ✅ **Respetuoso con BD:** Solo se ejecuta en horario laboral
- ✅ **Escalable:** Soporta miles de prospectos sin problemas
- ⚠️ **Importante:** Requiere tabla `usuarios` con rol y estado `activo`
- ⚠️ **Nota:** Los prospectos NO se reasignan en fines de semana

## 🔗 Archivos Relacionados

- [ReAsignacionAutomatica.js](../models/ReAsignacionAutomatica.js) - Modelo de datos
- [ReasignacionService.js](../services/ReasignacionService.js) - Servicio
- [ReasignacionAutomaticaJob.js](../jobs/ReasignacionAutomaticaJob.js) - Job CRON
- [reasignaciones.js](../routes/reasignaciones.js) - Rutas API
- [server.js](../server.js) - Integración en servidor

---

**Última actualización:** 26 de Enero de 2025  
**Versión:** 1.0.0  
**Autor:** Sistema de Cober360
