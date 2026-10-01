const CACHE_NAME = 'cober360-pwa-v1.8';
const STATIC_CACHE = 'cober360-static-v1.8';
const DYNAMIC_CACHE = 'cober360-dynamic-v1.8';
const API_CACHE = 'cober360-api-v1.8';

// ✅ TIMEOUTS AUMENTADOS SIGNIFICATIVAMENTE
const TIMEOUTS = {
  FAST_API: 10000,      // 10 segundos para APIs rápidas (antes 3s)
  SLOW_API: 20000,      // 20 segundos para APIs lentas
  DOCUMENT: 30000,      // 30 segundos para documentos grandes
  STATIC: 15000         // 15 segundos para recursos estáticos
};

// Recursos críticos que siempre deben estar en caché
const CRITICAL_RESOURCES = [
  '/afiliaciones/',
  '/afiliaciones/index.html',
  '/afiliaciones/manifest.json',
  '/afiliaciones/offline.html'
];

// URLs de API que deben usar estrategia de red primero
const API_PATTERNS = [
  /\/api\//,
  /\/auth\//,
  /\/dashboard\//
];

// Instalación del service worker
self.addEventListener('install', (event) => {
  console.log('📦 SW: Instalando service worker v1.8...');
  
  event.waitUntil(
    Promise.all([
      // Cachear recursos críticos primero
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 SW: Cacheando recursos críticos');
        return cache.addAll(CRITICAL_RESOURCES.map(url => {
          // Asegurar que las URLs sean absolutas
          return new Request(url, { cache: 'reload' });
        }));
      }),
      // Pre-cachear página offline
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.add('/offline.html');
      })
    ]).then(() => {
      console.log('📦 SW: Recursos críticos cacheados exitosamente');
      // ✅ NO activar inmediatamente - esperar a que no haya clientes activos
      console.log('📦 SW: Esperando para activar cuando sea seguro...');
    }).catch((error) => {
      console.error('📦 SW: Error cacheando recursos críticos:', error);
    })
  );
});

// Activación del service worker
self.addEventListener('activate', (event) => {
  console.log('🚀 SW: Activando service worker v1.8...');
  
  event.waitUntil(
    Promise.all([
      // Limpiar cachés antiguos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== API_CACHE
            ) {
              console.log('🗑️ SW: Eliminando caché antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      // ✅ REMOVIDO: clients.claim() automático que causa recargas
    ]).then(() => {
      console.log('🚀 SW: Service worker activado sin tomar control inmediato');
      
      // ✅ REMOVIDO: Notificación automática que puede causar recargas
      console.log('✅ SW: Activación completada sin interferir con la página actual');
    })
  );
});

// ✅ NETWORK-FIRST CON TIMEOUT MEJORADO Y FALLBACK INTELIGENTE
const networkFirstWithTimeout = async (request, cacheName, timeout = TIMEOUTS.FAST_API) => {
  const url = new URL(request.url);
  
  try {
    // ✅ Crear controller para poder cancelar la request si es necesario
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    console.log(`⏱️ SW: Iniciando request con timeout de ${timeout}ms:`, url.pathname);
    
    // Hacer la request con abort signal
    const response = await fetch(request.clone(), {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Si la respuesta es exitosa, cachearla
    if (response && response.status === 200) {
      try {
        const cache = await caches.open(cacheName);
        await cache.put(request.clone(), response.clone());
        console.log(`✅ SW: Respuesta cacheada exitosamente:`, url.pathname);
      } catch (cacheError) {
        console.warn('⚠️ SW: Error al cachear respuesta:', cacheError);
      }
    }
    
    return response;
  } catch (error) {
    console.log(`📱 SW: Network failed (${error.name}), intentando caché para:`, url.pathname);
    
    // Intentar obtener de caché
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('💾 SW: Respuesta encontrada en caché:', url.pathname);
      return cachedResponse;
    }
    
    // Si no hay caché, intentar estrategias alternativas
    if (request.destination === 'document') {
      console.log('📄 SW: Devolviendo página offline para documento');
      return caches.match('/offline.html');
    }
    
    // ✅ Para APIs críticas, intentar una vez más sin timeout
    if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      try {
        console.log('🔄 SW: Reintentando API sin timeout:', url.pathname);
        const retryResponse = await fetch(request.clone());
        
        if (retryResponse && retryResponse.status === 200) {
          const cache = await caches.open(cacheName);
          cache.put(request.clone(), retryResponse.clone());
        }
        
        return retryResponse;
      } catch (retryError) {
        console.error('❌ SW: Reintento también falló:', retryError);
      }
    }
    
    throw error;
  }
};

// Stale-while-revalidate: Devuelve caché inmediatamente, actualiza en background
const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Actualizar caché en background
  const fetchPromise = fetch(request.clone()).then((response) => {
    if (response && response.status === 200) {
      cache.put(request.clone(), response.clone());
    }
    return response;
  }).catch(() => {
    // Silenciar errores de red en background updates
  });
  
  // Devolver caché inmediatamente si existe, sino esperar network
  return cachedResponse || fetchPromise;
};

