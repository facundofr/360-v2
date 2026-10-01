import { useState } from 'react';
import { API_URL } from '../components/config';

export const useEliminarDocumentoFirma = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Eliminar solicitud de firma - para reenviar a firmar
   */
  const eliminarSolicitud = async (polizaId) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('cober_token');
      
      const response = await fetch(`${API_URL}/vafirma/solicitud/${polizaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar solicitud');
      }

      const data = await response.json();
      console.log('✅ Solicitudes pendientes expiradas:', data);
      return {
        success: true,
        message: 'Solicitudes pendientes expiradas. Puedes enviar nuevamente a firmar.',
        data
      };
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Eliminar documento firmado de VaFirma + BD
   */
  const eliminarDocumentoFirmado = async (polizaId, docUUID = null) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('cober_token');
      
      let url = `${API_URL}/vafirma/documento-firmado/${polizaId}`;
      if (docUUID) {
        url += `?docUUID=${encodeURIComponent(docUUID)}`;
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar documento');
      }

      const data = await response.json();
      console.log('✅ Documento eliminado:', data);
      return {
        success: true,
        message: 'Documento firmado eliminado. Puedes generar una nueva versión.',
        data
      };
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    eliminarSolicitud,
    eliminarDocumentoFirmado,
    loading,
    error
  };
};

export default useEliminarDocumentoFirma;
