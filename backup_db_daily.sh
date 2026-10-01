#!/bin/bash

# Script de backup automático de la base de datos cober360-produccion
# Se ejecuta diariamente a las 17:00 horas

# Configuración
DB_NAME="cober360-produccion"
DB_USER="root"
BACKUP_DIR="/var/www/cober360-produccion/backups"
LOG_FILE="/var/www/cober360-produccion/logs/backup.log"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"
mkdir -p "/var/www/cober360-produccion/logs"

# Obtener contraseña de la base de datos del archivo .env local no versionado
DB_PASS=$(grep -m1 "^DB_PASSWORD=" /var/www/cober360-produccion/backend/.env | cut -d'=' -f2- | tr -d '\r')

if [ -z "$DB_PASS" ]; then
    echo "ERROR: DB_PASSWORD no está configurado fuera del repositorio." >&2
    exit 1
fi

# Crear nombre del archivo con fecha y hora
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

# Función para registrar mensajes en log
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Iniciar backup
log_message "===== INICIANDO BACKUP DE BASE DE DATOS ====="
log_message "Base de datos: $DB_NAME"
log_message "Archivo: $BACKUP_FILE"

# Ejecutar mysqldump y comprimir
if MYSQL_PWD="$DB_PASS" mysqldump -h localhost -u "$DB_USER" "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_message "✅ Backup completado exitosamente"
    log_message "Tamaño del archivo: $SIZE"
    log_message "Ruta: $BACKUP_FILE"
    
    # Mostrar en consola también
    echo "✅ Backup completado: $BACKUP_FILE ($SIZE)"
else
    log_message "❌ ERROR: Falló el backup de la base de datos"
    echo "❌ ERROR: Falló el backup"
    exit 1
fi

# Limpiar backups antiguos (mantener solo los últimos 7 días)
log_message "Limpiando backups anteriores..."
find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +7 -exec rm {} \; 2>/dev/null

if [ $? -eq 0 ]; then
    log_message "✅ Backups antiguos eliminados correctamente"
else
    log_message "⚠️ Advertencia: No se pudieron eliminar algunos backups antiguos"
fi

log_message "===== FIN DEL BACKUP ====="
log_message ""

exit 0