// Cache-first con actualización inteligente
const cacheFirstWithUpdate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Verificar si el recurso necesita actualización (más de 1 hora)
    const cachedDate = new Date(cachedResponse.headers.get('date') || 0);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (cachedDate > hourAgo) {
      // Recurso reciente, devolverlo inmediatamente
      return cachedResponse;
    } else {
      // Recurso antiguo, actualizar en background
      fetch(request.clone()).then((response) => {
        if (response && response.status === 200) {
          cache.put(request.clone(), response.clone());
        }
      }).catch(() => {
        // Silenciar errores de actualización
      });
      
      return cachedResponse;
    }
  }
  
  // No hay caché, intentar red
  try {
    const response = await fetch(request.clone());
    if (response && response.status === 200) {
      cache.put(request.clone(), response.clone());
    }
    return response;
  } catch (error) {
    // Si falla la red y no hay caché, devolver respuesta básica
    if (request.destination === 'image') {
      return new Response('', { status: 200, statusText: 'OK' });
    }
    throw error;
  }
};

// Network-first con fallback mejorado
const networkFirstWithFallback = async (request, cacheName) => {
  try {
    const response = await fetch(request.clone());
    
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request.clone(), response.clone());
    }
    
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match('/offline.html');
  }
};

// Estrategias de caché mejoradas para móviles
const getCacheStrategy = (request) => {
  const url = new URL(request.url);
  
  // 🚫 EXCLUIR COMPLETAMENTE PDFs y documentos del Service Worker
  if (
    url.pathname.includes('/pdf/') ||
    url.pathname.includes('/download/') ||
    url.pathname.includes('polizas/pdf') ||
    url.pathname.includes('documentos/') ||
    url.pathname.endsWith('.pdf') ||
    request.headers.get('accept')?.includes('application/pdf') ||
    request.headers.get('accept')?.includes('application/octet-stream')
  ) {
    console.log('📄 SW: Bypass COMPLETO para documento:', url.pathname);
    return fetch(request); // Sin ninguna modificación
  }
  
  // ✅ APIs críticas con timeout diferenciado
  if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // APIs que probablemente son más lentas
    if (
      url.pathname.includes('/polizas') ||
      url.pathname.includes('/prospectos') ||
      url.pathname.includes('/estadisticas') ||
      url.pathname.includes('/reportes')
    ) {
      console.log('🐌 SW: API lenta detectada, usando timeout extendido:', url.pathname);
      return networkFirstWithTimeout(request, API_CACHE, TIMEOUTS.SLOW_API);
    }
    
    // APIs rápidas
    return networkFirstWithTimeout(request, API_CACHE, TIMEOUTS.FAST_API);
  }
  
  // HTML: Stale-while-revalidate para navegación rápida
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    return staleWhileRevalidate(request, DYNAMIC_CACHE);
  }
  
  // Recursos estáticos: Cache-first con validación periódica
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    url.pathname.includes('/static/') ||
    url.pathname.includes('/assets/')
  ) {
    return cacheFirstWithUpdate(request, STATIC_CACHE);
  }
  
  // ✅ Otros recursos: Network-first con timeout estándar
  return networkFirstWithTimeout(request, DYNAMIC_CACHE, TIMEOUTS.STATIC);
};

