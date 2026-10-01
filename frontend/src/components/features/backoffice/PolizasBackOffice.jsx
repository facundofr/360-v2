import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Card, Table, Button, Form, Badge, Spinner, ButtonGroup, Alert, Modal, Toast, ToastContainer, Accordion, Nav, Tab, Tabs } from "@/components/compat/bootstrap";
import { 
  FaEye, FaDownload, FaWhatsapp, FaFilter, FaList, FaThLarge, FaFileAlt, FaUsers, FaMoneyBillWave, 
  FaChartLine, FaFile, FaBuilding, FaUserTie, FaGlobe, FaSearch, FaEdit, FaExchangeAlt, FaComments, 
  FaUpload, FaTimes, FaCheck, FaExclamationTriangle, FaPlus, FaTrash, FaFileUpload, FaHistory,
  FaCalendarAlt, FaHourglassHalf, FaCheckCircle, FaUser, FaFileInvoiceDollar, FaInfoCircle, FaSave, FaCopy
} from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";
import BotonEnviarFirma from '../../buttons/BotonEnviarFirma';
import BadgeEstadoFirma from '../../badges/BadgeEstadoFirma';
import CargarPolizaFirmadaModal from '../../modals/CargarPolizaFirmadaModal';
import BotonesEliminarFirma from '../../buttons/BotonesEliminarFirma';
import BotonEliminarPoliza from '../../buttons/BotonEliminarPoliza';
import EditarPolizaModal from '../vendedor/modals/EditarPolizaModal';
import SubirDocumentosLibresModal from '../vendedor/modals/SubirDocumentosLibresModal';
import BotonDescargarPolizaFirmada from '../../buttons/BotonDescargarPolizaFirmada';
import BotonConsultarEstadoFirma from '../../buttons/BotonConsultarEstadoFirma';
import useNotificacionesFirmaPolizas from '../../../hooks/useNotificacionesFirmaPolizas';
// import CargaDocumentosModal from '../supervisor/components/CargaDocumentosModal';

