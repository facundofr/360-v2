const geoip = require('geoip-lite');
const fs = require('fs');
const path = require('path');

class AdvancedSecurityMonitor {
    constructor() {
        this.suspiciousIPs = new Map();
        this.attackPatterns = new Map();
        this.whitelistIPs = new Set([
            '127.0.0.1',
            '::1',
            '::ffff:127.0.0.1',
            'localhost',
            '201.212.96.163' // IP del usuario que reportó problemas
        ]);
        this.blacklistIPs = new Set();
        this.logFile = path.join(__dirname, '../logs/security.log');
        this.alertThreshold = 10; // Alertas después de 10 intentos (más permisivo)
        
        // Cargar listas negras existentes
        this.loadBlacklist();
    }

    // 🚨 Analizar patrón de ataque
    analyzeAttackPattern(req) {
        const ip = req.ip;
        const userAgent = req.get('User-Agent') || '';
        const path = req.path;
        const method = req.method;
        
        const attackScore = this.calculateAttackScore(req);
        const geoInfo = geoip.lookup(ip);
        
        return {
            ip,
            userAgent,
            path,
            method,
            attackScore,
            country: geoInfo?.country || 'Unknown',
            isSuspicious: attackScore > 80,  // Más permisivo: 80 en lugar de 50
            isHighRisk: attackScore > 120,   // Más permisivo: 120 en lugar de 80
            timestamp: new Date().toISOString()
        };
    }

