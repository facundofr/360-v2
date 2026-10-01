/**
 * Botón para descargar póliza firmada desde VaFirma
 * Solo se muestra cuando el estado es 'signed'
 * 
 * USO:
 * <BotonDescargarPolizaFirmada polizaId={123} />
 */

import { Button } from '@/components/compat/bootstrap';
import { FaDownload } from '@/lib/icons';
import { useState } from 'react';
import { API_URL } from '../config';
import Swal from '@/lib/alerts';

const BotonDescargarPolizaFirmada = ({ 
  polizaId,
  size = 'sm',
  variant = 'success',
  showLabel = true,
  className = ''
}) => {
  const [descargando, setDescargando] = useState(false);

  const descargarPolizaFirmada = async () => {
    if (!polizaId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'ID de póliza no especificado'
      });
      return;
    }

    setDescargando(true);

    try {
      const response = await fetch(`${API_URL}/vafirma/descargar-firmada/${polizaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cober_token')}`
        }
      });

      if (!response.ok) {
        // Intentar obtener el mensaje de error como JSON
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al descargar póliza firmada');
        } catch (e) {
          throw new Error(`Error al descargar póliza firmada (${response.status})`);
        }
      }

      // Obtener el contenido como Blob (binary)
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('El archivo descargado está vacío');
      }

      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Poliza_${polizaId}_Firmada.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'Descarga exitosa',
        text: 'La póliza firmada se descargó correctamente',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (err) {
      console.error('❌ Error al descargar póliza firmada:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error al descargar',
        text: err.message || 'No se pudo descargar la póliza firmada',
        confirmButtonText: 'Cerrar'
      });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={descargarPolizaFirmada}
      disabled={descargando}
      className={`inline-flex items-center gap-2 ${className}`}
      title="Descargar póliza firmada"
    >
      {descargando ? (
        <>
          <span 
            className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2" 
            role="status" 
            aria-hidden="true"
          ></span>
          {showLabel && 'Descargando...'}
        </>
      ) : (
        <>
          <FaDownload />
          {showLabel && 'Descargar firmada'}
        </>
      )}
    </Button>
  );
};

export default BotonDescargarPolizaFirmada;
