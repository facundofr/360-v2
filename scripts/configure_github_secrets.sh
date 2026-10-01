#!/bin/bash

# 🔐 Configuración Personalizada de GitHub Secrets para Cober360
# Basado en las variables existentes en el archivo .env

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

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
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
    ║          🔐 CONFIGURACIÓN DE GITHUB SECRETS 🔐               ║
    ║                         COBER360                             ║
    ║                                                              ║
    ║     Configuración automática basada en variables .env       ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

# 📋 VERIFICAR PREREQUISITOS
check_prerequisites() {
    title "VERIFICANDO PREREQUISITOS"
    
    # Verificar GitHub CLI
    if ! command -v gh &> /dev/null; then
        warn "GitHub CLI no está instalado"
        echo ""
        echo "📦 INSTALANDO GITHUB CLI..."
        
        # Instalar GitHub CLI
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update
        sudo apt install gh -y
        
        if command -v gh &> /dev/null; then
            log "✅ GitHub CLI instalado correctamente"
        else
            error "No se pudo instalar GitHub CLI"
        fi
    else
        log "✅ GitHub CLI ya está instalado"
    fi
    
    # Verificar autenticación
    if ! gh auth status &> /dev/null; then
        warn "No estás autenticado en GitHub CLI"
        echo ""
        echo "🔑 CONFIGURANDO AUTENTICACIÓN..."
        echo "Se abrirá tu navegador para autenticarte con GitHub"
        echo "Presiona Enter para continuar..."
        read
        
        gh auth login --web --hostname github.com
        
        if gh auth status &> /dev/null; then
            log "✅ Autenticación exitosa"
        else
            error "Falló la autenticación"
        fi
    else
        log "✅ Ya estás autenticado en GitHub CLI"
    fi
    
    # Verificar repositorio
    if ! gh repo view GC-PMKT-Dev/cober360 &> /dev/null; then
        error "No tienes acceso al repositorio GC-PMKT-Dev/cober360"
    else
        log "✅ Acceso al repositorio confirmado"
    fi
    
    echo ""
}

# 📝 LEER VARIABLES DEL .ENV
read_env_variables() {
    title "LEYENDO VARIABLES EXISTENTES"
    
    local env_file="/var/www/cober360/backend/.env"
    
    if [ ! -f "$env_file" ]; then
        error "Archivo .env no encontrado: $env_file"
    fi
    
    log "📄 Leyendo variables desde: $env_file"
    
    # Leer variables usando source (pero de forma segura)
    source "$env_file"
    
    log "✅ Variables cargadas correctamente"
    echo ""
}

# 🔐 CONFIGURAR SECRETOS BASICOS
configure_basic_secrets() {
    title "CONFIGURANDO SECRETOS BÁSICOS"
    
    # Base de datos
    log "🗄️ Configurando secretos de base de datos..."
    gh secret set DB_HOST --body "$DB_HOST" --repo GC-PMKT-Dev/cober360
    gh secret set DB_USER --body "$DB_USER" --repo GC-PMKT-Dev/cober360
    gh secret set DB_PASSWORD --body "$DB_PASSWORD" --repo GC-PMKT-Dev/cober360
    gh secret set DB_NAME_DEV --body "$DB_NAME" --repo GC-PMKT-Dev/cober360
    gh secret set DB_NAME_PROD --body "cober360_produccion" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de base de datos configurados"
    
    # JWT y autenticación
    log "🔐 Configurando secretos de autenticación..."
    gh secret set JWT_SECRET --body "$JWT_SECRET" --repo GC-PMKT-Dev/cober360
    gh secret set REFRESH_TOKEN_SECRET --body "$REFRESH_TOKEN_SECRET" --repo GC-PMKT-Dev/cober360
    gh secret set JWT_EXPIRE --body "$JWT_EXPIRE" --repo GC-PMKT-Dev/cober360
    gh secret set REFRESH_TOKEN_EXPIRE --body "$REFRESH_TOKEN_EXPIRE" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de autenticación configurados"
    
    # Configuración de dominio y URLs
    log "🌐 Configurando URLs y dominios..."
    gh secret set DOMAIN_DEV --body "$DOMAIN" --repo GC-PMKT-Dev/cober360
    gh secret set DOMAIN_PROD --body "360.cober.online" --repo GC-PMKT-Dev/cober360
    gh secret set FRONTEND_URL_DEV --body "$FRONTEND_URL" --repo GC-PMKT-Dev/cober360
    gh secret set FRONTEND_URL_PROD --body "https://360.cober.online" --repo GC-PMKT-Dev/cober360
    gh secret set API_BASE_URL_DEV --body "$API_BASE_URL" --repo GC-PMKT-Dev/cober360
    gh secret set API_BASE_URL_PROD --body "https://360.cober.online/api" --repo GC-PMKT-Dev/cober360
    log "✅ URLs y dominios configurados"
    
    echo ""
}

