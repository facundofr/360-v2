import React, { useState, useEffect } from 'react';
import { Button, Form, Alert, Card, Badge, ProgressBar, Modal, Row, Col } from '@/components/compat/bootstrap';
import { Upload, FileText, AlertCircle, CheckCircle, Eye, Download, X, Plus } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Componente para cargar documentos adicionales con segmentación por tipo
 * Compatible con supervisores y vendedores
 */
const CargaDocumentosModal = ({ polizaId, userRole = 'supervisor', onDocumentosActualizados, show, onHide }) => {
  const [documentosExistentes, setDocumentosExistentes] = useState({});
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // ✅ Estado para archivos por tipo de documento
  const [archivosPorTipo, setArchivosPorTipo] = useState({
    codem: [],
    formulario_f152: [],
    formulario_f184: [],
    constancia_inscripcion: [],
    comprobante_pago_cuota: [],
    estudios_medicos: []
  });

  // ✅ Configuración de tipos de documentos con límites
  const TIPOS_DOCUMENTOS = [
    { 
      key: 'codem', 
      label: 'CODEM', 
      icon: '📋', 
      maxFiles: 1, 
      description: 'Certificado de Discapacidad y/o Enfermedad Médica',
      color: '#6f42c1'
    },
    { 
      key: 'formulario_f152', 
      label: 'Formulario F152', 
      icon: '📝', 
      maxFiles: 1, 
      description: 'Formulario de solicitud de afiliación',
      color: '#0d6efd'
    },
    { 
      key: 'formulario_f184', 
      label: 'Formulario F184', 
      icon: '📋', 
      maxFiles: 1, 
      description: 'Formulario de opción de cambio',
      color: '#198754'
    },
    { 
      key: 'constancia_inscripcion', 
      label: 'Constancia de Inscripción', 
      icon: '✅', 
      maxFiles: 1, 
      description: 'Constancia de inscripción en AFIP',
      color: '#20c997'
    },
    { 
      key: 'comprobante_pago_cuota', 
      label: 'Comprobantes de Pago', 
      icon: '💳', 
      maxFiles: 12, 
      description: 'Comprobantes de pago de cuotas (máx. 12)',
      color: '#fd7e14'
    },
    { 
      key: 'estudios_medicos', 
      label: 'Estudios Médicos', 
      icon: '🏥', 
      maxFiles: 20, 
      description: 'Estudios, análisis y/o informes médicos (máx. 20)',
      color: '#dc3545'
    }
  ];

  // Cargar datos iniciales
  useEffect(() => {
    if (show && polizaId) {
      cargarDatos();
      // Limpiar archivos al abrir
      setArchivosPorTipo({
        codem: [],
        formulario_f152: [],
        formulario_f184: [],
        constancia_inscripcion: [],
        comprobante_pago_cuota: [],
        estudios_medicos: []
      });
      setError('');
      setSuccess('');
    }
  }, [show, polizaId]);

  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const estadisticasEndpoint = userRole === 'vendedor'
        ? `${API_URL}/vendedor/polizas/${polizaId}/documentos/estadisticas`
        : `${API_URL}/supervisor/polizas/${polizaId}/documentos/estadisticas`;
        
      const documentosEndpoint = userRole === 'vendedor'
        ? `${API_URL}/vendedor/polizas/${polizaId}/documentos`
        : `${API_URL}/supervisor/polizas/${polizaId}/documentos`;

      const [estadisticasRes, documentosRes] = await Promise.all([
        axios.get(estadisticasEndpoint, { headers }).catch(() => ({ data: { data: {} } })),
        axios.get(documentosEndpoint, { headers }).catch(() => ({ data: { documentos: {} } }))
      ]);

      setEstadisticas(estadisticasRes.data.data || {});
      setDocumentosExistentes(documentosRes.data.documentos || {});
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error cargando información de documentos');
    }
  };

  // ✅ Manejar selección de archivo por tipo específico
  const handleFileSelect = (tipo, e) => {
    const files = Array.from(e.target.files);
    const tipoConfig = TIPOS_DOCUMENTOS.find(t => t.key === tipo);
    
    if (!tipoConfig) return;

    // Verificar límite de archivos
    const existentes = documentosExistentes[tipo]?.length || 0;
    const pendientes = archivosPorTipo[tipo]?.length || 0;
    const disponibles = tipoConfig.maxFiles - existentes - pendientes;

    if (files.length > disponibles) {
      setError(`Solo puede agregar ${disponibles} archivo(s) más para ${tipoConfig.label}`);
      return;
    }

    // Verificar tamaño
    const archivosGrandes = files.filter(file => file.size > 10 * 1024 * 1024);
    if (archivosGrandes.length > 0) {
      setError('Algunos archivos son mayores a 10MB');
      return;
    }

    // Verificar tipos de archivo
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const archivosInvalidos = files.filter(file => !tiposPermitidos.includes(file.type));
    
    if (archivosInvalidos.length > 0) {
      setError('Solo se permiten archivos JPG, PNG, PDF, DOC y DOCX');
      return;
    }

    setError('');
    setArchivosPorTipo(prev => ({
      ...prev,
      [tipo]: [...prev[tipo], ...files.map(file => ({
        archivo: file,
        nombre: file.name,
        tamaño: file.size
      }))]
    }));

    // Limpiar input
    e.target.value = '';
  };

  // ✅ Eliminar archivo pendiente
  const eliminarArchivoPendiente = (tipo, index) => {
    setArchivosPorTipo(prev => ({
      ...prev,
      [tipo]: prev[tipo].filter((_, i) => i !== index)
    }));
  };

  // ✅ Contar total de archivos a subir
  const getTotalArchivos = () => {
    return Object.values(archivosPorTipo).reduce((acc, arr) => acc + arr.length, 0);
  };

  // ✅ Subir todos los documentos
  const subirDocumentos = async () => {
    const totalArchivos = getTotalArchivos();
    if (totalArchivos === 0) {
      setError('Seleccione al menos un archivo');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('cober_token');
      let archivosSubidos = 0;
      let errores = [];

      // Subir archivos por tipo
      for (const [tipo, archivos] of Object.entries(archivosPorTipo)) {
        for (const item of archivos) {
          try {
            const formData = new FormData();
            formData.append('documentos', item.archivo);
            formData.append('tipos_documento', JSON.stringify([tipo]));

            const uploadEndpoint = userRole === 'vendedor'
              ? `${API_URL}/vendedor/polizas/${polizaId}/documentos/multiple`
              : `${API_URL}/supervisor/polizas/${polizaId}/documentos/multiple`;

            await axios.post(uploadEndpoint, formData, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            });

            archivosSubidos++;
            setUploadProgress(Math.round((archivosSubidos / totalArchivos) * 100));
          } catch (err) {
            errores.push(`Error subiendo ${item.nombre}: ${err.response?.data?.message || err.message}`);
          }
        }
      }

      if (errores.length > 0) {
        setError(errores.join('\n'));
      }

      if (archivosSubidos > 0) {
        setSuccess(`✅ ${archivosSubidos} documento(s) cargado(s) exitosamente`);
        
        // Limpiar archivos pendientes
        setArchivosPorTipo({
          codem: [],
          formulario_f152: [],
          formulario_f184: [],
          constancia_inscripcion: [],
          comprobante_pago_cuota: [],
          estudios_medicos: []
        });
        
        // Actualizar datos
        await cargarDatos();
        
        // Notificar al componente padre
        if (onDocumentosActualizados) {
          onDocumentosActualizados();
        }

        // Cerrar modal después de 2 segundos si no hay errores
        if (errores.length === 0) {
          setTimeout(() => {
            setSuccess('');
            onHide();
          }, 2000);
        }
      }

    } catch (error) {
      console.error('Error subiendo documentos:', error);
      setError(error.response?.data?.message || 'Error subiendo documentos. Intente nuevamente.');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formatearTamaño = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const previewDocumento = async (documentoId, tipoMime) => {
    try {
      const token = localStorage.getItem('cober_token');
      const previewEndpoint = userRole === 'vendedor'
        ? `${API_URL}/vendedor/polizas/documentos/${documentoId}/preview`
        : `${API_URL}/supervisor/polizas/documentos/${documentoId}/preview`;

      const response = await axios.get(previewEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: tipoMime }));
      setPreviewUrl(url);
      setPreviewMime(tipoMime);
      setShowPreview(true);
    } catch (err) {
      console.error('Error en preview:', err);
      alert('No se pudo previsualizar el documento');
    }
  };

  // ✅ Renderizar sección de tipo de documento
  const renderSeccionTipo = (tipoConfig) => {
    const { key, label, icon, maxFiles, description, color } = tipoConfig;
    const existentes = documentosExistentes[key] || [];
    const pendientes = archivosPorTipo[key] || [];
    const disponibles = maxFiles - existentes.length - pendientes.length;
    const puedeAgregar = disponibles > 0;

    return (
      <Card key={key} className="mb-4" style={{ borderLeft: `4px solid ${color}` }}>
        <Card.Header className="flex justify-between items-center py-2" style={{ backgroundColor: `${color}10` }}>
          <div className="flex items-center">
            <span className="me-2" style={{ fontSize: '1.5rem' }}>{icon}</span>
            <div>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0" style={{ color }}>{label}</h6>
              <small className="text-[0.875em] text-muted-foreground">{description}</small>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge bg={existentes.length > 0 ? 'success' : 'secondary'}>
              {existentes.length} cargado{existentes.length !== 1 ? 's' : ''}
            </Badge>
            {pendientes.length > 0 && (
              <Badge bg="warning" text="dark">
                {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
              </Badge>
            )}
            <Badge bg={puedeAgregar ? 'info' : 'danger'}>
              {disponibles} disponible{disponibles !== 1 ? 's' : ''}
            </Badge>
          </div>
        </Card.Header>
        
        <Card.Body className="py-2">
          {/* Documentos existentes */}
          {existentes.length > 0 && (
            <div className="mb-2">
              <small className="text-[0.875em] text-muted-foreground font-bold">Documentos cargados:</small>
              {existentes.map(doc => (
                <div key={doc.id} className="flex justify-between items-center py-1 border-b">
                  <div className="flex items-center">
                    <FileText size={16} className="me-2 text-success" />
                    <span className="text-[0.875em]">{doc.nombre_original}</span>
                    <small className="text-[0.875em] text-muted-foreground ms-2">({formatearTamaño(doc.tamaño_bytes)})</small>
                  </div>
                  <div>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 me-2"
                      onClick={() => previewDocumento(doc.id, doc.tipo_mime)}
                      title="Ver documento"
                    >
                      <Eye size={16} className="text-primary" />
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0"
                      onClick={() => {
                        if (doc.urls?.download) {
                          window.open(doc.urls.download, '_blank');
                        }
                      }}
                      title="Descargar"
                    >
                      <Download size={16} className="text-teal" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Archivos pendientes de subir */}
          {pendientes.length > 0 && (
            <div className="mb-2">
              <small className="text-[0.875em] text-warning font-bold">Pendientes de subir:</small>
              {pendientes.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-1 border-b bg-warning/10">
                  <div className="flex items-center">
                    <FileText size={16} className="me-2 text-warning" />
                    <span className="text-[0.875em]">{item.nombre}</span>
                    <small className="text-[0.875em] text-muted-foreground ms-2">({formatearTamaño(item.tamaño)})</small>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-destructive"
                    onClick={() => eliminarArchivoPendiente(key, index)}
                    title="Quitar"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Botón para agregar archivo */}
          {puedeAgregar && (
            <div className="mt-2">
              <Form.Group>
                <Form.Label 
                  htmlFor={`file-${key}`}
                  className="cursor-pointer justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground min-h-9 px-3 py-1 text-sm inline-flex items-center"
                  style={{ cursor: 'pointer' }}
                >
                  <Plus size={16} className="me-1" />
                  Agregar {maxFiles > 1 ? 'archivo(s)' : 'archivo'}
                </Form.Label>
                <Form.Control
                  type="file"
                  id={`file-${key}`}
                  multiple={maxFiles > 1}
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                  onChange={(e) => handleFileSelect(key, e)}
                  className="hidden"
                  disabled={loading}
                />
              </Form.Group>
            </div>
          )}

          {!puedeAgregar && existentes.length === 0 && pendientes.length === 0 && (
            <div className="text-center py-2">
              <small className="text-[0.875em] text-muted-foreground">Sin documentos</small>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" centered scrollable>
        <Modal.Header closeButton style={{ backgroundColor: '#f8f9fa' }}>
          <Modal.Title>
            📎 Cargar Documentos Adicionales
            {estadisticas?.numero_poliza && (
              <Badge bg="primary" className="ms-2">Póliza #{estadisticas.numero_poliza}</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Estadísticas resumidas */}
          {estadisticas && (
            <Alert variant="info" className="mb-4 py-2">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span>
                  <strong>📊 Total documentos:</strong> {estadisticas.total_documentos || 0}
                </span>
                <span>
                  <strong>💾 Tamaño total:</strong> {estadisticas.tamaño_total_mb || 0} MB
                </span>
                <span>
                  <strong>📤 Pendientes:</strong> {getTotalArchivos()}
                </span>
              </div>
            </Alert>
          )}

          {/* Mensajes de error/éxito */}
          {error && (
            <Alert variant="danger" className="mb-4" dismissible onClose={() => setError('')}>
              <AlertCircle size={16} className="me-2" />
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="mb-4">
              <CheckCircle size={16} className="me-2" />
              {success}
            </Alert>
          )}

          {/* Progreso de subida */}
          {loading && uploadProgress > 0 && (
            <Card className="mb-4 border-primary">
              <Card.Body className="py-2">
                <div className="flex justify-between mb-1">
                  <small className="text-[0.875em] font-bold">Subiendo documentos...</small>
                  <small className="text-[0.875em]">{uploadProgress}%</small>
                </div>
                <ProgressBar now={uploadProgress} animated variant="primary" />
              </Card.Body>
            </Card>
          )}

          {/* Instrucciones */}
          <Alert variant="light" className="mb-4 border">
            <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2">📋 Instrucciones:</h6>
            <ul className="list-disc pl-8 mb-0 text-[0.875em]">
              <li>Seleccione los archivos para cada tipo de documento</li>
              <li>Formatos permitidos: JPG, PNG, PDF, DOC, DOCX</li>
              <li>Tamaño máximo por archivo: 10MB</li>
              <li>Los documentos se subirán todos juntos al presionar "Cargar"</li>
            </ul>
          </Alert>

          {/* Botón de carga en la parte superior */}
          {getTotalArchivos() > 0 && (
            <div className="flex justify-between items-center mb-4 p-4 bg-success/10 rounded-md border border-success">
              <Badge bg="warning" text="dark" className="text-base">
                {getTotalArchivos()} archivo(s) pendiente(s) de subir
              </Badge>
              <Button 
                variant="success" 
                onClick={subirDocumentos}
                disabled={loading}
                className="flex items-center"
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2 me-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="me-2" />
                    Cargar {getTotalArchivos()} Documento{getTotalArchivos() !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Secciones por tipo de documento */}
          <Row>
            <Col md={6}>
              {TIPOS_DOCUMENTOS.slice(0, 3).map(tipo => renderSeccionTipo(tipo))}
            </Col>
            <Col md={6}>
              {TIPOS_DOCUMENTOS.slice(3, 6).map(tipo => renderSeccionTipo(tipo))}
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="flex justify-between" style={{ backgroundColor: '#f8f9fa' }}>
          <div>
            {getTotalArchivos() > 0 && (
              <Badge bg="warning" text="dark" className="text-base">
                {getTotalArchivos()} archivo(s) pendiente(s) de subir
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onHide} disabled={loading}>
              Cerrar
            </Button>
            <Button 
              variant="primary" 
              onClick={subirDocumentos}
              disabled={loading || getTotalArchivos() === 0}
              className="flex items-center"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2 me-2" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload size={16} className="me-2" />
                  Cargar {getTotalArchivos()} Documento{getTotalArchivos() !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Modal de preview */}
      <Modal show={showPreview} onHide={() => {
        setShowPreview(false);
        if (previewUrl) {
          window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Vista Previa</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ height: '60vh', overflow: 'auto' }}>
          {previewMime?.startsWith('image/') ? (
            <img src={previewUrl} style={{ width: '100%' }} alt="Preview" />
          ) : previewMime === 'application/pdf' ? (
            <iframe src={previewUrl} style={{ width: '100%', height: '100%' }} title="PDF Preview" />
          ) : (
            <div className="text-center py-6">
              <p className="mb-4">Formato no soportado para previsualización</p>
              <Button onClick={() => window.open(previewUrl, '_blank')}>Descargar</Button>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CargaDocumentosModal;
