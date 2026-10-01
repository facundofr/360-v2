/**
 * Botón reutilizable para enviar póliza a firma
 * Se integra en las cards de pólizas (vendedor, supervisor, backoffice)
 * 
 * ESTADOS:
 * - No enviado: Muestra botón "Enviar a Firma"
 * - Enviado: Oculta el botón automáticamente
 * - Firmado: Oculta el botón y muestra badge de éxito
 */

import { Alert, Button } from '@/components/compat/bootstrap';
import { ToneBadge } from '@/components/app/tone-badge';
import { FaPaperPlane } from '@/lib/icons';
import { useState, useEffect } from 'react';
import ConfirmarDatosProspectoModal from '../modals/ConfirmarDatosProspectoModal';
import useEnviarPolizaFirma from '../../hooks/useEnviarPolizaFirma';
import useEstadoFirmaPoliza from '../../hooks/useEstadoFirmaPoliza';
import BotonDescargarPolizaFirmada from './BotonDescargarPolizaFirmada';

const BotonEnviarFirma = ({ 
  poliza,
  onExito,
  onError,
  size = 'sm',
  variant = 'info',
  disabled = false,
  showLabel = true,
  tooltip = 'Enviar póliza a firma electrónica',
  autoConsultarEstado = false,  // Deshabilitado por defecto - usar estado de poliza directamente
  userRole = null  // Rol del usuario (supervisor, backoffice, vendedor)
}) => {
  const [showModal, setShowModal] = useState(false);
  const [refrescarKey, setRefrescarKey] = useState(0); // ✅ Key para forzar refresco
  const [mostrarExito, setMostrarExito] = useState(false); // ✅ Alert de éxito
  const { enviarAFirma, loading, error, setError } = useEnviarPolizaFirma();
  
  // Hook para consultar estado de firma (solo si autoConsultarEstado es true)
  const {
    estadoFirma,
    consultarEstado,
    loading: loadingEstado,
    fueEnviada: fueEnviadaHook,
    estaFirmada: estaFirmadaHook
  } = useEstadoFirmaPoliza(autoConsultarEstado ? poliza?.id : null);

  // Consultar estado al montar el componente y cuando cambie la key (solo si autoConsultarEstado es true)
  useEffect(() => {
    if (autoConsultarEstado && poliza?.id) {
      consultarEstado();
    }
  }, [poliza?.id, refrescarKey, autoConsultarEstado]); // ✅ Removida dependencia consultarEstado

  // ✅ Usar estado de la póliza directamente si no se consulta automáticamente
  const fueEnviada = () => {
    if (autoConsultarEstado) {
      return fueEnviadaHook();
    }
    // Regla UX:
    // - Vendedor: se oculta el botón si ya hubo cualquier envío (pending o signed)
    // - Supervisor/BackOffice: se oculta solo si hay un envío pendiente; si está firmada, se permite reenviar
    const hayPendiente = poliza?.estado_firma === 'pending';
    if (userRole === 'supervisor' || userRole === 'backoffice') {
      return !!hayPendiente; // permitir reenviar aunque exista firmado
    }
    return Boolean(poliza?.fecha_envio_firma || hayPendiente || poliza?.estado_firma === 'signed');
  };

  const estaFirmada = () => {
    if (autoConsultarEstado) {
      return estaFirmadaHook();
    }
    // Usar datos de la póliza directamente
    return poliza?.estado_firma === 'signed' || poliza?.fecha_firma;
  };

  // Validar que la póliza tenga datos mínimos
  const puedeEnviar = poliza && 
    poliza.prospecto_email && 
    !disabled &&
    !fueEnviada(); // No permitir enviar si ya fue enviada

  // ✅ Verificar si el usuario puede enviar a firma
  const puedeEnviarFirma = (userRole === 'supervisor' || userRole === 'backoffice') && puedeEnviar;

  // ✅ Función para obtener el color y texto del estado
  const obtenerEstadoBadge = () => {
    if (estaFirmada()) {
      return { color: 'success', label: '✅ Firmada' };
    }
    if (fueEnviada()) {
      return { color: 'warning', label: '⏳ Pendiente de Firma' };
    }
    return { color: 'default', label: '📄 Pendiente de Envío' };
  };

  const estadoBadge = obtenerEstadoBadge();

  // Manejar confirmación de datos
  const handleConfirmar = async (emailConfirmado, telefonoConfirmado, tipoFirma) => {
    // Callbacks para el polling automático
    const onFirmada = (datos) => {
      console.log('✅ Póliza firmada:', datos);
      setShowModal(false);
      setMostrarExito(true);
      
      // Ocultar alerta después de 5 segundos
      setTimeout(() => {
        setMostrarExito(false);
      }, 5000);
      
      // Forzar refresco del estado
      setTimeout(() => {
        setRefrescarKey(prev => prev + 1);
      }, 1500);
      
      if (onExito) onExito(datos);
    };

    const onErrorPolling = (errorMsg) => {
      console.error('❌ Error en polling:', errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    };

    const resultado = await enviarAFirma(
      poliza,
      emailConfirmado,
      telefonoConfirmado,
      onFirmada,  // ← Callback cuando se firma
      onErrorPolling,  // ← Callback en caso de error o timeout
      tipoFirma  // ← 'biometrica' o 'simple'
    );
    
    if (resultado.success) {
      setShowModal(false);
      
      // ✅ Mostrar alerta de éxito
      setMostrarExito(true);
      
      // ✅ Ocultar alerta después de 5 segundos
      setTimeout(() => {
        setMostrarExito(false);
      }, 5000);
      
      // ✅ Forzar refresco del estado incrementando la key
      setTimeout(() => {
        setRefrescarKey(prev => prev + 1);
      }, 1500); // Esperar 1.5 segundos para que la BD se actualice
      
      if (onExito) onExito(resultado);
    } else {
      if (onError) onError(resultado.error);
    }
  };

  // Si la póliza ya fue enviada, mostrar solo el botón de descarga
  if (fueEnviada()) {
    return (
      <>
        {/* Botón de descarga solo si está firmada */}
        {estaFirmada() && (
          <BotonDescargarPolizaFirmada 
            polizaId={poliza.id}
            size={size}
            showLabel={showLabel}
          />
        )}
      </>
    );
  }

  // ✅ Si es VENDEDOR: mostrar solo el badge del estado
  if (userRole === 'vendedor') {
    return (
      <ToneBadge tone={{ success: "success", warning: "pending", error: "lost", info: "contact", primary: "progress" }[estadoBadge.color] || "neutral"} className="text-sm">
        {estadoBadge.label}
      </ToneBadge>
    );
  }

  // ✅ Si es SUPERVISOR o BACKOFFICE: mostrar botón de envío
  if (userRole !== 'supervisor' && userRole !== 'backoffice') {
    return null; // No mostrar nada si el rol no es reconocido
  }

  // Si no fue enviada, mostrar botón de envío
  return (
    <>
      {/* ✅ Alert de éxito */}
      {mostrarExito && (
        <Alert 
          variant="success" 
          dismissible
          onClose={() => setMostrarExito(false)}
          className="mb-4"
        >
          ✅ ¡Póliza enviada exitosamente! El firmante recibirá un email para completar la firma.
        </Alert>
      )}

      <Button
        size={size}
        variant={variant}
        title={userRole === 'supervisor' || userRole === 'backoffice' ? 'Enviar a firma (si hay pendientes, se expiran; no borra firmadas)' : tooltip}
        disabled={!puedeEnviarFirma || loading}
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2"
      >
        {loading ? (
          <>
            <span 
              className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2" 
              role="status" 
              aria-hidden="true"
            ></span>
            {showLabel && 'Enviando...'}
          </>
        ) : (
          <>
            <FaPaperPlane />
            {showLabel && 'Enviar a Firma'}
          </>
        )}
      </Button>

      {/* Modal de confirmación */}
      <ConfirmarDatosProspectoModal
        show={showModal}
        poliza={poliza}
        loading={loading}
        onConfirmar={handleConfirmar}
        onCancelar={() => {
          setShowModal(false);
          setError(null);
        }}
      />
    </>
  );
};

export default BotonEnviarFirma;
