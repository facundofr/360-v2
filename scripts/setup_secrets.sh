#!/bin/bash

# 🔐 Script de Configuración de Secretos y Webhooks para CI/CD
# Configura los secretos necesarios para GitHub Actions

set -e

# 🎨 COLORES
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}"
}

# 📋 GENERAR LISTA DE SECRETOS NECESARIOS
generate_secrets_list() {
    log "📋 Generando lista de secretos necesarios para GitHub Actions..."
    
    cat > "/tmp/github_secrets_required.md" << 'EOF'
# 🔐 Secretos Requeridos para GitHub Actions - Cober360

## 📊 Configuración en GitHub

Ve a: `https://github.com/GC-PMKT-Dev/cober360/settings/secrets/actions`

### 🗄️ Base de Datos
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cober360
DB_USER=root
DB_PASS=Tu_Password_Seguro_Aqui
```

### 🔐 Seguridad y Autenticación
```
JWT_SECRET=tu_jwt_secret_super_ultra_secreto_256_bits_minimum
SESSION_SECRET=tu_session_secret_ultra_secreto_para_cookies
```

### 📧 Configuración de Email
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=sistema@cober.online
EMAIL_PASS=tu_password_de_aplicacion_gmail
```

### 📱 WhatsApp Business API
```
WHATSAPP_TOKEN=tu_token_de_whatsapp_business_api
WHATSAPP_VERIFY_TOKEN=tu_verify_token_personalizado
```

### 🌍 URLs y Endpoints
```
FRONTEND_URL_DEV=http://localhost:5173
FRONTEND_URL_PROD=https://360.cober.online
BACKEND_URL_DEV=http://localhost:4000
BACKEND_URL_PROD=https://api.cober.online
```

### 🚀 Deploy y SSH
```
SSH_HOST=tu_servidor_de_produccion.com
SSH_USER=deploy_user
SSH_KEY=<contenido_de_la_clave_privada_ssh>
SSH_PORT=22
```

### 📊 Monitoreo y Alertas
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TU_WEBHOOK_URL
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/tu_webhook
```

### 🔍 Logging y APM
```
LOG_LEVEL_PROD=error
LOG_LEVEL_DEV=debug
```

## 🤖 Variables de Entorno para GitHub Actions

Además de los secretos, configura estas variables de entorno:

### Repository Variables (Settings > Environment > production)
```
NODE_VERSION=18
MYSQL_VERSION=8.0
DEPLOYMENT_ENVIRONMENT=production
```

## 📝 Comandos para Configurar Secretos (usando GitHub CLI)

```bash
# Instalar GitHub CLI si no está instalado
# curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
# echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
# sudo apt update && sudo apt install gh

# Autenticarse
gh auth login

# Configurar secretos (reemplaza con tus valores reales)
gh secret set DB_PASS --body "tu_password_real"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set SESSION_SECRET --body "$(openssl rand -base64 32)"
gh secret set EMAIL_PASS --body "tu_password_email_real"
gh secret set WHATSAPP_TOKEN --body "tu_token_whatsapp_real"
gh secret set SSH_KEY --body "$(cat ~/.ssh/id_rsa)"
gh secret set SLACK_WEBHOOK_URL --body "tu_webhook_slack_real"
```

## 🔧 Configuración de SSH para Deploy

### 1. Generar clave SSH (si no tienes una)
```bash
ssh-keygen -t rsa -b 4096 -C "deploy@cober360"
```

### 2. Agregar clave pública al servidor
```bash
ssh-copy-id deploy_user@tu_servidor_de_produccion.com
```

### 3. Agregar clave privada como secreto en GitHub
```bash
gh secret set SSH_KEY --body "$(cat ~/.ssh/id_rsa)"
```

## 🌐 Configuración de Webhooks

### GitHub Webhook para Deploy Automático
URL: `https://tu_servidor.com/webhooks/github`
Content type: `application/json`
Events: `push`, `pull_request`

### Slack/Discord para Notificaciones
- Crear webhook en Slack/Discord
- Agregar URL como secreto: `SLACK_WEBHOOK_URL`

## ✅ Verificación

### Verificar secretos configurados:
```bash
gh secret list
```

### Test de conexión SSH:
```bash
ssh -T deploy_user@tu_servidor_de_produccion.com
```

### Test de webhook:
```bash
curl -X POST https://tu_servidor.com/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```
EOF

    log "✅ Lista de secretos generada en: /tmp/github_secrets_required.md"
}

# 🔑 GENERAR CLAVES DE SEGURIDAD
generate_security_keys() {
    log "🔑 Generando claves de seguridad..."
    
    # JWT Secret
    JWT_SECRET=$(openssl rand -base64 32)
    SESSION_SECRET=$(openssl rand -base64 32)
    API_KEY=$(openssl rand -hex 16)
    
    cat > "/tmp/generated_secrets.env" << EOF
# 🔐 Claves generadas automáticamente para Cober360
# Fecha: $(date)
# IMPORTANTE: Guarda estas claves en un lugar seguro

# JWT y Sesiones
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET

# API Key interna
API_KEY=$API_KEY

# Verification token para webhooks
WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 20)

# Database encryption key
DB_ENCRYPTION_KEY=$(openssl rand -base64 24)
EOF

    log "✅ Claves de seguridad generadas en: /tmp/generated_secrets.env"
    warn "🚨 IMPORTANTE: Guarda estas claves en un lugar seguro y no las compartas"
}

# 🔧 CREAR SCRIPT DE CONFIGURACIÓN AUTOMÁTICA
create_auto_setup_script() {
    log "🔧 Creando script de configuración automática..."
    
    cat > "/var/www/cober360/scripts/setup_github_secrets.sh" << 'EOF'
#!/bin/bash

# 🤖 Script de Configuración Automática de GitHub Secrets
# Requiere GitHub CLI instalado y autenticado

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"; exit 1; }

# Verificar que GitHub CLI está instalado
if ! command -v gh &> /dev/null; then
    error "GitHub CLI no está instalado. Instala con: sudo apt install gh"
fi

# Verificar autenticación
if ! gh auth status &> /dev/null; then
    error "No estás autenticado en GitHub CLI. Ejecuta: gh auth login"
fi

log "🔐 Configurando secretos de GitHub Actions..."

# Función para configurar secreto de forma segura
set_secret() {
    local secret_name=$1
    local default_value=$2
    local description=$3
    
    echo ""
    echo "🔑 Configurando: $secret_name"
    echo "📝 Descripción: $description"
    
    if [ -n "$default_value" ] && [ "$default_value" != "REQUIRED" ]; then
        echo "💡 Valor sugerido: $default_value"
    fi
    
    read -p "🔍 Ingresa el valor (Enter para usar sugerido): " -s user_value
    echo ""
    
    local final_value="${user_value:-$default_value}"
    
    if [ -z "$final_value" ] || [ "$final_value" = "REQUIRED" ]; then
        warn "⚠️  Secreto $secret_name omitido - configúralo manualmente después"
        return
    fi
    
    if gh secret set "$secret_name" --body "$final_value"; then
        log "✅ $secret_name configurado correctamente"
    else
        warn "❌ Error al configurar $secret_name"
    fi
}

# Configurar secretos uno por uno
log "🚀 Iniciando configuración interactiva de secretos..."

# Base de datos
set_secret "DB_PASS" "REQUIRED" "Password de la base de datos MySQL"
set_secret "DB_HOST" "localhost" "Host de la base de datos"
set_secret "DB_NAME" "cober360" "Nombre de la base de datos"
set_secret "DB_USER" "root" "Usuario de la base de datos"

# Seguridad
set_secret "JWT_SECRET" "$(openssl rand -base64 32)" "Clave secreta para JWT tokens"
set_secret "SESSION_SECRET" "$(openssl rand -base64 32)" "Clave secreta para sesiones"

# Email
set_secret "EMAIL_USER" "REQUIRED" "Usuario de email (ej: sistema@cober.online)"
set_secret "EMAIL_PASS" "REQUIRED" "Password de aplicación de Gmail"

# WhatsApp
set_secret "WHATSAPP_TOKEN" "REQUIRED" "Token de WhatsApp Business API"
set_secret "WHATSAPP_VERIFY_TOKEN" "$(openssl rand -hex 16)" "Token de verificación de webhook"

# URLs
set_secret "FRONTEND_URL_PROD" "https://360.cober.online" "URL del frontend en producción"
set_secret "BACKEND_URL_PROD" "https://api.cober.online" "URL del backend en producción"

# Deploy
set_secret "SSH_HOST" "REQUIRED" "Host del servidor de producción"
set_secret "SSH_USER" "REQUIRED" "Usuario SSH para deploy"
echo ""
log "🔑 Para SSH_KEY, copia tu clave privada SSH completa"
warn "💡 Tip: cat ~/.ssh/id_rsa | gh secret set SSH_KEY"

# Notificaciones
set_secret "SLACK_WEBHOOK_URL" "" "URL del webhook de Slack (opcional)"

log "🎉 Configuración de secretos completada"
log "📋 Verifica los secretos configurados con: gh secret list"

echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Configurar SSH_KEY manualmente si no se configuró"
echo "2. Verificar secretos: gh secret list"
echo "3. Hacer push para probar el workflow"
echo "4. Monitorear en: https://github.com/GC-PMKT-Dev/cober360/actions"
EOF

    chmod +x "/var/www/cober360/scripts/setup_github_secrets.sh"
    log "✅ Script de configuración automática creado"
}

# 📡 CREAR WEBHOOK ENDPOINT
create_webhook_endpoint() {
    log "📡 Creando endpoint para webhooks..."
    
    cat > "/var/www/cober360/scripts/webhook_server.js" << 'EOF'
#!/usr/bin/env node

/**
 * 📡 Servidor de Webhooks para GitHub Actions
 * Recibe webhooks de GitHub y ejecuta deploys automáticos
 */

const express = require('express');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'tu_webhook_secret';
const LOG_FILE = '/var/log/webhook-deploy.log';

// Middleware para logs
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(LOG_FILE, logEntry);
};

// Middleware para verificar firma
const verifySignature = (req, res, next) => {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        return res.status(401).json({ error: 'No signature provided' });
    }

    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(req.body);
    const digest = `sha256=${hmac.digest('hex')}`;

    if (signature !== digest) {
        log(`❌ Invalid signature: ${signature} !== ${digest}`);
        return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
};

app.use(express.raw({ type: 'application/json' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'webhook-server',
        timestamp: new Date().toISOString()
    });
});

// GitHub webhook endpoint
app.post('/github', verifySignature, (req, res) => {
    try {
        const payload = JSON.parse(req.body);
        const event = req.headers['x-github-event'];
        
        log(`📨 Received GitHub webhook: ${event}`);
        
        // Solo procesar push events a main o production
        if (event === 'push') {
            const branch = payload.ref.replace('refs/heads/', '');
            log(`🌿 Push to branch: ${branch}`);
            
            if (branch === 'main') {
                log('🚀 Triggering staging deployment...');
                executeDeployment('staging');
            } else if (branch === 'production') {
                log('🏭 Triggering production deployment...');
                executeDeployment('production');
            } else {
                log(`ℹ️  Ignored push to branch: ${branch}`);
            }
        }
        
        res.json({ status: 'received', event, branch: payload.ref });
        
    } catch (error) {
        log(`❌ Webhook error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Función para ejecutar deployment
function executeDeployment(environment) {
    try {
        log(`🔄 Starting ${environment} deployment...`);
        
        const deployScript = '/var/www/cober360/scripts/deploy.sh';
        const command = `${deployScript} deploy`;
        
        log(`📋 Executing: ${command}`);
        
        // Ejecutar en background para no bloquear la respuesta
        setTimeout(() => {
            try {
                const output = execSync(command, { 
                    encoding: 'utf8',
                    timeout: 300000, // 5 minutos max
                    cwd: '/var/www/cober360'
                });
                
                log(`✅ ${environment} deployment completed successfully`);
                log(`📋 Output: ${output}`);
                
                // Opcional: enviar notificación de éxito
                sendNotification(`✅ ${environment} deployment completed successfully`, 'success');
                
            } catch (error) {
                log(`❌ ${environment} deployment failed: ${error.message}`);
                sendNotification(`❌ ${environment} deployment failed: ${error.message}`, 'error');
            }
        }, 1000);
        
    } catch (error) {
        log(`❌ Failed to start ${environment} deployment: ${error.message}`);
    }
}

// Función para enviar notificaciones
function sendNotification(message, type) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    const payload = {
        text: `🤖 Cober360 CI/CD: ${message}`,
        username: 'Deploy Bot',
        icon_emoji: type === 'success' ? ':white_check_mark:' : ':x:'
    };
    
    try {
        execSync(`curl -X POST -H 'Content-type: application/json' --data '${JSON.stringify(payload)}' '${webhookUrl}'`);
        log(`📧 Notification sent to Slack`);
    } catch (error) {
        log(`❌ Failed to send notification: ${error.message}`);
    }
}

// Manejar errores globales
process.on('uncaughtException', (error) => {
    log(`💥 Uncaught exception: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`💥 Unhandled rejection at: ${promise}, reason: ${reason}`);
});

// Iniciar servidor
app.listen(PORT, () => {
    log(`🚀 Webhook server running on port ${PORT}`);
    log(`📡 GitHub webhook endpoint: http://localhost:${PORT}/github`);
    log(`🏥 Health check: http://localhost:${PORT}/health`);
});
EOF

    chmod +x "/var/www/cober360/scripts/webhook_server.js"
    log "✅ Servidor de webhooks creado"
}

