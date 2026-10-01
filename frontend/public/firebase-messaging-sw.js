// Public Service Worker para notificaciones push Firebase
// Este archivo maneja las notificaciones en background

console.log('🔄 Inicializando firebase-messaging-sw.js...');

// Manejar cuando llegan notificaciones en background
self.addEventListener('push', (event) => {
  console.log('📲 Push event recibido:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📦 Datos del push:', data);
      
      const options = {
        body: data.notification?.body || 'Nueva notificación',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: data.data?.tipo || 'cober360',
        data: data.data || {},
        // 🎨 Customización adicional de notificación
        vibrate: [200, 100, 200],
        requireInteraction: false,
        actions: [
          {
            action: 'open',
            title: 'Abrir'
          },
          {
            action: 'close',
            title: 'Cerrar'
          }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification(data.notification?.title || 'Cober360', options)
      );
    } catch (error) {
      console.error('❌ Error procesando push:', error);
    }
  }
});

// Esperar a que la app envíe el Service Worker de Firebase
self.addEventListener('message', (event) => {
  console.log('📨 Mensaje recibido en SW:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'INIT_FCM') {
    console.log('✅ FCM inicializado en SW');
  }
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Click en notificación:', event.notification);
  console.log('�� Acción:', event.action);
  
  event.notification.close();
  
  // Si el usuario hace click en "Cerrar", solo cerrar
  if (event.action === 'close') {
    console.log('❌ Notificación cerrada por usuario');
    return;
  }
  
  event.waitUntil(
    // Verificar si hay sesión activa
    verificarSesionActiva().then((tieneSesion) => {
      // Determinar la URL según si tiene sesión y el tipo de notificación
      const baseUrl = '/afiliaciones';
      let url = baseUrl + '/';
      
      // Si tiene sesión, redirigir según el tipo de notificación
      if (tieneSesion) {
        const notificationData = event.notification.data || {};
        
        switch (notificationData.tipo) {
          case 'prospecto_asignado':
            // Redirigir a la vista de prospectos
            url = baseUrl + '/vendedor';
            break;
          case 'mensaje_whatsapp':
            // Redirigir directamente al chat si hay conversacion_id
            if (notificationData.conversacion_id) {
              url = baseUrl + '/vendedor?conversacion=' + notificationData.conversacion_id;
            } else {
              url = baseUrl + '/vendedor';
            }
            break;
          default:
            // Dashboard general del vendedor
            url = baseUrl + '/vendedor';
        }
      }
      
      console.log(tieneSesion 
        ? `✅ Sesión activa - Navegando a ${url}` 
        : `🔐 Sin sesión - Navegando al login (${url})`
      );
      
      return clients.matchAll({ type: 'window' }).then((clientList) => {
        // Buscar si hay una ventana abierta en el dominio
        for (let client of clientList) {
          if ('focus' in client) {
            // Enfocar la ventana existente
            client.focus();
            // Enviar mensaje para que el cliente sepa que vino de una notificación
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data,
              action: event.action,
              destinoUrl: url
            });
            // Navegar a la URL usando el cliente
            if (client.navigate) {
              return client.navigate(url);
            }
            return client;
          }
        }
        
        // Si no hay ventana, abrir la correspondiente
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      });
    }).catch((error) => {
      console.error('❌ Error verificando sesión:', error);
      // Fallback: abrir el login en la ruta correcta
      return clients.openWindow('/afiliaciones/');
    })
  );
});

// Cerrar notificación
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notificación cerrada:', event.notification);
});

/**
 * Verificar si hay sesión activa
 * Busca si hay datos guardados en IndexedDB (usado por Firebase)
 */
function verificarSesionActiva() {
  return new Promise((resolve) => {
    try {
      // Timeout de 2 segundos para evitar que se quede esperando
      const timeoutId = setTimeout(() => {
        console.warn('⏱️ Timeout verificando sesión, asumiendo sin sesión');
        resolve(false);
      }, 2000);
      
      // Intentar acceder a IndexedDB (usado por Firebase Auth)
      const dbRequest = indexedDB.open('firebaseLocalStorageDb');
      
      dbRequest.onerror = () => {
        clearTimeout(timeoutId);
        console.warn('⚠️ No se pudo acceder a IndexedDB, asumiendo sin sesión');
        resolve(false);
      };
      
      dbRequest.onsuccess = () => {
        try {
          const db = dbRequest.result;
          const transaction = db.transaction(['firebaseLocalStorage'], 'readonly');
          const store = transaction.objectStore('firebaseLocalStorage');
          
          // Verificar si hay datos guardados
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            clearTimeout(timeoutId);
            const tieneSesion = countRequest.result > 0;
            console.log(tieneSesion 
              ? '✅ Sesión activa encontrada en IndexedDB' 
              : 'ℹ️ Sin sesión activa en IndexedDB'
            );
            resolve(tieneSesion);
          };
          
          countRequest.onerror = () => {
            clearTimeout(timeoutId);
            console.warn('⚠️ Error contando registros en IndexedDB');
            resolve(false);
          };
        } catch (error) {
          clearTimeout(timeoutId);
          console.warn('⚠️ Error accediendo IndexedDB:', error);
          resolve(false);
        }
      };
    } catch (error) {
      console.error('❌ Error en verificarSesionActiva:', error);
      resolve(false);
    }
  });
}

console.log('✅ Service Worker Firebase Messaging inicializado correctamente');
