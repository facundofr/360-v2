#!/bin/bash

# 📊 Script de Monitoreo Post-Deploy para Cober360
# Monitorea la aplicación después del deployment

set -e

# 🎨 COLORES
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 📊 CONFIGURACIÓN
MONITOR_DURATION=${MONITOR_DURATION:-300}  # 5 minutos por defecto
CHECK_INTERVAL=${CHECK_INTERVAL:-30}       # 30 segundos entre checks
API_URL=${API_URL:-"http://localhost:4000"}
ALERT_THRESHOLD_CPU=${ALERT_THRESHOLD_CPU:-80}
ALERT_THRESHOLD_MEM=${ALERT_THRESHOLD_MEM:-85}
ALERT_THRESHOLD_DISK=${ALERT_THRESHOLD_DISK:-85}
ALERT_THRESHOLD_RESPONSE_TIME=${ALERT_THRESHOLD_RESPONSE_TIME:-2000}  # 2 segundos

# 📁 ARCHIVOS
LOG_FILE="/var/log/monitor-cober360.log"
METRICS_FILE="/tmp/cober360_metrics_$(date +%Y%m%d_%H%M%S).json"
ALERT_FILE="/tmp/cober360_alerts_$(date +%Y%m%d_%H%M%S).txt"

# 📊 CONTADORES
CHECKS_TOTAL=0
CHECKS_PASSED=0
CHECKS_FAILED=0
ALERTS_COUNT=0

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
    ALERTS_COUNT=$((ALERTS_COUNT + 1))
    echo "[$(date)] WARNING: $1" >> "$ALERT_FILE"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    ALERTS_COUNT=$((ALERTS_COUNT + 1))
    echo "[$(date)] ERROR: $1" >> "$ALERT_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# 📊 FUNCIÓN PARA REGISTRAR MÉTRICAS
record_metric() {
    local metric_name=$1
    local metric_value=$2
    local timestamp=$(date +%s)
    
    echo "{\"timestamp\": $timestamp, \"metric\": \"$metric_name\", \"value\": $metric_value}" >> "$METRICS_FILE"
}

# 🏥 CHECK DE API HEALTH
check_api_health() {
    local start_time=$(date +%s%N)
    local response_code=""
    local response_time=0
    
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    # Hacer request a health endpoint
    if response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/health" 2>/dev/null); then
        local end_time=$(date +%s%N)
        response_time=$(( (end_time - start_time) / 1000000 )) # en millisegundos
        
        record_metric "api_response_time" "$response_time"
        record_metric "api_status_code" "$response_code"
        
        if [ "$response_code" = "200" ]; then
            if [ $response_time -gt $ALERT_THRESHOLD_RESPONSE_TIME ]; then
                warn "API responde lento: ${response_time}ms (threshold: ${ALERT_THRESHOLD_RESPONSE_TIME}ms)"
            fi
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
            return 0
        else
            error "API retornó código: $response_code"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    else
        error "API no responde"
        record_metric "api_response_time" "-1"
        record_metric "api_status_code" "0"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

# 🗄️ CHECK DE BASE DE DATOS
check_database() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if mysqladmin ping -h localhost --silent 2>/dev/null; then
        # Obtener métricas de la DB
        local connections=$(MYSQL_PWD="${DB_PASSWORD:-}" mysql -u root -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null | awk 'NR==2 {print $2}' || echo "0")
        local queries=$(MYSQL_PWD="${DB_PASSWORD:-}" mysql -u root -e "SHOW STATUS LIKE 'Queries';" 2>/dev/null | awk 'NR==2 {print $2}' || echo "0")
        
        record_metric "db_connections" "$connections"
        record_metric "db_queries" "$queries"
        
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        error "Base de datos no responde"
        record_metric "db_status" "0"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

# 🔄 CHECK DE PROCESOS PM2
check_pm2_processes() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    if command -v pm2 &> /dev/null; then
        local pm2_status=$(pm2 jlist 2>/dev/null || echo "[]")
        local online_processes=$(echo "$pm2_status" | jq -r '.[] | select(.pm2_env.status == "online") | .name' 2>/dev/null | wc -l || echo "0")
        local stopped_processes=$(echo "$pm2_status" | jq -r '.[] | select(.pm2_env.status == "stopped") | .name' 2>/dev/null | wc -l || echo "0")
        
        record_metric "pm2_online_processes" "$online_processes"
        record_metric "pm2_stopped_processes" "$stopped_processes"
        
        if [ "$stopped_processes" -gt 0 ]; then
            warn "Hay $stopped_processes procesos PM2 detenidos"
        fi
        
        if [ "$online_processes" -gt 0 ]; then
            CHECKS_PASSED=$((CHECKS_PASSED + 1))
            return 0
        else
            error "No hay procesos PM2 en línea"
            CHECKS_FAILED=$((CHECKS_FAILED + 1))
            return 1
        fi
    else
        warn "PM2 no está instalado"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

# 💻 CHECK DE RECURSOS DEL SISTEMA
check_system_resources() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    # CPU Usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' || echo "0")
    cpu_usage=${cpu_usage%.*}  # Remover decimales
    
    # Memory Usage
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    # Disk Usage
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    # Load Average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    # Record metrics
    record_metric "cpu_usage" "$cpu_usage"
    record_metric "memory_usage" "$memory_usage"
    record_metric "disk_usage" "$disk_usage"
    record_metric "load_average" "$load_avg"
    
    # Check thresholds
    local alerts=0
    
    if [ "$cpu_usage" -gt "$ALERT_THRESHOLD_CPU" ]; then
        warn "Uso de CPU alto: ${cpu_usage}% (threshold: ${ALERT_THRESHOLD_CPU}%)"
        alerts=$((alerts + 1))
    fi
    
    if [ "$memory_usage" -gt "$ALERT_THRESHOLD_MEM" ]; then
        warn "Uso de memoria alto: ${memory_usage}% (threshold: ${ALERT_THRESHOLD_MEM}%)"
        alerts=$((alerts + 1))
    fi
    
    if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
        warn "Uso de disco alto: ${disk_usage}% (threshold: ${ALERT_THRESHOLD_DISK}%)"
        alerts=$((alerts + 1))
    fi
    
    if [ $alerts -eq 0 ]; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

# 📝 CHECK DE LOGS DE ERROR
check_error_logs() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    local log_paths=(
        "/var/www/cober360-produccion/backend/logs"
        "/var/log/nginx"
        "$HOME/.pm2/logs"
    )
    
    local recent_errors=0
    local five_minutes_ago=$(date -d '5 minutes ago' +%s)
    
    for log_path in "${log_paths[@]}"; do
        if [ -d "$log_path" ]; then
            # Buscar errores en logs recientes
            local errors_found=$(find "$log_path" -name "*.log" -type f -newermt "5 minutes ago" -exec grep -l -i "error\|exception\|fatal" {} \; 2>/dev/null | wc -l)
            recent_errors=$((recent_errors + errors_found))
        fi
    done
    
    record_metric "recent_errors" "$recent_errors"
    
    if [ "$recent_errors" -gt 5 ]; then
        warn "Se encontraron $recent_errors errores recientes en logs"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    else
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    fi
}

