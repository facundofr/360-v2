/**
 * Hook para mantener actualizado en tiempo real el estado de firma de una lista
 * de pólizas (tablas/listados de backoffice y supervisor), sin necesidad de
 * recargar la página ni hacer polling.
 *
 * Abre una única conexión WebSocket al namespace /notificaciones y la suscribe
 * a las rooms `poliza:{id}` de las pólizas actualmente visibles. Cuando el
 * backend emite `firma:actualizada` (ver webhookVaFirma), invoca el callback
 * con (polizaId, estado) para que el llamador actualice su estado local.
 *
 * USO:
 * useNotificacionesFirmaPolizas(
 *   polizas.map(p => p.id),
 *   useCallback((polizaId, estado) => {
 *     setPolizas(prev => prev.map(p => String(p.id) === String(polizaId) ? { ...p, estado_firma: estado } : p));
 *   }, [])
 * );
 */

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { WS_URL } from '../components/config';

export const useNotificacionesFirmaPolizas = (polizaIds, onFirmaActualizada) => {
  const socketRef = useRef(null);
  const suscritosRef = useRef(new Set());
  const callbackRef = useRef(onFirmaActualizada);

  useEffect(() => {
    callbackRef.current = onFirmaActualizada;
  }, [onFirmaActualizada]);

  // Conexión única al namespace de notificaciones
  useEffect(() => {
    const token = localStorage.getItem('cober_token');
    if (!token) return;

    const socket = io(`${WS_URL}/notificaciones`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Re-suscribir a las pólizas conocidas por si fue una reconexión
      suscritosRef.current.forEach(id => socket.emit('suscribir_poliza', id));
    });

    socket.on('firma:actualizada', ({ polizaId, estado }) => {
      callbackRef.current?.(polizaId, estado);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      suscritosRef.current.clear();
    };
  }, []);

  // Suscribirse/desuscribirse a medida que cambia la lista de pólizas visibles
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const nuevos = new Set((polizaIds || []).filter(Boolean).map(String));
    const previos = suscritosRef.current;

    for (const id of nuevos) {
      if (!previos.has(id)) socket.emit('suscribir_poliza', id);
    }
    for (const id of previos) {
      if (!nuevos.has(id)) socket.emit('desuscribir_poliza', id);
    }

    suscritosRef.current = nuevos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(polizaIds || []).join(',')]);
};

export default useNotificacionesFirmaPolizas;
