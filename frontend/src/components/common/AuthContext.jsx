import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from '@/lib/alerts';
import { API_URL } from '../config';
// import { registerFcmToken, unregisterFcmToken } from '../../push/fcm';

// 🔐 Crear contexto de autenticación
const AuthContext = createContext();

// 🪝 Hook para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

// 🛡️ Proveedor de autenticación
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // 🔍 Verificar autenticación al cargar
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // ✅ Verificar estado de autenticación
  // SECURITY: Valida el token contra el backend para prevenir acceso cross-app.
  // Ambas apps (Cober y Bristol) comparten el mismo dominio y por ende el mismo
  // localStorage. Sin esta validación, un token de Bristol permitía entrar a Cober.
  const checkAuthStatus = async () => {
    try {
      // Leer con prefijo cober_ (nuevo) con fallback a clave sin prefijo (migración)
      const token = localStorage.getItem('cober_token') || localStorage.getItem('token');

      if (!token) {
        clearAuthData();
        return;
      }

      // 🔐 VALIDACIÓN CRÍTICA: verificar el token contra el backend de Cober.
      // Rechaza tokens de otras apps (diferente JWT_SECRET), tokens expirados,
      // y tokens en blacklist.
      try {
        const response = await axios.get(`${API_URL}/auth/session-status`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        });
        if (!response.data.active) {
          clearAuthData();
          return;
        }
      } catch {
        // Token inválido: JWT_SECRET incorrecto, expirado, blacklisted o red caída
        clearAuthData();
        return;
      }

      // Token válido — leer datos del usuario (prefijo nuevo con fallback al antiguo)
      const userData = {
        id: localStorage.getItem('cober_user_id') || localStorage.getItem('user_id'),
        firstName: localStorage.getItem('cober_first_name') || localStorage.getItem('first_name'),
        lastName: localStorage.getItem('cober_last_name') || localStorage.getItem('last_name'),
        email: localStorage.getItem('cober_user_email') || localStorage.getItem('user_email'),
        role: parseInt(
          localStorage.getItem('cober_user_role') || localStorage.getItem('user_role')
        ),
        sessionId: localStorage.getItem('cober_sessionId') || localStorage.getItem('sessionId'),
        loginTime: localStorage.getItem('cober_loginTime') || localStorage.getItem('loginTime'),
      };

      if (userData.id && userData.role) {
        // Migrar claves antiguas sin prefijo a claves con prefijo cober_
        if (!localStorage.getItem('cober_token') && localStorage.getItem('token')) {
          localStorage.setItem('cober_token', token);
          localStorage.setItem('cober_user_id', userData.id);
          localStorage.setItem('cober_first_name', userData.firstName);
          localStorage.setItem('cober_last_name', userData.lastName);
          localStorage.setItem('cober_user_email', userData.email);
          localStorage.setItem('cober_user_role', userData.role);
          localStorage.setItem('cober_sessionId', userData.sessionId);
          localStorage.setItem('cober_loginTime', userData.loginTime);
          // Eliminar claves antiguas
          ['token','user_id','first_name','last_name','user_email','user_role','sessionId','loginTime']
            .forEach(k => localStorage.removeItem(k));
        }

        setUser(userData);
        setIsAuthenticated(true);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        clearAuthData();
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      clearAuthData();
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Función de login
  const login = (userData, token) => {
    try {
      // Guardar en localStorage con prefijo cober_ para evitar colisión con otras
      // apps del mismo dominio (Bristol, Bariloche, etc.)
      localStorage.setItem('cober_token', token);
      localStorage.setItem('cober_user_id', userData.id);
      localStorage.setItem('cober_first_name', userData.firstName);
      localStorage.setItem('cober_last_name', userData.lastName);
      localStorage.setItem('cober_user_email', userData.email);
      localStorage.setItem('cober_user_role', userData.role);
      localStorage.setItem('cober_sessionId', userData.sessionId);
      localStorage.setItem('cober_loginTime', userData.loginTime);

      // Actualizar estado
      setUser(userData);
      setIsAuthenticated(true);

      // Configurar header global
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      console.log('✅ Login exitoso:', userData);

      return true;
    } catch (error) {
      console.error('❌ Error en login:', error);
      return false;
    }
  };

  // 🚪 Función de logout
  const logout = async (showMessage = true) => {
    try {
      const token = localStorage.getItem('cober_token');
      const sessionId = localStorage.getItem('cober_sessionId');
      const loginTime = localStorage.getItem('cober_loginTime');

      // Intentar desregistrar FCM
      try {
        // await desregistrarTokenFCM(); // Comentado por ahora
      } catch (e) {
        console.warn('⚠️ No se pudo desregistrar token FCM en logout:', e);
      }

      // Intentar cerrar sesión en el backend
      if (token && sessionId && loginTime) {
        try {
          const logoutTime = new Date().toISOString();
          const sessionStartTime = new Date(loginTime);
          const sessionTimeSeconds = Math.floor((new Date() - sessionStartTime) / 1000);

          await axios.post(`${API_URL}/sessions/end`, {
            session_id: parseInt(sessionId),
            logout_time: logoutTime,
            session_time: sessionTimeSeconds
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

          console.log('✅ Sesión cerrada exitosamente en el backend');
        } catch (error) {
          console.warn('⚠️ Error cerrando sesión en backend:', error);
        }
      }

      // Limpiar datos locales
      clearAuthData();

      if (showMessage) {
        Swal.fire({
          title: '✅ Sesión Cerrada',
          text: 'Has cerrado sesión exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }

      // Redirigir al login
      navigate('/', { replace: true });

    } catch (error) {
      console.error('❌ Error en logout:', error);
      clearAuthData();
      navigate('/', { replace: true });
    }
  };

  // 🧹 Limpiar datos de autenticación
  const clearAuthData = () => {
    // Limpiar localStorage
    const keysToRemove = [
      // Claves con prefijo (actuales)
      'cober_token', 'cober_user_id', 'cober_first_name', 'cober_last_name',
      'cober_user_email', 'cober_user_role', 'cober_sessionId', 'cober_loginTime',
      // Claves sin prefijo (legacy, por si quedan residuos)
      'token', 'user_id', 'first_name', 'last_name',
      'user_email', 'user_role', 'sessionId', 'loginTime'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Limpiar estado
    setUser(null);
    setIsAuthenticated(false);

    // Limpiar header global
    delete axios.defaults.headers.common['Authorization'];
  };

  // 🔄 Renovar sesión
  const renewSession = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.post(`${API_URL}/sessions/renew`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.renewed) {
        console.log('✅ Sesión renovada exitosamente');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error renovando sesión:', error);
      await logout(false);
      return false;
    }
  };

  // 🎯 Obtener dashboard por rol
  const getDashboardRoute = (role = user?.role) => {
    const roleRoutes = {
      1: '/vendedor',
      2: '/supervisor', 
      3: '/admin'
    };
    return roleRoutes[role] || '/unknown-role';
  };

  // 🛡️ Verificar permisos
  const hasPermission = (allowedRoles) => {
    if (!user || !isAuthenticated) return false;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(user.role);
  };

  // 📊 Valor del contexto
  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    renewSession,
    checkAuthStatus,
    getDashboardRoute,
    hasPermission,
    clearAuthData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
