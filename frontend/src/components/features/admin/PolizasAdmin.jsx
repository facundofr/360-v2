import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Form, Modal, Spinner, Alert, ButtonGroup } from '@/components/compat/bootstrap';
import { FaEye, FaDownload, FaTrash, FaFile, FaTimes, FaInfoCircle, FaSearch, FaFileAlt, FaUsers } from '@/lib/icons';
import axios from 'axios';
import Swal from '@/lib/alerts';
import { API_URL } from "../../config";
import DocumentPreviewModal from '../../common/DocumentPreviewModal';

const PolizasAdmin = () => {
  const [polizas, setPolizas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);
  const [filtros, setFiltros] = useState({
    estado: 'todos',
    vendedor_id: 'todos',
    supervisor_id: 'todos',
    plan: 'todos',
    desde: '',
    hasta: '',
    buscar: '',
    incluir_eliminadas: false
  });
  const [opcionesFiltro, setOpcionesFiltro] = useState({
    vendedores: [],
    supervisores: [],
    planes: [],
    estados: []
  });
  const [paginacion, setPaginacion] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });

  // ✅ NUEVOS ESTADOS PARA DOCUMENTOS
  const [modalDocumentos, setModalDocumentos] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState(null);
  const [documentosData, setDocumentosData] = useState({});
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [estadisticasDocumentos, setEstadisticasDocumentos] = useState(null);

  // ✅ CARGAR DATOS INICIALES
  useEffect(() => {
    fetchPolizas();
    fetchEstadisticasAvanzadas();
    fetchFiltrosAvanzados();
    fetchEstadisticasDocumentos();
  }, [filtros, paginacion.current_page]);

  const fetchPolizas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      const params = new URLSearchParams({
        page: paginacion.current_page,
        limit: paginacion.per_page,
        ...filtros
      });

      const { data } = await axios.get(
        `${API_URL}/admin/polizas?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPolizas(data.data);
      setPaginacion(prev => ({
        ...prev,
        ...data.pagination
      }));

    } catch (error) {
      console.error("Error cargando pólizas:", error);
      Swal.fire("Error", "No se pudieron cargar las pólizas", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticasAvanzadas = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/admin/polizas/estadisticas`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEstadisticas(data.data);
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  };

  const fetchFiltrosAvanzados = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/admin/polizas/filtros`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOpcionesFiltro(data.data);
    } catch (error) {
      console.error("Error cargando filtros:", error);
    }
  };

  // ✅ NUEVA FUNCIÓN: Estadísticas de documentos
  const fetchEstadisticasDocumentos = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/admin/documentos/estadisticas`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEstadisticasDocumentos(data.data);
    } catch (error) {
      console.error("Error cargando estadísticas de documentos:", error);
    }
  };

  // ✅ NUEVA FUNCIÓN: Ver documentos de póliza
  const handleVerDocumentos = async (poliza) => {
    try {
      setLoadingDocumentos(true);
      setPolizaSeleccionada(poliza);
      setModalDocumentos(true);
      
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/admin/polizas/${poliza.id}/documentos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setDocumentosData(data);
    } catch (error) {
      console.error("Error cargando documentos:", error);
      Swal.fire("Error", "No se pudieron cargar los documentos", "error");
    } finally {
      setLoadingDocumentos(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Descargar documento
  const handleDescargarDocumento = async (documentoId, nombreOriginal) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/admin/documentos/${documentoId}/download`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nombreOriginal);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error descargando documento:", error);
      Swal.fire("Error", "No se pudo descargar el documento", "error");
    }
  };

  // ✅ NUEVA FUNCIÓN: Preview de documento
  const handlePreviewDocumento = async (documentoId, tipoMime) => {
    try {
      if (tipoMime.startsWith("image/") || tipoMime === "application/pdf") {
        const token = localStorage.getItem("cober_token");
        const response = await axios.get(
          `${API_URL}/admin/documentos/${documentoId}/preview`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        setPreviewUrl(url);
        setPreviewMime(tipoMime);
        setShowPreview(true);
      } else {
        Swal.fire("Info", "Este tipo de archivo no se puede previsualizar", "info");
      }
    } catch (error) {
      console.error("Error previsualizando documento:", error);
      Swal.fire("Error", "No se pudo previsualizar el documento", "error");
    }
  };

  // ✅ NUEVA FUNCIÓN: Eliminar documento
  const handleEliminarDocumento = async (documentoId, nombreDocumento) => {
    const { value: motivo } = await Swal.fire({
      title: '¿Eliminar documento?',
      text: `Se eliminará permanentemente: ${nombreDocumento}`,
      input: 'textarea',
      inputLabel: 'Motivo de eliminación',
      inputPlaceholder: 'Especifica por qué eliminas este documento...',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes especificar un motivo';
        }
      }
    });

    if (motivo) {
      try {
        const token = localStorage.getItem("cober_token");
        await axios.delete(
          `${API_URL}/admin/documentos/${documentoId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: { motivo_eliminacion: motivo }
          }
        );

        Swal.fire('¡Eliminado!', 'El documento ha sido eliminado correctamente.', 'success');
        
        // Recargar documentos de la póliza
        if (polizaSeleccionada) {
          handleVerDocumentos(polizaSeleccionada);
        }
      } catch (error) {
        console.error('Error eliminando documento:', error);
        Swal.fire('Error', 'No se pudo eliminar el documento', 'error');
      }
    }
  };

  // ✅ FUNCIONES EXISTENTES DE ADMIN
  const eliminarPoliza = async (polizaId) => {
    const { value: motivo } = await Swal.fire({
      title: '¿Eliminar póliza?',
      input: 'textarea',
      inputLabel: 'Motivo de eliminación',
      inputPlaceholder: 'Describe por qué eliminas esta póliza...',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes especificar un motivo';
        }
      }
    });

    if (motivo) {
      try {
        const token = localStorage.getItem("cober_token");
        await axios.delete(
          `${API_URL}/admin/polizas/${polizaId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: { motivo_eliminacion: motivo }
          }
        );

        Swal.fire('¡Eliminada!', 'La póliza ha sido eliminada correctamente.', 'success');
        fetchPolizas();
      } catch (error) {
        Swal.fire('Error', 'No se pudo eliminar la póliza', 'error');
      }
    }
  };

  const restaurarPoliza = async (polizaId) => {
    try {
      const token = localStorage.getItem("cober_token");
      await axios.patch(
        `${API_URL}/admin/polizas/${polizaId}/restaurar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire('¡Restaurada!', 'La póliza ha sido restaurada correctamente.', 'success');
      fetchPolizas();
    } catch (error) {
      Swal.fire('Error', 'No se pudo restaurar la póliza', 'error');
    }
  };

  // ✅ FUNCIONES AUXILIARES PARA DOCUMENTOS
  const formatTipoDocumento = (tipo) => {
    const tipos = {
      // Nuevos tipos de documentos adicionales
      'codem': 'CODEM',
      'formulario_f152': 'Formulario F152',
      'formulario_f184': 'Formulario F184',
      'constancia_inscripcion': 'Constancia de Inscripción',
      'comprobante_pago_cuota': 'Comprobante de Pago de Cuota',
      'estudios_medicos': 'Estudios Médicos',
      // Tipos existentes
      'dni_titular': 'DNI Titular',
      'dni_conyuge': 'DNI Cónyuge',
      'dni_hijo': 'DNI Hijo/a',
      'recibo_sueldo': 'Recibo de Sueldo',
      'monotributo': 'Monotributo',
      'certificado_nacimiento': 'Certificado de Nacimiento',
      'autorizacion_menor': 'Autorización Menor',
      'poliza_firmada': 'Póliza Firmada',
      'auditoria_medica': 'Auditoría Médica',
      'documento_identidad_adicional': 'Documento de Identidad Adicional',
      'comprobante_ingresos': 'Comprobante de Ingresos',
      'autorizacion_debito': 'Autorización de Débito',
      'otros': 'Otros'
    };
    return tipos[tipo] || tipo;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      // ✅ NUEVOS ESTADOS
      'asesor': { bg: 'info', text: 'Asesor' },
      'supervisor': { bg: 'warning', text: 'Supervisor' },
      'back_office': { bg: 'primary', text: 'Back Office' },
      'venta_cerrada': { bg: 'success', text: 'Venta Cerrada' },
      // Estados legacy para compatibilidad
      'pendiente_revision': { bg: 'info', text: 'Asesor' },
      'cerrada': { bg: 'success', text: 'Venta Cerrada' },
      'borrador': { bg: 'secondary', text: 'Borrador' },
      'en_revision': { bg: 'info', text: 'En Revisión' },
      'activa': { bg: 'success', text: 'Activa' },
      'rechazada': { bg: 'danger', text: 'Rechazada' },
      'cancelada': { bg: 'dark', text: 'Cancelada' }
    };
    return estados[estado] || { bg: 'secondary', text: estado };
  };

  // ✅ RENDERIZADO DE ESTADÍSTICAS EXTENDIDAS
  const renderEstadisticasAvanzadas = () => {
    if (!estadisticas) return <Spinner animation="border" />;

    return (
      <>
        {/* Cards de estadísticas generales ocultadas por solicitud
        <Row className="mb-4">
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <FaFileAlt className="text-primary mb-2" size={24} />
                <h5>{estadisticas.resumen_general.total_polizas}</h5>
                <small className="text-muted">Total Pólizas</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <FaUsers className="text-success mb-2" size={24} />
                <h5>{estadisticas.resumen_general.polizas_activas}</h5>
                <small className="text-muted">Activas</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <h5>{estadisticas.metricas_calculadas.conversion_rate_global}</h5>
                <small className="text-muted">Tasa Conversión</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <h5>{estadisticas.metricas_calculadas.ticket_promedio_formateado}</h5>
                <small className="text-muted">Ticket Promedio</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {estadisticasDocumentos && (
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center border-info">
                <Card.Body>
                  <FaFile className="text-info mb-2" size={24} />
                  <h5>{estadisticasDocumentos.resumen_general.total_documentos}</h5>
                  <small className="text-muted">Total Documentos</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center border-warning">
                <Card.Body>
                  <h5>{estadisticasDocumentos.metricas_calculadas.espacio_total_gb} GB</h5>
                  <small className="text-muted">Espacio Utilizado</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center border-success">
                <Card.Body>
                  <h5>{estadisticasDocumentos.resumen_general.polizas_con_documentos}</h5>
                  <small className="text-muted">Pólizas con Docs</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center border-secondary">
                <Card.Body>
                  <h5>{estadisticasDocumentos.metricas_calculadas.promedio_docs_por_poliza}</h5>
                  <small className="text-muted">Docs por Póliza</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
        */}
      </>
    );
  };

  // ✅ RENDERIZADO DE FILTROS AVANZADOS
  const renderFiltrosAvanzados = () => (
    <Card className="mb-6">
      <Card.Header>
        <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">🔍 Filtros Avanzados de Admin</h6>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Estado</Form.Label>
              <Form.Select
                value={filtros.estado}
                onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
              >
                <option value="todos">Todos los estados</option>
                {opcionesFiltro.estados.map(estado => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Vendedor</Form.Label>
              <Form.Select
                value={filtros.vendedor_id}
                onChange={(e) => setFiltros({...filtros, vendedor_id: e.target.value})}
              >
                <option value="todos">Todos los vendedores</option>
                {opcionesFiltro.vendedores.map(vendedor => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.first_name} {vendedor.last_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Supervisor</Form.Label>
              <Form.Select
                value={filtros.supervisor_id}
                onChange={(e) => setFiltros({...filtros, supervisor_id: e.target.value})}
              >
                <option value="todos">Todos los supervisores</option>
                {opcionesFiltro.supervisores.map(supervisor => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.first_name} {supervisor.last_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Plan</Form.Label>
              <Form.Select
                value={filtros.plan}
                onChange={(e) => setFiltros({...filtros, plan: e.target.value})}
              >
                <option value="todos">Todos los planes</option>
                {opcionesFiltro.planes.map(plan => (
                  <option key={plan.id} value={plan.nombre}>{plan.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Check
              type="switch"
              id="incluir-eliminadas"
              label="Incluir eliminadas"
              checked={filtros.incluir_eliminadas}
              onChange={(e) => setFiltros({...filtros, incluir_eliminadas: e.target.checked})}
            />
          </Col>
        </Row>
        <Row className="mt-4">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Buscar</Form.Label>
              <Form.Control
                type="text"
                placeholder="Buscar por póliza, cliente, vendedor..."
                value={filtros.buscar}
                onChange={(e) => setFiltros({...filtros, buscar: e.target.value})}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Desde</Form.Label>
              <Form.Control
                type="date"
                value={filtros.desde}
                onChange={(e) => setFiltros({...filtros, desde: e.target.value})}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Hasta</Form.Label>
              <Form.Control
                type="date"
                value={filtros.hasta}
                onChange={(e) => setFiltros({...filtros, hasta: e.target.value})}
              />
            </Form.Group>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  // ✅ RENDERIZADO DE TABLA CON BOTÓN DE DOCUMENTOS
  const renderTabla = () => (
    <Card>
      <Card.Header>
        <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📋 Pólizas - Vista de Administrador</h6>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="text-center p-6">
            <Spinner animation="border" />
          </div>
        ) : (
          <Table responsive striped>
            <thead>
              <tr>
                <th className="text-left">Número</th>
                <th className="text-left">Cliente</th>
                <th className="text-left">Estado</th>
                <th className="text-left">Vendedor</th>
                <th className="text-left">Supervisor</th>
                <th className="text-left">Plan</th>
                <th className="text-left">Hash PDF</th>
                <th className="text-left">Docs</th>
                <th className="text-left">Total</th>
                <th className="text-left">Fecha</th>
                <th className="text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {polizas.map(poliza => (
                <tr key={poliza.id} className={poliza.deleted_at ? 'bg-destructive/5' : ''}>
                  <td>
                    {poliza.numero_poliza}
                    {poliza.deleted_at && <Badge bg="danger" className="ms-1">ELIMINADA</Badge>}
                  </td>
                  <td>
                    {poliza.prospecto_nombre} {poliza.prospecto_apellido}
                    <br />
                    <small className="text-[0.875em] text-muted-foreground">{poliza.prospecto_email}</small>
                  </td>
                  <td>
                    <Badge bg={getEstadoBadge(poliza.estado).bg}>
                      {getEstadoBadge(poliza.estado).text}
                    </Badge>
                  </td>
                  <td>
                    {poliza.vendedor.nombre} {poliza.vendedor.apellido}
                  </td>
                  <td>
                    {poliza.supervisor ? 
                      `${poliza.supervisor.nombre} ${poliza.supervisor.apellido}` 
                      : 'Sin revisar'
                    }
                  </td>
                  <td>{poliza.plan_nombre}</td>
                  <td>
                    {poliza.pdf_hash ? (
                      <span 
                        style={{ 
                          fontFamily: 'monospace', 
                          fontSize: '11px',
                          color: '#28a745',
                          cursor: 'pointer'
                        }}
                        title={`Hash: ${poliza.pdf_hash}`}
                        onClick={() => navigator.clipboard.writeText(poliza.pdf_hash)}
                      >
                        {poliza.pdf_hash.substring(0, 8)}...
                      </span>
                    ) : (
                      <Badge bg="warning" text="dark">Sin hash</Badge>
                    )}
                  </td>
                  <td>
                    <Badge bg={poliza.total_documentos > 0 ? 'success' : 'secondary'}>
                      {poliza.total_documentos || 0}
                    </Badge>
                  </td>
                  <td>${poliza.total_final?.toLocaleString()}</td>
                  <td>{new Date(poliza.created_at).toLocaleDateString()}</td>
                  <td>
                    <ButtonGroup size="sm">
                      {/* ✅ NUEVO BOTÓN PARA VER DOCUMENTOS */}
                      <Button
                        variant="outline-info"
                        onClick={() => handleVerDocumentos(poliza)}
                        title="Ver documentos"
                      >
                        <FaFile />
                      </Button>
                      {poliza.deleted_at ? (
                        <Button 
                          variant="success"
                          onClick={() => restaurarPoliza(poliza.id)}
                          title="Restaurar póliza"
                        >
                          <FaEye />
                        </Button>
                      ) : (
                        <Button 
                          variant="danger"
                          onClick={() => eliminarPoliza(poliza.id)}
                          title="Eliminar póliza"
                        >
                          <FaTrash />
                        </Button>
                      )}
                      <Button 
                        variant="primary"
                        onClick={() => {
                          // ✅ Usar el mismo método que el vendedor con pdf_hash
                          if (poliza.pdf_hash) {
                            window.open( `${API_URL}/polizas/pdf/${poliza.pdf_hash}`, '_blank');
                          } else {
                            // Fallback al método anterior si no hay pdf_hash
                            window.open(poliza.urls?.pdf || '#', '_blank');
                          }
                        }}
                        title="Descargar PDF"
                      >
                        <FaDownload />
                      </Button>
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <Container fluid className="py-6">
      

      {renderEstadisticasAvanzadas()}
      {renderFiltrosAvanzados()}
      {renderTabla()}

      {/* ✅ MODAL: Documentos de la póliza */}
      <Modal show={modalDocumentos} onHide={() => setModalDocumentos(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            📁 Documentos de Póliza N° {documentosData.numero_poliza}
            {documentosData.poliza_eliminada && (
              <Badge bg="danger" className="ms-2">PÓLIZA ELIMINADA</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDocumentos ? (
            <div className="flex justify-center items-center" style={{ height: "50vh" }}>
              <Spinner animation="border" role="status">
                <span className="sr-only">Cargando documentos...</span>
              </Spinner>
            </div>
          ) : (
            <div>
              {/* ✅ INFO EXTENDIDA PARA ADMIN */}
              <Row className="mb-4">
                <Col md={4}>
                  <Card className="border-info">
                    <Card.Header>👤 Cliente</Card.Header>
                    <Card.Body>
                      <p className="mb-1">
                        <strong>{documentosData.titular?.nombre} {documentosData.titular?.apellido}</strong>
                      </p>
                      <small className="text-[0.875em] text-muted-foreground">{documentosData.titular?.email}</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-primary">
                    <Card.Header>👨‍💼 Vendedor</Card.Header>
                    <Card.Body>
                      <p className="mb-1">
                        <strong>{documentosData.vendedor?.nombre} {documentosData.vendedor?.apellido}</strong>
                      </p>
                      <small className="text-[0.875em] text-muted-foreground">{documentosData.vendedor?.email}</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-success">
                    <Card.Header>👨‍💻 Supervisor</Card.Header>
                    <Card.Body>
                      {documentosData.supervisor ? (
                        <>
                          <p className="mb-1">
                            <strong>{documentosData.supervisor.nombre} {documentosData.supervisor.apellido}</strong>
                          </p>
                          <small className="text-[0.875em] text-muted-foreground">{documentosData.supervisor.email}</small>
                        </>
                      ) : (
                        <p className="mb-4 text-muted-foreground">Sin supervisor asignado</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* ✅ ESTADÍSTICAS DE DOCUMENTOS */}
              {documentosData.estadisticas_documentos && (
                <Alert variant="info">
                  <FaInfoCircle className="me-2" />
                  <strong>Estadísticas:</strong> {documentosData.total_documentos} documentos en {documentosData.estadisticas_documentos.tipos_documento} tipos diferentes.
                  Espacio total: {documentosData.estadisticas_documentos.documentos_por_tipo.reduce((sum, tipo) => sum + tipo.tamaño_total, 0) > 0 && 
                    formatFileSize(documentosData.estadisticas_documentos.documentos_por_tipo.reduce((sum, tipo) => sum + tipo.tamaño_total, 0))
                  }
                </Alert>
              )}

              {/* ✅ DOCUMENTOS AGRUPADOS */}
              {Object.keys(documentosData.documentos || {}).length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  No hay documentos disponibles para esta póliza
                </div>
              ) : (
                Object.entries(documentosData.documentos).map(([tipoDoc, docs]) => (
                  <div key={tipoDoc} className="mb-6">
                    <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate border-b pb-2">
                      {formatTipoDocumento(tipoDoc)}
                      <Badge bg="secondary" className="ms-2">{docs.length}</Badge>
                    </h5>
                    <Row className="[--gx:1rem] [--gy:1rem]">
                      {docs.map((documento) => (
                        <Col md={6} lg={4} key={documento.id}>
                          <Card className="h-full">
                            <Card.Header className="flex justify-between items-center">
                              <small className="text-[0.875em] text-muted-foreground">
                                {documento.integrante_index !== null && (
                                  <Badge bg="info" className="me-2">
                                    Integrante {documento.integrante_index + 1}
                                  </Badge>
                                )}
                                {formatFileSize(documento.tamaño_bytes)}
                              </small>
                            </Card.Header>
                            <Card.Body>
                              <div className="mb-2">
                                <strong>Archivo:</strong>
                                <br />
                                <small className="text-[0.875em] text-muted-foreground">{documento.nombre_original}</small>
                              </div>
                              <div className="mb-2">
                                <strong>Subido:</strong>
                                <br />
                                <small className="text-[0.875em] text-muted-foreground">
                                  {new Date(documento.created_at).toLocaleDateString('es-AR', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </small>
                              </div>
                            </Card.Body>
                            <Card.Footer>
                              <ButtonGroup size="sm" className="w-full">
                                <Button
                                  variant="primary"
                                  onClick={() => handleDescargarDocumento(documento.id, documento.nombre_original)}
                                  title="Descargar"
                                >
                                  <FaDownload />
                                </Button>
                                <Button
                                  variant="info"
                                  onClick={() => handlePreviewDocumento(documento.id, documento.tipo_mime)}
                                  title="Previsualizar"
                                >
                                  <FaEye />
                                </Button>
                                {/* ✅ BOTÓN ELIMINAR (solo admin) */}
                                <Button
                                  variant="danger"
                                  onClick={() => handleEliminarDocumento(documento.id, documento.nombre_original)}
                                  title="Eliminar documento"
                                >
                                  <FaTrash />
                                </Button>
                              </ButtonGroup>
                            </Card.Footer>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalDocumentos(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ MODAL: Preview de documento */}
      <DocumentPreviewModal
        show={showPreview}
        onHide={() => {
          setShowPreview(false);
          if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        previewUrl={previewUrl}
        previewMime={previewMime}
        documentName="Documento de Póliza"
        onDownload={() => {
          if (previewUrl) {
            // Crear un enlace temporal para descargar
            const link = document.createElement('a');
            link.href = previewUrl;
            link.download = `documento_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />
    </Container>
  );
};

export default PolizasAdmin;