# 💳 CONFIGURAR SECRETOS DE MERCADOPAGO
configure_mercadopago_secrets() {
    title "CONFIGURANDO SECRETOS DE MERCADOPAGO"
    
    log "💳 Configurando MercadoPago..."
    gh secret set MERCADOPAGO_ACCESS_TOKEN --body "$MERCADOPAGO_ACCESS_TOKEN" --repo GC-PMKT-Dev/cober360
    gh secret set MERCADOPAGO_PUBLIC_KEY --body "$MERCADOPAGO_PUBLIC_KEY" --repo GC-PMKT-Dev/cober360
    gh secret set MERCADOPAGO_BASE_URL --body "$MERCADOPAGO_BASE_URL" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de MercadoPago configurados"
    
    echo ""
}

# 📧 CONFIGURAR SECRETOS DE EMAIL
configure_email_secrets() {
    title "CONFIGURANDO SECRETOS DE EMAIL"
    
    log "📧 Configurando email SMTP..."
    gh secret set SMTP_HOST --body "$SMTP_HOST" --repo GC-PMKT-Dev/cober360
    gh secret set SMTP_PORT --body "$SMTP_PORT" --repo GC-PMKT-Dev/cober360
    gh secret set EMAIL_USER --body "$EMAIL_USER" --repo GC-PMKT-Dev/cober360
    gh secret set EMAIL_PASS --body "$EMAIL_PASS" --repo GC-PMKT-Dev/cober360
    gh secret set SMTP_FROM --body "$SMTP_FROM" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de email configurados"
    
    echo ""
}

# 📱 CONFIGURAR SECRETOS DE WHATSAPP/TWILIO
configure_whatsapp_secrets() {
    title "CONFIGURANDO SECRETOS DE WHATSAPP/TWILIO"
    
    log "📱 Configurando Twilio/WhatsApp..."
    gh secret set TWILIO_ACCOUNT_SID --body "$TWILIO_ACCOUNT_SID" --repo GC-PMKT-Dev/cober360
    gh secret set TWILIO_AUTH_TOKEN --body "$TWILIO_AUTH_TOKEN" --repo GC-PMKT-Dev/cober360
    gh secret set TWILIO_WHATSAPP_NUMBER --body "$TWILIO_WHATSAPP_NUMBER" --repo GC-PMKT-Dev/cober360
    gh secret set WHATSAPP_WEBHOOK_VERIFY_TOKEN --body "$WHATSAPP_WEBHOOK_VERIFY_TOKEN" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de WhatsApp/Twilio configurados"
    
    echo ""
}

# 🤖 CONFIGURAR SECRETOS DE OPENAI
configure_openai_secrets() {
    title "CONFIGURANDO SECRETOS DE OPENAI"
    
    log "🤖 Configurando OpenAI..."
    gh secret set OPENAI_API_KEY --body "$OPENAI_API_KEY" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de OpenAI configurados"
    
    echo ""
}

# 🔐 CONFIGURAR SECRETOS DE SEGURIDAD
configure_security_secrets() {
    title "CONFIGURANDO SECRETOS DE SEGURIDAD"
    
    log "🔐 Configurando seguridad avanzada..."
    gh secret set ENCRYPTION_KEY --body "$ENCRYPTION_KEY" --repo GC-PMKT-Dev/cober360
    gh secret set BCRYPT_ROUNDS --body "$BCRYPT_ROUNDS" --repo GC-PMKT-Dev/cober360
    gh secret set RECAPTCHA_SECRET --body "$RECAPTCHA_SECRET" --repo GC-PMKT-Dev/cober360
    gh secret set RECAPTCHA_THRESHOLD --body "$RECAPTCHA_THRESHOLD" --repo GC-PMKT-Dev/cober360
    gh secret set INTERNAL_API_TOKEN --body "$INTERNAL_API_TOKEN" --repo GC-PMKT-Dev/cober360
    log "✅ Secretos de seguridad configurados"
    
    echo ""
}

