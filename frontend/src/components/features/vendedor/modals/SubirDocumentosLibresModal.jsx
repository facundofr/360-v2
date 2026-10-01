import React, { useState, useRef } from 'react';
import { Modal, Button, Form, Alert, Spinner, Badge, ProgressBar } from '@/components/compat/bootstrap';
import { FaUpload, FaPlus, FaTrash, FaFileAlt, FaCheckCircle } from '@/lib/icons';
import axios from 'axios';
import Swal from '@/lib/alerts';
import { API_URL } from '../../../config';

/**
 * Modal para subir documentos libres con título personalizable.
 * El usuario puede agregar múltiples archivos y editar el título de cada uno
 * antes de subirlos a la póliza.
 *
 * Funciona para vendedor, supervisor y backoffice mediante `apiContext`.
 */
const SubirDocumentosLibresModal = ({
  show,
  onHide,
  poliza,
  apiContext = 'vendedor', // 'vendedor' | 'supervisor' | 'backoffice'
  onDocumentosActualizados
}) => {
  const [items, setItems] = useState([{ id: 1, file: null, titulo: '' }]);
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [progresoMensaje, setProgresoMensaje] = useState('');
  const fileInputRefs = useRef({});
  const nextId = useRef(2);

  // Determinar endpoint según rol
  const getEndpointBase = () => {
    if (apiContext === 'supervisor' || apiContext === 'backoffice') {
      return `${API_URL}/supervisor/polizas`;
    }
    return `${API_URL}/vendedor/polizas`;
  };

  // Limpiar estado al cerrar
  const handleClose = () => {
    if (loading) return;
    setItems([{ id: 1, file: null, titulo: '' }]);
    setProgreso(0);
    setProgresoMensaje('');
    nextId.current = 2;
    onHide();
  };

  // Agregar nueva fila
  const agregarItem = () => {
    if (items.length >= 10) {
      Swal.fire('Límite alcanzado', 'Podés subir hasta 10 documentos por vez.', 'warning');
      return;
    }
    const id = nextId.current++;
    setItems(prev => [...prev, { id, file: null, titulo: '' }]);
  };

  // Eliminar fila
  const eliminarItem = (id) => {
    if (items.length === 1) return; // Mínimo 1 fila
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Cambiar archivo de una fila
  const handleFileChange = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire('Archivo demasiado grande', 'El tamaño máximo permitido es 10MB.', 'error');
      e.target.value = '';
      return;
    }

    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!tiposPermitidos.includes(file.type)) {
      Swal.fire('Formato no permitido', 'Solo se permiten archivos JPG, PNG, PDF, DOC y DOCX.', 'error');
      e.target.value = '';
      return;
    }

    // Autocompletar título con el nombre del archivo (sin extensión) si está vacío
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const tituloSugerido = item.titulo.trim()
        ? item.titulo
        : file.name.replace(/\.[^.]+$/, '');
      return { ...item, file, titulo: tituloSugerido };
    }));
  };

  // Cambiar título de una fila
  const handleTituloChange = (id, valor) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, titulo: valor } : item
    ));
  };

  // Validar antes de subir
  const validar = () => {
    const itemsConArchivo = items.filter(i => i.file);
    if (itemsConArchivo.length === 0) {
      Swal.fire('Sin archivos', 'Seleccioná al menos un archivo para subir.', 'warning');
      return false;
    }
    for (const item of itemsConArchivo) {
      if (!item.titulo.trim()) {
        Swal.fire('Título requerido', 'Todos los archivos deben tener un título para identificarlos.', 'warning');
        return false;
      }
      if (item.titulo.trim().length > 100) {
        Swal.fire('Título muy largo', 'El título no puede superar los 100 caracteres.', 'warning');
        return false;
      }
    }
    return true;
  };

  // Subir documentos uno a uno
  const handleSubir = async () => {
    if (!validar()) return;

    const itemsConArchivo = items.filter(i => i.file);
    setLoading(true);
    setProgreso(0);
    setProgresoMensaje('Preparando archivos...');

    const token = localStorage.getItem('cober_token');
    const baseUrl = getEndpointBase();
    const errores = [];
    let subidos = 0;

    for (let i = 0; i < itemsConArchivo.length; i++) {
      const item = itemsConArchivo[i];
      setProgresoMensaje(`Subiendo "${item.titulo}" (${i + 1}/${itemsConArchivo.length})...`);

      try {
        const fd = new FormData();
        fd.append('documentos', item.file);
        // Siempre usar documento_adicional como tipo (respeta el ENUM de la BD)
        fd.append('tipos_documento', JSON.stringify(['documento_adicional']));
        // El título personalizado se guarda en observaciones
        fd.append('observaciones', item.titulo.trim());

        await axios.post(
          `${baseUrl}/${poliza.id}/documentos/multiple`,
          fd,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        subidos++;
        setProgreso(Math.round(((i + 1) / itemsConArchivo.length) * 100));
      } catch (err) {
        console.error(`Error subiendo "${item.titulo}":`, err);
        errores.push(`"${item.titulo}": ${err.response?.data?.message || err.message}`);
      }
    }

    setLoading(false);

    if (errores.length > 0 && subidos === 0) {
      Swal.fire({
        title: 'Error al subir',
        html: errores.map(e => `<div class="text-start small">• ${e}</div>`).join(''),
        icon: 'error'
      });
      return;
    }

    if (subidos > 0) {
      await Swal.fire({
        title: '¡Documentos subidos!',
        html: `
          <p><strong>${subidos}</strong> documento${subidos !== 1 ? 's' : ''} subido${subidos !== 1 ? 's' : ''} correctamente.</p>
          ${errores.length > 0 ? `<div class="text-danger small mt-2">${errores.length} con error:<br/>${errores.map(e => `• ${e}`).join('<br/>')}</div>` : ''}
        `,
        icon: errores.length > 0 ? 'warning' : 'success',
        confirmButtonColor: '#28a745'
      });

      if (onDocumentosActualizados) {
        onDocumentosActualizados();
      }
      handleClose();
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const itemsConArchivo = items.filter(i => i.file).length;
  const todosConTitulo = items.filter(i => i.file).every(i => i.titulo.trim());

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
      centered
      backdrop={loading ? 'static' : true}
    >
      <Modal.Header closeButton={!loading}>
        <Modal.Title>
          <FaUpload className="me-2 text-primary" />
          Agregar Documentos
          {poliza && (
            <Badge bg="secondary" className="ms-2 text-base">
              Póliza #{poliza.numero_poliza_oficial || poliza.numero_poliza}
            </Badge>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Alert variant="light" className="border mb-4 py-2">
          <small className="text-[0.875em]">
            <strong>📋 Instrucciones:</strong> Seleccioná cada archivo y editá el título para identificarlo fácilmente.
            Formatos permitidos: JPG, PNG, PDF, DOC, DOCX. Máximo 10MB por archivo.
          </small>
        </Alert>

        {/* Lista de documentos */}
        <div className="flex flex-col gap-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="border rounded-md p-4"
              style={{ backgroundColor: item.file ? '#f8fff8' : '#fff' }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-muted-foreground text-[0.875em]">Documento {index + 1}</span>
                {items.length > 1 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-destructive p-0"
                    onClick={() => eliminarItem(item.id)}
                    disabled={loading}
                    title="Eliminar esta fila"
                  >
                    <FaTrash />
                  </Button>
                )}
              </div>

              <Form.Group className="mb-2">
                <Form.Label className="text-[0.875em] font-semibold mb-1">
                  Título / Nombre del documento <span className="text-destructive">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Ej: Análisis de sangre, Certificado médico, DNI cónyuge..."
                  value={item.titulo}
                  onChange={(e) => handleTituloChange(item.id, e.target.value)}
                  maxLength={100}
                  disabled={loading}
                  isInvalid={item.file && !item.titulo.trim()}
                />
                {item.titulo.trim() && (
                  <Form.Text className="text-muted-foreground">
                    {100 - item.titulo.length} caracteres restantes
                  </Form.Text>
                )}
                <Form.Control.Feedback type="invalid">
                  El título es obligatorio.
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold mb-1">
                  Archivo <span className="text-destructive">*</span>
                </Form.Label>
                {item.file ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-card">
                    <FaFileAlt className="text-success shrink-0" />
                    <div className="grow overflow-hidden">
                      <div className="truncate text-[0.875em] font-semibold">{item.file.name}</div>
                      <div className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {formatBytes(item.file.size)}
                      </div>
                    </div>
                    <FaCheckCircle className="text-success shrink-0" />
                    <Button
                      variant="link"
                      size="sm"
                      className="text-teal p-0"
                      onClick={() => {
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, file: null } : i));
                        if (fileInputRefs.current[item.id]) {
                          fileInputRefs.current[item.id].value = '';
                        }
                      }}
                      disabled={loading}
                      title="Cambiar archivo"
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <Form.Control
                    ref={(el) => { fileInputRefs.current[item.id] = el; }}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    onChange={(e) => handleFileChange(item.id, e)}
                    disabled={loading}
                  />
                )}
              </Form.Group>
            </div>
          ))}
        </div>

        {/* Botón agregar fila */}
        <div className="mt-4">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={agregarItem}
            disabled={loading || items.length >= 10}
            className="flex items-center"
          >
            <FaPlus className="me-1" />
            Agregar otro documento
          </Button>
          {items.length >= 10 && (
            <Form.Text className="text-muted-foreground ms-2">Máximo 10 por vez</Form.Text>
          )}
        </div>

        {/* Barra de progreso durante la subida */}
        {loading && (
          <div className="mt-6">
            <div className="flex justify-between mb-1">
              <small className="text-[0.875em] font-semibold">{progresoMensaje}</small>
              <small className="text-[0.875em]">{progreso}%</small>
            </div>
            <ProgressBar now={progreso} animated variant="primary" style={{ height: '8px' }} />
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="flex justify-between">
        <div>
          {itemsConArchivo > 0 && (
            <Badge bg={todosConTitulo ? 'success' : 'warning'} text={todosConTitulo ? undefined : 'dark'}>
              {itemsConArchivo} archivo{itemsConArchivo !== 1 ? 's' : ''} seleccionado{itemsConArchivo !== 1 ? 's' : ''}
              {!todosConTitulo && ' · Faltan títulos'}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubir}
            disabled={loading || itemsConArchivo === 0 || !todosConTitulo}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                Subiendo...
              </>
            ) : (
              <>
                <FaUpload className="me-1" />
                Subir {itemsConArchivo > 0 ? `${itemsConArchivo} documento${itemsConArchivo !== 1 ? 's' : ''}` : 'documentos'}
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default SubirDocumentosLibresModal;