# 🔧 CREAR SERVICIO SYSTEMD PARA WEBHOOK
create_webhook_service() {
    log "🔧 Creando servicio systemd para webhook..."
    
    cat > "/tmp/webhook-deploy.service" << 'EOF'
[Unit]
Description=Webhook Deploy Server for Cober360
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/cober360
ExecStart=/usr/bin/node scripts/webhook_server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=WEBHOOK_PORT=9000
Environment=WEBHOOK_SECRET=tu_webhook_secret_cambiar

# Logging
StandardOutput=append:/var/log/webhook-deploy.log
StandardError=append:/var/log/webhook-deploy-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/log /var/www/cober360

[Install]
WantedBy=multi-user.target
EOF

    log "📝 Archivo de servicio creado en: /tmp/webhook-deploy.service"
    log "💡 Para instalarlo ejecuta:"
    log "   sudo cp /tmp/webhook-deploy.service /etc/systemd/system/"
    log "   sudo systemctl daemon-reload"
    log "   sudo systemctl enable webhook-deploy"
    log "   sudo systemctl start webhook-deploy"
}

# 📊 CREAR DASHBOARD DE ESTADO
create_status_dashboard() {
    log "📊 Creando dashboard de estado..."
    
    cat > "/var/www/cober360/public/cicd-status.html" << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 CI/CD Status - Cober360</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .status-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            transition: transform 0.3s ease;
        }
        
        .status-card:hover {
            transform: translateY(-5px);
        }
        
        .status-icon {
            font-size: 3em;
            margin-bottom: 10px;
        }
        
        .status-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .status-value {
            font-size: 2em;
            font-weight: bold;
        }
        
        .healthy { color: #4CAF50; }
        .warning { color: #FF9800; }
        .error { color: #F44336; }
        
        .logs {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .refresh-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            margin: 10px;
            transition: background 0.3s ease;
        }
        
        .refresh-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    </style>
    <script>
        async function loadStatus() {
            try {
                // Simular carga de datos (reemplazar con API real)
                const data = {
                    api: { status: 'healthy', responseTime: '156ms' },
                    database: { status: 'healthy', connections: 12 },
                    deployment: { status: 'success', lastDeploy: '2 horas ago' },
                    tests: { status: 'passed', coverage: '87%' }
                };
                
                updateStatusCards(data);
                updateLogs();
                
            } catch (error) {
                console.error('Error loading status:', error);
            }
        }
        
        function updateStatusCards(data) {
            document.getElementById('api-status').className = `status-value ${data.api.status === 'healthy' ? 'healthy' : 'error'}`;
            document.getElementById('api-status').textContent = data.api.status.toUpperCase();
            document.getElementById('api-time').textContent = data.api.responseTime;
            
            document.getElementById('db-status').className = `status-value ${data.database.status === 'healthy' ? 'healthy' : 'error'}`;
            document.getElementById('db-status').textContent = data.database.status.toUpperCase();
            document.getElementById('db-connections').textContent = data.database.connections;
            
            document.getElementById('deploy-status').className = `status-value ${data.deployment.status === 'success' ? 'healthy' : 'error'}`;
            document.getElementById('deploy-status').textContent = data.deployment.status.toUpperCase();
            document.getElementById('deploy-time').textContent = data.deployment.lastDeploy;
            
            document.getElementById('test-status').className = `status-value ${data.tests.status === 'passed' ? 'healthy' : 'error'}`;
            document.getElementById('test-status').textContent = data.tests.status.toUpperCase();
            document.getElementById('test-coverage').textContent = data.tests.coverage;
        }
        
        function updateLogs() {
            const logsElement = document.getElementById('logs');
            const now = new Date().toLocaleString();
            logsElement.innerHTML += `<div>[${now}] ✅ Status check completed</div>`;
            logsElement.scrollTop = logsElement.scrollHeight;
        }
        
        // Auto refresh every 30 seconds
        setInterval(loadStatus, 30000);
        
        // Load initial status
        window.onload = loadStatus;
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 CI/CD Status Dashboard</h1>
            <h2>Cober360 - Sistema de Monitoreo</h2>
            <button class="refresh-btn" onclick="loadStatus()">🔄 Actualizar</button>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <div class="status-icon">🌐</div>
                <div class="status-title">API Status</div>
                <div id="api-status" class="status-value healthy">LOADING</div>
                <div>Response: <span id="api-time">-</span></div>
            </div>
            
            <div class="status-card">
                <div class="status-icon">🗄️</div>
                <div class="status-title">Database</div>
                <div id="db-status" class="status-value healthy">LOADING</div>
                <div>Connections: <span id="db-connections">-</span></div>
            </div>
            
            <div class="status-card">
                <div class="status-icon">🚀</div>
                <div class="status-title">Last Deploy</div>
                <div id="deploy-status" class="status-value healthy">LOADING</div>
                <div>Time: <span id="deploy-time">-</span></div>
            </div>
            
            <div class="status-card">
                <div class="status-icon">🧪</div>
                <div class="status-title">Tests</div>
                <div id="test-status" class="status-value healthy">LOADING</div>
                <div>Coverage: <span id="test-coverage">-</span></div>
            </div>
        </div>
        
        <div>
            <h3>📋 Logs en Tiempo Real</h3>
            <div id="logs" class="logs">
                <div>[Iniciando] Dashboard de monitoreo cargado...</div>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <p>🔗 <a href="https://github.com/GC-PMKT-Dev/cober360/actions" style="color: white;">Ver GitHub Actions</a></p>
            <p>📊 <a href="/health" style="color: white;">API Health Check</a></p>
        </div>
    </div>
</body>
</html>
EOF

    mkdir -p "/var/www/cober360/public"
    log "✅ Dashboard de estado creado en: /var/www/cober360/public/cicd-status.html"
}

# 🎯 FUNCIÓN PRINCIPAL
main() {
    log "🚀 Iniciando configuración de secretos y webhooks para CI/CD"
    
    generate_secrets_list
    generate_security_keys
    create_auto_setup_script
    create_webhook_endpoint
    create_webhook_service
    create_status_dashboard
    
    log "🎉 Configuración completada"
    
    echo ""
    echo "📋 ARCHIVOS CREADOS:"
    echo "  📄 /tmp/github_secrets_required.md - Lista de secretos requeridos"
    echo "  🔐 /tmp/generated_secrets.env - Claves generadas"
    echo "  🤖 scripts/setup_github_secrets.sh - Configuración automática"
    echo "  📡 scripts/webhook_server.js - Servidor de webhooks"
    echo "  🔧 /tmp/webhook-deploy.service - Servicio systemd"
    echo "  📊 public/cicd-status.html - Dashboard de estado"
    echo ""
    echo "📋 PRÓXIMOS PASOS:"
    echo "1. Revisar secretos requeridos: cat /tmp/github_secrets_required.md"
    echo "2. Ejecutar configuración: ./scripts/setup_github_secrets.sh"
    echo "3. Instalar servicio webhook: sudo cp /tmp/webhook-deploy.service /etc/systemd/system/"
    echo "4. Configurar webhook en GitHub: https://github.com/GC-PMKT-Dev/cober360/settings/hooks"
    echo "5. Ver dashboard: http://tu_servidor/cicd-status.html"
}

# 📋 FUNCIÓN DE AYUDA
show_help() {
    echo "🔐 Script de Configuración de Secretos y Webhooks"
    echo ""
    echo "Uso: $0 [OPCIÓN]"
    echo ""
    echo "Opciones:"
    echo "  setup      Configuración completa (por defecto)"
    echo "  secrets    Solo generar lista de secretos"
    echo "  keys       Solo generar claves de seguridad"
    echo "  webhook    Solo configurar webhook"
    echo "  service    Solo crear servicio systemd"
    echo "  dashboard  Solo crear dashboard"
    echo "  help       Mostrar esta ayuda"
    echo ""
}

# 🎯 MANEJO DE ARGUMENTOS
case "${1:-setup}" in
    "setup")
        main
        ;;
    "secrets")
        generate_secrets_list
        ;;
    "keys")
        generate_security_keys
        ;;
    "webhook")
        create_webhook_endpoint
        create_webhook_service
        ;;
    "service")
        create_webhook_service
        ;;
    "dashboard")
        create_status_dashboard
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Opción no válida: $1. Usa '$0 help' para ver las opciones disponibles."
        ;;
esac