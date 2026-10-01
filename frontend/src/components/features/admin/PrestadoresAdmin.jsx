import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Container, Row, Col, Button, Table, Modal, Form, InputGroup, Badge,
  Card, Spinner, Alert, OverlayTrigger, Tooltip
} from "@/components/compat/bootstrap";
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaSearch, FaFilter, FaCheck, FaTimes,
  FaUserMd, FaHospital, FaFlask, FaPills, FaCog, FaToggleOn, FaToggleOff,
  FaMapMarkerAlt, FaPhone, FaEnvelope, FaIdCard
} from "@/lib/icons";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";



const TIPOS_PRESTADOR = [
  { value: 'medico', label: 'Médico', icon: FaUserMd, color: 'primary' },
  { value: 'clinica', label: 'Clínica', icon: FaHospital, color: 'success' },
  { value: 'laboratorio', label: 'Laboratorio', icon: FaFlask, color: 'info' },
  { value: 'farmacia', label: 'Farmacia', icon: FaPills, color: 'warning' },
  { value: 'otro', label: 'Otro', icon: FaCog, color: 'secondary' }
];

const PrestadoresAdmin = () => {
  const [prestadores, setPrestadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modales
  const [showModal, setShowModal] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);
  const [prestadorDetalle, setPrestadorDetalle] = useState(null);
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    especialidad: '',
    telefono: '',
    email: '',
    direccion: '',
    localidad: '',
    provincia: '',
    codigo_postal: '',
    matricula: '',
    tipo_prestador: 'medico',
    estado: true,
    observaciones: ''
  });
  const [editingId, setEditingId] = useState(null);
  
  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroLocalidad, setFiltroLocalidad] = useState("");

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const fetchPrestadores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/prestadores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrestadores(response.data);
      setError(null);
    } catch (error) {
      console.error("Error al cargar prestadores:", error);
      setError("No se pudieron cargar los prestadores.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      especialidad: '',
      telefono: '',
      email: '',
      direccion: '',
      localidad: '',
      provincia: '',
      codigo_postal: '',
      matricula: '',
      tipo_prestador: 'medico',
      estado: true,
      observaciones: ''
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      if (editingId) {
        // Actualizar
        await axios.put(`${API_URL}/admin/prestadores/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await Swal.fire({
          icon: 'success',
          title: '✅ Prestador Actualizado',
          text: 'Los datos del prestador han sido actualizados correctamente.',
          timer: 3000
        });
      } else {
        // Crear
        await axios.post(`${API_URL}/admin/prestadores`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await Swal.fire({
          icon: 'success',
          title: '✅ Prestador Creado',
          text: 'El prestador ha sido registrado correctamente.',
          timer: 3000
        });
      }
      
      setShowModal(false);
      resetForm();
      fetchPrestadores();
      
    } catch (error) {
      console.error("Error al guardar prestador:", error);
      
      const errorMessage = error.response?.data?.errores 
        ? error.response.data.errores.join(', ')
        : error.response?.data?.message || "Error al guardar el prestador.";
      
      await Swal.fire({
        icon: 'error',
        title: '❌ Error',
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prestador) => {
    setFormData({
      nombre: prestador.nombre,
      especialidad: prestador.especialidad || '',
      telefono: prestador.telefono || '',
      email: prestador.email || '',
      direccion: prestador.direccion || '',
      localidad: prestador.localidad || '',
      provincia: prestador.provincia || '',
      codigo_postal: prestador.codigo_postal || '',
      matricula: prestador.matricula || '',
      tipo_prestador: prestador.tipo_prestador,
      estado: prestador.estado === 1,
      observaciones: prestador.observaciones || ''
    });
    setEditingId(prestador.id);
    setShowModal(true);
  };

  const handleDelete = async (id, nombre) => {
    const result = await Swal.fire({
      title: '⚠️ ¿Eliminar Prestador?',
      text: `¿Estás seguro de que deseas eliminar a "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem("cober_token");
        
        await axios.delete(`${API_URL}/admin/prestadores/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await Swal.fire({
          icon: 'success',
          title: '✅ Prestador Eliminado',
          text: `"${nombre}" ha sido eliminado correctamente.`,
          timer: 3000
        });
        
        fetchPrestadores();
        
      } catch (error) {
        console.error("Error al eliminar prestador:", error);
        
        await Swal.fire({
          icon: 'error',
          title: '❌ Error',
          text: error.response?.data?.message || "No se pudo eliminar el prestador."
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChangeStatus = async (id, nuevoEstado, nombre) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      await axios.put(`${API_URL}/admin/prestadores/${id}/estado`, { estado: nuevoEstado }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await Swal.fire({
        icon: 'success',
        title: `✅ Prestador ${nuevoEstado ? 'Activado' : 'Desactivado'}`,
        text: `"${nombre}" ha sido ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`,
        timer: 3000
      });
      
      fetchPrestadores();
      
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      
      await Swal.fire({
        icon: 'error',
        title: '❌ Error',
        text: "No se pudo cambiar el estado del prestador."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      const response = await axios.get(`${API_URL}/admin/prestadores/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPrestadorDetalle(response.data);
      setShowDetalle(true);
      
    } catch (error) {
      console.error("Error al obtener detalles:", error);
      await Swal.fire({
        icon: 'error',
        title: '❌ Error',
        text: "No se pudieron cargar los detalles del prestador."
      });
    } finally {
      setLoading(false);
    }
  };

  // Funciones auxiliares
  const getTipoPrestadorInfo = (tipo) => {
    return TIPOS_PRESTADOR.find(t => t.value === tipo) || TIPOS_PRESTADOR[4];
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "No disponible";
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Filtrado
  const prestadoresFiltrados = prestadores.filter(prestador => {
    const termino = busqueda.toLowerCase();
    const coincideBusqueda = 
      prestador.nombre.toLowerCase().includes(termino) ||
      (prestador.especialidad && prestador.especialidad.toLowerCase().includes(termino)) ||
      (prestador.localidad && prestador.localidad.toLowerCase().includes(termino)) ||
      (prestador.email && prestador.email.toLowerCase().includes(termino));
      
    const coincideTipo = filtroTipo === "" || prestador.tipo_prestador === filtroTipo;
    const coincideEstado = filtroEstado === "" || 
      (filtroEstado === "activo" && prestador.estado) || 
      (filtroEstado === "inactivo" && !prestador.estado);
    const coincideLocalidad = filtroLocalidad === "" || 
      (prestador.localidad && prestador.localidad.toLowerCase().includes(filtroLocalidad.toLowerCase()));
      
    return coincideBusqueda && coincideTipo && coincideEstado && coincideLocalidad;
  });

  // Obtener valores únicos para filtros
  const localidades = [...new Set(prestadores.map(p => p.localidad).filter(Boolean))];

  if (loading && prestadores.length === 0) {
    return (
      <div className="text-center py-12">
        <Spinner animation="border" variant="primary" />
        <p className="mb-4 mt-4">Cargando prestadores...</p>
      </div>
    );
  }

  return (
    <Container fluid className="py-6">
      <Row className="mb-6">
        <Col>
          <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-corporate mb-0">🏥 Gestión de Prestadores</h2>
          <p className="mb-4 text-muted-foreground">Administra médicos, clínicas y otros prestadores de salud</p>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Controles y filtros */}
      <Card className="shadow-xs mb-6">
        <Card.Body>
          <Row className="items-center">
            <Col md={6} className="mb-4 md:mb-0">
              <Button 
                variant="primary" 
                onClick={() => { resetForm(); setShowModal(true); }}
                className="me-2"
              >
                <FaPlus className="me-1" /> Agregar Prestador
              </Button>
            </Col>
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Buscar por nombre, especialidad, localidad..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </InputGroup>
            </Col>
          </Row>

          <Row className="mt-4">
            <Col md={3}>
              <Form.Select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="">Todos los tipos</option>
                {TIPOS_PRESTADOR.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={filtroLocalidad} onChange={e => setFiltroLocalidad(e.target.value)}>
                <option value="">Todas las localidades</option>
                {localidades.map(localidad => (
                  <option key={localidad} value={localidad}>{localidad}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Button 
                variant="outline-secondary" 
                onClick={() => {
                  setBusqueda("");
                  setFiltroTipo("");
                  setFiltroEstado("");
                  setFiltroLocalidad("");
                }}
                className="w-full"
              >
                <FaTimes className="me-1" /> Limpiar
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabla de prestadores */}
      <Card className="shadow-xs">
        <Card.Body className="p-0">
          <div className="w-full overflow-x-auto">
            <Table striped hover className="mb-0">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left">Prestador</th>
                  <th className="text-left">Tipo</th>
                  <th className="text-left">Contacto</th>
                  <th className="text-left">Ubicación</th>
                  <th className="text-left">Planes</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left" style={{ width: "180px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prestadoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-6">
                      No hay prestadores que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  prestadoresFiltrados.map(prestador => {
                    const tipoInfo = getTipoPrestadorInfo(prestador.tipo_prestador);
                    const IconoTipo = tipoInfo.icon;
                    
                    return (
                      <tr key={prestador.id}>
                        <td>
                          <div>
                            <strong>{prestador.nombre}</strong>
                            {prestador.especialidad && (
                              <div className="text-[0.875em] text-muted-foreground">{prestador.especialidad}</div>
                            )}
                            {prestador.matricula && (
                              <div className="text-[0.875em] text-info">
                                <FaIdCard className="me-1" />
                                Mat: {prestador.matricula}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge bg={tipoInfo.color} className="flex items-center w-fit">
                            <IconoTipo className="me-1" />
                            {tipoInfo.label}
                          </Badge>
                        </td>
                        <td>
                          <div className="text-[0.875em]">
                            {prestador.telefono && (
                              <div><FaPhone className="me-1" />{prestador.telefono}</div>
                            )}
                            {prestador.email && (
                              <div><FaEnvelope className="me-1" />{prestador.email}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="text-[0.875em]">
                            {prestador.localidad && (
                              <div><FaMapMarkerAlt className="me-1" />{prestador.localidad}</div>
                            )}
                            {prestador.provincia && (
                              <div className="text-muted-foreground">{prestador.provincia}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge bg="info">{prestador.planes_asignados || 0}</Badge>
                        </td>
                        <td>
                          <Button
                            variant={prestador.estado ? "outline-success" : "outline-secondary"}
                            size="sm"
                            onClick={() => handleChangeStatus(prestador.id, !prestador.estado, prestador.nombre)}
                          >
                            {prestador.estado ? (
                              <>
                                <FaToggleOn className="me-1" />
                                Activo
                              </>
                            ) : (
                              <>
                                <FaToggleOff className="me-1" />
                                Inactivo
                              </>
                            )}
                          </Button>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <OverlayTrigger placement="top" overlay={<Tooltip>Ver detalles</Tooltip>}>
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => handleVerDetalle(prestador.id)}
                              >
                                <FaEye />
                              </Button>
                            </OverlayTrigger>
                            
                            <OverlayTrigger placement="top" overlay={<Tooltip>Editar</Tooltip>}>
                              <Button
                                variant="outline-warning"
                                size="sm"
                                onClick={() => handleEdit(prestador)}
                              >
                                <FaEdit />
                              </Button>
                            </OverlayTrigger>
                            
                            <OverlayTrigger placement="top" overlay={<Tooltip>Eliminar</Tooltip>}>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDelete(prestador.id, prestador.nombre)}
                              >
                                <FaTrash />
                              </Button>
                            </OverlayTrigger>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Información de totales */}
      <div className="mt-4 text-muted-foreground">
        Mostrando {prestadoresFiltrados.length} de {prestadores.length} prestadores
      </div>

      {/* Modal Formulario */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId ? "📝 Editar Prestador" : "➕ Agregar Prestador"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-4">
                  <Form.Label>Nombre *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nombre}
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                    required
                    placeholder="Nombre del prestador"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-4">
                  <Form.Label>Tipo *</Form.Label>
                  <Form.Select
                    value={formData.tipo_prestador}
                    onChange={e => setFormData({...formData, tipo_prestador: e.target.value})}
                    required
                  >
                    {TIPOS_PRESTADOR.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label>Especialidad</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.especialidad}
                    onChange={e => setFormData({...formData, especialidad: e.target.value})}
                    placeholder="Ej: Cardiología, Medicina General"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label>Matrícula</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.matricula}
                    onChange={e => setFormData({...formData, matricula: e.target.value})}
                    placeholder="Número de matrícula profesional"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label>Teléfono</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.telefono}
                    onChange={e => setFormData({...formData, telefono: e.target.value})}
                    placeholder="Teléfono de contacto"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="email@ejemplo.com"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                type="text"
                value={formData.direccion}
                onChange={e => setFormData({...formData, direccion: e.target.value})}
                placeholder="Dirección completa"
              />
            </Form.Group>

            <Row>
              <Col md={5}>
                <Form.Group className="mb-4">
                  <Form.Label>Localidad</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.localidad}
                    onChange={e => setFormData({...formData, localidad: e.target.value})}
                    placeholder="Ciudad o localidad"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-4">
                  <Form.Label>Provincia</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.provincia}
                    onChange={e => setFormData({...formData, provincia: e.target.value})}
                    placeholder="Provincia"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-4">
                  <Form.Label>Código Postal</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.codigo_postal}
                    onChange={e => setFormData({...formData, codigo_postal: e.target.value})}
                    placeholder="CP"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Observaciones</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.observaciones}
                onChange={e => setFormData({...formData, observaciones: e.target.value})}
                placeholder="Notas adicionales sobre el prestador..."
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                label="Prestador activo"
                checked={formData.estado}
                onChange={e => setFormData({...formData, estado: e.target.checked})}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Guardando...
                </>
              ) : (
                <>
                  <FaCheck className="me-1" />
                  {editingId ? "Actualizar" : "Crear"}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Detalle */}
      <Modal show={showDetalle} onHide={() => setShowDetalle(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaEye className="me-2" />
            Detalles del Prestador
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prestadorDetalle && (
            <div>
              {/* Información básica */}
              <Row className="mb-6">
                <Col md={8}>
                  <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-corporate">{prestadorDetalle.nombre}</h4>
                  {prestadorDetalle.especialidad && (
                    <p className="text-muted-foreground mb-1">
                      <strong>Especialidad:</strong> {prestadorDetalle.especialidad}
                    </p>
                  )}
                  {prestadorDetalle.matricula && (
                    <p className="text-muted-foreground mb-1">
                      <FaIdCard className="me-1" />
                      <strong>Matrícula:</strong> {prestadorDetalle.matricula}
                    </p>
                  )}
                </Col>
                <Col md={4} className="text-right">
                  {(() => {
                    const tipoInfo = getTipoPrestadorInfo(prestadorDetalle.tipo_prestador);
                    const IconoTipo = tipoInfo.icon;
                    return (
                      <Badge bg={tipoInfo.color} className="p-2">
                        <IconoTipo className="me-1" />
                        {tipoInfo.label}
                      </Badge>
                    );
                  })()}
                  <br />
                  <Badge 
                    bg={prestadorDetalle.estado ? "success" : "secondary"} 
                    className="mt-2"
                  >
                    {prestadorDetalle.estado ? "Activo" : "Inactivo"}
                  </Badge>
                </Col>
              </Row>

              {/* Información de contacto */}
              <Card className="mb-6">
                <Card.Header>
                  <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📞 Información de Contacto</h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      {prestadorDetalle.telefono && (
                        <p className="mb-4"><FaPhone className="me-2" /><strong>Teléfono:</strong> {prestadorDetalle.telefono}</p>
                      )}
                      {prestadorDetalle.email && (
                        <p className="mb-4"><FaEnvelope className="me-2" /><strong>Email:</strong> {prestadorDetalle.email}</p>
                      )}
                    </Col>
                    <Col md={6}>
                      {prestadorDetalle.direccion && (
                        <p className="mb-4"><FaMapMarkerAlt className="me-2" /><strong>Dirección:</strong> {prestadorDetalle.direccion}</p>
                      )}
                      {prestadorDetalle.localidad && (
                        <p className="mb-4"><strong>Localidad:</strong> {prestadorDetalle.localidad}</p>
                      )}
                      {prestadorDetalle.provincia && (
                        <p className="mb-4"><strong>Provincia:</strong> {prestadorDetalle.provincia}</p>
                      )}
                      {prestadorDetalle.codigo_postal && (
                        <p className="mb-4"><strong>Código Postal:</strong> {prestadorDetalle.codigo_postal}</p>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Planes asignados */}
              {prestadorDetalle.planes_asignados && prestadorDetalle.planes_asignados.length > 0 && (
                <Card className="mb-6">
                  <Card.Header>
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📋 Planes Asignados</h6>
                  </Card.Header>
                  <Card.Body>
                    <Table size="sm">
                      <thead>
                        <tr>
                          <th className="text-left">Plan</th>
                          <th className="text-left">Tipo Cobertura</th>
                          <th className="text-left">% Cobertura</th>
                          <th className="text-left">Copago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prestadorDetalle.planes_asignados.map(plan => (
                          <tr key={plan.id}>
                            <td>{plan.plan_nombre}</td>
                            <td>
                              <Badge bg="info">{plan.tipo_cobertura}</Badge>
                            </td>
                            <td>{plan.porcentaje_cobertura}%</td>
                            <td>${plan.copago}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              )}

              {/* Observaciones */}
              {prestadorDetalle.observaciones && (
                <Card className="mb-6">
                  <Card.Header>
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📝 Observaciones</h6>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-0">{prestadorDetalle.observaciones}</p>
                  </Card.Body>
                </Card>
              )}

              {/* Información de auditoría */}
              <Card>
                <Card.Header>
                  <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📊 Información del Sistema</h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <p className="mb-4"><strong>Creado:</strong> {formatearFecha(prestadorDetalle.created_at)}</p>
                      {prestadorDetalle.created_by_name && (
                        <p className="mb-4"><strong>Creado por:</strong> {prestadorDetalle.created_by_name}</p>
                      )}
                    </Col>
                    <Col md={6}>
                      <p className="mb-4"><strong>Actualizado:</strong> {formatearFecha(prestadorDetalle.updated_at)}</p>
                      {prestadorDetalle.updated_by_name && (
                        <p className="mb-4"><strong>Actualizado por:</strong> {prestadorDetalle.updated_by_name}</p>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetalle(false)}>
            Cerrar
          </Button>
          {prestadorDetalle && (
            <Button 
              variant="warning" 
              onClick={() => {
                setShowDetalle(false);
                handleEdit(prestadorDetalle);
              }}
            >
              <FaEdit className="me-1" />
              Editar
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PrestadoresAdmin;