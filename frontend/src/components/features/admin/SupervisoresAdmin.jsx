import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Button, 
  Modal, Form, Spinner, Alert, InputGroup 
} from '@/components/compat/bootstrap';
import { 
  FaUserTie, 
  FaUsers, 
  FaEye, 
  FaPlus, 
  FaSearch,
  FaFilter,
  FaDownload,
  FaUserPlus,
  FaToggleOn,
  FaToggleOff,
  FaArrowLeft
} from '@/lib/icons';
import axios from 'axios';
import { API_URL } from "../../config";
import { useNavigate } from 'react-router-dom';
import Swal from '@/lib/alerts';

const SupervisoresAdmin = () => {
  const [supervisores, setSupervisores] = useState([]);
  const [vendedoresSinSupervisor, setVendedoresSinSupervisor] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAsignacionModal, setShowAsignacionModal] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [supervisorDetalles, setSupervisorDetalles] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSupervisores();
    fetchVendedoresSinSupervisor();
  }, []);

  const fetchSupervisores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/admin/supervisores`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSupervisores(response.data.data);
    } catch (error) {
      console.error('Error al cargar supervisores:', error);
      setError('Error al cargar supervisores');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalles = async (supervisor) => {
    setSelectedSupervisor(supervisor);
    setShowDetalleModal(true);
    setDetalleLoading(true);
    setSupervisorDetalles(null);

    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/admin/supervisores/${supervisor.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSupervisorDetalles(response.data.data);
    } catch (error) {
      console.error('Error al obtener detalles del supervisor:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los detalles del supervisor'
      });
    } finally {
      setDetalleLoading(false);
    }
  };

  const fetchVendedoresSinSupervisor = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/admin/vendedores-sin-supervisor`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setVendedoresSinSupervisor(response.data.data);
    } catch (error) {
      console.error('Error al cargar vendedores sin supervisor:', error);
    }
  };

  const handleAsignarVendedor = async (vendedorId) => {
    if (!selectedSupervisor) return;

    try {
      const token = localStorage.getItem('cober_token');
      await axios.post(`${API_URL}/admin/vendedores/asignar`, {
        vendedorId,
        supervisorId: selectedSupervisor.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Swal.fire({
        icon: 'success',
        title: 'Vendedor Asignado',
        text: 'El vendedor ha sido asignado al supervisor correctamente'
      });

      setShowAsignacionModal(false);
      fetchSupervisores();
      fetchVendedoresSinSupervisor();
    } catch (error) {
      console.error('Error al asignar vendedor:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo asignar el vendedor al supervisor'
      });
    }
  };

  const handleToggleSupervisorStatus = async (supervisorId, currentStatus, supervisorName) => {
    const action = currentStatus ? 'deshabilitar' : 'habilitar';
    
    const result = await Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} supervisor?`,
      text: `¿Estás seguro de que deseas ${action} a ${supervisorName}?`,
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
        await axios.patch(`${API_URL}/admin/supervisores/${supervisorId}/toggle-status`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        Swal.fire({
          icon: 'success',
          title: 'Estado Actualizado',
          text: `El supervisor ha sido ${currentStatus ? 'deshabilitado' : 'habilitado'} correctamente`
        });

        fetchSupervisores();
      } catch (error) {
        console.error('Error al cambiar estado del supervisor:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cambiar el estado del supervisor'
        });
      }
    }
  };

  const filteredSupervisores = supervisores.filter(supervisor =>
    `${supervisor.first_name} ${supervisor.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supervisor.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('es-AR');
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
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-6">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 md:py-6">
      {/* Header */}
      <Row className="mb-4 md:mb-6">
        <Col>
          {/* <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-sm-center">
            <div className="mb-2 mb-sm-0">
              <h2 className="mb-1">
                <FaUserTie className="me-2 text-primary" />
                <span className="d-none d-md-inline">Gestión de Supervisores</span>
                <span className="d-md-none">Supervisores</span>
              </h2>
              <p className="text-muted mb-0">
                <span className="d-none d-sm-inline">Administra supervisores y sus equipos de vendedores</span>
                <span className="d-sm-none">Gestión de equipos</span>
              </p>
            </div>
            <Button 
              variant="primary"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft className="me-1 me-sm-2" />
              <span className="d-none d-sm-inline">Volver</span>
            </Button>
          </div> */}
        </Col>
      </Row>

      {/* Controles */}
      <Row className="mb-4 md:mb-6">
     
        <Col xs={12} md={6} className="flex justify-end gap-2">
         
       
        </Col>
      </Row>

      {/* Estadísticas rápidas */}
      <Row className="mb-4 md:mb-6">
        <Col xs={6} sm={6} md={3} className="mb-4">
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center py-2 sm:py-4">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-primary">{supervisores.length}</h4>
              <small className="text-[0.875em] text-muted-foreground block">
                <span className="hidden sm:inline">Total Supervisores</span>
                <span className="sm:hidden">Total</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={6} md={3} className="mb-4">
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center py-2 sm:py-4">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-success">{supervisores.filter(s => s.is_enabled).length}</h4>
              <small className="text-[0.875em] text-muted-foreground block">
                <span className="hidden sm:inline">Supervisores Activos</span>
                <span className="sm:hidden">Activos</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={6} md={3} className="mb-4">
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center py-2 sm:py-4">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-info">
                {supervisores.reduce((total, s) => total + s.total_vendedores, 0)}
              </h4>
              <small className="text-[0.875em] text-muted-foreground block">
                <span className="hidden sm:inline">Total Vendedores</span>
                <span className="sm:hidden">Vendedores</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={6} md={3} className="mb-4">
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center py-2 sm:py-4">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-warning">{vendedoresSinSupervisor.length}</h4>
              <small className="text-[0.875em] text-muted-foreground block">
                <span className="hidden sm:inline">Sin Supervisor</span>
                <span className="sm:hidden">Sin Asignar</span>
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabla de supervisores */}
      <Row>
        <Col>
          <Card className="border-0 shadow-xs transition-shadow hover:shadow-md">
            <Card.Header className="bg-card flex justify-between items-center">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <span className="hidden sm:inline">Lista de Supervisores</span>
                <span className="sm:hidden">Supervisores</span>
              </h5>
              <Badge bg="primary">{filteredSupervisores.length}</Badge>
            </Card.Header>
            <Card.Body className="p-0 sm:p-4">
              {filteredSupervisores.length === 0 ? (
                <Alert variant="info" className="m-4">
                  <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Sin resultados</h6>
                  <p className="mb-0">No se encontraron supervisores que coincidan con la búsqueda.</p>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table responsive hover className="mb-0">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left">Supervisor</th>
                        <th className="text-center hidden sm:table-cell">Estado</th>
                        <th className="text-center">Equipo</th>
                        <th className="text-center hidden md:table-cell">Vendedores Activos</th>
                        <th className="text-center hidden lg:table-cell">Último Acceso</th>
                        <th className="text-center">Acciones</th>
                      </tr>
                    </thead>
                  <tbody>
                    {filteredSupervisores.map((supervisor) => (
                      <tr key={supervisor.id}>
                        <td>
                          <div>
                            <strong>{supervisor.first_name} {supervisor.last_name}</strong>
                            <br />
                            <small className="text-[0.875em] text-muted-foreground">{supervisor.email}</small>
                          </div>
                        </td>
                        <td className="text-center">
                          {getStatusBadge(supervisor.is_enabled, supervisor.last_login)}
                        </td>
                        <td className="text-center">
                          <Badge bg="primary" pill>
                            {supervisor.total_vendedores} vendedores
                          </Badge>
                        </td>
                        <td className="text-center">
                          <Badge bg="success" pill>
                            {supervisor.vendedores_activos}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <small className="text-[0.875em] text-muted-foreground">
                            {formatDate(supervisor.last_login)}
                          </small>
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-1"
                            onClick={() => handleVerDetalles(supervisor)}
                            title="Ver detalles"
                          >
                            <FaEye />
                          </Button>
                          <Button
                            variant="outline-success"
                            size="sm"
                            className="me-1"
                            onClick={() => {
                              setSelectedSupervisor(supervisor);
                              setShowAsignacionModal(true);
                            }}
                            disabled={vendedoresSinSupervisor.length === 0}
                            title="Asignar vendedor"
                          >
                            <FaUserPlus />
                          </Button>
                          <Button
                            variant={supervisor.is_enabled ? "outline-danger" : "outline-success"}
                            size="sm"
                            onClick={() => handleToggleSupervisorStatus(
                              supervisor.id, 
                              supervisor.is_enabled, 
                              `${supervisor.first_name} ${supervisor.last_name}`
                            )}
                            title={supervisor.is_enabled ? "Deshabilitar supervisor" : "Habilitar supervisor"}
                          >
                            {supervisor.is_enabled ? <FaToggleOff /> : <FaToggleOn />}
                          </Button>
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
      <Modal show={showAsignacionModal} onHide={() => setShowAsignacionModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaUserPlus className="me-2" />
            Asignar Vendedor a {selectedSupervisor?.first_name} {selectedSupervisor?.last_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {vendedoresSinSupervisor.length === 0 ? (
            <Alert variant="info">
              No hay vendedores sin supervisor asignado.
            </Alert>
          ) : (
            <Table hover>
              <thead>
                <tr>
                  <th className="text-left">Vendedor</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Estado</th>
                  <th className="text-center">Asignar</th>
                </tr>
              </thead>
              <tbody>
                {vendedoresSinSupervisor.map((vendedor) => (
                  <tr key={vendedor.id}>
                    <td>
                      <strong>{vendedor.first_name} {vendedor.last_name}</strong>
                    </td>
                    <td>{vendedor.email}</td>
                    <td>
                      <Badge bg={vendedor.is_enabled ? 'success' : 'secondary'}>
                        {vendedor.is_enabled ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="text-center">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleAsignarVendedor(vendedor.id)}
                      >
                        <FaPlus />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAsignacionModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de detalles de supervisor */}
      <Modal show={showDetalleModal} onHide={() => setShowDetalleModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaUserTie className="me-2" />
            Detalles de {selectedSupervisor?.first_name} {selectedSupervisor?.last_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detalleLoading ? (
            <div className="flex justify-center items-center" style={{ minHeight: '150px' }}>
              <Spinner animation="border" variant="primary" />
            </div>
          ) : supervisorDetalles ? (
            <>
              <Row className="mb-4">
                <Col md={6} className="mb-4 md:mb-0">
                  <Card className="border-0 shadow-xs h-full">
                    <Card.Body>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">Información del supervisor</h6>
                      <div className="mb-1"><strong>Nombre:</strong> {supervisorDetalles.supervisor.first_name} {supervisorDetalles.supervisor.last_name}</div>
                      <div className="mb-1"><strong>Email:</strong> {supervisorDetalles.supervisor.email}</div>
                      {supervisorDetalles.supervisor.phone_number && (
                        <div className="mb-1"><strong>Teléfono:</strong> {supervisorDetalles.supervisor.phone_number}</div>
                      )}
                      <div className="mb-1">
                        <strong>Estado:</strong> {getStatusBadge(supervisorDetalles.supervisor.is_enabled, supervisorDetalles.supervisor.last_login)}
                      </div>
                      <div className="text-muted-foreground text-[0.875em]">
                        Último acceso: {formatDate(supervisorDetalles.supervisor.last_login)}
                        <br />
                        Alta: {formatDate(supervisorDetalles.supervisor.created_at)}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-0 shadow-xs h-full">
                    <Card.Body>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">Resumen del equipo</h6>
                      <Row>
                        <Col xs={6} className="mb-2">
                          <div className="text-center">
                            <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">{(supervisorDetalles.vendedores || []).length}</h5>
                            <small className="text-[0.875em] text-muted-foreground">Vendedores</small>
                          </div>
                        </Col>
                        <Col xs={6} className="mb-2">
                          <div className="text-center">
                            <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">{(supervisorDetalles.vendedores || []).filter(v => v.is_enabled).length}</h5>
                            <small className="text-[0.875em] text-muted-foreground">Activos</small>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2">Vendedores del equipo</h6>
              {(supervisorDetalles.vendedores || []).length === 0 ? (
                <Alert variant="info">Este supervisor no tiene vendedores asignados.</Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table responsive hover size="sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left">Vendedor</th>
                        <th className="text-center">Estado</th>
                        <th className="text-center hidden md:table-cell">Último acceso</th>
                        <th className="text-center">Prospectos</th>
                        <th className="text-center">Ventas</th>
                        <th className="text-center hidden lg:table-cell">Activos</th>
                        <th className="text-center hidden lg:table-cell">Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supervisorDetalles.vendedores.map(v => (
                        <tr key={v.id}>
                          <td>
                            <div>
                              <strong>{v.first_name} {v.last_name}</strong>
                              <br />
                              <small className="text-[0.875em] text-muted-foreground">{v.email}</small>
                            </div>
                          </td>
                          <td className="text-center">{getStatusBadge(v.is_enabled, v.last_login)}</td>
                          <td className="text-center hidden md:table-cell"><small className="text-[0.875em] text-muted-foreground">{formatDate(v.last_login)}</small></td>
                          <td className="text-center"><Badge bg="primary" pill>{v.total_prospectos}</Badge></td>
                          <td className="text-center"><Badge bg="success" pill>{v.ventas_realizadas}</Badge></td>
                          <td className="text-center hidden lg:table-cell"><Badge bg="info" pill>{v.prospectos_activos}</Badge></td>
                          <td className="text-center hidden lg:table-cell">
                            <Badge bg="secondary">{v.categoria_nombre || 'Sin categoría'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <Alert variant="warning">No se encontraron detalles para este supervisor.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetalleModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SupervisoresAdmin;
