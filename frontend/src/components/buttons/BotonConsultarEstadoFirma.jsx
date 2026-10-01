/**
 * Botón independiente para consultar el estado de firma de una póliza al instante,
 * sin esperar a la corrida periódica del job de sincronización
 * (backend/jobs/sincronizarEstadosFirmaJob.js).
 *
 * Llama directamente a GET /api/vafirma/estado/:polizaId, que consulta a VaFirma
 * en el momento y actualiza la base de datos si el estado cambió.
 */

import { useState } from 'react';
import { Button, OverlayTrigger, Tooltip, Spinner } from '@/components/compat/bootstrap';
import { FaSyncAlt } from '@/lib/icons';
import axios from 'axios';
import { API_URL } from '../config';

const BotonConsultarEstadoFirma = ({
  poliza,
  onEstadoActualizado,
  onError,
  size = 'sm',
  variant = 'outline-secondary',
  showLabel = false
}) => {
  const [loading, setLoading] = useState(false);

  // Solo tiene sentido si la póliza tiene alguna solicitud de firma registrada
  const fueEnviada = Boolean(poliza?.estado_firma || poliza?.fecha_envio_firma);
  if (!fueEnviada) {
    return null;
  }

  const handleClick = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cober_token');
      const { data } = await axios.get(
        `${API_URL}/vafirma/estado/${poliza.id}`,
        {
          params: { _t: Date.now() },
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );

      if (data?.success) {
        const estadoLocal = data.data?.estadoLocal || null;
        if (onEstadoActualizado) onEstadoActualizado(estadoLocal, data.data);
      } else {
        if (onError) onError(data?.error || 'No se pudo consultar el estado de firma');
      }
    } catch (err) {
      const mensaje =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Error al consultar el estado de firma';
      if (onError) onError(mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip>Consultar estado de firma ahora (no espera la sincronización automática)</Tooltip>}
    >
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={loading}
        title="Consultar estado ahora"
      >
        {loading ? (
          <Spinner size="sm" animation="border" />
        ) : (
          <FaSyncAlt />
        )}
        {showLabel && (loading ? ' Consultando...' : ' Consultar estado')}
      </Button>
    </OverlayTrigger>
  );
};

export default BotonConsultarEstadoFirma;
