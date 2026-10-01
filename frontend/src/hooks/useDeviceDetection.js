import { useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar dispositivos móviles
 * @param {number} breakpoint - Ancho de pantalla considerado como móvil (default: 768px)
 * @returns {object} - Información sobre el dispositivo
 */
const useDeviceDetection = (breakpoint = 768) => {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    screenWidth: 0,
    screenHeight: 0,
    userAgent: '',
    isIOS: false,
    isAndroid: false,
    orientation: 'portrait'
  });

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Detectar tipo de dispositivo por user agent
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
      const isAndroid = /Android/.test(userAgent);
      const isMobileUserAgent = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      // Detectar por tamaño de pantalla
      const isMobileScreen = screenWidth <= breakpoint;
      const isTabletScreen = screenWidth > breakpoint && screenWidth <= 1024;
      const isDesktopScreen = screenWidth > 1024;
      
      // Combinación de ambos métodos
      const isMobile = isMobileUserAgent || isMobileScreen;
      const isTablet = !isMobile && isTabletScreen;
      const isDesktop = !isMobile && !isTablet;
      
      // Detectar orientación
      const orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth,
        screenHeight,
        userAgent,
        isIOS,
        isAndroid,
        orientation
      });
    };

    // Verificar al montar
    checkDevice();

    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, [breakpoint]);

  return deviceInfo;
};

export default useDeviceDetection;
