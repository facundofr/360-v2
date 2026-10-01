const express = require('express');
const router = express.Router();
const { authenticateToken, authenticateAdmin } = require('../middlewares/authMiddleware');
const advancedSecurity = require('../middlewares/advancedSecurity');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 🛡️ OBTENER ESTADÍSTICAS DE SEGURIDAD
router.get('/stats', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        const stats = advancedSecurity.getSecurityStats();
        
        // Agregar información adicional del sistema
        exec('sudo iptables -L INPUT -n | grep DROP | wc -l', (error, stdout) => {
            const iptablesBlocked = error ? 0 : parseInt(stdout.trim());
            
            res.json({
                success: true,
                data: {
                    ...stats,
                    iptablesBlocked,
                    systemUptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    timestamp: new Date().toISOString()
                }
            });
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas de seguridad:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas de seguridad'
        });
    }
});

// 🚫 BLOQUEAR IP MANUALMENTE
router.post('/block-ip', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        const { ip, reason } = req.body;
        
        if (!ip || !reason) {
            return res.status(400).json({
                success: false,
                message: 'IP y razón son requeridos'
            });
        }

        // Validar formato de IP
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de IP inválido'
            });
        }

        advancedSecurity.addToBlacklist(ip, `Manual block by admin: ${reason}`);
        
        res.json({
            success: true,
            message: `IP ${ip} bloqueada exitosamente`,
            ip,
            reason,
            blockedBy: req.user.id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error bloqueando IP:', error);
        res.status(500).json({
            success: false,
            message: 'Error bloqueando IP'
        });
    }
});

// ✅ AGREGAR IP A WHITELIST
router.post('/whitelist-ip', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        const { ip, reason } = req.body;
        
        if (!ip || !reason) {
            return res.status(400).json({
                success: false,
                message: 'IP y razón son requeridos'
            });
        }

        // Validar formato de IP
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de IP inválido'
            });
        }

        advancedSecurity.addToWhitelist(ip);
        
        res.json({
            success: true,
            message: `IP ${ip} agregada a whitelist exitosamente`,
            ip,
            reason,
            whitelistedBy: req.user.id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error agregando IP a whitelist:', error);
        res.status(500).json({
            success: false,
            message: 'Error agregando IP a whitelist'
        });
    }
});

// 📊 OBTENER LOGS DE SEGURIDAD
router.get('/logs', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        const { limit = 100, type = 'all' } = req.query;
        const logFile = path.join(__dirname, '../logs/security.log');
        
        if (!fs.existsSync(logFile)) {
            return res.json({
                success: true,
                data: [],
                message: 'No hay logs de seguridad disponibles'
            });
        }

        const logs = fs.readFileSync(logFile, 'utf8')
            .split('\n')
            .filter(line => line.trim())
            .slice(-limit)
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(log => log !== null);

        // Filtrar por tipo si se especifica
        const filteredLogs = type === 'all' ? logs : logs.filter(log => 
            log.eventType && log.eventType.toLowerCase().includes(type.toLowerCase())
        );

        res.json({
            success: true,
            data: filteredLogs.reverse(), // Más recientes primero
            total: filteredLogs.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error obteniendo logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo logs de seguridad'
        });
    }
});

// 🔥 DESBLOQUEAR IP
router.post('/unblock-ip', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        const { ip, reason } = req.body;
        
        if (!ip || !reason) {
            return res.status(400).json({
                success: false,
                message: 'IP y razón son requeridos'
            });
        }

        // Remover de iptables
        exec(`sudo iptables -D INPUT -s ${ip} -j DROP`, (error) => {
            if (error) {
                console.error(`Error removiendo IP ${ip} de iptables:`, error);
            } else {
                console.log(`IP ${ip} removida de iptables`);
            }
        });

        res.json({
            success: true,
            message: `IP ${ip} desbloqueada exitosamente`,
            ip,
            reason,
            unblockedBy: req.user.id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error desbloqueando IP:', error);
        res.status(500).json({
            success: false,
            message: 'Error desbloqueando IP'
        });
    }
});

// 📱 OBTENER ALERTAS EN TIEMPO REAL
router.get('/alerts', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        const alertsFile = path.join(__dirname, '../logs/security-alerts.log');
        
        if (!fs.existsSync(alertsFile)) {
            return res.json({
                success: true,
                data: [],
                message: 'No hay alertas disponibles'
            });
        }

        const alerts = fs.readFileSync(alertsFile, 'utf8')
            .split('\n')
            .filter(line => line.trim())
            .slice(-50) // Últimas 50 alertas
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(alert => alert !== null);

        res.json({
            success: true,
            data: alerts.reverse(), // Más recientes primero
            total: alerts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error obteniendo alertas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo alertas'
        });
    }
});

// 🔄 REINICIAR FAIL2BAN
router.post('/restart-fail2ban', authenticateToken, authenticateAdmin, (req, res) => {
    try {
        exec('sudo systemctl restart fail2ban', (error, stdout, stderr) => {
            if (error) {
                console.error('Error reiniciando Fail2Ban:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error reiniciando Fail2Ban',
                    error: error.message
                });
            }

            res.json({
                success: true,
                message: 'Fail2Ban reiniciado exitosamente',
                restartedBy: req.user.id,
                timestamp: new Date().toISOString()
            });
        });
    } catch (error) {
        console.error('Error reiniciando Fail2Ban:', error);
        res.status(500).json({
            success: false,
            message: 'Error reiniciando Fail2Ban'
        });
    }
});

module.exports = router;
