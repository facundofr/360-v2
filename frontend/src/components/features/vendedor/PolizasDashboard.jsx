import { useState, useEffect } from "react";
import { Container, Table, Spinner, Badge, Button, Row, Col, Card, Modal, Form, Alert } from "@/components/compat/bootstrap";
import { FaFile, FaEye, FaWhatsapp, FaList, FaThLarge, FaEdit, FaExchangeAlt, FaUpload, FaHistory, FaCalendarAlt, FaUser, FaComments, FaInfoCircle } from '@/lib/icons';
import { API_URL } from "../../config";
import { formatEdad } from "../../utils/estadosHelper";
import axios from "axios";
import BadgeEstadoFirma from '../../badges/BadgeEstadoFirma';
import { cn } from "@/lib/utils";

const PolizasDashboard = ({
  polizas,
  loadingPolizas,
  formatCurrency,
  formatFecha,
  getEstadoPoliza,
  handleVerDocumentos,
  handleEnviarPolizaPorWhatsApp,
  handleVerDetallePoliza,
  handleEditarPoliza,
  handleSubirDocumentosLibres,
  tipoVista,
  setTipoVista
}) => {
  // ✅ Validar que polizas sea un array
  const polizasArray = Array.isArray(polizas) ? polizas : [];

  // ✅ NUEVOS ESTADOS PARA CAMBIAR A SUPERVISOR
  const [modalEnviarSupervisor, setModalEnviarSupervisor] = useState(false);
  const [polizaParaEnviar, setPolizaParaEnviar] = useState(null);
  const [motivoEnvio, setMotivoEnvio] = useState('');
  const [loadingEnvio, setLoadingEnvio] = useState(false);

  // ✅ ESTADOS PARA HISTORIAL DE ACCIONES
  const [modalHistorial, setModalHistorial] = useState(false);
  const [historialEstados, setHistorialEstados] = useState([]);
  const [polizaHistorial, setPolizaHistorial] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // ✅ FUNCIÓN: Abrir modal para enviar a supervisor
  const handleAbrirEnviarSupervisor = (poliza) => {
    setPolizaParaEnviar(poliza);
    setMotivoEnvio('');
    setModalEnviarSupervisor(true);
  };

  // ✅ FUNCIÓN: Confirmar envío a supervisor
  const confirmarEnvioSupervisor = async () => {
    if (!motivoEnvio.trim()) {
      alert('Debes proporcionar un motivo para enviar a supervisor');
      return;
    }

    try {
      setLoadingEnvio(true);
      const token = localStorage.getItem('cober_token');
      
      const response = await axios.patch(
        `${API_URL}/vendedor/${polizaParaEnviar.id}/enviar-supervisor`,
        {
          motivo_cambio_estado: motivoEnvio
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('✅ Póliza enviada a supervisor exitosamente');
        setModalEnviarSupervisor(false);
        setPolizaParaEnviar(null);
        // Recargar las pólizas (el parent debe hacerlo)
        window.location.reload();
      }
    } catch (error) {
      console.error('Error enviando a supervisor:', error);
      alert('❌ Error al enviar a supervisor: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingEnvio(false);
    }
  };

  // ✅ FUNCIÓN: Ver historial de acciones de la póliza
  const handleVerHistorial = async (poliza) => {
    try {
      setPolizaHistorial(poliza);
      setModalHistorial(true);
      setLoadingHistorial(true);

      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/polizas/${poliza.id}/historial-estados`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setHistorialEstados(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      setHistorialEstados([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      'asesor': { bg: 'info', text: 'Asesor' },
      'supervisor': { bg: 'warning', text: 'Supervisor' },
      'back_office': { bg: 'primary', text: 'Back Office' },
      'venta_cerrada': { bg: 'success', text: 'Venta Cerrada' },
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

  // ✅ NUEVA: Función para enmascarar correos electrónicos
  const maskEmail = (email) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email; // Si no tiene @, devolver tal como está
    
    if (localPart.length <= 2) {
      return `**@${domain}`;
    }
    
    // Mostrar los primeros 2 caracteres y enmascarar el resto hasta @
    const maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 2);
    return `${maskedLocal}@${domain}`;
  };

  return (
    <>
      {/* Contenido de pólizas */}
      <Container fluid className="p-0">
        {loadingPolizas ? (
          <div className="flex justify-center items-center" style={{ height: "50vh" }}>
            <Spinner animation="border" role="status">
              <span className="sr-only">Cargando pólizas...</span>
            </Spinner>
          </div>
        ) : (
          <>
            {/* Vista de tabla para pólizas */}
            {tipoVista === "tabla" && (
              <div className="bg-card rounded-md shadow-xs p-4 mb-6">
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th className="text-left">N° Póliza</th>
                      <th className="text-left">Prospecto</th>
                      <th className="text-left">Plan</th>
                      <th className="text-left">Total</th>
                      <th className="text-left">Estado</th>
                      <th className="text-left">Fecha Creación</th>
                      <th className="text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polizasArray.map((poliza) => {
                      const estadoInfo = getEstadoPoliza(poliza.estado);
                      return (
                        <tr key={poliza.id}>
                          <td className="font-bold">{poliza.numero_poliza_oficial || poliza.numero_poliza}</td>
                          <td>
                            {poliza.prospecto_nombre || 'Sin nombre'} {poliza.prospecto_apellido || 'Sin apellido'}
                          </td>
                          <td>{poliza.plan_nombre || 'Plan no especificado'}</td>
                          <td className="font-bold text-success">
                            {formatCurrency(poliza.total_final || 0)}
                          </td>
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              <Badge bg={estadoInfo.bg}>{estadoInfo.text}</Badge>
                              <BadgeEstadoFirma poliza={poliza} />
                              {poliza.requiere_auditoria_medica && (
                                <Badge bg="danger" title="Requiere auditoría médica por IMC elevado">
                                  🏥 Auditoría Médica
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td>{formatFecha(poliza.created_at)}</td>
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              <Button
                                size="sm"
                                variant="warning"
                                title="Editar póliza"
                                onClick={() => handleEditarPoliza(poliza)}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                title="Descargar PDF"
                                onClick={() => window.open(`${API_URL}/polizas/pdf/${poliza.pdf_hash}`, '_blank')}
                              >
                                <FaFile />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                title="Ver documentos"
                                onClick={() => handleVerDocumentos(poliza)}
                              >
                                <FaEye />
                              </Button>
                              {handleSubirDocumentosLibres && (
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  title="Agregar documentos"
                                  onClick={() => handleSubirDocumentosLibres(poliza)}
                                >
                                  <FaUpload />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                title="Ver historial de acciones"
                                onClick={() => handleVerHistorial(poliza)}
                              >
                                <FaHistory />
                              </Button>
                              {poliza.estado === 'asesor' && (
                                <Button
                                  size="sm"
                                  variant="outline-info"
                                  title="Enviar a Supervisor"
                                  onClick={() => handleAbrirEnviarSupervisor(poliza)}
                                >
                                  <FaExchangeAlt /> Supervisor
                                </Button>
                              )}
                              {/* <Button
                                size="sm"
                                variant="info"
                                title="Ver detalles"
                                onClick={() => handleVerDetallePoliza(poliza)}
                              >
                                <FaEye />
                              </Button> */}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                {polizasArray.length === 0 && (
                  <div className="text-center py-12">
                    <p className="mb-4 text-muted-foreground">No tienes pólizas generadas aún.</p>
                  </div>
                )}
              </div>
            )}

            {/* Vista de tarjetas para pólizas */}
            {tipoVista === "tarjetas" && (
              <Row>
                {polizasArray.map((poliza) => {
                  const estadoInfo = getEstadoPoliza(poliza.estado);
                  return (
                    <Col lg={4} md={6} sm={12} key={poliza.id} className="mb-4">
                      <Card className="h-full shadow-xs">
                        <Card.Header className="flex justify-between items-center flex-wrap">
                          <span className="font-bold">
                            Póliza N° {poliza.numero_poliza_oficial || poliza.numero_poliza}
                          </span>
                          <div className="flex gap-1 flex-wrap">
                            <Badge bg={estadoInfo.bg}>{estadoInfo.text}</Badge>
                            <BadgeEstadoFirma poliza={poliza} />
                            {poliza.requiere_auditoria_medica && (
                              <Badge bg="danger" title="Requiere auditoría médica por IMC elevado">
                                🏥 Auditoría
                              </Badge>
                            )}
                          </div>
                        </Card.Header>
                        <Card.Body>
                          {/* Datos del prospecto */}
                          <div className="mb-4">
                            <small className="text-[0.875em] text-muted-foreground block mb-1">Prospecto:</small>
                            <div className="font-bold">
                              {poliza.prospecto_nombre || 'Sin nombre'} {poliza.prospecto_apellido || 'Sin apellido'}
                            </div>
                            {poliza.prospecto_edad != null && (
                              <small className="text-[0.875em] text-muted-foreground">({formatEdad(poliza.prospecto_edad)})</small>
                            )}
                          </div>
                          
                          {/* Datos del plan */}
                          <div className="mb-4">
                            <small className="text-[0.875em] text-muted-foreground block mb-1">Plan:</small>
                            <div className="font-bold">{poliza.plan_nombre || 'Plan no especificado'}</div>
                          </div>
                          
                          {/* Total */}
                          <div className="mb-4">
                            <small className="text-[0.875em] text-muted-foreground block mb-1">Total:</small>
                            <div className="font-bold text-success text-[1.25rem] leading-snug">
                              {formatCurrency(poliza.total_final || 0)}
                            </div>
                          </div>
                          
                          {/* Contacto del prospecto */}
                          {poliza.prospecto_telefono && (
                            <div className="mb-4">
                              <small className="text-[0.875em] text-muted-foreground block mb-1">Contacto:</small>
                              <div>{maskPhoneNumber(poliza.prospecto_telefono)}</div>
                            </div>
                          )}
                          
                          {/* Localidad */}
                          {poliza.prospecto_localidad && (
                            <div className="mb-4">
                              <small className="text-[0.875em] text-muted-foreground block mb-1">Localidad:</small>
                              <div>{poliza.prospecto_localidad}</div>
                            </div>
                          )}
                          
                          {/* Email */}
                          {poliza.prospecto_email && (
                            <div className="mb-4">
                              <small className="text-[0.875em] text-muted-foreground block mb-1">Email:</small>
                              <div>{maskEmail(poliza.prospecto_email)}</div>
                            </div>
                          )}
                          
                          {/* Fecha */}
                          <div className="mb-4">
                            <small className="text-[0.875em] text-muted-foreground block mb-1">Fecha:</small>
                            <div>{formatFecha(poliza.created_at)}</div>
                          </div>
                        </Card.Body>
                        <Card.Footer className="flex justify-between flex-wrap gap-2">
                          <div>
                            <small className="text-[0.875em] text-muted-foreground">ID: {poliza.id}</small>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="warning"
                              title="Editar póliza"
                              onClick={() => handleEditarPoliza(poliza)}
                            >
                              <FaEdit />
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              title="Descargar PDF"
                              onClick={() => window.open(`${API_URL}/polizas/pdf/${poliza.pdf_hash}`, '_blank')}
                            >
                              <FaFile />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              title="Ver documentos"
                              onClick={() => handleVerDocumentos(poliza)}
                            >
                              <FaEye />
                            </Button>
                            {handleSubirDocumentosLibres && (
                              <Button
                                size="sm"
                                variant="outline-success"
                                title="Agregar documentos"
                                onClick={() => handleSubirDocumentosLibres(poliza)}
                              >
                                <FaUpload />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              title="Ver historial de acciones"
                              onClick={() => handleVerHistorial(poliza)}
                            >
                              <FaHistory />
                            </Button>
                            {poliza.estado === 'asesor' && (
                              <Button
                                size="sm"
                                variant="outline-info"
                                title="Enviar a Supervisor"
                                onClick={() => handleAbrirEnviarSupervisor(poliza)}
                              >
                                <FaExchangeAlt /> Sup.
                              </Button>
                            )}
                            {/* <Button
                              size="sm"
                              variant="info"
                              title="Ver detalles"
                              onClick={() => handleVerDetallePoliza(poliza)}
                            >
                              <FaEye />
                            </Button> */}
                          </div>
                        </Card.Footer>
                      </Card>
                    </Col>
                  );
                })}
                {polizasArray.length === 0 && (
                  <Col className="text-center py-12">
                    <p className="mb-4 text-muted-foreground">No tienes pólizas generadas aún.</p>
                  </Col>
                )}
              </Row>
            )}
          </>
        )}
      </Container>

      {/* ✅ MODAL: Enviar a Supervisor */}
      <Modal show={modalEnviarSupervisor} onHide={() => setModalEnviarSupervisor(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExchangeAlt className="me-2" />
            Enviar Póliza a Supervisor
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {polizaParaEnviar && (
            <>
              <Alert variant="info">
                <strong>Póliza:</strong> {polizaParaEnviar.numero_poliza_oficial || polizaParaEnviar.numero_poliza}<br />
                <strong>Cliente:</strong> {polizaParaEnviar.prospecto_nombre} {polizaParaEnviar.prospecto_apellido}<br />
                <strong>Estado actual:</strong> <Badge bg="warning">Asesor</Badge>
              </Alert>
              
              <Alert variant="warning">
                <strong>⚠️ Nota:</strong> Al enviar a supervisor, tu póliza será revisada y supervisada antes de pasar a back office.
              </Alert>
              
              <Form.Group className="mb-4">
                <Form.Label>Motivo del Envío a Supervisor</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={motivoEnvio}
                  onChange={(e) => setMotivoEnvio(e.target.value)}
                  placeholder="Describe por qué estás enviando esta póliza a supervisor..."
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalEnviarSupervisor(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={confirmarEnvioSupervisor}
            disabled={loadingEnvio || !motivoEnvio.trim()}
          >
            {loadingEnvio ? <Spinner size="sm" className="me-1" /> : <FaExchangeAlt className="me-1" />}
            Enviar a Supervisor
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ MODAL: Historial de Acciones de la Póliza */}
      <Modal show={modalHistorial} onHide={() => setModalHistorial(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaHistory className="me-2" />
            Historial de Acciones
            {polizaHistorial && (
              <Badge bg="primary" className="ms-2">
                {polizaHistorial.numero_poliza_oficial || polizaHistorial.numero_poliza}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingHistorial ? (
            <div className="text-center py-6">
              <Spinner animation="border" />
              <p className="mb-4 mt-2">Cargando historial...</p>
            </div>
          ) : historialEstados.length === 0 ? (
            <Alert variant="info">
              <FaHistory className="me-2" />
              No hay registros de cambios de estado para esta póliza.
            </Alert>
          ) : (
            <>
              {polizaHistorial && (
                <Alert variant="light" className="mb-4">
                  <Row>
                    <Col md={6}>
                      <small className="text-[0.875em]"><strong>Cliente:</strong> {polizaHistorial.prospecto_nombre} {polizaHistorial.prospecto_apellido}</small>
                    </Col>
                    <Col md={6}>
                      <small className="text-[0.875em]"><strong>Estado actual:</strong>{' '}
                        {(() => {
                          const estadoInfo = getEstadoPoliza(polizaHistorial.estado);
                          return <Badge bg={estadoInfo.bg}>{estadoInfo.text}</Badge>;
                        })()}
                      </small>
                    </Col>
                  </Row>
                </Alert>
              )}

              <div className="">
                {historialEstados.map((item, index) => (
                  <Card key={item.id} className={`mb-4 ${index === 0 ? 'border-primary' : ''}`}>
                    <Card.Header className={`flex justify-between items-center py-2 ${index === 0 ? 'bg-primary text-white' : 'bg-muted'}`}>
                      <div className="flex items-center">
                        <FaExchangeAlt className="me-2" />
                        <span>
                          <Badge bg={getEstadoBadge(item.estado_anterior).bg} className="me-1">
                            {getEstadoBadge(item.estado_anterior).text}
                          </Badge>
                          <span className="mx-1">→</span>
                          <Badge bg={getEstadoBadge(item.estado_nuevo).bg}>
                            {getEstadoBadge(item.estado_nuevo).text}
                          </Badge>
                        </span>
                        {index === 0 && <Badge bg="warning" className="ms-2">Último cambio</Badge>}
                      </div>
                      <small className={cn("text-[0.875em]", index === 0 ? 'text-white/60' : 'text-muted-foreground')}>
                        <FaCalendarAlt className="me-1" />
                        {new Date(item.created_at).toLocaleDateString('es-AR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </small>
                    </Card.Header>
                    <Card.Body className="py-2">
                      <Row>
                        <Col md={12}>
                          <div className="mb-2">
                            <FaUser className="me-1 text-muted-foreground" />
                            <strong>Realizado por:</strong>{' '}
                            {item.usuario_nombre} {item.usuario_apellido}
                          </div>
                        </Col>
                      </Row>
                      <div className="mt-2 p-2 bg-muted rounded-md">
                        <FaComments className="me-1 text-info" />
                        <strong>Comentario/Motivo:</strong>
                        <p className="mb-0 mt-1 text-foreground">
                          {item.motivo || <span className="text-muted-foreground italic">Sin comentario</span>}
                        </p>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>

              <div className="text-muted-foreground text-[0.875em] text-center mt-4">
                <FaInfoCircle className="me-1" />
                Se muestran {historialEstados.length} cambios de estado registrados
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalHistorial(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PolizasDashboard;