#!/bin/bash

# 🧪 Script de Testing Automatizado para Cober360
# Ejecuta todos los tests antes del deployment

set -e

# 🎨 COLORES
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 📊 CONTADORES
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}"
}

# 📊 FUNCIÓN PARA REGISTRAR RESULTADOS
record_test_result() {
    local test_name=$1
    local result=$2
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    if [ "$result" -eq 0 ]; then
        log "✅ $test_name: PASSED"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        error "❌ $test_name: FAILED"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# 🏥 TEST DE CONECTIVIDAD DE BASE DE DATOS
test_database_connection() {
    info "🗄️ Testing database connection..."
    
    if mysqladmin ping -h localhost --silent 2>/dev/null; then
        record_test_result "Database Connection" 0
    else
        record_test_result "Database Connection" 1
    fi
}

# 🌐 TEST DE API ENDPOINTS
test_api_endpoints() {
    info "🌐 Testing API endpoints..."
    
    local api_base="http://localhost:4000"
    local endpoints=(
        "/health"
        "/auth/verify-token"
    )
    
    # Iniciar servidor si no está corriendo
    if ! curl -f -s "$api_base/health" > /dev/null 2>&1; then
        warn "API no está corriendo, intentando iniciar..."
        cd /var/www/cober360/backend
        npm start &
        API_PID=$!
        sleep 10
    fi
    
    for endpoint in "${endpoints[@]}"; do
        local url="$api_base$endpoint"
        
        if curl -f -s --max-time 10 "$url" > /dev/null 2>&1; then
            record_test_result "API Endpoint: $endpoint" 0
        else
            record_test_result "API Endpoint: $endpoint" 1
        fi
    done
    
    # Detener servidor si lo iniciamos nosotros
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
}

# 🔐 TEST DE SEGURIDAD
test_security() {
    info "🔐 Testing security configurations..."
    
    # Test 1: Verificar que las rutas protegidas requieren autenticación
    local protected_endpoints=(
        "/admin"
        "/prospectos"
        "/sessions"
    )
    
    for endpoint in "${protected_endpoints[@]}"; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4000$endpoint" 2>/dev/null || echo "000")
        
        if [ "$response" = "401" ] || [ "$response" = "403" ]; then
            record_test_result "Security: $endpoint protection" 0
        else
            record_test_result "Security: $endpoint protection" 1
        fi
    done
    
    # Test 2: Verificar headers de seguridad
    local headers=$(curl -I -s "http://localhost:4000/health" 2>/dev/null || echo "")
    
    if echo "$headers" | grep -q "X-Content-Type-Options"; then
        record_test_result "Security: X-Content-Type-Options header" 0
    else
        record_test_result "Security: X-Content-Type-Options header" 1
    fi
}

# 📦 TEST DE DEPENDENCIAS
test_dependencies() {
    info "📦 Testing dependencies..."
    
    # Test Backend
    if [ -f "/var/www/cober360/backend/package.json" ]; then
        cd /var/www/cober360/backend
        
        # Verificar vulnerabilidades
        if npm audit --audit-level moderate > /dev/null 2>&1; then
            record_test_result "Backend Dependencies Security" 0
        else
            record_test_result "Backend Dependencies Security" 1
        fi
        
        # Verificar que se pueden instalar
        if npm ci --silent > /dev/null 2>&1; then
            record_test_result "Backend Dependencies Installation" 0
        else
            record_test_result "Backend Dependencies Installation" 1
        fi
    fi
    
    # Test Frontend
    if [ -f "/var/www/cober360/frontend/package.json" ]; then
        cd /var/www/cober360/frontend
        
        # Verificar vulnerabilidades
        if npm audit --audit-level moderate > /dev/null 2>&1; then
            record_test_result "Frontend Dependencies Security" 0
        else
            record_test_result "Frontend Dependencies Security" 1
        fi
        
        # Verificar build
        if npm run build > /dev/null 2>&1; then
            record_test_result "Frontend Build" 0
        else
            record_test_result "Frontend Build" 1
        fi
    fi
}

# 📁 TEST DE ESTRUCTURA DE ARCHIVOS
test_file_structure() {
    info "📁 Testing file structure..."
    
    local required_files=(
        "/var/www/cober360/backend/server.js"
        "/var/www/cober360/backend/package.json"
        "/var/www/cober360/frontend/package.json"
        "/var/www/cober360/ecosystem.config.js"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            record_test_result "File Structure: $(basename $file)" 0
        else
            record_test_result "File Structure: $(basename $file)" 1
        fi
    done
    
    # Verificar permisos
    local executable_scripts=(
        "/var/www/cober360/scripts/deploy.sh"
        "/var/www/cober360/scripts/setup_cicd.sh"
        "/var/www/cober360/scripts/health_check.sh"
    )
    
    for script in "${executable_scripts[@]}"; do
        if [ -x "$script" ]; then
            record_test_result "Script Permissions: $(basename $script)" 0
        else
            record_test_result "Script Permissions: $(basename $script)" 1
        fi
    done
}

# 🔄 TEST DE PROCESOS PM2
test_pm2_processes() {
    info "🔄 Testing PM2 processes..."
    
    if command -v pm2 &> /dev/null; then
        # Verificar configuración
        if [ -f "/var/www/cober360/ecosystem.config.js" ]; then
            record_test_result "PM2 Configuration File" 0
        else
            record_test_result "PM2 Configuration File" 1
        fi
        
        # Test de startup (sin iniciar realmente)
        cd /var/www/cober360
        if pm2 startOrRestart ecosystem.config.js --dry-run > /dev/null 2>&1; then
            record_test_result "PM2 Configuration Validation" 0
        else
            record_test_result "PM2 Configuration Validation" 1
        fi
    else
        warn "PM2 no está instalado"
        record_test_result "PM2 Installation" 1
    fi
}

# 🌍 TEST DE VARIABLES DE ENTORNO
test_environment_variables() {
    info "🌍 Testing environment variables..."
    
    # Verificar archivos .env
    local env_files=(
        "/var/www/cober360/backend/.env"
        "/var/www/cober360-produccion/backend/.env"
    )
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            # Verificar variables críticas
            local required_vars=(
                "NODE_ENV"
                "PORT"
                "DB_HOST"
                "DB_NAME"
                "JWT_SECRET"
            )
            
            local env_valid=true
            for var in "${required_vars[@]}"; do
                if ! grep -q "^$var=" "$env_file"; then
                    env_valid=false
                    break
                fi
            done
            
            if [ "$env_valid" = true ]; then
                record_test_result "Environment Variables: $(basename $(dirname $env_file))" 0
            else
                record_test_result "Environment Variables: $(basename $(dirname $env_file))" 1
            fi
        else
            record_test_result "Environment File: $(basename $(dirname $env_file))" 1
        fi
    done
}

# 📊 TEST DE PERFORMANCE BÁSICO
test_basic_performance() {
    info "📊 Testing basic performance..."
    
    # Test de tiempo de respuesta de la API
    local start_time=$(date +%s%N)
    if curl -f -s --max-time 5 "http://localhost:4000/health" > /dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 )) # en millisegundos
        
        if [ $duration -lt 1000 ]; then # menos de 1 segundo
            record_test_result "API Response Time (<1s)" 0
        else
            record_test_result "API Response Time (<1s)" 1
        fi
    else
        record_test_result "API Response Time Test" 1
    fi
    
    # Test de uso de memoria
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$memory_usage" -lt 85 ]; then
        record_test_result "System Memory Usage (<85%)" 0
    else
        record_test_result "System Memory Usage (<85%)" 1
    fi
    
    # Test de espacio en disco
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        record_test_result "Disk Usage (<80%)" 0
    else
        record_test_result "Disk Usage (<80%)" 1
    fi
}

