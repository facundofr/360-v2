const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin/adminModel');

/**
 * ✅ SERVICIO DE WEBSOCKET PARA USUARIOS ACTIVOS EN TIEMPO REAL - MEJORADO
 * 
 * Este servicio maneja las conexiones WebSocket para mostrar
 * información de usuarios activos en tiempo real en el panel de admin.
 * Incluye reconexión automática, throttling y mejor manejo de errores.
 */

class ActiveUsersWebSocket {
    constructor() {
        this.io = null;
        this.connectedAdmins = new Map(); // Almacenar conexiones de admins
        this.updateInterval = null;
        this.UPDATE_FREQUENCY = 45000; // 45 segundos (aumentado para reducir carga)
        this.lastBroadcast = 0;
        this.isShuttingDown = false;
        this.broadcastThrottle = 5000; // Mínimo 5 segundos entre broadcasts
    }

    /**
     * Inicializar el servidor WebSocket con configuración robusta
     */
    initialize(server) {
        this.io = new Server(server, {
            cors: {
                origin: [
                    'https://360v2-virid.vercel.app',  
                    'http://localhost:5173',
                    'http://localhost:3000',
                    'http://192.168.56.1',
                    'http://172.16.0.68',
                    'https://wspflows.cober.online',
                    'https://360.cober.online'
                ],
                methods: ['GET', 'POST'],
                credentials: true
            },
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            pingTimeout: 60000, // 60 segundos
            pingInterval: 25000, // 25 segundos
            maxHttpBufferSize: 1e6, // 1MB
            allowEIO3: true // Compatibilidad con versiones anteriores
        });

        // Registrar lógica de conexión para un namespace dado
        const registerNamespace = (namespace) => {
            namespace.use(this.authenticateSocket.bind(this));

            namespace.on('connection', (socket) => {
                console.log(`🔗 Admin conectado al monitor de usuarios: ${socket.user.email} (ID: ${socket.user.id})`);
                
                // Agregar a la lista de admins conectados
                this.connectedAdmins.set(socket.id, {
                    userId: socket.user.id,
                    email: socket.user.email,
                    connectedAt: new Date(),
                    socket: socket,
                    lastActivity: Date.now()
                });

                // Enviar datos iniciales con delay para evitar sobrecarga
                setTimeout(() => {
                    this.sendActiveUsersUpdate(socket);
                }, 1000);

                // Manejar solicitud de actualización manual con throttling
                socket.on('request_update', () => {
                    const now = Date.now();
                    const adminData = this.connectedAdmins.get(socket.id);
                    
                    if (adminData && now - adminData.lastActivity > 3000) { // Mínimo 3 segundos entre requests
                        console.log(`🔄 Actualización manual solicitada por ${socket.user.email}`);
                        adminData.lastActivity = now;
                        this.sendActiveUsersUpdate(socket);
                    } else {
                        console.log(`⏳ Throttling actualización manual para ${socket.user.email}`);
                        socket.emit('error', {
                            message: 'Actualización muy frecuente, espera un momento',
                            code: 'THROTTLED'
                        });
                    }
                });

                // Manejar cambio de configuración de timeframe con throttling
                socket.on('change_timeframe', (timeframe) => {
                    const adminData = this.connectedAdmins.get(socket.id);
                    
                    if (adminData && Date.now() - adminData.lastActivity > 2000) {
                        console.log(`⏰ Cambio de timeframe a ${timeframe} minutos por ${socket.user.email}`);
                        adminData.lastActivity = Date.now();
                        this.sendActiveUsersUpdate(socket, timeframe);
                    }
                });

                // Manejar ping personalizado para mantener conexión
                socket.on('ping', () => {
                    socket.emit('pong', { timestamp: Date.now() });
                });

                // Manejar desconexión
                socket.on('disconnect', (reason) => {
                    console.log(`❌ Admin desconectado del monitor: ${socket.user.email} - Razón: ${reason}`);
                    this.connectedAdmins.delete(socket.id);
                    
                    // Si no hay admins conectados, parar las actualizaciones automáticas
                    if (this.connectedAdmins.size === 0) {
                        this.stopAutoUpdates();
                    }
                });

                // Manejar errores del socket
                socket.on('error', (error) => {
                    console.error(`❌ Error en socket de ${socket.user.email}:`, error);
                });

                // Iniciar actualizaciones automáticas si es el primer admin
                if (this.connectedAdmins.size === 1) {
                    this.startAutoUpdates();
                }
            });

            // Manejar errores globales del namespace
            namespace.on('error', (error) => {
                console.error('❌ Error en namespace admin:', error);
            });
        };

        // Namespace específico para el panel de admin
        const adminNamespace = this.io.of('/admin');
        registerNamespace(adminNamespace);

        // Compatibilidad: aceptar conexiones también en el namespace raíz '/'
        const rootNamespace = this.io.of('/');
        registerNamespace(rootNamespace);

        console.log('✅ WebSocket para usuarios activos inicializado correctamente');
        return adminNamespace;
    }