    // 🎯 Calcular puntuación de ataque
    calculateAttackScore(req) {
        let score = 0;
        const ip = req.ip;
        const userAgent = req.get('User-Agent') || '';
        const path = req.path.toLowerCase();
        const referer = req.get('Referer') || '';

        // Puntuación por IP
        if (this.blacklistIPs.has(ip)) score += 100;
        if (this.suspiciousIPs.has(ip)) {
            score += this.suspiciousIPs.get(ip) * 10;
        }

        // Puntuación por User Agent - SOLO bots maliciosos reales
        const maliciousAgents = [
            'scanner', 'exploit', 'nmap', 'sqlmap', 'nikto', 'dirb',
            'masscan', 'zgrab', 'shodan', 'censys', 'security scan'
        ];
        
        // Detectar browsers legítimos vs bots maliciosos
        const legitimateBrowsers = [
            'mozilla', 'chrome', 'safari', 'firefox', 'edge', 'opera'
        ];
        
        const hasLegitimateSignature = legitimateBrowsers.some(browser => 
            userAgent.toLowerCase().includes(browser)
        );
        
        const hasMaliciousSignature = maliciousAgents.some(agent => 
            userAgent.toLowerCase().includes(agent)
        );
        
        // Solo penalizar bots realmente maliciosos
        if (hasMaliciousSignature) {
            score += 60;
        } else if (!hasLegitimateSignature && userAgent.length < 20) {
            // User agents muy cortos y sin firma de browser legítimo
            score += 20;
        }

        // Puntuación por ruta atacada - DISTINGUIR entre rutas legítimas y maliciosas
        const maliciousRoutes = [
            '.env', '.git', 'wp-admin', 'phpmyadmin', 'backup', 'database.sql',
            'dump.sql', 'config.php', 'xmlrpc.php', 'eval(', 'shell_exec'
        ];
        
        const legitimateAdminRoutes = [
            '/admin/', '/supervisor/', '/backoffice/', '/api/admin'
        ];
        
        // Solo penalizar acceso a rutas realmente maliciosas
        const isMaliciousRoute = maliciousRoutes.some(route => path.includes(route));
        const isLegitimateAdmin = legitimateAdminRoutes.some(route => path.startsWith(route));
        
        if (isMaliciousRoute) {
            score += 70; // Alto score para rutas maliciosas reales
        } else if (isLegitimateAdmin) {
            score += 0;  // No penalizar rutas de admin legítimas
        }

        // Puntuación por método
        if (['PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            score += 20;
        }

        // Puntuación por ausencia de referer en rutas sensibles
        if (!referer && isMaliciousRoute) {
            score += 25;
        }

        // Puntuación por país de origen
        const geoInfo = geoip.lookup(ip);
        const highRiskCountries = ['CN', 'RU', 'KP', 'IR']; // Ajustar según necesidades
        if (geoInfo && highRiskCountries.includes(geoInfo.country)) {
            score += 15;
        }

        return score;
    }

    // �️ Verificar si IP está en whitelist (incluyendo formatos IPv6)
    isWhitelisted(ip) {
        // Verificación directa
        if (this.whitelistIPs.has(ip)) return true;
        
        // Normalizar IPv6 formato localhost
        const normalizedIPs = [
            ip.replace('::ffff:', ''), // IPv4 mapeado
            ip.replace('::1', '127.0.0.1'), // localhost IPv6 -> IPv4
        ];
        
        return normalizedIPs.some(normalizedIP => this.whitelistIPs.has(normalizedIP));
    }

    // �🚫 Middleware principal de seguridad
    securityMiddleware() {
        return (req, res, next) => {
            const analysis = this.analyzeAttackPattern(req);
            const ip = req.ip;

            // Verificar whitelist con normalización
            if (this.isWhitelisted(ip)) {
                return next();
            }

            // Verificar blacklist
            if (this.blacklistIPs.has(ip)) {
                this.logSecurityEvent('BLOCKED_BLACKLISTED', analysis);
                return res.status(403).json({
                    error: 'Acceso denegado',
                    code: 'IP_BLACKLISTED'
                });
            }

            // Bloquear ataques de alto riesgo inmediatamente
            if (analysis.isHighRisk) {
                this.addToBlacklist(ip, 'High risk attack detected');
                this.logSecurityEvent('BLOCKED_HIGH_RISK', analysis);
                return res.status(403).json({
                    error: 'Actividad sospechosa detectada',
                    code: 'SUSPICIOUS_ACTIVITY'
                });
            }

            // Rastrear IPs sospechosas
            if (analysis.isSuspicious) {
                const count = this.suspiciousIPs.get(ip) || 0;
                this.suspiciousIPs.set(ip, count + 1);

                // Bloquear después de múltiples intentos sospechosos
                if (count + 1 >= this.alertThreshold) {
                    this.addToBlacklist(ip, `${count + 1} suspicious attempts`);
                    this.logSecurityEvent('BLOCKED_REPEATED_SUSPICIOUS', analysis);
                    return res.status(403).json({
                        error: 'Múltiples actividades sospechosas detectadas',
                        code: 'REPEATED_SUSPICIOUS_ACTIVITY'
                    });
                }

                this.logSecurityEvent('SUSPICIOUS_ACTIVITY', analysis);
            }

            // Agregar headers de seguridad a la respuesta
            res.set({
                'X-Security-Score': analysis.attackScore,
                'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });

            next();
        };
    }

    // 📝 Registrar eventos de seguridad
    logSecurityEvent(eventType, analysis) {
        const logEntry = {
            timestamp: analysis.timestamp,
            eventType,
            ip: analysis.ip,
            country: analysis.country,
            userAgent: analysis.userAgent,
            path: analysis.path,
            method: analysis.method,
            attackScore: analysis.attackScore,
            isSuspicious: analysis.isSuspicious,
            isHighRisk: analysis.isHighRisk
        };

        const logLine = JSON.stringify(logEntry) + '\n';
        
        // Escribir al archivo de log
        fs.appendFileSync(this.logFile, logLine);
        
        // Log a consola con formato legible
        const emoji = this.getEventEmoji(eventType);
        console.warn(
            `${emoji} ${eventType}: ${analysis.ip} (${analysis.country}) ` +
            `${analysis.method} ${analysis.path} [Score: ${analysis.attackScore}]`
        );

        // Enviar alerta en tiempo real para eventos críticos
        if (['BLOCKED_HIGH_RISK', 'BLOCKED_REPEATED_SUSPICIOUS'].includes(eventType)) {
            this.sendRealTimeAlert(logEntry);
        }
    }

    // 🚨 Enviar alerta en tiempo real
    sendRealTimeAlert(logEntry) {
        // Aquí puedes integrar con servicios como Slack, Telegram, Discord, etc.
        console.error(`🚨 ALERTA CRÍTICA DE SEGURIDAD: ${JSON.stringify(logEntry, null, 2)}`);
        
        // Ejemplo para webhook de Slack (descomentar y configurar)
        /*
        const webhook = process.env.SLACK_SECURITY_WEBHOOK;
        if (webhook) {
            axios.post(webhook, {
                text: `🚨 Ataque detectado: ${logEntry.ip} (${logEntry.country}) - Score: ${logEntry.attackScore}`
            }).catch(err => console.error('Error enviando alerta:', err));
        }
        */
    }

    // 🎨 Obtener emoji para tipo de evento
    getEventEmoji(eventType) {
        const emojis = {
            'BLOCKED_BLACKLISTED': '🚫',
            'BLOCKED_HIGH_RISK': '🚨',
            'BLOCKED_REPEATED_SUSPICIOUS': '⚠️',
            'SUSPICIOUS_ACTIVITY': '👀',
            'WHITELIST_ACCESS': '✅'
        };
        return emojis[eventType] || '🔍';
    }

    // 🚫 Agregar IP a blacklist
    addToBlacklist(ip, reason = 'Added to blacklist') {
        this.blacklistIPs.add(ip);
        this.saveBlacklist();
        
        // Log del evento con análisis básico
        const basicAnalysis = {
            timestamp: new Date().toISOString(),
            ip: ip,
            country: 'Manual',
            userAgent: 'System',
            path: 'Manual Block',
            method: 'BLOCK',
            attackScore: 100,
            isSuspicious: true,
            isHighRisk: true
        };
        
        this.logSecurityEvent('IP_BLOCKED_MANUAL', basicAnalysis);
        
        // Ejecutar comando iptables para bloquear inmediatamente
        const { exec } = require('child_process');
        exec(`sudo iptables -A INPUT -s ${ip} -j DROP`, (error) => {
            if (error) {
                console.error(`Error bloqueando IP ${ip}:`, error);
            } else {
                console.log(`🚫 IP ${ip} bloqueada en firewall (Razón: ${reason})`);
            }
        });
    }

    // ✅ Agregar IP a whitelist
    addToWhitelist(ip) {
        this.whitelistIPs.add(ip);
        console.log(`✅ IP ${ip} agregada a whitelist`);
    }

    // 💾 Guardar blacklist
    saveBlacklist() {
        const blacklistFile = path.join(__dirname, '../config/blacklist.json');
        fs.writeFileSync(blacklistFile, JSON.stringify([...this.blacklistIPs], null, 2));
    }

    // 📂 Cargar blacklist
    loadBlacklist() {
        try {
            const blacklistFile = path.join(__dirname, '../config/blacklist.json');
            if (fs.existsSync(blacklistFile)) {
                const data = JSON.parse(fs.readFileSync(blacklistFile, 'utf8'));
                this.blacklistIPs = new Set(data);
                console.log(`📂 Cargadas ${this.blacklistIPs.size} IPs en blacklist`);
            }
        } catch (error) {
            console.error('Error cargando blacklist:', error);
        }
    }

    // 📊 Obtener estadísticas de seguridad
    getSecurityStats() {
        return {
            blacklistedIPs: Array.from(this.blacklistIPs),
            suspiciousIPs: Array.from(this.suspiciousIPs.entries()),
            whitelistedIPs: Array.from(this.whitelistIPs),
            blacklistCount: this.blacklistIPs.size,
            suspiciousCount: this.suspiciousIPs.size,
            whitelistCount: this.whitelistIPs.size,
            recentAttacks: [...this.suspiciousIPs.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
            lastUpdate: new Date().toISOString()
        };
    }

    // 🧹 Limpiar datos antiguos (ejecutar periódicamente)
    cleanup() {
        // Limpiar IPs sospechosas después de 24 horas sin actividad
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        for (const [ip, count] of this.suspiciousIPs.entries()) {
            // Implementar lógica de limpieza basada en tiempo
            // Por ahora, mantenemos datos para análisis
        }
    }
}

module.exports = new AdvancedSecurityMonitor();
