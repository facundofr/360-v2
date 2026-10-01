#!/bin/bash

# 📊 Script de Recolección de Información del VPS para CI/CD
# Recopila información necesaria para configurar deployment

set -e

# 🎨 COLORES
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

title() {
    echo -e "${PURPLE}🎯 $1${NC}"
    echo "════════════════════════════════════════════════════════════════"
}

# 🎨 BANNER
show_banner() {
    clear
    echo -e "${PURPLE}"
    cat << 'EOF'
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║          📊 INFORMACIÓN DEL VPS - COBER360 📊                ║
    ║                                                              ║
    ║     Recopilación de datos para configuración CI/CD          ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

# 🖥️ INFORMACIÓN DEL SISTEMA
get_system_info() {
    title "INFORMACIÓN DEL SISTEMA"
    
    # Sistema operativo
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log "🐧 Sistema Operativo: $PRETTY_NAME"
    else
        log "🐧 Sistema Operativo: $(uname -s) $(uname -r)"
    fi
    
    # Arquitectura
    log "🏗️ Arquitectura: $(uname -m)"
    
    # Uptime
    log "⏰ Uptime: $(uptime -p)"
    
    # Memoria
    local total_mem=$(free -h | awk 'NR==2{print $2}')
    local used_mem=$(free -h | awk 'NR==2{print $3}')
    log "💾 Memoria: $used_mem / $total_mem"
    
    # Disco
    local disk_usage=$(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 ")"}')
    log "💽 Disco: $disk_usage"
    
    # CPU
    local cpu_info=$(lscpu | grep "Model name" | cut -d ':' -f2 | xargs)
    log "🔧 CPU: $cpu_info"
    
    echo ""
}

# 🌐 INFORMACIÓN DE RED
get_network_info() {
    title "INFORMACIÓN DE RED"
    
    # IP pública
    local public_ip=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "No disponible")
    log "🌍 IP Pública: $public_ip"
    
    # IP privada
    local private_ip=$(hostname -I | awk '{print $1}')
    log "🏠 IP Privada: $private_ip"
    
    # Hostname
    log "🏷️ Hostname: $(hostname)"
    
    # Puertos abiertos importantes
    log "🔌 Verificando puertos importantes..."
    
    local ports=("22:SSH" "80:HTTP" "443:HTTPS" "3306:MySQL" "4000:API")
    for port_desc in "${ports[@]}"; do
        local port=${port_desc%%:*}
        local service=${port_desc#*:}
        
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            info "   ✅ Puerto $port ($service): ABIERTO"
        else
            info "   ❌ Puerto $port ($service): CERRADO"
        fi
    done
    
    echo ""
}

# 👥 INFORMACIÓN DE USUARIOS
get_user_info() {
    title "INFORMACIÓN DE USUARIOS"
    
    # Usuario actual
    log "👤 Usuario actual: $(whoami)"
    
    # Usuarios del sistema con shell
    log "👥 Usuarios con shell disponibles:"
    grep -E '/bin/(bash|sh|zsh)$' /etc/passwd | cut -d: -f1 | while read user; do
        info "   • $user"
    done
    
    # Verificar usuario www-data
    if id www-data &>/dev/null; then
        log "🌐 Usuario www-data: ✅ EXISTE"
        info "   Home: $(getent passwd www-data | cut -d: -f6)"
        info "   Shell: $(getent passwd www-data | cut -d: -f7)"
    else
        log "🌐 Usuario www-data: ❌ NO EXISTE"
    fi
    
    # Grupos del usuario actual
    log "👥 Grupos del usuario actual: $(groups)"
    
    echo ""
}

# 🔑 INFORMACIÓN SSH
get_ssh_info() {
    title "INFORMACIÓN SSH"
    
    # Estado del servicio SSH
    if systemctl is-active --quiet ssh 2>/dev/null || systemctl is-active --quiet sshd 2>/dev/null; then
        log "🔑 Servicio SSH: ✅ ACTIVO"
    else
        log "🔑 Servicio SSH: ❌ INACTIVO"
    fi
    
    # Puerto SSH
    local ssh_port=$(grep -E "^Port" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "22")
    log "🔌 Puerto SSH: $ssh_port"
    
    # Configuración SSH
    log "🔧 Configuración SSH importante:"
    
    if grep -q "PermitRootLogin yes" /etc/ssh/sshd_config 2>/dev/null; then
        info "   ⚠️  Root login: PERMITIDO"
    elif grep -q "PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
        info "   ✅ Root login: DESHABILITADO"
    else
        info "   ❓ Root login: CONFIGURACIÓN POR DEFECTO"
    fi
    
    if grep -q "PasswordAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
        info "   🔑 Password auth: HABILITADO"
    elif grep -q "PasswordAuthentication no" /etc/ssh/sshd_config 2>/dev/null; then
        info "   🔑 Password auth: DESHABILITADO (solo claves)"
    fi
    
    # Claves SSH existentes
    log "🗝️ Claves SSH del usuario actual:"
    if [ -d ~/.ssh ]; then
        local key_count=$(ls ~/.ssh/*.pub 2>/dev/null | wc -l)
        if [ $key_count -gt 0 ]; then
            ls ~/.ssh/*.pub 2>/dev/null | while read key; do
                local keyname=$(basename "$key" .pub)
                local keytype=$(ssh-keygen -l -f "$key" 2>/dev/null | awk '{print $4}' | tr -d '()')
                info "   🔑 $keyname ($keytype)"
            done
        else
            info "   ❌ No se encontraron claves SSH públicas"
        fi
    else
        info "   ❌ Directorio ~/.ssh no existe"
    fi
    
    echo ""
}

# 🐳 INFORMACIÓN DE SERVICIOS
get_services_info() {
    title "INFORMACIÓN DE SERVICIOS"
    
    # Node.js
    if command -v node &> /dev/null; then
        log "🟢 Node.js: $(node --version)"
    else
        log "🟢 Node.js: ❌ NO INSTALADO"
    fi
    
    # NPM
    if command -v npm &> /dev/null; then
        log "📦 NPM: $(npm --version)"
    else
        log "📦 NPM: ❌ NO INSTALADO"
    fi
    
    # PM2
    if command -v pm2 &> /dev/null; then
        log "🔄 PM2: $(pm2 --version)"
        
        # Estado de procesos PM2
        local pm2_count=$(pm2 list 2>/dev/null | grep -E "(online|stopped|errored)" | wc -l)
        if [ $pm2_count -gt 0 ]; then
            info "   📊 Procesos PM2 activos: $pm2_count"
        else
            info "   📊 No hay procesos PM2 ejecutándose"
        fi
    else
        log "🔄 PM2: ❌ NO INSTALADO"
    fi
    
    # MySQL
    if command -v mysql &> /dev/null; then
        local mysql_version=$(mysql --version | awk '{print $5}' | sed 's/,//')
        log "🗄️ MySQL: $mysql_version"
        
        if systemctl is-active --quiet mysql 2>/dev/null; then
            info "   🟢 Estado: ACTIVO"
        else
            info "   🔴 Estado: INACTIVO"
        fi
    else
        log "🗄️ MySQL: ❌ NO INSTALADO"
    fi
    
    # Nginx
    if command -v nginx &> /dev/null; then
        local nginx_version=$(nginx -v 2>&1 | cut -d'/' -f2)
        log "🌐 Nginx: $nginx_version"
        
        if systemctl is-active --quiet nginx 2>/dev/null; then
            info "   🟢 Estado: ACTIVO"
        else
            info "   🔴 Estado: INACTIVO"
        fi
    else
        log "🌐 Nginx: ❌ NO INSTALADO"
    fi
    
    # Git
    if command -v git &> /dev/null; then
        log "📚 Git: $(git --version | awk '{print $3}')"
    else
        log "📚 Git: ❌ NO INSTALADO"
    fi
    
    echo ""
}

# 📁 INFORMACIÓN DE DIRECTORIOS
get_directories_info() {
    title "INFORMACIÓN DE DIRECTORIOS DE PROYECTO"
    
    # Directorio de desarrollo
    if [ -d "/var/www/cober360" ]; then
        log "🛠️ Directorio desarrollo: ✅ EXISTE"
        local dev_size=$(du -sh /var/www/cober360 2>/dev/null | cut -f1)
        local dev_files=$(find /var/www/cober360 -type f 2>/dev/null | wc -l)
        info "   📏 Tamaño: $dev_size"
        info "   📄 Archivos: $dev_files"
        
        # Permisos
        local dev_perms=$(stat -c "%U:%G %a" /var/www/cober360 2>/dev/null)
        info "   🔐 Permisos: $dev_perms"
    else
        log "🛠️ Directorio desarrollo: ❌ NO EXISTE"
    fi
    
    # Directorio de producción
    if [ -d "/var/www/cober360-produccion" ]; then
        log "🏭 Directorio producción: ✅ EXISTE"
        local prod_size=$(du -sh /var/www/cober360-produccion 2>/dev/null | cut -f1)
        local prod_files=$(find /var/www/cober360-produccion -type f 2>/dev/null | wc -l)
        info "   📏 Tamaño: $prod_size"
        info "   📄 Archivos: $prod_files"
        
        # Permisos
        local prod_perms=$(stat -c "%U:%G %a" /var/www/cober360-produccion 2>/dev/null)
        info "   🔐 Permisos: $prod_perms"
    else
        log "🏭 Directorio producción: ❌ NO EXISTE"
    fi
    
    # Directorio web raíz
    if [ -d "/var/www" ]; then
        log "🌐 Directorio /var/www: ✅ EXISTE"
        local www_perms=$(stat -c "%U:%G %a" /var/www 2>/dev/null)
        info "   🔐 Permisos: $www_perms"
    fi
    
    echo ""
}

# 🔒 INFORMACIÓN DE SEGURIDAD
get_security_info() {
    title "INFORMACIÓN DE SEGURIDAD"
    
    # Firewall
    if command -v ufw &> /dev/null; then
        local ufw_status=$(ufw status | head -1 | awk '{print $2}')
        log "🔥 UFW Firewall: $ufw_status"
        
        if [ "$ufw_status" = "active" ]; then
            info "   📋 Reglas activas:"
            ufw status numbered | grep -E "^\[" | head -5 | while read rule; do
                info "     • $rule"
            done
        fi
    else
        log "🔥 UFW Firewall: ❌ NO INSTALADO"
    fi
    
    # Fail2ban
    if command -v fail2ban-client &> /dev/null; then
        log "🛡️ Fail2ban: ✅ INSTALADO"
        
        if systemctl is-active --quiet fail2ban 2>/dev/null; then
            info "   🟢 Estado: ACTIVO"
        else
            info "   🔴 Estado: INACTIVO"
        fi
    else
        log "🛡️ Fail2ban: ❌ NO INSTALADO"
    fi
    
    # Intentos de login recientes
    log "🔍 Intentos de login SSH recientes:"
    journalctl -u ssh --since "1 hour ago" --no-pager 2>/dev/null | grep "Failed\|Accepted" | tail -3 | while read line; do
        info "   • $(echo $line | awk '{print $1, $2, $3, $9, $11}')"
    done 2>/dev/null || info "   • No se pudieron obtener logs SSH"
    
    echo ""
}

# 📊 GENERAR RESUMEN PARA CONFIGURACIÓN
generate_configuration_summary() {
    title "RESUMEN PARA CONFIGURACIÓN CI/CD"
    
    # Obtener información clave
    local public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "No disponible")
    local hostname=$(hostname)
    local ssh_port=$(grep -E "^Port" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' || echo "22")
    local current_user=$(whoami)
    
    cat > "/tmp/vps_info_for_cicd.txt" << EOF
# 📊 INFORMACIÓN DEL VPS PARA CONFIGURACIÓN CI/CD
# Generado el: $(date)

## 🌐 CONEXIÓN SSH
SSH_HOST=$public_ip
SSH_PORT=$ssh_port
SSH_USER_CURRENT=$current_user

## 🏷️ IDENTIFICACIÓN
HOSTNAME=$hostname
PUBLIC_IP=$public_ip
PRIVATE_IP=$(hostname -I | awk '{print $1}')

## 📁 DIRECTORIOS
DEVELOPMENT_PATH=/var/www/cober360
PRODUCTION_PATH=/var/www/cober360-produccion

## 🔧 RECOMENDACIONES DE USUARIO SSH:

### Opción 1: Usuario actual ($current_user)
- Ventaja: Ya tiene acceso completo
- Desventaja: Puede ser inseguro si es root
- Usar: SSH_USER=$current_user

### Opción 2: Usuario www-data
- Ventaja: Usuario específico para web
- Configuración adicional: Agregar clave SSH a www-data
- Usar: SSH_USER=www-data

### Opción 3: Crear usuario deploy
- Ventaja: Usuario dedicado solo para deployment
- Comandos:
  sudo useradd -m -s /bin/bash deploy
  sudo usermod -aG sudo deploy
  sudo usermod -aG www-data deploy
- Usar: SSH_USER=deploy

## 🔑 CONFIGURACIÓN DE CLAVES SSH

### Si no tienes claves SSH:
ssh-keygen -t rsa -b 4096 -f ~/.ssh/cober360_deploy -C "deploy@cober360"

### Agregar clave pública al servidor:
ssh-copy-id -i ~/.ssh/cober360_deploy.pub $current_user@$public_ip

### Probar conexión:
ssh -i ~/.ssh/cober360_deploy $current_user@$public_ip

## 📋 VARIABLES PARA GITHUB SECRETS:
SSH_HOST=$public_ip
SSH_USER=$current_user (o el usuario que prefieras)
SSH_PORT=$ssh_port
SSH_KEY=<contenido de la clave privada>

## 🚀 COMANDO PARA CONFIGURAR:
./scripts/configure_github_secrets.sh
EOF

    local summary_file="/tmp/vps_info_for_cicd.txt"
    
    log "📄 Información guardada en: $summary_file"
    echo ""
    
    log "📋 INFORMACIÓN CLAVE PARA CI/CD:"
    echo ""
    info "🌐 IP del servidor: $public_ip"
    info "🔌 Puerto SSH: $ssh_port" 
    info "👤 Usuario actual: $current_user"
    info "🏷️ Hostname: $hostname"
    echo ""
    
    log "🔑 RECOMENDACIONES:"
    echo ""
    info "1. Usar IP: $public_ip como SSH_HOST"
    info "2. Considerar crear usuario dedicado 'deploy'"
    info "3. Configurar clave SSH específica para CI/CD"
    info "4. Probar conexión SSH antes de configurar GitHub"
    echo ""
    
    log "📋 PRÓXIMO PASO:"
    info "Ejecuta: ./scripts/configure_github_secrets.sh"
    echo ""
}

# 🎯 FUNCIÓN PRINCIPAL
main() {
    show_banner
    
    log "🔍 Recopilando información del VPS para configuración CI/CD..."
    echo ""
    
    get_system_info
    get_network_info
    get_user_info
    get_ssh_info
    get_services_info
    get_directories_info
    get_security_info
    generate_configuration_summary
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  📊 ¡INFORMACIÓN RECOPILADA EXITOSAMENTE!                   ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Usa esta información para configurar los secretos de       ║${NC}"
    echo -e "${GREEN}║  GitHub Actions y completar el setup de CI/CD.             ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Ejecutar si se llama directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi