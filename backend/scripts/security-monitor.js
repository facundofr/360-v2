#!/usr/bin/env node

/**
 * Monitor de Seguridad en Tiempo Real para Cober360
 * Analiza logs y toma acciones automáticas contra ataques
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

class SecurityMonitor {
    constructor() {
        this.logFile = '/var/log/pm2/cober360-out-7.log';
        this.alertsFile = path.join(__dirname, '../logs/security-alerts.log');
        this.suspiciousPatterns = [
            /🚨 Ruta no encontrada: GET \/\.env desde IP: ([\d\.]+)/,
            /🚨 Ruta no encontrada: GET \/\.git.* desde IP: ([\d\.]+)/,
            /🚨 Ruta no encontrada: GET \/admin.* desde IP: ([\d\.]+)/,
            /🚨 Ruta no encontrada: GET \/wp-admin.* desde IP: ([\d\.]+)/,
            /🚨 Ruta no encontrada: GET \/config.* desde IP: ([\d\.]+)/,
            /🚨 Ruta no encontrada: GET \/backup.* desde IP: ([\d\.]+)/,
            /Bot sospechoso detectado: .* desde IP: ([\d\.]+)/,
            /HeadlessChrome.*IP: ([\d\.]+)/
        ];
        this.blockedIPs = new Set();
        this.ipAttempts = new Map();
        this.startTime = new Date();
        
        console.log('🛡️ Monitor de Seguridad iniciado');
        console.log(`📁 Monitoreando: ${this.logFile}`);
        console.log(`📊 Alertas en: ${this.alertsFile}`);
    }

    // 🚀 Iniciar monitoreo
    start() {
        this.monitorLogs();
        this.startPeriodicTasks();
        this.setupGracefulShutdown();
    }

    // 📊 Monitorear logs en tiempo real
    monitorLogs() {
        const tail = spawn('tail', ['-f', this.logFile]);

        tail.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    this.analyzeLine(line);
                }
            });
        });

        tail.stderr.on('data', (data) => {
            console.error(`Error en tail: ${data}`);
        });

        tail.on('close', (code) => {
            console.log(`Proceso tail terminó con código: ${code}`);
            // Reiniciar después de 5 segundos
            setTimeout(() => this.monitorLogs(), 5000);
        });

        console.log('📡 Monitoreo de logs iniciado');
    }

    // 🔍 Analizar línea de log
    analyzeLine(line) {
        this.suspiciousPatterns.forEach(pattern => {
            const match = line.match(pattern);
            if (match) {
                const ip = match[1];
                this.handleSuspiciousActivity(ip, line, pattern);
            }
        });
    }

    // 🚨 Manejar actividad sospechosa
    handleSuspiciousActivity(ip, logLine, pattern) {
        // Limpiar datos antiguos si hay demasiados
        if (this.ipAttempts.size > 1000) {
            const oldestEntries = [...this.ipAttempts.entries()].slice(0, 500);
            oldestEntries.forEach(([ip]) => this.ipAttempts.delete(ip));
        }
        
        // Incrementar contador de intentos
        const attempts = this.ipAttempts.get(ip) || 0;
        this.ipAttempts.set(ip, attempts + 1);

        const alert = {
            timestamp: new Date().toISOString(),
            ip,
            attempts: attempts + 1,
            pattern: pattern.toString(),
            logLine: logLine.trim(),
            action: 'MONITORING'
        };

        // Determinar acción basada en el número de intentos
        if (attempts + 1 >= 3 && !this.blockedIPs.has(ip)) {
            this.blockIP(ip, `${attempts + 1} suspicious attempts`);
            alert.action = 'BLOCKED';
        } else if (attempts + 1 >= 1) {
            alert.action = 'WARNING';
        }

        this.logAlert(alert);
        this.sendRealTimeNotification(alert);
    }

    // 🚫 Bloquear IP
    blockIP(ip, reason) {
        if (this.blockedIPs.has(ip)) {
            return; // Ya bloqueada
        }

        this.blockedIPs.add(ip);

        // Bloquear con iptables
        const iptablesCmd = spawn('sudo', ['iptables', '-A', 'INPUT', '-s', ip, '-j', 'DROP']);
        
        iptablesCmd.on('close', (code) => {
            if (code === 0) {
                console.log(`🚫 IP ${ip} bloqueada exitosamente (${reason})`);
                this.logAlert({
                    timestamp: new Date().toISOString(),
                    ip,
                    action: 'IPTABLES_BLOCK',
                    reason,
                    success: true
                });
            } else {
                console.error(`❌ Error bloqueando IP ${ip} (código: ${code})`);
            }
        });

        iptablesCmd.stderr.on('data', (data) => {
            console.error(`Error iptables: ${data}`);
        });
    }

    // 📝 Registrar alerta
    logAlert(alert) {
        const alertLine = JSON.stringify(alert) + '\n';
        fs.appendFileSync(this.alertsFile, alertLine);

        // Log formateado en consola
        const emoji = this.getActionEmoji(alert.action);
        const timestamp = new Date(alert.timestamp).toLocaleTimeString();
        console.log(`${emoji} [${timestamp}] ${alert.ip} - ${alert.action} (Intentos: ${alert.attempts || 'N/A'})`);
    }

    // 🎨 Emoji para acciones
    getActionEmoji(action) {
        const emojis = {
            'MONITORING': '👀',
            'WARNING': '⚠️',
            'BLOCKED': '🚫',
            'IPTABLES_BLOCK': '🛡️'
        };
        return emojis[action] || '🔍';
    }

    // 📱 Enviar notificación en tiempo real
    sendRealTimeNotification(alert) {
        // Aquí puedes integrar con servicios de notificación
        if (alert.action === 'BLOCKED') {
            console.log(`\n🚨 ALERTA CRÍTICA 🚨`);
            console.log(`IP: ${alert.ip}`);
            console.log(`Intentos: ${alert.attempts}`);
            console.log(`Tiempo: ${alert.timestamp}`);
            console.log(`Patrón: ${alert.pattern}`);
            console.log(`Log: ${alert.logLine}`);
            console.log(`─`.repeat(50));

            // Enviar a webhook si está configurado
            this.sendWebhookAlert(alert);
        }
    }

    // 🔗 Enviar alerta via webhook
    async sendWebhookAlert(alert) {
        const webhookUrl = process.env.SECURITY_WEBHOOK_URL;
        if (!webhookUrl) return;

        try {
            await axios.post(webhookUrl, {
                text: `🚨 IP Bloqueada: ${alert.ip}`,
                attachments: [{
                    color: 'danger',
                    fields: [
                        { title: 'IP', value: alert.ip, short: true },
                        { title: 'Intentos', value: alert.attempts, short: true },
                        { title: 'Patrón', value: alert.pattern, short: false },
                        { title: 'Log', value: alert.logLine, short: false }
                    ],
                    ts: Math.floor(Date.now() / 1000)
                }]
            });
        } catch (error) {
            console.error('Error enviando webhook:', error.message);
        }
    }

    // ⏰ Tareas periódicas
    startPeriodicTasks() {
        // Almacenar referencias para poder limpiarlas
        this.intervals = [];
        
        // Estadísticas cada 5 minutos
        const statsInterval = setInterval(() => {
            this.printStatistics();
        }, 5 * 60 * 1000);
        this.intervals.push(statsInterval);

        // Limpieza cada hora
        const cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);
        this.intervals.push(cleanupInterval);

        // Respaldo de datos cada 6 horas
        const backupInterval = setInterval(() => {
            this.backupData();
        }, 6 * 60 * 60 * 1000);
        this.intervals.push(backupInterval);
    }

    // 🧹 Limpiar intervalos
    stopPeriodicTasks() {
        if (this.intervals) {
            this.intervals.forEach(interval => clearInterval(interval));
            this.intervals = [];
        }
    }

    // 📊 Imprimir estadísticas
    printStatistics() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000 / 60);
        const totalIPs = this.ipAttempts.size;
        const blockedCount = this.blockedIPs.size;
        const topAttackers = [...this.ipAttempts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        console.log(`\n📊 ESTADÍSTICAS DE SEGURIDAD`);
        console.log(`─`.repeat(40));
        console.log(`⏱️ Tiempo activo: ${uptime} minutos`);
        console.log(`🔍 IPs monitoreadas: ${totalIPs}`);
        console.log(`🚫 IPs bloqueadas: ${blockedCount}`);
        console.log(`Top atacantes:`);
        topAttackers.forEach(([ip, attempts], index) => {
            const status = this.blockedIPs.has(ip) ? 'BLOCKED' : 'MONITORING';
            console.log(`   ${index + 1}. ${ip} - ${attempts} intentos [${status}]`);
        });
        console.log(`${'─'.repeat(40)}\n`);
    }

        // 🧹 Limpieza periódica
    cleanup() {
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        // Limpieza agresiva de memoria
        const initialAttempts = this.ipAttempts.size;
        const initialBlocked = this.blockedIPs.size;

        // Limpiar intentos antiguos (más de 24 horas) o mantener solo los 500 más recientes
        if (this.ipAttempts.size > 500) {
            const entries = [...this.ipAttempts.entries()];
            // Mantener solo los 200 con más intentos
            const topEntries = entries
                .sort((a, b) => b[1] - a[1])
                .slice(0, 200);
            
            this.ipAttempts.clear();
            topEntries.forEach(([ip, attempts]) => {
                this.ipAttempts.set(ip, attempts);
            });
        }

        // Limitar IPs bloqueadas a 100 máximo
        if (this.blockedIPs.size > 100) {
            const blocked = [...this.blockedIPs];
            // Mantener solo las primeras 50
            this.blockedIPs.clear();
            blocked.slice(0, 50).forEach(ip => this.blockedIPs.add(ip));
        }

        console.log(`🧹 Limpieza completada - Intentos: ${initialAttempts} → ${this.ipAttempts.size}, Bloqueadas: ${initialBlocked} → ${this.blockedIPs.size}`);
        
        // Forzar garbage collection si está disponible
        if (global.gc) {
            global.gc();
            console.log('🗑️ Garbage collection forzado');
        }
    }

    // 💾 Respaldo de datos
    backupData() {
        const backupData = {
            timestamp: new Date().toISOString(),
            blockedIPs: [...this.blockedIPs],
            ipAttempts: Object.fromEntries(this.ipAttempts),
            statistics: {
                totalIPs: this.ipAttempts.size,
                blockedCount: this.blockedIPs.size,
                uptime: Math.floor((Date.now() - this.startTime) / 1000)
            }
        };

        const backupFile = path.join(__dirname, '../logs/security-backup.json');
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`Datos de seguridad respaldados`);
    }

    // 🔄 Configurar cierre elegante
    setupGracefulShutdown() {
        process.on('SIGINT', () => {
            console.log('\n🛑 Cerrando monitor de seguridad...');
            this.backupData();
            console.log('✅ Monitor cerrado correctamente');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Monitor terminado');
            this.backupData();
            process.exit(0);
        });
    }
}

// Iniciar monitor si se ejecuta directamente
if (require.main === module) {
    const monitor = new SecurityMonitor();
    monitor.start();
}

module.exports = SecurityMonitor;
