import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import PwaUpdateToast from './components/common/PwaUpdateToast.jsx';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AlertsHost } from '@/lib/alerts';
import App from './App';

// ✅ Tailwind + shadcn/ui
import './styles/tailwind.css';

// 🔐 reCAPTCHA v3 Site Key
const RECAPTCHA_SITE_KEY = '6LewluErAAAAAD1lny938pNyTuR7QxIR3UaJG5S3';

// ✅ Disparar evento global para notificar actualización disponible
function notifyPwaUpdateAvailable(registration) {
  window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { registration } }));
}

// ✅ PWA: Registrar Service Worker con manejo mejorado
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('🔧 DEBUG: Iniciando registro de Service Worker...');
    
  navigator.serviceWorker.register('/afiliaciones/sw.js')
      .then((registration) => {
        console.log('✅ SW registrado:', registration.scope);
        
        // Si ya hay un SW en estado waiting al cargar, ofrecer actualizar
        if (registration.waiting) {
          console.log('🔔 SW en estado waiting detectado al cargar');
          notifyPwaUpdateAvailable(registration);
        }
        
        // Verificar actualizaciones del SW (sin recarga automática)
        registration.addEventListener('updatefound', () => {
          console.log('🔧 DEBUG: updatefound detectado');
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            console.log('🔧 DEBUG: SW state changed to:', newWorker.state);
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 Nueva versión disponible');
              notifyPwaUpdateAvailable(registration);
            }
          });
        });

        // Forzar una verificación inmediata del SW al inicio (mejora para móviles)
        (async () => {
          try {
            console.log('🛰️ Forzando prefetch no-store de sw.js para detectar updates');
            await fetch('/afiliaciones/sw.js', { cache: 'no-store' });
            await registration.update();
            if (registration.waiting) {
              notifyPwaUpdateAvailable(registration);
            }
          } catch (e) {
            console.warn('⚠️ Prefetch/update inicial del SW falló:', e?.message || e);
          }
        })();

        // Chequeo pasivo: cuando la página vuelve a ser visible, verificar updates
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            try {
              console.log('👀 DEBUG: Página visible - forzando registration.update()');
              registration.update();
              if (registration.waiting) {
                notifyPwaUpdateAvailable(registration);
              }
            } catch (_) {}
          }
        });

        // Chequeo periódico de updates cada 15 minutos
        setInterval(() => {
          try {
            console.log('🕒 Chequeo periódico de actualizaciones del SW');
            registration.update();
          } catch (_) {}
        }, 15 * 60 * 1000);

        // Manejar mensajes del service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('📩 Mensaje del SW:', event.data);
          
          if (event.data.type === 'SW_ACTIVATED') {
            console.log('🚀 Service Worker activado');
          }
        });
      })
      .catch((error) => {
        console.log('❌ Error registrando SW:', error);
      });

    // Manejar visibilidad de la página (mejorado para móviles)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('� DEBUG: Página visible - verificando estado SW');
        
        // Verificar si el service worker sigue activo (sin forzar actualizaciones)
        if (navigator.serviceWorker.controller) {
          // Solo enviar mensaje informativo
          navigator.serviceWorker.controller.postMessage({
            type: 'PAGE_VISIBLE',
            timestamp: Date.now()
          });
        }
      } else {
        console.log('� DEBUG: Página oculta - pausa de actividad SW');
      }
    });
  });
}

// ✅ PWA: Manejar instalación
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('💾 PWA instalable detectada');
  e.preventDefault();
  deferredPrompt = e;
  
  // Mostrar botón de instalación personalizado si lo tienes
  // showInstallPromotion();
});

// ✅ PWA: Evento de instalación exitosa
window.addEventListener('appinstalled', (evt) => {
  console.log('🎉 PWA instalada exitosamente');
  deferredPrompt = null;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleReCaptchaProvider
      reCaptchaKey={RECAPTCHA_SITE_KEY}
      language="es"
      useRecaptchaNet={false}
      useEnterprise={false}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
    >
      <TooltipProvider>
        <App />
        <PwaUpdateToast />
        <Toaster position="top-center" richColors closeButton />
        <AlertsHost />
      </TooltipProvider>
    </GoogleReCaptchaProvider>
  </React.StrictMode>,
);