const PolizasBackOffice = () => {
  const [polizas, setPolizas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState({
    periodo_descripcion: '',
    resumen: {},
    metricas_calculadas: {},
    por_supervisor: []
  });
  const [filtros, setFiltros] = useState({
    estado: 'todos',
    vendedor_id: 'todos',
    supervisor_id: 'todos', // ✅ Filtro específico de Back Office
    plan: 'todos',
    estado_firma: 'todos',
    desde: '',
    hasta: '',
    buscar: '',
    orden: 'mas_nuevos'
  });
  const [tipoVista, setTipoVista] = useState('tabla');
  const [paginacion, setPaginacion] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });
  const [opcionesFiltro, setOpcionesFiltro] = useState({
    vendedores: [],
    supervisores: [], // ✅ Lista completa de supervisores
    planes: [],
    estados: []
  });
  const [showFiltros, setShowFiltros] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  // ✅ NUEVOS ESTADOS PARA GESTIÓN DE DOCUMENTOS
  const [modalDocumentos, setModalDocumentos] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState(null);
  const [documentos, setDocumentos] = useState({});
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // ✅ NUEVOS ESTADOS PARA CAMBIO DE ESTADO
  const [modalCambiarEstado, setModalCambiarEstado] = useState(false);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('');
  const [motivoCambio, setMotivoCambio] = useState('');
  const [polizaCambioEstado, setPolizaCambioEstado] = useState(null);
  const [loadingCambioEstado, setLoadingCambioEstado] = useState(false);

  // ✅ ESTADOS PARA EDICIÓN (usando EditarPolizaModal estandarizado)
  const [modalEditarPoliza, setModalEditarPoliza] = useState(false);
  const [polizaEdicion, setPolizaEdicion] = useState(null);

  // ✅ ESTADOS PARA SUBIR DOCUMENTOS LIBRES
  const [showSubirDocumentosModal, setShowSubirDocumentosModal] = useState(false);
  const [polizaSubirDocumentos, setPolizaSubirDocumentos] = useState(null);

  // ✅ NUEVOS ESTADOS PARA CONVERSACIONES WHATSAPP
  const [modalConversaciones, setModalConversaciones] = useState(false);
  const [conversacionesProspecto, setConversacionesProspecto] = useState([]);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [loadingConversaciones, setLoadingConversaciones] = useState(false);

  // ✅ NUEVOS ESTADOS PARA CARGA DE DOCUMENTOS
  const [modalCargaDocumentos, setModalCargaDocumentos] = useState(false);
  const [polizaCargaDocumentos, setPolizaCargaDocumentos] = useState(null);

  // ✅ NUEVOS ESTADOS PARA HISTORIAL DE ESTADOS Y COMENTARIOS
  const [modalHistorial, setModalHistorial] = useState(false);
  const [historialEstados, setHistorialEstados] = useState([]);
  const [polizaHistorial, setPolizaHistorial] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // ✅ ESTADOS PARA TOAST NOTIFICATIONS
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState('success');

  // ✅ ESTADOS PARA FIRMA ELECTRÓNICA
  const [estadoFirma, setEstadoFirma] = useState({});

  // ✅ ESTADOS PARA CARGAR PÓLIZA FIRMADA
  const [modalCargarPolizaFirmada, setModalCargarPolizaFirmada] = useState(false);
  const [polizaParaCargar, setPolizaParaCargar] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    fetchPolizas();
    fetchOpcionesFiltro();
    fetchEstadisticas();
  }, []);

  // Recargar cuando cambien los filtros
  useEffect(() => {
    fetchPolizas();
  }, [filtros, paginacion.current_page]);

  // ✅ Actualizar estado de firma en tiempo real vía WebSocket, sin recargar la página
  useNotificacionesFirmaPolizas(
    polizas.map(p => p.id),
    useCallback((polizaId, estado) => {
      setPolizas(prev => prev.map(p =>
        String(p.id) === String(polizaId) ? { ...p, estado_firma: estado } : p
      ));
    }, [])
  );

  // ✅ Actualizar estado de firma tras una consulta manual (botón "Consultar estado")
  const handleEstadoFirmaConsultado = useCallback((polizaId, estadoLocal) => {
    setPolizas(prev => prev.map(p =>
      String(p.id) === String(polizaId) ? { ...p, estado_firma: estadoLocal } : p
    ));
    showToastMessage(`Estado de firma actualizado: ${estadoLocal || 'sin cambios'}`, 'info');
  }, []);

  const fetchPolizas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");

      // Construir params sin enviar valores 'todos'
      const filtrosLimpios = Object.fromEntries(
        Object.entries(filtros).filter(([, valor]) => valor !== 'todos' && valor !== '')
      );

      const params = new URLSearchParams({
        page: paginacion.current_page,
        limit: paginacion.per_page,
        ...filtrosLimpios
      });

      // ✅ USAR ENDPOINT ESPECÍFICO DE BACK OFFICE
      const { data } = await axios.get(
        `${API_URL}/backoffice/polizas?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPolizas(data.data);
      setPaginacion(prev => ({
        ...prev,
        ...data.pagination
      }));

    } catch (error) {
      console.error("Error cargando pólizas:", error);
      Swal.fire("Error", "No se pudieron cargar las pólizas", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      setLoadingStats(true);
      const token = localStorage.getItem("cober_token");
      
      const { data } = await axios.get(
        `${API_URL}/backoffice/polizas/estadisticas`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEstadisticas(data.data);
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchOpcionesFiltro = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/backoffice/polizas/filtros`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOpcionesFiltro(data.data);
    } catch (error) {
      console.error("Error cargando opciones de filtro:", error);
    }
  };

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
    setPaginacion(prev => ({ ...prev, current_page: 1 }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      estado: 'todos',
      vendedor_id: 'todos',
      supervisor_id: 'todos',
      plan: 'todos',
      estado_firma: 'todos',
      desde: '',
      hasta: '',
      buscar: '',
      orden: 'mas_nuevos'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount || 0);
  };

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR');
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      'asesor': { bg: 'info', text: 'Asesor' },
      'supervisor': { bg: 'warning', text: 'Supervisor' },
      'back_office': { bg: 'primary', text: 'Back Office' },
      'venta_cerrada': { bg: 'success', text: 'Venta Cerrada' },
      'venta_rechazada': { bg: 'danger', text: 'Venta Rechazada' },
      // Estados legacy para compatibilidad
      'pendiente_revision': { bg: 'info', text: 'Asesor' },
      'cerrada': { bg: 'success', text: 'Venta Cerrada' }
    };
    return estados[estado] || { bg: 'secondary', text: estado };
  };

  const handleDescargarPDF = (poliza) => {
    if (poliza.pdf_hash) {
      window.open(`${API_URL}/polizas/pdf/${poliza.pdf_hash}`, '_blank');
    } else {
      window.open(poliza.urls?.pdf || '#', '_blank');
    }
  };

  // ✅ NUEVA FUNCIÓN: Ver documentos de la póliza
  const handleVerDocumentos = async (poliza) => {
    try {
      setPolizaSeleccionada(poliza);
      setModalDocumentos(true);
      setLoadingDocumentos(true);

      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/polizas/${poliza.id}/documentos`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setDocumentos(response.data.documentos || {});
      }
    } catch (error) {
      console.error('Error cargando documentos:', error);
      showToastMessage('Error al cargar documentos', 'danger');
    } finally {
      setLoadingDocumentos(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Descargar documento específico
  const handleDescargarDocumento = async (documentoId, nombreOriginal) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await fetch(`${API_URL}/backoffice/polizas/documentos/${documentoId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreOriginal;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error descargando documento:', error);
      showToastMessage('Error al descargar documento', 'danger');
    }
  };

  // ✅ NUEVA FUNCIÓN: Eliminar documento
  const handleEliminarDocumento = async (documentoId) => {
    const result = await Swal.fire({
      title: '¿Eliminar documento?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('cober_token');
        await axios.delete(`${API_URL}/backoffice/polizas/documentos/${documentoId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        showToastMessage('Documento eliminado correctamente', 'success');
        // Recargar documentos
        if (polizaSeleccionada) {
          handleVerDocumentos(polizaSeleccionada);
        }
      } catch (error) {
        console.error('Error eliminando documento:', error);
        showToastMessage('Error al eliminar documento', 'danger');
      }
    }
  };

  // ✅ NUEVA FUNCIÓN: Preview de documento
  const handlePreviewDocumento = async (documentoId, tipoMime) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await fetch(`${API_URL}/backoffice/polizas/documentos/${documentoId}/preview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewMime(tipoMime);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error previsualizando documento:', error);
      showToastMessage('Error al previsualizar documento', 'danger');
    }
  };

  // ✅ NUEVA FUNCIÓN: Cambiar estado de póliza
  const handleCambiarEstado = (poliza) => {
    setPolizaCambioEstado(poliza);
    setEstadoSeleccionado('');
    setMotivoCambio('');
    setModalCambiarEstado(true);
  };

  const confirmarCambioEstado = async () => {
    if (!estadoSeleccionado || !motivoCambio.trim()) {
      showToastMessage('Debe seleccionar un estado y proporcionar un motivo', 'warning');
      return;
    }

    try {
      setLoadingCambioEstado(true);
      const token = localStorage.getItem('cober_token');
      
      const response = await axios.patch(
        `${API_URL}/backoffice/polizas/${polizaCambioEstado.id}/estado`,
        {
          estado: estadoSeleccionado,
          motivo_cambio_estado: motivoCambio
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        showToastMessage('Estado actualizado correctamente', 'success');
        setModalCambiarEstado(false);
        fetchPolizas(); // Recargar la lista
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showToastMessage('Error al cambiar estado', 'danger');
    } finally {
      setLoadingCambioEstado(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Ver conversaciones WhatsApp
  const handleVerConversaciones = async (poliza) => {
    try {
      setProspectoSeleccionado({
        id: poliza.prospecto_id,
        nombre: poliza.prospecto_nombre,
        apellido: poliza.prospecto_apellido,
        telefono: poliza.prospecto_telefono
      });
      setModalConversaciones(true);
      setLoadingConversaciones(true);

      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/polizas/prospectos/${poliza.prospecto_id}/conversaciones`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setConversacionesProspecto(response.data.data.conversaciones || []);
      }
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      showToastMessage('Error al cargar conversaciones', 'danger');
    } finally {
      setLoadingConversaciones(false);
    }
  };

  // ✅ FUNCIÓN: Abrir modal estandarizado de edición de póliza
  const handleEditarPoliza = (poliza) => {
    setPolizaEdicion(poliza);
    setModalEditarPoliza(true);
  };

  const handleSubirDocumentosLibres = (poliza) => {
    setPolizaSubirDocumentos(poliza);
    setShowSubirDocumentosModal(true);
  };

  // ✅ NUEVA FUNCIÓN: Ver historial de estados y comentarios
  const handleVerHistorial = async (poliza) => {
    try {
      setPolizaHistorial(poliza);
      setModalHistorial(true);
      setLoadingHistorial(true);

      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/backoffice/polizas/${poliza.id}/historial`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setHistorialEstados(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      showToastMessage('Error al cargar historial de estados', 'danger');
      setHistorialEstados([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Cargar documentos
  const handleAbrirCargaDocumentos = (poliza) => {
    setPolizaCargaDocumentos(poliza);
    setModalCargaDocumentos(true);
  };

  const handleDocumentosActualizados = async () => {
    setModalCargaDocumentos(false);
    showToastMessage('Documentos cargados correctamente', 'success');
    // Recargar documentos si el modal está abierto
    if (modalDocumentos && polizaSeleccionada) {
      handleVerDocumentos(polizaSeleccionada);
    }
  };

  // ✅ FUNCIÓN HELPER: Mostrar toast
  const showToastMessage = (message, variant = 'success') => {
    setToastMessage(message);
    setToastVariant(variant);
    setShowToast(true);
  };

  // ✅ NUEVA FUNCIÓN: Abrir modal de carga de póliza firmada
  const handleAbrirCargarPolizaFirmada = (poliza) => {
    setPolizaParaCargar(poliza);
    setModalCargarPolizaFirmada(true);
  };

  // ✅ NUEVA FUNCIÓN: Callback cuando se carga exitosamente la póliza firmada
  const handlePolizaFirmadaCargada = (resultado) => {
    showToastMessage('✅ Póliza firmada cargada exitosamente. Google Sheets actualizado automáticamente.', 'success');
    setModalCargarPolizaFirmada(false);
    setPolizaParaCargar(null);
    fetchPolizas(); // Recargar lista de pólizas
    
    // Si el modal de documentos está abierto, recargar documentos
    if (modalDocumentos && polizaSeleccionada) {
      handleVerDocumentos(polizaSeleccionada);
    }
  };

  // ✅ FUNCIÓN HELPER: Formatear preguntas de declaración de salud - COMPLETA
  const formatearPregunta = (key) => {
    const preguntas = {
      'internacion': '¿Ha tenido internaciones en los últimos 5 años?',
      'internacion_colegiales': '¿Ha tenido internaciones en colegiales médicos?',
      'cirugia': '¿Ha tenido cirugías?',
      'secuelas': '¿Tiene secuelas de accidentes o enfermedades?',
      'accidentes': '¿Ha tenido accidentes graves?',
      'transfusiones': '¿Ha recibido transfusiones de sangre?',
      'estudios_anuales': '¿Se realiza estudios médicos anuales?',
      'indicacion_medica': '¿Tiene indicación médica específica?',
      'psicologico': '¿Ha recibido tratamiento psicológico?',
      'psiquiatrico': '¿Ha recibido tratamiento psiquiátrico?',
      'internacion_mental': '¿Ha tenido internación en institución de salud mental?',
      'diabetes': '¿Padece diabetes?',
      'auditivas': '¿Tiene problemas auditivos?',
      'vista': '¿Tiene problemas de vista?',
      'lentes': '¿Usa lentes o anteojos?',
      'glaucoma': '¿Padece glaucoma?',
      'alergias': '¿Tiene alergias conocidas?',
      'infarto': '¿Ha tenido infarto?',
      'test_embarazo': '¿Se ha realizado test de embarazo recientemente?',
      'sintomas_embarazo': '¿Presenta síntomas de embarazo?',
      'embarazo_actual': '¿Está embarazada actualmente?',
      'aborto': '¿Ha tenido abortos?',
      'partos': '¿Ha tenido partos?',
      'columna': '¿Tiene problemas de columna?',
      'protesis': '¿Usa prótesis?',
      'deporte': '¿Practica deportes regularmente?',
      'deporte_riesgo': '¿Practica deportes de riesgo?',
      'indicacion_protesis': '¿Tiene indicación de prótesis?',
      'neurologicas': '¿Tiene enfermedades neurológicas?',
      'epilepsia': '¿Padece epilepsia?',
      'perdida_conocimiento': '¿Ha tenido pérdidas de conocimiento?',
      'mareos': '¿Sufre mareos frecuentes?',
      'paralisis': '¿Ha tenido parálisis?',
      'cardiacas': '¿Tiene enfermedades cardíacas?',
      'arritmias': '¿Tiene arritmias?',
      'presion': '¿Tiene problemas de presión arterial?',
      'respiratorias': '¿Tiene enfermedades respiratorias?',
      'tuberculosis': '¿Ha tenido tuberculosis?',
      'fiebre_reumatica': '¿Ha tenido fiebre reumática?',
      'hepatitis': '¿Ha tenido hepatitis?',
      'colicos': '¿Sufre cólicos frecuentes?',
      'infecciones_urinarias': '¿Tiene infecciones urinarias recurrentes?',
      'anemia': '¿Padece anemia?',
      'transmision_sexual': '¿Ha tenido enfermedades de transmisión sexual?',
      'infecciosas': '¿Ha tenido enfermedades infecciosas?',
      'tumores': '¿Ha tenido tumores?',
      'tiroides': '¿Tiene problemas de tiroides?',
      'gastritis': '¿Padece gastritis?',
      'alcohol': '¿Consume alcohol regularmente?',
      'alcoholismo': '¿Consume alcohol regularmente?',
      'drogas': '¿Consume drogas?',
      'oncologico': '¿Ha tenido tratamiento oncológico?',
      'tabaco': '¿Fuma tabaco?',
      'tabaquismo': '¿Fuma tabaco?',
      'peso': '¿Tiene problemas de peso?',
      'perdida_peso': '¿Ha tenido pérdida de peso significativa?',
      'diagnostico_reciente': '¿Ha recibido algún diagnóstico médico reciente?',
      'discapacidad': '¿Tiene alguna discapacidad?'
    };

    return preguntas[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // ✅ FUNCIÓN HELPER: Obtener todas las preguntas disponibles
  const obtenerTodasLasPreguntas = () => {
    return [
      'internacion', 'internacion_colegiales', 'cirugia', 'secuelas', 'accidentes', 
      'transfusiones', 'estudios_anuales', 'indicacion_medica', 'psicologico', 
      'psiquiatrico', 'internacion_mental', 'diabetes', 'auditivas', 'vista', 
      'lentes', 'glaucoma', 'alergias', 'infarto', 'test_embarazo', 'sintomas_embarazo', 
      'embarazo_actual', 'aborto', 'partos', 'columna', 'protesis', 'deporte', 
      'deporte_riesgo', 'indicacion_protesis', 'neurologicas', 'epilepsia', 
      'perdida_conocimiento', 'mareos', 'paralisis', 'cardiacas', 'arritmias', 
      'presion', 'respiratorias', 'tuberculosis', 'fiebre_reumatica', 'hepatitis', 
      'colicos', 'infecciones_urinarias', 'anemia', 'transmision_sexual', 
      'infecciosas', 'tumores', 'tiroides', 'gastritis', 'alcohol', 'alcoholismo', 
      'drogas', 'oncologico', 'tabaco', 'tabaquismo', 'peso', 'perdida_peso', 
      'diagnostico_reciente', 'discapacidad'
    ];
  };

  // ✅ FUNCIONES AUXILIARES
  const formatTipoDocumento = (tipo) => {
    const tipos = {
      // Nuevos tipos de documentos adicionales
      'codem': 'CODEM',
      'formulario_f152': 'Formulario F152',
      'formulario_f184': 'Formulario F184',
      'constancia_inscripcion': 'Constancia de Inscripción',
      'comprobante_pago_cuota': 'Comprobante de Pago',
      'estudios_medicos': 'Estudios Médicos',
      // Tipos existentes
      'poliza_firmada': 'Póliza Firmada',
      'auditoria_medica': 'Auditoría Médica',
      'documento_identidad_adicional': 'Doc. Identidad',
      'comprobante_ingresos': 'Comp. Ingresos',
      'autorizacion_debito': 'Autorización Débito',
      'documento_adicional': 'Doc. Adicional',
      'dni_frente': 'DNI Frente',
      'dni_dorso': 'DNI Dorso',
      'recibo_sueldo': 'Recibo de Sueldo',
      'constancia_ingresos': 'Constancia de Ingresos'
    };
    return tipos[tipo] || tipo;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadoConversacion = (estado) => {
    const estados = {
      'activa': { bg: 'success', text: 'Activa' },
      'pausada': { bg: 'warning', text: 'Pausada' },
      'cerrada': { bg: 'secondary', text: 'Cerrada' }
    };
    return estados[estado] || { bg: 'primary', text: estado };
  };

  const renderEstadisticasGlobales = () => (
    <>
      {/* ✅ ALERTA INDICANDO ACCESO COMPLETO */}
    
      {/* Estadísticas Principales */}
      {/* <Row className="mb-3 mb-md-4">
        <Col xs={6} sm={6} lg={3} className="mb-3">
          <Card className="text-center h-100 shadow-sm border-primary metric-card">
            <Card.Body className="py-2 py-sm-3">
              <FaFileAlt className="text-primary mb-2" size={20} />
              <h4 className="fw-bold mb-1">{estadisticas.resumen?.total_polizas || 0}</h4>
              <small className="text-muted d-block">Total Pólizas</small>
              <div className="mt-1 d-none d-sm-block">
                <small className="text-info">
                  <FaGlobe className="me-1" />
                  Toda la organización
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={6} lg={3} className="mb-3">
          <Card className="text-center h-100 shadow-sm border-warning metric-card">
            <Card.Body className="py-2 py-sm-3">
              <FaChartLine className="text-warning mb-2" size={20} />
              <h4 className="fw-bold mb-1">{estadisticas.resumen?.polizas_en_proceso || 0}</h4>
              <small className="text-muted d-block">En Proceso</small>
              <div className="mt-1 d-none d-sm-block">
                <small className="text-warning">Requieren atención</small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={6} lg={3} className="mb-3">
          <Card className="text-center h-100 shadow-sm border-success metric-card">
            <Card.Body className="py-2 py-sm-3">
              <FaUsers className="text-success mb-2" size={20} />
              <h4 className="fw-bold mb-1">{estadisticas.resumen?.polizas_activas || 0}</h4>
              <small className="text-muted d-block">Activas</small>
              <div className="mt-1 d-none d-sm-block">
                <small className="text-success">Vigentes</small>
              </div>
            </Card.Body>
          </Card>
        </Col> */}
        {/* <Col xs={6} sm={6} lg={3} className="mb-3">
          <Card className="text-center h-100 shadow-sm border-info metric-card">
            <Card.Body className="py-2 py-sm-3">
              <FaMoneyBillWave className="text-success mb-2" size={20} />
              <h4 className="fw-bold mb-1">
                {estadisticas.metricas_calculadas?.facturacion_total_formateada || '$0'}
              </h4>
              <small className="text-muted d-block">Facturación Total</small>
              <div className="mt-1 d-none d-sm-block">
                <small className="text-info">Sistema completo</small>
              </div>
            </Card.Body>
          </Card>
        </Col> */}
      {/* </Row> */}

      {/* ✅ ESTADÍSTICAS POR SUPERVISOR */}
      {estadisticas.por_supervisor && estadisticas.por_supervisor.length > 0 && (
        <Row className="mb-4 md:mb-6">
          <Col xs={12}>
            {/* <Card className="shadow-sm">
              <Card.Header className="bg-light">
                <h6 className="mb-0">
                  <FaUserTie className="me-2" />
                  <span className="d-none d-sm-inline">Rendimiento por Supervisor - Vista Global</span>
                  <span className="d-sm-none">Supervisores - Global</span>
                </h6>
              </Card.Header>
              <Card.Body>
                <Row className="estadisticas-supervisor">
                  {estadisticas.por_supervisor.slice(0, 6).map((sup, index) => (
                    <Col xs={12} sm={6} lg={4} xl={2} key={sup.supervisor_id} className="mb-3">
                      <Card className="h-100 border-start border-primary border-3">
                        <Card.Body className="py-2">
                          <div className="d-flex align-items-center mb-2">
                            <FaUserTie className="text-primary me-2 flex-shrink-0" size={16} />
                            <h6 className="fw-bold mb-0 text-truncate" title={`${sup.supervisor_nombre} ${sup.supervisor_apellido}`}>
                              {sup.supervisor_nombre} {sup.supervisor_apellido}
                            </h6>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <small className="text-muted">Vendedores:</small>
                            <strong className="text-info">{sup.vendedores_activos || 0}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <small className="text-muted">Pólizas:</small>
                            <strong>{sup.total_polizas || 0}</strong>
                          </div>
                          <div className="d-flex justify-content-between">
                            <small className="text-muted">Facturación:</small>
                            <strong className="text-success small">
                              {formatCurrency(sup.facturacion_total || 0)}
                            </strong>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card> */}
          </Col>
        </Row>
      )}
    </>
  );

  const renderFiltrosGlobales = () => (
    <Card className="mb-4 md:mb-6 shadow-xs">
      <Card.Header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-2 sm:mb-0">
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">
            <FaFilter className="me-2" />
            <span className="hidden sm:inline">Filtros Avanzados - Back Office</span>
            <span className="sm:hidden">Filtros</span>
          </h6>
          <small className="text-[0.875em] text-muted-foreground block">
            <FaGlobe className="me-1" />
            <span className="hidden md:inline">Acceso a todos los supervisores y vendedores del sistema</span>
            <span className="md:hidden">Acceso global</span>
          </small>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setShowFiltros(!showFiltros)}
        >
          {showFiltros ? 'Ocultar' : 'Mostrar'}
        </Button>
      </Card.Header>
      {showFiltros && (
        <Card.Body className="pb-2">
          <Row>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Estado</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.estado}
                  onChange={(e) => handleFiltroChange('estado', e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="asesor">Asesor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="back_office">Back Office</option>
                  <option value="venta_cerrada">Venta Cerrada</option>
                  <option value="venta_rechazada">Venta Rechazada</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">
                  <FaUserTie className="me-1" />
                  <span className="hidden lg:inline">Supervisor</span>
                  <span className="lg:hidden">Superv.</span>
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.supervisor_id}
                  onChange={(e) => handleFiltroChange('supervisor_id', e.target.value)}
                >
                  <option value="todos">Todos ({opcionesFiltro.supervisores.length})</option>
                  {opcionesFiltro.supervisores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                      <span className="hidden xl:inline"> ({s.vendedores_count})</span>
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">
                  <FaUsers className="me-1" />
                  <span className="hidden lg:inline">Vendedor</span>
                  <span className="lg:hidden">Vend.</span>
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.vendedor_id}
                  onChange={(e) => handleFiltroChange('vendedor_id', e.target.value)}
                >
                  <option value="todos">Todos ({opcionesFiltro.vendedores.length})</option>
                  {opcionesFiltro.vendedores.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.first_name} {v.last_name}
                      <span className="hidden xl:inline">
                        {v.supervisor_nombre && ` → ${v.supervisor_nombre}`}
                      </span>
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Plan</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.plan}
                  onChange={(e) => handleFiltroChange('plan', e.target.value)}
                >
                  <option value="todos">Todos</option>
                  {opcionesFiltro.planes.map(plan => (
                    <option key={plan} value={plan}>{plan}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Desde</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={filtros.desde}
                  onChange={(e) => handleFiltroChange('desde', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Hasta</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={filtros.hasta}
                  onChange={(e) => handleFiltroChange('hasta', e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col xs={6} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Firma</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.estado_firma}
                  onChange={(e) => handleFiltroChange('estado_firma', e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="pending">Pendiente firma</option>
                  <option value="signed">Firmada</option>
                  <option value="rejected">Rechazada</option>
                  <option value="expired">Expirada</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={4} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">
                  <FaSearch className="me-1" />
                  <span className="hidden sm:inline">Búsqueda Global</span>
                  <span className="sm:hidden">Buscar</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Buscar póliza, cliente, vendedor..."
                  value={filtros.buscar}
                  onChange={(e) => handleFiltroChange('buscar', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={4} md={3} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Ordenar por</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.orden || 'mas_nuevos'}
                  onChange={(e) => handleFiltroChange('orden', e.target.value)}
                >
                  <option value="mas_nuevos">Más nuevos</option>
                  <option value="mas_antiguos">Más antiguos</option>
                  <option value="alfabetico">A-Z cliente</option>
                  <option value="alfabetico_desc">Z-A cliente</option>
                  <option value="supervisor">Por supervisor</option>
                  <option value="monto_desc">Mayor monto</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={2} md={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold hidden sm:block">&nbsp;</Form.Label>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-full"
                  onClick={limpiarFiltros}
                >
                  <span className="hidden sm:inline">Limpiar</span>
                  <span className="sm:hidden">Limpiar Filtros</span>
                </Button>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      )}
    </Card>
  );

  const renderTablaGlobal = () => (
    <Card className="shadow-xs transition-shadow hover:shadow-md">
      <Card.Header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-2 sm:mb-0">
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">
            <FaBuilding className="me-2" />
            <span className="hidden md:inline">Pólizas del Sistema Completo ({paginacion.total})</span>
            <span className="md:hidden">Pólizas ({paginacion.total})</span>
          </h6>
          <small className="text-[0.875em] text-muted-foreground block">
            <FaGlobe className="me-1" />
            <span className="hidden lg:inline">Vista global: {opcionesFiltro.supervisores.length} supervisores, {opcionesFiltro.vendedores.length} vendedores</span>
            <span className="lg:hidden">Global: {opcionesFiltro.supervisores.length} sup, {opcionesFiltro.vendedores.length} vend</span>
          </small>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          <ButtonGroup size="sm">
            <Button
              variant={tipoVista === 'tabla' ? 'primary' : 'outline-primary'}
              onClick={() => setTipoVista('tabla')}
            >
              <FaList className="me-1 sm:hidden" />
              <span className="hidden sm:inline">Tabla</span>
            </Button>
            <Button
              variant={tipoVista === 'tarjetas' ? 'primary' : 'outline-primary'}
              onClick={() => setTipoVista('tarjetas')}
            >
              <FaThLarge className="me-1 sm:hidden" />
              <span className="hidden sm:inline">Tarjetas</span>
            </Button>
          </ButtonGroup>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {loading ? (
          <div className="text-center py-6">
            <Spinner animation="border" />
            <p className="mb-4 mt-2">Cargando pólizas del sistema...</p>
          </div>
        ) : polizas.length === 0 ? (
          <div className="text-center py-6">
            <FaFileAlt size={48} className="text-muted-foreground mb-4" />
            <p className="mb-4 text-muted-foreground">No se encontraron pólizas con los filtros aplicados</p>
            <Button variant="outline-primary" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        ) : tipoVista === 'tabla' ? (
          <div className="overflow-x-auto">
            <Table responsive hover className="mb-0">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left whitespace-nowrap">Póliza</th>
                  <th className="text-left whitespace-nowrap">Cliente</th>
                  <th className="text-left whitespace-nowrap hidden md:table-cell">Plan</th>
                  <th className="text-left whitespace-nowrap hidden lg:table-cell">Vendedor</th>
                  <th className="text-left whitespace-nowrap hidden xl:table-cell">Supervisor</th>
                  <th className="text-left whitespace-nowrap">Estado</th>
                  <th className="text-left whitespace-nowrap hidden sm:table-cell">Total</th>
                  <th className="text-left whitespace-nowrap hidden md:table-cell">Fecha</th>
                  <th className="text-left whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
            <tbody>
              {polizas.map(poliza => {
                const estadoBadge = getEstadoBadge(poliza.estado);
                return (
                  <tr key={poliza.id}>
                    <td>
                      <div>
                        <strong>{poliza.numero_poliza_oficial || poliza.numero_poliza}</strong>
                        {poliza.numero_poliza_oficial && (
                          <>
                            <br />
                            <small className="text-[0.875em] text-muted-foreground">#{poliza.numero_poliza}</small>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{poliza.prospecto_nombre} {poliza.prospecto_apellido}</strong>
                        <br />
                        <small className="text-[0.875em] text-muted-foreground">{poliza.prospecto_telefono}</small>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div>
                        <span className="font-bold">{poliza.plan_nombre}</span>
                        {poliza.anio_plan && (
                          <>
                            <br />
                            <small className="text-[0.875em] text-muted-foreground">Año {poliza.anio_plan}</small>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell">
                      <div>
                        <strong>{poliza.vendedor?.nombre} {poliza.vendedor?.apellido}</strong>
                        <br />
                        <small className="text-[0.875em] text-muted-foreground">{poliza.vendedor?.email}</small>
                      </div>
                    </td>
                    <td className="hidden xl:table-cell">
                      <div>
                        <FaUserTie className="text-primary me-1" />
                        <strong className="text-primary">
                          {poliza.supervisor?.nombre} {poliza.supervisor?.apellido}
                        </strong>
                        <br />
                        <small className="text-[0.875em] text-muted-foreground">{poliza.supervisor?.email}</small>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <Badge bg={estadoBadge.bg}>{estadoBadge.text}</Badge>
                        <BadgeEstadoFirma poliza={poliza} />
                        {poliza.requiere_auditoria_medica === 1 && (
                          <Badge bg="danger" title="Requiere auditoría médica por IMC elevado">
                            🏥 Auditoría
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      <strong className="text-success">
                        {formatCurrency(poliza.total_final)}
                      </strong>
                    </td>
                    <td className="hidden md:table-cell">{formatFecha(poliza.created_at)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleDescargarPDF(poliza)}
                          title="Descargar PDF"
                        >
                          <FaDownload />
                        </Button>
                        {poliza.estado_firma === 'signed' && (
                          <BotonDescargarPolizaFirmada
                            polizaId={poliza.id}
                            size="sm"
                            showLabel={false}
                            variant="outline-success"
                          />
                        )}
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleVerDocumentos(poliza)}
                          title="Ver documentos"
                        >
                          <FaFileAlt />
                        </Button>
                        <BotonEnviarFirma 
                          poliza={poliza}
                          size="sm"
                          showLabel={false}
                          userRole="backoffice"
                          onExito={() => {
                            showToastMessage('Póliza enviada a firma exitosamente', 'success');
                            fetchPolizas();
                          }}
                          onError={(error) => {
                            showToastMessage(error, 'danger');
                          }}
                        />
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleAbrirCargarPolizaFirmada(poliza)}
                          title="Cargar póliza firmada"
                        >
                          <FaFileUpload />
                        </Button>
                        <Button
                          variant="outline-warning"
                          size="sm"
                          onClick={() => handleCambiarEstado(poliza)}
                          title="Cambiar estado"
                        >
                          <FaExchangeAlt />
                        </Button>
                        <Button
                          variant="outline-info"
                          size="sm"
                          onClick={() => handleVerHistorial(poliza)}
                          title="Ver historial de estados"
                        >
                          <FaHistory />
                        </Button>
                        <BotonConsultarEstadoFirma
                          poliza={poliza}
                          size="sm"
                          onEstadoActualizado={(estadoLocal) => handleEstadoFirmaConsultado(poliza.id, estadoLocal)}
                          onError={(msg) => showToastMessage(msg, 'danger')}
                        />
                        <BotonesEliminarFirma
                          poliza={poliza}
                          onActualizar={fetchPolizas}
                          size="sm"
                          showLabel={false}
                        />
                        <BotonEliminarPoliza
                          poliza={poliza}
                          onEliminada={fetchPolizas}
                          size="sm"
                          showLabel={false}
                        />
                        <Button
                          variant="outline-dark"
                          size="sm"
                          onClick={() => handleEditarPoliza(poliza)}
                          title="Editar póliza"
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleSubirDocumentosLibres(poliza)}
                          title="Agregar documentos"
                        >
                          <FaUpload />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          </div>
        ) : (
          <Row className="p-2 md:p-4">
            {polizas.map(poliza => {
              const estadoBadge = getEstadoBadge(poliza.estado);
              return (
                <Col xs={12} sm={6} lg={4} xl={3} key={poliza.id} className="mb-4">
                  <Card className="h-full shadow-xs">
                    <Card.Header className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="grow me-2">
                          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1 truncate" title={poliza.numero_poliza_oficial || poliza.numero_poliza}>
                            {poliza.numero_poliza_oficial || poliza.numero_poliza}
                          </h6>
                          {poliza.numero_poliza_oficial && (
                            <small className="text-[0.875em] text-muted-foreground block">#{poliza.numero_poliza}</small>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Badge bg={estadoBadge.bg}>
                            <span className="hidden sm:inline">{estadoBadge.text}</span>
                            <span className="sm:hidden">{estadoBadge.text.substring(0, 8)}</span>
                          </Badge>
                          <BadgeEstadoFirma poliza={poliza} />
                          {poliza.requiere_auditoria_medica === 1 && (
                            <Badge bg="danger" title="Requiere auditoría médica por IMC elevado">
                              🏥 Auditoría
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card.Header>
                    <Card.Body className="py-2">
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate truncate mb-1" title={`${poliza.prospecto_nombre} ${poliza.prospecto_apellido}`}>
                        {poliza.prospecto_nombre} {poliza.prospecto_apellido}
                      </h6>
                      <p className="text-muted-foreground text-[0.875em] mb-1">
                        <strong>Plan:</strong> <span className="truncate inline-block" style={{maxWidth: '120px'}} title={poliza.plan_nombre}>{poliza.plan_nombre}</span>
                      </p>
                      <p className="text-muted-foreground text-[0.875em] mb-1 hidden lg:block">
                        <FaUsers className="me-1" />
                        <strong>Vendedor:</strong> 
                        <span className="truncate inline-block" style={{maxWidth: '100px'}} title={`${poliza.vendedor?.nombre} ${poliza.vendedor?.apellido}`}>
                          {poliza.vendedor?.nombre} {poliza.vendedor?.apellido}
                        </span>
                      </p>
                      <p className="text-muted-foreground text-[0.875em] mb-1 hidden xl:block">
                        <FaUserTie className="me-1 text-primary" />
                        <strong>Supervisor:</strong> 
                        <span className="text-primary truncate inline-block" style={{maxWidth: '100px'}} title={`${poliza.supervisor?.nombre} ${poliza.supervisor?.apellido}`}>
                          {poliza.supervisor?.nombre} {poliza.supervisor?.apellido}
                        </span>
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <strong className="text-success">{formatCurrency(poliza.total_final)}</strong>
                        <small className="text-[0.875em] text-muted-foreground hidden sm:inline">{formatFecha(poliza.created_at)}</small>
                      </div>
                    </Card.Body>
                    <Card.Footer className="pt-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <Button 
                          size="sm" 
                          variant="outline-success" 
                          onClick={() => handleDescargarPDF(poliza)}
                          title="Descargar PDF"
                        >
                          <FaDownload />
                        </Button>
                        {poliza.estado_firma === 'signed' && (
                          <BotonDescargarPolizaFirmada
                            polizaId={poliza.id}
                            size="sm"
                            showLabel={false}
                            variant="outline-success"
                          />
                        )}
                        <Button 
                          size="sm" 
                          variant="outline-secondary" 
                          onClick={() => handleVerDocumentos(poliza)}
                          title="Ver documentos"
                        >
                          <FaFileAlt />
                        </Button>
                        <BotonEnviarFirma 
                          poliza={poliza}
                          size="sm"
                          showLabel={false}
                          userRole="backoffice"
                          onExito={() => {
                            showToastMessage('Póliza enviada a firma exitosamente', 'success');
                            fetchPolizas();
                          }}
                          onError={(error) => {
                            showToastMessage(error, 'danger');
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline-success"
                          onClick={() => handleAbrirCargarPolizaFirmada(poliza)}
                          title="Cargar póliza firmada"
                        >
                          <FaFileUpload />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-warning" 
                          onClick={() => handleCambiarEstado(poliza)}
                          title="Cambiar estado"
                        >
                          <FaExchangeAlt />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-info" 
                          onClick={() => handleVerHistorial(poliza)}
                          title="Ver historial"
                        >
                          <FaHistory />
                        </Button>
                        <BotonConsultarEstadoFirma
                          poliza={poliza}
                          size="sm"
                          onEstadoActualizado={(estadoLocal) => handleEstadoFirmaConsultado(poliza.id, estadoLocal)}
                          onError={(msg) => showToastMessage(msg, 'danger')}
                        />
                        <BotonesEliminarFirma
                          poliza={poliza}
                          onActualizar={fetchPolizas}
                          size="sm"
                          showLabel={false}
                        />
                        <BotonEliminarPoliza
                          poliza={poliza}
                          onEliminada={fetchPolizas}
                          size="sm"
                          showLabel={false}
                        />
                        <Button
                          size="sm"
                          variant="outline-dark"
                          onClick={() => handleEditarPoliza(poliza)}
                          title="Editar póliza"
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => handleSubirDocumentosLibres(poliza)}
                          title="Agregar documentos"
                        >
                          <FaUpload />
                        </Button>
                      </div>
                    </Card.Footer>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <Container fluid className="py-4 md:py-6 ">
      {/* <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-sm-center mb-3 mb-md-4">
        <div className="mb-2 mb-sm-0">
          <h2 className="mb-1">
            <FaBuilding className="me-2 text-primary" />
            <span className="d-none d-md-inline">Gestión de Pólizas - Back Office</span>
            <span className="d-md-none">Pólizas - Back Office</span>
          </h2>
          <p className="text-muted mb-0">
            <FaGlobe className="me-1" />
            <span className="d-none d-sm-inline">Vista completa de todas las pólizas del sistema</span>
            <span className="d-sm-none">Vista completa del sistema</span>
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={fetchEstadisticas}
            disabled={loadingStats}
          >
            {loadingStats ? <Spinner size="sm" /> : 'Actualizar'}
          </Button>
        </div>
      </div> */}

      {renderEstadisticasGlobales()}
      {renderFiltrosGlobales()}
      
      <div className="mb-6"></div>
      
      {renderTablaGlobal()}

      {/* Paginación */}
      {paginacion.total_pages > 1 && (
        <div className="mt-4 md:mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline-primary"
            size="sm"
            disabled={paginacion.current_page === 1}
            onClick={() => setPaginacion(prev => ({ ...prev, current_page: prev.current_page - 1 }))}
          >
            <span className="hidden sm:inline">Anterior</span>
            <span className="sm:hidden">‹</span>
          </Button>
          <span className="mx-2 sm:mx-4 self-center text-[0.875em]">
            <span className="hidden sm:inline">Página {paginacion.current_page} de {paginacion.total_pages}</span>
            <span className="sm:hidden">{paginacion.current_page}/{paginacion.total_pages}</span>
          </span>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={paginacion.current_page === paginacion.total_pages}
            onClick={() => setPaginacion(prev => ({ ...prev, current_page: prev.current_page + 1 }))}
          >
            <span className="hidden sm:inline">Siguiente</span>
            <span className="sm:hidden">›</span>
          </Button>
        </div>
      )}

      {/* ✅ MODALES */}
      
      {/* Modal Documentos */}
      <Modal show={modalDocumentos} onHide={() => setModalDocumentos(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaFileAlt className="me-2" />
            Documentos de Póliza
            {polizaSeleccionada && (
              <Badge bg="primary" className="ms-2">
                {polizaSeleccionada.numero_poliza_oficial || polizaSeleccionada.numero_poliza}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDocumentos ? (
            <div className="text-center py-6">
              <Spinner animation="border" />
              <p className="mb-4 mt-2">Cargando documentos...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Total de documentos: {Object.values(documentos).flat().length}</h6>
             
              </div>
              
              {Object.keys(documentos).length === 0 ? (
                <Alert variant="info">
                  <FaFileAlt className="me-2" />
                  No hay documentos cargados para esta póliza
                </Alert>
              ) : (
                <Accordion>
                  {Object.entries(documentos).map(([tipo, docs], index) => (
                    <Accordion.Item eventKey={index.toString()} key={tipo}>
                      <Accordion.Header>
                        <strong>{formatTipoDocumento(tipo)}</strong>
                        <Badge bg="secondary" className="ms-2">{docs.length}</Badge>
                      </Accordion.Header>
                      <Accordion.Body>
                        <Row>
                          {docs.map(doc => (
                            <Col xs={12} md={6} lg={4} key={doc.id} className="mb-4">
                              <Card className="h-full">
                                <Card.Body className="p-2">
                                  {doc.observaciones && (
                                    <h6 className="text-base font-bold leading-tight tracking-tight text-primary mb-1 truncate" title={doc.observaciones}>
                                      {doc.observaciones}
                                    </h6>
                                  )}
                                  <h6 className={cn("mb-4 text-base font-bold leading-tight tracking-tight text-corporate", `truncate ${doc.observaciones ? 'text-[0.875em] text-muted-foreground font-normal' : ''}`)} title={doc.nombre_original}>
                                    {doc.nombre_original}
                                  </h6>
                                  <p className="text-[0.875em] text-muted-foreground mb-1">
                                    Tamaño: {formatFileSize(doc.tamaño_bytes)}
                                  </p>
                                  <p className="text-[0.875em] text-muted-foreground mb-2">
                                    Subido: {formatearFecha(doc.fecha_subida)}
                                  </p>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline-primary"
                                      onClick={() => handleDescargarDocumento(doc.id, doc.nombre_original)}
                                    >
                                      <FaDownload />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-info"
                                      onClick={() => handlePreviewDocumento(doc.id, doc.tipo_mime)}
                                    >
                                      <FaEye />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      onClick={() => handleEliminarDocumento(doc.id)}
                                    >
                                      <FaTrash />
                                    </Button>
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal Cambiar Estado */}
      <Modal show={modalCambiarEstado} onHide={() => setModalCambiarEstado(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExchangeAlt className="me-2" />
            Cambiar Estado de Póliza
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {polizaCambioEstado && (
            <>
              <Alert variant="info">
                <strong>Póliza:</strong> {polizaCambioEstado.numero_poliza_oficial || polizaCambioEstado.numero_poliza}<br />
                <strong>Cliente:</strong> {polizaCambioEstado.prospecto_nombre} {polizaCambioEstado.prospecto_apellido}<br />
                <strong>Estado actual:</strong> <Badge bg={getEstadoBadge(polizaCambioEstado.estado).bg}>
                  {getEstadoBadge(polizaCambioEstado.estado).text}
                </Badge>
              </Alert>
              
              <Form.Group className="mb-4">
                <Form.Label>Nuevo Estado</Form.Label>
                <Form.Select
                  value={estadoSeleccionado}
                  onChange={(e) => setEstadoSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar estado...</option>
                  <option value="asesor">Asesor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="back_office">Back Office</option>
                  <option value="venta_cerrada">Venta Cerrada</option>
                  <option value="venta_rechazada">Venta Rechazada</option>
                </Form.Select>
              </Form.Group>
              
              <Form.Group className="mb-4">
                <Form.Label>Motivo del Cambio</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  placeholder="Describa el motivo del cambio de estado..."
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalCambiarEstado(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={confirmarCambioEstado}
            disabled={loadingCambioEstado || !estadoSeleccionado || !motivoCambio.trim()}
          >
            {loadingCambioEstado ? <Spinner size="sm" className="me-1" /> : null}
            Cambiar Estado
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Conversaciones */}
      <Modal show={modalConversaciones} onHide={() => setModalConversaciones(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaComments className="me-2" />
            Conversaciones WhatsApp
            {prospectoSeleccionado && (
              <Badge bg="success" className="ms-2">
                {prospectoSeleccionado.nombre} {prospectoSeleccionado.apellido}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingConversaciones ? (
            <div className="text-center py-6">
              <Spinner animation="border" />
              <p className="mb-4 mt-2">Cargando conversaciones...</p>
            </div>
          ) : conversacionesProspecto.length === 0 ? (
            <Alert variant="info">
              <FaComments className="me-2" />
              No hay conversaciones registradas para este prospecto
            </Alert>
          ) : (
            <div className="flex flex-col gap-2">
              {conversacionesProspecto.map(conv => (
                <Card key={conv.id} className="mb-4">
                  <Card.Header>
                    <div className="flex justify-between items-center">
                      <div>
                        <strong>{conv.numero_conversacion}</strong>
                        <Badge bg={getEstadoConversacion(conv.estado).bg} className="ms-2">
                          {getEstadoConversacion(conv.estado).text}
                        </Badge>
                      </div>
                      <small className="text-[0.875em] text-muted-foreground">
                        {formatearFecha(conv.created_at)}
                      </small>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-1">
                      <strong>Teléfono:</strong> {conv.telefono_cliente}
                    </p>
                    <p className="mb-1">
                      <strong>Mensajes:</strong> {conv.total_mensajes} 
                      {conv.mensajes_no_leidos > 0 && (
                        <Badge bg="warning" className="ms-1">
                          {conv.mensajes_no_leidos} sin leer
                        </Badge>
                      )}
                    </p>
                    {conv.ultimo_mensaje && (
                      <p className="mb-1">
                        <strong>Último mensaje:</strong> {conv.ultimo_mensaje.contenido?.substring(0, 100)}...
                      </p>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal Preview Documento */}
      <Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Preview Documento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewUrl && (
            <div className="text-center">
              {previewMime?.includes('image') ? (
                <img src={previewUrl} alt="Preview" className="h-auto max-w-full" />
              ) : previewMime?.includes('pdf') ? (
                <iframe src={previewUrl} width="100%" height="500px" />
              ) : (
                <Alert variant="info">
                  No se puede previsualizar este tipo de archivo
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal Carga de Documentos */}
      <Modal show={modalCargaDocumentos} onHide={() => setModalCargaDocumentos(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaFileUpload className="me-2" />
            Cargar Documentos
            {polizaCargaDocumentos && (
              <Badge bg="primary" className="ms-2">
                {polizaCargaDocumentos.numero_poliza_oficial || polizaCargaDocumentos.numero_poliza}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <FaExclamationTriangle className="me-2" />
            Funcionalidad de carga de documentos disponible próximamente.
            Por ahora puede gestionar documentos desde el sistema de gestión de documentos.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalCargaDocumentos(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ MODAL HISTORIAL DE ESTADOS Y COMENTARIOS */}
      <Modal show={modalHistorial} onHide={() => setModalHistorial(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaHistory className="me-2" />
            Historial de Estados
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
                        <Badge bg={getEstadoBadge(polizaHistorial.estado).bg}>
                          {getEstadoBadge(polizaHistorial.estado).text}
                        </Badge>
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
                        {new Date(item.fecha).toLocaleDateString('es-AR', {
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
                            {item.usuario?.nombre} {item.usuario?.apellido}
                            {item.usuario?.email && (
                              <small className="text-[0.875em] text-muted-foreground ms-1">({item.usuario.email})</small>
                            )}
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
          <Button 
            variant="primary" 
            onClick={() => {
              setModalHistorial(false);
              handleCambiarEstado(polizaHistorial);
            }}
          >
            <FaExchangeAlt className="me-1" />
            Cambiar Estado
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Modal estandarizado de edición de póliza */}
      <EditarPolizaModal
        show={modalEditarPoliza}
        onHide={() => { setModalEditarPoliza(false); setPolizaEdicion(null); }}
        poliza={polizaEdicion}
        onActualizar={fetchPolizas}
        apiContext="backoffice"
      />

      {/* ✅ Modal para subir documentos libres */}
      <SubirDocumentosLibresModal
        show={showSubirDocumentosModal}
        onHide={() => { setShowSubirDocumentosModal(false); setPolizaSubirDocumentos(null); }}
        poliza={polizaSubirDocumentos}
        apiContext="backoffice"
        onDocumentosActualizados={fetchPolizas}
      />

      {/* Modal Cargar Póliza Firmada */}
      <CargarPolizaFirmadaModal
        show={modalCargarPolizaFirmada}
        onHide={() => {
          setModalCargarPolizaFirmada(false);
          setPolizaParaCargar(null);
        }}
        polizaId={polizaParaCargar?.id}
        numeroPoliza={polizaParaCargar?.numero_poliza_oficial || polizaParaCargar?.numero_poliza}
        onSuccess={handlePolizaFirmadaCargada}
      />

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-4">
        <Toast show={showToast} onClose={() => setShowToast(false)} delay={4000} autohide>
          <Toast.Header>
            <strong className="me-auto">
              {toastVariant === 'success' ? '✅ Éxito' : 
               toastVariant === 'danger' ? '❌ Error' : 
               toastVariant === 'warning' ? '⚠️ Advertencia' : 'ℹ️ Información'}
            </strong>
          </Toast.Header>
          <Toast.Body>{toastMessage}</Toast.Body>
        </Toast>
      </ToastContainer>
    </Container>
  );
};

export default PolizasBackOffice;