    /**
     * Middleware de autenticación para WebSocket con mejor manejo de errores
     */
    async authenticateSocket(socket, next) {
        try {
            let token = socket.handshake.auth.token || 
                         socket.handshake.query.token ||
                         socket.handshake.headers.authorization?.replace('Bearer ', '');

            // Normalizar formato "Bearer <token>" si vino en auth.token o query
            if (typeof token === 'string' && token.startsWith('Bearer ')) {
                token = token.slice(7);
            }
            
            if (!token) {
                return next(new Error('Token de autenticación requerido'));
            }

            // Verificar el token JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Verificar que sea un administrador
            if (decoded.role !== 3) {
                return next(new Error('Acceso denegado: solo administradores'));
            }

            // Verificar que el usuario esté activo
            const user = await Admin.findById(decoded.id);
            if (!user || !user.is_enabled) {
                return next(new Error('Usuario no encontrado o deshabilitado'));
            }

            socket.user = decoded;
            console.log(`✅ Socket autenticado para admin: ${decoded.email}`);
            next();
        } catch (error) {
            console.error('❌ Error en autenticación WebSocket:', error.message);
            try {
                console.error('📩 Handshake info:', {
                    hasAuthToken: !!socket.handshake.auth?.token,
                    hasQueryToken: !!socket.handshake.query?.token,
                    hasAuthHeader: !!socket.handshake.headers?.authorization,
                    userAgent: socket.handshake.headers['user-agent']
                });
            } catch (_) {}
            
            if (error.name === 'TokenExpiredError') {
                next(new Error('Token expirado - por favor, inicia sesión nuevamente'));
            } else if (error.name === 'JsonWebTokenError') {
                next(new Error('Token inválido'));
            } else {
                next(new Error('Error de autenticación'));
            }
        }
    }

