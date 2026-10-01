import { useState, useEffect } from "react";
import { Modal, Button, Form, Alert } from "@/components/compat/bootstrap";
import { FaWhatsapp } from "@/lib/icons";
// Imports usados por la versión anterior (envío vía backend/Twilio). Descomentar si se reimplementa.
// import axios from "axios";
// import { API_URL } from "../../config";

const getWhatsAppPhoneNumber = (phone) => {
  let cleaned = String(phone || '').replace(/\D/g, '');

  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  if (cleaned.startsWith('54')) {
    return cleaned.startsWith('549') ? cleaned : `549${cleaned.slice(2)}`;
  }

  return `549${cleaned}`;
};

const EnviarCotizacionModal = ({ show, onHide, cotizacion, prospecto }) => {
  const [telefono, setTelefono] = useState(''); // ✅ Número real del prospecto (no visible al vendedor)
  const [telefonoMostrado, setTelefonoMostrado] = useState(''); // ✅ Número enmascarado que se muestra
  const [telefonoEditado, setTelefonoEditado] = useState(''); // ✅ NUEVO: Número editado por el vendedor
  const [modoEdicion, setModoEdicion] = useState(false); // ✅ NUEVO: Si está editando un número nuevo
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState('');

  // ✅ MODIFICADO: Autocompletar el teléfono cuando se abra el modal
  useEffect(() => {
    if (show && prospecto?.numero_contacto) {
      setTelefono(prospecto.numero_contacto);
      setTelefonoMostrado(maskPhoneNumber(prospecto.numero_contacto));
      setTelefonoEditado('');
      setModoEdicion(false);
    } else if (!show) {
      // Limpiar el campo cuando se cierre el modal
      setTelefono('');
      setTelefonoMostrado('');
      setTelefonoEditado('');
      setModoEdicion(false);
    }
  }, [show, prospecto?.numero_contacto]);

  // ✅ NUEVA: Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, ''); // Remover caracteres no numéricos
    if (cleaned.length < 4) return phone; // Si es muy corto, devolver tal como está
    
    // Mostrar solo los últimos 4 dígitos
    const masked = '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
    
    // Mantener formato original si tiene caracteres especiales
    if (phone.includes('+')) {
      return `+${masked}`;
    } else if (phone.includes('-') || phone.includes(' ') || phone.includes('(')) {
      // Para formatos como (011) 1234-5678 o 011 1234-5678
      return `******${cleaned.slice(-4)}`;
    }
    
    return masked;
  };

  // ✅ MODIFICADO: Manejar cuando el usuario hace foco en el campo
  const handleFocus = () => {
    // Si hace foco, activar modo edición para permitir ingresar un número nuevo
    setModoEdicion(true);
  };

  // ✅ MODIFICADO: Manejar cuando el usuario sale del campo
  const handleBlur = () => {
    // No cambiar nada al perder el foco, mantener lo que está editando
  };

  // ✅ MODIFICADO: Manejar cambios en el campo de teléfono
  const handleTelefonoChange = (e) => {
    const valor = e.target.value;
    if (modoEdicion) {
      setTelefonoEditado(valor);
    }
  };

  // ✅ NUEVO: Obtener el número a enviar (editado o el original del prospecto)
  const getNumeroParaEnviar = () => {
    return modoEdicion && telefonoEditado.trim() !== '' ? telefonoEditado.trim() : telefono;
  };

  const handleEnviar = () => {
    const numeroParaEnviar = getNumeroParaEnviar();

    if (!numeroParaEnviar || numeroParaEnviar.trim() === '') {
      setMensaje('Por favor ingresa un número de teléfono');
      setTipoMensaje('danger');
      return;
    }

    const whatsappPhone = getWhatsAppPhoneNumber(numeroParaEnviar);

    if (whatsappPhone.length < 12 || whatsappPhone.length > 15) {
      setMensaje('El número de WhatsApp ingresado no es válido');
      setTipoMensaje('danger');
      return;
    }

    const nombreCliente = `${prospecto?.nombre || ''} ${prospecto?.apellido || ''}`.trim() || 'Cliente';
    const grupoFamiliar = cotizacion?.detalles && cotizacion.detalles.length > 0
      ? cotizacion.detalles.map(d => d.vinculo).join(", ")
      : "Individual";

    const mensajeWhatsapp = `COBER - Cotización de Plan

Hola ${nombreCliente}, te compartimos los detalles de tu cotización:

Plan: ${cotizacion?.plan_nombre || 'Plan seleccionado'}
Grupo Familiar: ${grupoFamiliar}
Tipo de Afiliación: ${cotizacion?.tipo_afiliacion_nombre || 'Particular'}

Detalle de precios:
* Total Bruto: ${formatCurrency(cotizacion?.total_bruto)}
* Descuento Aporte: ${formatCurrency(cotizacion?.total_descuento_aporte)}
* Descuento Promoción: ${formatCurrency(cotizacion?.total_descuento_promocion)}

TOTAL FINAL: ${formatCurrency(cotizacion?.total_final)}

Para más información o para avanzar con la contratación, podés responder a este mensaje.`;

    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(mensajeWhatsapp)}`, '_blank', 'noopener,noreferrer');

    setMensaje('Se abrió WhatsApp con la cotización precargada. Presioná Enviar en WhatsApp para completar el envío.');
    setTipoMensaje('success');

    setTimeout(() => {
      onHide();
      setMensaje('');
    }, 3000);
  };

  const handleClose = () => {
    setMensaje('');
    setTipoMensaje('');
    setTelefono('');
    setTelefonoMostrado('');
    setTelefonoEditado('');
    setModoEdicion(false);
    onHide();
  };

  /* ===== VERSIÓN ANTERIOR: envío vía backend/Twilio (template aprobado) =====
     Reemplazada por el envío directo a wa.me. Descomentar (junto con los imports
     de axios/API_URL de arriba y el estado `enviando`) si se necesita volver a este flujo.

  const handleEnviar = async () => {
    const numeroParaEnviar = getNumeroParaEnviar();

    if (!numeroParaEnviar || numeroParaEnviar.trim() === '') {
      setMensaje('Por favor ingresa un número de teléfono');
      setTipoMensaje('danger');
      return;
    }

    setEnviando(true);
    setMensaje('');

    try {
      const token = localStorage.getItem("cober_token");

      await axios.post(
        `${API_URL}/prospectos/enviar-whatsapp`,
        {
          telefono: numeroParaEnviar,
          cotizacion,
          prospecto
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMensaje('¡Cotización enviada por WhatsApp exitosamente! 📱');
      setTipoMensaje('success');

      setTimeout(() => {
        setMensaje('✅ Cotización enviada correctamente. Para continuar la conversación con el cliente, dirígete a la sección de WhatsApp desde el menú lateral.');
        setTipoMensaje('info');
      }, 2000);

      setTimeout(() => {
        onHide();
        setMensaje('');
      }, 6000);

    } catch (error) {
      console.error('Error enviando cotización:', error);
      setMensaje(
        error.response?.data?.error ||
        'Error al enviar la cotización. Inténtalo nuevamente.'
      );
      setTipoMensaje('danger');
    } finally {
      setEnviando(false);
    }
  };

  ===== FIN VERSIÓN ANTERIOR ===== */

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaWhatsapp className="text-success me-2" />
          Enviar Cotización por WhatsApp
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {cotizacion && (
          <div className="mb-4">
            <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Resumen de la Cotización:</h6>
            <div className="bg-muted p-4 rounded-md">
              <p className="mb-4"><strong>Plan:</strong> {cotizacion.plan_nombre}</p>
              <p className="mb-4"><strong>Grupo Familiar:</strong> {
                cotizacion.detalles && cotizacion.detalles.length > 0 
                  ? cotizacion.detalles.map(d => d.vinculo).join(", ")
                  : "Individual"
              }</p>
              <p className="mb-4"><strong>Total Final:</strong> <span className="text-success font-bold">{formatCurrency(cotizacion.total_final)}</span></p>
            </div>
          </div>
        )}

        <Form>
          <Form.Group className="mb-4">
            <Form.Label>Número de WhatsApp:</Form.Label>
            <Form.Control
              type="tel"
              value={modoEdicion ? telefonoEditado : telefonoMostrado}
              onChange={handleTelefonoChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={modoEdicion ? "Ingresa un número de WhatsApp" : "Haz clic para ingresar número"}
            />
            <Form.Text className="text-muted-foreground">
              {modoEdicion 
                ? "Ingresa el número de WhatsApp donde enviar la cotización" 
                : "Número del prospecto enmascarado por seguridad. Haz clic para usar otro número."
              }
            </Form.Text>
          </Form.Group>
        </Form>

        {mensaje && (
          <Alert variant={tipoMensaje} className="mt-4">
            {mensaje}
          </Alert>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button
          variant="success"
          onClick={handleEnviar}
          disabled={(!modoEdicion && !telefono) || (modoEdicion && !telefonoEditado.trim())}
        >
          <FaWhatsapp className="me-2" />
          Enviar por WhatsApp
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EnviarCotizacionModal;