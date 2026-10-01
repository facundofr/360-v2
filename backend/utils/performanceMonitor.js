const os = require('os');
const process = require('process');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class PerformanceMonitor {
    constructor() {
        this.startTime = Date.now();
        this.requestCount = 0;
        this.errorCount = 0;
        this.responseTime = [];
        
        // ⚡ CACHE PARA PREVENIR MEMORY LEAKS
        this.metricsCache = null;
        this.cacheExpiry = 0;
        this.cacheTimeout = 60000; // 60 segundos de cache para coincidir con frontend
    }

    // 📊 Obtener métricas del sistema
    async getSystemMetrics() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // CPU Usage promedio
        const cpuUsage = await this.getCPUUsage();

        return {
            cpu: {
                cores: cpus.length,
                model: cpus[0].model,
                usage: cpuUsage,
                loadAvg: os.loadavg()
            },
            memory: {
                total: Math.round(totalMem / 1024 / 1024), // MB
                used: Math.round(usedMem / 1024 / 1024), // MB
                free: Math.round(freeMem / 1024 / 1024), // MB
                usage: Math.round((usedMem / totalMem) * 100) // %
            },
            uptime: {
                system: Math.round(os.uptime()),
                process: Math.round(process.uptime())
            },
            platform: {
                arch: os.arch(),
                platform: os.platform(),
                hostname: os.hostname()
            }
        };
    }

    // 🔥 Calcular uso de CPU
    async getCPUUsage() {
        try {
            const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
            return parseFloat(stdout.trim()) || 0;
        } catch (error) {
            return 0;
        }
    }

    // 📊 Obtener métricas de Node.js
    getNodeMetrics() {
        const memUsage = process.memoryUsage();
        
        return {
            version: process.version,
            pid: process.pid,
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                external: Math.round(memUsage.external / 1024 / 1024), // MB
                heapUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) // %
            },
            uptime: Math.round(process.uptime()),
            cpuUsage: process.cpuUsage()
        };
    }

    // 📡 Obtener métricas de aplicación
    getAppMetrics() {
        const avgResponseTime = this.responseTime.length > 0 
            ? this.responseTime.reduce((a, b) => a + b, 0) / this.responseTime.length 
            : 0;

        return {
            requests: {
                total: this.requestCount,
                errors: this.errorCount,
                success: this.requestCount - this.errorCount,
                errorRate: this.requestCount > 0 ? Math.round((this.errorCount / this.requestCount) * 100) : 0
            },
            performance: {
                avgResponseTime: Math.round(avgResponseTime),
                uptime: Math.round((Date.now() - this.startTime) / 1000),
                requestsPerMinute: this.getRequestsPerMinute()
            }
        };
    }

    // 🗄️ Obtener métricas de base de datos
    async getDatabaseMetrics() {
        try {
            const db = require('../config/db');
            
            // Obtener estadísticas de conexiones
            const [connections] = await db.query("SHOW STATUS LIKE 'Threads_connected'");
            const [maxConnections] = await db.query("SHOW VARIABLES LIKE 'max_connections'");
            const [queries] = await db.query("SHOW STATUS LIKE 'Queries'");
            const [uptime] = await db.query("SHOW STATUS LIKE 'Uptime'");

            return {
                connections: {
                    active: parseInt(connections[0].Value),
                    max: parseInt(maxConnections[0].Value),
                    usage: Math.round((parseInt(connections[0].Value) / parseInt(maxConnections[0].Value)) * 100)
                },
                queries: {
                    total: parseInt(queries[0].Value),
                    perSecond: Math.round(parseInt(queries[0].Value) / parseInt(uptime[0].Value))
                },
                uptime: parseInt(uptime[0].Value),
                status: 'connected'
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    // 🌐 Obtener métricas de red
    async getNetworkMetrics() {
        try {
            const { stdout: port80 } = await execAsync("netstat -an | grep :80 | wc -l");
            const { stdout: port443 } = await execAsync("netstat -an | grep :443 | wc -l");
            const { stdout: port4000 } = await execAsync("netstat -an | grep :4000 | wc -l");

            return {
                connections: {
                    http: parseInt(port80.trim()),
                    https: parseInt(port443.trim()),
                    app: parseInt(port4000.trim())
                }
            };
        } catch (error) {
            return {
                connections: {
                    http: 0,
                    https: 0,
                    app: 0
                },
                error: error.message
            };
        }
    }

    // 📈 Incrementar contador de requests
    incrementRequests() {
        this.requestCount++;
    }

    // ❌ Incrementar contador de errores
    incrementErrors() {
        this.errorCount++;
    }

    // ⏱️ Agregar tiempo de respuesta
    addResponseTime(time) {
        this.responseTime.push(time);
        // Mantener solo los últimos 50 registros (reducido para menos memoria)
        if (this.responseTime.length > 50) {
            this.responseTime.shift();
        }
    }

    // 📊 Calcular requests por minuto
    getRequestsPerMinute() {
        const uptimeMinutes = (Date.now() - this.startTime) / 60000;
        return uptimeMinutes > 0 ? Math.round(this.requestCount / uptimeMinutes) : 0;
    }

    // 🏥 Health check completo con cache
    async getHealthCheck() {
        // ⚡ Usar cache si está disponible y válido
        const now = Date.now();
        if (this.metricsCache && now < this.cacheExpiry) {
            return this.metricsCache;
        }

        try {
            const systemMetrics = await this.getSystemMetrics();
            const nodeMetrics = this.getNodeMetrics();
            const appMetrics = this.getAppMetrics();
            const dbMetrics = await this.getDatabaseMetrics();
            const networkMetrics = await this.getNetworkMetrics();

            // Determinar estado de salud general
            const healthStatus = this.calculateHealthStatus(systemMetrics, nodeMetrics, appMetrics, dbMetrics);

            const result = {
                status: healthStatus.status,
                timestamp: new Date().toISOString(),
                metrics: {
                    system: systemMetrics,
                    node: nodeMetrics,
                    application: appMetrics,
                    database: dbMetrics,
                    network: networkMetrics
                },
                health: healthStatus,
                version: '1.0.0'
            };

            // ⚡ Guardar en cache
            this.metricsCache = result;
            this.cacheExpiry = now + this.cacheTimeout;

            return result;
        } catch (error) {
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // 💊 Calcular estado de salud
    calculateHealthStatus(system, node, app, db) {
        let score = 100;
        let issues = [];

        // CPU Usage
        if (system.cpu.usage > 80) {
            score -= 30;
            issues.push('High CPU usage');
        } else if (system.cpu.usage > 60) {
            score -= 15;
            issues.push('Moderate CPU usage');
        }

        // Memory Usage
        if (system.memory.usage > 90) {
            score -= 25;
            issues.push('Critical memory usage');
        } else if (system.memory.usage > 75) {
            score -= 10;
            issues.push('High memory usage');
        }

        // Heap Usage
        if (node.memory.heapUsage > 85) {
            score -= 20;
            issues.push('High heap usage');
        }

        // Error Rate
        if (app.requests.errorRate > 10) {
            score -= 25;
            issues.push('High error rate');
        } else if (app.requests.errorRate > 5) {
            score -= 15;
            issues.push('Moderate error rate');
        }

        // Database Status
        if (db.status === 'error') {
            score -= 40;
            issues.push('Database connection error');
        } else if (db.connections.usage > 80) {
            score -= 15;
            issues.push('High database connection usage');
        }

        // Determinar estado
        let status;
        if (score >= 85) status = 'excellent';
        else if (score >= 70) status = 'good';
        else if (score >= 50) status = 'warning';
        else status = 'critical';

        return {
            status,
            score,
            issues,
            recommendations: this.getRecommendations(issues)
        };
    }

    // 💡 Obtener recomendaciones
    getRecommendations(issues) {
        const recommendations = [];

        if (issues.includes('High CPU usage')) {
            recommendations.push('Consider scaling horizontally or optimizing CPU-intensive operations');
        }
        if (issues.includes('Critical memory usage')) {
            recommendations.push('Add more RAM or optimize memory usage');
        }
        if (issues.includes('High error rate')) {
            recommendations.push('Check application logs for error patterns');
        }
        if (issues.includes('Database connection error')) {
            recommendations.push('Check database connectivity and configuration');
        }

        return recommendations;
    }

    // 🎯 Middleware para tracking automático
    trackingMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Incrementar contador
            this.incrementRequests();

            // Interceptar la respuesta
            const originalSend = res.send;
            res.send = function(body) {
                const responseTime = Date.now() - startTime;
                
                // Agregar tiempo de respuesta
                performanceMonitor.addResponseTime(responseTime);

                // Contar errores
                if (res.statusCode >= 400) {
                    performanceMonitor.incrementErrors();
                }

                // Headers de performance
                res.set('X-Response-Time', `${responseTime}ms`);
                res.set('X-Request-Count', performanceMonitor.requestCount.toString());

                originalSend.call(this, body);
            };

            next();
        };
    }
}

// Instancia global
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
