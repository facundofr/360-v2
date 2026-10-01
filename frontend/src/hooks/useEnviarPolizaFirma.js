/**
 * Hook centralizado para enviar pólizas a firma con VaFirma
 * Reutilizable en vendedor, supervisor y backoffice
 * 
 * USO:
 * const { enviarAFirma, loading, error } = useEnviarPolizaFirma();
 * 
 * const handleEnviarFirma = async (poliza) => {
 *   const resultado = await enviarAFirma(poliza, emailConfirmado, telefonoConfirmado);
 * };
 */

import { useState } from 'react';
import { API_URL } from '../components/config';

export const useEnviarPolizaFirma = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Convertir póliza a PDF en base64
   * @param {Object} poliza - Objeto de la póliza
   * @returns {Promise<string>} PDF en base64
   */
  const convertirPolizaAPDF = async (poliza) => {
    try {
      // Intentar descargar el PDF si ya existe
      if (poliza.pdf_hash) {
        const response = await fetch(`${API_URL}/polizas/pdf/${poliza.pdf_hash}`);
        if (response.ok) {
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // Extraer base64 sin el prefijo
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }

      // Si no existe PDF hash, generar desde la póliza
      console.warn('No se encontró PDF hash, usando datos de póliza');
      throw new Error('PDF no disponible');
    } catch (err) {
      console.error('Error convirtiendo póliza a PDF:', err);
      throw new Error('No se pudo convertir la póliza a PDF');
    }
  };

  /**
   * Consultar estado de firma automáticamente (polling)
   * @param {number} polizaId - ID de la póliza
   * @param {Function} onFirmada - Callback cuando se firma
   * @param {Function} onError - Callback en caso de error
   * @returns {Function} Función para cancelar el polling
   */
  const iniciarPollingAutomatico = (polizaId, onFirmada, onError) => {
    let intentos = 0;
    const maxIntentos = 30; // 5 minutos (30 x 10 segundos)
    let intervalId = null;
    let cancelado = false;

    const consultarEstado = async () => {
      try {
        console.log(`⏱️  Consultando estado (intento ${intentos + 1}/${maxIntentos})...`);
        
        const response = await fetch(`${API_URL}/vafirma/estado/${polizaId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('cober_token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Error consultando estado');
        }

        const { data } = await response.json();
        const estado = data?.estadoLocal || data?.status;

        console.log(`📊 Estado actual: ${estado}`);

        if (estado === 'signed') {
          console.log('✅ ¡Póliza firmada exitosamente!');
          cancelado = true;
          if (intervalId) clearInterval(intervalId);
          onFirmada(data);
          return;
        }

        if (estado === 'rejected') {
          console.log('❌ Firma rechazada');
          cancelado = true;
          if (intervalId) clearInterval(intervalId);
          onError('El prospecto rechazó la firma');
          return;
        }

        if (estado === 'expired') {
          console.log('⏰ Link de firma expirado');
          cancelado = true;
          if (intervalId) clearInterval(intervalId);
          onError('El link de firma expiró');
          return;
        }

        // Si llegó al máximo de intentos
        intentos++;
        if (intentos >= maxIntentos) {
          console.log('⚠️ Timeout: Se alcanzó el máximo de intentos');
          cancelado = true;
          if (intervalId) clearInterval(intervalId);
          onError('Timeout: No se completó la firma en 5 minutos');
        }
      } catch (err) {
        console.error('Error consultando estado:', err);
        intentos++;
        if (intentos >= maxIntentos) {
          cancelado = true;
          if (intervalId) clearInterval(intervalId);
          onError('Error al consultar estado de firma');
        }
      }
    };

    // Hacer primera consulta inmediatamente
    consultarEstado();

    // Si no se canceló, iniciar polling cada 10 segundos
    if (!cancelado) {
      intervalId = setInterval(consultarEstado, 10000); // 10 segundos
    }

    // Retornar función para cancelar el polling
    return () => {
      if (intervalId) clearInterval(intervalId);
      cancelado = true;
    };
  };

  /**
   * Enviar póliza a firma VaFirma
   * @param {Object} poliza - Objeto de la póliza
   * @param {string} emailConfirmado - Email confirmado del prospecto
   * @param {string} telefonoConfirmado - Teléfono confirmado del prospecto
   * @param {Function} onFirmada - Callback cuando se firma (para polling)
   * @param {Function} onErrorFirma - Callback en error (para polling)
   * @param {string} tipoFirma - 'biometrica' (default, con validación facial) o 'simple'
   * @returns {Promise<Object>} Resultado del envío
   */
  const enviarAFirma = async (poliza, emailConfirmado, telefonoConfirmado, onFirmada, onErrorFirma, tipoFirma = 'biometrica') => {
    setLoading(true);
    setError(null);

    try {
      // Validar datos requeridos
      if (!poliza) {
        throw new Error('Póliza no especificada');
      }

      if (!emailConfirmado || !emailConfirmado.trim()) {
        throw new Error('Email del prospecto es requerido');
      }

      // Teléfono ya no es requerido: solo se envía por email

      // Convertir póliza a PDF base64
      console.log('📄 Convirtiendo póliza a PDF...');
      const pdfBase64 = await convertirPolizaAPDF(poliza);

      // Obtener nombre del prospecto
      const nombreProspecto = `${poliza.prospecto_nombre || 'Prospecto'} ${poliza.prospecto_apellido || ''}`.trim();
      const numeroPoliza = poliza.numero_poliza_oficial || poliza.numero_poliza || `POL-${poliza.id}`;
      const nombreArchivo = `Poliza_${numeroPoliza}.pdf`;

      // Llamar a backend para enviar a VaFirma
      console.log('✉️  Enviando póliza a VaFirma...');

      // No enviar WhatsApp a VaFirma: solo email

      const requireBiometric = tipoFirma !== 'simple';
      const emailMessage = requireBiometric
        ? `Por favor, firma tu póliza ${numeroPoliza}. Se requiere validación de tu rostro.`
        : `Por favor, firma tu póliza ${numeroPoliza}.`;

      const response = await fetch(`${API_URL}/vafirma/enviar-poliza`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cober_token')}`
        },
        body: JSON.stringify({
          pdfBase64,
          fileName: nombreArchivo,
          signerName: nombreProspecto,
          signerEmail: emailConfirmado,
          emailSubject: `Póliza #${numeroPoliza} para firmar`,
          emailMessage,
          dni: poliza.prospecto_documento || undefined,
          // whatsapp: undefined,
          polizaId: poliza.id,
          requireBiometric,
          signatureType: 'Simple'
          // Las coordenadas se tomarán del backend (x=50, y=80 para firma al final)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar póliza a firma');
      }

      const resultado = await response.json();

      console.log('✅ Póliza enviada a firma exitosamente');
      console.log('🔄 Iniciando polling automático para monitorear estado...');

      // Iniciar polling automático si se proporcionaron callbacks
      if (onFirmada && onErrorFirma) {
        iniciarPollingAutomatico(poliza.id, onFirmada, onErrorFirma);
      }

      return {
        success: true,
        data: resultado.data,
        docUUID: resultado.data?.docUUID,
        message: 'Póliza enviada para firma. Monitorando estado automáticamente...',
        cancelPolling: () => {} // Placeholder, será sobrescrito si se necesita
      };

    } catch (err) {
      const errorMsg = err.message || 'Error al enviar póliza a firma';
      console.error('❌ Error:', errorMsg);
      setError(errorMsg);

      return {
        success: false,
        error: errorMsg
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    enviarAFirma,
    loading,
    error,
    setError
  };
};

export default useEnviarPolizaFirma;
