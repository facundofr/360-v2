import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";
import { useNavigate } from 'react-router-dom';
import { getEstadoConfig } from '../../utils/estadosHelper';
import { 
  Container, Row, Col, Table, Button, Form, Badge, 
  Card, Modal, Alert, ButtonGroup, Spinner, InputGroup, ProgressBar
} from "@/components/compat/bootstrap";
import { 
  FaEdit, FaTrash, FaEye, FaSearch, FaList, FaThLarge, FaSort, FaSortUp, FaSortDown, 
  FaUserPlus, FaChevronUp, FaChevronDown, FaUserCheck, FaUserTimes, FaExchangeAlt, 
  FaUsers, FaUserTag, FaCog, FaToggleOn, FaToggleOff, FaUserTie, FaFilter, 
  FaDownload, FaArrowLeft, FaRecycle, FaGlobe, FaMobile
} from "@/lib/icons";

const ROLES = [
  { value: 1, label: "Vendedor", color: "primary" },
  { value: 2, label: "Supervisor", color: "success" }
];

const VendedoresBackOffice = () => {
  const [vendedores, setVendedores] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const [vendedorDetalle, setVendedorDetalle] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: "", variant: "success" });
  const [tipoVista, setTipoVista] = useState("tabla");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroSupervisor, setFiltroSupervisor] = useState("");
  const [ordenPor, setOrdenPor] = useState("apellido");
  const [ordenDir, setOrdenDir] = useState("asc");
  const [metricas, setMetricas] = useState({
    totalVendedores: 0,
    vendedoresActivos: 0,
    vendedoresSinSupervisor: 0,
    supervisioresActivos: 0
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

  // Estados para asignación de supervisor
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [vendedorParaSupervisor, setVendedorParaSupervisor] = useState(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchVendedores();
    fetchSupervisores();
    fetchMetricas();
    fetchCategorias();
  }, []);

  const fetchVendedores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/backoffice/vendedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setVendedores(response.data.data || response.data);
    } catch (error) {
      console.error("Error al obtener vendedores:", error);
      Swal.fire("Error", "No se pudieron cargar los vendedores.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSupervisores = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/backoffice/supervisores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSupervisores(response.data.data || response.data);
    } catch (error) {
      console.error("Error al obtener supervisores:", error);
    }
  };

  const fetchMetricas = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/backoffice/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const stats = response.data.data.generales;
      setMetricas({
        totalVendedores: stats.vendedores_activos + stats.vendedores_sin_supervisor,
        vendedoresActivos: stats.vendedores_activos,
        vendedoresSinSupervisor: stats.vendedores_sin_supervisor,
        supervisioresActivos: stats.supervisores_activos
      });
    } catch (error) {
      console.error("Error al obtener métricas:", error);
    }
  };

  const fetchVendedorMetricas = async (vendedorId) => {
    try {
      setLoadingMetricas(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/backoffice/vendedores/${vendedorId}/metricas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setVendedorMetricas(response.data.data || response.data);
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
      const response = await axios.get(`${API_URL}/backoffice/vendedores/${vendedorId}/prospectos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProspectosVendedor(response.data.data || response.data);
      setSelectedProspectos([]);
    } catch (error) {
      console.error("Error al obtener prospectos del vendedor:", error);
      Swal.fire("Error", "No se pudieron cargar los prospectos del vendedor.", "error");
    } finally {
      setLoadingProspectos(false);
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
        const token = localStorage.getItem("cober_token");
        await axios.patch(`${API_URL}/backoffice/vendedores/${vendedorId}/toggle-status`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        Swal.fire({
          icon: 'success',
          title: 'Estado Actualizado',
          text: `El vendedor ha sido ${currentStatus ? 'deshabilitado' : 'habilitado'} correctamente`
        });

        // Actualizar el vendedor en la lista local
        setVendedores(vendedores.map(v => 
          v.id === vendedorId ? {...v, is_enabled: !currentStatus} : v
        ));

        // Si el vendedor detalle está abierto y es el mismo que se modificó
        if (vendedorDetalle && vendedorDetalle.id === vendedorId) {
          setVendedorDetalle({...vendedorDetalle, is_enabled: !currentStatus});
        }

        fetchMetricas(); // Actualizar métricas
      } catch (error) {
        console.error("Error al cambiar estado del vendedor:", error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cambiar el estado del vendedor'
        });
      }
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
      await axios.delete(`${API_URL}/backoffice/vendedores/${vendedorId}`, {
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

      fetchMetricas(); // Actualizar métricas
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
      const response = await axios.post(`${API_URL}/backoffice/reasignar-prospectos`, {
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

  // Funciones para gestión de supervisores
  const handleCambiarSupervisor = (vendedor) => {
    setVendedorParaSupervisor(vendedor);
    setSelectedSupervisorId(vendedor.supervisor_id || '');
    setShowSupervisorModal(true);
  };

  const handleAsignarSupervisor = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("cober_token");
      await axios.post(`${API_URL}/backoffice/vendedores/asignar`, {
        vendedorId: vendedorParaSupervisor.id,
        supervisorId: selectedSupervisorId || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlert({
        show: true,
        message: "Supervisor asignado correctamente",
        variant: "success"
      });
      
      setShowSupervisorModal(false);
      setVendedorParaSupervisor(null);
      setSelectedSupervisorId('');
      fetchVendedores();
      fetchMetricas();
    } catch (error) {
      console.error("Error al asignar supervisor:", error);
      setAlert({
        show: true,
        message: "Error al asignar el supervisor: " + (error.response?.data?.message || error.message),
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

      const coincideSupervisor = filtroSupervisor === "" ||
        (filtroSupervisor === "sin-supervisor" && !vendedor.supervisor_id) ||
        (filtroSupervisor === "con-supervisor" && vendedor.supervisor_id) ||
        vendedor.supervisor_id?.toString() === filtroSupervisor;
        
      return coincideBusqueda && coincideEstado && coincideSupervisor;
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

  const getSupervisorName = (supervisorId) => {
    const supervisor = supervisores.find(s => s.id === supervisorId);
    return supervisor ? `${supervisor.first_name} ${supervisor.last_name}` : 'Sin asignar';
  };

  // Usa configuración de estados común (helper compartido)

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
    <Container fluid className="py-6">
      {alert.show && (
        <Alert variant={alert.variant} onClose={handleCloseAlert} dismissible>
          {alert.message}
        </Alert>
      )}

      {/* Header */}
      <Row className="mb-6">
        <Col>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-corporate mb-1">
                <FaUsers className="me-2 text-primary" />
                Gestión de Vendedores
              </h2>
              <p className="text-muted-foreground mb-0">Administra vendedores, categorías y asignaciones</p>
            </div>
            <Button 
              variant="primary"
              onClick={() => navigate('/backoffice/dashboard')}
            >
              <FaArrowLeft className="me-2" />
              Volver al Dashboard
            </Button>
          </div>
        </Col>
      </Row>

      {/* Métricas */}
      <Row className="mb-6">
        <Col md={3}>
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-primary">{metricas.totalVendedores}</h4>
              <small className="text-[0.875em] text-muted-foreground">Total Vendedores</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-success">{metricas.vendedoresActivos}</h4>
              <small className="text-[0.875em] text-muted-foreground">Vendedores Activos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-warning">{metricas.vendedoresSinSupervisor}</h4>
              <small className="text-[0.875em] text-muted-foreground">Sin Supervisor</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-xs">
            <Card.Body className="text-center">
              <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-info">{metricas.supervisioresActivos}</h4>
              <small className="text-[0.875em] text-muted-foreground">Supervisores Activos</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtros (UX/UI) debajo de las métricas */}
      <Card className="shadow-xs border-0 mb-6">
        <Card.Body>
          <Row className="[--gx:1rem] [--gy:1rem] items-end">
            {/* Búsqueda */}
            <Col xs={12} lg={6}>
              <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Buscar vendedor</Form.Label>
              <InputGroup size="sm">
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Nombre, email o teléfono"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </InputGroup>
            </Col>

            {/* Filtro por estado */}
            <Col xs={6} lg={3}>
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

            {/* Filtro por supervisor */}
            <Col xs={6} lg={3}>
              <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Supervisor</Form.Label>
              <Form.Select 
                size="sm"
                value={filtroSupervisor} 
                onChange={(e) => setFiltroSupervisor(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="sin-supervisor">Sin supervisor</option>
                <option value="con-supervisor">Con supervisor</option>
                {supervisores.map(supervisor => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.first_name} {supervisor.last_name}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          <Row className="[--gx:0.5rem] [--gy:0.5rem] mt-4">
            <Col className="flex justify-end gap-2">
              <Button 
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setBusqueda("");
                  setFiltroEstado("");
                  setFiltroSupervisor("");
                }}
              >
                Limpiar filtros
              </Button>
          
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabla de vendedores */}
      <Row>
        <Col>
          <Card className="border-0 shadow-xs">
            <Card.Header className="bg-card">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">Lista de Vendedores</h5>
            </Card.Header>
            <Card.Body>
              {vendedoresFiltrados.length === 0 ? (
                <Alert variant="info">
                  No se encontraron vendedores que coincidan con la búsqueda.
                </Alert>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("id")}>
                        ID {getIconoOrden("id")}
                      </th>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("nombre")}>
                        Vendedor {getIconoOrden("nombre")}
                      </th>
                      <th className="text-left">Supervisor</th>
                      <th className="text-left">Categoría</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Prospectos</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedoresFiltrados.map((vendedor) => (
                      <tr key={vendedor.id}>
                        <td className="font-bold text-primary">{vendedor.id}</td>
                        <td>
                          <div>
                            <strong>{vendedor.first_name} {vendedor.last_name}</strong>
                            <br />
                            <small className="text-[0.875em] text-muted-foreground">{vendedor.email}</small>
                          </div>
                        </td>
                        <td>
                          {vendedor.supervisor_id ? (
                            <div>
                              <strong>{getSupervisorName(vendedor.supervisor_id)}</strong>
                              <br />
                              <Badge bg="info" size="sm">Con supervisor</Badge>
                            </div>
                          ) : (
                            <Badge bg="warning">Sin supervisor</Badge>
                          )}
                        </td>
                        <td>
                          {vendedor.categoria_nombre ? (
                            <Badge bg={vendedor.categoria_prioridad === 1 ? 'success' : vendedor.categoria_prioridad === 2 ? 'warning' : 'info'}>
                              {vendedor.categoria_nombre}
                            </Badge>
                          ) : (
                            <Badge bg="secondary">Sin asignar</Badge>
                          )}
                        </td>
                        <td className="text-center">
                          <Badge bg={vendedor.is_enabled ? "success" : "secondary"}>
                            {vendedor.is_enabled ? "Habilitado" : "Deshabilitado"}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center">
                            <Badge bg="info">
                              {vendedor.total_prospectos || 0} prospectos
                            </Badge>
                          </div>
                        </td>
                        <td className="text-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-1"
                            onClick={() => handleVerDetalle(vendedor)}
                            title="Ver detalles"
                          >
                            <FaEye />
                          </Button>
                          <Button
                            variant="outline-info"
                            size="sm"
                            className="me-1"
                            onClick={() => handleVerProspectos(vendedor)}
                            title="Ver prospectos"
                          >
                            <FaUsers />
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="me-1"
                            onClick={() => handleCambiarSupervisor(vendedor)}
                            title="Asignar supervisor"
                          >
                            <FaUserTie />
                          </Button>
                          <Button
                            variant="outline-warning"
                            size="sm"
                            className="me-1"
                            onClick={() => handleCambiarCategoria(vendedor)}
                            title="Cambiar categoría"
                          >
                            <FaUserTag />
                          </Button>
                          <Button
                            variant={vendedor.is_enabled ? "outline-danger" : "outline-success"}
                            size="sm"
                            className="me-1"
                            onClick={() => handleToggleVendedorStatus(
                              vendedor.id, 
                              vendedor.is_enabled, 
                              `${vendedor.first_name} ${vendedor.last_name}`
                            )}
                            title={vendedor.is_enabled ? "Deshabilitar vendedor" : "Habilitar vendedor"}
                          >
                            {vendedor.is_enabled ? <FaToggleOff /> : <FaToggleOn />}
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteVendedor(vendedor)}
                            title="Eliminar vendedor"
                          >
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal de Detalle de Vendedor */}
      <Modal show={verDetalle} onHide={() => setVerDetalle(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaUsers className="me-2" />
            Detalle del Vendedor
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {vendedorDetalle && (
            <Row>
              <Col md={6}>
                <div className="flex flex-col gap-2">
                  <div>
                    <strong className="text-muted-foreground">ID:</strong>
                    <div>{vendedorDetalle.id}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Nombre completo:</strong>
                    <div>{vendedorDetalle.first_name} {vendedorDetalle.last_name}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Email:</strong>
                    <div className="break-words">{vendedorDetalle.email}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Teléfono:</strong>
                    <div>{vendedorDetalle.phone_number || "No disponible"}</div>
                  </div>
                </div>
              </Col>
              <Col md={6}>
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
                    <strong className="text-muted-foreground">Supervisor:</strong>
                    <div>{getSupervisorName(vendedorDetalle.supervisor_id)}</div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Categoría:</strong>
                    <div>
                      {vendedorDetalle.categoria_nombre ? (
                        <Badge bg={vendedorDetalle.categoria_prioridad === 1 ? 'success' : vendedorDetalle.categoria_prioridad === 2 ? 'warning' : 'info'}>
                          {vendedorDetalle.categoria_nombre}
                        </Badge>
                      ) : (
                        <Badge bg="secondary">Sin asignar</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <strong className="text-muted-foreground">Prospectos asignados:</strong>
                    <div>{vendedorDetalle.total_prospectos || 0}</div>
                  </div>
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setVerDetalle(false)}>
            Cerrar
          </Button>
          <Button variant="primary" onClick={() => handleVerProspectos(vendedorDetalle)}>
            <FaUsers className="me-1" /> Ver Prospectos
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para ver y gestionar prospectos */}
      <Modal show={showProspectosModal} onHide={() => setShowProspectosModal(false)} centered size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
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
                  <Col md={6}>
                    <div>
                      <strong>Total: {prospectosVendedor.length} prospectos</strong>
                      {selectedProspectos.length > 0 && (
                        <div className="text-primary mt-1">
                          <small className="text-[0.875em]">({selectedProspectos.length} seleccionados)</small>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col md={6} className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        onClick={handleSelectAllProspectos}
                      >
                        {selectedProspectos.length === prospectosVendedor.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </Button>
                      {selectedProspectos.length > 0 && (
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => setShowReasignarModal(true)}
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
                <Table striped hover>
                  <thead>
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
                      <th className="text-left">Contacto</th>
                      <th className="text-left">Origen</th>
                      <th className="text-left">Estado</th>
                      <th className="text-left">Fecha Asignación</th>
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
                        <td>{prospecto.nombre} {prospecto.apellido}</td>
                        <td>
                          <div>{prospecto.numero_contacto}</div>
                          <small className="text-[0.875em] text-muted-foreground">{prospecto.correo}</small>
                        </td>
                        <td>
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
                              <FaMobile size={10} /> App
                            </Badge>
                          )}
                          {!prospecto.origen && (
                            <span className="text-muted-foreground text-[0.875em]">—</span>
                          )}
                        </td>
                        <td>
                          {(() => { const cfg = getEstadoConfig(prospecto.estado, prospecto.comentario); return <Badge bg={cfg.color ? null : cfg.bg} style={cfg.color ? { backgroundColor: cfg.color, color: cfg.textColor || '#fff' } : undefined}>{cfg.text}</Badge>; })()}
                        </td>
                        <td>
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
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProspectosModal(false)}>
            Cerrar
          </Button>
          {prospectosVendedor.length > 0 && (
            <Button 
              variant="primary"
              onClick={() => setShowReasignarModal(true)}
              disabled={selectedProspectos.length === 0}
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
                    {vendedor.first_name} {vendedor.last_name} ({vendedor.total_prospectos || 0} prospectos)
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
                    <li key={prospecto.id}>
                      {prospecto.nombre} {prospecto.apellido} (ID: {prospecto.id})
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

      {/* Modal para asignar supervisor */}
      <Modal show={showSupervisorModal} onHide={() => setShowSupervisorModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaUserTie className="me-2" />
            Asignar Supervisor
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAsignarSupervisor}>
          <Modal.Body>
            {vendedorParaSupervisor && (
              <>
                <div className="mb-4">
                  <strong>Vendedor:</strong> {vendedorParaSupervisor.first_name} {vendedorParaSupervisor.last_name}
                </div>
                
                <div className="mb-4">
                  <strong>Supervisor actual:</strong>{' '}
                  {vendedorParaSupervisor.supervisor_id ? (
                    <Badge bg="info">{getSupervisorName(vendedorParaSupervisor.supervisor_id)}</Badge>
                  ) : (
                    <Badge bg="warning">Sin supervisor</Badge>
                  )}
                </div>

                <Form.Group className="mb-4">
                  <Form.Label>Nuevo Supervisor</Form.Label>
                  <Form.Select
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  >
                    <option value="">-- Quitar Supervisor (Sin asignar) --</option>
                    {supervisores.filter(s => s.is_enabled).map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.first_name} {supervisor.last_name} ({supervisor.total_vendedores || 0} vendedores)
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSupervisorModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              <FaUserTie className="me-1" />
              {selectedSupervisorId ? 'Asignar Supervisor' : 'Quitar Supervisor'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default VendedoresBackOffice;
