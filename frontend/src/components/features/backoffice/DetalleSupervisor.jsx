import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Table, 
  Badge, 
  Button, 
  Spinner, 
  Alert,
  Modal,
  Form
} from '@/components/compat/bootstrap';
import { 
  FaUserTie, 
  FaUsers, 
  FaArrowLeft, 
  FaEnvelope, 
  FaPhone,
  FaCalendarAlt,
  FaChartLine,
  FaUserPlus,
  FaEye,
  FaToggleOn,
  FaToggleOff,
  FaPlus
} from '@/lib/icons';
import axios from 'axios';
import { API_URL } from "../../config";
import Swal from '@/lib/alerts';

const DetalleSupervisor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supervisor, setSupervisor] = useState(null);
  const [vendedores, setVendedores] = useState([]);
  const [vendedoresSinSupervisor, setVendedoresSinSupervisor] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAsignacionModal, setShowAsignacionModal] = useState(false);

  useEffect(() => {
    fetchDetallesSupervisor();
    fetchVendedoresSinSupervisor();
  }, [id]);

  const fetchDetallesSupervisor = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');
      
      const response = await axios.get(`${API_URL}/backoffice/supervisores/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSupervisor(response.data.data.supervisor);
        setVendedores(response.data.data.vendedores);
      } else {
        setError('No se pudieron cargar los detalles del supervisor');
      }
    } catch (error) {
      console.error('Error al cargar detalles del supervisor:', error);
      if (error.response?.status === 404) {
        setError('Supervisor no encontrado');
      } else {
        setError('Error al conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchVendedoresSinSupervisor = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/vendedores-sin-supervisor`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setVendedoresSinSupervisor(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar vendedores sin supervisor:', error);
    }
  };

  const handleAsignarVendedor = async (vendedorId) => {
    try {
      const token = localStorage.getItem('cober_token');
      
      const response = await axios.post(`${API_URL}/backoffice/vendedores/asignar`, {
        vendedorId,
        supervisorId: id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Vendedor Asignado',
          text: 'El vendedor ha sido asignado al supervisor correctamente',
          timer: 2000,
          showConfirmButton: false
        });

        setShowAsignacionModal(false);
        fetchDetallesSupervisor();
        fetchVendedoresSinSupervisor();
      }
    } catch (error) {
      console.error('Error al asignar vendedor:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo asignar el vendedor al supervisor'
      });
    }
  };

  const handleToggleVendedorStatus = async (vendedorId, currentStatus, vendedorName) => {
    const action = currentStatus ? 'deshabilitar' : 'habilitar';
    
    const result = await Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} vendedor?`,
      text: `¿Estás seguro de que deseas ${action} a ${vendedorName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#dc3545' : '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('cober_token');
        const response = await axios.patch(`${API_URL}/backoffice/vendedores/${vendedorId}/toggle-status`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Estado Actualizado',
            text: `El vendedor ha sido ${currentStatus ? 'deshabilitado' : 'habilitado'} correctamente`,
            timer: 2000,
            showConfirmButton: false
          });

          fetchDetallesSupervisor();
        }
      } catch (error) {
        console.error('Error al cambiar estado del vendedor:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cambiar el estado del vendedor'
        });
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (isEnabled, lastLogin) => {
    if (!isEnabled) {
      return <Badge bg="danger">Inactivo</Badge>;
    }
    
    const daysSinceLogin = lastLogin 
      ? Math.floor((new Date() - new Date(lastLogin)) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceLogin > 7) {
      return <Badge bg="warning">Inactivo 7+ días</Badge>;
    } else if (daysSinceLogin > 3) {
      return <Badge bg="info">Activo</Badge>;
    } else {
      return <Badge bg="success">Muy Activo</Badge>;
    }
  };

  if (loading) {
    return (
      <Container className="flex justify-center items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" size="lg" />
          <p className="mb-4 mt-4 text-muted-foreground">Cargando detalles del supervisor...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-6">
        <Alert variant="danger">
          <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate">Error</h5>
          <p className="mb-4">{error}</p>
          <Button variant="outline-danger" onClick={() => navigate('/backoffice/supervisores')}>
            <FaArrowLeft className="me-2" />
            Volver a Supervisores
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!supervisor) {
    return (
      <Container className="mt-6">
        <Alert variant="warning">
          <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate">Supervisor no encontrado</h5>
          <p className="mb-4">No se pudo encontrar el supervisor solicitado.</p>
          <Button variant="outline-warning" onClick={() => navigate('/backoffice/supervisores')}>
            <FaArrowLeft className="me-2" />
            Volver a Supervisores
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 md:py-6">
      {/* Header */}
      <Row className="mb-4 md:mb-6">
        <Col>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-2 sm:mb-0">
              <Button 
                variant="outline-secondary" 
                size="sm"
                className="mb-2"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft className="me-2" />
                Volver
              </Button>
              <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-corporate mb-1">
                <FaUserTie className="me-2 text-primary" />
                <span className="hidden sm:inline">Detalles del Supervisor</span>
                <span className="sm:hidden">Supervisor</span>
              </h2>
              <p className="text-muted-foreground mb-0">
                <span className="hidden sm:inline">Información completa y gestión del equipo</span>
                <span className="sm:hidden">Gestión del equipo</span>
              </p>
            </div>
            <Button 
              variant="success"
              size="sm"
              onClick={() => setShowAsignacionModal(true)}
              disabled={vendedoresSinSupervisor.length === 0}
            >
              <FaUserPlus className="me-1 sm:me-2" />
              <span className="hidden sm:inline">Asignar Vendedor</span>
              <span className="sm:hidden">Asignar</span>
            </Button>
          </div>
        </Col>
      </Row>

      {/* Información del Supervisor */}
      <Row className="mb-4 md:mb-6">
        <Col>
          <Card className="shadow-xs">
            <Card.Header className="bg-primary text-white">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaUserTie className="me-2" />
                Información Personal
              </h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col xs={12} md={6} lg={3} className="mb-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-1">Nombre Completo</h6>
                  <p className="mb-0">
                    <strong>{supervisor.first_name} {supervisor.last_name}</strong>
                  </p>
                </Col>
                <Col xs={12} md={6} lg={3} className="mb-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-1">
                    <FaEnvelope className="me-1" />
                    Email
                  </h6>
                  <p className="mb-0">
                    <a href={`mailto:${supervisor.email}`} className="text-primary underline-offset-2 no-underline">
                      {supervisor.email}
                    </a>
                  </p>
                </Col>
                <Col xs={12} md={6} lg={3} className="mb-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-1">
                    <FaPhone className="me-1" />
                    Teléfono
                  </h6>
                  <p className="mb-0">
                    {supervisor.phone_number || 'No registrado'}
                  </p>
                </Col>
                <Col xs={12} md={6} lg={3} className="mb-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-1">Estado</h6>
                  <p className="mb-0">
                    {getStatusBadge(supervisor.is_enabled, supervisor.last_login)}
                  </p>
                </Col>
                <Col xs={12} md={6} lg={3} className="mb-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-1">
                    <FaCalendarAlt className="me-1" />
                    Último Acceso
                  </h6>
                  <p className="mb-0">
                    <small className="text-[0.875em]">{formatDate(supervisor.last_login)}</small>
                  </p>
                </Col>
                <Col xs={12} md={6} lg={3} className="mb-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-1">Fecha de Registro</h6>
                  <p className="mb-0">
                    <small className="text-[0.875em]">{formatDate(supervisor.created_at)}</small>
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Estadísticas del Equipo */}
      <Row className="mb-4 md:mb-6">
        <Col xs={6} sm={3} className="mb-4">
          <Card className="text-center h-full shadow-xs border-primary">
            <Card.Body className="py-2 sm:py-4">
              <FaUsers className="text-primary mb-2" size={20} />
              <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-primary mb-1">{vendedores.length}</h4>
              <small className="text-[0.875em] text-muted-foreground">
                <span className="hidden sm:inline">Total Vendedores</span>
                <span className="sm:hidden">Total</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={3} className="mb-4">
          <Card className="text-center h-full shadow-xs border-success">
            <Card.Body className="py-2 sm:py-4">
              <FaChartLine className="text-success mb-2" size={20} />
              <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-success mb-1">
                {vendedores.filter(v => v.is_enabled).length}
              </h4>
              <small className="text-[0.875em] text-muted-foreground">
                <span className="hidden sm:inline">Activos</span>
                <span className="sm:hidden">Activos</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={3} className="mb-4">
          <Card className="text-center h-full shadow-xs border-info">
            <Card.Body className="py-2 sm:py-4">
              <FaUsers className="text-info mb-2" size={20} />
              <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-info mb-1">
                {vendedores.reduce((total, v) => total + v.total_prospectos, 0)}
              </h4>
              <small className="text-[0.875em] text-muted-foreground">
                <span className="hidden sm:inline">Prospectos</span>
                <span className="sm:hidden">Prospectos</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={3} className="mb-4">
          <Card className="text-center h-full shadow-xs border-warning">
            <Card.Body className="py-2 sm:py-4">
              <FaChartLine className="text-warning mb-2" size={20} />
              <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-warning mb-1">
                {vendedores.reduce((total, v) => total + v.ventas_realizadas, 0)}
              </h4>
              <small className="text-[0.875em] text-muted-foreground">
                <span className="hidden sm:inline">Ventas</span>
                <span className="sm:hidden">Ventas</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Lista de Vendedores */}
      <Row>
        <Col>
          <Card className="shadow-xs">
            <Card.Header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-2 sm:mb-0">
                <FaUsers className="me-2" />
                <span className="hidden sm:inline">Equipo de Vendedores ({vendedores.length})</span>
                <span className="sm:hidden">Vendedores ({vendedores.length})</span>
              </h5>
              <Badge bg="info" className="self-start sm:items-center">
                {vendedores.filter(v => v.is_enabled).length} activos
              </Badge>
            </Card.Header>
            <Card.Body className="p-0 sm:p-4">
              {vendedores.length === 0 ? (
                <Alert variant="info" className="m-4">
                  <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Sin vendedores asignados</h6>
                  <p className="mb-2">Este supervisor aún no tiene vendedores en su equipo.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAsignacionModal(true)}
                    disabled={vendedoresSinSupervisor.length === 0}
                  >
                    <FaUserPlus className="me-2" />
                    Asignar Primer Vendedor
                  </Button>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table responsive hover className="mb-0">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left">Vendedor</th>
                        <th className="text-center hidden sm:table-cell">Categoría</th>
                        <th className="text-center">Estado</th>
                        <th className="text-center hidden md:table-cell">Prospectos</th>
                        <th className="text-center">Ventas</th>
                        <th className="text-center hidden lg:table-cell">Último Acceso</th>
                        <th className="text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendedores.map((vendedor) => (
                        <tr key={vendedor.id}>
                          <td>
                            <div>
                              <strong className="truncate block" title={`${vendedor.first_name} ${vendedor.last_name}`}>
                                {vendedor.first_name} {vendedor.last_name}
                              </strong>
                              <small className="text-[0.875em] text-muted-foreground hidden sm:block truncate" title={vendedor.email}>
                                {vendedor.email}
                              </small>
                            </div>
                          </td>
                          <td className="text-center hidden sm:table-cell">
                            <Badge bg="secondary" pill>
                              {vendedor.categoria_nombre || 'Sin categoría'}
                            </Badge>
                          </td>
                          <td className="text-center">
                            {getStatusBadge(vendedor.is_enabled, vendedor.last_login)}
                          </td>
                          <td className="text-center hidden md:table-cell">
                            <Badge bg="primary">{vendedor.total_prospectos}</Badge>
                            <div className="md:hidden mt-1">
                              <small className="text-[0.875em] text-muted-foreground">
                                {vendedor.prospectos_activos} activos
                              </small>
                            </div>
                          </td>
                          <td className="text-center">
                            <Badge bg="success">{vendedor.ventas_realizadas}</Badge>
                            <div className="sm:hidden mt-1">
                              <small className="text-[0.875em] text-muted-foreground">
                                {vendedor.total_prospectos} prosp.
                              </small>
                            </div>
                          </td>
                          <td className="text-center hidden lg:table-cell">
                            <small className="text-[0.875em] text-muted-foreground">
                              {formatDate(vendedor.last_login)}
                            </small>
                          </td>
                          <td className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => navigate(`/backoffice/vendedores/${vendedor.id}`)}
                                title="Ver detalles"
                              >
                                <FaEye />
                              </Button>
                              <Button
                                variant={vendedor.is_enabled ? "outline-danger" : "outline-success"}
                                size="sm"
                                onClick={() => handleToggleVendedorStatus(
                                  vendedor.id, 
                                  vendedor.is_enabled, 
                                  `${vendedor.first_name} ${vendedor.last_name}`
                                )}
                                title={vendedor.is_enabled ? "Deshabilitar" : "Habilitar"}
                              >
                                {vendedor.is_enabled ? <FaToggleOff /> : <FaToggleOn />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal para asignar vendedores */}
      <Modal 
        show={showAsignacionModal} 
        onHide={() => setShowAsignacionModal(false)} 
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaUserPlus className="me-2" />
            <span className="hidden sm:inline">
              Asignar Vendedor a {supervisor.first_name} {supervisor.last_name}
            </span>
            <span className="sm:hidden">
              Asignar Vendedor
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {vendedoresSinSupervisor.length === 0 ? (
            <Alert variant="info">
              <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Sin vendedores disponibles</h6>
              <p className="mb-0">No hay vendedores sin supervisor asignado.</p>
            </Alert>
          ) : (
            <>
              <Alert variant="success" className="mb-4">
                <small className="text-[0.875em]">
                  <strong>{vendedoresSinSupervisor.length}</strong> vendedores disponibles para asignar
                </small>
              </Alert>
              <div className="overflow-x-auto">
                <Table hover responsive>
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left">Vendedor</th>
                      <th className="text-left hidden sm:table-cell">Email</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Asignar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedoresSinSupervisor.map((vendedor) => (
                      <tr key={vendedor.id}>
                        <td>
                          <div>
                            <strong>{vendedor.first_name} {vendedor.last_name}</strong>
                            <div className="sm:hidden">
                              <small className="text-[0.875em] text-muted-foreground">{vendedor.email}</small>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell">
                          <small className="text-[0.875em] text-muted-foreground">{vendedor.email}</small>
                        </td>
                        <td className="text-center">
                          <Badge bg={vendedor.is_enabled ? 'success' : 'secondary'} pill>
                            {vendedor.is_enabled ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleAsignarVendedor(vendedor.id)}
                            title="Asignar a este supervisor"
                          >
                            <FaPlus />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAsignacionModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DetalleSupervisor;
