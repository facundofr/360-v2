import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Modal,
  Badge,
  Form,
  InputGroup,
  Spinner,
  Alert,
  Dropdown,
  OverlayTrigger,
  Tooltip,
  Collapse,
  Pagination
} from "@/components/compat/bootstrap";
import {
  FaEye,
  FaEdit,
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
  FaArrowRight, // ✅ NUEVO: Para indicar scroll horizontal
  FaEquals,
  FaExchangeAlt,
  FaWhatsapp,
  FaComments,
  FaCloudUploadAlt,
  FaFileUpload,
  FaFile,
  FaFileContract,
  FaInfo,
  FaRecycle, // ✅ Icono para refritos
  FaSync // ✅ NUEVO: Icono para recalcular
} from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config.js";

const ProspectosAdmin = () => {
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [modalTipo, setModalTipo] = useState("detalle");
  const [filtros, setFiltros] = useState({
    vendedor: "",
    edad: "",
    estado: "",
    nombre: "",
    apellido: "",
    telefono: "",
  });
  const [cotizaciones, setCotizaciones] = useState([]);
  const [showDetallesCotizacion, setShowDetallesCotizacion] = useState({});
  const [showFiltros, setShowFiltros] = useState(false);
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [prospectoParaReasignar, setProspectoParaReasignar] = useState(null);
  const [vendedoresDisponibles, setVendedoresDisponibles] = useState([]);
  const [nuevoVendedorId, setNuevoVendedorId] = useState("");

  // Paginación (máximo 20 por página)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Estados para cambio de estado de prospectos
  const [editValues, setEditValues] = useState({});
  const [showModalCambioEstado, setShowModalCambioEstado] = useState(false);
  const [prospectoParaCambioEstado, setProspectoParaCambioEstado] = useState(null);

  // Estados: Modal de conversaciones WhatsApp
  const [modalConversaciones, setModalConversaciones] = useState(false);
  const [prospectoConversaciones, setProspectoConversaciones] = useState(null);
  const [conversacionesProspecto, setConversacionesProspecto] = useState([]);
  const [loadingConversaciones, setLoadingConversaciones] = useState(false);
  
  // Estados: Vista de mensajes individuales
  const [conversacionSeleccionada, setConversacionSeleccionada] = useState(null);
  const [mensajesConversacion, setMensajesConversacion] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  
  // Estados: Modal de carga múltiple de documentos
  const [showModalCargaDocumentos, setShowModalCargaDocumentos] = useState(false);
  const [polizaSeleccionadaDocumentos, setPolizaSeleccionadaDocumentos] = useState(null);
  const [recalculandoCotizacion, setRecalculandoCotizacion] = useState(null); // ✅ NUEVO: ID de cotización que se está recalculando

  useEffect(() => {
    fetchProspectos();
    fetchVendedoresDisponibles();
  }, []);

  useEffect(() => {
    // Auto refresh cada 30 segundos
    const interval = setInterval(() => {
      fetchProspectos();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Función para formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);
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
    const planColors = {
      "Básico": "success",
      "Intermedio": "warning", 
      "Premium": "danger",
      "Súper Premium": "primary"
    };
    return planColors[planNombre] || "secondary";
  };

  // Función para mostrar/ocultar detalles de cotización
  const toggleDetallesCotizacion = (index) => {
    setShowDetallesCotizacion(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // ✅ NUEVA: Función para recalcular cotización con precios actuales
  const handleRecalcularCotizacion = async (cotizacion) => {
    try {
      const { value: confirmed } = await Swal.fire({
        title: '¿Recalcular cotización?',
        html: `
          <div class="text-start">
            <p>Se actualizarán los precios de esta cotización con los valores actuales del sistema.</p>
            <p class="text-muted small mb-0">Los integrantes y promociones vigentes se mantendrán.</p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, recalcular',
        cancelButtonText: 'Cancelar'
      });

      if (!confirmed) return;

      const token = localStorage.getItem("cober_token");
      
      // Setear estado de recalculando
      setRecalculandoCotizacion(cotizacion.id);

      Swal.fire({
        title: 'Recalculando...',
        html: 'Por favor espere mientras se recalcula la cotización',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await axios.post(
        `${API_URL}/cotizaciones/${cotizacion.id}/recalcular`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const totales = response.data.data.nuevos_totales;
        const formatearAjuste = (valor) => {
          const num = parseFloat(valor || 0);
          const monto = Math.abs(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return num < 0 ? `+$${monto}` : `-$${monto}`;
        };
        Swal.fire({
          icon: 'success',
          title: 'Cotización actualizada',
          html: `
            <div class="text-start">
              <p><strong>Nuevos totales:</strong></p>
              <ul class="list-unstyled">
                <li>Precio lista: $${parseFloat(totales.total_bruto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                <li>Descuento aporte: -$${parseFloat(totales.total_descuento_aporte || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                <li>Promoción: ${formatearAjuste(totales.total_descuento_promocion)}</li>
                <li>Ajuste total: ${formatearAjuste(totales.total_descuento)}</li>
                <li>Total Final: <strong style="color: #28a745;">$${parseFloat(totales.total_final).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></li>
              </ul>
              <p class="text-muted small mt-3 mb-0">${response.data.data.integrantes_actualizados} integrante(s) actualizado(s)</p>
            </div>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#28a745'
        });

        // Recargar cotizaciones
        if (prospectoSeleccionado) {
          await handleOpenCotizacion(prospectoSeleccionado);
        }
      } else {
        Swal.fire('Error', response.data.message || 'No se pudo recalcular la cotización', 'error');
      }
    } catch (error) {
      console.error('Error al recalcular cotización:', error);
      Swal.fire(
        'Error',
        error.response?.data?.message || 'Error al recalcular la cotización',
        'error'
      );
    } finally {
      // Limpiar estado de recalculando
      setRecalculandoCotizacion(null);
    }
  };

  const fetchProspectos = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/prospectos/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProspectos(response.data);
    } catch (error) {
      console.error("Error al obtener prospectos:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los prospectos",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVendedoresDisponibles = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/vendedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendedoresDisponibles(response.data);
    } catch (error) {
      console.error("Error al obtener vendedores:", error);
    }
  };

  const fetchHistorial = async (prospectoId) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/prospectos/${prospectoId}/historial`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorial(response.data);
    } catch (error) {
      console.error("Error al obtener historial:", error);
      setHistorial([]);
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
  }

  function handleOpenHistorial(row) {
    setProspectoSeleccionado(row);
    setModalTipo("historial");
    fetchHistorial(row.id);
    setModalOpen(true);
  }

  async function handleOpenCotizacion(row) {
    setProspectoSeleccionado(row);
    setModalTipo("cotizacion");
    setModalOpen(true);
    setShowDetallesCotizacion({}); // Reset details visibility

    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/admin/prospectos/${row.id}/cotizaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Procesar las cotizaciones como en SupervisorDashboard
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
    setShowReasignarModal(true);
  }

  const handleReasignarProspecto = async () => {
    if (!nuevoVendedorId) {
      Swal.fire({
        icon: "warning",
        title: "Selecciona un vendedor",
        text: "Debes seleccionar un vendedor para la reasignación",
      });
      return;
    }

    try {
      const token = localStorage.getItem("cober_token");
      await axios.put(
        `${API_URL}/admin/prospectos/${prospectoParaReasignar.id}/reasignar`,
        { nuevo_vendedor_id: nuevoVendedorId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        icon: "success",
        title: "Prospecto reasignado",
        text: "El prospecto ha sido reasignado correctamente",
      });

      setShowReasignarModal(false);
      fetchProspectos();
    } catch (error) {
      console.error("Error al reasignar prospecto:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo reasignar el prospecto",
      });
    }
  };

  // Funciones para cambio de estado
  const handleCardChange = (id, field, value) => {
    setEditValues(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleOpenCambioEstado = (prospecto) => {
    setProspectoParaCambioEstado(prospecto);
    setEditValues({
      [prospecto.id]: {
        estado: prospecto.estado,
        notas: prospecto.notas || ""
      }
    });
    setShowModalCambioEstado(true);
  };

  const handleSaveEstado = async () => {
    if (!prospectoParaCambioEstado) return;

    try {
      const token = localStorage.getItem("cober_token");
      const values = editValues[prospectoParaCambioEstado.id];
      
      await axios.patch(
        `${API_URL}/admin/prospectos/${prospectoParaCambioEstado.id}/estado`,
        {
          estado: values.estado,
          notas: values.notas
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: "El estado del prospecto ha sido actualizado correctamente",
      });

      setShowModalCambioEstado(false);
      fetchProspectos();
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el estado del prospecto",
      });
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setProspectoSeleccionado(null);
  };

  // Funciones: Modal de conversaciones WhatsApp
  const handleEnviarWhatsApp = async (prospecto) => {
    try {
      setLoadingConversaciones(true);
      const token = localStorage.getItem("cober_token");
      
      // Obtener conversaciones del prospecto
      const response = await axios.get(
        `${API_URL}/admin/whatsapp/conversaciones/${prospecto.telefono}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const conversaciones = response.data.data || response.data;
      setConversacionesProspecto(conversaciones);
      setProspectoConversaciones(prospecto);
      
      // Si hay conversaciones, cargar automáticamente todos los mensajes
      if (conversaciones && conversaciones.length > 0) {
        await cargarTodosLosMensajes(conversaciones);
      }
      
      setModalConversaciones(true);
    } catch (error) {
      console.error("Error al obtener conversaciones:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudieron cargar las conversaciones de WhatsApp",
      });
    } finally {
      setLoadingConversaciones(false);
    }
  };

  // Nueva función para cargar todos los mensajes de todas las conversaciones
  const cargarTodosLosMensajes = async (conversaciones) => {
    try {
      const token = localStorage.getItem("cober_token");
      const promesas = conversaciones.map(conv => 
        axios.get(
          `${API_URL}/admin/whatsapp/conversacion/${conv.id}/mensajes`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      const respuestas = await Promise.all(promesas);
      
      // Combinar todos los mensajes y ordenarlos por fecha
      const todosMensajes = respuestas.flatMap(res => res.data.data || res.data);
      const mensajesOrdenados = todosMensajes.sort((a, b) => 
        new Date(a.fecha_envio) - new Date(b.fecha_envio)
      );
      
      setMensajesConversacion(mensajesOrdenados);
    } catch (error) {
      console.error("Error al cargar mensajes:", error);
    }
  };

  const handleVerConversacion = async (conversacion) => {
    try {
      setLoadingMensajes(true);
      const token = localStorage.getItem("cober_token");
      
      // Obtener mensajes de la conversación específica
      const response = await axios.get(
        `${API_URL}/admin/whatsapp/conversacion/${conversacion.id}/mensajes`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // La respuesta viene en el formato { success, data, total }
      setMensajesConversacion(response.data.data || response.data);
      setConversacionSeleccionada(conversacion);
    } catch (error) {
      console.error("Error al obtener mensajes:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudieron cargar los mensajes de la conversación",
      });
    } finally {
      setLoadingMensajes(false);
    }
  };

  const handleVolverAConversaciones = () => {
    setConversacionSeleccionada(null);
    setMensajesConversacion([]);
  };

  // Funciones: Gestión de documentos
  const handleAbrirCargaDocumentos = (poliza) => {
    setPolizaSeleccionadaDocumentos(poliza);
    setShowModalCargaDocumentos(true);
  };

  const handleCerrarCargaDocumentos = () => {
    setShowModalCargaDocumentos(false);
    setPolizaSeleccionadaDocumentos(null);
  };

  const handleDocumentosActualizados = () => {
    // Refrescar datos si es necesario
    fetchProspectos();
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      // Si ya viene en formato MySQL "YYYY-MM-DD HH:mm:ss", devolver tal cual
      if (typeof fecha === 'string' && /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.test(fecha)) {
        return fecha;
      }

      // Manejo seguro para strings sin zona horaria que vienen de MySQL (YYYY-MM-DD o YYYY-MM-DD HH:mm:ss)
      if (typeof fecha === 'string') {
        // ISO UTC (termina en Z) -> normalizar a "YYYY-MM-DD HH:mm:ss" sin corrimiento de zona
        const mIsoZ = fecha.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z$/);
        if (mIsoZ) {
          const [, y, m, d, hh, mm, ss] = mIsoZ;
          const s = ss || '00';
          return `${y}-${m}-${d} ${hh}:${mm}:${s}`;
        }

        // Solo fecha (tratar como fecha local, sin corrimiento de zona)
        const mDateOnly = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (mDateOnly) {
          const [, y, m, d] = mDateOnly;
          const dt = new Date(Number(y), Number(m) - 1, Number(d));
          return dt.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }

        // Fecha y hora sin zona (tratar como local) -> devolver en formato MySQL
        const mDateTime = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (mDateTime) {
          const [, y, m, d, hh, mm, ss] = mDateTime;
          // Normalizar a "YYYY-MM-DD HH:mm:ss"
          return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
        }
      }

      // ISO con zona u otros formatos válidos
      const dt = new Date(fecha);
      if (isNaN(dt.getTime())) return "Fecha inválida";
      // Formatear consistente a "YYYY-MM-DD HH:mm:ss"
      const pad = (n) => String(n).padStart(2, '0');
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    } catch (error) {
      return "Fecha inválida";
    }
  };

  const getEstadoConversacion = (estado) => {
    const estados = {
      'activa': { text: 'Activa', variant: 'success' },
      'pausada': { text: 'Pausada', variant: 'warning' },
      'cerrada': { text: 'Cerrada', variant: 'secondary' }
    };
    return estados[estado] || { text: estado, variant: 'info' };
  };

  const getEstadoTexto = (estado) => {
    const estados = {
      'entregado': 'Entregado',
      'leido': 'Leído',
      'enviado': 'Enviado',
      'pendiente': 'Pendiente',
      'fallido': 'Fallido'
    };
    return estados[estado] || estado;
  };

  const getTipoOrigen = (tipo) => {
    const tipos = {
      'enviado': 'Enviado',
      'recibido': 'Recibido',
      'sistema': 'Sistema'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoOrigenIcon = (tipo) => {
    const iconos = {
      'enviado': FaArrowUp,
      'recibido': FaArrowDown,
      'sistema': FaFileAlt
    };
    return iconos[tipo] || FaComment;
  };

  const maskPhoneNumber = (phone) => {
    if (!phone) return "No disponible";
    
    // Mostrar solo los últimos 4 dígitos para admin
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 4) {
      const masked = "*".repeat(cleanPhone.length - 4) + cleanPhone.slice(-4);
      return `+54 9 ${masked}`;
    }
    return phone;
  };

  const handleFiltroChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
    setCurrentPage(1);
  };

  const prospectosFiltrados = prospectosConVendedor.filter((p) => {
    return (
      (filtros.vendedor === "" || p.vendedor.toLowerCase().includes(filtros.vendedor.toLowerCase())) &&
      (filtros.nombre === "" || p.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) &&
      (filtros.apellido === "" || p.apellido.toLowerCase().includes(filtros.apellido.toLowerCase())) &&
      (filtros.estado === "" || p.estado === filtros.estado) &&
      (filtros.telefono === "" || (p.telefono && p.telefono.includes(filtros.telefono)))
    );
  });

  // Cálculo de paginación
  const totalItems = prospectosFiltrados.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const prospectosPagina = prospectosFiltrados.slice(startIndex, endIndex);

  // Ajustar página si cambia la cantidad total
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

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
    'Dato repetido',
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
    "Dato repetido": 0,
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

  // Función para obtener el color del estado basado en el progreso
  const getEstadoColor = (estado) => {
    const porcentaje = estadoPorcentaje[estado] || 0;
    if (porcentaje === 100) return "success";
    if (porcentaje >= 75) return "info";
    if (porcentaje >= 50) return "warning";
    if (porcentaje >= 25) return "primary";
    return "danger";
  };

  // Función para obtener la variante del botón del estado
  const getEstadoVariant = (estado) => {
    return `outline-${getEstadoColor(estado)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <div className="mt-2">Cargando prospectos...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Estilos CSS personalizados para optimizar 1366x768 */}
      
      <Container fluid className="" style={{ maxWidth: '1366px', margin: '0 auto' }}>
      {/* Header con estadísticas - Optimizado para 1366x768 */}
      <Row className="mb-2">
        <Col>
          <Card className="shadow-xs border-0">
            <Card.Body className="py-2">
              <Row className="items-center">
                <Col>
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight mb-0 text-primary" style={{ fontSize: '1.1rem' }}>
                    <FaUserFriends className="me-2" size={16} />
                    Prospectos - Vista Admin
                  </h5>
                  <p className="text-muted-foreground mb-0" style={{ fontSize: '0.8rem' }}>Gestión completa de todos los prospectos del sistema</p>
                </Col>
                <Col xs="auto">
                  <div className="flex gap-2 flex-wrap">
                    <div className="text-center px-2">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight mb-0 text-primary" style={{ fontSize: '1rem' }}>{prospectos.length}</h5>
                      <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>Total</small>
                    </div>
                    <div className="text-center px-2">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight mb-0 text-success" style={{ fontSize: '1rem' }}>
                        {prospectos.filter(p => p.estado === 'Venta').length}
                      </h5>
                      <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>Ventas</small>
                    </div>
                    <div className="text-center px-2">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight mb-0 text-info" style={{ fontSize: '1rem' }}>
                        {prospectos.filter(p => p.estado === 'Calificado Cotización').length}
                      </h5>
                      <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>Calificado Póliza</small>
                    </div>
                    <div className="text-center px-2">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight mb-0 text-warning" style={{ fontSize: '1rem' }}>
                        {prospectos.filter(p => p.estado === '1º Contacto').length}
                      </h5>
                      <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>1º Contacto</small>
                    </div>
                    <div className="text-center px-2">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight mb-0 text-teal" style={{ fontSize: '1rem' }}>
                        {prospectos.filter(p => p.estado === 'Calificado Pago').length}
                      </h5>
                      <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>Calificado Pago</small>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtros - Optimizados para 1366x768 */}
      <Row className="mb-2">
        <Col>
          <Card className="transition-shadow hover:shadow-md shadow-xs border-0">
            <Card.Header className="bg-muted py-2">
              <div className="flex justify-between items-center">
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0" style={{ fontSize: '0.9rem' }}>
                  <FaFilter className="me-2" size={14} />
                  Filtros
                </h6>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setShowFiltros(!showFiltros)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  {showFiltros ? "Ocultar" : "Mostrar"} Filtros
                </Button>
              </div>
            </Card.Header>
            <Collapse in={showFiltros}>
              <Card.Body className="py-2">
                <Row className="[--gx:0.5rem] [--gy:0.5rem]">
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Vendedor</Form.Label>
                      <Form.Control
                        type="text"
                        name="vendedor"
                        value={filtros.vendedor}
                        onChange={handleFiltroChange}
                        placeholder="Vendedor..."
                        size="sm"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Nombre</Form.Label>
                      <Form.Control
                        type="text"
                        name="nombre"
                        value={filtros.nombre}
                        onChange={handleFiltroChange}
                        placeholder="Nombre..."
                        size="sm"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Apellido</Form.Label>
                      <Form.Control
                        type="text"
                        name="apellido"
                        value={filtros.apellido}
                        onChange={handleFiltroChange}
                        placeholder="Apellido..."
                        size="sm"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Teléfono</Form.Label>
                      <Form.Control
                        type="text"
                        name="telefono"
                        value={filtros.telefono}
                        onChange={handleFiltroChange}
                        placeholder="Teléfono..."
                        size="sm"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Estado</Form.Label>
                      <Form.Select
                        name="estado"
                        value={filtros.estado}
                        onChange={handleFiltroChange}
                        size="sm"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <option value="">Todos los estados</option>
                        {estadosDisponibles.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={2} className="flex items-end">
                    <Button
                      variant="outline-secondary"
                      onClick={() => setFiltros({
                        vendedor: "",
                        edad: "",
                        estado: "",
                        nombre: "",
                        apellido: "",
                        telefono: "",
                      })}
                      className="w-full"
                      size="sm"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Limpiar
                    </Button>
                  </Col>
                </Row>
              </Card.Body>
            </Collapse>
          </Card>
        </Col>
      </Row>

      {/* Tabla de prospectos - Optimizada para 1366x768 */}
      <Row>
        <Col>
          <Card className="transition-shadow hover:shadow-md shadow-xs border-0">
            <Card.Header className="bg-card py-2">
              <div className="flex justify-between items-center">
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0" style={{ fontSize: '0.9rem' }}>
                  <FaUserFriends className="me-2 text-primary" size={14} />
                  Lista de Prospectos ({prospectosFiltrados.length})
                </h6>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={fetchProspectos}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  <FaSearch className="me-1" size={12} />
                  Actualizar
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="w-full overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <Table hover className="mb-0 text-sm [&_td]:py-1.5 [&_th]:py-1.5" size="sm">
                  <thead className="bg-muted/60 sticky top-0 z-[1020]">
                    <tr>
                      <th className="text-left" style={{ width: '18%', padding: '0.5rem 0.75rem' }}>Prospecto</th>
                      <th className="text-left" style={{ width: '15%', padding: '0.5rem 0.75rem' }}>Vendedor</th>
                      <th className="text-left" style={{ width: '20%', padding: '0.5rem 0.75rem' }}>Contacto</th>
                      <th className="text-left" style={{ width: '12%', padding: '0.5rem 0.75rem' }}>Estado</th>
                      <th className="text-left" style={{ width: '8%', padding: '0.5rem 0.75rem' }}>Edad</th>
                      <th className="text-left" style={{ width: '8%', padding: '0.5rem 0.75rem' }}>Reciclado</th>
                      <th className="text-left" style={{ width: '12%', padding: '0.5rem 0.75rem' }}>Fecha</th>
                      <th className="text-left" style={{ width: '15%', padding: '0.5rem 0.75rem' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospectosPagina.map((prospecto, index) => (
                      <tr key={prospecto.id} style={{ height: '60px' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div>
                            <div className="font-bold truncate" style={{ fontSize: '0.85rem', maxWidth: '140px' }}>
                              {prospecto.nombre} {prospecto.apellido}
                            </div>
                            <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>
                              ID: {prospecto.id}
                            </small>
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <Badge 
                            bg={prospecto.vendedor_id ? "success" : "warning"}
                            style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', maxWidth: '120px' }}
                            className="truncate block"
                          >
                            {((prospecto.vendedor || 'Sin asignar').length > 15) 
                              ? (prospecto.vendedor || 'Sin asignar').substring(0, 15) + '...' 
                              : (prospecto.vendedor || 'Sin asignar')}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div style={{ fontSize: '0.75rem' }}>
                            <div className="flex items-center mb-1">
                              <FaPhone className="me-1 text-muted-foreground" size={10} />
                              <small className="text-[0.875em] truncate" style={{ maxWidth: '100px' }}>
                                {prospecto.telefono || "No disponible"}
                              </small>
                            </div>
                            <div className="flex items-center">
                              <FaEnvelope className="me-1 text-muted-foreground" size={10} />
                              <small className="text-[0.875em] truncate" style={{ maxWidth: '100px' }}>
                                {prospecto.email}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <Badge 
                            bg={getEstadoColor(prospecto.estado)}
                            style={{ fontSize: '0.65rem', padding: '0.25rem 0.4rem' }}
                          >
                            {(((prospecto.estado || 'Sin asignar')).length > 10) 
                              ? (prospecto.estado || 'Sin asignar').substring(0, 10) + '...'
                              : (prospecto.estado || 'Sin asignar')}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-muted text-foreground" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }}>
                            {prospecto.edad || "N/A"}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {prospecto.es_reciclado ? (
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Refrito - Prospecto reciclado</Tooltip>}
                            >
                              <Badge bg="info" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                <FaRecycle className="me-1" />
                                Refrito
                              </Badge>
                            </OverlayTrigger>
                          ) : (
                            <Badge bg="light" text="muted" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                              -
                            </Badge>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <small className="text-[0.875em] text-muted-foreground" style={{ fontSize: '0.7rem' }}>
                            {formatearFecha(
                              // Priorizar fecha de asignación según requerimiento
                              prospecto.fecha_asignacion ||
                              prospecto.fecha_estado ||
                              prospecto.asignacion_fecha ||
                              prospecto.fecha_registro
                            )}
                          </small>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div className="flex gap-1 flex-wrap">
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Ver detalles</Tooltip>}
                            >
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleOpenModal(prospecto)}
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              >
                                <FaEye size={12} />
                              </Button>
                            </OverlayTrigger>

                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Ver historial</Tooltip>}
                            >
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => handleOpenHistorial(prospecto)}
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              >
                                <FaFileAlt size={12} />
                              </Button>
                            </OverlayTrigger>

                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Ver cotizaciones</Tooltip>}
                            >
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => handleOpenCotizacion(prospecto)}
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              >
                                <FaMoneyBillWave size={12} />
                              </Button>
                            </OverlayTrigger>

                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>WhatsApp</Tooltip>}
                            >
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => handleEnviarWhatsApp(prospecto)}
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              >
                                <FaWhatsapp size={12} />
                              </Button>
                            </OverlayTrigger>

                            <Dropdown>
                              <Dropdown.Toggle
                                variant="outline-secondary"
                                size="sm"
                                id={`dropdown-${prospecto.id}`}
                                style={{ padding: '0.25rem 0.4rem', fontSize: '0.7rem' }}
                              >
                                <FaUserShield size={12} />
                              </Dropdown.Toggle>
                              <Dropdown.Menu style={{ fontSize: '0.8rem' }}>
                                <Dropdown.Item
                                  onClick={() => handleOpenCambioEstado(prospecto)}
                                >
                                  <FaEdit className="me-2" size={12} />
                                  Cambiar Estado
                                </Dropdown.Item>
                                <Dropdown.Item
                                  onClick={() => handleOpenReasignar(prospecto)}
                                >
                                  <FaExchangeAlt className="me-2" size={12} />
                                  Reasignar Vendedor
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {prospectosFiltrados.length === 0 && (
                <div className="text-center py-12">
                  <FaUserFriends className="text-muted-foreground mb-4" size={48} />
                  <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">No se encontraron prospectos</h5>
                  <p className="mb-4 text-muted-foreground">
                    {prospectos.length === 0 
                      ? "No hay prospectos registrados en el sistema."
                      : "No hay prospectos que coincidan con los filtros aplicados."}
                  </p>
                </div>
              )}
              {prospectosFiltrados.length > 0 && (
                <div className="flex justify-between items-center px-4 py-2">
                  <small className="text-[0.875em] text-muted-foreground">
                    Mostrando {totalItems === 0 ? 0 : (startIndex + 1)}–{endIndex} de {totalItems}
                  </small>
                  <Pagination className="mb-0">
                    <Pagination.First disabled={currentPage === 1} onClick={() => setCurrentPage(1)} />
                    <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
                    {(() => {
                      const items = [];
                      const maxAround = 2;
                      let start = Math.max(1, currentPage - maxAround);
                      let end = Math.min(totalPages, currentPage + maxAround);
                      if (currentPage <= 3) {
                        start = 1;
                        end = Math.min(totalPages, 5);
                      } else if (currentPage >= totalPages - 2) {
                        end = totalPages;
                        start = Math.max(1, totalPages - 4);
                      }
                      if (start > 1) {
                        items.push(
                          <Pagination.Item key={1} active={1 === currentPage} onClick={() => setCurrentPage(1)}>1</Pagination.Item>
                        );
                      }
                      if (start > 2) {
                        items.push(<Pagination.Ellipsis key="start-ellipsis" disabled />);
                      }
                      for (let page = start; page <= end; page++) {
                        items.push(
                          <Pagination.Item key={page} active={page === currentPage} onClick={() => setCurrentPage(page)}>
                            {page}
                          </Pagination.Item>
                        );
                      }
                      if (end < totalPages - 1) {
                        items.push(<Pagination.Ellipsis key="end-ellipsis" disabled />);
                      }
                      if (end < totalPages) {
                        items.push(
                          <Pagination.Item key={totalPages} active={totalPages === currentPage} onClick={() => setCurrentPage(totalPages)}>
                            {totalPages}
                          </Pagination.Item>
                        );
                      }
                      return items;
                    })()}
                    <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
                    <Pagination.Last disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} />
                  </Pagination>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* MODALES */}
      
      {/* Modal de detalles/historial/cotizaciones */}
      <Modal show={modalOpen} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalTipo === "detalle" && (
              <>
                <FaUser className="me-2" />
                Detalles del Prospecto
              </>
            )}
            {modalTipo === "historial" && (
              <>
                <FaFileAlt className="me-2" />
                Historial del Prospecto
              </>
            )}
            {modalTipo === "cotizacion" && (
              <>
                <FaMoneyBillWave className="me-2" />
                Cotizaciones del Prospecto
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prospectoSeleccionado && modalTipo === "detalle" && (
            <div>
              <Row>
                <Col md={6}>
                  <Card className="mb-4">
                    <Card.Header>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">
                        <FaUser className="me-2" />
                        Información Personal
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <div className="mb-2">
                        <strong>Nombre:</strong> {prospectoSeleccionado.nombre}
                      </div>
                      <div className="mb-2">
                        <strong>Apellido:</strong> {prospectoSeleccionado.apellido}
                      </div>

                      <div className="mb-2">
                        <strong>Edad:</strong> {prospectoSeleccionado.edad || "No disponible"} años
                      </div>
                      <div className="mb-2">
                        <strong>Fecha de Nacimiento:</strong> {prospectoSeleccionado.fecha_nacimiento || "No disponible"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                
                <Col md={6}>
                  <Card className="mb-4">
                    <Card.Header>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">
                        <FaEnvelope className="me-2" />
                        Información de Contacto
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <div className="mb-2">
                        <strong>Teléfono:</strong> {prospectoSeleccionado.telefono || "No disponible"}
                      </div>
                      <div className="mb-2">
                        <strong>Email:</strong> {prospectoSeleccionado.email}
                      </div>
                      <div className="mb-2">
                        <strong>Provincia:</strong> {prospectoSeleccionado.provincia || "No disponible"}
                      </div>
                      <div className="mb-2">
                        <strong>Localidad:</strong> {prospectoSeleccionado.localidad || "No disponible"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Card className="mb-4">
                    <Card.Header>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">
                        <FaUserCheck className="me-2" />
                        Estado y Vendedor
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <div className="mb-2">
                        <strong>Estado:</strong>{" "}
                        <Badge bg={getEstadoColor(prospectoSeleccionado.estado)}>
                          {prospectoSeleccionado.estado}
                        </Badge>
                      </div>
                      <div className="mb-2">
                        <strong>Vendedor:</strong> {prospectoSeleccionado.vendedor}
                      </div>
                      <div className="mb-2">
                        <strong>
                          {prospectoSeleccionado.fecha_asignacion
                            ? 'Fecha de Asignación:'
                            : prospectoSeleccionado.fecha_estado
                              ? 'Fecha de Estado:'
                              : 'Fecha de Registro:'}
                        </strong>{' '}
                        {formatearFecha(
                          // Priorizar fecha de asignación según requerimiento
                          prospectoSeleccionado.fecha_asignacion ||
                          prospectoSeleccionado.fecha_estado ||
                          prospectoSeleccionado.asignacion_fecha ||
                          prospectoSeleccionado.fecha_registro
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="mb-4">
                    <Card.Header>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">
                        <FaComment className="me-2" />
                        Notas
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                        {prospectoSeleccionado.notas || "Sin notas registradas"}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          {modalTipo === "historial" && (
            <div>
              {historial.length > 0 ? (
                <div className="relative flex flex-col gap-4 border-l-2 border-border pl-6">
                  {historial.map((evento, index) => (
                    <div key={index} className="relative">
                      <div className="absolute top-1 -left-[31px] size-3.5 rounded-full border-2 border-card bg-primary">
                        <FaInfoCircle className="text-primary" />
                      </div>
                      <div className="rounded-md border bg-card p-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <strong>{evento.accion}</strong>
                          <small className="text-[0.875em] text-muted-foreground ms-2">
                            {formatearFecha(evento.fecha)}
                          </small>
                        </div>
                        <div className="text-sm">
                          {evento.descripcion}
                        </div>
                        {evento.usuario && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <small className="text-[0.875em] text-muted-foreground">
                              Por: {evento.usuario}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FaInfoCircle className="text-muted-foreground mb-4" size={48} />
                  <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">Sin historial</h5>
                  <p className="mb-4 text-muted-foreground">
                    Este prospecto no tiene historial registrado.
                  </p>
                </div>
              )}
            </div>
          )}

          {modalTipo === "cotizacion" && (
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
                        <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white font-bold text-base text-foreground ${getPlanColorClass(cotizacion.plan_nombre)} px-4 py-2 rounded-full`}>
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
                          <div className="text-muted-foreground text-[0.875em]">Precio de Lista</div>
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
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => toggleDetallesCotizacion(index)}
                          className="flex-auto md:grow-0"
                        >
                          <FaEye className="me-1" />
                          {showDetallesCotizacion[index] ? 'Ocultar' : 'Ver'} Detalles
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleRecalcularCotizacion(cotizacion)}
                          disabled={recalculandoCotizacion === cotizacion.id}
                          className="flex-auto md:grow-0"
                        >
                          {recalculandoCotizacion === cotizacion.id ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-1" />
                              Recalculando...
                            </>
                          ) : (
                            <>
                              <FaExchangeAlt className="me-1" />
                              Actualizar Precios
                            </>
                          )}
                        </Button>
                      </div>
                      {showDetallesCotizacion[index] && (
                        <div className="mt-4 border-t pt-4">
                          {cotizacion.detalles && cotizacion.detalles.length > 0 ? (
                            <>
                              {/* Vista de escritorio - Tabla con scroll horizontal */}
                              <div className="hidden lg:block">
                                <Alert variant="info" className="py-2 mb-2 flex items-center" style={{ fontSize: '0.8rem' }}>
                                  <FaArrowRight className="me-2" />
                                  <span>Desplázate horizontalmente para ver todas las columnas →</span>
                                </Alert>
                                <div 
                                  className="w-full overflow-x-auto" 
                                  style={{ 
                                    overflowX: 'auto', 
                                    maxWidth: '100%',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '0.375rem'
                                  }}
                                >
                                  <Table size="sm" className="mb-0 [&_tbody_tr:nth-child(odd)]:bg-muted/40 align-middle" style={{ minWidth: '1000px' }}>
                                    <thead className="bg-muted/60">
                                      <tr>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '120px', position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>Persona</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '100px' }}>Vínculo</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '60px' }}>Edad</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '150px' }}>Tipo Afiliación</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '110px' }}>Base</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '120px' }}>Desc. Aporte</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '130px' }}>Desc. Promoción</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '180px' }}>Promoción</th>
                                        <th className="text-left text-[0.875em]" style={{ minWidth: '110px' }}>Final</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {cotizacion.detalles.map((detalle, idx) => (
                                        <tr key={detalle.id || idx}>
                                          <td className="text-[0.875em]" style={{ position: 'sticky', left: 0, backgroundColor: idx % 2 === 0 ? '#ffffff' : 'rgba(0,0,0,0.02)', zIndex: 9 }}>
                                            <strong>{detalle.persona}</strong>
                                          </td>
                                          <td className="text-[0.875em]">{detalle.vinculo}</td>
                                          <td className="text-[0.875em] text-center">{detalle.edad}</td>
                                          <td className="text-[0.875em]">
                                            <div>{detalle.tipo_afiliacion_completo || detalle.tipo_afiliacion}</div>
                                            {detalle.categoria_monotributo && (
                                              <div>
                                                <small className="text-[0.875em] text-muted-foreground">
                                                  Aporte: {formatCurrency(detalle.categoria_monotributo_aporte)}
                                                </small>
                                              </div>
                                            )}
                                          </td>
                                          <td className="text-[0.875em] text-right">{formatCurrency(detalle.precio_base)}</td>
                                          <td className="text-[0.875em] text-right">
                                            <div>{formatCurrency(detalle.descuento_aporte)}</div>
                                            {parseFloat(detalle.descuento_aporte || 0) > 0 && (
                                              <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-info text-white" style={{ fontSize: '0.65rem' }}>Aporte</span>
                                            )}
                                          </td>
                                          <td className="text-[0.875em] text-right">
                                            {(() => {
                                              const info = getInfoPromocion(detalle.descuento_promocion);
                                              return (
                                                <>
                                                  <div className={info.textClass}>{info.monto}</div>
                                                  {parseFloat(detalle.descuento_promocion || 0) !== 0 && (
                                                    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${info.badgeClass}`} style={{ fontSize: '0.65rem' }}>{info.label}</span>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </td>
                                          <td className="text-[0.875em]">
                                            {detalle.promocion_aplicada
                                              ? <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${getInfoPromocion(detalle.descuento_promocion).badgeClass}`} style={{ fontSize: '0.7rem' }}>{detalle.promocion_aplicada}</span>
                                              : <span className="text-muted-foreground text-[0.875em]">Sin promoción</span>
                                            }
                                          </td>
                                          <td className="font-bold text-success text-[0.875em] text-right">{formatCurrency(detalle.precio_final)}</td>
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
                                          <div className="font-bold">{detalle.persona}</div>
                                          <small className="text-[0.875em] text-muted-foreground">{detalle.vinculo} • {detalle.edad} años</small>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold text-success">{formatCurrency(detalle.precio_final)}</div>
                                          <small className="text-[0.875em] text-muted-foreground">Final</small>
                                        </div>
                                      </div>
                                      <Row className="[--gx:0.5rem] [--gy:0.5rem] mb-2">
                                        <Col xs={6}>
                                          <div className="text-muted-foreground text-[0.875em]">Base</div>
                                          <div className="font-bold text-[0.875em]">{formatCurrency(detalle.precio_base)}</div>
                                        </Col>
                                        <Col xs={6}>
                                          <div className="text-muted-foreground text-[0.875em]">Afiliación</div>
                                          <div className="font-bold text-[0.875em]">
                                            {detalle.tipo_afiliacion_completo || detalle.tipo_afiliacion}
                                          </div>
                                          {detalle.categoria_monotributo && (
                                            <div className="text-muted-foreground text-[0.875em]">
                                              Aporte: {formatCurrency(detalle.categoria_monotributo_aporte)}
                                            </div>
                                          )}
                                        </Col>
                                      </Row>
                                      {(parseFloat(detalle.descuento_aporte || 0) > 0 || parseFloat(detalle.descuento_promocion || 0) !== 0) && (
                                        <div className="border-t pt-2">
                                          {parseFloat(detalle.descuento_aporte || 0) > 0 && (
                                            <div className="flex justify-between text-[0.875em]">
                                              <span>Descuento Aporte:</span>
                                              <span className="text-info">{formatCurrency(detalle.descuento_aporte)}</span>
                                            </div>
                                          )}
                                          {parseFloat(detalle.descuento_promocion || 0) !== 0 && (
                                            <div className="flex justify-between text-[0.875em]">
                                              <span>{getInfoPromocion(detalle.descuento_promocion).esIncremento ? 'Incremento:' : 'Descuento Promoción:'}</span>
                                              <span className={getInfoPromocion(detalle.descuento_promocion).textClass}>{getInfoPromocion(detalle.descuento_promocion).monto}</span>
                                            </div>
                                          )}
                                          {detalle.promocion_aplicada && (
                                            <div className="text-center mt-1">
                                              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${getInfoPromocion(detalle.descuento_promocion).badgeClass}`}>{detalle.promocion_aplicada}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </Card.Body>
                                  </Card>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground text-center py-2">
                              <small className="text-[0.875em]">Sin detalles disponibles</small>
                            </div>
                          )}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </div>
            )
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de reasignación de vendedor */}
      <Modal show={showReasignarModal} onHide={() => setShowReasignarModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExchangeAlt className="me-2" />
            Reasignar Vendedor
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prospectoParaReasignar && (
            <div>
              <Alert variant="info">
                <FaInfoCircle className="me-2" />
                Reasignando el prospecto: <strong>{prospectoParaReasignar.nombre} {prospectoParaReasignar.apellido}</strong>
              </Alert>
              
              <Form.Group>
                <Form.Label>Seleccionar nuevo vendedor:</Form.Label>
                <Form.Select
                  value={nuevoVendedorId}
                  onChange={(e) => setNuevoVendedorId(e.target.value)}
                >
                  <option value="">-- Seleccionar vendedor --</option>
                  {vendedoresDisponibles.map(vendedor => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.first_name} {vendedor.last_name} ({vendedor.email})
                    </option>
                  ))}
                </Form.Select>
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
            onClick={handleReasignarProspecto}
            disabled={!nuevoVendedorId}
          >
            Reasignar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de cambio de estado */}
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
                <FaInfoCircle className="me-2" />
                Editando: <strong>{prospectoParaCambioEstado.nombre} {prospectoParaCambioEstado.apellido}</strong>
              </Alert>
              
              <Form.Group className="mb-4">
                <Form.Label>Estado:</Form.Label>
                <Form.Select
                  value={editValues[prospectoParaCambioEstado.id]?.estado || ""}
                  onChange={(e) => handleCardChange(prospectoParaCambioEstado.id, "estado", e.target.value)}
                >
                  {estadosDisponibles.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group>
                <Form.Label>Notas:</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={editValues[prospectoParaCambioEstado.id]?.notas || ""}
                  onChange={(e) => handleCardChange(prospectoParaCambioEstado.id, "notas", e.target.value)}
                  placeholder="Agregar notas sobre el cambio de estado..."
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModalCambioEstado(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveEstado}>
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de conversaciones WhatsApp */}
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
                  <div 
                    key={mensaje.id || index} 
                    className={`flex mb-4 ${esEnviado ? 'justify-end' : 'justify-start'}`}
                  >
                    <div style={{ maxWidth: '75%' }}>
                      <Card 
                        className="transition-shadow hover:shadow-md shadow-xs"
                        style={{ 
                          backgroundColor: esEnviado ? '#ffffff' : '#e9ecef',
                          borderRadius: '12px'
                        }}
                      >
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
                          
                          <p className="mb-2" style={{ color: '#212529', fontSize: '0.95rem' }}>
                            {mensaje.contenido}
                          </p>
                          
                          {/* Mostrar archivo si existe */}
                          {mensaje.archivo_url && (
                            <div className="mt-2 mb-2">
                              <Badge bg="secondary" className="flex items-center" style={{ width: 'fit-content' }}>
                                <FaFile className="me-1" />
                                {mensaje.archivo_nombre || "Archivo adjunto"}
                                {mensaje.archivo_tamaño && ` (${(mensaje.archivo_tamaño / 1024).toFixed(2)} KB)`}
                              </Badge>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <small className="text-[0.875em] text-muted-foreground">
                              <FaCalendarAlt size={10} className="me-1" />
                              {formatearFecha(mensaje.fecha_envio)}
                            </small>
                            {mensaje.estado && (
                              <Badge 
                                bg="light" 
                                text="dark"
                                className="ms-2"
                              >
                                {getEstadoTexto(mensaje.estado)}
                              </Badge>
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
              <p className="mb-4 text-muted-foreground">
                No se encontraron conversaciones de WhatsApp para este prospecto.
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <FaComment className="text-muted-foreground mb-4" size={64} />
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-muted-foreground">Sin mensajes</h5>
              <p className="mb-4 text-muted-foreground">
                Las conversaciones no tienen mensajes registrados.
              </p>
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
      </Container>
    </>
  );
};

export default ProspectosAdmin;