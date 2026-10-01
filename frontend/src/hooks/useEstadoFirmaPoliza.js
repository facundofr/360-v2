/**
 * Hook para consultar y monitorear el estado de firma de una póliza en VaFirma
 * 
 * ESTADOS POSIBLES:
 * - null: No hay registro de envío a firma
 * - 'pending': Enviado, esperando firma del prospecto
 * - 'signed': Firmado exitosamente
 * - 'rejected': Rechazado por el prospecto
 * - 'expired': Expirado (tiempo límite superado)
 * 
 * USO:
 * const { estadoFirma, consultarEstado, loading, error } = useEstadoFirmaPoliza(polizaId);
 * 
 * useEffect(() => {
 *   consultarEstado();
 *   const interval = setInterval(consultarEstado, 30000); // Consultar cada 30s
 *   return () => clearInterval(interval);
 * }, []);
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL, WS_URL } from '../components/config';

export const useEstadoFirmaPoliza = (polizaId) => {
  const [estadoFirma, setEstadoFirma] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const consultandoRef = useRef(false);

  /**
   * Consultar el estado actual de firma de la póliza
   * @returns {Promise<Object>} Datos del estado
   */
  const consultarEstado = useCallback(async () => {
    if (!polizaId) {
      setError('ID de póliza no especificado');
      return null;
    }

    // Evitar consultas simultáneas
    if (consultandoRef.current) {
      return null;
    }

    consultandoRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/vafirma/estado/${polizaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cober_token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No hay registro de envío a firma para esta póliza
          console.log(`ℹ️ Póliza ${polizaId}: No enviada a firma`);
          setEstadoFirma(null);
          return null;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al consultar estado');
      }

      const resultado = await response.json();

      if (resultado.success) {
        const estadoData = {
          estadoLocal: resultado.data.estadoLocal,
          estadoVaFirma: resultado.data.estadoVaFirma,
          docUUID: resultado.data.docUUID,
          emailFirmante: resultado.data.emailFirmante,
          requiereBiometria: resultado.data.requiereBiometria
        };

        console.log(`✅ Estado de póliza ${polizaId}:`, estadoData.estadoLocal);
        setEstadoFirma(estadoData);
        return estadoData;
      } else {
        throw new Error(resultado.error || 'Error al consultar estado');
      }

    } catch (err) {
      const errorMsg = err.message || 'Error al consultar estado de firma';
      setError(errorMsg);
      console.error('❌ Error consultando estado:', errorMsg);
      return null;
    } finally {
      setLoading(false);
      consultandoRef.current = false;
    }
  }, [polizaId]);

  /**
   * Determinar si la póliza está firmada
   */
  const estaFirmada = useCallback(() => {
    return estadoFirma?.estadoLocal === 'signed';
  }, [estadoFirma]);

  /**
   * Determinar si la póliza está pendiente de firma
   */
  const estaPendiente = useCallback(() => {
    return estadoFirma?.estadoLocal === 'pending';
  }, [estadoFirma]);

  /**
   * Determinar si la póliza fue rechazada
   */
  const estaRechazada = useCallback(() => {
    return estadoFirma?.estadoLocal === 'rejected';
  }, [estadoFirma]);

  /**
   * Determinar si la póliza expiró
   */
  const estaExpirada = useCallback(() => {
    return estadoFirma?.estadoLocal === 'expired';
  }, [estadoFirma]);

  /**
   * Determinar si la póliza fue enviada a firma
   */
  const fueEnviada = useCallback(() => {
    return estadoFirma !== null;
  }, [estadoFirma]);

  // Escuchar firma:actualizada por WebSocket y refrescar estado automáticamente
  useEffect(() => {
    if (!polizaId) return;
    const token = localStorage.getItem('cober_token');
    if (!token) return;

    const socket = io(`${WS_URL}/notificaciones`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      socket.emit('suscribir_poliza', polizaId);
    });

    socket.on('firma:actualizada', ({ polizaId: pid, estado }) => {
      if (String(pid) !== String(polizaId)) return;
      setEstadoFirma(prev => prev ? { ...prev, estadoLocal: estado } : { estadoLocal: estado });
    });

    return () => socket.disconnect();
  }, [polizaId]);

  return {
    estadoFirma,
    consultarEstado,
    loading,
    error,
    // Métodos de utilidad
    estaFirmada,
    estaPendiente,
    estaRechazada,
    estaExpirada,
    fueEnviada
  };
};

export default useEstadoFirmaPoliza;
