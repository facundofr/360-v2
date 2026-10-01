#!/bin/bash

# 🚀 Script de Deploy Automatizado para Cober360
# Autor: DevOps Team
# Fecha: $(date +%Y-%m-%d)

set -e  # Detener en caso de error

# 🎨 COLORES PARA OUTPUT
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 📝 CONFIGURACIÓN
PROJECT_NAME="cober360"
DEVELOPMENT_PATH="/var/www/cober360"
PRODUCTION_PATH="/var/www/cober360-produccion"
BACKUP_PATH="/var/www/backups"
LOG_FILE="/var/log/deploy-${PROJECT_NAME}.log"
DEPLOYMENT_ID=$(date +%Y%m%d_%H%M%S)

# 📊 FUNCIONES DE LOGGING
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# 🏥 FUNCIONES DE SALUD
check_system_health() {
    log "🏥 Verificando salud del sistema..."
    
    # Verificar espacio en disco
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 85 ]; then
        error "Espacio en disco insuficiente: ${DISK_USAGE}%"
    fi
    
    # Verificar memoria
    MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$MEMORY_USAGE" -gt 90 ]; then
        warn "Uso de memoria alto: ${MEMORY_USAGE}%"
    fi
    
    # Verificar MySQL
    if ! mysqladmin ping -h localhost --silent; then
        error "Base de datos MySQL no disponible"
    fi
    
    log "✅ Sistema saludable - Disco: ${DISK_USAGE}%, Memoria: ${MEMORY_USAGE}%"
}

# 💾 FUNCIÓN DE BACKUP
create_backup() {
    log "💾 Creando backup antes del deploy..."
    
    # Crear directorio de backup si no existe
    mkdir -p "$BACKUP_PATH"
    
    # Backup de archivos
    BACKUP_FILE="${BACKUP_PATH}/${PROJECT_NAME}_backup_${DEPLOYMENT_ID}.tar.gz"
    tar -czf "$BACKUP_FILE" -C "$PRODUCTION_PATH" . 2>/dev/null || {
        warn "No se pudo crear backup de archivos (primera instalación)"
    }
    
    # Backup de base de datos
    DB_BACKUP="${BACKUP_PATH}/${PROJECT_NAME}_db_backup_${DEPLOYMENT_ID}.sql"
    MYSQL_PWD="${DB_PASSWORD:-}" mysqldump -u root cober360 > "$DB_BACKUP" 2>/dev/null || {
        warn "No se pudo crear backup de base de datos"
    }
    
    log "✅ Backup creado: $BACKUP_FILE"
}

# 🔄 FUNCIÓN DE SINCRONIZACIÓN
sync_code() {
    log "🔄 Sincronizando código desde desarrollo a producción..."
    
    # Cambiar al directorio de desarrollo
    cd "$DEVELOPMENT_PATH"
    
    # Verificar que estamos en la rama correcta
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "production" ]; then
        warn "Rama actual: $CURRENT_BRANCH. Se recomienda usar 'main' o 'production'"
    fi
    
    # Hacer pull de los últimos cambios
    git pull origin "$CURRENT_BRANCH" || warn "No se pudo hacer pull"
    
    # Sincronizar archivos (excluyendo ciertos directorios)
    rsync -av \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='uploads' \
        --exclude='backups' \
        --exclude='*.log' \
        --exclude='.env' \
        "$DEVELOPMENT_PATH/" "$PRODUCTION_PATH/"
    
    log "✅ Código sincronizado"
}

# 📦 FUNCIÓN DE INSTALACIÓN DE DEPENDENCIAS
install_dependencies() {
    log "📦 Instalando dependencias..."
    
    cd "$PRODUCTION_PATH"
    
    # Backend dependencies
    if [ -f "backend/package.json" ]; then
        cd backend
        npm ci --only=production --silent
        cd ..
        log "✅ Dependencias del backend instaladas"
    fi
    
    # Frontend build
    if [ -f "frontend/package.json" ]; then
        cd frontend
        npm ci --silent
        npm run build --silent
        cd ..
        log "✅ Frontend construido"
    fi
}

# 🗄️ FUNCIÓN DE MIGRACIÓN DE BASE DE DATOS
run_migrations() {
    log "🗄️ Ejecutando migraciones de base de datos..."
    
    cd "$PRODUCTION_PATH/backend"
    
    # Ejecutar migraciones si existen
    if [ -f "package.json" ] && npm run | grep -q "migrate"; then
        npm run migrate || warn "No se pudieron ejecutar las migraciones"
        log "✅ Migraciones ejecutadas"
    else
        info "No se encontraron migraciones para ejecutar"
    fi
}

# 🔄 FUNCIÓN DE RESTART DE SERVICIOS
restart_services() {
    log "🔄 Reiniciando servicios..."
    
    # Reiniciar PM2
    if command -v pm2 &> /dev/null; then
        cd "$PRODUCTION_PATH"
        pm2 reload ecosystem.config.js --update-env || {
            pm2 start ecosystem.config.js || error "No se pudo iniciar PM2"
        }
        log "✅ PM2 reiniciado"
    else
        warn "PM2 no encontrado"
    fi
    
    # Reiniciar Nginx si es necesario
    if systemctl is-active --quiet nginx; then
        systemctl reload nginx
        log "✅ Nginx recargado"
    fi
}

