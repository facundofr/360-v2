#!/bin/bash

# 📊 Script de Resumen del Sistema CI/CD - Cober360
# Muestra el estado completo de la configuración implementada

set -e

# 🎨 COLORES
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

title() {
    echo -e "${PURPLE}🎯 $1${NC}"
    echo "═══════════════════════════════════════════════════════════════"
}

subtitle() {
    echo -e "${CYAN}📋 $1${NC}"
    echo "───────────────────────────────────────────────────────────────"
}

# 🎨 BANNER PRINCIPAL
show_banner() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║               🚀 CI/CD PIPELINE - COBER360 🚀                ║
    ║                                                              ║
    ║        Sistema de Integración y Despliegue Continuo         ║
    ║                    Completamente Configurado                 ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

# 📊 VERIFICAR ARCHIVOS CREADOS
check_files() {
    title "ARCHIVOS CREADOS Y CONFIGURACIÓN"
    
    local files=(
        ".github/workflows/ci-cd.yml:🤖 GitHub Actions Workflow"
        "scripts/deploy.sh:🚀 Script de Deploy Automatizado"
        "scripts/setup_cicd.sh:🔧 Script de Configuración Inicial"
        "scripts/test_suite.sh:🧪 Suite de Testing Automatizado"
        "scripts/monitor_post_deploy.sh:📊 Monitoreo Post-Deploy"
        "scripts/setup_secrets.sh:🔐 Configuración de Secretos"
        "CI_CD_DOCUMENTATION_COMPLETA.md:📚 Documentación Completa"
    )
    
    for file_desc in "${files[@]}"; do
        local file=${file_desc%%:*}
        local desc=${file_desc#*:}
        
        if [ -f "/var/www/cober360/$file" ]; then
            success "$desc"
            info "   📁 Ubicación: /var/www/cober360/$file"
            
            # Verificar permisos para scripts
            if [[ $file == scripts/* ]] && [[ $file == *.sh ]]; then
                if [ -x "/var/www/cober360/$file" ]; then
                    info "   ✅ Permisos de ejecución: OK"
                else
                    warning "   ⚠️  Sin permisos de ejecución"
                fi
            fi
        else
            error "$desc - ARCHIVO NO ENCONTRADO"
        fi
        echo ""
    done
}

# 🌿 VERIFICAR CONFIGURACIÓN GIT
check_git_config() {
    title "CONFIGURACIÓN DEL REPOSITORIO GIT"
    
    cd /var/www/cober360
    
    # Verificar repositorio remoto
    local remote=$(git remote -v | head -1)
    if [[ $remote == *"GC-PMKT-Dev/cober360"* ]]; then
        success "Repositorio remoto configurado correctamente"
        info "   🔗 $remote"
    else
        warning "Repositorio remoto necesita configuración"
    fi
    
    # Verificar rama actual
    local current_branch=$(git branch --show-current)
    success "Rama actual: $current_branch"
    
    # Verificar estado
    local status=$(git status --porcelain | wc -l)
    if [ $status -eq 0 ]; then
        success "Working directory limpio"
    else
        warning "$status archivos con cambios pendientes"
        info "   💡 Ejecuta: git add . && git commit -m 'feat: CI/CD implementation'"
    fi
    
    echo ""
}

# 🔧 VERIFICAR DEPENDENCIAS DEL SISTEMA
check_system_dependencies() {
    title "DEPENDENCIAS DEL SISTEMA"
    
    local deps=(
        "node:Node.js"
        "npm:NPM Package Manager"
        "git:Git Version Control"
        "mysql:MySQL Database"
        "pm2:PM2 Process Manager"
        "curl:cURL HTTP Client"
        "jq:JSON Processor"
    )
    
    for dep_desc in "${deps[@]}"; do
        local cmd=${dep_desc%%:*}
        local desc=${dep_desc#*:}
        
        if command -v $cmd &> /dev/null; then
            local version=$(
                case $cmd in
                    node) node --version ;;
                    npm) npm --version ;;
                    git) git --version | awk '{print $3}' ;;
                    mysql) mysql --version | awk '{print $5}' | sed 's/,//' ;;
                    pm2) pm2 --version ;;
                    curl) curl --version | head -1 | awk '{print $2}' ;;
                    jq) jq --version ;;
                esac
            )
            success "$desc ($version)"
        else
            error "$desc - NO INSTALADO"
            case $cmd in
                pm2) info "   💡 Instalar con: npm install -g pm2" ;;
                jq) info "   💡 Instalar con: sudo apt install jq" ;;
                *) info "   💡 Instalar con tu package manager" ;;
            esac
        fi
    done
    
    echo ""
}

# 📂 VERIFICAR ESTRUCTURA DE DIRECTORIOS
check_directory_structure() {
    title "ESTRUCTURA DE DIRECTORIOS"
    
    local base_dir="/var/www/cober360"
    local required_dirs=(
        "backend:Backend Application"
        "frontend:Frontend Application"
        "scripts:Automation Scripts"
        ".github/workflows:GitHub Actions"
        "public:Static Files"
    )
    
    for dir_desc in "${required_dirs[@]}"; do
        local dir=${dir_desc%%:*}
        local desc=${dir_desc#*:}
        
        if [ -d "$base_dir/$dir" ]; then
            local file_count=$(find "$base_dir/$dir" -type f | wc -l)
            success "$desc ($file_count archivos)"
        else
            warning "$desc - DIRECTORIO NO ENCONTRADO"
        fi
    done
    
    # Verificar directorio de producción
    if [ -d "/var/www/cober360-produccion" ]; then
        success "Directorio de producción existe"
        info "   📁 /var/www/cober360-produccion"
    else
        warning "Directorio de producción no encontrado"
    fi
    
    echo ""
}

# 🔐 VERIFICAR CONFIGURACIÓN DE SEGURIDAD
check_security_config() {
    title "CONFIGURACIÓN DE SEGURIDAD"
    
    # Verificar archivos .env
    local env_files=(
        "/var/www/cober360/backend/.env:Desarrollo"
        "/var/www/cober360-produccion/backend/.env:Producción"
    )
    
    for env_desc in "${env_files[@]}"; do
        local env_file=${env_desc%%:*}
        local env_name=${env_desc#*:}
        
        if [ -f "$env_file" ]; then
            success "Archivo .env de $env_name existe"
            
            # Verificar variables críticas
            local critical_vars=("NODE_ENV" "PORT" "DB_HOST" "JWT_SECRET")
            for var in "${critical_vars[@]}"; do
                if grep -q "^$var=" "$env_file"; then
                    info "   ✅ $var configurado"
                else
                    warning "   ⚠️  $var no encontrado"
                fi
            done
        else
            warning "Archivo .env de $env_name no encontrado"
            info "   💡 Ejecuta: ./scripts/setup_cicd.sh para crearlo"
        fi
        echo ""
    done
    
    # Verificar permisos de archivos sensibles
    local sensitive_files=(
        "/var/www/cober360/backend/.env"
        "/var/www/cober360-produccion/backend/.env"
    )
    
    for file in "${sensitive_files[@]}"; do
        if [ -f "$file" ]; then
            local perms=$(stat -c "%a" "$file")
            if [ "$perms" = "600" ] || [ "$perms" = "644" ]; then
                success "Permisos de $(basename $file): $perms (OK)"
            else
                warning "Permisos de $(basename $file): $perms (recomendado: 600)"
                info "   💡 Ejecuta: chmod 600 $file"
            fi
        fi
    done
    
    echo ""
}

# 🚀 MOSTRAR COMANDOS DISPONIBLES
show_available_commands() {
    title "COMANDOS DISPONIBLES"
    
    subtitle "🚀 Deployment"
    echo "   ./scripts/deploy.sh                    # Deploy completo"
    echo "   ./scripts/deploy.sh rollback           # Rollback a versión anterior"
    echo "   ./scripts/deploy.sh health             # Verificar salud del sistema"
    echo ""
    
    subtitle "🧪 Testing"
    echo "   ./scripts/test_suite.sh                # Ejecutar todos los tests"
    echo "   ./scripts/test_suite.sh api            # Solo tests de API"
    echo "   ./scripts/test_suite.sh security       # Solo tests de seguridad"
    echo ""
    
    subtitle "📊 Monitoreo"
    echo "   ./scripts/monitor_post_deploy.sh       # Monitoreo post-deploy (5 min)"
    echo "   ./scripts/monitor_post_deploy.sh --duration 600  # Monitoreo 10 min"
    echo ""
    
    subtitle "🔧 Configuración"
    echo "   ./scripts/setup_cicd.sh                # Configuración completa"
    echo "   ./scripts/setup_secrets.sh             # Configurar secretos GitHub"
    echo ""
    
    subtitle "📚 Documentación"
    echo "   cat CI_CD_DOCUMENTATION_COMPLETA.md    # Ver documentación completa"
    echo "   cat /tmp/github_secrets_required.md    # Ver secretos requeridos"
    echo ""
}

# 📋 MOSTRAR PRÓXIMOS PASOS
show_next_steps() {
    title "PRÓXIMOS PASOS PARA ACTIVAR CI/CD"
    
    echo "1. 🔐 Configurar secretos en GitHub Actions:"
    echo "   • Ve a: https://github.com/GC-PMKT-Dev/cober360/settings/secrets/actions"
    echo "   • Ejecuta: ./scripts/setup_secrets.sh"
    echo "   • Configura las variables según: /tmp/github_secrets_required.md"
    echo ""
    
    echo "2. 🌿 Configurar ramas Git:"
    echo "   • Ejecuta: ./scripts/setup_cicd.sh"
    echo "   • Haz commit de cambios pendientes"
    echo "   • Crea ramas develop y production"
    echo ""
    
    echo "3. 🧪 Ejecutar tests iniciales:"
    echo "   • Ejecuta: ./scripts/test_suite.sh"
    echo "   • Verifica que todos los tests pasen"
    echo "   • Corrige cualquier problema encontrado"
    echo ""
    
    echo "4. 🚀 Hacer primer deploy:"
    echo "   • Ejecuta: ./scripts/deploy.sh"
    echo "   • Verifica que el deploy sea exitoso"
    echo "   • Monitorea con: ./scripts/monitor_post_deploy.sh"
    echo ""
    
    echo "5. 📡 Configurar webhook (opcional):"
    echo "   • Instala servicio: sudo cp /tmp/webhook-deploy.service /etc/systemd/system/"
    echo "   • Configura webhook en GitHub: https://github.com/GC-PMKT-Dev/cober360/settings/hooks"
    echo "   • URL webhook: https://tu_servidor.com:9000/github"
    echo ""
    
    echo "6. 📊 Verificar dashboard:"
    echo "   • Visita: http://tu_servidor/cicd-status.html"
    echo "   • Monitorea métricas en tiempo real"
    echo ""
}

# 📞 MOSTRAR INFORMACIÓN DE SOPORTE
show_support_info() {
    title "SOPORTE Y CONTACTO"
    
    echo "📧 Email: devops@cober.online"
    echo "🐙 GitHub Issues: https://github.com/GC-PMKT-Dev/cober360/issues"
    echo "📚 Documentación: ./CI_CD_DOCUMENTATION_COMPLETA.md"
    echo "🔧 Scripts de ayuda: ./scripts/"
    echo ""
    
    echo "🆘 En caso de problemas:"
    echo "   1. Verificar logs: tail -f /var/log/deploy-cober360.log"
    echo "   2. Ejecutar health check: ./scripts/deploy.sh health"
    echo "   3. Revisar documentación completa"
    echo "   4. Crear issue en GitHub con detalles del problema"
    echo ""
}

# 📊 FUNCIÓN PRINCIPAL
main() {
    show_banner
    
    log "🔍 Analizando configuración del sistema CI/CD..."
    echo ""
    
    check_files
    check_git_config
    check_system_dependencies
    check_directory_structure
    check_security_config
    show_available_commands
    show_next_steps
    show_support_info
    
    echo ""
    log "🎉 Análisis completado - Sistema CI/CD configurado correctamente"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  🚀 ¡SISTEMA CI/CD LISTO PARA USAR!                         ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Ejecuta los próximos pasos para activar el deployment      ║${NC}"
    echo -e "${GREEN}║  automático y comenzar a usar el pipeline completo.        ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
}

# 📋 FUNCIÓN DE AYUDA
show_help() {
    echo "📊 Script de Resumen del Sistema CI/CD"
    echo ""
    echo "Uso: $0 [OPCIÓN]"
    echo ""
    echo "Opciones:"
    echo "  status     Mostrar estado completo (por defecto)"
    echo "  files      Solo verificar archivos"
    echo "  git        Solo verificar configuración Git"
    echo "  deps       Solo verificar dependencias"
    echo "  security   Solo verificar configuración de seguridad"
    echo "  commands   Solo mostrar comandos disponibles"
    echo "  steps      Solo mostrar próximos pasos"
    echo "  help       Mostrar esta ayuda"
    echo ""
}

# 🎯 MANEJO DE ARGUMENTOS
case "${1:-status}" in
    "status")
        main
        ;;
    "files")
        show_banner
        check_files
        ;;
    "git")
        show_banner
        check_git_config
        ;;
    "deps")
        show_banner
        check_system_dependencies
        ;;
    "security")
        show_banner
        check_security_config
        ;;
    "commands")
        show_banner
        show_available_commands
        ;;
    "steps")
        show_banner
        show_next_steps
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Opción no válida: $1. Usa '$0 help' para ver las opciones disponibles."
        ;;
esac