# 🔍 TEST DE LOGS
test_logging() {
    info "🔍 Testing logging configuration..."
    
    # Verificar que se pueden escribir logs
    local log_dir="/var/www/cober360/backend/logs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    if touch "$log_dir/test.log" 2>/dev/null; then
        rm "$log_dir/test.log" 2>/dev/null || true
        record_test_result "Log Directory Writable" 0
    else
        record_test_result "Log Directory Writable" 1
    fi
    
    # Verificar rotación de logs
    if command -v logrotate &> /dev/null; then
        record_test_result "Log Rotation Tool Available" 0
    else
        record_test_result "Log Rotation Tool Available" 1
    fi
}

# 📊 GENERAR REPORTE FINAL
generate_report() {
    log "📊 Generando reporte de tests..."
    
    local success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    local report_file="/tmp/cober360_test_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
🧪 REPORTE DE TESTS - COBER360
============================
Fecha: $(date)
Total de tests: $TESTS_TOTAL
Tests exitosos: $TESTS_PASSED
Tests fallidos: $TESTS_FAILED
Tasa de éxito: $success_rate%

Estado: $([ $success_rate -ge 80 ] && echo "✅ ACEPTABLE" || echo "❌ REQUIERE ATENCIÓN")

Detalles ejecutados:
- ✅ Conectividad de base de datos
- ✅ Endpoints de API
- ✅ Configuraciones de seguridad
- ✅ Dependencias y builds
- ✅ Estructura de archivos
- ✅ Procesos PM2
- ✅ Variables de entorno
- ✅ Performance básico
- ✅ Configuración de logs

$([ $TESTS_FAILED -gt 0 ] && echo "⚠️  TESTS FALLIDOS REQUIEREN ATENCIÓN" || echo "🎉 TODOS LOS TESTS PASARON")

Para más detalles, revisar los logs de ejecución.
EOF

    log "📄 Reporte guardado en: $report_file"
    
    # Mostrar resumen
    echo ""
    echo "📊 RESUMEN DE TESTS"
    echo "=================="
    echo "Total: $TESTS_TOTAL | Exitosos: $TESTS_PASSED | Fallidos: $TESTS_FAILED"
    echo "Tasa de éxito: $success_rate%"
    
    if [ $success_rate -ge 80 ]; then
        log "🎉 Tests completados exitosamente - Sistema listo para deploy"
        return 0
    else
        error "❌ Tests fallaron - No se recomienda hacer deploy"
        return 1
    fi
}

