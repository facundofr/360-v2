import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { bgSoft, textTone } from "@/lib/tone";
import axios from "axios";
import Swal from "@/lib/alerts";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Button,
  Modal,
  Offcanvas,
  ListGroup,
  Spinner,
  Badge,
  Form,
  Table,
  Card,
} from "@/components/compat/bootstrap";
import {
  FaTachometerAlt,
  FaUsers,
  FaSignOutAlt,
  FaStore,
  FaBars,
  FaChevronLeft,
  FaEdit,
  FaEye,
  FaUserCheck,
  FaComment,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaHome,
  FaIdBadge,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaPeopleCarry,
  FaInfoCircle,
  FaUserFriends,
  FaChartBar,
  FaCoins,
  FaTimes,
  FaFilter,
  FaSearch,
  FaUserShield,
  FaFileAlt,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaExchangeAlt,
  FaWhatsapp, // ✅ AGREGAR
  FaComments,
  FaCloudUploadAlt, // ✅ NUEVO PARA CARGA DE DOCUMENTOS
  FaFileUpload, // ✅ NUEVO PARA CARGA DE DOCUMENTOS
  FaFile, // ✅ NUEVO PARA DOCUMENTOS
  FaFileContract, // ✅ NUEVO PARA PÓLIZAS
  FaInfo // ✅ NUEVO PARA INFORMACIÓN
} from "@/lib/icons";
import { SimpleLineChart } from '@/components/app/charts';
import MetricasVendedor from "./MetricasVendedor";
import CotizacionesPorUsuario from "./CotizacionesPorUsuario";
import SupervisorCotizaciones from "./SupervisorCotizaciones";
import VendedoresSupervisor from "./VendedoresSupervisor";
import PolizasSupervisor from './PolizasSupervisor';
import ChatWidget from '../../common/ChatWidget';
import ManualWidget from '../../common/ManualWidget';
import ModalExportacion from '../../common/ModalExportacion';
import CargaMultipleDocumentos from '../../supervisor/CargaMultipleDocumentos'; // ✅ NUEVO COMPONENTE
import SupervisorPromociones from './SupervisorPromociones'; // ✅ NUEVO COMPONENTE PARA PROMOCIONES
import { API_URL } from "../../config";
import { formatEdad } from "../../utils/estadosHelper";


