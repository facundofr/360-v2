import { useState, useEffect, useCallback } from 'react';

/**
 * Hook optimizado para manejar la visibilidad de la página
 * SIN causar re-renders completos de la aplicación
 */
export const usePageVisibility = () => {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  const handleVisibilityChange = useCallback(() => {
    const currentlyVisible = !document.hidden;
    setIsVisible(currentlyVisible);
    
    if (currentlyVisible) {
      console.log('📱 Página visible - sin acciones disruptivas');
    } else {
      console.log('📱 Página oculta - pausando actividad');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // También escuchar eventos de focus/blur de la ventana
    const handleFocus = () => {
      console.log('📱 Window focus');
      setIsVisible(true);
    };
    
    const handleBlur = () => {
      console.log('📱 Window blur');
      setIsVisible(false);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleVisibilityChange]);

  return { isVisible };
};

/**
 * Hook para detectar si la aplicación está corriendo en un dispositivo móvil
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const smallScreen = window.innerWidth <= 768;
      
      setIsMobile(mobile || (touchDevice && smallScreen));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

/**
 * Hook para ejecutar callbacks específicos cuando la página se vuelve visible
 * (para casos donde SÍ necesitas hacer algo al volver)
 */
export const usePageFocus = (callback, dependencies = []) => {
  const { isVisible } = usePageVisibility();
  const [wasVisible, setWasVisible] = useState(isVisible);

  useEffect(() => {
    if (isVisible && !wasVisible && typeof callback === 'function') {
      console.log('📱 Ejecutando callback de focus');
      callback();
    }
    setWasVisible(isVisible);
  }, [isVisible, wasVisible, callback, ...dependencies]);
};