// Manejo principal de fetch
self.addEventListener('fetch', (event) => {
  // Solo interceptar requests HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Ignorar requests de chrome-extension
  if (event.request.url.includes('chrome-extension')) {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // 🚫 EXCLUIR COMPLETAMENTE PETICIONES QUE CAUSAN ANIMACIONES NO DESEADAS
  if (
    // Excluir verificaciones de sesión que causan re-renders frecuentes
    url.pathname.includes('/sessions/status') ||
    url.pathname.includes('/sessions/renew') ||
    // Bypass absoluto para ruta pública de documentos
    url.pathname.startsWith('/poliza-documentos/public/') ||
    url.pathname.includes('/pdf/') ||
    url.pathname.includes('/download/') ||
    url.pathname.includes('polizas/pdf') ||
    url.pathname.includes('documentos/') ||
    url.pathname.endsWith('.pdf') ||
    url.pathname.endsWith('.doc') ||
    url.pathname.endsWith('.docx') ||
    url.pathname.endsWith('.xls') ||
    url.pathname.endsWith('.xlsx') ||
    event.request.headers.get('accept')?.includes('application/pdf') ||
    event.request.headers.get('accept')?.includes('application/octet-stream') ||
    event.request.headers.get('accept')?.includes('application/msword') ||
    event.request.headers.get('accept')?.includes('application/vnd.ms-excel')
  ) {
    console.log('� SW: Bypass completo para evitar interferencias:', event.request.url);
    return; // Permitir que el browser maneje completamente estas peticiones
  }
  
  console.log('🌐 SW: Interceptando:', event.request.method, event.request.url);
  
  event.respondWith(
    getCacheStrategy(event.request).catch((error) => {
      console.error('❌ SW: Error final en fetch:', error);
      
      // ✅ Fallback más inteligente
      if (event.request.destination === 'document') {
        return caches.match('/offline.html') || new Response('Página no disponible offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      
      // Para recursos API, devolver JSON de error
      if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
        return new Response(JSON.stringify({
          error: 'Servicio no disponible',
          message: 'Por favor, verifica tu conexión a internet'
        }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Para otros recursos
      return new Response('Recurso no disponible offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    })
  );
});

// Manejo de mensajes desde la aplicación
self.addEventListener('message', (event) => {
  console.log('📩 SW: Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏩ SW: SKIP_WAITING recibido');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CHECK_UPDATE') {
    console.log('🔄 SW: Verificando actualizaciones...');
    event.ports[0].postMessage({ updated: false });
  }
  
  if (event.data && event.data.type === 'PAGE_VISIBLE') {
    console.log('👁️ SW: Página visible - sin acciones disruptivas');
    // Solo loggear, NO hacer nada que pueda causar recargas
  }
  
  // Limpiar caché solo cuando se solicite explícitamente
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('🗑️ SW: Limpiando cachés...');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('✅ SW: Cachés limpiados');
      event.ports[0].postMessage({ cleared: true });
    });
  }
});

// Manejar errores no capturados
self.addEventListener('error', (event) => {
  console.error('💥 SW: Error no capturado:', event.error);
});

// ✅ Manejar rechazos de promesas no capturados
self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 SW: Promesa rechazada no manejada:', event.reason);
  event.preventDefault(); // Prevenir que se muestre en la consola
});

console.log('🎉 SW: Service Worker v1.8 cargado - SIN recargas automáticas ni interferencias en sesiones');
