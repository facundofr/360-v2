#!/bin/bash

# 🔒 Script para monitorear fail2ban
# Uso: ./scripts/check_fail2ban.sh [opcion]

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 🎨 Función para mostrar header
show_header() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}🔒 MONITOR DE FAIL2BAN - COBER360${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
}

# 📊 Función para mostrar estado general
show_general_status() {
    echo -e "${YELLOW}📊 Estado General de Fail2ban:${NC}"
    sudo fail2ban-client status
    echo ""
}

# 🚫 Función para mostrar IPs bloqueadas por jail
show_jail_status() {
    local jail=$1
    echo -e "${YELLOW}🔍 Estado de la jail: ${jail}${NC}"
    sudo fail2ban-client status "$jail"
    echo ""
}

# 📋 Función para mostrar todas las IPs bloqueadas
show_all_banned() {
    echo -e "${RED}🚫 IPs ACTUALMENTE BLOQUEADAS:${NC}"
    echo ""
    
    # Obtener lista de jails
    jails=$(sudo fail2ban-client status | grep "Jail list:" | cut -d: -f2 | tr ',' '\n' | tr -d ' ')
    
    total_banned=0
    
    for jail in $jails; do
        # Obtener IPs bloqueadas de esta jail
        banned_ips=$(sudo fail2ban-client status "$jail" | grep "Banned IP list:" | cut -d: -f2 | tr -d ' ')
        banned_count=$(sudo fail2ban-client status "$jail" | grep "Currently banned:" | awk '{print $3}')
        
        if [ "$banned_count" -gt 0 ]; then
            echo -e "${YELLOW}📦 Jail: ${jail}${NC}"
            echo -e "   🚫 IPs bloqueadas (${banned_count}):"
            
            # Mostrar cada IP bloqueada
            for ip in $banned_ips; do
                if [ ! -z "$ip" ]; then
                    echo -e "      ${RED}• ${ip}${NC}"
                    ((total_banned++))
                fi
            done
            echo ""
        fi
    done
    
    echo -e "${BLUE}📊 Total de IPs bloqueadas: ${total_banned}${NC}"
    echo ""
}

# 📈 Función para mostrar estadísticas detalladas
show_detailed_stats() {
    echo -e "${YELLOW}📈 ESTADÍSTICAS DETALLADAS:${NC}"
    echo ""
    
    jails=$(sudo fail2ban-client status | grep "Jail list:" | cut -d: -f2 | tr ',' '\n' | tr -d ' ')
    
    for jail in $jails; do
        echo -e "${BLUE}🔐 Jail: ${jail}${NC}"
        
        status_output=$(sudo fail2ban-client status "$jail")
        
        currently_failed=$(echo "$status_output" | grep "Currently failed:" | awk '{print $3}')
        total_failed=$(echo "$status_output" | grep "Total failed:" | awk '{print $3}')
        currently_banned=$(echo "$status_output" | grep "Currently banned:" | awk '{print $3}')
        total_banned=$(echo "$status_output" | grep "Total banned:" | awk '{print $3}')
        
        echo "   📊 Intentos fallidos actuales: $currently_failed"
        echo "   📊 Total intentos fallidos: $total_failed"
        echo "   🚫 IPs bloqueadas actualmente: $currently_banned"
        echo "   🚫 Total de IPs bloqueadas: $total_banned"
        echo ""
    done
}

# 🕒 Función para mostrar log reciente
show_recent_logs() {
    echo -e "${YELLOW}🕒 ACTIVIDAD RECIENTE DE FAIL2BAN:${NC}"
    echo ""
    sudo tail -20 /var/log/fail2ban.log | while read line; do
        if [[ $line == *"Ban"* ]]; then
            echo -e "${RED}$line${NC}"
        elif [[ $line == *"Unban"* ]]; then
            echo -e "${GREEN}$line${NC}"
        else
            echo "$line"
        fi
    done
    echo ""
}

# 🔧 Función para desbloquear una IP
unban_ip() {
    local ip=$1
    if [ -z "$ip" ]; then
        echo -e "${RED}❌ Error: Debes especificar una IP${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}🔓 Intentando desbloquear IP: ${ip}${NC}"
    
    # Buscar en qué jail está la IP
    jails=$(sudo fail2ban-client status | grep "Jail list:" | cut -d: -f2 | tr ',' '\n' | tr -d ' ')
    
    found=false
    for jail in $jails; do
        banned_ips=$(sudo fail2ban-client status "$jail" | grep "Banned IP list:" | cut -d: -f2)
        if [[ $banned_ips == *"$ip"* ]]; then
            echo -e "${BLUE}🔍 IP encontrada en jail: ${jail}${NC}"
            sudo fail2ban-client unban "$ip"
            echo -e "${GREEN}✅ IP ${ip} desbloqueada de ${jail}${NC}"
            found=true
        fi
    done
    
    if [ "$found" = false ]; then
        echo -e "${YELLOW}⚠️  IP ${ip} no encontrada en ninguna jail${NC}"
    fi
}

# 📋 Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🔒 === MONITOR DE FAIL2BAN ===${NC}"
    echo ""
    echo "Uso: $0 [opción]"
    echo ""
    echo "Opciones disponibles:"
    echo "  status        Mostrar estado general"
    echo "  banned        Mostrar todas las IPs bloqueadas"
    echo "  stats         Mostrar estadísticas detalladas"
    echo "  logs          Mostrar actividad reciente"
    echo "  unban [ip]    Desbloquear una IP específica"
    echo "  jail [nombre] Mostrar estado de una jail específica"
    echo "  all           Mostrar información completa"
    echo "  help          Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 banned"
    echo "  $0 unban 192.168.1.100"
    echo "  $0 jail sshd"
    echo ""
}

# 🚀 Función principal
main() {
    case "${1:-all}" in
        "status")
            show_header
            show_general_status
            ;;
        "banned")
            show_header
            show_all_banned
            ;;
        "stats")
            show_header
            show_detailed_stats
            ;;
        "logs")
            show_header
            show_recent_logs
            ;;
        "unban")
            show_header
            unban_ip "$2"
            ;;
        "jail")
            show_header
            show_jail_status "$2"
            ;;
        "all")
            show_header
            show_general_status
            show_all_banned
            show_detailed_stats
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            echo -e "${RED}❌ Opción desconocida: $1${NC}"
            show_help
            ;;
    esac
}

# Verificar si el usuario es root o tiene sudo
if ! sudo -n true 2>/dev/null; then
    echo -e "${RED}❌ Este script requiere permisos de sudo${NC}"
    exit 1
fi

# Ejecutar función principal
main "$@"