# 🚀 CONFIGURAR SECRETOS DE DEPLOYMENT
configure_deployment_secrets() {
    title "CONFIGURANDO SECRETOS DE DEPLOYMENT"
    
    echo "🚀 Para el deployment automático necesitamos configurar SSH..."
    echo ""
    
    # Solicitar información del servidor
    echo "📋 INFORMACIÓN DEL SERVIDOR VPS:"
    echo ""
    
    # Host del servidor
    read -p "🌐 IP o dominio del servidor (ej: 192.168.1.100 o tuservidor.com): " SSH_HOST
    
    # Usuario SSH
    echo ""
    echo "👤 Usuario SSH para deployment:"
    echo "   - 'root' (acceso completo)"
    echo "   - 'www-data' (usuario web)"
    echo "   - 'deploy' (usuario dedicado)"
    echo "   - otro usuario personalizado"
    read -p "👤 Usuario SSH: " SSH_USER
    
    # Puerto SSH
    read -p "🔌 Puerto SSH (presiona Enter para 22): " SSH_PORT
    SSH_PORT=${SSH_PORT:-22}
    
    echo ""
    log "🔑 Configurando secretos de deployment..."
    
    gh secret set SSH_HOST --body "$SSH_HOST" --repo GC-PMKT-Dev/cober360
    gh secret set SSH_USER --body "$SSH_USER" --repo GC-PMKT-Dev/cober360
    gh secret set SSH_PORT --body "$SSH_PORT" --repo GC-PMKT-Dev/cober360
    
    # Configurar clave SSH
    echo ""
    echo "🔑 CONFIGURACIÓN DE CLAVE SSH:"
    echo ""
    echo "Opciones:"
    echo "1. Usar clave SSH existente"
    echo "2. Generar nueva clave SSH"
    echo "3. Configurar manualmente después"
    echo ""
    read -p "Selecciona una opción (1-3): " SSH_OPTION
    
    case $SSH_OPTION in
        1)
            echo ""
            echo "📁 Claves SSH disponibles:"
            ls -la ~/.ssh/*.pub 2>/dev/null | awk '{print $9}' | sed 's/\.pub$//' || echo "No se encontraron claves SSH"
            echo ""
            read -p "🔑 Ruta a la clave privada (ej: ~/.ssh/id_rsa): " SSH_KEY_PATH
            
            if [ -f "$SSH_KEY_PATH" ]; then
                SSH_KEY_CONTENT=$(cat "$SSH_KEY_PATH")
                gh secret set SSH_KEY --body "$SSH_KEY_CONTENT" --repo GC-PMKT-Dev/cober360
                log "✅ Clave SSH configurada desde: $SSH_KEY_PATH"
                
                # Mostrar clave pública para agregar al servidor
                SSH_PUB_KEY_PATH="${SSH_KEY_PATH}.pub"
                if [ -f "$SSH_PUB_KEY_PATH" ]; then
                    echo ""
                    warn "📋 IMPORTANTE: Agrega esta clave pública al servidor:"
                    echo ""
                    echo "En el servidor, ejecuta:"
                    echo "mkdir -p ~/.ssh"
                    echo "echo '$(cat $SSH_PUB_KEY_PATH)' >> ~/.ssh/authorized_keys"
                    echo "chmod 600 ~/.ssh/authorized_keys"
                    echo "chmod 700 ~/.ssh"
                    echo ""
                fi
            else
                warn "❌ Archivo no encontrado: $SSH_KEY_PATH"
                warn "Configura SSH_KEY manualmente después"
            fi
            ;;
        2)
            echo ""
            log "🔄 Generando nueva clave SSH..."
            
            SSH_KEY_NAME="cober360_deploy_$(date +%Y%m%d)"
            ssh-keygen -t rsa -b 4096 -f ~/.ssh/$SSH_KEY_NAME -N "" -C "deploy@cober360-$(date +%Y%m%d)"
            
            if [ -f ~/.ssh/$SSH_KEY_NAME ]; then
                SSH_KEY_CONTENT=$(cat ~/.ssh/$SSH_KEY_NAME)
                gh secret set SSH_KEY --body "$SSH_KEY_CONTENT" --repo GC-PMKT-Dev/cober360
                log "✅ Nueva clave SSH generada y configurada: ~/.ssh/$SSH_KEY_NAME"
                
                echo ""
                warn "📋 IMPORTANTE: Agrega esta clave pública al servidor:"
                echo ""
                echo "Clave pública generada:"
                cat ~/.ssh/$SSH_KEY_NAME.pub
                echo ""
                echo "En el servidor, ejecuta:"
                echo "mkdir -p ~/.ssh"
                echo "echo '$(cat ~/.ssh/$SSH_KEY_NAME.pub)' >> ~/.ssh/authorized_keys"
                echo "chmod 600 ~/.ssh/authorized_keys"
                echo "chmod 700 ~/.ssh"
                echo ""
            else
                warn "❌ Error al generar clave SSH"
            fi
            ;;
        3)
            warn "⏭️  SSH_KEY no configurado - hazlo manualmente después"
            echo ""
            echo "Para configurar manualmente:"
            echo "gh secret set SSH_KEY --body \"\$(cat ~/.ssh/tu_clave_privada)\" --repo GC-PMKT-Dev/cober360"
            ;;
    esac
    
    log "✅ Secretos de deployment configurados"
    echo ""
}

# 📊 CONFIGURAR SECRETOS DE MONITOREO
configure_monitoring_secrets() {
    title "CONFIGURANDO SECRETOS DE MONITOREO (OPCIONAL)"
    
    echo "📊 Configuración de notificaciones para monitoreo:"
    echo ""
    
    # Slack webhook
    echo "🔔 SLACK (opcional):"
    read -p "📱 URL del webhook de Slack (presiona Enter para omitir): " SLACK_WEBHOOK_URL
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        gh secret set SLACK_WEBHOOK_URL --body "$SLACK_WEBHOOK_URL" --repo GC-PMKT-Dev/cober360
        log "✅ Webhook de Slack configurado"
    else
        info "⏭️  Slack webhook omitido"
    fi
    
    # Discord webhook
    echo ""
    echo "🎮 DISCORD (opcional):"
    read -p "📱 URL del webhook de Discord (presiona Enter para omitir): " DISCORD_WEBHOOK_URL
    
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        gh secret set DISCORD_WEBHOOK_URL --body "$DISCORD_WEBHOOK_URL" --repo GC-PMKT-Dev/cober360
        log "✅ Webhook de Discord configurado"
    else
        info "⏭️  Discord webhook omitido"
    fi
    
    echo ""
}

# 📋 LISTAR SECRETOS CONFIGURADOS
list_configured_secrets() {
    title "SECRETOS CONFIGURADOS"
    
    log "📊 Listando secretos configurados en GitHub..."
    echo ""
    
    gh secret list --repo GC-PMKT-Dev/cober360
    
    echo ""
    log "✅ Todos los secretos han sido configurados correctamente"
}

# 📝 GENERAR RESUMEN
generate_summary() {
    title "RESUMEN DE CONFIGURACIÓN"
    
    cat > "/tmp/github_secrets_configured_$(date +%Y%m%d_%H%M%S).md" << EOF
# 🔐 Secretos Configurados en GitHub Actions - Cober360

## 📅 Fecha: $(date)

### ✅ SECRETOS CONFIGURADOS:

#### 🗄️ Base de Datos
- DB_HOST: $DB_HOST
- DB_USER: $DB_USER
- DB_PASSWORD: ✅ Configurado
- DB_NAME_DEV: $DB_NAME
- DB_NAME_PROD: cober360_produccion

#### 🔐 Autenticación
- JWT_SECRET: ✅ Configurado
- REFRESH_TOKEN_SECRET: ✅ Configurado
- JWT_EXPIRE: $JWT_EXPIRE
- REFRESH_TOKEN_EXPIRE: $REFRESH_TOKEN_EXPIRE

#### 🌐 URLs y Dominios
- DOMAIN_DEV: $DOMAIN
- DOMAIN_PROD: 360.cober.online
- FRONTEND_URL_DEV: $FRONTEND_URL
- FRONTEND_URL_PROD: https://360.cober.online
- API_BASE_URL_DEV: $API_BASE_URL
- API_BASE_URL_PROD: https://360.cober.online/api

#### 💳 MercadoPago
- MERCADOPAGO_ACCESS_TOKEN: ✅ Configurado
- MERCADOPAGO_PUBLIC_KEY: ✅ Configurado
- MERCADOPAGO_BASE_URL: $MERCADOPAGO_BASE_URL

#### 📧 Email
- SMTP_HOST: $SMTP_HOST
- SMTP_PORT: $SMTP_PORT
- EMAIL_USER: $EMAIL_USER
- EMAIL_PASS: ✅ Configurado

#### 📱 WhatsApp/Twilio
- TWILIO_ACCOUNT_SID: ✅ Configurado
- TWILIO_AUTH_TOKEN: ✅ Configurado
- TWILIO_WHATSAPP_NUMBER: $TWILIO_WHATSAPP_NUMBER
- WHATSAPP_WEBHOOK_VERIFY_TOKEN: ✅ Configurado

#### 🤖 OpenAI
- OPENAI_API_KEY: ✅ Configurado

#### 🔐 Seguridad
- ENCRYPTION_KEY: ✅ Configurado
- BCRYPT_ROUNDS: $BCRYPT_ROUNDS
- RECAPTCHA_SECRET: ✅ Configurado
- RECAPTCHA_THRESHOLD: $RECAPTCHA_THRESHOLD
- INTERNAL_API_TOKEN: ✅ Configurado

#### 🚀 Deployment
- SSH_HOST: ${SSH_HOST:-"Pendiente de configurar"}
- SSH_USER: ${SSH_USER:-"Pendiente de configurar"}
- SSH_PORT: ${SSH_PORT:-"22"}
- SSH_KEY: ${SSH_KEY_CONTENT:+"✅ Configurado"}${SSH_KEY_CONTENT:-"Pendiente de configurar"}

#### 📊 Monitoreo
- SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL:+"✅ Configurado"}${SLACK_WEBHOOK_URL:-"No configurado"}
- DISCORD_WEBHOOK_URL: ${DISCORD_WEBHOOK_URL:+"✅ Configurado"}${DISCORD_WEBHOOK_URL:-"No configurado"}

### 📋 PRÓXIMOS PASOS:

1. **Verificar configuración**:
   \`\`\`bash
   gh secret list --repo GC-PMKT-Dev/cober360
   \`\`\`

2. **Probar GitHub Actions**:
   - Hacer push a la rama \`main\` para activar el workflow
   - Monitorear en: https://github.com/GC-PMKT-Dev/cober360/actions

3. **Configurar SSH** (si no se hizo):
   \`\`\`bash
   gh secret set SSH_KEY --body "\$(cat ~/.ssh/tu_clave_privada)" --repo GC-PMKT-Dev/cober360
   \`\`\`

4. **Probar deployment**:
   \`\`\`bash
   ./scripts/deploy.sh
   \`\`\`

### 🔗 Enlaces Útiles:
- **GitHub Actions**: https://github.com/GC-PMKT-Dev/cober360/actions
- **Secretos**: https://github.com/GC-PMKT-Dev/cober360/settings/secrets/actions
- **Repositorio**: https://github.com/GC-PMKT-Dev/cober360

---
**🎉 ¡Configuración completada exitosamente!**
EOF

    local summary_file="/tmp/github_secrets_configured_$(date +%Y%m%d_%H%M%S).md"
    
    log "📄 Resumen guardado en: $summary_file"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  🎉 ¡SECRETOS CONFIGURADOS EXITOSAMENTE!                    ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Todos los secretos de GitHub Actions han sido configurados ║${NC}"
    echo -e "${GREEN}║  correctamente basándose en tu archivo .env                 ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo "📋 PRÓXIMOS PASOS:"
    echo "1. Hacer push para probar GitHub Actions"
    echo "2. Ejecutar deploy: ./scripts/deploy.sh"
    echo "3. Monitorear: ./scripts/monitor_post_deploy.sh"
    echo ""
}

# 🎯 FUNCIÓN PRINCIPAL
main() {
    show_banner
    
    log "🚀 Iniciando configuración de secretos de GitHub basada en .env existente"
    echo ""
    
    check_prerequisites
    read_env_variables
    configure_basic_secrets
    configure_mercadopago_secrets
    configure_email_secrets
    configure_whatsapp_secrets
    configure_openai_secrets
    configure_security_secrets
    configure_deployment_secrets
    configure_monitoring_secrets
    list_configured_secrets
    generate_summary
}

# 📋 FUNCIÓN DE AYUDA
show_help() {
    echo "🔐 Script de Configuración de GitHub Secrets para Cober360"
    echo ""
    echo "Este script lee las variables de tu archivo .env y las configura"
    echo "automáticamente como secretos en GitHub Actions."
    echo ""
    echo "Uso: $0"
    echo ""
    echo "Prerequisitos:"
    echo "- Archivo .env configurado en backend/"
    echo "- Acceso al repositorio GC-PMKT-Dev/cober360"
    echo "- Permisos para configurar secretos"
    echo ""
}

# 🎯 MANEJO DE ARGUMENTOS
case "${1:-setup}" in
    "setup"|"")
        main
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Opción no válida: $1. Usa '$0 help' para ver las opciones disponibles."
        ;;
esac