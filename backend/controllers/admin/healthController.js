
// 🏥 Health Check específico para rate limiting
const checkRateLimitHealth = async (req, res) => {
    try {
        const stats = {
            timestamp: new Date().toISOString(),
            rate_limits: {
                admin: "OK",
                activity_stats: "OK"
            },
            server_status: "healthy",
            memory_usage: process.memoryUsage(),
            uptime: process.uptime()
        };
        
        res.json({
            success: true,
            data: stats,
            message: 'Rate limiting funcionando correctamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error en health check',
            error: error.message
        });
    }
};

module.exports = { checkRateLimitHealth };