const SupervisorDashboard = () => {
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [vista, setVista] = useState("dashboard"); // Cambio: empezar en dashboard
  const [historial, setHistorial] = useState([]);
  const [modalTipo, setModalTipo] = useState("detalle");
  const [filtros, setFiltros] = useState({
    vendedor: "",
    edad: "",
    estado: "",
    nombre: "",
    apellido: "",
  });
  const [cotizaciones, setCotizaciones] = useState([]);
  const [showDetallesCotizacion, setShowDetallesCotizacion] = useState({});
  const [showFiltros, setShowFiltros] = useState(false);
  const [estadisticas, setEstadisticas] = useState({
    totalProspectos: 0,
    totalVendedores: 0,
    ventasConfirmadas: 0,
    totalFacturado: 0,
    totalPolizas: 0
  });
  const [datosGrafica, setDatosGrafica] = useState([]);
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [prospectoParaReasignar, setProspectoParaReasignar] = useState(null);
  const [vendedoresDisponibles, setVendedoresDisponibles] = useState([]);
  const [nuevoVendedorId, setNuevoVendedorId] = useState("");
  const [showModalExportacion, setShowModalExportacion] = useState(false);

  // Estados para cambio de estado de prospectos
  const [editValues, setEditValues] = useState({});
  const [showModalCambioEstado, setShowModalCambioEstado] = useState(false);
  const [prospectoParaCambioEstado, setProspectoParaCambioEstado] = useState(null);

  // ✅ NUEVOS ESTADOS: Modal de conversaciones WhatsApp
  const [modalConversaciones, setModalConversaciones] = useState(false);
  const [prospectoConversaciones, setProspectoConversaciones] = useState(null);
  const [conversacionesProspecto, setConversacionesProspecto] = useState([]);
  const [loadingConversaciones, setLoadingConversaciones] = useState(false);
  
  // ✅ NUEVOS ESTADOS: Vista de mensajes individuales
  const [conversacionSeleccionada, setConversacionSeleccionada] = useState(null);
  const [mensajesConversacion, setMensajesConversacion] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  
  // ✅ NUEVOS ESTADOS: Modal de carga múltiple de documentos
  const [showModalCargaDocumentos, setShowModalCargaDocumentos] = useState(false);
  const [polizaSeleccionadaDocumentos, setPolizaSeleccionadaDocumentos] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      await fetchProspectos();
      await fetchEstadisticas();
      await fetchDatosGrafica();
      await fetchVendedoresDisponibles();
    };
    loadData();
  }, []);

  useEffect(() => {
    // Actualizar estadísticas cuando cambien los prospectos
    if (prospectos.length > 0) {
      fetchEstadisticas();
    }
  }, [prospectos]);

  useEffect(() => {
    // Debug: monitorear cambios en datosGrafica
    console.log('datosGrafica cambió:', datosGrafica);
  }, [datosGrafica]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setOpenDrawer(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Función para formatear moneda
  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(num);
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

  // Función para obtener la clase de color del plan
  const getPlanColorClass = (planNombre) => {
    if (!planNombre) return "bg-primary";
    const nombre = planNombre.toLowerCase();
    if (nombre.includes("classic")) return "bg-primary";
    if (nombre.includes("taylored")) return "bg-success";
    if (nombre.includes("wagon")) return "bg-warning";
    if (nombre.includes("cober x")) return "bg-danger";
    return "bg-primary";
  };

  // Función para mostrar/ocultar detalles de cotización
  const toggleDetallesCotizacion = (index) => {
    setShowDetallesCotizacion(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const fetchProspectos = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/supervisor/prospectos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProspectos(response.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar los prospectos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/supervisor/estadisticas`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Usar los datos de la API si la respuesta es exitosa
      if (response.data && response.data.success) {
        setEstadisticas({
          totalProspectos: response.data.data.totalProspectos || 0,
          totalVendedores: response.data.data.vendedoresActivos || 0,
          ventasConfirmadas: response.data.data.ventasConfirmadas || 0,
          totalFacturado: response.data.data.totalFacturado || 0,
          totalPolizas: response.data.data.totalPolizas || 0
        });
      } else {
        // Fallback a cálculo local
        const totalProspectos = prospectos.length;
        const vendedoresUnicos = [...new Set(prospectos.map(p => p.vendedor_id))].length;
        const ventasConfirmadas = prospectos.filter(p => p.estado === 'Venta').length;
        const totalFacturado = prospectos
          .filter(p => p.estado === 'Venta')
          .reduce((sum, p) => sum + (p.monto_facturado || 0), 0);

        setEstadisticas({
          totalProspectos,
          totalVendedores: vendedoresUnicos,
          ventasConfirmadas,
          totalFacturado,
          totalPolizas: ventasConfirmadas * 0.8 // Estimación: 80% de las ventas generan póliza
        });
      }
    } catch (error) {
      console.warn('Error al obtener estadísticas de la API, usando cálculo local:', error);
      // Si el endpoint no existe, usar datos calculados localmente
      const totalProspectos = prospectos.length;
      const vendedoresUnicos = [...new Set(prospectos.map(p => p.vendedor_id))].filter(Boolean).length;
      const ventasConfirmadas = prospectos.filter(p => p.estado === 'Venta').length;

      setEstadisticas({
        totalProspectos,
        totalVendedores: vendedoresUnicos,
        ventasConfirmadas,
        totalFacturado: ventasConfirmadas * 45000, // Estimación
        totalPolizas: ventasConfirmadas * 0.8 // Estimación: 80% de las ventas generan póliza
      });
    }
  };

  const fetchDatosGrafica = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/supervisor/datos-grafica`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Respuesta de datos-grafica:', response.data);

      // Usar los datos de la API si la respuesta es exitosa
      if (response.data && response.data.success) {
        console.log('Actualizando datosGrafica con:', response.data.data);
        setDatosGrafica(response.data.data);
      } else {
        setDatosGrafica([]);
      }
    } catch (error) {
      console.warn('Error al obtener datos de gráfica de la API:', error);
      setDatosGrafica([]);
    }
  };

  const fetchVendedoresDisponibles = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/supervisor/vendedores`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVendedoresDisponibles(response.data.filter(v => v.is_enabled));
    } catch (error) {
      console.error("Error al obtener vendedores:", error);
    }
  };

  const fetchHistorial = async (prospectoId) => {
    const token = localStorage.getItem("cober_token");
    const { data } = await axios.get(`${API_URL}/prospectos/${prospectoId}/historial`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setHistorial(data);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const sessionId = localStorage.getItem("cober_sessionId");
      const loginTime = localStorage.getItem("cober_loginTime");

      if (token && sessionId) {
        const sessionTime = Math.floor((new Date() - new Date(loginTime)) / 1000);

        await axios.post(
          `${API_URL}/sessions/end`,
          {
            session_id: sessionId,
            logout_time: new Date().toISOString(),
            session_time: sessionTime
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      localStorage.removeItem("cober_token");
      localStorage.removeItem("cober_loginTime");
      localStorage.removeItem("cober_sessionId");
      localStorage.removeItem("cober_user_id");
      localStorage.removeItem("cober_first_name");
      localStorage.removeItem("cober_last_name");
      localStorage.removeItem("cober_user_role");
      localStorage.removeItem("cober_user_email");

      Swal.fire({
        icon: 'success',
        title: 'Sesión cerrada',
        text: 'Has cerrado sesión correctamente',
        confirmButtonColor: '#3085d6'
      }).then(() => {
        navigate('/');
      });
    }
  };

  const prospectosConVendedor = prospectos.map(p => ({
    ...p,
    vendedor: (p.vendedor_nombre && p.vendedor_apellido)
      ? `${p.vendedor_nombre} ${p.vendedor_apellido}`
      : p.vendedor_nombre || p.vendedor_apellido || "Sin asignar",
    handleOpenModal: handleOpenModal,
    handleOpenHistorial: handleOpenHistorial,
    handleOpenReasignar: handleOpenReasignar
  }));

  function handleOpenModal(row) {
    setProspectoSeleccionado(row);
    setModalTipo("detalle");
    setModalOpen(true);
    fetchHistorial(row.id);
  }

  function handleOpenHistorial(row) {
    setProspectoSeleccionado(row);
    setModalTipo("historial");
    setModalOpen(true);
    fetchHistorial(row.id);
  }

  async function handleOpenCotizacion(row) {
    setProspectoSeleccionado(row);
    setModalTipo("cotizacion");
    setModalOpen(true);
    setShowDetallesCotizacion({ // Reset details visibility
    });

    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/lead/${row.id}/cotizaciones?detalles=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Procesar las cotizaciones como en ProspectoDetalle
      if (Array.isArray(data) && data.length > 0 && data[0].plan_nombre) {
        setCotizaciones(data);
      } else {
        const cotizacionesAgrupadas = data.reduce((acc, cotizacion) => {
          const planId = cotizacion.plan_id;
          if (!acc[planId]) {
            acc[planId] = {
              id: cotizacion.id,
              plan_nombre: cotizacion.plan_nombre,
              tipo_afiliacion_nombre: cotizacion.tipo_afiliacion_nombre,
              total_bruto: cotizacion.total_bruto,
              total_descuento_aporte: cotizacion.total_descuento_aporte || 0,
              total_descuento_promocion: cotizacion.total_descuento_promocion || 0,
              total_final: cotizacion.total_final,
              anio: cotizacion.anio || new Date().getFullYear(),
              fecha: cotizacion.fecha || new Date().toISOString(),
              detalles: [],
            };
          }
          acc[planId].detalles.push({
            id: cotizacion.id,
            persona: cotizacion.persona,
            vinculo: cotizacion.vinculo,
            edad: cotizacion.edad,
            tipo_afiliacion_id: cotizacion.tipo_afiliacion_id,
            tipo_afiliacion: cotizacion.tipo_afiliacion_nombre,
            precio_base: cotizacion.precio_base,
            descuento_aporte: cotizacion.descuento_aporte,
            promocion_aplicada: cotizacion.promocion_aplicada,
            descuento_promocion: cotizacion.descuento_promocion,
            precio_final: cotizacion.precio_final,
          });
          return acc;
        }, {});

        setCotizaciones(Object.values(cotizacionesAgrupadas));
      }
    } catch (error) {
      console.error("Error al obtener cotizaciones:", error);
      setCotizaciones([]);
    }
  }

  async function handleOpenReasignar(row) {
    setProspectoParaReasignar(row);
    setNuevoVendedorId("");
    await fetchVendedoresDisponibles(); // Cargar vendedores antes de abrir modal
    setShowReasignarModal(true);
  }

  const handleReasignarProspecto = async () => {
    if (!nuevoVendedorId || !prospectoParaReasignar) {
      Swal.fire("Error", "Debe seleccionar un vendedor destino.", "error");
      return;
    }

    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.post(
        `${API_URL}/supervisor/reasignar-prospectos`,
        {
          prospectos: [prospectoParaReasignar.id],
          nuevo_vendedor_id: nuevoVendedorId,
          vendedor_anterior_id: prospectoParaReasignar.vendedor_id || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        icon: 'success',
        title: 'Reasignación exitosa',
        text: `El prospecto ha sido reasignado correctamente.`,
        confirmButtonColor: '#3085d6'
      });

      // Actualizar la lista de prospectos
      await fetchProspectos();
      setShowReasignarModal(false);
      setProspectoParaReasignar(null);
      setNuevoVendedorId("");
    } catch (error) {
      console.error("Error al reasignar prospecto:", error);
      Swal.fire("Error", "No se pudo reasignar el prospecto: " + (error.response?.data?.message || error.message), "error");
    }
  };

  // Funciones para cambio de estado
  const handleCardChange = (id, field, value) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleOpenCambioEstado = (prospecto) => {
    setProspectoParaCambioEstado(prospecto);
    setEditValues((prev) => ({
      ...prev,
      [prospecto.id]: {
        estado: prospecto.asignacion_estado || prospecto.estado,
        comentario: prospecto.asignacion_comentario || prospecto.comentario || ""
      }
    }));
    setShowModalCambioEstado(true);
  };

  const handleSaveEstado = async () => {
    if (!prospectoParaCambioEstado) return;

    const values = editValues[prospectoParaCambioEstado.id] || {};
    const nuevoEstado = values.estado;
    const comentario = values.comentario || '';

    // Validación: si cambia el estado, debe haber comentario
    const estadoCambiado = nuevoEstado !== (prospectoParaCambioEstado.asignacion_estado || prospectoParaCambioEstado.estado);

    if (estadoCambiado && (!comentario || comentario.trim() === "")) {
      Swal.fire("Atención", "Debes agregar un comentario al cambiar el estado.", "warning");
      return;
    }

    try {
      const token = localStorage.getItem("cober_token");
      await axios.patch(
        `${API_URL}/supervisor/prospectos/${prospectoParaCambioEstado.id}/estado`,
        {
          estado: nuevoEstado,
          motivo: comentario
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire("Éxito", "Estado del prospecto actualizado correctamente.", "success");
      setShowModalCambioEstado(false);
      setProspectoParaCambioEstado(null);
      setEditValues((prev) => ({ ...prev, [prospectoParaCambioEstado.id]: {} }));
      fetchProspectos(); // Recargar la lista
    } catch (error) {
      console.error("Error al actualizar estado del prospecto:", error);
      Swal.fire("Error", "No se pudo actualizar el estado: " + (error.response?.data?.message || error.message), "error");
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setProspectoSeleccionado(null);
  };

  // ✅ NUEVAS FUNCIONES: Modal de conversaciones WhatsApp
  const handleEnviarWhatsApp = async (prospecto) => {
    try {
      if (!prospecto?.id) {
        Swal.fire("Error", "No se encontró información del prospecto", "error");
        return;
      }

      setProspectoConversaciones(prospecto);
      setLoadingConversaciones(true);
      setModalConversaciones(true);

      // Obtener conversaciones del prospecto
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/supervisor/chat/conversaciones/prospecto/${prospecto.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('📋 Respuesta del servidor:', data);

      if (data.success) {
        console.log('✅ Conversaciones encontradas:', data.data.conversaciones);
        setConversacionesProspecto(data.data.conversaciones);
      } else {
        console.log('⚠️ No hay conversaciones disponibles');
        setConversacionesProspecto([]);
      }

    } catch (error) {
      console.error("Error obteniendo conversaciones:", error);
      setConversacionesProspecto([]);
      Swal.fire("Error", "No se pudieron cargar las conversaciones", "error");
    } finally {
      setLoadingConversaciones(false);
    }
  };

  const handleVerConversacion = async (conversacion) => {
    try {
      setConversacionSeleccionada(conversacion);
      setLoadingMensajes(true);
      
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/supervisor/chat/mensajes/${conversacion.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('📨 Mensajes de conversación:', data);

      if (data.success) {
        setMensajesConversacion(data.data.mensajes);
      } else {
        setMensajesConversacion([]);
        Swal.fire("Info", "No hay mensajes en esta conversación", "info");
      }

    } catch (error) {
      console.error("Error obteniendo mensajes:", error);
      setMensajesConversacion([]);
      Swal.fire("Error", "No se pudieron cargar los mensajes", "error");
    } finally {
      setLoadingMensajes(false);
    }
  };

  const handleVolverAConversaciones = () => {
    setConversacionSeleccionada(null);
    setMensajesConversacion([]);
  };

  const handleNuevaConversacion = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      
      const { data } = await axios.post(
        `${API_URL}/supervisor/chat/conversaciones`,
        {
          prospecto_id: prospectoConversaciones.id,
          tipo_origen: 'manual'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        Swal.fire("Éxito", "Nueva conversación creada", "success");
        handleEnviarWhatsApp(prospectoConversaciones);
      }

    } catch (error) {
      console.error("Error creando conversación:", error);
      Swal.fire("Error", "No se pudo crear la conversación", "error");
    }
  };

  // ✅ NUEVAS FUNCIONES: Gestión de documentos
  const handleAbrirCargaDocumentos = (poliza) => {
    setPolizaSeleccionadaDocumentos(poliza);
    setShowModalCargaDocumentos(true);
  };

  const handleCerrarCargaDocumentos = () => {
    setShowModalCargaDocumentos(false);
    setPolizaSeleccionadaDocumentos(null);
  };

  const handleDocumentosActualizados = () => {
    // Refrescar datos de pólizas si es necesario
    console.log('Documentos actualizados para póliza:', polizaSeleccionadaDocumentos?.id);
    // Aquí podrías recargar la lista de pólizas o actualizar estadísticas
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadoConversacion = (estado) => {
    const estados = {
      'activa': 'success',
      'pausada': 'warning', 
      'cerrada': 'secondary',
      'finalizada': 'dark'
    };
    return estados[estado] || 'secondary';
  };

  const getEstadoTexto = (estado) => {
    const estados = {
      'activa': 'Activa',
      'pausada': 'Pausada',
      'cerrada': 'Cerrada', 
      'finalizada': 'Finalizada'
    };
    return estados[estado] || estado;
  };

  const getTipoOrigen = (tipo) => {
    const tipos = {
      'cotizacion': 'Cotización',
      'poliza': 'Póliza',
      'manual': 'Manual',
      'webhook': 'Automático'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoOrigenIcon = (tipo) => {
    const iconos = {
      'cotizacion': '📋',
      'poliza': '📄', 
      'manual': '✍️',
      'webhook': '🔔'
    };
    return iconos[tipo] || '❓';
  };

  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return phone;
    
    const masked = '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
    
    if (phone.includes('+')) {
      return `+${masked}`;
    } else if (phone.includes('-') || phone.includes(' ') || phone.includes('(')) {
      return `******${cleaned.slice(-4)}`;
    }
    
    return masked;
  };

  const handleFiltroChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const prospectosFiltrados = prospectosConVendedor.filter((p) => {
    return (
      (filtros.vendedor === "" || p.vendedor.toLowerCase().includes(filtros.vendedor.toLowerCase())) &&
      (filtros.edad === "" || String(p.edad) === filtros.edad) &&
      (filtros.estado === "" || (p.asignacion_estado || p.estado).toLowerCase().includes(filtros.estado.toLowerCase())) &&
      (filtros.nombre === "" || p.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) &&
      (filtros.apellido === "" || p.apellido.toLowerCase().includes(filtros.apellido.toLowerCase()))
    );
  });

  // Estados disponibles para prospectos
  const estadosDisponibles = [
    'Lead',
    '1º Contacto',
    'WhatsApp enviado',
    'Llamada telefónica',
    'Conversación iniciada por WhatsApp',
    'Promoción aplicada',
    'Calificado Cotización',
    'Calificado Póliza',
    'Calificado Pago',
    'Póliza iniciada',
    'Póliza generada',
    'Póliza enviada a supervisor',
    'Póliza pendiente a firma',
    'Póliza firmada',
    'Venta',
    'Fuera de zona',
    'Fuera de edad',
    'Preexistencia',
    'Reafiliación',
    'No contesta',
    'prueba interna',
    'Ya es socio',
    'Busca otra Cobertura',
    'Teléfono erróneo',
    'No le interesa (económico)',
    'No le interesa cartilla',
    'No busca cobertura médica'
  ];

  const estadoPorcentaje = {
    "Lead": 10,
    "1º Contacto": 25,
    "WhatsApp enviado": 25,
    "Llamada telefónica": 25,
    "Conversación iniciada por WhatsApp": 35,
    "Promoción aplicada": 40,
    "Calificado Cotización": 50,
    "Calificado Póliza": 75,
    "Calificado Pago": 90,
    "Póliza iniciada": 91,
    "Póliza generada": 92,
    "Póliza enviada a supervisor": 94,
    "Póliza pendiente a firma": 96,
    "Póliza firmada": 98,
    "Venta": 100,
    "Fuera de zona": 0,
    "Fuera de edad": 0,
    "Preexistencia": 0,
    "Reafiliación": 0,
    "No contesta": 0,
    "prueba interna": 0,
    "Ya es socio": 0,
    "Busca otra Cobertura": 0,
    "Teléfono erróneo": 0,
    "No le interesa (económico)": 0,
    "No le interesa cartilla": 0,
    "No busca cobertura médica": 0
  };

  // ✅ Función para obtener la clase CSS del color dinámico basado en el porcentaje
  const getProgressColorClass = (porcentaje) => {
    if (porcentaje === 0) return 'bg-danger-gradient';
    if (porcentaje <= 20) return 'bg-danger-gradient';
    if (porcentaje <= 40) return 'bg-warning-gradient';
    if (porcentaje <= 60) return 'bg-yellow-gradient';
    if (porcentaje <= 80) return 'bg-success-light-gradient';
    if (porcentaje < 100) return 'bg-success-gradient';
    return 'bg-complete-gradient';
  };

  // Función para obtener el color del estado basado en el progreso (igual que vendedor)
  const getEstadoColor = (estado) => {
    const progreso = estadoPorcentaje[estado] || 0;
    return progreso === 100 ? "success" :
      progreso > 50 ? "primary" :
        progreso > 0 ? "warning" :
          "danger";
  };

  // Función para obtener la variante del botón del estado
  const getEstadoVariant = (estado) => {
    const color = getEstadoColor(estado);
    return `outline-${color}`;
  };

  // Opciones del menú con colores y estadísticas
  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: FaTachometerAlt,
      color: "primary",
      count: null,
      description: "Panel principal"
    },
    {
      id: "prospectos",
      label: "Prospectos",
      icon: FaUserFriends,
      color: "success",
      count: prospectos.length,
      description: "Gestión de leads"
    },
    {
      id: "vendedores",
      label: "Vendedores",
      icon: FaUsers,
      color: "warning",
      count: null,
      description: "Gestión del equipo"
    },
    {
      id: "polizas",
      label: "Pólizas",
      icon: FaFileAlt,
      color: "danger",
      count: null,
      description: "Gestión de pólizas"
    },
    {
      id: "documentos",
      label: "Documentos",
      icon: FaCloudUploadAlt,
      color: "info",
      count: null,
      description: "Carga múltiple de documentos"
    },
    {
      id: "promociones",
      label: "Promociones",
      icon: FaCoins,
      color: "success",
      count: null,
      description: "Gestión de promociones"
    }
  ];

  const getVistaTitle = () => {
    const item = menuItems.find(item => item.id === vista);
    return item ? item.label : "Supervisor Dashboard";
  };

  // Componente para las cards estadísticas
  const StatCard = ({ icon: Icon, title, value, change, changeType, color }) => (
    <Card className="h-full border-0 shadow-xs">
      <Card.Body className="flex items-center">
        <div className={`rounded-full p-4 me-4 ${bgSoft(color)}`}>
          <Icon className={`${textTone(color)} text-[1.5rem] leading-snug`} />
        </div>
        <div className="grow">
          <h6 className="text-base leading-tight tracking-tight text-muted-foreground mb-1 font-normal">{title}</h6>
          <h3 className="text-[1.75rem] leading-tight tracking-tight text-corporate mb-0 font-bold">{value}</h3>
          {change && (
            <div className="flex items-center mt-1">
              {changeType === 'up' && <FaArrowUp className="text-success me-1" size={12} />}
              {changeType === 'down' && <FaArrowDown className="text-destructive me-1" size={12} />}
              {changeType === 'equal' && <FaEquals className="text-muted-foreground me-1" size={12} />}
              <small className={cn("text-[0.875em]", textTone(changeType === 'up' ? 'success' : changeType === 'down' ? 'danger' : 'muted'))}>
                {change}% vs mes anterior
              </small>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );

  // Componente del dashboard principal
  const renderDashboard = () => (
    <div>
      {/* Cards de estadísticas */}
      <Row className="[--gx:1.5rem] [--gy:1.5rem] mb-6">
        <Col xs={12} sm={6} lg={3}>
          <StatCard
            icon={FaUserFriends}
            title="Total Prospectos"
            value={estadisticas.totalProspectos.toLocaleString()}
            color=""
          />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <StatCard
            icon={FaUsers}
            title="Vendedores Activos"
            value={estadisticas.totalVendedores}
            color="success"
          />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <StatCard
            icon={FaUserCheck}
            title="Ventas Confirmadas"
            value={estadisticas.ventasConfirmadas}
            color="warning"
          />
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <StatCard
            icon={FaFileAlt}
            title="Pólizas Generadas"
            value={estadisticas.totalPolizas}
            color="info"
          />
        </Col>
      
      </Row>

      {/* Gráfica y métricas adicionales */}
      <Row className="[--gx:1.5rem] [--gy:1.5rem]">
        <Col xs={12}>
          <Card className="h-full border-0 shadow-xs">
            <Card.Header className="bg-card border-0 pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[1.25rem] leading-tight tracking-tight text-corporate mb-1 font-bold">Tendencias Mensuales</h5>
                  <p className="text-muted-foreground mb-0 text-[0.875em]">Evolución de prospectos, vendedores, ventas y pólizas</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center">
                    <div className="bg-primary rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                    <small className="text-[0.875em] text-muted-foreground">Nuevos Prospectos</small>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-success rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                    <small className="text-[0.875em] text-muted-foreground">Vendedores</small>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-warning rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                    <small className="text-[0.875em] text-muted-foreground">Ventas</small>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-info rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                    <small className="text-[0.875em] text-muted-foreground">Pólizas Generadas</small>
                  </div>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {datosGrafica && datosGrafica.length > 0 ? (
                <SimpleLineChart data={datosGrafica} xKey="mes" height={300} showLegend={false} series={[{ key: "nuevosProspectos", label: "Nuevos prospectos", color: "var(--primary)" }, { key: "vendedores", label: "Vendedores", color: "var(--success)" }, { key: "ventas", label: "Ventas", color: "var(--warning)" }, { key: "polizasGeneradas", label: "Pólizas generadas", color: "var(--info)" }]} />
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  <p>Sin datos para mostrar</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* <Col lg={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0 pb-0">
              <h5 className="mb-1 fw-bold">Resumen Ejecutivo</h5>
              <p className="text-muted mb-0 small">Métricas clave del período</p>
            </Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center py-3 border-bottom">
                <div>
                  <h6 className="mb-0">Tasa de Conversión</h6>
                  <small className="text-muted">Prospectos → Ventas</small>
                </div>
                <div className="text-end">
                  <h5 className="mb-0 text-success">
                    {estadisticas.totalProspectos > 0
                      ? ((estadisticas.ventasConfirmadas / estadisticas.totalProspectos) * 100).toFixed(1)
                      : 0}%
                  </h5>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center py-3 border-bottom">
                <div>
                  <h6 className="mb-0">Promedio por Venta</h6>
                  <small className="text-muted">Valor promedio</small>
                </div>
                <div className="text-end">
                  <h5 className="mb-0 text-primary">
                    {estadisticas.ventasConfirmadas > 0
                      ? formatCurrency(estadisticas.totalFacturado / estadisticas.ventasConfirmadas)
                      : formatCurrency(0)}
                  </h5>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center py-3 border-bottom">
                <div>
                  <h6 className="mb-0">Prospectos por Vendedor</h6>
                  <small className="text-muted">Distribución promedio</small>
                </div>
                <div className="text-end">
                  <h5 className="mb-0 text-warning">
                    {estadisticas.totalVendedores > 0
                      ? Math.round(estadisticas.totalProspectos / estadisticas.totalVendedores)
                      : 0}
                  </h5>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center py-3">
                <div>
                  <h6 className="mb-0">Meta Mensual</h6>
                  <small className="text-muted">Progreso actual</small>
                </div>
                <div className="text-end">
                  <h5 className="mb-0 text-info">
                    {Math.min(100, (estadisticas.ventasConfirmadas / 100) * 100).toFixed(0)}%
                  </h5>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col> */}
      </Row>
    </div>
  );

  // ✅ NUEVA VISTA: Gestión de documentos
  const renderVistaDocumentos = () => (
    <div>
      <Row className="mb-6">
        <Col>
          <Card className="shadow-xs">
            <Card.Header className="bg-primary text-white">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaCloudUploadAlt className="me-2" />
                Gestión de Documentos
              </h5>
              <p className="mb-0 text-[0.875em]">Carga múltiple de documentos para pólizas</p>
            </Card.Header>
            <Card.Body>
              <div className="text-center py-6">
                <FaFileUpload size={48} className="text-muted-foreground mb-4" />
                <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Selecciona una póliza para cargar documentos</h6>
                <p className="text-muted-foreground mb-4">
                  Utiliza la vista de pólizas para seleccionar una póliza específica y cargar documentos.
                </p>
                <Button 
                  variant="primary" 
                  onClick={() => setVista('polizas')}
                >
                  <FaFileContract className="me-2" />
                  Ir a Pólizas
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row>
        <Col>
          <Card className="shadow-xs">
            <Card.Header>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaInfo className="me-2 text-info" />
                Tipos de documentos soportados
              </h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <div className="mb-4">
                    <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-primary">Documentos de Cliente:</h6>
                    <ul className="mb-4 list-none pl-0 ms-4">
                      <li><FaFile className="me-2 text-teal" />Póliza firmada por cliente</li>
                      <li><FaFile className="me-2 text-teal" />Auditoría médica</li>
                      <li><FaFile className="me-2 text-teal" />Documentos de identidad</li>
                      <li><FaFile className="me-2 text-teal" />Comprobantes de ingresos</li>
                    </ul>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-4">
                    <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-success">Documentos Internos:</h6>
                    <ul className="mb-4 list-none pl-0 ms-4">
                      <li><FaFile className="me-2 text-teal" />Formularios internos</li>
                      <li><FaFile className="me-2 text-teal" />Reportes médicos</li>
                      <li><FaFile className="me-2 text-teal" />Comunicaciones internas</li>
                      <li><FaFile className="me-2 text-teal" />Otros documentos</li>
                    </ul>
                  </div>
                </Col>
              </Row>
              <div className="relative rounded-md border px-4 py-3 text-sm leading-relaxed border-primary/15 bg-accent/70 text-foreground mb-0">
                <FaInfoCircle className="me-2" />
                <strong>Límites:</strong> Máximo 6 archivos por carga, 10MB por archivo. 
                Formatos soportados: JPG, PNG, PDF, DOC, DOCX.
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );

  // Sidebar content mejorado
  const drawerContent = (
    <div className="flex flex-col bg-sidebar h-full">
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h5 className="tracking-tight flex items-center gap-2 text-lg font-bold text-corporate mb-0">
            <FaUserShield className="text-primary" />
            Supervisor <span className="font-light">Panel</span>
          </h5>
          <Button
            variant="light"
            size="sm"
            className="size-10 p-0 lg:hidden"
            onClick={() => setOpenDrawer(false)}
          >
            <FaTimes />
          </Button>
        </div>
      </div>

      <div className="flex-1 gap-1 p-3 h-full flex flex-col">
        <div className="grow">
          {menuItems.map((item) => (
            <div key={item.id} className="">
              <button
                className={`relative flex min-h-12 w-full items-center gap-3 rounded-md px-4 text-left font-medium text-sidebar-foreground transition-colors outline-none hover:bg-primary/5 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 w-full text-left ${vista === item.id ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : ""}`}
                onClick={() => {
                  setVista(item.id);
                  setOpenDrawer(false);
                }}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.count !== null && item.count !== undefined && item.count > 0 && <Badge bg="secondary" className="ms-auto">{item.count}</Badge>}
              </button>
            </div>
          ))}
        </div>

        {/* Logout section */}
        <div className="border-t border-sidebar-border p-3">
          <button
            className="flex min-h-12 w-full items-center gap-3 rounded-md px-4 font-medium text-destructive transition-colors hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-dvh">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <div className="mt-2">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Layout para Desktop y Tablet */}
      <div className=" hidden md:flex min-h-dvh" style={{ background: "#f8fafc" }}>
        {/* Sidebar fijo */}
        <div className="sticky top-20 h-[calc(100dvh-80px)] w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar">
          {drawerContent}
        </div>

        {/* Contenido principal */}
        <div className="min-w-0 flex-1">
          {/* Header mejorado */}
          <div className="sticky top-[60px] z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card px-4 py-3 shadow-xs md:top-20 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xl font-bold text-corporate md:text-2xl">
                <FaTachometerAlt className="shrink-0 text-primary" />
                <span className="truncate">{getVistaTitle()}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {vista === "prospectos" && (
                <Button
                  variant="success"
                  onClick={() => setShowModalExportacion(true)}
                  className="flex items-center me-2"
                  size="sm"
                >
                  <FaFileAlt className="me-1" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              )}
              <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-accent px-3 py-1 text-xs font-bold text-primary">
                <FaUserShield className="me-1" />
                Supervisor
              </div>
            </div>
          </div>

          {/* Contenido */}
          <Container fluid className="p-4 lg:p-6">
            {vista === "prospectos" && (
              <>
                {/* Filtros - Desktop/Tablet */}
                <Card className="mb-4 lg:mb-6">
                  <Card.Header className="">
                    <div className="flex justify-between items-center">
                      <h6 className="text-base leading-tight tracking-tight flex items-center font-bold text-corporate mb-0">
                        <FaSearch className="me-2" />Filtros de Búsqueda
                      </h6>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <Row className="[--gx:0.5rem] [--gy:0.5rem] lg:[--gx:1rem] lg:[--gy:1rem]">
                      <Col md={6} lg={2}>
                        <Form.Label className="text-[0.875em] text-muted-foreground">Vendedor</Form.Label>
                        <Form.Control
                          placeholder="Buscar vendedor..."
                          name="vendedor"
                          value={filtros.vendedor}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col md={6} lg={2}>
                        <Form.Label className="text-[0.875em] text-muted-foreground">Edad</Form.Label>
                        <Form.Control
                          placeholder="Edad"
                          name="edad"
                          value={filtros.edad}
                          onChange={handleFiltroChange}
                          size="sm"
                          type="number"
                          min="0"
                        />
                      </Col>
                      <Col md={6} lg={2}>
                        <Form.Label className="text-[0.875em] text-muted-foreground">Estado</Form.Label>
                        <Form.Control
                          placeholder="Estado"
                          name="estado"
                          value={filtros.estado}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col md={6} lg={2}>
                        <Form.Label className="text-[0.875em] text-muted-foreground">Nombre</Form.Label>
                        <Form.Control
                          placeholder="Nombre"
                          name="nombre"
                          value={filtros.nombre}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col md={6} lg={2}>
                        <Form.Label className="text-[0.875em] text-muted-foreground">Apellido</Form.Label>
                        <Form.Control
                          placeholder="Apellido"
                          name="apellido"
                          value={filtros.apellido}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col md={6} lg={2} className="flex items-end">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => setFiltros({ vendedor: "", edad: "", estado: "", nombre: "", apellido: "" })}
                        >
                          Limpiar
                        </Button>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Tabla - Desktop/Tablet */}
                <Card className="shadow-xs transition-shadow hover:shadow-md">
                  <Card.Body className="p-0">
                    {loading ? (
                      <div className="text-center py-12">
                        <Spinner animation="border" variant="primary" />
                        <div className="mt-2">Cargando prospectos...</div>
                      </div>
                    ) : (
                      <div className="w-full overflow-x-auto">
                        <Table hover className="mb-0">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left px-4 lg:px-6 py-4">ID</th>
                              <th className="text-left px-4 lg:px-6 py-4">Nombre</th>
                              <th className="text-left px-4 lg:px-6 py-4 hidden lg:table-cell">Contacto</th>
                              <th className="text-left px-4 lg:px-6 py-4 hidden xl:table-cell">Edad</th>
                              <th className="text-left px-4 lg:px-6 py-4">Estado</th>
                              <th className="text-left px-4 lg:px-6 py-4 hidden lg:table-cell">Vendedor</th>
                              <th className="text-left px-4 lg:px-6 py-4">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prospectosFiltrados.map((row) => (
                              <tr key={row.id}>
                                <td className="px-4 lg:px-6 py-4">
                                  <Badge bg="secondary">{row.id}</Badge>
                                </td>
                                <td className="px-4 lg:px-6 py-4">
                                  <div>
                                    <div className="font-bold">{row.nombre} {row.apellido}</div>
                                    <small className="text-[0.875em] text-muted-foreground block lg:hidden">{row.numero_contacto}</small>
                                    <small className="text-[0.875em] text-muted-foreground">{row.correo}</small>
                                  </div>
                                </td>
                                <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
                                  <div>
                                    <div className="font-bold">{row.numero_contacto}</div>
                                    <small className="text-[0.875em] text-muted-foreground">{row.localidad}</small>
                                  </div>
                                </td>
                                <td className="px-4 lg:px-6 py-4 hidden xl:table-cell">
                                  <Badge bg="info">{formatEdad(row.edad)}</Badge>
                                </td>
                                <td className="px-4 lg:px-6 py-4">
                                  <div className="flex items-center">
                                    <Button
                                      variant={getEstadoVariant(row.asignacion_estado || row.estado)}
                                      size="sm"
                                      onClick={() => handleOpenCambioEstado(row)}
                                      className="me-2"
                                      title="Cambiar estado"
                                    >
                                      {row.asignacion_estado || row.estado}
                                    </Button>
                                  </div>
                                  <div className="block lg:hidden">
                                    <small className="text-[0.875em] text-muted-foreground">{row.vendedor}</small>
                                  </div>
                                </td>
                                <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
                                  <div className="text-[0.875em]">{row.vendedor}</div>
                                </td>
                                <td className="px-4 lg:px-6 py-4">
                                  <div className="flex gap-1 flex-wrap">
                                    <Button size="sm" variant="outline-primary" onClick={() => handleOpenModal(row)} title="Ver detalle">
                                      <FaEye />
                                    </Button>
                                    <Button size="sm" variant="outline-info" onClick={() => handleOpenHistorial(row)} title="Ver historial" className="hidden lg:inline-block">
                                      <FaUserCheck />
                                    </Button>
                                    <Button size="sm" variant="outline-success" onClick={() => handleOpenCotizacion(row)} title="Ver cotizaciones" className="hidden xl:inline-block">
                                      <FaMoneyBillWave />
                                    </Button>
                                    <Button size="sm" variant="outline-warning" onClick={() => handleOpenReasignar(row)} title="Reasignar vendedor">
                                      <FaExchangeAlt />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline-secondary" 
                                      onClick={() => handleEnviarWhatsApp(row)} 
                                      title="Ver conversaciones de WhatsApp"
                                      className="hidden lg:inline-block"
                                    >
                                      <FaWhatsapp />
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
              </>
            )}

            {vista === "dashboard" && renderDashboard()}
            {vista === "metricas" && <MetricasVendedor />}
            {vista === "vendedores" && <VendedoresSupervisor />}
            {vista === "cotizaciones" && <SupervisorCotizaciones />}
            {vista === "polizas" && <PolizasSupervisor />}
            {vista === "documentos" && renderVistaDocumentos()}
            {vista === "promociones" && <SupervisorPromociones />}
          </Container>
        </div>
      </div>

      {/* Layout para Mobile */}
      <div className=" md:hidden min-h-dvh" style={{ background: "#f8fafc" }}>
        {/* Offcanvas Sidebar mejorado */}
        <Offcanvas
          show={openDrawer}
          onHide={() => setOpenDrawer(false)}
          placement="start"
          className="w-72 max-w-[85vw]"
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Panel de Supervisor</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="p-0">
            {drawerContent}
          </Offcanvas.Body>
        </Offcanvas>

        {/* Header móvil mejorado */}
        <div className="sticky top-[60px] z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card px-4 py-3 shadow-xs md:top-20 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="light"
              size="sm"
              className="size-11 p-0"
              onClick={() => setOpenDrawer(true)}
            >
              <FaBars />
            </Button>
            <div className="flex min-w-0 items-center gap-2 text-xl font-bold text-corporate md:text-2xl">
              <FaTachometerAlt className="shrink-0 text-primary" />
              <span className="truncate">{getVistaTitle()}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {vista === "prospectos" && (
              <Button
                variant="success"
                onClick={() => setShowModalExportacion(true)}
                size="sm"
                className="me-2"
              >
                <FaFileAlt />
              </Button>
            )}
            <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-accent px-3 py-1 text-xs font-bold text-primary">
              Supervisor
            </div>
          </div>
        </div>

        {/* Contenido móvil */}
        <Container fluid className="p-2">
          {/* Dashboard principal - Cards de navegación mejoradas */}
          {vista === "dashboard" && (
            <>
              {/* Resumen rápido en mobile */}
              <Row className="[--gx:0.5rem] [--gy:0.5rem] mb-4">
                <Col xs={6}>
                  <Card className="border-0 bg-primary text-primary-foreground h-full">
                    <Card.Body>
                      <FaUserFriends className="mb-2 size-6 opacity-80" />
                      <div className="text-3xl leading-tight font-bold tabular-nums">{estadisticas.totalProspectos}</div>
                      <div className="text-sm opacity-90">Prospectos</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6}>
                  <Card className="border-0 text-primary-foreground bg-success h-full">
                    <Card.Body>
                      <FaUsers className="mb-2 size-6 opacity-80" />
                      <div className="text-3xl leading-tight font-bold tabular-nums">{estadisticas.totalVendedores}</div>
                      <div className="text-sm opacity-90">Vendedores</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6}>
                  <Card className="border-0 text-primary-foreground bg-warning h-full">
                    <Card.Body>
                      <FaUserCheck className="mb-2 size-6 opacity-80" />
                      <div className="text-3xl leading-tight font-bold tabular-nums">{estadisticas.ventasConfirmadas}</div>
                      <div className="text-sm opacity-90">Ventas</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6}>
                  <Card className="border-0 text-corporate-foreground bg-corporate h-full">
                    <Card.Body>
                      <FaMoneyBillWave className="mb-2 size-6 opacity-80" />
                      <div className="text-3xl leading-tight font-bold tabular-nums">${(estadisticas.totalFacturado / 1000000).toFixed(1)}M</div>
                      <div className="text-sm opacity-90">Facturado</div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Cards de navegación */}
              <Row className="[--gx:0.5rem] [--gy:0.5rem]">
                {menuItems.slice(1).map((item) => ( // Excluir dashboard de las cards
                  <Col key={item.id} xs={6}>
                    <Card
                      className={`transition-shadow hover:shadow-md shadow-xs h-full`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setVista(item.id)}
                    >
                      <Card.Body>
                        <item.icon className="mb-2 size-6 opacity-80" />
                        <h6 className="tracking-tight mb-2 text-lg leading-snug font-bold text-corporate">{item.label}</h6>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                        {item.count !== null && item.count !== undefined && item.count > 0 && (
                          <Badge bg={item.color} className="mt-1">{item.count}</Badge>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* Vista específica de Prospectos */}
          {vista === "prospectos" && (
            <>
              {/* Botón para volver al dashboard en mobile */}
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-2"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>

              {/* Filtros móvil - Colapsables */}
              <Card className="mb-2">
                <Card.Header
                  className="py-2"
                  onClick={() => setShowFiltros(!showFiltros)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex justify-between items-center">
                    <h6 className="text-base leading-tight tracking-tight flex items-center font-bold text-corporate mb-0">
                      <FaFilter className="me-2" />Filtros
                    </h6>
                    <small className="text-[0.875em] text-muted-foreground">
                      {showFiltros ? 'Ocultar' : 'Mostrar'}
                    </small>
                  </div>
                </Card.Header>
                {showFiltros && (
                  <Card.Body className="p-2">
                    <Row className="[--gx:0.5rem] [--gy:0.5rem]">
                      <Col xs={6}>
                        <Form.Control
                          placeholder="Vendedor"
                          name="vendedor"
                          value={filtros.vendedor}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Control
                          placeholder="Estado"
                          name="estado"
                          value={filtros.estado}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Control
                          placeholder="Nombre"
                          name="nombre"
                          value={filtros.nombre}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Control
                          placeholder="Apellido"
                          name="apellido"
                          value={filtros.apellido}
                          onChange={handleFiltroChange}
                          size="sm"
                        />
                      </Col>
                      <Col xs={12}>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setFiltros({ vendedor: "", edad: "", estado: "", nombre: "", apellido: "" });
                            setShowFiltros(false);
                          }}
                        >
                          Limpiar Filtros
                        </Button>
                      </Col>
                    </Row>
                  </Card.Body>
                )}
              </Card>

              {/* Lista de prospectos para móvil */}
              {loading ? (
                <div className="text-center py-6">
                  <Spinner animation="border" variant="primary" size="sm" />
                  <div className="mt-2 text-[0.875em]">Cargando...</div>
                </div>
              ) : (
                <div className="grid gap-2">
                  {prospectosFiltrados.map((row) => (
                    <Card key={row.id} className="shadow-xs">
                      <Card.Body className="p-2">
                        <div className="flex justify-between items-start mb-2">
                          <div className="grow">
                            <h6 className="font-bold tracking-tight text-corporate mb-1 text-base">{row.nombre} {row.apellido}</h6>
                            <div className="flex flex-wrap gap-1 mb-1">
                              <Badge bg="secondary" className="text-[0.875em]">#{row.id}</Badge>
                              <Badge bg="info" className="text-[0.875em]">{row.edad}a</Badge>
                              <Button
                                variant={getEstadoVariant(row.asignacion_estado || row.estado)}
                                size="sm"
                                onClick={() => handleOpenCambioEstado(row)}
                                className="text-[0.875em] p-1 px-2"
                              >
                                {row.asignacion_estado || row.estado}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="flex justify-between">
                            <small className="text-[0.875em] text-muted-foreground">📞</small>
                            <small className="text-[0.875em] font-bold">{row.numero_contacto}</small>
                          </div>
                          <div className="flex justify-between">
                            <small className="text-[0.875em] text-muted-foreground">👤</small>
                            <small className="text-[0.875em]">{row.vendedor}</small>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="flex-auto"
                            onClick={() => handleOpenModal(row)}
                          >
                            <FaEye />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="flex-auto"
                            onClick={() => handleOpenHistorial(row)}
                          >
                            <FaUserCheck />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-success"
                            className="flex-auto"
                            onClick={() => handleOpenCotizacion(row)}
                          >
                            <FaMoneyBillWave />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-warning"
                            className="flex-auto"
                            onClick={() => handleOpenReasignar(row)}
                          >
                            <FaExchangeAlt />
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}

                  {prospectosFiltrados.length === 0 && (
                    <Card className="text-center py-6">
                      <Card.Body>
                        <FaSearch className="text-muted-foreground mb-2" size={24} />
                        <p className="text-muted-foreground mb-0">No se encontraron prospectos</p>
                        <small className="text-[0.875em] text-muted-foreground">Intenta ajustar los filtros</small>
                      </Card.Body>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}

          {/* Vista específica de Vendedores */}
          {vista === "vendedores" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-2"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <VendedoresSupervisor />
            </div>
          )}

          {/* Vista específica de Cotizaciones */}
          {vista === "cotizaciones" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-2"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <SupervisorCotizaciones />
            </div>
          )}

          {/* Vista específica de Pólizas */}
          {vista === "polizas" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-2"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <PolizasSupervisor />
            </div>
          )}

          {/* ✅ NUEVA Vista específica de Documentos */}
          {vista === "documentos" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-2"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              {renderVistaDocumentos()}
            </div>
          )}

          {/* ✅ NUEVA Vista específica de Promociones */}
          {vista === "promociones" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-2"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <SupervisorPromociones />
            </div>
          )}
        </Container>
      </div>

      {/* Modal responsivo mejorado */}
      <Modal
        show={modalOpen}
        onHide={handleCloseModal}
        centered
        size="xl"
        fullscreen="sm-down"
        className=""
      >
        <Modal.Header closeButton className="border-0 pb-2">
          <Modal.Title className="text-base font-bold">
            {modalTipo === "historial"
              ? "Historial de acciones"
              : modalTipo === "cotizacion"
                ? `💰 Cotizaciones`
                : "👤 Información del Prospecto"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          className="p-4"
          style={{
            maxHeight: '70vh',
            overflowY: 'auto'
          }}
        >
          {modalTipo === "historial" ? (
            <div>
              {historial.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  No hay registros de historial para este prospecto
                </div>
              ) : (
                historial.map((accion, index) => (
                  <Card key={index} className="mb-2 border-l-4 border-l-info">
                    <Card.Body className="py-2">
                      <div className="flex justify-between items-center mb-1">
                        <Badge bg={accion.accion === 'APLICAR_PROMOCION' ? 'success' : 'info'}>
                          {accion.accion}
                        </Badge>
                        <small className="text-[0.875em] text-muted-foreground">{new Date(accion.fecha).toLocaleString()}</small>
                      </div>
                      <div>{accion.descripcion}</div>
                      <div className="mt-1">
                        <small className="text-[0.875em]">Por: {accion.first_name} {accion.last_name}</small>
                      </div>
                    </Card.Body>
                  </Card>
                ))
              )}
            </div>
          ) : modalTipo === "cotizacion" ? (
            cotizaciones.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">
                <FaMoneyBillWave className="mb-2" size={24} />
                <div>Sin cotizaciones disponibles</div>
              </div>
            ) : (
              <div className="gap-2">
                {cotizaciones.map((cotizacion, index) => (
                  <Card key={cotizacion.id} className="mb-4 shadow-xs border-0">
                    <Card.Header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card border-b">
                      <div className="mb-2 md:mb-0">
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white font-bold text-base text-white ${getPlanColorClass(cotizacion.plan_nombre)} px-4 py-2 rounded-full`}>
                          {cotizacion.plan_nombre}
                        </span>
                        <small className="text-[0.875em] text-muted-foreground block mt-1">Año: {cotizacion.anio || new Date().getFullYear()}</small>
                      </div>
                      <div className="text-left md:text-right">
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
                          <div className="font-bold text-[0.875em]">{new Date(cotizacion.fecha).toLocaleDateString()}</div>
                        </Col>
                      </Row>
                      <div className="flex gap-2 mb-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => toggleDetallesCotizacion(index)}
                          className="flex-auto md:grow-0"
                        >
                          <FaEye className="me-1" />
                          {showDetallesCotizacion[index] ? 'Ocultar' : 'Ver'} Detalles
                        </Button>
                      </div>
                      {showDetallesCotizacion[index] && (
                        <div className="mt-4 border-t pt-4">
                          {cotizacion.detalles && cotizacion.detalles.length > 0 ? (
                            <>
                              {/* Vista de escritorio - Tabla */}
                              <div className="hidden lg:block">
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
                                          <td className="text-[0.875em]">{detalle.tipo_afiliacion}</td>
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
                                            {detalle.promocion_aplicada
                                              ? <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${getInfoPromocion(detalle.descuento_promocion).badgeClass}`}>{detalle.promocion_aplicada}</span>
                                              : <span className="text-muted-foreground text-[0.875em]">Sin promoción</span>
                                            }
                                          </td>
                                          <td className="font-bold text-success text-[0.875em]">{formatCurrency(detalle.precio_final)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                </div>
                              </div>

                              {/* Vista móvil - Cards */}
                              <div className="lg:hidden">
                                {cotizacion.detalles.map((detalle, idx) => (
                                  <Card key={detalle.id || idx} className="mb-2 border-primary border-[3px]">
                                    <Card.Body className="p-2">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <h6 className="text-base leading-tight tracking-tight text-corporate mb-0 font-bold">{detalle.persona}</h6>
                                          <Badge bg="secondary" className="text-[0.875em]">{detalle.vinculo}</Badge>
                                        </div>
                                        <Badge bg="info">{formatEdad(detalle.edad)}</Badge>
                                      </div>

                                      <Row className="[--gx:0.5rem] [--gy:0.5rem] mb-2">
                                        <Col xs={6}>
                                          <div className="text-[0.875em] text-muted-foreground">Tipo Afiliación</div>
                                          <div className="font-bold text-[0.875em]">{detalle.tipo_afiliacion}</div>
                                        </Col>
                                        <Col xs={6}>
                                          <div className="text-[0.875em] text-muted-foreground">Precio Base</div>
                                          <div className="font-bold text-[0.875em] text-primary">{formatCurrency(detalle.precio_base)}</div>
                                        </Col>
                                      </Row>

                                      <Row className="[--gx:0.5rem] [--gy:0.5rem] mb-2">
                                        <Col xs={6}>
                                          <div className="text-[0.875em] text-muted-foreground">Desc. Aporte</div>
                                          <div className="font-bold text-[0.875em] text-info">
                                            {formatCurrency(detalle.descuento_aporte)}
                                            {parseFloat(detalle.descuento_aporte || 0) > 0 && (
                                              <Badge bg="info" className="ms-1 text-[0.875em]">Aporte</Badge>
                                            )}
                                          </div>
                                        </Col>
                                        <Col xs={6}>
                                          <div className="text-[0.875em] text-muted-foreground">{getInfoPromocion(detalle.descuento_promocion).esIncremento ? 'Incremento' : 'Desc. Promoción'}</div>
                                          <div className={`font-bold text-[0.875em] ${getInfoPromocion(detalle.descuento_promocion).textClass}`}>
                                            {getInfoPromocion(detalle.descuento_promocion).monto}
                                            {parseFloat(detalle.descuento_promocion || 0) !== 0 && (
                                              <Badge bg={getInfoPromocion(detalle.descuento_promocion).esIncremento ? 'danger' : 'warning'} className={`ms-1 text-[0.875em] ${getInfoPromocion(detalle.descuento_promocion).esIncremento ? '' : 'text-foreground'}`}>
                                                {getInfoPromocion(detalle.descuento_promocion).esIncremento ? 'Incremento' : 'Promo'}
                                              </Badge>
                                            )}
                                          </div>
                                        </Col>
                                      </Row>

                                      {detalle.promocion_aplicada && (
                                        <div className="mb-2">
                                          <div className="text-[0.875em] text-muted-foreground">Promoción Aplicada</div>
                                          <Badge bg={getInfoPromocion(detalle.descuento_promocion).esIncremento ? 'danger' : 'warning'} className={getInfoPromocion(detalle.descuento_promocion).esIncremento ? '' : 'text-foreground'}>{detalle.promocion_aplicada}</Badge>
                                        </div>
                                      )}

                                      <div className="border-t pt-2 mt-2">
                                        <div className="flex justify-between items-center">
                                          <span className="font-bold">Precio Final:</span>
                                          <span className="font-bold text-base text-success">{formatCurrency(detalle.precio_final)}</span>
                                        </div>
                                      </div>
                                    </Card.Body>
                                  </Card>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground text-[0.875em]">Sin detalles disponibles</div>
                          )}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )
          ) : prospectoSeleccionado ? (
            <div>
              <Row className="[--gx:0.5rem] [--gy:0.5rem] md:[--gx:1rem] md:[--gy:1rem]">
                <Col xs={12} md={6}>
                  <Card className="h-full border-0 bg-muted">
                    <Card.Body className="p-2 md:p-4">
                      <h6 className="text-base font-bold leading-tight tracking-tight text-primary mb-2 md:mb-4">
                        <FaUser className="me-2" />Información Personal
                      </h6>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Nombre completo</small>
                        <div className="font-bold">{prospectoSeleccionado.nombre} {prospectoSeleccionado.apellido}</div>
                      </div>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Edad</small>
                        <div>{formatEdad(prospectoSeleccionado.edad)}</div>
                      </div>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Contacto</small>
                        <div>{prospectoSeleccionado.numero_contacto}</div>
                      </div>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Email</small>
                        <div className="text-[0.875em]">{prospectoSeleccionado.correo}</div>
                      </div>
                      <div>
                        <small className="text-[0.875em] text-muted-foreground">Localidad</small>
                        <div>{prospectoSeleccionado.localidad}</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={6}>
                  <Card className="h-full border-0 bg-muted">
                    <Card.Body className="p-2 md:p-4">
                      <h6 className="text-base font-bold leading-tight tracking-tight text-success mb-2 md:mb-4">
                        <FaUserCheck className="me-2" />Estado y Asignación
                      </h6>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Estado actual</small>
                        <div><Badge bg={getEstadoColor(prospectoSeleccionado.asignacion_estado || prospectoSeleccionado.estado)}>{prospectoSeleccionado.asignacion_estado || prospectoSeleccionado.estado}</Badge></div>
                      </div>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Vendedor asignado</small>
                        <div className="text-[0.875em]">{prospectoSeleccionado.vendedor || "Sin asignar"}</div>
                      </div>
                      <div className="mb-2">
                        <small className="text-[0.875em] text-muted-foreground">Comentario</small>
                        <div className="text-[0.875em]">{prospectoSeleccionado.comentario || "Sin comentario"}</div>
                      </div>
                      {prospectoSeleccionado.asignacion_fecha && (
                        <div>
                          <small className="text-[0.875em] text-muted-foreground">Fecha de asignación</small>
                          <div className="text-[0.875em]">{new Date(prospectoSeleccionado.asignacion_fecha).toLocaleString()}</div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {prospectoSeleccionado.familiares && prospectoSeleccionado.familiares.length > 0 && (
                <div className="mt-4">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-info mb-2 md:mb-4">
                    <FaUserFriends className="me-2" />Grupo Familiar
                  </h6>
                  <div className="grid gap-2">
                    {prospectoSeleccionado.familiares.map((f, idx) => (
                      <Card key={idx} className="border-info border-[3px]">
                        <Card.Body className="p-2 md:p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="grow">
                              <div className="font-bold text-[0.875em]">{f.nombre}</div>
                              <small className="text-[0.875em] text-muted-foreground">{f.vinculo}</small>
                            </div>
                            <Badge bg="secondary">{formatEdad(f.edad)}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {f.tipo_afiliacion_id && (
                              <Badge bg="info" className="text-[0.875em]">Afiliación: {f.tipo_afiliacion_id}</Badge>
                            )}
                            {f.sueldo_bruto && (
                              <Badge bg="success" className="text-[0.875em]">Sueldo: {f.sueldo_bruto}</Badge>
                            )}
                            {f.categoria_monotributo && (
                              <Badge bg="warning" className="text-[0.875em]">Monotributo: {f.categoria_monotributo}</Badge>
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal.Body>
      </Modal>

      {/* Modal de reasignación responsivo */}
      <Modal
        show={showReasignarModal}
        onHide={() => setShowReasignarModal(false)}
        centered
        size={window.innerWidth < 576 ? undefined : "md"}
        fullscreen={window.innerWidth < 576 ? "sm-down" : false}
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="text-base font-bold">
            <FaExchangeAlt className="me-2" />
            Reasignar Prospecto
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2 md:p-4">
          {prospectoParaReasignar && (
            <>
              <div className="mb-4 p-2 md:p-4 bg-muted rounded-md">
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2">Prospecto a reasignar:</h6>
                <div className="flex flex-col md:flex-row justify-between items-start">
                  <div className="mb-2 md:mb-0">
                    <strong>{prospectoParaReasignar.nombre} {prospectoParaReasignar.apellido}</strong>
                    <div className="text-[0.875em] text-muted-foreground">ID: {prospectoParaReasignar.id}</div>
                    <div className="text-[0.875em] text-muted-foreground">Estado: <Badge bg={getEstadoColor(prospectoParaReasignar.asignacion_estado || prospectoParaReasignar.estado)}>{prospectoParaReasignar.asignacion_estado || prospectoParaReasignar.estado}</Badge></div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[0.875em] text-muted-foreground">Vendedor actual:</div>
                  <div className="font-bold">{prospectoParaReasignar.vendedor || "Sin asignar"}</div>
                </div>
              </div>

              <Form.Group className="mb-4">
                <Form.Label>Seleccionar nuevo vendedor:</Form.Label>
                <Form.Select
                  value={nuevoVendedorId}
                  onChange={(e) => setNuevoVendedorId(e.target.value)}
                  size={window.innerWidth < 576 ? "sm" : undefined}
                >
                  <option value="">Seleccionar vendedor...</option>
                  {vendedoresDisponibles
                    .filter(v => v.id !== prospectoParaReasignar.vendedor_id) // Excluir el vendedor actual
                    .map(vendedor => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.first_name} {vendedor.last_name}
                        {vendedor.total_prospectos && ` (${vendedor.total_prospectos} prospectos)`}
                      </option>
                    ))
                  }
                </Form.Select>
                {vendedoresDisponibles.length === 0 && (
                  <Form.Text className="text-muted-foreground text-[0.875em]">
                    No hay vendedores disponibles para la reasignación.
                  </Form.Text>
                )}
              </Form.Group>

              <div className="relative rounded-md border px-4 py-3 border-primary/15 bg-accent/70 text-foreground text-[0.875em]">
                <FaInfoCircle className="me-1" />
                <strong>Nota:</strong> Al reasignar este prospecto, el nuevo vendedor será notificado y podrá ver toda la información y historial del prospecto.
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <div className="flex gap-2 w-full flex-col md:flex-row">
            <Button
              variant="secondary"
              onClick={() => setShowReasignarModal(false)}
              className="flex-auto"
              size={window.innerWidth < 576 ? "sm" : undefined}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleReasignarProspecto}
              disabled={!nuevoVendedorId}
              className="flex-auto"
              size={window.innerWidth < 576 ? "sm" : undefined}
            >
              <FaExchangeAlt className="me-1" />
              Reasignar Prospecto
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Modal de Exportación */}
      {/* Modal Cambio de Estado */}
      <Modal
        show={showModalCambioEstado}
        onHide={() => {
          setShowModalCambioEstado(false);
          setProspectoParaCambioEstado(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Cambiar Estado del Prospecto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prospectoParaCambioEstado && (
            <>
              <div className="mb-4">
                <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Prospecto: {prospectoParaCambioEstado.nombre} {prospectoParaCambioEstado.apellido}</h6>
                <small className="text-[0.875em] text-muted-foreground">
                  ID: {prospectoParaCambioEstado.id} |
                  Vendedor: {prospectoParaCambioEstado.vendedor} |
                  Estado actual: {prospectoParaCambioEstado.asignacion_estado || prospectoParaCambioEstado.estado}
                </small>
              </div>

              <Form.Group className="mb-4">
                <Form.Label>Estado</Form.Label>
                <Form.Select
                  value={editValues[prospectoParaCambioEstado.id]?.estado || prospectoParaCambioEstado.asignacion_estado || prospectoParaCambioEstado.estado}
                  onChange={(e) => handleCardChange(prospectoParaCambioEstado.id, "estado", e.target.value)}
                >
                  {estadosDisponibles.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Comentario <span className="text-destructive">*</span></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editValues[prospectoParaCambioEstado.id]?.comentario || ""}
                  onChange={(e) => handleCardChange(prospectoParaCambioEstado.id, "comentario", e.target.value)}
                  placeholder="Agrega un comentario sobre el cambio de estado..."
                />
                <Form.Text className="text-muted-foreground">
                  El comentario es obligatorio al cambiar el estado.
                </Form.Text>
              </Form.Group>

              {/* Mostrar progreso estimado */}
              {editValues[prospectoParaCambioEstado.id]?.estado && (
                <div className="mb-4">
                  <small className="text-[0.875em] text-muted-foreground">Progreso estimado:</small>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted mt-1" style={{ height: "8px" }}>
                    <div
                      className={`flex h-full items-center justify-center overflow-hidden bg-primary text-[0.7rem] font-bold text-white transition-[width] duration-500 ${getProgressColorClass(estadoPorcentaje[editValues[prospectoParaCambioEstado.id].estado] || 0)}`}
                      role="progressbar"
                      style={{
                        width: `${estadoPorcentaje[editValues[prospectoParaCambioEstado.id].estado] || 0}%`
                      }}
                      aria-valuenow={estadoPorcentaje[editValues[prospectoParaCambioEstado.id].estado] || 0}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      {estadoPorcentaje[editValues[prospectoParaCambioEstado.id].estado] || 0}%
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowModalCambioEstado(false);
              setProspectoParaCambioEstado(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveEstado}
            disabled={
              !prospectoParaCambioEstado ||
              !editValues[prospectoParaCambioEstado.id]?.estado ||
              (!editValues[prospectoParaCambioEstado.id]?.comentario ||
                editValues[prospectoParaCambioEstado.id]?.comentario.trim() === "")
            }
          >
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>

      <ModalExportacion
        show={showModalExportacion}
        onHide={() => setShowModalExportacion(false)}
        userRole="supervisor"
      />

      {/* Modal de Conversaciones de WhatsApp */}
      <Modal 
        show={modalConversaciones} 
        onHide={() => {
          setModalConversaciones(false);
          setConversacionSeleccionada(null);
          setMensajesConversacion([]);
        }} 
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaWhatsapp className="me-2 text-success" />
            {conversacionSeleccionada ? 'Historial de Mensajes' : 'Conversaciones de WhatsApp'}
            {prospectoConversaciones && (
              <span className="text-muted-foreground ms-2">
                - {prospectoConversaciones.nombre} {prospectoConversaciones.apellido}
              </span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {conversacionSeleccionada ? (
            // Vista de mensajes individuales
            <div className="flex flex-col">
              <div className="flex items-center mb-4">
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleVolverAConversaciones}
                  className="me-4"
                >
                  ← Volver
                </Button>
                <div>
                  <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">Conversación #{conversacionSeleccionada.numero_conversacion}</h6>
                  <small className="text-[0.875em] text-muted-foreground">
                    {conversacionSeleccionada.telefono_cliente ? maskPhoneNumber(conversacionSeleccionada.telefono_cliente) : 'N/A'}
                  </small>
                </div>
              </div>
              
              {loadingMensajes ? (
                <div className="text-center py-6">
                  <div className="inline-block size-8 animate-spin rounded-full border-4 border-current border-r-transparent align-middle text-primary" role="status">
                    <span className="sr-only">Cargando mensajes...</span>
                  </div>
                  <p className="mb-4 mt-2 text-muted-foreground">Cargando mensajes...</p>
                </div>
              ) : mensajesConversacion.length === 0 ? (
                <div className="text-center py-6">
                  <FaComments size={48} className="text-muted-foreground mb-4" />
                  <p className="mb-4 text-muted-foreground">No hay mensajes en esta conversación.</p>
                </div>
              ) : (
                <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto rounded-md bg-muted/60 p-3">
                  {mensajesConversacion.map((mensaje, index) => (
                    <div 
                      key={mensaje.id || index}
                      className={`flex mb-4 flex ${mensaje.tipo === 'enviado' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-xs p-4 rounded-md ${
                          mensaje.tipo === 'enviado' 
                            ? 'bg-primary text-white' 
                            : mensaje.tipo === 'recibido'
                            ? 'bg-muted'
                            : 'bg-warning text-foreground'
                        }`}
                        style={{ maxWidth: '70%' }}
                      >
                        <div className="whitespace-pre-wrap">
                          {mensaje.contenido}
                        </div>
                        <div className="text-[0.65rem] opacity-70 mt-2">
                          <small className={cn("text-[0.875em]", mensaje.tipo === 'enviado' ? 'text-white/90' : 'text-muted-foreground')}>
                            {mensaje.tipo === 'enviado' && '👤 '} 
                            {mensaje.tipo === 'recibido' && '💬 '}
                            {mensaje.tipo === 'sistema' && '🔧 '}
                            {new Date(mensaje.created_at).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Vista de lista de conversaciones
            <>
              {loadingConversaciones ? (
                <div className="text-center py-6">
                  <div className="inline-block size-8 animate-spin rounded-full border-4 border-current border-r-transparent align-middle text-primary" role="status">
                    <span className="sr-only">Cargando conversaciones...</span>
                  </div>
                  <p className="mb-4 mt-2 text-muted-foreground">Cargando conversaciones...</p>
                </div>
              ) : conversacionesProspecto.length === 0 ? (
                <div className="text-center py-6">
                  <FaWhatsapp size={48} className="text-muted-foreground mb-4" />
                  <p className="mb-4 text-muted-foreground">No hay conversaciones de WhatsApp para este prospecto.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y rounded-md border">
                  {conversacionesProspecto.map((conversacion, index) => (
                    <Card key={index} className="mb-4 border-0 shadow-xs">
                      <Card.Header className="bg-muted py-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <Badge 
                              bg={getEstadoConversacion(conversacion.estado || 'activa')} 
                              className="me-2"
                            >
                              {getEstadoTexto(conversacion.estado || 'activa')}
                            </Badge>
                            <small className="text-[0.875em] text-muted-foreground">
                              <strong>Teléfono:</strong> {conversacion.telefono_cliente ? maskPhoneNumber(conversacion.telefono_cliente) : 'N/A'}
                            </small>
                          </div>
                          <small className="text-[0.875em] text-muted-foreground">
                            {conversacion.fecha_conversacion ? new Date(conversacion.fecha_conversacion).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Fecha no disponible'}
                          </small>
                        </div>
                      </Card.Header>
                      <Card.Body className="py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <Badge bg="info" className="me-2">
                              {getTipoOrigenIcon(conversacion.tipo_origen || 'manual')} {getTipoOrigen(conversacion.tipo_origen || 'manual')}
                            </Badge>
                            {conversacion.vendedor_asignado && (
                              <small className="text-[0.875em] text-muted-foreground">
                                <strong>Vendedor:</strong> {conversacion.vendedor_asignado}
                              </small>
                            )}
                          </div>
                          
                          {conversacion.mensaje_cliente && (
                            <div className="mb-2">
                              <strong className="text-primary">Cliente:</strong>
                              <div className="bg-muted p-2 rounded-md mt-1">
                                {conversacion.mensaje_cliente}
                              </div>
                            </div>
                          )}
                          
                          {conversacion.respuesta_bot && (
                            <div className="mb-2">
                              <strong className="text-success">Vendedor:</strong>
                              <div className="bg-muted p-2 rounded-md mt-1">
                                {conversacion.respuesta_bot}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center mt-2">
                            <small className="text-[0.875em] text-muted-foreground">
                              {conversacion.total_mensajes || 0} mensaje(s)
                            </small>
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => handleVerConversacion(conversacion)}
                            >
                              <FaComments className="me-1" />
                              Ver Historial
                            </Button>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setModalConversaciones(false)}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ NUEVO MODAL: Carga múltiple de documentos */}
      <Modal 
        show={showModalCargaDocumentos} 
        onHide={handleCerrarCargaDocumentos} 
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaFileUpload className="me-2 text-primary" />
            Carga Múltiple de Documentos
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {polizaSeleccionadaDocumentos && (
            <div className="mb-4 p-4 bg-muted rounded-md">
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">Póliza Seleccionada:</h6>
              <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]">
                <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                  <small className="text-[0.875em]"><strong>ID:</strong> {polizaSeleccionadaDocumentos.id}</small>
                </div>
                <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                  <small className="text-[0.875em]"><strong>Cliente:</strong> {polizaSeleccionadaDocumentos.nombre_cliente}</small>
                </div>
              </div>
            </div>
          )}
          
          {polizaSeleccionadaDocumentos && (
            <CargaMultipleDocumentos 
              polizaId={polizaSeleccionadaDocumentos.id}
              onDocumentosActualizados={handleDocumentosActualizados}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleCerrarCargaDocumentos}
          >
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* <ChatWidget /> */}
      <ManualWidget userRole="supervisor" />
    </>
  );
};

export default SupervisorDashboard;