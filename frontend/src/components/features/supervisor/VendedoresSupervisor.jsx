import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";
import { 
  Container, Row, Col, Table, Button, Form, Badge, 
  Card, Modal, Alert, ButtonGroup, Spinner, InputGroup, ProgressBar
} from "@/components/compat/bootstrap";
import { FaEdit, FaTrash, FaEye, FaSearch, FaList, FaThLarge, FaSort, FaSortUp, FaSortDown, FaUserPlus, FaChevronUp, FaChevronDown, FaUserCheck, FaUserTimes, FaExchangeAlt, FaUsers, FaUserTag, FaCog, FaGlobe, FaRecycle, FaMobileAlt, FaInfoCircle } from "@/lib/icons";
import { getEstadoConfig } from '../../utils/estadosHelper';

const ROLES = [
  { value: 1, label: "Vendedor", color: "primary" }
];

const VendedoresSupervisor = () => {
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const [vendedorDetalle, setVendedorDetalle] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: "", variant: "success" });
  const [tipoVista, setTipoVista] = useState("tabla"); // "tabla" o "tarjetas"
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [ordenPor, setOrdenPor] = useState("apellido");
  const [ordenDir, setOrdenDir] = useState("asc");
  const [metricas, setMetricas] = useState({
    totalVendedores: 0,
    vendedoresActivos: 0,
    prospectosPorVendedor: []
  });
  const [vendedorMetricas, setVendedorMetricas] = useState(null);
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  
  // Estados para gestión de prospectos
  const [showProspectosModal, setShowProspectosModal] = useState(false);
  const [prospectosVendedor, setProspectosVendedor] = useState([]);
  const [selectedProspectos, setSelectedProspectos] = useState([]);
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [vendedorParaReasignar, setVendedorParaReasignar] = useState(null);
  const [nuevoVendedorId, setNuevoVendedorId] = useState("");
  const [loadingProspectos, setLoadingProspectos] = useState(false);

  // Estados para gestión de categorías
  const [categorias, setCategorias] = useState([]);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [vendedorParaCategoria, setVendedorParaCategoria] = useState(null);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState("");

  useEffect(() => {
    fetchVendedores();
    fetchMetricas();
    fetchCategorias();
  }, []);

  const fetchVendedores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/supervisor/vendedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setVendedores(response.data);
    } catch (error) {
      console.error("Error al obtener vendedores:", error);
      Swal.fire("Error", "No se pudieron cargar los usuarios vendedores.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricas = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/supervisor/metricas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMetricas({
        totalVendedores: response.data.prospectosPorVendedor.length,
        vendedoresActivos: response.data.prospectosPorVendedor.filter(v => v.total_prospectos > 0).length,
        prospectosPorVendedor: response.data.prospectosPorVendedor
      });
    } catch (error) {
      console.error("Error al obtener métricas:", error);
    }
  };

  const fetchVendedorMetricas = async (vendedorId) => {
    try {
      setLoadingMetricas(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/supervisor/vendedores/${vendedorId}/metricas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setVendedorMetricas(response.data);
    } catch (error) {
      console.error("Error al obtener métricas del vendedor:", error);
      Swal.fire("Error", "No se pudieron cargar las métricas del vendedor.", "error");
    } finally {
      setLoadingMetricas(false);
    }
  };

  const fetchProspectosVendedor = async (vendedorId) => {
    try {
      setLoadingProspectos(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/supervisor/vendedores/${vendedorId}/prospectos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProspectosVendedor(response.data);
      setSelectedProspectos([]);
    } catch (error) {
      console.error("Error al obtener prospectos del vendedor:", error);
      Swal.fire("Error", "No se pudieron cargar los prospectos del vendedor.", "error");
    } finally {
      setLoadingProspectos(false);
    }
  };

  const handleDisableVendedor = async (vendedorId) => {
    try {
      const result = await Swal.fire({
        title: '¿Deshabilitar vendedor?',
        text: 'El vendedor no podrá acceder al sistema pero mantendrá sus prospectos asignados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, deshabilitar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem("cober_token");
        await axios.put(`${API_URL}/supervisor/disable-vendedor/${vendedorId}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        setAlert({ 
          show: true, 
          message: "Vendedor deshabilitado correctamente.", 
          variant: "success" 
        });
        
        // Actualizar el vendedor en la lista local
        setVendedores(vendedores.map(v => 
          v.id === vendedorId ? {...v, is_enabled: 0} : v
        ));
        
        // Si el vendedor detalle está abierto y es el mismo que se deshabilitó
        if (vendedorDetalle && vendedorDetalle.id === vendedorId) {
          setVendedorDetalle({...vendedorDetalle, is_enabled: 0});
        }
      }
    } catch (error) {
      console.error("Error al deshabilitar vendedor:", error);
      setAlert({ 
        show: true, 
        message: "No se pudo deshabilitar el vendedor. " + (error.response?.data?.message || error.message), 
        variant: "danger" 
      });
    }
  };

  const handleDeleteVendedor = async (vendedor) => {
    try {
      // Primero verificar si tiene prospectos asignados
      await fetchProspectosVendedor(vendedor.id);
      
      if (prospectosVendedor.length > 0) {
        const result = await Swal.fire({
          title: 'Vendedor tiene prospectos asignados',
          text: `${vendedor.first_name} ${vendedor.last_name} tiene ${prospectosVendedor.length} prospectos asignados. Debe reasignarlos antes de eliminar.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#007bff',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Reasignar prospectos',
          cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
          setVendedorParaReasignar(vendedor);
          setShowProspectosModal(true);
        }
      } else {
        // No tiene prospectos, puede eliminar directamente
        const result = await Swal.fire({
          title: '¿Eliminar vendedor?',
          text: `Esta acción eliminará permanentemente a ${vendedor.first_name} ${vendedor.last_name}.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc3545',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
          await eliminarVendedor(vendedor.id);
        }
      }
    } catch (error) {
      console.error("Error al procesar eliminación:", error);
      setAlert({ 
        show: true, 
        message: "Error al procesar la eliminación del vendedor.", 
        variant: "danger" 
      });
    }
  };

  const eliminarVendedor = async (vendedorId) => {
    try {
      const token = localStorage.getItem("cober_token");
      await axios.delete(`${API_URL}/supervisor/vendedores/${vendedorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAlert({ 
        show: true, 
        message: "Vendedor eliminado correctamente.", 
        variant: "success" 
      });
      
      // Remover de la lista local
      setVendedores(vendedores.filter(v => v.id !== vendedorId));
      
      // Si el modal estaba abierto, cerrarlo
      if (vendedorDetalle && vendedorDetalle.id === vendedorId) {
        setVerDetalle(false);
        setVendedorDetalle(null);
      }
    } catch (error) {
      console.error("Error al eliminar vendedor:", error);
      setAlert({ 
        show: true, 
        message: "No se pudo eliminar el vendedor. " + (error.response?.data?.message || error.message), 
        variant: "danger" 
      });
    }
  };

  const handleReasignarProspectos = async () => {
    if (!nuevoVendedorId || selectedProspectos.length === 0) {
      setAlert({ 
        show: true, 
        message: "Debe seleccionar al menos un prospecto y un vendedor destino.", 
        variant: "warning" 
      });
      return;
    }

    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.post(`${API_URL}/supervisor/reasignar-prospectos`, {
        prospectos: selectedProspectos,
        nuevo_vendedor_id: nuevoVendedorId,
        vendedor_anterior_id: vendedorParaReasignar.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlert({ 
        show: true, 
        message: `${selectedProspectos.length} prospectos reasignados correctamente.`, 
        variant: "success" 
      });

      // Actualizar la lista de prospectos
      await fetchProspectosVendedor(vendedorParaReasignar.id);
      setSelectedProspectos([]);
      setShowReasignarModal(false);

      // Si ya no tiene prospectos, ofrecer eliminar
      if (prospectosVendedor.filter(p => !selectedProspectos.includes(p.id)).length === 0) {
        const result = await Swal.fire({
          title: 'Todos los prospectos reasignados',
          text: '¿Desea eliminar ahora el vendedor?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#dc3545',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'No, mantener'
        });

        if (result.isConfirmed) {
          setShowProspectosModal(false);
          await eliminarVendedor(vendedorParaReasignar.id);
        }
      }
    } catch (error) {
      console.error("Error al reasignar prospectos:", error);
      setAlert({ 
        show: true, 
        message: "Error al reasignar prospectos: " + (error.response?.data?.message || error.message), 
        variant: "danger" 
      });
    }
  };

  const handleSelectProspecto = (prospectoId) => {
    setSelectedProspectos(prev => {
      if (prev.includes(prospectoId)) {
        return prev.filter(id => id !== prospectoId);
      } else {
        return [...prev, prospectoId];
      }
    });
  };

  const handleSelectAllProspectos = () => {
    if (selectedProspectos.length === prospectosVendedor.length) {
      setSelectedProspectos([]);
    } else {
      setSelectedProspectos(prospectosVendedor.map(p => p.id));
    }
  };

  const handleVerProspectos = (vendedor) => {
    setVendedorParaReasignar(vendedor);
    fetchProspectosVendedor(vendedor.id);
    setShowProspectosModal(true);
  };

  const handleEnable = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      await axios.put(`${API_URL}/supervisor/enable-vendedor/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setAlert({ 
        show: true, 
        message: "Vendedor habilitado correctamente. Ya puede acceder al sistema.", 
        variant: "success" 
      });
      
      // Actualizar el vendedor en la lista local
      setVendedores(vendedores.map(v => 
        v.id === id ? {...v, is_enabled: 1} : v
      ));
      
      // Si el vendedor detalle está abierto y es el mismo que se habilitó
      if (vendedorDetalle && vendedorDetalle.id === id) {
        setVendedorDetalle({...vendedorDetalle, is_enabled: 1});
      }
      
    } catch (error) {
      console.error("Error al habilitar vendedor:", error);
      setAlert({ 
        show: true, 
        message: "No se pudo habilitar el vendedor. " + (error.response?.data?.message || error.message), 
        variant: "danger" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = (vendedor) => {
    setVendedorDetalle(vendedor);
    fetchVendedorMetricas(vendedor.id);
    setVerDetalle(true);
  };

  // Funciones para gestión de categorías
  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/categorias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategorias(response.data.filter(c => c.activa));
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    }
  };

  const handleCambiarCategoria = (vendedor) => {
    setVendedorParaCategoria(vendedor);
    setSelectedCategoriaId(vendedor.categoria_id || '');
    setShowCategoriaModal(true);
  };

  const handleAsignarCategoria = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("cober_token");
      await axios.put(`${API_URL}/admin/categorias/vendedor/${vendedorParaCategoria.id}/categoria`, 
        { categoriaId: selectedCategoriaId || null }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlert({
        show: true,
        message: "Categoría asignada correctamente",
        variant: "success"
      });
      
      setShowCategoriaModal(false);
      setVendedorParaCategoria(null);
      setSelectedCategoriaId('');
      fetchVendedores();
    } catch (error) {
      console.error("Error al asignar categoría:", error);
      setAlert({
        show: true,
        message: "Error al asignar la categoría: " + (error.response?.data?.message || error.message),
        variant: "danger"
      });
    }
  };

  const handleCloseAlert = () => setAlert({ ...alert, show: false });

  const handleOrdenar = (campo) => {
    if (campo === ordenPor) {
      setOrdenDir(ordenDir === "asc" ? "desc" : "asc");
    } else {
      setOrdenPor(campo);
      setOrdenDir("asc");
    }
  };

  // Icono para mostrar dirección de ordenamiento
  const getIconoOrden = (campo) => {
    if (ordenPor !== campo) return null;
    return ordenDir === "asc" ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />;
  };

  // Filtrar y ordenar vendedores
  const vendedoresFiltrados = vendedores
    .filter(vendedor => {
      const termino = busqueda.toLowerCase();
      const coincideBusqueda = 
        vendedor.first_name?.toLowerCase().includes(termino) ||
        vendedor.last_name?.toLowerCase().includes(termino) ||
        vendedor.email?.toLowerCase().includes(termino) ||
        (vendedor.phone_number && vendedor.phone_number.toLowerCase().includes(termino));
        
      const coincideEstado = filtroEstado === "" || 
        (filtroEstado === "habilitado" && vendedor.is_enabled) || 
        (filtroEstado === "deshabilitado" && !vendedor.is_enabled);
        
      return coincideBusqueda && coincideEstado;
    })
    .sort((a, b) => {
      let valorA, valorB;
      
      switch (ordenPor) {
        case "nombre":
          valorA = a.first_name?.toLowerCase() || "";
          valorB = b.first_name?.toLowerCase() || "";
          break;
        case "apellido":
          valorA = a.last_name?.toLowerCase() || "";
          valorB = b.last_name?.toLowerCase() || "";
          break;
        case "email":
          valorA = a.email?.toLowerCase() || "";
          valorB = b.email?.toLowerCase() || "";
          break;
        case "estado":
          valorA = a.is_enabled ? 1 : 0;
          valorB = b.is_enabled ? 1 : 0;
          break;
        default:
          valorA = a.id;
          valorB = b.id;
      }
      
      if (valorA < valorB) return ordenDir === "asc" ? -1 : 1;
      if (valorA > valorB) return ordenDir === "asc" ? 1 : -1;
      return 0;
    });

  // Renderizar ícono para el rol
  const getRoleBadge = (role) => {
    const roleInfo = ROLES.find(r => r.value === role);
    return (
      <Badge bg={roleInfo ? roleInfo.color : "secondary"}>
        {roleInfo ? roleInfo.label : "Desconocido"}
      </Badge>
    );
  };

  if (loading && vendedores.length === 0) {
    return (
      <div className="flex justify-center items-center" style={{ height: "50vh" }}>
        <Spinner animation="border" role="status">
          <span className="sr-only">Cargando...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Container fluid className="p-2 md:p-4 ">
      {alert.show && (
        <Alert variant={alert.variant} onClose={handleCloseAlert} dismissible>
          {alert.message}
        </Alert>
      )}

      {/* Header con título responsivo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6">
        <h2 className="tracking-tight mb-2 md:mb-0 text-2xl font-bold text-corporate">
          <FaUsers className="me-2" />
          <span className="hidden sm:inline">Gestión de </span>Vendedores
        </h2>
      </div>

      {/* Métricas responsivas */}
      {/* <Row className="g-2 g-md-3 mb-3 mb-md-4">
        <Col xs={12} sm={6} md={4}>
          <Card className="text-center h-100 shadow-sm border-0">
            <Card.Body className="py-3">
              <h3 className="mb-1 text-primary">{metricas.totalVendedores}</h3>
              <p className="mb-0 text-muted small">Total Vendedores</p>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card className="text-center h-100 shadow-sm border-0">
            <Card.Body className="py-3">
              <h3 className="mb-1 text-success">{metricas.vendedoresActivos}</h3>
              <p className="mb-0 text-muted small">Vendedores Activos</p>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={12} md={4}>
          <Card className="text-center h-100 shadow-sm border-0">
            <Card.Body className="py-3">
              <h3 className="mb-1 text-info">{vendedores.filter(u => u.is_enabled).length}</h3>
              <p className="mb-0 text-muted small">Vendedores Habilitados</p>
            </Card.Body>
          </Card>
        </Col>
      </Row> */}

      {/* Panel de filtros y controles responsivo */}
      <Card className="border-0 mb-4 md:mb-6 shadow-xs transition-shadow hover:shadow-md">
        <Card.Body className="py-4">
          <Row className="[--gx:0.5rem] [--gy:0.5rem] md:[--gx:1rem] md:[--gy:1rem] items-end">
            {/* Búsqueda */}
            <Col xs={12} md={6} lg={4}>
              <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Buscar vendedor</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Nombre, email..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </InputGroup>
            </Col>

            {/* Filtro por estado */}
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Estado</Form.Label>
              <Form.Select 
                size="sm"
                value={filtroEstado} 
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="habilitado">Habilitados</option>
                <option value="deshabilitado">Deshabilitados</option>
              </Form.Select>
            </Col>

            {/* Controles de vista */}
            <Col xs={6} md={3} lg={2}>
              <Form.Label className="text-[0.875em] text-muted-foreground mb-1 hidden md:block">Vista</Form.Label>
              <ButtonGroup size="sm" className="w-full">
                <Button 
                  variant={tipoVista === "tabla" ? "primary" : "outline-primary"} 
                  onClick={() => setTipoVista("tabla")}
                  className="hidden lg:inline-flex"
                  title="Vista tabla"
                >
                  <FaList />
                </Button>
                <Button 
                  variant={tipoVista === "tarjetas" ? "primary" : "outline-primary"} 
                  onClick={() => setTipoVista("tarjetas")}
                  title="Vista tarjetas"
                >
                  <FaThLarge />
                </Button>
              </ButtonGroup>
            </Col>

            {/* Botón actualizar */}
            <Col xs={12} lg={4} className="flex justify-end">
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => fetchVendedores()}
                disabled={loading}
                className="w-full lg:w-auto"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Actualizar'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Contenido principal responsivo */}
      {/* Vista de tabla - solo en desktop, dentro de contenedor blanco */}
      {tipoVista === "tabla" ? (
        <div className="bg-card rounded-md shadow-xs hidden lg:block">
          <div className="w-full overflow-x-auto">
            <Table hover className="mb-0">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left cursor-pointer" onClick={() => handleOrdenar("id")}>
                      ID {getIconoOrden("id")}
                    </th>
                    <th className="text-left cursor-pointer" onClick={() => handleOrdenar("nombre")}>
                      Nombre {getIconoOrden("nombre")}
                    </th>
                    <th className="text-left cursor-pointer" onClick={() => handleOrdenar("apellido")}>
                      Apellido {getIconoOrden("apellido")}
                    </th>
                    <th className="text-left cursor-pointer" onClick={() => handleOrdenar("email")}>
                      Email {getIconoOrden("email")}
                    </th>
                    <th className="text-left">Teléfono</th>
                    <th className="text-left">Categoría</th>
                    <th className="text-left">Prospectos</th>
                    <th className="text-left cursor-pointer" onClick={() => handleOrdenar("estado")}>
                      Estado {getIconoOrden("estado")}
                    </th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-6 text-muted-foreground">
                        <div className="py-4">
                          <FaUsers className="mb-2" size={32} opacity={0.5} />
                          <p className="mb-0">No hay vendedores que coincidan con los filtros aplicados.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    vendedoresFiltrados.map((vendedor) => (
                      <tr key={vendedor.id}>
                        <td className="font-bold text-primary">{vendedor.id}</td>
                        <td>{vendedor.first_name}</td>
                        <td>{vendedor.last_name}</td>
                        <td>
                          <div className="truncate" style={{ maxWidth: '200px' }}>
                            {vendedor.email}
                          </div>
                        </td>
                        <td>{vendedor.phone_number || "-"}</td>
                        <td>
                          {vendedor.categoria_nombre ? (
                            <Badge bg={vendedor.categoria_prioridad === 1 ? 'success' : vendedor.categoria_prioridad === 2 ? 'warning' : 'info'}>
                              {vendedor.categoria_nombre}
                            </Badge>
                          ) : (
                            <Badge bg="secondary">Sin asignar</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center">
                            <Badge bg="info">
                              {vendedor.total_prospectos || 0} prospectos
                            </Badge>
                          </div>
                        </td>
                        <td>
                          <Badge bg={vendedor.is_enabled ? "success" : "secondary"}>
                            {vendedor.is_enabled ? "Habilitado" : "Deshabilitado"}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="info" onClick={() => handleVerDetalle(vendedor)} title="Ver detalles">
                              <FaEye />
                            </Button>
                            
                            <Button size="sm" variant="primary" onClick={() => handleVerProspectos(vendedor)} title="Ver prospectos">
                              <FaUsers />
                            </Button>

                            <Button 
                              size="sm" 
                              variant="outline-secondary" 
                              onClick={() => handleCambiarCategoria(vendedor)}
                              title="Cambiar categoría"
                            >
                              <FaUserTag />
                            </Button>
                            
                            {vendedor.is_enabled ? (
                              <Button 
                                size="sm" 
                                variant="warning" 
                                onClick={() => handleDisableVendedor(vendedor.id)}
                                disabled={loading}
                                title="Deshabilitar vendedor"
                              >
                                <FaUserTimes />
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="success" 
                                onClick={() => handleEnable(vendedor.id)}
                                disabled={loading}
                                title="Habilitar vendedor"
                              >
                                <FaUserCheck />
                              </Button>
                            )}

                            <Button 
                              size="sm" 
                              variant="danger" 
                              onClick={() => handleDeleteVendedor(vendedor)}
                              disabled={loading}
                              title="Eliminar vendedor"
                            >
                              <FaTrash />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
            </Table>
          </div>
        </div>
      ) : null}

      {/* Vista de tarjetas (móvil, tablet y también desktop cuando se elige tarjetas) */}
      {tipoVista === "tarjetas" || tipoVista === "tabla" ? (
        <div className={tipoVista === "tabla" ? "lg:hidden p-4" : "p-4"}>
          <Row className="[--gx:1rem] [--gy:1rem] lg:[--gx:1.5rem] lg:[--gy:1.5rem] *:flex-none *:w-full sm:*:flex-none sm:*:w-1/2 md:*:flex-none md:*:w-1/3 lg:*:flex-none lg:*:w-1/3 xl:*:flex-none xl:*:w-1/4">
              {vendedoresFiltrados.length === 0 ? (
                <Col className="text-center py-12">
                  <FaUsers className="mb-4 text-muted-foreground" size={48} />
                  <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">No hay vendedores</h5>
                  <p className="mb-4 text-muted-foreground">No se encontraron vendedores que coincidan con los filtros aplicados.</p>
                </Col>
              ) : (
                vendedoresFiltrados.map((vendedor) => (
                  <Col key={vendedor.id}>
                    <Card className="h-full shadow-xs border-0 transition-shadow hover:shadow-md">
                      <Card.Header className="bg-muted border-0 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h6 className="text-base leading-tight tracking-tight text-corporate mb-1 font-bold truncate">
                              {vendedor.first_name} {vendedor.last_name}
                            </h6>
                            <small className="text-[0.875em] text-muted-foreground">ID: {vendedor.id}</small>
                          </div>
                          <Badge bg={vendedor.is_enabled ? "success" : "secondary"} className="ms-2">
                            {vendedor.is_enabled ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                      </Card.Header>
                      
                      <Card.Body className="py-4">
                        <div className="mb-4">
                          <div className="mb-2">
                            <small className="text-[0.875em] text-muted-foreground block">Email</small>
                            <div className="truncate text-[0.875em]">{vendedor.email}</div>
                          </div>
                          
                          <div className="mb-2">
                            <small className="text-[0.875em] text-muted-foreground block">Teléfono</small>
                            <div className="text-[0.875em]">{vendedor.phone_number || "No disponible"}</div>
                          </div>
                          
                          <div className="mb-2">
                            <small className="text-[0.875em] text-muted-foreground block">Categoría</small>
                            {vendedor.categoria_nombre ? (
                              <Badge bg={vendedor.categoria_prioridad === 1 ? 'success' : vendedor.categoria_prioridad === 2 ? 'warning' : 'info'}>
                                {vendedor.categoria_nombre}
                              </Badge>
                            ) : (
                              <Badge bg="secondary">Sin asignar</Badge>
                            )}
                          </div>
                          
                          <div>
                            <small className="text-[0.875em] text-muted-foreground block">Prospectos</small>
                            <Badge bg="info">
                              {vendedor.total_prospectos || 0} prospectos
                            </Badge>
                          </div>
                        </div>
                      </Card.Body>
                      
                      <Card.Footer className="bg-transparent border-0 pt-0">
                        <Row className="[--gx:0.25rem] [--gy:0.25rem]">
                          <Col xs={6}>
                            <Button 
                              size="sm" 
                              variant="info" 
                              className="w-full whitespace-nowrap" 
                              onClick={() => handleVerDetalle(vendedor)}
                              style={{ writingMode: 'horizontal-tb' }}
                            >
                              <FaEye className="me-1" />
                              <span className="hidden md:inline"> Ver</span>
                            </Button>
                          </Col>
                          <Col xs={6}>
                            <Button 
                              size="sm" 
                              variant="primary" 
                              className="w-full whitespace-nowrap" 
                              onClick={() => handleVerProspectos(vendedor)}
                              style={{ writingMode: 'horizontal-tb' }}
                            >
                              <FaUsers className="me-1" />
                              <span className="hidden md:inline"> Prospectos</span>
                              <span className="md:hidden"> Pros</span>
                            </Button>
                          </Col>
                          <Col xs={6}>
                            <Button 
                              size="sm" 
                              variant="outline-secondary" 
                              className="w-full whitespace-nowrap" 
                              onClick={() => handleCambiarCategoria(vendedor)}
                              style={{ writingMode: 'horizontal-tb' }}
                            >
                              <FaUserTag className="me-1" />
                              <span className="hidden md:inline"> Categoría</span>
                              <span className="md:hidden"> Cat.</span>
                            </Button>
                          </Col>
                          <Col xs={6}>
                            {vendedor.is_enabled ? (
                              <Button 
                                size="sm" 
                                variant="warning" 
                                className="w-full whitespace-nowrap" 
                                onClick={() => handleDisableVendedor(vendedor.id)}
                                disabled={loading}
                                style={{ writingMode: 'horizontal-tb' }}
                              >
                                <FaUserTimes className="me-1" /> <span className="hidden md:inline">Deshabilitar</span>
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="success" 
                                className="w-full whitespace-nowrap" 
                                onClick={() => handleEnable(vendedor.id)}
                                disabled={loading}
                                style={{ writingMode: 'horizontal-tb' }}
                              >
                                <FaUserCheck className="me-1" /> <span className="hidden md:inline">Habilitar</span>
                              </Button>
                            )}
                          </Col>
                          <Col xs={12}>
                            <Button 
                              size="sm" 
                              variant="outline-danger" 
                              className="w-full whitespace-nowrap" 
                              onClick={() => handleDeleteVendedor(vendedor)}
                              disabled={loading}
                              style={{ writingMode: 'horizontal-tb' }}
                            >
                              <FaTrash className="me-1" /> Eliminar
                            </Button>
                          </Col>
                        </Row>
                      </Card.Footer>
                    </Card>
                  </Col>
                ))
              )}
          </Row>
        </div>
      ) : null}

      {/* Modal de Detalle de Usuario */}
      <Modal show={verDetalle} onHide={() => setVerDetalle(false)} centered size="lg" className="">
        <Modal.Header closeButton>
          <Modal.Title className="text-[1.125rem] font-bold leading-snug text-corporate">
            <FaUsers className="me-2" />
            Detalle del Vendedor
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {vendedorDetalle && (
            <Row className="[--gx:1rem] [--gy:1rem]">
              <Col xs={12} md={6}>
                <div className="flex flex-col gap-2">
                  <div>
                    <strong className="text-muted-foreground">ID:</strong>
                    <div className="text-base">{vendedorDetalle.id}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Nombre completo:</strong>
                    <div className="text-base">{vendedorDetalle.first_name} {vendedorDetalle.last_name}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Email:</strong>
                    <div className="text-base break-words">{vendedorDetalle.email}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Teléfono:</strong>
                    <div className="text-base">{vendedorDetalle.phone_number || "No disponible"}</div>
                  </div>
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div className="flex flex-col gap-2">
                  <div>
                    <strong className="text-muted-foreground">Estado:</strong>
                    <div className="mt-1">
                      <Badge bg={vendedorDetalle.is_enabled ? "success" : "secondary"}>
                        {vendedorDetalle.is_enabled ? "Habilitado" : "Deshabilitado"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Prospectos asignados:</strong>
                    <div className="text-base">{vendedorDetalle.total_prospectos || 0}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Conversiones:</strong>
                    <div className="text-base">{vendedorDetalle.conversiones || 0}</div>
                  </div>
                  {vendedorDetalle.created_at && (
                    <div>
                      <strong className="text-muted-foreground">Fecha de creación:</strong>
                      <div className="text-[0.875em]">{new Date(vendedorDetalle.created_at).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer className="flex-col md:flex-row gap-2">
          <Button variant="secondary" onClick={() => setVerDetalle(false)} className="w-full md:w-auto">
            Cerrar
          </Button>
          
          <Button variant="primary" onClick={() => handleVerProspectos(vendedorDetalle)} className="w-full md:w-auto">
            <FaUsers className="me-1" /> Ver Prospectos
          </Button>
          
          {/* Botones para habilitar/deshabilitar y eliminar vendedor */}
          {vendedorDetalle && vendedorDetalle.is_enabled ? (
            <Button 
              variant="warning" 
              onClick={() => {
                handleDisableVendedor(vendedorDetalle.id);
                setVerDetalle(false);
              }}
              disabled={loading}
              className="w-full md:w-auto"
            >
              <FaUserTimes className="me-1" /> Deshabilitar
            </Button>
          ) : (
            <Button 
              variant="success" 
              onClick={() => {
                handleEnable(vendedorDetalle.id);
                setVerDetalle(false);
              }}
              disabled={loading}
              className="w-full md:w-auto"
            >
              <FaUserCheck className="me-1" /> Habilitar
            </Button>
          )}

          <Button 
            variant="danger" 
            onClick={() => {
              setVerDetalle(false);
              handleDeleteVendedor(vendedorDetalle);
            }}
            disabled={loading}
            className="w-full md:w-auto"
          >
            <FaTrash className="me-1" /> Eliminar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para ver y gestionar prospectos */}
      <Modal show={showProspectosModal} onHide={() => setShowProspectosModal(false)} centered size="xl" className="">
        <Modal.Header closeButton>
          <Modal.Title className="text-[1.125rem] font-bold leading-snug text-corporate">
            <FaUsers className="me-2" />
            Prospectos de {vendedorParaReasignar?.first_name} {vendedorParaReasignar?.last_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingProspectos ? (
            <div className="text-center py-6">
              <Spinner animation="border" />
              <div className="mt-2">Cargando prospectos...</div>
            </div>
          ) : prospectosVendedor.length === 0 ? (
            <div className="text-center py-6">
              <FaUsers className="mb-4 text-muted-foreground" size={48} />
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">Sin prospectos</h5>
              <p className="mb-4 text-muted-foreground">Este vendedor no tiene prospectos asignados.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <Row className="items-center">
                  <Col xs={12} md={6}>
                    <div>
                      <strong>Total: {prospectosVendedor.length} prospectos</strong>
                      {selectedProspectos.length > 0 && (
                        <div className="text-primary mt-1">
                          <small className="text-[0.875em]">({selectedProspectos.length} seleccionados)</small>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col xs={12} md={6} className="mt-2 md:mt-0">
                    <div className="flex flex-col md:flex-row gap-2 md:justify-end">
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        onClick={handleSelectAllProspectos}
                        className="w-full md:w-auto"
                      >
                        {selectedProspectos.length === prospectosVendedor.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </Button>
                      {selectedProspectos.length > 0 && (
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => setShowReasignarModal(true)}
                          className="w-full md:w-auto"
                        >
                          <FaExchangeAlt className="me-1" />
                          Reasignar ({selectedProspectos.length})
                        </Button>
                      )}
                    </div>
                  </Col>
                </Row>
              </div>

              <div className="w-full overflow-x-auto">
                <Table striped hover className="mb-0">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left" style={{width: '40px'}}>
                        <Form.Check 
                          type="checkbox"
                          checked={selectedProspectos.length === prospectosVendedor.length && prospectosVendedor.length > 0}
                          onChange={handleSelectAllProspectos}
                        />
                      </th>
                      <th className="text-left">ID</th>
                      <th className="text-left">Nombre</th>
                      <th className="text-left hidden md:table-cell">Contacto</th>
                      <th className="text-left">Estado</th>
                      <th className="text-left hidden md:table-cell">Origen</th>
                      <th className="text-left hidden lg:table-cell">Fecha Asignación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospectosVendedor.map((prospecto) => (
                      <tr key={prospecto.id}>
                        <td>
                          <Form.Check 
                            type="checkbox"
                            checked={selectedProspectos.includes(prospecto.id)}
                            onChange={() => handleSelectProspecto(prospecto.id)}
                          />
                        </td>
                        <td className="font-bold text-primary">{prospecto.id}</td>
                        <td>
                          <div>{prospecto.nombre} {prospecto.apellido}</div>
                          <div className="md:hidden">
                            <small className="text-[0.875em] text-muted-foreground">{prospecto.numero_contacto}</small>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <div>{prospecto.numero_contacto}</div>
                          <small className="text-[0.875em] text-muted-foreground">{prospecto.correo}</small>
                        </td>
                        <td>
                          {(() => {
                            const cfg = getEstadoConfig(prospecto.asignacion_estado || prospecto.estado, prospecto.asignacion_comentario);
                            return <Badge bg={cfg.color ? null : cfg.bg} className="text-[0.875em]" style={cfg.color ? { backgroundColor: cfg.color, color: cfg.textColor || '#fff' } : undefined}>{cfg.text}</Badge>;
                          })()}
                        </td>
                        <td className="hidden md:table-cell">
                          {prospecto.origen === 'Refrito - Campaña' && (
                            <Badge bg="warning" text="dark" className="flex items-center gap-1" style={{width:'fit-content'}}>
                              <FaRecycle size={10} /> Refrito
                            </Badge>
                          )}
                          {prospecto.origen === 'Formulario Web' && (
                            <Badge bg="success" className="flex items-center gap-1" style={{width:'fit-content'}}>
                              <FaGlobe size={10} /> Web
                            </Badge>
                          )}
                          {prospecto.origen === 'Vendedor-App' && (
                            <Badge bg="info" className="flex items-center gap-1" style={{width:'fit-content'}}>
                              <FaMobileAlt size={10} /> App
                            </Badge>
                          )}
                          {!prospecto.origen && <span className="text-muted-foreground text-[0.875em]">—</span>}
                        </td>
                        <td className="hidden lg:table-cell">
                          <small className="text-[0.875em]">
                            {prospecto.fecha_asignacion 
                              ? new Date(prospecto.fecha_asignacion).toLocaleDateString()
                              : 'No disponible'
                            }
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="flex-col md:flex-row gap-2">
          <Button variant="secondary" onClick={() => setShowProspectosModal(false)} className="w-full md:w-auto">
            Cerrar
          </Button>
          {prospectosVendedor.length > 0 && (
            <Button 
              variant="primary"
              onClick={() => setShowReasignarModal(true)}
              disabled={selectedProspectos.length === 0}
              className="w-full md:w-auto"
            >
              <FaExchangeAlt className="me-1" />
              Reasignar seleccionados ({selectedProspectos.length})
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Modal para reasignar prospectos */}
      <Modal show={showReasignarModal} onHide={() => setShowReasignarModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reasignar Prospectos</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-4">
            Reasignar <strong>{selectedProspectos.length}</strong> prospectos de{' '}
            <strong>{vendedorParaReasignar?.first_name} {vendedorParaReasignar?.last_name}</strong> a:
          </p>

          {/* Alertas de origen para los prospectos seleccionados */}
          {(() => {
            const seleccionados = prospectosVendedor.filter(p => selectedProspectos.includes(p.id));
            const tieneRefritos = seleccionados.some(p => p.origen === 'Refrito - Campaña');
            const tieneApp = seleccionados.some(p => p.origen === 'Vendedor-App');
            return (
              <>
                {tieneRefritos && (
                  <div className="relative rounded-md border px-4 py-3 border-warning/30 bg-warning-soft text-foreground text-[0.875em] mb-4">
                    <FaRecycle className="me-1" />
                    <strong>¡Atención!</strong> Hay prospectos <strong>reciclados (Refrito - Campaña)</strong> en la selección. Reasignarlos puede alterar la distribución de refritos. Asegurate de que corresponde.
                  </div>
                )}
                {tieneApp && (
                  <div className="relative rounded-md border px-4 py-3 border-primary/15 bg-accent/70 text-foreground text-[0.875em] mb-4">
                    <FaMobileAlt className="me-1" />
                    <strong>Info:</strong> Hay prospectos creados por <strong>vendedor desde la App</strong> en la selección.
                  </div>
                )}
                {!tieneRefritos && !tieneApp && (
                  <div className="relative rounded-md px-4 py-3 border-border bg-card text-foreground border text-[0.875em] mb-4">
                    <FaInfoCircle className="me-1 text-muted-foreground" />
                    Todos los prospectos seleccionados son de <strong>Formulario Web</strong>.
                  </div>
                )}
              </>
            );
          })()}
          
          <Form.Group className="mb-4">
            <Form.Label>Seleccionar nuevo vendedor:</Form.Label>
            <Form.Select 
              value={nuevoVendedorId} 
              onChange={(e) => setNuevoVendedorId(e.target.value)}
            >
              <option value="">Seleccionar vendedor...</option>
              {vendedores
                .filter(v => v.id !== vendedorParaReasignar?.id && v.is_enabled)
                .map(vendedor => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.first_name} {vendedor.last_name}
                  </option>
                ))
              }
            </Form.Select>
          </Form.Group>

          {selectedProspectos.length > 0 && (
            <div className="bg-muted p-4 rounded-md">
              <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Prospectos seleccionados:</h6>
              <ul className="list-disc pl-8 mb-0" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {prospectosVendedor
                  .filter(p => selectedProspectos.includes(p.id))
                  .map(prospecto => (
                    <li key={prospecto.id} className="flex items-center gap-2 mb-1">
                      {prospecto.nombre} {prospecto.apellido} (ID: {prospecto.id})
                      {prospecto.origen === 'Refrito - Campaña' && <Badge bg="warning" text="dark" className="ms-1"><FaRecycle size={9} /> Refrito</Badge>}
                      {prospecto.origen === 'Vendedor-App' && <Badge bg="info" className="ms-1"><FaMobileAlt size={9} /> App</Badge>}
                    </li>
                  ))
                }
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReasignarModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleReasignarProspectos}
            disabled={!nuevoVendedorId}
          >
            <FaExchangeAlt className="me-1" />
            Reasignar prospectos
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para cambiar categoría */}
      <Modal show={showCategoriaModal} onHide={() => setShowCategoriaModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaUserTag className="me-2" />
            Cambiar Categoría de Vendedor
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAsignarCategoria}>
          <Modal.Body>
            {vendedorParaCategoria && (
              <>
                <div className="mb-4">
                  <strong>Vendedor:</strong> {vendedorParaCategoria.first_name} {vendedorParaCategoria.last_name}
                </div>
                
                <div className="mb-4">
                  <strong>Categoría actual:</strong>{' '}
                  {vendedorParaCategoria.categoria_nombre ? (
                    <Badge bg={vendedorParaCategoria.categoria_prioridad === 1 ? 'success' : vendedorParaCategoria.categoria_prioridad === 2 ? 'warning' : 'info'}>
                      {vendedorParaCategoria.categoria_nombre}
                    </Badge>
                  ) : (
                    <Badge bg="secondary">Sin asignar</Badge>
                  )}
                </div>

                <div className="mb-4">
                  <strong>Carga actual:</strong> {vendedorParaCategoria.total_prospectos} prospectos
                </div>

                <Form.Group className="mb-4">
                  <Form.Label>Nueva Categoría</Form.Label>
                  <Form.Select
                    value={selectedCategoriaId}
                    onChange={(e) => setSelectedCategoriaId(e.target.value)}
                  >
                    <option value="">Sin categoría asignada</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre} (Cap: {categoria.capacidad_maxima}, Prioridad: {categoria.prioridad})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted-foreground">
                    La categoría determina la capacidad máxima y prioridad en la distribución de prospectos.
                  </Form.Text>
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCategoriaModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              <FaUserTag className="me-1" />
              Cambiar Categoría
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default VendedoresSupervisor;