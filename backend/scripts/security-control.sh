#!/bin/bash

# 🛡️ Script de Control del Monitoreo de Seguridad Cober360
# Uso: ./security-control.sh {start|stop|restart|status}

SCRIPT_DIR="/var/www/cober360/backend/scripts"
MONITOR_SCRIPT="$SCRIPT_DIR/security-monitor.js"
PID_FILE="/var/run/cober360-security-monitor.pid"
LOG_FILE="/var/www/cober360/backend/logs/security-monitor.log"

# Función para iniciar el monitoreo
start_monitor() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "❌ El monitoreo de seguridad ya está ejecutándose (PID: $PID)"
            return 1
        else
            echo "🧹 Limpiando archivo PID obsoleto"
            rm -f "$PID_FILE"
        fi
    fi
    
    echo "🚀 Iniciando monitoreo de seguridad..."
    cd "$SCRIPT_DIR"
    nohup node "$MONITOR_SCRIPT" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    sleep 2
    if ps -p "$(cat $PID_FILE)" > /dev/null 2>&1; then
        echo "✅ Monitoreo de seguridad iniciado exitosamente (PID: $(cat $PID_FILE))"
        echo "📝 Logs disponibles en: $LOG_FILE"
    else
        echo "❌ Error al iniciar el monitoreo de seguridad"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Función para detener el monitoreo
stop_monitor() {
    if [ ! -f "$PID_FILE" ]; then
        echo "❌ El monitoreo de seguridad no está ejecutándose"
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🛑 Deteniendo monitoreo de seguridad (PID: $PID)..."
        kill "$PID"
        sleep 2
        
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "⚠️ Forzando detención..."
            kill -9 "$PID"
        fi
        
        rm -f "$PID_FILE"
        echo "✅ Monitoreo de seguridad detenido"
    else
        echo "❌ El proceso no está ejecutándose"
        rm -f "$PID_FILE"
    fi
}

# Función para verificar el estado
check_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "✅ Monitoreo de seguridad ACTIVO (PID: $PID)"
            echo "📊 Tiempo de ejecución: $(ps -o etime= -p "$PID" | tr -d ' ')"
            echo "💾 Uso de memoria: $(ps -o rss= -p "$PID" | tr -d ' ') KB"
            return 0
        else
            echo "❌ Monitoreo de seguridad INACTIVO (archivo PID obsoleto)"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        echo "❌ Monitoreo de seguridad INACTIVO"
        return 1
    fi
}

# Función para reiniciar
restart_monitor() {
    echo "🔄 Reiniciando monitoreo de seguridad..."
    stop_monitor
    sleep 1
    start_monitor
}

# Función para mostrar ayuda
show_help() {
    echo "🛡️ Control del Monitoreo de Seguridad Cober360"
    echo ""
    echo "Uso: $0 {start|stop|restart|status|logs|help}"
    echo ""
    echo "Comandos:"
    echo "  start    - Iniciar el monitoreo de seguridad"
    echo "  stop     - Detener el monitoreo de seguridad"
    echo "  restart  - Reiniciar el monitoreo de seguridad"
    echo "  status   - Verificar el estado del monitoreo"
    echo "  logs     - Mostrar logs recientes"
    echo "  help     - Mostrar esta ayuda"
    echo ""
    echo "Archivos:"
    echo "  Script: $MONITOR_SCRIPT"
    echo "  PID:    $PID_FILE"
    echo "  Logs:   $LOG_FILE"
}

# Función para mostrar logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo "📝 Últimos logs del monitoreo de seguridad:"
        echo "==========================================="
        tail -n 20 "$LOG_FILE"
    else
        echo "❌ No se encontraron logs"
    fi
}

# Verificar que existe el script de monitoreo
if [ ! -f "$MONITOR_SCRIPT" ]; then
    echo "❌ Error: No se encontró el script de monitoreo en $MONITOR_SCRIPT"
    exit 1
fi

# Crear directorio de logs si no existe
mkdir -p "$(dirname "$LOG_FILE")"

# Procesar comando
case "$1" in
    start)
        start_monitor
        ;;
    stop)
        stop_monitor
        ;;
    restart)
        restart_monitor
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Comando inválido: $1"
        show_help
        exit 1
        ;;
esac

exit $?