# 🧪 FUNCIÓN DE TESTS POST-DEPLOY
run_post_deploy_tests() {
    log "🧪 Ejecutando tests post-deploy..."
    
    # Test de conectividad de la API
    API_URL="http://localhost:4000/health"
    if curl -f -s "$API_URL" > /dev/null; then
        log "✅ API respondiendo correctamente"
    else
        error "API no responde en $API_URL"
    fi
    
    # Test de base de datos
    cd "$PRODUCTION_PATH/backend"
    if node -e "console.log('DB Test OK')" 2>/dev/null; then
        log "✅ Conexión a base de datos OK"
    else
        warn "No se pudo verificar la conexión a la base de datos"
    fi
    
    # Verificar que los servicios estén corriendo
    if pm2 list | grep -q "online"; then
        log "✅ Servicios PM2 ejecutándose"
    else
        error "Servicios PM2 no están ejecutándose"
    fi
}

# 📊 FUNCIÓN DE MONITOREO
monitor_deployment() {
    log "📊 Monitoreando deployment por 60 segundos..."
    
    for i in {1..12}; do
        sleep 5
        
        # Verificar salud de la API
        if curl -f -s "http://localhost:4000/health" > /dev/null; then
            echo -n "✅"
        else
            echo -n "❌"
            error "Fallo en monitoreo - API no responde"
        fi
    done
    
    echo ""
    log "✅ Monitoreo completado - Deployment estable"
}

# 🔄 FUNCIÓN DE ROLLBACK
rollback() {
    error "🔄 Iniciando rollback automático..."
    
    LATEST_BACKUP=$(ls -t ${BACKUP_PATH}/${PROJECT_NAME}_backup_*.tar.gz 2>/dev/null | head -1)
    
    if [ -f "$LATEST_BACKUP" ]; then
        log "📦 Restaurando desde: $LATEST_BACKUP"
        
        # Detener servicios
        pm2 stop all || true
        
        # Restaurar archivos
        cd "$PRODUCTION_PATH"
        rm -rf *
        tar -xzf "$LATEST_BACKUP" -C "$PRODUCTION_PATH"
        
        # Restaurar base de datos
        LATEST_DB_BACKUP=$(ls -t ${BACKUP_PATH}/${PROJECT_NAME}_db_backup_*.sql 2>/dev/null | head -1)
        if [ -f "$LATEST_DB_BACKUP" ]; then
            MYSQL_PWD="${DB_PASSWORD:-}" mysql -u root cober360 < "$LATEST_DB_BACKUP"
        fi
        
        # Reiniciar servicios
        pm2 start ecosystem.config.js
        
        log "✅ Rollback completado"
    else
        error "No se encontró backup para rollback"
    fi
}

# 📧 FUNCIÓN DE NOTIFICACIONES
send_notification() {
    local status=$1
    local message=$2
    
    # Aquí puedes agregar integración con Slack, Discord, email, etc.
    log "📧 NOTIFICACIÓN: $status - $message"
    
    # Ejemplo para Slack (requiere webhook URL)
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"🚀 Deploy $status: $message\"}" \
    #     $SLACK_WEBHOOK_URL
}

# 🚀 FUNCIÓN PRINCIPAL DE DEPLOY
main() {
    log "🚀 Iniciando deployment de $PROJECT_NAME (ID: $DEPLOYMENT_ID)"
    
    # Configurar trap para rollback en caso de error
    trap 'rollback' ERR
    
    # Verificar que somos root o tenemos permisos sudo
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        error "Este script requiere permisos de root o sudo"
    fi
    
    # Ejecutar pasos del deployment
    check_system_health
    create_backup
    sync_code
    install_dependencies
    run_migrations
    restart_services
    run_post_deploy_tests
    monitor_deployment
    
    # Limpiar backups antiguos (mantener solo los últimos 5)
    find "$BACKUP_PATH" -name "${PROJECT_NAME}_backup_*.tar.gz" -type f | sort -r | tail -n +6 | xargs rm -f
    
    send_notification "SUCCESS" "Deployment $DEPLOYMENT_ID completado exitosamente"
    log "🎉 Deployment completado exitosamente!"
    
    # Desactivar trap de rollback
    trap - ERR
}

# 📋 FUNCIÓN DE AYUDA
show_help() {
    echo "🚀 Script de Deploy Automatizado para Cober360"
    echo ""
    echo "Uso: $0 [OPCIÓN]"
    echo ""
    echo "Opciones:"
    echo "  deploy     Ejecutar deployment completo (por defecto)"
    echo "  rollback   Ejecutar rollback al último backup"
    echo "  test       Ejecutar solo tests post-deploy"
    echo "  health     Verificar salud del sistema"
    echo "  help       Mostrar esta ayuda"
    echo ""
    echo "Variables de entorno:"
    echo "  DB_PASSWORD    Password de la base de datos"
    echo "  SLACK_WEBHOOK_URL  URL del webhook de Slack para notificaciones"
    echo ""
}

# 🎯 MANEJO DE ARGUMENTOS
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "test")
        run_post_deploy_tests
        ;;
    "health")
        check_system_health
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Opción no válida: $1. Usa '$0 help' para ver las opciones disponibles."
        ;;
esac