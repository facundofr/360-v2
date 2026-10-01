const Session = require('../../models/session/sessionModel');
const moment = require('moment');

exports.createSession = async (req, res) => {
  try {
    const { login_time, user_agent, ip: clientIp } = req.body;
    const user_id = req.user.id;

    // 🛡️ Obtener la IP más confiable (del request o del body como fallback)
    const ip = req.ip || clientIp || 'unknown';

    // 🕐 Validar y convertir login_time
    if (!login_time) {
      return res.status(400).json({ 
        error: 'login_time es requerido',
        code: 'MISSING_LOGIN_TIME'
      });
    }

    // Validar que sea una fecha válida
    const loginMoment = moment(login_time);
    if (!loginMoment.isValid()) {
      return res.status(400).json({ 
        error: 'login_time debe ser una fecha válida',
        code: 'INVALID_LOGIN_TIME'
      });
    }

    const loginTimeMysql = loginMoment.format('YYYY-MM-DD HH:mm:ss');

    // 🛡️ Validar user_agent
    if (!user_agent || typeof user_agent !== 'string') {
      return res.status(400).json({ 
        error: 'user_agent es requerido',
        code: 'MISSING_USER_AGENT'
      });
    }

    // Crear la sesión
    const sessionId = await Session.create({ 
      user_id, 
      login_time: loginTimeMysql, 
      ip: ip.substring(0, 45), // Limitar IP a 45 caracteres
      user_agent: user_agent.substring(0, 500) // Limitar user_agent a 500 caracteres
    });

    console.log(`📱 Sesión creada: User ${user_id}, Session ${sessionId}, IP: ${ip}`);
    
    res.json({ 
      sessionId,
      message: 'Sesión iniciada correctamente',
      code: 'SESSION_CREATED'
    });
  } catch (error) {
    console.error('❌ Error en createSession:', error);
    res.status(500).json({ 
      message: 'Error al crear la sesión.',
      code: 'SESSION_CREATE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

exports.closeSession = async (req, res) => {
  try {
    const { session_id, logout_time, session_time } = req.body;

    // 🛡️ Validaciones
    if (!session_id || !logout_time) {
      return res.status(400).json({ 
        error: 'session_id y logout_time son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validar que sea una fecha válida
    const logoutMoment = moment(logout_time);
    if (!logoutMoment.isValid()) {
      return res.status(400).json({ 
        error: 'logout_time debe ser una fecha válida',
        code: 'INVALID_LOGOUT_TIME'
      });
    }

    const logoutTimeMysql = logoutMoment.format('YYYY-MM-DD HH:mm:ss');

    await Session.close(session_id, logoutTimeMysql, session_time || 0);
    
    console.log(`📱 Sesión cerrada: Session ${session_id}, Duration: ${session_time || 0}s`);
    
    res.json({ 
      message: 'Sesión cerrada correctamente',
      code: 'SESSION_CLOSED'
    });
  } catch (error) {
    console.error('❌ Error en closeSession:', error);
    res.status(500).json({ 
      message: 'Error al cerrar la sesión.',
      code: 'SESSION_CLOSE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// 🔍 Obtener estado de sesión (basado en JWT, no en inactividad)
exports.getSessionStatus = async (req, res) => {
  try {
    const user_id = req.user.id;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        active: false,
        message: 'Token no proporcionado',
        code: 'NO_TOKEN'
      });
    }

    // Decodificar JWT para obtener tiempo de expiración
    const jwt = require('jsonwebtoken');
    let decodedToken;
    
    try {
      decodedToken = jwt.decode(token);
    } catch (error) {
      return res.status(401).json({ 
        active: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }

    if (!decodedToken || !decodedToken.exp) {
      return res.status(401).json({ 
        active: false,
        message: 'Token sin información de expiración',
        code: 'NO_EXPIRATION'
      });
    }

    // Calcular tiempo restante basado en JWT (2 horas = 120 minutos)
    const now = Math.floor(Date.now() / 1000); // Timestamp actual en segundos
    const tokenExp = decodedToken.exp; // Timestamp de expiración del token
    const timeRemainingSeconds = tokenExp - now;
    const timeRemainingMinutes = Math.max(0, Math.ceil(timeRemainingSeconds / 60));

    // Si el token ha expirado
    if (timeRemainingMinutes <= 0) {
      return res.status(401).json({ 
        active: false,
        timeout: true,
        message: 'Sesión expirada',
        code: 'SESSION_EXPIRED'
      });
    }

    res.json({ 
      active: true,
      timeRemaining: timeRemainingMinutes,
      shouldWarn: timeRemainingMinutes <= 15, // Advertir cuando queden 15 minutos o menos
      totalTime: 120, // 2 horas total
      code: 'SESSION_ACTIVE'
    });

  } catch (error) {
    console.error('❌ Error en getSessionStatus:', error);
    res.status(500).json({ 
      active: false,
      message: 'Error al verificar estado de sesión',
      code: 'SESSION_STATUS_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// 🔄 Renovar sesión (generar nuevo JWT de 2 horas)
exports.renewSession = async (req, res) => {
  try {
    const user_id = req.user.id;
    const user = req.user; // El usuario ya está disponible del middleware

    // Generar nuevo JWT con 2 horas de duración
    const jwt = require('jsonwebtoken');
    const tokenPayload = {
      id: user.id,
      role: user.role,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      ip: req.ip
    };

    const newToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "2h" });

    // Opcional: Actualizar registro en base de datos
    const activeSession = await Session.getActiveSession(user_id);
    if (activeSession) {
      // Cerrar sesión actual y crear una nueva
      const now = moment();
      const sessionStart = moment(activeSession.login_time);
      const sessionTime = now.diff(sessionStart, 'seconds');
      
      await Session.close(activeSession.id, now.format('YYYY-MM-DD HH:mm:ss'), sessionTime);

      // Crear nueva sesión
      const newSessionId = await Session.create({
        user_id,
        login_time: now.format('YYYY-MM-DD HH:mm:ss'),
        ip: activeSession.ip,
        user_agent: activeSession.user_agent
      });

      console.log(`🔄 Sesión renovada: User ${user_id}, Old Session ${activeSession.id} → New Session ${newSessionId}`);
    }

    res.json({ 
      renewed: true,
      newToken, // Enviar el nuevo token al frontend
      timeRemaining: 120, // Nueva sesión con 120 minutos (2 horas)
      message: 'Sesión renovada exitosamente',
      code: 'SESSION_RENEWED'
    });

  } catch (error) {
    console.error('❌ Error en renewSession:', error);
    res.status(500).json({ 
      renewed: false,
      message: 'Error al renovar sesión',
      code: 'SESSION_RENEW_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};