    /**
     * Enviar actualización de usuarios activos a un socket específico con manejo de errores
     */
    async sendActiveUsersUpdate(socket, timeframe = 5) {
        try {
            // Verificar que el socket esté conectado
            if (!socket.connected) {
                console.log(`⚠️ Socket desconectado, saltando actualización para ${socket.user?.email}`);
                return;
            }

            const [activeUsers, stats] = await Promise.all([
                Admin.getActiveUsers(timeframe).catch(err => {
                    console.error('❌ Error obteniendo usuarios activos:', err);
                    return [];
                }),
                Admin.getUserActivityStats().catch(err => {
                    console.error('❌ Error obteniendo estadísticas:', err);
                    return { summary: {}, by_role: [], recent_logins: [] };
                })
            ]);

            const updateData = {
                active_users: activeUsers,
                statistics: stats,
                timeframe_minutes: timeframe,
                last_updated: new Date().toISOString(),
                connected_admins: this.connectedAdmins.size,
                server_timestamp: Date.now()
            };

            socket.emit('active_users_update', updateData);
            
            console.log(`📊 Enviada actualización de usuarios activos a ${socket.user.email}: ${activeUsers.length} usuarios activos`);
        } catch (error) {
            console.error('❌ Error enviando actualización de usuarios activos:', error);
            
            // Enviar error estructurado al cliente
            if (socket.connected) {
                socket.emit('error', {
                    message: 'Error obteniendo datos de usuarios activos',
                    code: 'ACTIVE_USERS_ERROR',
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Broadcast de actualización a todos los admins conectados con throttling
     */
    async broadcastActiveUsersUpdate(timeframe = 5) {
        if (this.connectedAdmins.size === 0 || this.isShuttingDown) {
            return;
        }

        // Throttling para evitar broadcasts muy frecuentes
        const now = Date.now();
        if (now - this.lastBroadcast < this.broadcastThrottle) {
            console.log('⏳ Throttling broadcast de usuarios activos');
            return;
        }

        this.lastBroadcast = now;

        try {
            const [activeUsers, stats] = await Promise.all([
                Admin.getActiveUsers(timeframe).catch(err => {
                    console.error('❌ Error en broadcast obteniendo usuarios activos:', err);
                    return [];
                }),
                Admin.getUserActivityStats().catch(err => {
                    console.error('❌ Error en broadcast obteniendo estadísticas:', err);
                    return { summary: {}, by_role: [], recent_logins: [] };
                })
            ]);

            const updateData = {
                active_users: activeUsers,
                statistics: stats,
                timeframe_minutes: timeframe,
                last_updated: new Date().toISOString(),
                connected_admins: this.connectedAdmins.size,
                server_timestamp: now
            };

            let successfulBroadcasts = 0;
            let failedBroadcasts = 0;

            // Enviar a todos los admins conectados con verificación de conexión
            for (const [socketId, adminData] of this.connectedAdmins) {
                try {
                    if (adminData.socket.connected) {
                        adminData.socket.emit('active_users_update', updateData);
                        successfulBroadcasts++;
                    } else {
                        console.log(`⚠️ Socket desconectado detectado, removiendo: ${adminData.email}`);
                        this.connectedAdmins.delete(socketId);
                        failedBroadcasts++;
                    }
                } catch (error) {
                    console.error(`❌ Error enviando broadcast a ${adminData.email}:`, error);
                    failedBroadcasts++;
                }
            }

            console.log(`📡 Broadcast enviado a ${successfulBroadcasts} administradores: ${activeUsers.length} usuarios activos (${failedBroadcasts} fallos)`);
        } catch (error) {
            console.error('❌ Error en broadcast de usuarios activos:', error);
        }
    }

    /**
     * Iniciar actualizaciones automáticas con configuración optimizada
     */
    startAutoUpdates() {
        if (this.updateInterval || this.isShuttingDown) {
            return; // Ya está ejecutándose o cerrando
        }

        console.log(`🔄 Iniciando actualizaciones automáticas cada ${this.UPDATE_FREQUENCY / 1000} segundos`);
        
        this.updateInterval = setInterval(() => {
            if (!this.isShuttingDown && this.connectedAdmins.size > 0) {
                this.broadcastActiveUsersUpdate();
            }
        }, this.UPDATE_FREQUENCY);
    }

    /**
     * Detener actualizaciones automáticas
     */
    stopAutoUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('⏹️ Actualizaciones automáticas detenidas');
        }
    }

    /**
     * Obtener estadísticas de conexiones
     */
    getConnectionStats() {
        return {
            connected_admins: this.connectedAdmins.size,
            auto_updates_active: !!this.updateInterval,
            update_frequency_seconds: this.UPDATE_FREQUENCY / 1000,
            last_broadcast: this.lastBroadcast,
            is_shutting_down: this.isShuttingDown,
            admin_connections: Array.from(this.connectedAdmins.values()).map(admin => ({
                userId: admin.userId,
                email: admin.email,
                connectedAt: admin.connectedAt,
                duration_minutes: Math.floor((new Date() - admin.connectedAt) / 60000),
                lastActivity: admin.lastActivity
            }))
        };
    }

    /**
     * Forzar actualización inmediata con throttling
     */
    forceUpdate(timeframe = 5) {
        const now = Date.now();
        if (now - this.lastBroadcast < 3000) { // Mínimo 3 segundos entre updates forzados
            console.log('⏳ Throttling update forzado');
            return false;
        }

        console.log('🔥 Forzando actualización inmediata de usuarios activos');
        this.broadcastActiveUsersUpdate(timeframe);
        return true;
    }

    /**
     * Cleanup al cerrar el servidor con cleanup graceful
     */
    cleanup() {
        console.log('🧹 Iniciando cleanup de WebSocket de usuarios activos...');
        this.isShuttingDown = true;

        // Detener actualizaciones
        this.stopAutoUpdates();

        // Notificar a todos los clientes conectados
        for (const [socketId, adminData] of this.connectedAdmins) {
            try {
                if (adminData.socket.connected) {
                    adminData.socket.emit('server_shutdown', {
                        message: 'Servidor cerrándose, reconectar en unos momentos',
                        timestamp: new Date().toISOString()
                    });
                    adminData.socket.disconnect(true);
                }
            } catch (error) {
                console.error(`❌ Error en cleanup de socket ${adminData.email}:`, error);
            }
        }

        // Cerrar servidor WebSocket
        if (this.io) {
            this.io.close();
        }

        // Limpiar datos
        this.connectedAdmins.clear();
        console.log('✅ WebSocket de usuarios activos limpiado correctamente');
    }

    /**
     * Inicializa el namespace /notificaciones con JWT para eventos en tiempo real
     * Permite a cualquier usuario autenticado suscribirse a rooms de pólizas
     */
    initNotificacionesNamespace() {
        if (!this.io) return;

        const ns = this.io.of('/notificaciones');

        ns.use((socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) return next(new Error('Token requerido'));
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.user = decoded;
                next();
            } catch {
                next(new Error('Token inválido'));
            }
        });

        ns.on('connection', (socket) => {
            socket.on('suscribir_poliza', (polizaId) => {
                socket.join(`poliza:${polizaId}`);
            });
            socket.on('desuscribir_poliza', (polizaId) => {
                socket.leave(`poliza:${polizaId}`);
            });
        });

        this.notificacionesNS = ns;
        console.log('🔔 Namespace /notificaciones inicializado');
    }

    /**
     * Emite el evento firma:actualizada a todos los suscriptores de esa póliza
     */
    emitFirmaActualizada(polizaId, estado) {
        if (!this.notificacionesNS) return;
        this.notificacionesNS.to(`poliza:${polizaId}`).emit('firma:actualizada', {
            polizaId,
            estado
        });
        console.log(`🔔 Emitido firma:actualizada para póliza ${polizaId} → ${estado}`);
    }
}

// Crear instancia singleton
const activeUsersWS = new ActiveUsersWebSocket();

module.exports = activeUsersWS;