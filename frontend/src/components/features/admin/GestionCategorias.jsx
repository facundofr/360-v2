import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Modal,
  Form,
  Alert,
  Badge,
  Spinner,
  ButtonGroup,
  ProgressBar,
  Tooltip,
  OverlayTrigger
} from '@/components/compat/bootstrap';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaUsers,
  FaChartLine,
  FaSync,
  FaCog,
  FaUserTag,
  FaBalanceScale,
  FaExclamationTriangle
} from '@/lib/icons';
import { API_URL } from "../../config";
import axios from 'axios';
import Swal from '@/lib/alerts';

const GestionCategorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [estadisticas, setEstadisticas] = useState([]);
  const [cargaVendedores, setCargaVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: "", variant: "success" });

  // Estados para modals
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [selectedVendedor, setSelectedVendedor] = useState(null);

  // Estados para formularios
  const [categoriaForm, setCategoriaForm] = useState({
    nombre: '',
    descripcion: '',
    capacidad_maxima: 50,
    prioridad: 1,
    activa: true
  });

  const [selectedCategoria, setSelectedCategoria] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      
      const [categoriasRes, vendedoresRes, estadisticasRes, cargaRes] = await Promise.all([
        axios.get(`${API_URL}/admin/categorias`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/supervisor/vendedores`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/admin/categorias/estadisticas`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/admin/categorias/carga-vendedores`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setCategorias(categoriasRes.data);
      setVendedores(vendedoresRes.data);
      setEstadisticas(estadisticasRes.data);
      setCargaVendedores(cargaRes.data);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setAlert({
        show: true,
        message: "Error al cargar los datos",
        variant: "danger"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategoria = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("cober_token");
      
      if (editingCategoria) {
        await axios.put(`${API_URL}/admin/categorias/${editingCategoria.id}`, 
          categoriaForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAlert({
          show: true,
          message: "Categoría actualizada correctamente",
          variant: "success"
        });
      } else {
        await axios.post(`${API_URL}/admin/categorias`, 
          categoriaForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAlert({
          show: true,
          message: "Categoría creada correctamente",
          variant: "success"
        });
      }

      setShowCategoriaModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error al guardar categoría:", error);
      setAlert({
        show: true,
        message: "Error al guardar la categoría: " + (error.response?.data?.message || error.message),
        variant: "danger"
      });
    }
  };

  const handleEditCategoria = (categoria) => {
    setEditingCategoria(categoria);
    setCategoriaForm({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      capacidad_maxima: categoria.capacidad_maxima,
      prioridad: categoria.prioridad,
      activa: categoria.activa === 1
    });
    setShowCategoriaModal(true);
  };

  const handleDeleteCategoria = async (categoria) => {
    const result = await Swal.fire({
      title: '¿Eliminar categoría?',
      text: `¿Está seguro de que desea eliminar la categoría "${categoria.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem("cober_token");
        await axios.delete(`${API_URL}/admin/categorias/${categoria.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setAlert({
          show: true,
          message: "Categoría eliminada correctamente",
          variant: "success"
        });
        fetchData();
      } catch (error) {
        console.error("Error al eliminar categoría:", error);
        setAlert({
          show: true,
          message: "Error al eliminar la categoría: " + (error.response?.data?.message || error.message),
          variant: "danger"
        });
      }
    }
  };

  const handleAsignarCategoria = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("cober_token");
      await axios.put(`${API_URL}/admin/categorias/vendedor/${selectedVendedor.id}/categoria`, 
        { categoriaId: selectedCategoria }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlert({
        show: true,
        message: "Categoría asignada correctamente",
        variant: "success"
      });
      setShowAsignarModal(false);
      setSelectedVendedor(null);
      setSelectedCategoria('');
      fetchData();
    } catch (error) {
      console.error("Error al asignar categoría:", error);
      setAlert({
        show: true,
        message: "Error al asignar la categoría: " + (error.response?.data?.message || error.message),
        variant: "danger"
      });
    }
  };

  const handleResetRoundRobin = async (categoria) => {
    const result = await Swal.fire({
      title: '¿Reiniciar round-robin?',
      text: `¿Desea reiniciar el sistema de distribución round-robin para la categoría "${categoria.nombre}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#007bff',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem("cober_token");
        await axios.post(`${API_URL}/admin/categorias/${categoria.id}/reset-round-robin`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setAlert({
          show: true,
          message: "Round-robin reiniciado correctamente",
          variant: "success"
        });
        fetchData();
      } catch (error) {
        console.error("Error al reiniciar round-robin:", error);
        setAlert({
          show: true,
          message: "Error al reiniciar el round-robin: " + (error.response?.data?.message || error.message),
          variant: "danger"
        });
      }
    }
  };

  const resetForm = () => {
    setCategoriaForm({
      nombre: '',
      descripcion: '',
      capacidad_maxima: 50,
      prioridad: 1,
      activa: true
    });
    setEditingCategoria(null);
  };

  const getCategoriaColor = (prioridad) => {
    switch (prioridad) {
      case 1: return 'success';
      case 2: return 'warning';
      case 3: return 'info';
      default: return 'secondary';
    }
  };

  const getProgressVariant = (porcentaje) => {
    if (porcentaje >= 90) return 'danger';
    if (porcentaje >= 75) return 'warning';
    if (porcentaje >= 50) return 'info';
    return 'success';
  };

  if (loading) {
    return (
      <Container className="flex justify-center items-center" style={{ height: "50vh" }}>
        <Spinner animation="border" role="status">
          <span className="sr-only">Cargando...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="py-6">
      {alert.show && (
        <Alert 
          variant={alert.variant} 
          onClose={() => setAlert({ ...alert, show: false })} 
          dismissible
          className="mb-6"
        >
          {alert.message}
        </Alert>
      )}

      <Row className="mb-6">
        <Col>
          <div className="flex justify-between items-center">
            <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-corporate">
              <FaUserTag className="me-2" />
              Gestión de Categorías de Vendedores
            </h2>
            <ButtonGroup>
              <Button 
                variant="primary" 
                onClick={() => setShowCategoriaModal(true)}
              >
                <FaPlus className="me-1" />
                Nueva Categoría
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={fetchData}
              >
                <FaSync className="me-1" />
                Actualizar
              </Button>
            </ButtonGroup>
          </div>
        </Col>
      </Row>

      {/* Estadísticas generales */}
      <Row className="mb-6">
        {estadisticas.map((stat) => (
          <Col md={4} key={stat.categoria_id} className="mb-4">
            <Card className="h-full">
              <Card.Body>
                <div className="flex justify-between items-start">
                  <div>
                    <h6 className="tracking-tight mb-2 text-lg leading-snug font-bold text-corporate">
                      <Badge bg={getCategoriaColor(stat.categoria_prioridad || 3)}>
                        {stat.categoria_nombre}
                      </Badge>
                    </h6>
                    <p className="text-[0.875em] text-muted-foreground mb-2">
                      Capacidad máx: {stat.capacidad_maxima}
                    </p>
                  </div>
                  <FaChartLine className="text-muted-foreground" />
                </div>
                
                <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)] text-center">
                  <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-4/12">
                    <div className="font-bold text-primary">{stat.vendedores_activos}</div>
                    <div className="text-[0.875em] text-muted-foreground">Activos</div>
                  </div>
                  <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-4/12">
                    <div className="font-bold text-success">{stat.total_prospectos}</div>
                    <div className="text-[0.875em] text-muted-foreground">Prospectos</div>
                  </div>
                  <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-4/12">
                    <div className="font-bold text-info">{stat.promedio_prospectos_por_vendedor}</div>
                    <div className="text-[0.875em] text-muted-foreground">Promedio</div>
                  </div>
                </div>

                {stat.ultimo_vendedor_nombre && (
                  <div className="mt-2 text-[0.875em] text-muted-foreground">
                    Último asignado: {stat.ultimo_vendedor_nombre}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabla de categorías */}
      <Row className="mb-6">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaCog className="me-2" />
                Configuración de Categorías
              </h5>
            </Card.Header>
            <Card.Body>
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th className="text-left">Nombre</th>
                    <th className="text-left">Descripción</th>
                    <th className="text-left">Capacidad Máx.</th>
                    <th className="text-left">Prioridad</th>
                    <th className="text-left">Vendedores</th>
                    <th className="text-left">Estado</th>
                    <th className="text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => (
                    <tr key={categoria.id}>
                      <td>
                        <Badge bg={getCategoriaColor(categoria.prioridad)}>
                          {categoria.nombre}
                        </Badge>
                      </td>
                      <td>{categoria.descripcion || '-'}</td>
                      <td className="text-center">{categoria.capacidad_maxima}</td>
                      <td className="text-center">
                        <Badge bg="secondary">{categoria.prioridad}</Badge>
                      </td>
                      <td className="text-center">{categoria.vendedores_asignados}</td>
                      <td>
                        <Badge bg={categoria.activa ? 'success' : 'danger'}>
                          {categoria.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td>
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-primary"
                            onClick={() => handleEditCategoria(categoria)}
                          >
                            <FaEdit />
                          </Button>
                          <Button
                            variant="outline-info"
                            onClick={() => handleResetRoundRobin(categoria)}
                          >
                            <FaSync />
                          </Button>
                          <Button
                            variant="outline-danger"
                            onClick={() => handleDeleteCategoria(categoria)}
                            disabled={categoria.vendedores_asignados > 0}
                          >
                            <FaTrash />
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabla de carga de vendedores */}
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaBalanceScale className="me-2" />
                Distribución de Carga por Vendedor
              </h5>
            </Card.Header>
            <Card.Body>
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th className="text-left">Vendedor</th>
                    <th className="text-left">Categoría</th>
                    <th className="text-left">Carga Actual</th>
                    <th className="text-left">Capacidad</th>
                    <th className="text-left">% Utilización</th>
                    <th className="text-left">Estado</th>
                    <th className="text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargaVendedores.map((vendedor) => (
                    <tr key={vendedor.id}>
                      <td>{vendedor.first_name} {vendedor.last_name}</td>
                      <td>
                        {vendedor.categoria_nombre ? (
                          <Badge bg={getCategoriaColor(vendedor.categoria_prioridad || 3)}>
                            {vendedor.categoria_nombre}
                          </Badge>
                        ) : (
                          <Badge bg="secondary">Sin asignar</Badge>
                        )}
                      </td>
                      <td className="text-center">{vendedor.current_load}</td>
                      <td className="text-center">{vendedor.capacidad_maxima || 50}</td>
                      <td>
                        <div style={{ minWidth: '120px' }}>
                          <ProgressBar 
                            now={vendedor.porcentaje_carga} 
                            variant={getProgressVariant(vendedor.porcentaje_carga)}
                            label={`${vendedor.porcentaje_carga}%`}
                          />
                        </div>
                      </td>
                      <td>
                        <Badge bg={vendedor.is_enabled ? 'success' : 'danger'}>
                          {vendedor.is_enabled ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {vendedor.porcentaje_carga >= 90 && (
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Vendedor cerca del límite de capacidad</Tooltip>}
                          >
                            <FaExclamationTriangle className="text-warning ms-1" />
                          </OverlayTrigger>
                        )}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => {
                            setSelectedVendedor(vendedor);
                            setSelectedCategoria(vendedor.categoria_id || '');
                            setShowAsignarModal(true);
                          }}
                        >
                          <FaUserTag className="me-1" />
                          Asignar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal para crear/editar categoría */}
      <Modal show={showCategoriaModal} onHide={() => {setShowCategoriaModal(false); resetForm();}}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateCategoria}>
          <Modal.Body>
            <Form.Group className="mb-4">
              <Form.Label>Nombre *</Form.Label>
              <Form.Control
                type="text"
                value={categoriaForm.nombre}
                onChange={(e) => setCategoriaForm({...categoriaForm, nombre: e.target.value})}
                required
                maxLength={50}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={categoriaForm.descripcion}
                onChange={(e) => setCategoriaForm({...categoriaForm, descripcion: e.target.value})}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label>Capacidad Máxima *</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="200"
                    value={categoriaForm.capacidad_maxima}
                    onChange={(e) => setCategoriaForm({...categoriaForm, capacidad_maxima: parseInt(e.target.value)})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label>Prioridad *</Form.Label>
                  <Form.Select
                    value={categoriaForm.prioridad}
                    onChange={(e) => setCategoriaForm({...categoriaForm, prioridad: parseInt(e.target.value)})}
                    required
                  >
                    <option value={1}>1 - Alta</option>
                    <option value={2}>2 - Media</option>
                    <option value={3}>3 - Baja</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                label="Categoría activa"
                checked={categoriaForm.activa}
                onChange={(e) => setCategoriaForm({...categoriaForm, activa: e.target.checked})}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {setShowCategoriaModal(false); resetForm();}}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingCategoria ? 'Actualizar' : 'Crear'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal para asignar categoría a vendedor */}
      <Modal show={showAsignarModal} onHide={() => setShowAsignarModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Asignar Categoría</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAsignarCategoria}>
          <Modal.Body>
            {selectedVendedor && (
              <>
                <p className="mb-4">
                  <strong>Vendedor:</strong> {selectedVendedor.first_name} {selectedVendedor.last_name}
                </p>
                <p className="mb-4">
                  <strong>Carga actual:</strong> {selectedVendedor.current_load} prospectos
                </p>

                <Form.Group className="mb-4">
                  <Form.Label>Seleccionar Categoría</Form.Label>
                  <Form.Select
                    value={selectedCategoria}
                    onChange={(e) => setSelectedCategoria(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar categoría...</option>
                    {categorias.filter(c => c.activa).map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre} (Cap: {categoria.capacidad_maxima})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAsignarModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Asignar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default GestionCategorias;
