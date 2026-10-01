import React, { useState, useEffect } from 'react';

/**
 * Componente para mostrar el estado de la PWA (solo en desarrollo)
 * Útil para debugging en dispositivos móviles
 */
const PWAStatus = () => {
  const [swStatus, setSwStatus] = useState('checking');
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Verificar estado del service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          setSwStatus('active');
          setLastUpdate(new Date().toLocaleTimeString());
        } else {
          setSwStatus('not-registered');
        }
      });

      // Escuchar mensajes del service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SW_ACTIVATED') {
          setSwStatus('active');
          setLastUpdate(new Date().toLocaleTimeString());
        }
      });
    } else {
      setSwStatus('not-supported');
    }

    // Verificar si la PWA está instalada
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Escuchar evento de instalación
    window.addEventListener('beforeinstallprompt', () => {
      setIsInstallable(true);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
    });

    // Detectar cambios de conectividad
    const updateOnlineStatus = () => {
      setLastUpdate(new Date().toLocaleTimeString());
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // ✅ TEMPORALMENTE DESHABILITADO para diagnosticar recargas automáticas
  // Solo mostrar en desarrollo o cuando hay parámetro debug
  const shouldShow = false; // process.env.NODE_ENV === 'development' || 
                    // new URLSearchParams(window.location.search).has('debug-pwa');

  if (!shouldShow) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 m-4 p-2 bg-corporate text-white rounded-md" 
      style={{ 
        fontSize: '0.75rem', 
        zIndex: 9999, 
        maxWidth: '250px',
        opacity: 0.8 
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold">PWA Status</span>
        <button 
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 min-h-9 text-sm border-white/60 bg-transparent text-white hover:bg-white/10 p-0 px-1"
          onClick={() => window.location.reload()}
          title="Recargar"
        >
          🔄
        </button>
      </div>
      
      <div className="text-[0.875em]">
        <div className="flex justify-between">
          <span>SW:</span>
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${
            swStatus === 'active' ? 'bg-success' : 
            swStatus === 'checking' ? 'bg-warning' : 'bg-destructive'
          }`}>
            {swStatus === 'active' ? '✓' : 
             swStatus === 'checking' ? '...' : '✗'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Conexión:</span>
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${navigator.onLine ? 'bg-success' : 'bg-destructive'}`}>
            {navigator.onLine ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>PWA:</span>
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${
            isInstalled ? 'bg-success' : 
            isInstallable ? 'bg-warning' : 'bg-teal'
          }`}>
            {isInstalled ? 'Instalada' : 
             isInstallable ? 'Instalable' : 'Web'}
          </span>
        </div>
        
        {lastUpdate && (
          <div className="text-muted-foreground mt-1" style={{ fontSize: '0.65rem' }}>
            Último: {lastUpdate}
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAStatus;
