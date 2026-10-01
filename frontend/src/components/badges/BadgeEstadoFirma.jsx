/**
 * Badge visual para mostrar el estado de firma de una póliza
 * Se integra en las cards de pólizas (vendedor, supervisor, backoffice)
 * 
 * ESTADOS:
 * - null/undefined: No enviado a firma (no muestra nada)
 * - 'pending': Pendiente de firma (badge amarillo)
 * - 'signed': Firmado (badge verde)
 * - 'rejected': Rechazado (badge rojo)
 * - 'expired': Expirado (badge gris)
 */

import { Badge } from '@/components/compat/bootstrap';
import { FaCheckCircle, FaClock, FaTimesCircle, FaExclamationTriangle } from '@/lib/icons';

const BadgeEstadoFirma = ({ poliza, estado, className = '' }) => {
  // Obtener el estado desde el objeto poliza si se proporciona, sino usar estado directamente
  const estadoFirma = poliza?.estado_firma || estado;
  
  // Si no hay estado, no mostrar nada
  if (!estadoFirma) {
    return null;
  }

  // Configuración de estilos según el estado
  const configuraciones = {
    pending: {
      bg: 'warning',
      icon: <FaClock className="me-1" />,
      texto: 'Pendiente de firma',
      title: 'La póliza fue enviada y está esperando la firma del prospecto'
    },
    signed: {
      bg: 'success',
      icon: <FaCheckCircle className="me-1" />,
      texto: 'Póliza firmada',
      title: 'La póliza ha sido firmada exitosamente por el prospecto'
    },
    rejected: {
      bg: 'danger',
      icon: <FaTimesCircle className="me-1" />,
      texto: 'Firma rechazada',
      title: 'El prospecto rechazó la firma de la póliza'
    },
    expired: {
      bg: 'secondary',
      icon: <FaExclamationTriangle className="me-1" />,
      texto: 'Firma expirada',
      title: 'El plazo para firmar la póliza ha expirado'
    }
  };

  const config = configuraciones[estadoFirma] || {
    bg: 'secondary',
    icon: null,
    texto: 'Estado desconocido',
    title: 'Estado de firma desconocido'
  };

  return (
    <Badge 
      bg={config.bg} 
      className={`inline-flex items-center ${className}`}
      title={config.title}
    >
      {config.icon}
      {config.texto}
    </Badge>
  );
};

export default BadgeEstadoFirma;
