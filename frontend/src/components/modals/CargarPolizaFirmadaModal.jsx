import { useState, useRef } from 'react';
import { Modal, Button, Form, Alert, Spinner, ProgressBar } from '@/components/compat/bootstrap';
import { FaFileUpload, FaCheck, FaExclamationTriangle } from '@/lib/icons';
import axios from 'axios';

const CargarPolizaFirmadaModal = ({ show, onHide, polizaId, numeroPoliza, onSuccess }) => {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState(''); // 'success', 'error', 'warning'
  const [archivoNombre, setArchivoNombre] = useState('');
  const fileInputRef = useRef(null);

  const handleArchivoSeleccionado = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setArchivo(null);
      setArchivoNombre('');
      return;
    }

    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      setMensaje('Solo se aceptan archivos PDF');
      setTipo('error');
      setArchivo(null);
      setArchivoNombre('');
      return;
    }

    // Validar tamaño máximo (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMensaje('El archivo no puede ser mayor a 10MB');
      setTipo('error');
      setArchivo(null);
      setArchivoNombre('');
      return;
    }

    setArchivo(file);
    setArchivoNombre(file.name);
    setMensaje('');
    setTipo('');
  };

  const handleCargar = async () => {
    if (!archivo) {
      setMensaje('Por favor selecciona un archivo PDF');
      setTipo('warning');
      return;
    }

    setCargando(true);
    setProgreso(0);
    setMensaje('');
    setTipo('');

    try {
      const formData = new FormData();
      formData.append('poliza_id', polizaId);
      formData.append('poliza_firmada', archivo);

      const response = await axios.post(
        '/api/polizas/documentos/firmada/cargar',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgreso(percent);
          }
        }
      );

      if (response.data.success) {
        setMensaje(`✅ Póliza firmada cargada exitosamente. Google Sheets actualizado automáticamente.`);
        setTipo('success');
        setArchivo(null);
        setArchivoNombre('');
        setProgreso(0);

        // Limpiar después de 2 segundos
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(response.data);
          }
          onHide();
        }, 2000);
      } else {
        setMensaje(response.data.message || 'Error al cargar la póliza');
        setTipo('error');
      }
    } catch (error) {
      console.error('Error cargando póliza:', error);
      const mensajeError = error.response?.data?.message || error.message;
      setMensaje(`❌ Error: ${mensajeError}`);
      setTipo('error');
    } finally {
      setCargando(false);
    }
  };

  const handleReset = () => {
    setArchivo(null);
    setArchivoNombre('');
    setMensaje('');
    setTipo('');
    setProgreso(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCerrar = () => {
    handleReset();
    onHide();
  };

  return (
    <Modal show={show} onHide={handleCerrar} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaFileUpload className="me-2" />
          Cargar Póliza Firmada
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {tipo && (
          <Alert variant={tipo} className="mb-4">
            {mensaje}
          </Alert>
        )}

        <div className="mb-6">
          <p className="text-muted-foreground mb-4">
            <strong>Póliza:</strong> {numeroPoliza || `ID ${polizaId}`}
          </p>
          <p className="mb-4 text-muted-foreground text-[0.875em]">
            Sube la póliza firmada en formato PDF. El sistema actualizará automáticamente Google Sheets con el enlace de descarga.
          </p>
        </div>

        <Form>
          <Form.Group className="mb-6">
            <Form.Label className="font-semibold mb-4">
              <FaFileUpload className="me-2" />
              Seleccionar Archivo PDF
            </Form.Label>

            {!archivoNombre ? (
              <div
                className="border-2 border-dashed p-6 text-center rounded-md"
                style={{
                  borderColor: '#ccc',
                  backgroundColor: '#f9f9f9',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.backgroundColor = '#e9e9e9';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    const event = {
                      target: { files }
                    };
                    handleArchivoSeleccionado(event);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FaFileUpload size={32} className="mb-2 text-primary" />
                <p className="mb-1">
                  <strong>Haz clic o arrastra el archivo</strong>
                </p>
                <small className="text-[0.875em] text-muted-foreground">
                  Solo archivos PDF (máximo 10MB)
                </small>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-md border border-success">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <FaCheck className="me-2 text-success" />
                    <strong>{archivoNombre}</strong>
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleReset}
                    disabled={cargando}
                  >
                    Cambiar
                  </Button>
                </div>

                {cargando && progreso > 0 && (
                  <div className="mb-4">
                    <small className="text-[0.875em] text-muted-foreground block mb-2">
                      Cargando: {progreso}%
                    </small>
                    <ProgressBar
                      now={progreso}
                      label={`${progreso}%`}
                      className="bg-primary"
                    />
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleArchivoSeleccionado}
              style={{ display: 'none' }}
            />
          </Form.Group>

          {archivoNombre && (
            <div className="relative rounded-md border px-4 py-3 border-primary/15 bg-accent/70 text-foreground text-[0.875em]">
              <strong>📋 Información:</strong>
              <ul className="list-disc pl-8 mb-0 mt-2">
                <li>Se creará un enlace público para descargar la póliza</li>
                <li>Google Sheets será actualizado automáticamente</li>
                <li>El enlace estará disponible en la columna "Póliza Completa"</li>
              </ul>
            </div>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="outline-secondary"
          onClick={handleCerrar}
          disabled={cargando}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleCargar}
          disabled={!archivoNombre || cargando}
        >
          {cargando ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-2"
              />
              Cargando...
            </>
          ) : (
            <>
              <FaFileUpload className="me-2" />
              Cargar Póliza Firmada
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CargarPolizaFirmadaModal;