# 🎯 FUNCIÓN PRINCIPAL
main() {
    log "🧪 Iniciando suite de tests para Cober360"
    
    # Ejecutar todos los tests
    test_database_connection
    test_api_endpoints
    test_security
    test_dependencies
    test_file_structure
    test_pm2_processes
    test_environment_variables
    test_basic_performance
    test_logging
    
    # Generar reporte
    generate_report
}

# 📋 FUNCIÓN DE AYUDA
show_help() {
    echo "🧪 Script de Testing Automatizado para Cober360"
    echo ""
    echo "Uso: $0 [OPCIÓN]"
    echo ""
    echo "Opciones:"
    echo "  all        Ejecutar todos los tests (por defecto)"
    echo "  db         Solo test de base de datos"
    echo "  api        Solo test de API"
    echo "  security   Solo test de seguridad"
    echo "  deps       Solo test de dependencias"
    echo "  structure  Solo test de estructura"
    echo "  pm2        Solo test de PM2"
    echo "  env        Solo test de variables de entorno"
    echo "  perf       Solo test de performance"
    echo "  logs       Solo test de logging"
    echo "  help       Mostrar esta ayuda"
    echo ""
}

# 🎯 MANEJO DE ARGUMENTOS
case "${1:-all}" in
    "all")
        main
        ;;
    "db")
        test_database_connection
        generate_report
        ;;
    "api")
        test_api_endpoints
        generate_report
        ;;
    "security")
        test_security
        generate_report
        ;;
    "deps")
        test_dependencies
        generate_report
        ;;
    "structure")
        test_file_structure
        generate_report
        ;;
    "pm2")
        test_pm2_processes
        generate_report
        ;;
    "env")
        test_environment_variables
        generate_report
        ;;
    "perf")
        test_basic_performance
        generate_report
        ;;
    "logs")
        test_logging
        generate_report
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Opción no válida: $1. Usa '$0 help' para ver las opciones disponibles."
        ;;
esac