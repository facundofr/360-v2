import { useEffect, useRef } from 'react';
import axios from 'axios';
import { ENDPOINTS } from '../components/config';

/**
 * ✅ HOOK PARA MANTENER ACTIVIDAD DEL USUARIO
 * 
 * Este hook envía automáticamente "heartbeats" al servidor para mantener
 * al usuario como "activo" mientras navega por la aplicación.
 */

const useUserActivity = (intervalMinutes = 2) => {
  const intervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Función para enviar heartbeat al servidor
  const sendHeartbeat = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      if (!token) {
        console.log('No hay token disponible para heartbeat');
        return;
      }

      const currentPage = window.location.pathname;
      const response = await axios.post(
        `${ENDPOINTS.ADMIN}/users/heartbeat`,
        {
          page: currentPage,
          action: 'heartbeat',
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log('💓 Heartbeat enviado exitosamente');
        lastActivityRef.current = Date.now();
      }
    } catch (error) {
      console.error('❌ Error enviando heartbeat:', error.response?.data?.message || error.message);
    }
  };

  // Detectar actividad del usuario (mouse, teclado, scroll)
  const trackUserInteraction = () => {
    lastActivityRef.current = Date.now();
  };

  useEffect(() => {
    const token = localStorage.getItem('cober_token');
    if (!token) {
      return; // No iniciar tracking si no hay token
    }

    console.log(`🔄 Iniciando tracking de actividad cada ${intervalMinutes} minutos`);

    // Eventos para detectar actividad del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Agregar listeners para detectar actividad
    events.forEach(event => {
      document.addEventListener(event, trackUserInteraction, true);
    });

    // Enviar heartbeat inicial inmediatamente
    sendHeartbeat();

    // Configurar intervalo para enviar heartbeats periódicos
    intervalRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      const inactiveThreshold = 10 * 60 * 1000; // 10 minutos

      // Solo enviar heartbeat si el usuario ha estado activo recientemente
      if (timeSinceLastActivity < inactiveThreshold) {
        sendHeartbeat();
      } else {
        console.log('🔕 Usuario inactivo, saltando heartbeat');
      }
    }, intervalMinutes * 60 * 1000);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Remover event listeners
      events.forEach(event => {
        document.removeEventListener(event, trackUserInteraction, true);
      });
      
      console.log('🛑 Tracking de actividad detenido');
    };
  }, [intervalMinutes]);

  // Función para enviar heartbeat manual
  const sendManualHeartbeat = () => {
    sendHeartbeat();
  };

  // Función para verificar si el usuario está activo
  const isUserActive = () => {
    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
    return timeSinceLastActivity < 5 * 60 * 1000; // Activo si hubo actividad en los últimos 5 minutos
  };

  return {
    sendManualHeartbeat,
    isUserActive,
    lastActivity: lastActivityRef.current
  };
};

export default useUserActivity;