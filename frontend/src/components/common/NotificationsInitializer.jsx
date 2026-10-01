import { useEffect, useCallback } from 'react';
import NotificationsService from '../../services/notificationsService';

/**
 * Hook para inicializar notificaciones push FCM
 */
export const useNotifications = () => {
  const initNotifications = useCallback(async () => {
    try {
      console.log('🔧 Iniciando notificaciones FCM...');
      
      // Registrar Service Worker primero
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
          });
          console.log('✅ Service Worker registrado en hook:', registration);
        } catch (error) {
          console.warn('⚠️ Error registrando Service Worker en hook:', error);
        }
      }

      const permissionGranted = await NotificationsService.initializeNotifications();
      
      if (permissionGranted) {
        // Configurar listener para notificaciones en foreground
        NotificationsService.setupForegroundNotifications((notification) => {
          console.log('📬 Notificación recibida en foreground:', notification);
          
          // Aquí puedes reproducir un sonido, mostrar una alerta, etc.
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.body,
              icon: '/logo.png',
              tag: notification.data.tipo || 'cober360'
            });
          }
        });

        // Configurar acciones específicas por tipo
        NotificationsService.onNotificationType('prospecto_asignado', (notification) => {
          console.log('🎯 Nuevo prospecto asignado:', notification);
          // Aquí puedes actualizar UI o navegar
        });

        NotificationsService.onNotificationType('mensaje_whatsapp', (notification) => {
          console.log('💬 Nuevo mensaje de WhatsApp:', notification);
          // Aquí puedes actualizar UI o navegar
        });

        console.log('✅ Notificaciones inicializadas correctamente');
      } else {
        console.warn('⚠️ Usuario denegó permisos de notificación');
      }
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
    }
  }, []);

  return { initNotifications };
};

/**
 * Componente para inicializar notificaciones
 */
export default function NotificationsInitializer({ isAuthenticated }) {
  const { initNotifications } = useNotifications();

  useEffect(() => {
    if (isAuthenticated) {
      console.log('👤 Usuario autenticado, inicializando notificaciones...');
      // Inicializar inmediatamente, sin delay
      initNotifications();
    }
  }, [isAuthenticated, initNotifications]);

  return null; // Este componente no renderiza nada, solo inicializa
}
