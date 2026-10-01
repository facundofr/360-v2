import { useState } from 'react';
import { Button, OverlayTrigger, Tooltip, Spinner } from '@/components/compat/bootstrap';
import { FaTrash, FaRedoAlt } from '@/lib/icons';
import Swal from '@/lib/alerts';
import useEliminarDocumentoFirma from '../../hooks/useEliminarDocumentoFirma';

/**
 * Botones para eliminar solicitud o documento firmado de VAFirma
 * Uso en tabla/tarjetas de pólizas
 */
const BotonesEliminarFirma = ({ poliza, onActualizar, size = 'sm', variant = 'outline' }) => {
  const { eliminarSolicitud, eliminarDocumentoFirmado, loading } = useEliminarDocumentoFirma();
  const [deleting, setDeleting] = useState(false);

  if (!poliza || !poliza.estado_firma) {
    return null;
  }

  const esDescargada = poliza.estado_firma === 'signed';
  const esPendiente = poliza.estado_firma === 'pending';

  if (!esPendiente && !esDescargada) {
    return null;
  }

  /**
   * Eliminar solicitud de firma (para pólizas aún pendientes)
   */
  const handleEliminarSolicitud = async () => {
    const confirmado = await Swal.fire({
      title: '¿Reenviar solicitud de firma?',
      text: 'No se borrará ninguna firma existente. Se marcarán como expiradas las solicitudes pendientes y podrás enviar una nueva.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f39c12',
      cancelButtonColor: '#6c757d'
    });

    if (!confirmado.isConfirmed) return;

    setDeleting(true);
    try {
      const resultado = await eliminarSolicitud(poliza.id);

      if (resultado.success) {
        await Swal.fire({
          title: '✅ Pendientes expiradas',
          text: 'Ahora puedes enviar nuevamente a firmar (se conserva cualquier firma existente).',
          icon: 'success',
          timer: 2000
        });

        if (onActualizar) {
          onActualizar();
        }
      } else {
        Swal.fire({
          title: '❌ No se pudo completar',
          text: resultado.error || 'Intenta enviar una nueva solicitud desde el botón Enviar a firma.',
          icon: 'error'
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Eliminar documento firmado (para pólizas descargadas)
   */
  const handleEliminarDocumentoFirmado = async () => {
    const confirmado = await Swal.fire({
      title: '¿Eliminar documento firmado?',
      text: 'Se eliminará el documento de VAFirma y de la base de datos. Podrás generar una nueva versión.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    });

    if (!confirmado.isConfirmed) return;

    setDeleting(true);
    try {
      const resultado = await eliminarDocumentoFirmado(poliza.id, poliza.referencia_vafirma);

      if (resultado.success) {
        await Swal.fire({
          title: '✅ Documento eliminado',
          text: 'Ahora puedes generar y firmar una nueva versión.',
          icon: 'success',
          timer: 2000
        });

        if (onActualizar) {
          onActualizar();
        }
      } else {
        Swal.fire({
          title: '❌ Error',
          text: resultado.error,
          icon: 'error'
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  // Botón para solicitudes pendientes
  if (esPendiente) {
    return (
      <OverlayTrigger
        placement="left"
        overlay={<Tooltip>Reenviar: no borra firmas. Expira pendientes y permite enviar una nueva.</Tooltip>}
      >
        <Button
          variant={`${variant}-warning`}
          size={size}
          onClick={handleEliminarSolicitud}
          disabled={loading || deleting}
          title="Eliminar solicitud"
        >
          {deleting ? (
            <Spinner size="sm" animation="border" className="me-1" />
          ) : (
            <FaRedoAlt className="me-1" />
          )}
          <span className="hidden md:inline">Reenviar</span>
        </Button>
      </OverlayTrigger>
    );
  }

  // Botón para documentos firmados
  if (esDescargada) {
    return (
      <OverlayTrigger
        placement="left"
        overlay={<Tooltip>Eliminar documento firmado para generar nueva versión</Tooltip>}
      >
        <Button
          variant={`${variant}-danger`}
          size={size}
          onClick={handleEliminarDocumentoFirmado}
          disabled={loading || deleting}
          title="Eliminar documento"
        >
          {deleting ? (
            <Spinner size="sm" animation="border" className="me-1" />
          ) : (
            <FaTrash className="me-1" />
          )}
          <span className="hidden md:inline">Eliminar Doc</span>
        </Button>
      </OverlayTrigger>
    );
  }

  return null;
};

export default BotonesEliminarFirma;
