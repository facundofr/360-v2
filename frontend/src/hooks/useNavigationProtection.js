import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from '@/lib/alerts';
import { API_URL } from '../components/config';

// 🛡️ Hook para prevenir navegación hacia atrás desde dashboards autenticados
export const usePreventBackNavigation = (enabled = true) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;

    const handlePopState = (event) => {
      const token = localStorage.getItem('cober_token');
      const userRole = parseInt(localStorage.getItem('cober_user_role'));
      
      // Si el usuario está autenticado
      if (token && userRole) {
        // Rutas públicas a las que no debe poder volver
        const publicRoutes = ['/', '/register', '/reset', '/verify-email'];
        const currentPath = window.location.pathname;
        
        // Si está intentando ir a una ruta pública
        if (publicRoutes.some(route => currentPath === route || currentPath.startsWith(route))) {
          console.log('🚫 Prevención de navegación: Usuario autenticado no puede ir a rutas públicas');
          
          // Prevenir la navegación
          event.preventDefault();
          
          // Redirigir al dashboard correspondiente
          const roleRedirects = {
            1: '/vendedor',           // VENDEDOR
            2: '/supervisor',         // SUPERVISOR
            3: '/admin'               // ADMIN
          };
          
          const userDashboard = roleRedirects[userRole] || '/unknown-role';
          
          // Usar pushState para mantener el estado correcto del historial
          window.history.pushState(null, '', userDashboard);
          navigate(userDashboard, { replace: true });
        }
      }
    };

    // Agregar el listener
    window.addEventListener('popstate', handlePopState);
    
    // Push state inicial para establecer el punto de referencia
    window.history.pushState(null, '', window.location.pathname);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, navigate, location.pathname]);
};

// 🔒 Hook para bloquear completamente el botón atrás con funcionalidad de logout
export const useBlockBackButton = (enabled = true, customMessage = null) => {
  const navigate = useNavigate();

  // 🚪 Función para manejar el logout (replicando la lógica del NavBar)
  const handleLogout = useCallback(async () => {
    try {
      // Intentar cerrar sesión en el backend
      const token = localStorage.getItem('cober_token');
      const sessionId = localStorage.getItem('cober_sessionId');
      const loginTime = localStorage.getItem('cober_loginTime');
      
      if (token && sessionId && loginTime) {
        try {
          // Calcular tiempo de sesión
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
          // Continuar con el logout local aunque falle el backend
        }
      } else {
        console.warn('⚠️ Datos de sesión incompletos, saltando cierre de sesión en backend');
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      // Limpiar localStorage
      localStorage.removeItem('cober_token');
      localStorage.removeItem('cober_loginTime');
      localStorage.removeItem('cober_sessionId');
      localStorage.removeItem('cober_user_id');
      localStorage.removeItem('cober_first_name');
      localStorage.removeItem('cober_last_name');
      localStorage.removeItem('cober_user_role');
      localStorage.removeItem('cober_user_email');
      
      // Limpiar el historial y redirigir
      window.history.replaceState(null, '', '/');
      navigate('/', { replace: true });
      
      // Forzar recarga para asegurar limpieza completa
      window.location.reload();
    }
  }, [navigate]);

  useEffect(() => {
    if (!enabled) return;

    const blockBack = () => {
      // Empujar un estado al historial
      window.history.pushState(null, '', window.location.pathname);
    };

    const handlePopState = async (event) => {
      // Prevenir la navegación
      event.preventDefault();
      
      // Mostrar confirmación personalizada con SweetAlert2
      const result = await Swal.fire({
        title: '🚪 ¿Cerrar sesión?',
        text: 'Para salir del sistema, utiliza el botón "Cerrar Sesión". ¿Deseas cerrar sesión ahora?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '✅ Sí, cerrar sesión',
        cancelButtonText: '❌ Permanecer aquí',
        allowOutsideClick: false,
        allowEscapeKey: false
      });

      if (result.isConfirmed) {
        // Si confirma, ejecutar logout
        await handleLogout();
        
        Swal.fire({
          title: '✅ Sesión cerrada',
          text: 'Has cerrado sesión exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        // Si cancela, mantener en la página actual
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    // Configurar el bloqueo inicial
    blockBack();
    
    // Agregar listener
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, handleLogout]);
};

// 🎯 Hook específico para dashboards
export const useDashboardProtection = () => {
  const navigate = useNavigate();
  
  const forceLogout = useCallback(async () => {
    try {
      // Intentar cerrar sesión en el backend
      const token = localStorage.getItem('cober_token');
      const sessionId = localStorage.getItem('cober_sessionId');
      const loginTime = localStorage.getItem('cober_loginTime');
      
      if (token && sessionId && loginTime) {
        try {
          // Calcular tiempo de sesión
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
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      // Limpiar todo el localStorage
      localStorage.clear();
      
      // Limpiar el historial y redirigir
      window.history.replaceState(null, '', '/');
      navigate('/', { replace: true });
      
      // Forzar recarga para asegurar limpieza completa
      window.location.reload();
    }
  }, [navigate]);

  // Función para navegación segura (solo permite rutas autorizadas)
  const safeNavigate = useCallback((path) => {
    const token = localStorage.getItem('cober_token');
    const userRole = parseInt(localStorage.getItem('cober_user_role'));
    
    if (!token || !userRole) {
      forceLogout();
      return;
    }

    // Rutas permitidas por rol
    const allowedRoutes = {
      1: [ // VENDEDOR
        '/vendedor',
        '/prospectos-dashboard',
        '/prospectos'
      ],
      2: [ // SUPERVISOR
        '/supervisor',
        '/supervisor-dashboard',
        '/supervisor-resumen',
        '/vendedor',
        '/prospectos-dashboard',
        '/prospectos'
      ],
      3: [ // ADMIN
        '/admin',
        '/admin-dashboard',
        '/supervisor',
        '/supervisor-dashboard',
        '/supervisor-resumen',
        '/vendedor',
        '/prospectos-dashboard',
        '/prospectos'
      ]
    };

    const userAllowedRoutes = allowedRoutes[userRole] || [];
    
    // Verificar si la ruta está permitida
    const isAllowed = userAllowedRoutes.some(route => 
      path === route || path.startsWith(route + '/')
    );

    if (isAllowed) {
      navigate(path);
    } else {
      console.warn(`🚫 Navegación bloqueada: ${path} no permitida para rol ${userRole}`);
      
      // Redirigir al dashboard principal del usuario
      const defaultDashboards = {
        1: '/vendedor',
        2: '/supervisor',
        3: '/admin'
      };
      
      navigate(defaultDashboards[userRole] || '/unknown-role');
    }
  }, [navigate, forceLogout]);

  return {
    forceLogout,
    safeNavigate
  };
};
