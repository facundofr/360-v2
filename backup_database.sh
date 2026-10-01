#!/bin/bash

# Script de backup para base de datos MySQL de Cober360
# Autor: Sistema de backup automatizado
# Fecha: $(date)

# Configuración
ENV_FILE="${ENV_FILE:-/var/www/cober360/backend/.env}"

get_env_value() {
    local key="$1"
    grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '\r'
}

if [ ! -r "$ENV_FILE" ]; then
    echo "ERROR: No se puede leer el archivo de entorno: $ENV_FILE" >&2
    exit 1
fi

DB_NAME="${DB_NAME:-$(get_env_value DB_NAME)}"
DB_USER="${DB_USER:-$(get_env_value DB_USER)}"
DB_PASS="${DB_PASSWORD:-$(get_env_value DB_PASSWORD)}"
DB_HOST="${DB_HOST:-$(get_env_value DB_HOST)}"
DB_NAME="${DB_NAME:-cober360}"
DB_HOST="${DB_HOST:-localhost}"

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
    echo "ERROR: DB_USER y DB_PASSWORD deben estar configurados fuera del repositorio." >&2
    exit 1
fi

BACKUP_DIR="/var/www/cober360/backups"
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="cober360_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Función para logging
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Función para notificación (placeholder para futuras implementaciones)
send_notification() {
    local status="$1"
    local message="$2"
    log_message "NOTIFICACIÓN [$status]: $message"
}

# Crear directorio de backup si no existe
mkdir -p "$BACKUP_DIR"

# Iniciar backup
log_message "========================================"
log_message "INICIANDO BACKUP DE BASE DE DATOS"
log_message "========================================"
log_message "Base de datos: $DB_NAME"
log_message "Archivo: $BACKUP_FILE"

# Realizar backup
log_message "Iniciando dump de la base de datos..."

if MYSQL_PWD="$DB_PASS" mysqldump -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
    # Verificar que el archivo se creó correctamente
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        FILE_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log_message "✅ BACKUP COMPLETADO EXITOSAMENTE"
        log_message "Archivo: $BACKUP_DIR/$BACKUP_FILE"
        log_message "Tamaño: $FILE_SIZE"
        send_notification "SUCCESS" "Backup completado: $BACKUP_FILE ($FILE_SIZE)"
        
        # Comprimir el backup
        log_message "Comprimiendo backup..."
        if gzip "$BACKUP_DIR/$BACKUP_FILE"; then
            COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)
            log_message "✅ Backup comprimido: $COMPRESSED_SIZE"
        else
            log_message "⚠️ Error al comprimir el backup"
        fi
        
        # Limpiar backups antiguos (más de 30 días)
        log_message "Limpiando backups antiguos (más de 30 días)..."
        find "$BACKUP_DIR" -name "cober360_backup_*.sql.gz" -mtime +30 -delete
        REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "cober360_backup_*.sql.gz" | wc -l)
        log_message "Backups restantes: $REMAINING_BACKUPS"
        
    else
        log_message "❌ ERROR: El archivo de backup no se creó correctamente"
        send_notification "ERROR" "Fallo al crear archivo de backup"
        exit 1
    fi
else
    log_message "❌ ERROR: Fallo al ejecutar mysqldump"
    send_notification "ERROR" "Fallo en mysqldump"
    exit 1
fi

log_message "========================================"
log_message "BACKUP FINALIZADO"
log_message "========================================"

exit 0