# 🌐 CHECK DE CONECTIVIDAD EXTERNA
check_external_connectivity() {
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    
    local external_services=(
        "https://google.com"
        "https://api.whatsapp.com"
    )
    
    local failed_services=0
    
    for service in "${external_services[@]}"; do
        if ! curl -f -s --max-time 10 "$service" > /dev/null 2>&1; then
            warn "No se puede conectar a: $service"
            failed_services=$((failed_services + 1))
        fi
    done
    
    record_metric "external_connectivity_failures" "$failed_services"
    
    if [ "$failed_services" -eq 0 ]; then
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

# 📊 EJECUTAR TODOS LOS CHECKS
run_monitoring_cycle() {
    local cycle_start=$(date)
    info "🔍 Iniciando ciclo de monitoreo: $cycle_start"
    
    # Ejecutar todos los checks
    check_api_health
    check_database
    check_pm2_processes
    check_system_resources
    check_error_logs
    check_external_connectivity
    
    local cycle_end=$(date)
    local success_rate=$((CHECKS_PASSED * 100 / CHECKS_TOTAL))
    
    info "📊 Ciclo completado - Éxito: $success_rate% (${CHECKS_PASSED}/${CHECKS_TOTAL})"
    
    # Reset counters for next cycle
    CHECKS_TOTAL=0
    CHECKS_PASSED=0
    CHECKS_FAILED=0
}

# 🚨 FUNCIÓN DE ALERTA CRÍTICA
send_critical_alert() {
    local message=$1
    
    error "🚨 ALERTA CRÍTICA: $message"
    
    # Aquí puedes agregar integración con sistemas de alertas
    # Ejemplo: Slack, Discord, Email, PagerDuty, etc.
    
    # Slack webhook (ejemplo)
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"🚨 ALERTA CRÍTICA Cober360: $message\"}" \
    #     $SLACK_WEBHOOK_URL
    
    # Email (ejemplo)
    # echo "$message" | mail -s "🚨 ALERTA CRÍTICA Cober360" admin@cober.online
}

# 📊 GENERAR REPORTE DE MONITOREO
generate_monitoring_report() {
    local end_time=$(date)
    local report_file="/tmp/cober360_monitoring_report_$(date +%Y%m%d_%H%M%S).html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>📊 Reporte de Monitoreo - Cober360</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; padding: 10px; border-left: 4px solid #007cba; }
        .alert { background: #ffebee; border-left-color: #f44336; }
        .success { background: #e8f5e8; border-left-color: #4caf50; }
        .warning { background: #fff3e0; border-left-color: #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Reporte de Monitoreo Post-Deploy</h1>
        <p><strong>Aplicación:</strong> Cober360</p>
        <p><strong>Fecha:</strong> $(date)</p>
        <p><strong>Duración:</strong> ${MONITOR_DURATION} segundos</p>
        <p><strong>Alertas totales:</strong> $ALERTS_COUNT</p>
    </div>
    
    <h2>📈 Métricas Recopiladas</h2>
    <div class="metric">
        <p>Las métricas detalladas están disponibles en: <code>$METRICS_FILE</code></p>
    </div>
    
    <h2>🚨 Alertas</h2>
EOF

    if [ -f "$ALERT_FILE" ] && [ -s "$ALERT_FILE" ]; then
        echo "<div class='metric alert'>" >> "$report_file"
        echo "<h3>Alertas encontradas:</h3>" >> "$report_file"
        echo "<pre>" >> "$report_file"
        cat "$ALERT_FILE" >> "$report_file"
        echo "</pre>" >> "$report_file"
        echo "</div>" >> "$report_file"
    else
        echo "<div class='metric success'>" >> "$report_file"
        echo "<p>✅ No se encontraron alertas durante el monitoreo</p>" >> "$report_file"
        echo "</div>" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF
    
    <h2>📋 Resumen</h2>
    <div class="metric">
        <p><strong>Estado general:</strong> $([ $ALERTS_COUNT -eq 0 ] && echo "✅ SALUDABLE" || echo "⚠️  REQUIERE ATENCIÓN")</p>
        <p><strong>Recomendación:</strong> $([ $ALERTS_COUNT -eq 0 ] && echo "El sistema está funcionando correctamente" || echo "Revisar las alertas y tomar acción correctiva")</p>
    </div>
    
    <footer>
        <p><small>Generado por: monitor_post_deploy.sh | $(date)</small></p>
    </footer>
</body>
</html>
EOF

    log "📄 Reporte de monitoreo guardado en: $report_file"
    
    if command -v xdg-open &> /dev/null; then
        xdg-open "$report_file" 2>/dev/null &
    fi
}

# 🎯 FUNCIÓN PRINCIPAL DE MONITOREO
main() {
    log "📊 Iniciando monitoreo post-deploy de Cober360"
    log "⏱️  Duración: ${MONITOR_DURATION} segundos | Intervalo: ${CHECK_INTERVAL} segundos"
    
    # Inicializar archivos
    echo "[]" > "$METRICS_FILE"
    echo "" > "$ALERT_FILE"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITOR_DURATION))
    local cycles=0
    
    # Loop principal de monitoreo
    while [ $(date +%s) -lt $end_time ]; do
        cycles=$((cycles + 1))
        
        run_monitoring_cycle
        
        # Si hay demasiadas alertas, enviar alerta crítica
        if [ $ALERTS_COUNT -gt 10 ]; then
            send_critical_alert "Sistema inestable - $ALERTS_COUNT alertas en $cycles ciclos"
            break
        fi
        
        # Esperar intervalo antes del siguiente check
        if [ $(date +%s) -lt $end_time ]; then
            sleep $CHECK_INTERVAL
        fi
    done
    
    log "🏁 Monitoreo completado después de $cycles ciclos"
    generate_monitoring_report
    
    # Retornar código de salida basado en alertas
    if [ $ALERTS_COUNT -eq 0 ]; then
        log "🎉 Monitoreo exitoso - No se encontraron problemas"
        return 0
    else
        warn "⚠️  Monitoreo completado con $ALERTS_COUNT alertas"
        return 1
    fi
}

# 📋 FUNCIÓN DE AYUDA
show_help() {
    echo "📊 Script de Monitoreo Post-Deploy para Cober360"
    echo ""
    echo "Uso: $0 [OPCIONES]"
    echo ""
    echo "Opciones:"
    echo "  --duration SECONDS    Duración del monitoreo (por defecto: 300)"
    echo "  --interval SECONDS    Intervalo entre checks (por defecto: 30)"
    echo "  --api-url URL         URL de la API (por defecto: http://localhost:4000)"
    echo "  --help                Mostrar esta ayuda"
    echo ""
    echo "Variables de entorno:"
    echo "  MONITOR_DURATION      Duración del monitoreo en segundos"
    echo "  CHECK_INTERVAL        Intervalo entre checks en segundos"
    echo "  API_URL               URL base de la API"
    echo "  DB_PASSWORD           Password de la base de datos"
    echo "  SLACK_WEBHOOK_URL     URL del webhook de Slack"
    echo ""
    echo "Ejemplos:"
    echo "  $0                           # Monitoreo estándar (5 minutos)"
    echo "  $0 --duration 600            # Monitoreo por 10 minutos"
    echo "  $0 --interval 10             # Check cada 10 segundos"
    echo ""
}

# 🎯 MANEJO DE ARGUMENTOS
while [[ $# -gt 0 ]]; do
    case $1 in
        --duration)
            MONITOR_DURATION="$2"
            shift 2
            ;;
        --interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            error "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Ejecutar función principal
main