const express = require('express');
const router = express.Router();
const performanceMonitor = require('../utils/performanceMonitor');

// 📊 Endpoint para métricas completas
router.get('/metrics', async (req, res) => {
    try {
        const healthCheck = await performanceMonitor.getHealthCheck();
        res.json(healthCheck);
    } catch (error) {
        res.status(500).json({
            error: 'Error obteniendo métricas',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 🖥️ Endpoint para métricas del sistema solamente
router.get('/system', async (req, res) => {
    try {
        const systemMetrics = await performanceMonitor.getSystemMetrics();
        res.json({
            status: 'success',
            data: systemMetrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error obteniendo métricas del sistema',
            message: error.message
        });
    }
});

// 🚀 Endpoint para métricas de Node.js
router.get('/node', (req, res) => {
    try {
        const nodeMetrics = performanceMonitor.getNodeMetrics();
        res.json({
            status: 'success',
            data: nodeMetrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error obteniendo métricas de Node.js',
            message: error.message
        });
    }
});

// 📱 Endpoint para métricas de la aplicación
router.get('/app', (req, res) => {
    try {
        const appMetrics = performanceMonitor.getAppMetrics();
        res.json({
            status: 'success',
            data: appMetrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error obteniendo métricas de la aplicación',
            message: error.message
        });
    }
});

// 🗄️ Endpoint para métricas de base de datos
router.get('/database', async (req, res) => {
    try {
        const dbMetrics = await performanceMonitor.getDatabaseMetrics();
        res.json({
            status: 'success',
            data: dbMetrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error obteniendo métricas de base de datos',
            message: error.message
        });
    }
});

// 🌐 Endpoint para métricas de red
router.get('/network', async (req, res) => {
    try {
        const networkMetrics = await performanceMonitor.getNetworkMetrics();
        res.json({
            status: 'success',
            data: networkMetrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error obteniendo métricas de red',
            message: error.message
        });
    }
});

// 🏥 Endpoint simplificado de health check
router.get('/health', async (req, res) => {
    try {
        const health = await performanceMonitor.getHealthCheck();
        res.json({
            status: health.health.status,
            score: health.health.score,
            issues: health.health.issues,
            timestamp: health.timestamp
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 📈 Endpoint para estadísticas en tiempo real (SSE - Server-Sent Events)
router.get('/stream', async (req, res) => {
    // Configurar SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Función para enviar datos
    const sendMetrics = async () => {
        try {
            const metrics = await performanceMonitor.getHealthCheck();
            res.write(`data: ${JSON.stringify(metrics)}\n\n`);
        } catch (error) {
            res.write(`data: ${JSON.stringify({ error: error.message, timestamp: new Date().toISOString() })}\n\n`);
        }
    };

    // Enviar métricas cada 5 segundos
    const interval = setInterval(sendMetrics, 5000);
    
    // Enviar inmediatamente
    await sendMetrics();

    // Limpiar cuando el cliente se desconecta
    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
});

// 🎯 Endpoint para resetear contadores
router.post('/reset', (req, res) => {
    try {
        performanceMonitor.requestCount = 0;
        performanceMonitor.errorCount = 0;
        performanceMonitor.responseTime = [];
        performanceMonitor.startTime = Date.now();

        res.json({
            status: 'success',
            message: 'Contadores reseteados',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error reseteando contadores',
            message: error.message
        });
    }
});

module.exports = router;
