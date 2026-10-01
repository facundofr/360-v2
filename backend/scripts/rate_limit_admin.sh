#!/bin/bash

# 🛡️ Script de Administración de Rate Limits
# Uso: ./rate_limit_admin.sh [comando] [argumentos]

API_BASE="http://localhost:4000"
ADMIN_TOKEN=""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🛡️ Rate Limit Admin - Sistema de Gestión${NC}"
    echo ""
    echo "Uso: $0 [comando] [argumentos]"
    echo ""
    echo "Comandos disponibles:"
    echo "  info <ip>           - Obtener información de rate limit para una IP"
    echo "  reset <ip>          - Resetear rate limit para una IP específica"
    echo "  reset-bulk <ips>    - Resetear rate limits para múltiples IPs (separadas por comas)"
    echo "  login <email> <pass> - Hacer login como administrador"
    echo "  status             - Verificar status del sistema"
    echo "  help               - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 login admin@cober360.com mi_password"
    echo "  $0 info 192.168.1.100"
    echo "  $0 reset 201.212.96.163"
    echo "  $0 reset-bulk \"192.168.1.100,192.168.1.101,192.168.1.102\""
}

# Función para hacer login
admin_login() {
    local email="$1"
    local password="$2"
    
    if [[ -z "$email" || -z "$password" ]]; then
        echo -e "${RED}❌ Error: Email y password son requeridos${NC}"
        echo "Uso: $0 login <email> <password>"
        exit 1
    fi
    
    echo -e "${BLUE}🔐 Iniciando sesión como administrador...${NC}"
    
    response=$(curl -s -X POST "${API_BASE}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    token=$(echo "$response" | jq -r '.token // empty')
    
    if [[ -n "$token" && "$token" != "null" ]]; then
        echo "$token" > ~/.cober360_admin_token
        echo -e "${GREEN}✅ Login exitoso - Token guardado${NC}"
        ADMIN_TOKEN="$token"
    else
        echo -e "${RED}❌ Error de login:${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# Función para cargar token
load_token() {
    if [[ -f ~/.cober360_admin_token ]]; then
        ADMIN_TOKEN=$(cat ~/.cober360_admin_token)
    fi
    
    if [[ -z "$ADMIN_TOKEN" ]]; then
        echo -e "${RED}❌ No hay token de administrador disponible${NC}"
        echo "Por favor ejecuta: $0 login <email> <password>"
        exit 1
    fi
}

# Función para obtener información de rate limit
get_rate_limit_info() {
    local ip="$1"
    
    if [[ -z "$ip" ]]; then
        echo -e "${RED}❌ Error: IP es requerida${NC}"
        echo "Uso: $0 info <ip>"
        exit 1
    fi
    
    load_token
    
    echo -e "${BLUE}📊 Obteniendo información de rate limit para IP: $ip${NC}"
    
    response=$(curl -s -X GET "${API_BASE}/admin/rate-limits/info/$ip" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Información obtenida:${NC}"
        echo "$response" | jq '.data'
    else
        echo -e "${RED}❌ Error:${NC}"
        echo "$response" | jq '.'
    fi
}

# Función para resetear rate limit
reset_rate_limit() {
    local ip="$1"
    
    if [[ -z "$ip" ]]; then
        echo -e "${RED}❌ Error: IP es requerida${NC}"
        echo "Uso: $0 reset <ip>"
        exit 1
    fi
    
    load_token
    
    echo -e "${YELLOW}🔄 Reseteando rate limit para IP: $ip${NC}"
    
    response=$(curl -s -X POST "${API_BASE}/admin/rate-limits/reset/$ip" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"type":"login"}')
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Rate limit reseteado exitosamente${NC}"
        echo "$response" | jq '{message, ip, resetBy, timestamp}'
    else
        echo -e "${RED}❌ Error:${NC}"
        echo "$response" | jq '.'
    fi
}

# Función para resetear múltiples rate limits
reset_bulk_rate_limits() {
    local ips_string="$1"
    
    if [[ -z "$ips_string" ]]; then
        echo -e "${RED}❌ Error: Lista de IPs es requerida${NC}"
        echo "Uso: $0 reset-bulk \"ip1,ip2,ip3\""
        exit 1
    fi
    
    load_token
    
    # Convertir string de IPs separadas por comas a array JSON
    IFS=',' read -ra IPS_ARRAY <<< "$ips_string"
    ips_json="["
    for i in "${!IPS_ARRAY[@]}"; do
        if [[ $i -gt 0 ]]; then
            ips_json+=","
        fi
        ips_json+="\"${IPS_ARRAY[$i]}\""
    done
    ips_json+="]"
    
    echo -e "${YELLOW}🔄 Reseteando rate limits para ${#IPS_ARRAY[@]} IPs...${NC}"
    
    response=$(curl -s -X POST "${API_BASE}/admin/rate-limits/reset-bulk" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"ips\":$ips_json,\"type\":\"login\"}")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Rate limits reseteados:${NC}"
        echo "$response" | jq '{message, resetBy}'
        echo ""
        echo -e "${BLUE}📋 Resultados detallados:${NC}"
        echo "$response" | jq '.results[]'
    else
        echo -e "${RED}❌ Error:${NC}"
        echo "$response" | jq '.'
    fi
}

# Función para verificar status del sistema
check_status() {
    echo -e "${BLUE}🏥 Verificando status del sistema...${NC}"
    
    response=$(curl -s -X GET "${API_BASE}/health/security")
    
    if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
        status=$(echo "$response" | jq -r '.status')
        if [[ "$status" == "healthy" ]]; then
            echo -e "${GREEN}✅ Sistema saludable${NC}"
        else
            echo -e "${YELLOW}⚠️ Sistema con alertas${NC}"
        fi
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ Error al conectar con el servidor${NC}"
        echo "$response"
    fi
}

# Main script
case "$1" in
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    "login")
        admin_login "$2" "$3"
        ;;
    "info")
        get_rate_limit_info "$2"
        ;;
    "reset")
        reset_rate_limit "$2"
        ;;
    "reset-bulk")
        reset_bulk_rate_limits "$2"
        ;;
    "status")
        check_status
        ;;
    *)
        echo -e "${RED}❌ Comando desconocido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
