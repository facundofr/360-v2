/**
 * Modal para confirmar email del prospecto antes de enviar a firma
 */

import { Modal, Form, Button, Alert } from '@/components/compat/bootstrap';
import { FaEnvelope, FaCheck, FaTimes } from '@/lib/icons';
import { useState, useEffect } from 'react';

const ConfirmarDatosProspectoModal = ({
  show,
  poliza,
  onConfirmar,
  onCancelar,
  loading = false
}) => {
  const [email, setEmail] = useState('');
  const [tipoFirma, setTipoFirma] = useState('biometrica');
  const [validacionError, setValidacionError] = useState('');

  // Cargar datos iniciales cuando se abre el modal
  useEffect(() => {
    if (show && poliza) {
      setEmail(poliza.prospecto_email || '');
      setTipoFirma('biometrica');
      setValidacionError('');
    }
  }, [show, poliza]);

  // Validar email
  const validarEmail = (emailValue) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(emailValue);
  };

  // Teléfono eliminado: sólo email

  // Manejar confirmación
  const handleConfirmar = () => {
    setValidacionError('');

    // Validar email
    if (!email || !email.trim()) {
      setValidacionError('El email del prospecto es requerido');
      return;
    }

    if (!validarEmail(email)) {
      setValidacionError('El email no es válido');
      return;
    }

    // Pasar datos confirmados (email y tipo de firma elegido)
    onConfirmar(email, undefined, tipoFirma);
  };

  if (!poliza) return null;

  return (
    <Modal show={show} onHide={onCancelar} size="lg" centered backdrop="static">
      <Modal.Header closeButton={!loading}>
        <Modal.Title>
          <FaCheck className="text-info me-2" />
          Confirmar Datos del Prospecto
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Información de la póliza */}
        <div className="mb-6 p-4 bg-muted rounded-md">
          <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]">
            <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-6/12">
              <small className="text-[0.875em] text-muted-foreground block">Prospecto</small>
              <strong>
                {poliza.prospecto_nombre || 'Sin nombre'} {poliza.prospecto_apellido || ''}
              </strong>
            </div>
            <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-6/12 text-right">
              <small className="text-[0.875em] text-muted-foreground block">Póliza N°</small>
              <strong>{poliza.numero_poliza_oficial || poliza.numero_poliza}</strong>
            </div>
          </div>
        </div>

        {/* Alerta de validación */}
        {validacionError && (
          <Alert variant="danger" className="mb-4" dismissible onClose={() => setValidacionError('')}>
            <FaTimes className="me-2" />
            {validacionError}
          </Alert>
        )}

        {/* Datos para confirmar */}
        <div className="mb-6">
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">
            <FaEnvelope className="text-primary me-2" />
            Por favor confirma los datos de contacto:
          </h6>

          {/* Email */}
          <Form.Group className="mb-4">
            <Form.Label>
              <FaEnvelope className="me-2 text-primary" />
              Email del Prospecto
            </Form.Label>
            <Form.Control
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setValidacionError('');
              }}
              disabled={loading}
              isInvalid={validacionError && !validarEmail(email)}
            />
            <Form.Text className="text-muted-foreground">
              Este email recibirá el enlace para firmar la póliza
            </Form.Text>
          </Form.Group>

          {/* Teléfono eliminado: se enviará sólo por email */}

          {/* Tipo de firma */}
          <Form.Group className="mb-4">
            <Form.Label>Tipo de firma</Form.Label>
            <div className="flex flex-col gap-2">
              <Form.Check
                type="radio"
                id="tipo-firma-biometrica"
                name="tipoFirma"
                label="Firma biométrica (con validación facial y documento de identidad)"
                checked={tipoFirma === 'biometrica'}
                onChange={() => setTipoFirma('biometrica')}
                disabled={loading}
              />
              <Form.Check
                type="radio"
                id="tipo-firma-simple"
                name="tipoFirma"
                label="Firma simple (sin validación facial)"
                checked={tipoFirma === 'simple'}
                onChange={() => setTipoFirma('simple')}
                disabled={loading}
              />
            </div>
          </Form.Group>
        </div>

        {/* Información importante */}
        <div className="relative rounded-md border px-4 py-3 text-sm leading-relaxed border-primary/15 bg-accent/70 text-foreground mb-0">
          <strong>⚠️ Importante:</strong>
          {tipoFirma === 'biometrica' ? (
            <ul className="list-disc pl-8 mb-0 mt-2">
              <li>Se solicitará validación facial (foto del rostro)</li>
              <li>Se requiere un documento de identidad</li>
              <li>El prospecto recibirá instrucciones claras por email</li>
              <li>El proceso es seguro y rápido (~5 minutos)</li>
            </ul>
          ) : (
            <ul className="list-disc pl-8 mb-0 mt-2">
              <li>No se solicitará validación facial ni documento de identidad</li>
              <li>El prospecto recibirá instrucciones claras por email</li>
              <li>El proceso es más rápido, pero con menor nivel de verificación</li>
            </ul>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onCancelar}
          disabled={loading}
        >
          <FaTimes className="me-2" />
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmar}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2 me-2" role="status" aria-hidden="true"></span>
              Enviando...
            </>
          ) : (
            <>
              <FaCheck className="me-2" />
              Enviar a Firma
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmarDatosProspectoModal;
