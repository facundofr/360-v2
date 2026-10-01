# Migración: Campo `realizado_por_id` en `reasignacion_auditoria`

**Fecha:** 2026-04-07  
**Autor:** BackOffice  
**Estado:** ✅ Aplicada en producción

---

## Descripción

Se agregó el campo `realizado_por_id` a la tabla `reasignacion_auditoria` para registrar qué usuario del sistema realizó cada reasignación manual. Las reasignaciones automáticas (por inactividad o refritos) conservan este campo en `NULL`.

---

## SQL de la migración

```sql
ALTER TABLE reasignacion_auditoria 
  ADD COLUMN realizado_por_id INT(11) NULL AFTER id_vendedor_nuevo,
  ADD CONSTRAINT fk_reasig_auditoria_usuario 
    FOREIGN KEY (realizado_por_id) REFERENCES users(id) ON DELETE SET NULL;
```

---

## Estructura final de la tabla

```sql
DESCRIBE reasignacion_auditoria;
```

| Field                | Type         | Null | Key | Default             | Extra          |
|----------------------|--------------|------|-----|---------------------|----------------|
| id                   | int(11)      | NO   | PRI | NULL                | auto_increment |
| id_prospecto         | int(11)      | NO   | MUL | NULL                |                |
| id_vendedor_anterior | int(11)      | YES  | MUL | NULL                |                |
| id_vendedor_nuevo    | int(11)      | NO   | MUL | NULL                |                |
| realizado_por_id     | int(11)      | YES  | MUL | NULL                |                |
| motivo               | varchar(255) | YES  |     | NULL                |                |
| fecha_reasignacion   | datetime     | YES  | MUL | current_timestamp() |                |
| razon_automatica     | varchar(255) | YES  |     | NULL                |                |

---

## Archivos modificados en el backend

### `backend/controllers/backoffice/backOfficeController.js`
- Se extrae `req.user?.id` y se pasa como `realizado_por_id` al modelo.

### `backend/models/backoffice/backOfficeModel.js`
- Función `reasignarProspectos` recibe el nuevo parámetro `realizadoPorId`.
- Se agrega `INSERT INTO reasignacion_auditoria` con el campo `realizado_por_id` en cada reasignación.

### `backend/controllers/supervisor/vendedorGestionController.js`
- Se agrega `INSERT INTO reasignacion_auditoria` dentro del loop de reasignación, usando `supervisorId` (ya disponible desde `req.user.id`) como `realizado_por_id`.
- Motivo registrado: `'Reasignado desde Supervisor'`.

---

## Consulta de auditoría con usuario

```sql
SELECT 
    ra.id,
    ra.fecha_reasignacion,
    CONCAT(p.nombre,' ',p.apellido) AS prospecto,
    CONCAT(u_ant.first_name,' ',u_ant.last_name) AS vendedor_anterior,
    CONCAT(u_nuevo.first_name,' ',u_nuevo.last_name) AS vendedor_nuevo,
    CONCAT(u_usr.first_name,' ',u_usr.last_name) AS realizado_por,
    ra.motivo,
    ra.razon_automatica
FROM reasignacion_auditoria ra
LEFT JOIN prospectos p ON p.id = ra.id_prospecto
LEFT JOIN users u_ant ON u_ant.id = ra.id_vendedor_anterior
LEFT JOIN users u_nuevo ON u_nuevo.id = ra.id_vendedor_nuevo
LEFT JOIN users u_usr ON u_usr.id = ra.realizado_por_id
ORDER BY ra.fecha_reasignacion DESC;
```

---

## Notas

- `realizado_por_id = NULL` → reasignación **automática** (por inactividad, refrito, etc.)
- `realizado_por_id = <id>` → reasignación **manual** iniciada por ese usuario
- La FK usa `ON DELETE SET NULL` para no perder registros si el usuario es eliminado
