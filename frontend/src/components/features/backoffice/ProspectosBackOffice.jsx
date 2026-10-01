import React, { useState, useEffect } from 'react';
import { getEstadoConfig, formatEdad } from '../../utils/estadosHelper';
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  Button,
  Form,
  InputGroup,
  Modal,
  Alert,
  Spinner,
  Dropdown,
  OverlayTrigger,
  Tooltip,
  Pagination
} from '@/components/compat/bootstrap';
import {
  FaSearch,
  FaFilter,
  FaUsers,
  FaUserTie,
  FaFileAlt,
  FaShieldAlt,
  FaEdit,
  FaExchangeAlt,
  FaDownload,
  FaWhatsapp,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaChartLine,
  FaCog,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaClipboard,
  FaHistory,
  FaMoneyBillWave,
  FaComment,
  FaFile,
  FaUser,
  FaArrowUp,
  FaArrowDown,
  FaComments,
  FaEye,
  FaRecycle,
  FaGlobe,
  FaMobile
} from '@/lib/icons';
import axios from 'axios';
import { API_URL } from '../../config';

const ProspectosBackOffice = () => {
  // Estados principales
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados: Historial y cotizaciones (clon Admin)
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [showCotizacionesModal, setShowCotizacionesModal] = useState(false);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [showDetallesCotizacion, setShowDetallesCotizacion] = useState({});

  // Estados: Cambio de estado (clon Admin)
  const [showModalCambioEstado, setShowModalCambioEstado] = useState(false);
  const [prospectoParaCambioEstado, setProspectoParaCambioEstado] = useState(null);
  const [editValues, setEditValues] = useState({});

  // Estados: WhatsApp (clon Admin)
  const [modalConversaciones, setModalConversaciones] = useState(false);
  const [prospectoConversaciones, setProspectoConversaciones] = useState(null);
  const [conversacionesProspecto, setConversacionesProspecto] = useState([]);
  const [conversacionSeleccionada, setConversacionSeleccionada] = useState(null);
  const [mensajesConversacion, setMensajesConversacion] = useState([]);
  const [loadingConversaciones, setLoadingConversaciones] = useState(false);
  const [loadingMensajes, setLoadingMensajes] = useState(false);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Estados de filtros
  const [filtros, setFiltros] = useState({
    id: '',
    search: '',
    estado: '',
    vendedor_id: '',
    supervisor_id: '',
    fecha_desde: '',
    fecha_hasta: ''
  });

  // Estados de opciones para filtros
  const [opcionesFiltros, setOpcionesFiltros] = useState({
    vendedores: [],
    supervisores: [],
    estados: []
  });

  // Estados de modales
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [nuevoVendedorId, setNuevoVendedorId] = useState('');

  // Estados de estadísticas
  const [estadisticas, setEstadisticas] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    fetchProspectos();
    fetchOpcionesFiltros();
    fetchEstadisticas();
  }, [currentPage, itemsPerPage]);

  // Recargar cuando cambien los filtros
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchProspectos();
    }
  }, [filtros]);

  // Función para obtener prospectos
  const fetchProspectos = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('cober_token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...filtros
      });

      const response = await axios.get(`${API_URL}/backoffice/prospectos?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setProspectos(response.data.data);
        const pagination = response.data.pagination;
        setTotalPages(pagination.pages);
        setTotalProspectos(pagination.total);
      } else {
        setError('Error al cargar prospectos');
      }
    } catch (error) {
      console.error('Error al cargar prospectos:', error);
      setError(error.response?.data?.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener opciones de filtros
  const fetchOpcionesFiltros = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/prospectos/filtros`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setOpcionesFiltros(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar opciones de filtros:', error);
    }
  };

  // Función: obtener historial de prospecto
  const fetchHistorial = async (prospectoId) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/prospectos/${prospectoId}/historial`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setHistorial(response.data.data || []);
      } else {
        setHistorial([]);
      }
    } catch (err) {
      console.error('Error al cargar historial:', err);
      setHistorial([]);
    }
  };

  // Función: obtener cotizaciones del prospecto
  const fetchCotizaciones = async (prospectoId) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/prospectos/${prospectoId}/cotizaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCotizaciones(response.data.data || []);
      } else {
        setCotizaciones([]);
      }
    } catch (err) {
      console.error('Error al cargar cotizaciones:', err);
      setCotizaciones([]);
    }
  };

  // Clon Admin: abrir historial
  const handleOpenHistorial = async (prospecto) => {
    setProspectoSeleccionado(prospecto);
    setShowHistorialModal(true);
    await fetchHistorial(prospecto.id);
  };

  // Clon Admin: abrir cotizaciones
  const handleOpenCotizaciones = async (prospecto) => {
    setProspectoSeleccionado(prospecto);
    setShowCotizacionesModal(true);
    setShowDetallesCotizacion({});
    await fetchCotizaciones(prospecto.id);
  };

  // Clon Admin: toggle detalles cotización
  const toggleDetallesCotizacion = (index) => {
    setShowDetallesCotizacion(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Clon Admin: cambio de estado
  const estadosDisponibles = [
    'Lead', '1º Contacto', 'WhatsApp enviado', 'Llamada telefónica', 'Conversación iniciada por WhatsApp',
    'Promoción aplicada', 'Calificado Cotización', 'Calificado Póliza',
    'Calificado Pago', 'Póliza iniciada', 'Póliza generada', 'Póliza enviada a supervisor',
    'Póliza pendiente a firma', 'Póliza firmada',
    'Venta', 'Fuera de zona', 'Fuera de edad',
    'Preexistencia', 'Reafiliación', 'No contesta', 'prueba interna',
    'Ya es socio', 'Busca otra Cobertura', 'Teléfono erróneo',
    'No le interesa (económico)', 'No le interesa cartilla', 'No busca cobertura médica'
  ];

  const handleOpenCambioEstado = (prospecto) => {
    setProspectoParaCambioEstado(prospecto);
    setEditValues({
      [prospecto.id]: {
        estado: prospecto.estado,
        notas: ''
      }
    });
    setShowModalCambioEstado(true);
  };

  const handleCardChange = (id, field, value) => {
    setEditValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSaveEstado = async () => {
    if (!prospectoParaCambioEstado) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');
      const payload = {
        estado: editValues[prospectoParaCambioEstado.id]?.estado,
        notas: editValues[prospectoParaCambioEstado.id]?.notas || ''
      };
      await axios.put(
        `${API_URL}/backoffice/prospectos/${prospectoParaCambioEstado.id}/estado`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Estado actualizado correctamente');
      setShowModalCambioEstado(false);
      setProspectoParaCambioEstado(null);
      await fetchProspectos();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      setError(err.response?.data?.message || 'Error al actualizar estado');
    } finally {
      setLoading(false);
    }
  };

  // Clon Admin: WhatsApp
  const handleEnviarWhatsApp = async (prospecto) => {
    try {
      setProspectoConversaciones(prospecto);
      setModalConversaciones(true);
      setLoadingConversaciones(true);
      setConversacionesProspecto([]);
      setMensajesConversacion([]);
      setConversacionSeleccionada(null);

      const telefono = prospecto.numero_contacto || prospecto.telefono;
      if (!telefono) {
        setError('El prospecto no tiene teléfono registrado');
        setLoadingConversaciones(false);
        return;
      }

      const token = localStorage.getItem('cober_token');
      const resp = await axios.get(`${API_URL}/backoffice/prospectos/whatsapp/telefono/${encodeURIComponent(telefono)}` ,{
        headers: { Authorization: `Bearer ${token}` }
      });
      const conversaciones = resp.data?.data || [];
      setConversacionesProspecto(conversaciones);

      // Cargar mensajes de todas las conversaciones y combinarlos (igual que Admin)
      const promesas = conversaciones.map(conv => 
        axios.get(
          `${API_URL}/backoffice/prospectos/whatsapp/conversaciones/${conv.id}/mensajes`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      const respuestas = await Promise.all(promesas);
      const todosMensajes = respuestas.flatMap(res => res.data?.data || res.data || []);
      const mensajesOrdenados = todosMensajes.sort((a, b) => new Date(a.fecha_envio) - new Date(b.fecha_envio));
      setMensajesConversacion(mensajesOrdenados);
    } catch (err) {
      console.error('Error WhatsApp:', err);
      setError('Error al cargar conversaciones de WhatsApp');
    } finally {
      setLoadingConversaciones(false);
    }
  };

  // Helpers de WhatsApp (idénticos a Admin)
  const getTipoOrigen = (tipo) => {
    const tipos = { 'enviado': 'Enviado', 'recibido': 'Recibido', 'sistema': 'Sistema' };
    return tipos[tipo] || tipo;
  };

  const getTipoOrigenIcon = (tipo) => {
    const iconos = { 'enviado': FaArrowUp, 'recibido': FaArrowDown, 'sistema': FaFileAlt };
    return iconos[tipo] || FaComment;
  };

  const getEstadoTexto = (estado) => {
    const estados = { 'entregado': 'Entregado', 'leido': 'Leído', 'enviado': 'Enviado', 'pendiente': 'Pendiente', 'fallido': 'Fallido' };
    return estados[estado] || estado;
  };

  // Formateo con hora para mensajes (como Admin)
  const formatearFechaMensaje = (fecha) => {
    if (!fecha) return 'Sin fecha';
    try {
      return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'Fecha inválida'; }
  };

  const handleVerConversacion = async (conversacion) => {
    try {
      setLoadingMensajes(true);
      setConversacionSeleccionada(conversacion);
      const token = localStorage.getItem('cober_token');
      const r = await axios.get(`${API_URL}/backoffice/prospectos/whatsapp/conversaciones/${conversacion.id}/mensajes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMensajesConversacion(r.data?.data || []);
    } catch (err) {
      console.error('Error cargando conversación:', err);
    } finally {
      setLoadingMensajes(false);
    }
  };

  const handleVolverAConversaciones = () => {
    setConversacionSeleccionada(null);
    setMensajesConversacion([]);
  };

  // Utilidades de UI (clon Admin)
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount || 0));
  };

  // Un valor negativo en descuento_promocion representa una promoción de tipo
  // "incremento" (suma al precio en lugar de restar).
  const getInfoPromocion = (valor) => {
    const num = parseFloat(valor || 0);
    const esIncremento = num < 0;
    return {
      esIncremento,
      monto: esIncremento ? `+ ${formatCurrency(Math.abs(num))}` : formatCurrency(num),
      label: esIncremento ? 'Incremento' : 'Promoción',
      textClass: esIncremento ? 'text-destructive' : 'text-warning',
      badgeClass: esIncremento ? 'bg-danger' : 'bg-warning text-dark',
    };
  };

  const getPlanColorClass = (planNombre) => {
    const planColors = { 'Básico': 'success', 'Intermedio': 'warning', 'Premium': 'danger', 'Súper Premium': 'primary' };
    return planColors[planNombre] || 'secondary';
  };

  // Función para obtener estadísticas
  const fetchEstadisticas = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/prospectos/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setEstadisticas(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };


  // Función para reasignar vendedor
  const reasignarVendedor = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');

      await axios.put(
        `${API_URL}/backoffice/prospectos/${prospectoSeleccionado.id}/asignar-vendedor`,
        { vendedor_id: parseInt(nuevoVendedorId) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Prospecto reasignado exitosamente');
      setShowReasignarModal(false);
      setNuevoVendedorId('');
      fetchProspectos();
    } catch (error) {
      console.error('Error al reasignar:', error);
      setError(error.response?.data?.message || 'Error al reasignar prospecto');
    } finally {
      setLoading(false);
    }
  };

  // Función para exportar datos
  const exportarDatos = async (formato = 'csv') => {
    try {
      const token = localStorage.getItem('cober_token');
      const params = new URLSearchParams({
        formato,
        ...filtros
      });

      const response = await axios.get(`${API_URL}/backoffice/prospectos/exportar?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Crear y descargar archivo
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prospectos_${new Date().toISOString().slice(0, 10)}.${formato}`;
      link.click();
      window.URL.revokeObjectURL(url);

      setSuccess(`Archivo ${formato.toUpperCase()} descargado exitosamente`);
    } catch (error) {
      console.error('Error al exportar:', error);
      setError('Error al exportar datos');
    }
  };

  // Función para manejar cambio de filtros
  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Función para limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      id: '',
      search: '',
      estado: '',
      vendedor_id: '',
      supervisor_id: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
  };

  // Función para formatear fechas
  const formatearFecha = (fecha, incluirHora = false) => {
    if (!fecha) return 'N/A';
 const fechaNormalizada = typeof fecha === 'string'
      ? fecha.includes('T')
        ? fecha
        : fecha.replace(' ', 'T')
      : fecha;

    const fechaParseada = new Date(fechaNormalizada);

    if (Number.isNaN(fechaParseada.getTime())) {
      return 'N/A';
    }

    return fechaParseada.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
        day: '2-digit',
      ...(incluirHora ? {
        hour: '2-digit',
        minute: '2-digit'
      } : {})
    });
  };

  // Función para formatear números
  const formatearNumero = (numero) => {
    return Number(numero || 0).toLocaleString('es-ES');
  };

  // Colores de estado centralizados (helper compartido)

  // Función para generar paginación
  const renderPaginacion = () => {
    const items = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Botón anterior
    items.push(
      <Pagination.Prev
        key="prev"
        disabled={currentPage === 1}
        onClick={() => setCurrentPage(currentPage - 1)}
      />
    );

    // Primera página
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => setCurrentPage(1)}>
          1
        </Pagination.Item>
      );
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis1" />);
      }
    }

    // Páginas visibles
    for (let page = startPage; page <= endPage; page++) {
      items.push(
        <Pagination.Item
          key={page}
          active={page === currentPage}
          onClick={() => setCurrentPage(page)}
        >
          {page}
        </Pagination.Item>
      );
    }

    // Última página
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis2" />);
      }
      items.push(
        <Pagination.Item key={totalPages} onClick={() => setCurrentPage(totalPages)}>
          {totalPages}
        </Pagination.Item>
      );
    }

    // Botón siguiente
    items.push(
      <Pagination.Next
        key="next"
        disabled={currentPage === totalPages}
        onClick={() => setCurrentPage(currentPage + 1)}
      />
    );

    return <Pagination className="justify-center">{items}</Pagination>;
  };

  return (
    <Container fluid className="">
      {/* Alertas */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
          <FaCheckCircle className="me-2" />
          {success}
        </Alert>
      )}

      {/* Estadísticas rápidas */}
      {estadisticas && (
        <Row className="mb-6">
          <Col md={2} sm={4} xs={6} className="mb-4">
            <Card className="text-center h-full border-0 shadow-xs">
              <Card.Body className="py-4">
                <FaUsers className="text-primary mb-2" size={24} />
                <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-primary mb-1">{formatearNumero(estadisticas.total_prospectos)}</h4>
                <small className="text-[0.875em] text-muted-foreground">Total Prospectos</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6} className="mb-4">
            <Card className="text-center h-full border-0 shadow-xs">
              <Card.Body className="py-4">
                <FaCalendarAlt className="text-success mb-2" size={24} />
                <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-success mb-1">{formatearNumero(estadisticas.prospectos_hoy)}</h4>
                <small className="text-[0.875em] text-muted-foreground">Hoy</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6} className="mb-4">
            <Card className="text-center h-full border-0 shadow-xs">
              <Card.Body className="py-4">
                <FaFileAlt className="text-warning mb-2" size={24} />
                <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-warning mb-1">{formatearNumero(estadisticas.con_cotizaciones)}</h4>
                <small className="text-[0.875em] text-muted-foreground">Con Cotizaciones</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6} className="mb-4">
            <Card className="text-center h-full border-0 shadow-xs">
              <Card.Body className="py-4">
                <FaShieldAlt className="text-info mb-2" size={24} />
                <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-info mb-1">{formatearNumero(estadisticas.con_polizas)}</h4>
                <small className="text-[0.875em] text-muted-foreground">Con Pólizas</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6} className="mb-4">
            <Card className="text-center h-full border-0 shadow-xs">
              <Card.Body className="py-4">
                <FaMoneyBillWave className="text-success mb-2" size={24} />
                <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-success mb-1">{formatearNumero(estadisticas.ventas)}</h4>
                <small className="text-[0.875em] text-muted-foreground">Ventas</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6} className="mb-4">
            <Card className="text-center h-full border-0 shadow-xs">
              <Card.Body className="py-4">
                <FaWhatsapp className="text-success mb-2" size={24} />
                <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-success mb-1">{formatearNumero(estadisticas.whatsapp_activo)}</h4>
                <small className="text-[0.875em] text-muted-foreground">WhatsApp</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filtros y controles */}
      <Card className="mb-6 shadow-xs transition-shadow hover:shadow-md">
        <Card.Body>
          <Row className="items-end">
            {/* ID Prospecto */}
            <Col md={1} className="mb-4">
              <Form.Label>ID</Form.Label>
              <Form.Control
                type="number"
                min="1"
                placeholder="ID"
                value={filtros.id}
                onChange={(e) => handleFiltroChange('id', e.target.value)}
              />
            </Col>

            {/* Búsqueda */}
            <Col md={2} className="mb-4">
              <Form.Label>Buscar</Form.Label>
              <InputGroup>
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  placeholder="Nombre, email, teléfono, DNI..."
                  value={filtros.search}
                  onChange={(e) => handleFiltroChange('search', e.target.value)}
                />
              </InputGroup>
            </Col>

            {/* Estado */}
            <Col md={2} className="mb-4">
              <Form.Label>Estado</Form.Label>
              <Form.Select
                value={filtros.estado}
                onChange={(e) => handleFiltroChange('estado', e.target.value)}
              >
                <option value="">Todos</option>
                {opcionesFiltros.estados.map(estado => (
                  <option key={estado.estado} value={estado.estado}>
                    {estado.estado} ({estado.count})
                  </option>
                ))}
              </Form.Select>
            </Col>

            {/* Vendedor */}
            <Col md={2} className="mb-4">
              <Form.Label>Vendedor</Form.Label>
              <Form.Select
                value={filtros.vendedor_id}
                onChange={(e) => handleFiltroChange('vendedor_id', e.target.value)}
              >
                <option value="">Todos</option>
                {opcionesFiltros.vendedores.map(vendedor => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.first_name} {vendedor.last_name}
                  </option>
                ))}
              </Form.Select>
            </Col>

            {/* Supervisor */}
            <Col md={2} className="mb-4">
              <Form.Label>Supervisor</Form.Label>
              <Form.Select
                value={filtros.supervisor_id}
                onChange={(e) => handleFiltroChange('supervisor_id', e.target.value)}
              >
                <option value="">Todos</option>
                {opcionesFiltros.supervisores.map(supervisor => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.first_name} {supervisor.last_name}
                  </option>
                ))}
              </Form.Select>
            </Col>

            {/* Controles */}
            <Col md={3} className="mb-4">
              <div className="flex gap-2">
                <Button variant="outline-secondary" onClick={limpiarFiltros}>
                  <FaFilter className="me-1" />
                  Limpiar
                </Button>
                <Dropdown>
                  <Dropdown.Toggle variant="outline-primary" size="sm">
                    <FaDownload className="me-1" />
                    Exportar
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => exportarDatos('csv')}>
                      Exportar CSV
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => exportarDatos('excel')}>
                      Exportar Excel
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Col>
          </Row>

          {/* Fechas */}
          <Row>
            <Col md={2}>
              <Form.Label>Desde</Form.Label>
              <Form.Control
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Hasta</Form.Label>
              <Form.Control
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Por página</Form.Label>
              <Form.Select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Form.Select>
            </Col>
            <Col md={6} className="flex items-end">
              <small className="text-[0.875em] text-muted-foreground">
                Mostrando {prospectos.length} de {formatearNumero(totalProspectos)} prospectos
              </small>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabla de prospectos */}
      <Card className="shadow-xs">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center p-12">
              <Spinner animation="border" variant="primary" />
              <p className="mb-4 mt-4">Cargando prospectos...</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table hover className="mb-0">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left">ID</th>
                    <th className="text-left">Prospecto</th>
                    <th className="text-left">Contacto</th>
                    <th className="text-left">Origen</th>
                    <th className="text-left">Estado</th>
                    <th className="text-left">Vendedor</th>
                    <th className="text-left">Supervisor</th>
                    <th className="text-left">Registro</th>
                    <th className="text-left">Actividad</th>
                    <th className="text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prospectos.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-12">
                        <FaExclamationTriangle className="text-muted-foreground mb-2" size={32} />
                        <p className="mb-4 text-muted-foreground">No se encontraron prospectos con los filtros aplicados</p>
                      </td>
                    </tr>
                  ) : (
                    prospectos.map((prospecto) => (
                      <tr key={prospecto.id}>
                        <td>
                          <strong>#{prospecto.id}</strong>
                        </td>
                        <td>
                          <div>
                            <strong>{prospecto.nombre} {prospecto.apellido}</strong>
                            <br />
                            <small className="text-[0.875em] text-muted-foreground">
                              {prospecto.edad != null ? formatEdad(prospecto.edad) : ''}
                              {prospecto.localidad && ` • ${prospecto.localidad}`}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {prospecto.correo && (
                              <OverlayTrigger
                                overlay={<Tooltip>{prospecto.correo}</Tooltip>}
                              >
                                <FaEnvelope className="text-primary" />
                              </OverlayTrigger>
                            )}
                            {prospecto.numero_contacto && (
                              <OverlayTrigger
                                overlay={<Tooltip>{prospecto.numero_contacto}</Tooltip>}
                              >
                                <FaPhone className="text-success" />
                              </OverlayTrigger>
                            )}
                            {prospecto.whatsapp_opt_in && (
                              <FaWhatsapp className="text-success" />
                            )}
                          </div>
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
                          {prospecto.origen && !['Refrito - Campaña', 'Formulario Web', 'Vendedor-App'].includes(prospecto.origen) && (
                            <Badge bg="secondary" className="flex items-center gap-1" style={{width:'fit-content'}}>
                              {prospecto.origen}
                            </Badge>
                          )}
                          {!prospecto.origen && (
                            <span className="text-muted-foreground text-[0.875em]">—</span>
                          )}
                        </td>
                        <td>
                          {(() => { const cfg = getEstadoConfig(prospecto.estado, prospecto.asignacion_comentario); return <Badge bg={cfg.color ? null : cfg.bg} style={cfg.color ? { backgroundColor: cfg.color, color: cfg.textColor || '#fff' } : undefined}>{cfg.text}</Badge>; })()}
                        </td>
                        <td>
                          {prospecto.vendedor_nombre ? (
                            <div>
                              <strong>{prospecto.vendedor_nombre} {prospecto.vendedor_apellido}</strong>
                              <br />
                              <small className="text-[0.875em] text-muted-foreground">{prospecto.vendedor_email}</small>
                            </div>
                          ) : (
                            <Badge bg="warning">Sin asignar</Badge>
                          )}
                        </td>
                        <td>
                          {prospecto.supervisor_nombre ? (
                            <div>
                              <strong>{prospecto.supervisor_nombre} {prospecto.supervisor_apellido}</strong>
                            </div>
                          ) : (
                            <Badge bg="secondary">N/A</Badge>
                          )}
                        </td>
                        <td>
                          <small className="text-[0.875em]">{formatearFecha(prospecto.fecha_hora_registro || prospecto.fecha_registro, true)}</small>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {prospecto.cotizaciones_count > 0 && (
                              <OverlayTrigger
                                overlay={<Tooltip>{prospecto.cotizaciones_count} cotizaciones</Tooltip>}
                              >
                                <Badge bg="warning" className="flex items-center gap-1">
                                  <FaFileAlt size={12} />
                                  {prospecto.cotizaciones_count}
                                </Badge>
                              </OverlayTrigger>
                            )}
                            {prospecto.polizas_count > 0 && (
                              <OverlayTrigger
                                overlay={<Tooltip>{prospecto.polizas_count} pólizas</Tooltip>}
                              >
                                <Badge bg="success" className="flex items-center gap-1">
                                  <FaShieldAlt size={12} />
                                  {prospecto.polizas_count}
                                </Badge>
                              </OverlayTrigger>
                            )}
                            {prospecto.acciones_count > 0 && (
                              <OverlayTrigger
                                overlay={<Tooltip>{prospecto.acciones_count} acciones</Tooltip>}
                              >
                                <Badge bg="info" className="flex items-center gap-1">
                                  <FaHistory size={12} />
                                  {prospecto.acciones_count}
                                </Badge>
                              </OverlayTrigger>
                            )}
                          </div>
                          {prospecto.ultima_accion && (
                            <div>
                              <small className="text-[0.875em] text-muted-foreground">
                                {prospecto.ultima_accion}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1">

                            <OverlayTrigger overlay={<Tooltip>Ver historial</Tooltip>}>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => handleOpenHistorial(prospecto)}
                              >
                                <FaHistory />
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger overlay={<Tooltip>Ver cotizaciones</Tooltip>}>
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => handleOpenCotizaciones(prospecto)}
                              >
                                <FaMoneyBillWave />
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger overlay={<Tooltip>WhatsApp</Tooltip>}>
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => handleEnviarWhatsApp(prospecto)}
                              >
                                <FaWhatsapp />
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger overlay={<Tooltip>Cambiar estado</Tooltip>}>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => handleOpenCambioEstado(prospecto)}
                              >
                                <FaEdit />
                              </Button>
                            </OverlayTrigger>
                            {opcionesFiltros.vendedores && opcionesFiltros.vendedores.length > 0 ? (
                              <OverlayTrigger overlay={<Tooltip>Reasignar vendedor</Tooltip>}>
                                <Button
                                  size="sm"
                                  variant="outline-warning"
                                  onClick={() => {
                                    setProspectoSeleccionado(prospecto);
                                    setShowReasignarModal(true);
                                  }}
                                >
                                  <FaExchangeAlt />
                                </Button>
                              </OverlayTrigger>
                            ) : (
                              <OverlayTrigger overlay={<Tooltip>No hay vendedores disponibles para reasignar</Tooltip>}>
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  disabled
                                >
                                  <FaExchangeAlt />
                                </Button>
                              </OverlayTrigger>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>

        {/* Paginación */}
        {totalPages > 1 && (
          <Card.Footer className="flex justify-center">
            {renderPaginacion()}
          </Card.Footer>
        )}
      </Card>



      {/* Modal: Historial */}
      <Modal show={showHistorialModal} onHide={() => setShowHistorialModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaHistory className="me-2" />
            Historial del Prospecto #{prospectoSeleccionado?.id}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historial && historial.length > 0 ? (
            <div className="relative flex flex-col gap-4 border-l-2 border-border pl-6">
              {historial.map((evento, idx) => (
                <div key={idx} className="border-b pb-2 mb-2">
                  <div className="flex justify-between">
                    <strong>{evento.accion}</strong>
                    <small className="text-[0.875em] text-muted-foreground">{formatearFecha(evento.fecha, true)}</small>
                  </div>
                  {evento.descripcion && <div className="text-muted-foreground text-[0.875em]">{evento.descripcion}</div>}
                  {evento.usuario && (
                    <div className="text-muted-foreground text-[0.875em]">Por: {evento.usuario}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">Sin historial</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHistorialModal(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Cotizaciones */}
      <Modal show={showCotizacionesModal} onHide={() => setShowCotizacionesModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaMoneyBillWave className="me-2" />
            Cotizaciones del Prospecto #{prospectoSeleccionado?.id}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cotizaciones.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">Sin cotizaciones</div>
          ) : (
            <div>
              {cotizaciones.map((cotizacion, index) => (
                <Card key={cotizacion.id} className="mb-4 shadow-xs border-0">
                  <Card.Header className="flex justify-between items-start bg-card">
                    <div>
                      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white font-bold text-base text-foreground ${getPlanColorClass(cotizacion.plan_nombre)} px-4 py-2 rounded-full`}>
                        {cotizacion.plan_nombre || 'Plan'}
                      </span>
                      <small className="text-[0.875em] text-muted-foreground block mt-1">Año: {cotizacion.anio || new Date().getFullYear()}</small>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[1.25rem] leading-snug text-success">{formatCurrency(cotizacion.total_final)}</span>
                      <br />
                      <small className="text-[0.875em] text-muted-foreground">Total Final</small>
                    </div>
                  </Card.Header>
                  <Card.Body className="p-2 md:p-4">
                    <Row className="mb-2 [--gx:0.5rem] [--gy:0.5rem]">
                      <Col xs={6} md={3}>
                        <div className="text-muted-foreground text-[0.875em]">Bruto</div>
                        <div className="font-bold text-info text-[0.875em]">{formatCurrency(cotizacion.total_bruto)}</div>
                      </Col>
                      <Col xs={6} md={3}>
                        {(() => {
                          const ajuste = getInfoPromocion(parseFloat(cotizacion.total_descuento_aporte || 0) + parseFloat(cotizacion.total_descuento_promocion || 0));
                          return (
                            <>
                              <div className="text-muted-foreground text-[0.875em]">{ajuste.esIncremento ? 'Incremento' : 'Descuento'}</div>
                              <div className={`font-bold text-[0.875em] ${ajuste.textClass}`}>{ajuste.monto}</div>
                            </>
                          );
                        })()}
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="text-muted-foreground text-[0.875em]">Personas</div>
                        <div className="font-bold">{cotizacion.detalles ? cotizacion.detalles.length : 1}</div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="text-muted-foreground text-[0.875em]">Fecha</div>
                        <div className="font-bold text-[0.875em]">{formatearFecha(cotizacion.fecha)}</div>
                      </Col>
                    </Row>
                    <div className="flex gap-2 mb-2">
                      <Button variant="outline-secondary" size="sm" onClick={() => toggleDetallesCotizacion(index)}>
                        <FaEye className="me-1"/>
                        {showDetallesCotizacion[index] ? 'Ocultar' : 'Ver'} Detalles
                      </Button>
                    </div>
                    {showDetallesCotizacion[index] && (
                      <div className="mt-4 border-t pt-4">
                        {cotizacion.detalles && cotizacion.detalles.length > 0 ? (
                          <div className="w-full overflow-x-auto">
                            <Table size="sm" responsive className="mb-0 [&_tbody_tr:nth-child(odd)]:bg-muted/40 align-middle">
                              <thead>
                                <tr>
                                  <th className="text-left text-[0.875em]">Persona</th>
                                  <th className="text-left text-[0.875em]">Vínculo</th>
                                  <th className="text-left text-[0.875em]">Edad</th>
                                  <th className="text-left text-[0.875em]">Tipo Afiliación</th>
                                  <th className="text-left text-[0.875em]">Base</th>
                                  <th className="text-left text-[0.875em]">Desc. Aporte</th>
                                  <th className="text-left text-[0.875em]">Desc. Promoción</th>
                                  <th className="text-left text-[0.875em]">Promoción</th>
                                  <th className="text-left text-[0.875em]">Final</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cotizacion.detalles.map((detalle, idx) => (
                                  <tr key={detalle.id || idx}>
                                    <td className="text-[0.875em]">{detalle.persona}</td>
                                    <td className="text-[0.875em]">{detalle.vinculo}</td>
                                    <td className="text-[0.875em]">{detalle.edad}</td>
                                    <td className="text-[0.875em]">
                                      {detalle.tipo_afiliacion_completo || detalle.tipo_afiliacion}
                                      {detalle.categoria_monotributo && (
                                        <div>
                                          <small className="text-[0.875em] text-muted-foreground">Aporte: {formatCurrency(detalle.categoria_monotributo_aporte)}</small>
                                        </div>
                                      )}
                                    </td>
                                    <td className="text-[0.875em]">{formatCurrency(detalle.precio_base)}</td>
                                    <td className="text-[0.875em]">
                                      {formatCurrency(detalle.descuento_aporte)}
                                      {parseFloat(detalle.descuento_aporte || 0) > 0 && (
                                        <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-info ms-1 text-white">Aporte</span>
                                      )}
                                    </td>
                                    <td className="text-[0.875em]">
                                      {(() => {
                                        const info = getInfoPromocion(detalle.descuento_promocion);
                                        return (
                                          <span className={info.textClass}>
                                            {info.monto}
                                            {parseFloat(detalle.descuento_promocion || 0) !== 0 && (
                                              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${info.badgeClass} ms-1`}>{info.label}</span>
                                            )}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="text-[0.875em]">
                                      {detalle.promocion_aplicada ? (
                                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${getInfoPromocion(detalle.descuento_promocion).badgeClass}`}>{detalle.promocion_aplicada}</span>
                                      ) : (
                                        <span className="text-muted-foreground text-[0.875em]">Sin promoción</span>
                                      )}
                                    </td>
                                    <td className="font-bold text-success text-[0.875em]">{formatCurrency(detalle.precio_final)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-center py-2"><small className="text-[0.875em]">Sin detalles disponibles</small></div>
                        )}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCotizacionesModal(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Cambio de estado */}
      <Modal show={showModalCambioEstado} onHide={() => setShowModalCambioEstado(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaEdit className="me-2" />
            Cambiar Estado del Prospecto
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prospectoParaCambioEstado && (
            <div>
              <Alert variant="info">
                Editando: <strong>{prospectoParaCambioEstado.nombre} {prospectoParaCambioEstado.apellido}</strong>
              </Alert>
              <Form.Group className="mb-4">
                <Form.Label>Estado</Form.Label>
                <Form.Select
                  value={editValues[prospectoParaCambioEstado.id]?.estado || ''}
                  onChange={(e) => handleCardChange(prospectoParaCambioEstado.id, 'estado', e.target.value)}
                >
                  {estadosDisponibles.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Notas</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={editValues[prospectoParaCambioEstado.id]?.notas || ''}
                  onChange={(e) => handleCardChange(prospectoParaCambioEstado.id, 'notas', e.target.value)}
                  placeholder="Agregar notas sobre el cambio de estado..."
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModalCambioEstado(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSaveEstado} disabled={loading}>Guardar Cambios</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Conversaciones WhatsApp */}
      <Modal show={modalConversaciones} onHide={() => setModalConversaciones(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaWhatsapp className="me-2 text-success" />
            Historial de Conversaciones WhatsApp
            {prospectoConversaciones && (
              <span className="ms-2 text-muted-foreground text-base">
                {prospectoConversaciones.nombre} {prospectoConversaciones.apellido}
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '600px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
          {loadingConversaciones ? (
            <div className="text-center py-12">
              <Spinner animation="border" variant="primary" />
              <p className="mb-4 mt-4">Cargando historial de conversaciones...</p>
            </div>
          ) : mensajesConversacion.length > 0 ? (
            <div className="rounded-md bg-muted/40 p-3">
              {mensajesConversacion.map((mensaje, index) => {
                const esEnviado = mensaje.tipo === 'enviado';
                const TipoIcon = getTipoOrigenIcon(mensaje.tipo);
                return (
                  <div key={mensaje.id || index} className={`flex mb-4 ${esEnviado ? 'justify-end' : 'justify-start'}`}>
                    <div style={{ maxWidth: '75%' }}>
                      <Card className="transition-shadow hover:shadow-md shadow-xs" style={{ backgroundColor: esEnviado ? '#ffffff' : '#e9ecef', borderRadius: '12px' }}>
                        <Card.Body className="p-4">
                          <div className="mb-2">
                            <small className="text-[0.875em] text-muted-foreground flex items-center">
                              <TipoIcon size={12} className="me-1" />
                              {getTipoOrigen(mensaje.tipo)}
                              {mensaje.origen && ` - ${mensaje.origen}`}
                              {mensaje.vendedor_nombre && (
                                <span className="ms-2">
                                  <FaUser size={10} className="me-1" />
                                  {mensaje.vendedor_nombre} {mensaje.vendedor_apellido}
                                </span>
                              )}
                            </small>
                          </div>
                          <p className="mb-2" style={{ color: '#212529', fontSize: '0.95rem' }}>{mensaje.contenido}</p>
                          {mensaje.archivo_url && (
                            <div className="mt-2 mb-2">
                              <Badge bg="secondary" className="flex items-center" style={{ width: 'fit-content' }}>
                                <FaFile className="me-1" />
                                {mensaje.archivo_nombre || 'Archivo adjunto'}
                                {mensaje.archivo_tamaño && ` (${(mensaje.archivo_tamaño / 1024).toFixed(2)} KB)`}
                              </Badge>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <small className="text-[0.875em] text-muted-foreground"><FaCalendarAlt size={10} className="me-1" />{formatearFechaMensaje(mensaje.fecha_envio)}</small>
                            {mensaje.estado && (
                              <Badge bg="light" text="dark" className="ms-2">{getEstadoTexto(mensaje.estado)}</Badge>
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : conversacionesProspecto.length === 0 ? (
            <div className="text-center py-12">
              <FaComments className="text-muted-foreground mb-4" size={64} />
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">Sin conversaciones</h5>
              <p className="mb-4 text-muted-foreground">No se encontraron conversaciones de WhatsApp para este prospecto.</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <FaComment className="text-muted-foreground mb-4" size={64} />
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">Sin mensajes</h5>
              <p className="mb-4 text-muted-foreground">Las conversaciones no tienen mensajes registrados.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setModalConversaciones(false);
              setConversacionSeleccionada(null);
              setMensajesConversacion([]);
            }}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Reasignación */}
      <Modal show={showReasignarModal} onHide={() => setShowReasignarModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExchangeAlt className="me-2" />
            Reasignar Prospecto
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prospectoSeleccionado && (
            <div>
              <p className="mb-4">
                <strong>Prospecto:</strong> {prospectoSeleccionado.nombre} {prospectoSeleccionado.apellido}
              </p>
              <p className="mb-4">
                <strong>Vendedor actual:</strong>{' '}
                {prospectoSeleccionado.vendedor_nombre ? (
                  `${prospectoSeleccionado.vendedor_nombre} ${prospectoSeleccionado.vendedor_apellido}`
                ) : (
                  <Badge bg="warning">Sin asignar</Badge>
                )}
              </p>

              <Form.Group className="mb-4">
                <Form.Label>Nuevo Vendedor</Form.Label>
                {opcionesFiltros.vendedores && opcionesFiltros.vendedores.length > 0 ? (
                  <Form.Select
                    value={nuevoVendedorId}
                    onChange={(e) => setNuevoVendedorId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar vendedor...</option>
                    {opcionesFiltros.vendedores.map(vendedor => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.first_name} {vendedor.last_name} ({vendedor.email})
                      </option>
                    ))}
                  </Form.Select>
                ) : (
                  <div>
                    <Form.Control 
                      value="No hay vendedores disponibles" 
                      disabled 
                      className="mb-2"
                    />
                    <Alert variant="warning" className="mb-0">
                      <FaExclamationTriangle className="me-2" />
                      <strong>No hay vendedores activos en el sistema.</strong>
                      <br />
                      <small className="text-[0.875em]">
                        Para poder reasignar prospectos, primero debe crear usuarios con rol "Vendedor" (rol 1) 
                        en la gestión de usuarios.
                      </small>
                    </Alert>
                  </div>
                )}
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReasignarModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={reasignarVendedor}
            disabled={!nuevoVendedorId || loading || !opcionesFiltros.vendedores || opcionesFiltros.vendedores.length === 0}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Reasignando...
              </>
            ) : opcionesFiltros.vendedores && opcionesFiltros.vendedores.length === 0 ? (
              <>
                <FaExclamationTriangle className="me-1" />
                Sin vendedores
              </>
            ) : (
              <>
                <FaExchangeAlt className="me-1" />
                Reasignar
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProspectosBackOffice;
