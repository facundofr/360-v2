import { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Card, Table, Button, Form, Badge, Spinner, ButtonGroup, Modal, Alert, Tab, Tabs } from "@/components/compat/bootstrap";
import { FaEye, FaDownload, FaWhatsapp, FaFilter, FaList, FaThLarge, FaFileAlt, FaUsers, FaMoneyBillWave, FaChartLine, FaFile, FaTrash, FaTimes, FaEdit, FaTimesCircle, FaCheckCircle, FaHourglassHalf, FaCoins, FaCalendarAlt, FaSearch, FaHistory, FaUser, FaComments, FaInfoCircle, FaExchangeAlt, FaUpload } from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";
import ModalExportacion from "../../common/ModalExportacion";
import DocumentPreviewModal from "../../common/DocumentPreviewModal";
import CargaMultipleDocumentos from "../../supervisor/CargaMultipleDocumentos";
import CargarPolizaFirmadaModal from '../../modals/CargarPolizaFirmadaModal';
import BotonEnviarFirma from '../../buttons/BotonEnviarFirma';
import BadgeEstadoFirma from '../../badges/BadgeEstadoFirma';
import BotonEliminarPoliza from '../../buttons/BotonEliminarPoliza';
import EditarPolizaModal from '../vendedor/modals/EditarPolizaModal';
import SubirDocumentosLibresModal from '../vendedor/modals/SubirDocumentosLibresModal';
import useNotificacionesFirmaPolizas from '../../../hooks/useNotificacionesFirmaPolizas';
import { cn } from "@/lib/utils";

const PolizasSupervisor = ({ context = 'supervisor' }) => {
  // Determinar la URL base según el contexto
  const getBaseUrl = () => {
    return context === 'backoffice' ? `${API_URL}/backoffice/polizas` : `${API_URL}/supervisor/polizas`;
  };
  const [polizas, setPolizas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState({
    periodo_descripcion: '',
    resumen: {},
    metricas_calculadas: {}
  });
  const [filtros, setFiltros] = useState({
    estado: 'todos',
    vendedor_id: 'todos',
    plan: 'todos',
    desde: '',
    hasta: '',
    buscar: '',
    orden: 'mas_nuevos'
  });
  const [tipoVista, setTipoVista] = useState(window.innerWidth < 768 ? 'tarjetas' : 'tabla');
  const [paginacion, setPaginacion] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });
  const [opcionesFiltro, setOpcionesFiltro] = useState({
    vendedores: [],
    planes: [],
    estados: []
  });
  const [showFiltros, setShowFiltros] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [modalDocumentos, setModalDocumentos] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState(null);
  const [documentos, setDocumentos] = useState({});
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // ✅ NUEVOS ESTADOS PARA ACTUALIZAR DOCUMENTOS
  const [modalActualizarDoc, setModalActualizarDoc] = useState(false);
  const [documentoActualizar, setDocumentoActualizar] = useState(null);
  const [archivoNuevo, setArchivoNuevo] = useState(null);
  const [loadingActualizacion, setLoadingActualizacion] = useState(false);

  // ✅ AGREGAR ESTADOS ADICIONALES
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

  // ✅ NUEVOS ESTADOS PARA FILTRO DE MES
  const [filtroMes, setFiltroMes] = useState({ 
    periodo: 'mes', 
    mes: '', 
    anio: '' 
  });
  const [mesesDisponibles, setMesesDisponibles] = useState([]);
  const [loadingMeses, setLoadingMeses] = useState(false);
  const [showModalExportacion, setShowModalExportacion] = useState(false); // ✅ AGREGAR

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
    fetchMesesDisponibles();
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

  // Recargar estadísticas cuando cambie el filtro de mes
  useEffect(() => {
    if (filtroMes.periodo || (filtroMes.mes && filtroMes.anio)) {
      fetchEstadisticas();
    }
  }, [filtroMes]);

  const fetchPolizas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");

      const params = new URLSearchParams({
        page: paginacion.current_page,
        limit: paginacion.per_page,
        ...filtros
      });

      const { data } = await axios.get(
        `${getBaseUrl()}?${params}`,
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
      
      // Construir parámetros de consulta para filtro de mes
      const params = new URLSearchParams();
      params.append('periodo', filtroMes.periodo);
      
      if (filtroMes.mes && filtroMes.anio) {
        params.append('mes', filtroMes.mes);
        params.append('anio', filtroMes.anio);
      }

      const { data } = await axios.get(
        `${getBaseUrl()}/estadisticas?${params.toString()}`,
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
        `${getBaseUrl()}/filtros`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOpcionesFiltro(data.data);
    } catch (error) {
      console.error("Error cargando opciones de filtro:", error);
    }
  };

  const fetchMesesDisponibles = async () => {
    try {
      setLoadingMeses(true);
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${getBaseUrl()}/estadisticas/meses`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMesesDisponibles(data.data);
    } catch (error) {
      console.error("Error cargando meses disponibles:", error);
    } finally {
      setLoadingMeses(false);
    }
  };

  const handleFiltroMesChange = (campo, valor) => {
    setFiltroMes(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const aplicarFiltroMes = () => {
    fetchEstadisticas();
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
      plan: 'todos',
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

  // ✅ ESTADOS DE PÓLIZA ACTUALIZADOS
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
    // ✅ Usar el mismo método que el vendedor con pdf_hash
    if (poliza.pdf_hash) {
      window.open(`${API_URL}/polizas/pdf/${poliza.pdf_hash}`, '_blank');
    } else {
      // Fallback al método anterior si no hay pdf_hash
      window.open(poliza.urls?.pdf || '#', '_blank');
    }
  };

  const handleEnviarWhatsApp = async (poliza) => {
    try {
      if (!poliza.prospecto?.id) {
        Swal.fire("Error", "No se encontró información del prospecto", "error");
        return;
      }

      setProspectoSeleccionado(poliza.prospecto);
      setLoadingConversaciones(true);
      setModalConversaciones(true);

      // Obtener conversaciones del prospecto
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/supervisor/chat/conversaciones/prospecto/${poliza.prospecto.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setConversacionesProspecto(data.data.conversaciones);
      } else {
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

  // ✅ FUNCIONES PARA MANEJAR CONVERSACIONES WHATSAPP
  const handleVerConversacion = (conversacion) => {
    // Aquí puedes abrir el chat completo o redirigir al detalle
    console.log('Ver conversación:', conversacion);
    // Ejemplo: window.open(`/chat/${conversacion.id}`, '_blank');
  };

  const handleNuevaConversacion = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      
      // Crear nueva conversación con el prospecto
      const { data } = await axios.post(
        `${API_URL}/supervisor/chat/conversaciones`,
        {
          prospecto_id: prospectoSeleccionado.id,
          tipo_origen: 'manual'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        Swal.fire("Éxito", "Nueva conversación creada", "success");
        // Recargar conversaciones
        handleEnviarWhatsApp({ prospecto: prospectoSeleccionado });
      }

    } catch (error) {
      console.error("Error creando conversación:", error);
      Swal.fire("Error", "No se pudo crear la conversación", "error");
    }
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
      'activa': { color: 'success', texto: 'Activa' },
      'pausada': { color: 'warning', texto: 'Pausada' },
      'cerrada': { color: 'secondary', texto: 'Cerrada' },
      'finalizada': { color: 'dark', texto: 'Finalizada' }
    };
    return estados[estado] || { color: 'secondary', texto: estado };
  };

  const getTipoOrigen = (tipo) => {
    const tipos = {
      'cotizacion': { icon: '📋', texto: 'Cotización' },
      'poliza': { icon: '📄', texto: 'Póliza' },
      'manual': { icon: '✍️', texto: 'Manual' },
      'webhook': { icon: '🔔', texto: 'Automático' }
    };
    return tipos[tipo] || { icon: '❓', texto: tipo };
  };

  const handleVerDocumentos = async (poliza) => {
    try {
      setLoadingDocumentos(true);
      setPolizaSeleccionada(poliza);
      setModalDocumentos(true);

      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${getBaseUrl()}/${poliza.id}/documentos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDocumentos(data.documentos || {});
    } catch (error) {
      console.error("Error cargando documentos:", error);
      Swal.fire("Error", "No se pudieron cargar los documentos", "error");
    } finally {
      setLoadingDocumentos(false);
    }
  };

  const handleDescargarDocumento = async (documentoId, nombreOriginal) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/supervisor/polizas/documentos/${documentoId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Crear URL para descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nombreOriginal);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error descargando documento:", error);
      Swal.fire("Error", "No se pudo descargar el documento", "error");
    }
  };

  const handleEliminarDocumento = async (documentoId) => {
    try {
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
        const token = localStorage.getItem("cober_token");
        await axios.delete(
          `${API_URL}/supervisor/polizas/documentos/${documentoId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Recargar documentos
        await handleVerDocumentos(polizaSeleccionada);

        Swal.fire("Eliminado", "Documento eliminado correctamente", "success");
      }
    } catch (error) {
      console.error("Error eliminando documento:", error);
      Swal.fire("Error", "No se pudo eliminar el documento", "error");
    }
  };

  const handlePreviewDocumento = async (documentoId, tipoMime) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/supervisor/polizas/documentos/${documentoId}/preview`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: tipoMime }));
      setPreviewUrl(url);
      setPreviewMime(tipoMime);
      setShowPreview(true);
    } catch (error) {
      Swal.fire("Error", "No se pudo previsualizar el documento", "error");
    }
  };

  // ✅ NUEVA FUNCIÓN: Abrir modal para actualizar documento
  const handleActualizarDocumento = (documento) => {
    setDocumentoActualizar(documento);
    setArchivoNuevo(null);
    setModalActualizarDoc(true);
  };

  // ✅ NUEVA FUNCIÓN: Confirmar actualización de documento
  const confirmarActualizacionDocumento = async () => {
    if (!archivoNuevo || !documentoActualizar) {
      Swal.fire("Error", "Debe seleccionar un archivo", "error");
      return;
    }

    setLoadingActualizacion(true);
    try {
      const token = localStorage.getItem("cober_token");
      const formData = new FormData();
      formData.append('documento', archivoNuevo);
      formData.append('motivo_actualizacion', 'Documento actualizado por supervisor');

      const response = await axios.put(
        `${API_URL}/supervisor/polizas/documentos/${documentoActualizar.id}/actualizar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        Swal.fire("Éxito", "Documento actualizado correctamente", "success");
        setModalActualizarDoc(false);
        setDocumentoActualizar(null);
        setArchivoNuevo(null);
        // Recargar documentos
        await handleVerDocumentos(polizaSeleccionada);
      } else {
        throw new Error(response.data.message || 'Error actualizando documento');
      }
    } catch (error) {
      console.error("Error actualizando documento:", error);
      Swal.fire("Error", error.response?.data?.message || "No se pudo actualizar el documento", "error");
    } finally {
      setLoadingActualizacion(false);
    }
  };

  // FUNCIÓN AUXILIAR: Formatear tipo de documento
  const formatTipoDocumento = (tipo) => {
    const tipos = {
      // Nuevos tipos de documentos adicionales
      'codem': 'CODEM',
      'formulario_f152': 'Formulario F152',
      'formulario_f184': 'Formulario F184',
      'constancia_inscripcion': 'Constancia de Inscripción',
      'comprobante_pago_cuota': 'Comprobante de Pago de Cuota',
      'estudios_medicos': 'Estudios Médicos',
      // Tipos existentes
      'dni_titular': 'DNI Titular',
      'dni_conyuge': 'DNI Cónyuge',
      'dni_hijo': 'DNI Hijo/a',
      'recibo_sueldo': 'Recibo de Sueldo',
      'monotributo': 'Monotributo',
      'dni_frente': 'DNI Frente',
      'dni_dorso': 'DNI Dorso',
      'poliza_firmada': 'Póliza Firmada',
      'auditoria_medica': 'Auditoría Médica',
      'documento_identidad_adicional': 'Documento de Identidad Adicional',
      'constancia_ingresos': 'Constancia de Ingresos',
      'autorizacion_debito': 'Autorización de Débito',
      'otros': 'Otros'
    };
    return tipos[tipo] || tipo;
  };

  // FUNCIÓN AUXILIAR: Formatear tamaño de archivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ✅ NUEVAS FUNCIONES: Carga de documentos desde modal de documentos
  const handleAbrirCargaDocumentos = (poliza) => {
    setPolizaCargaDocumentos(poliza);
    setModalCargaDocumentos(true);
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
      const response = await axios.get(`${getBaseUrl()}/${poliza.id}/historial`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setHistorialEstados(response.data.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      Swal.fire('Error', 'No se pudo cargar el historial de estados', 'error');
      setHistorialEstados([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleCerrarCargaDocumentos = () => {
    setModalCargaDocumentos(false);
    setPolizaCargaDocumentos(null);
  };

  const handleDocumentosActualizados = async () => {
    // Recargar los documentos de la póliza actual
    if (polizaSeleccionada) {
      try {
        const token = localStorage.getItem("cober_token");
        const { data } = await axios.get(
          `${getBaseUrl()}/${polizaSeleccionada.id}/documentos`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDocumentos(data.documentos || {});
        
        // Mostrar mensaje de éxito
        Swal.fire("Éxito", "Documentos cargados correctamente", "success");
      } catch (error) {
        console.error("Error recargando documentos:", error);
      }
    }
    
    // Cerrar modal de carga
    handleCerrarCargaDocumentos();
  };

  // ✅ AGREGAR esta función antes del return del componente
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
      'drogas': '¿Consume drogas?',
      'oncologico': '¿Ha tenido tratamiento oncológico?',
      'tabaco': '¿Fuma tabaco?',
      'peso': '¿Tiene problemas de peso?',
      'diagnostico_reciente': '¿Ha recibido algún diagnóstico médico reciente?',
      'discapacidad': '¿Tiene alguna discapacidad?'
    };

    return preguntas[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };




  const renderEstadisticas = () => (
    <>
      {/* Filtros de período para estadísticas */}
      <Row className="mb-4">
        <Col xs={12}>
          <Card className="border-info">
            <Card.Header className="bg-muted py-2">
              <h6 className="text-base font-bold leading-tight tracking-tight mb-0 text-info">
                <FaCalendarAlt className="me-2" />
                Filtro de Período - Estadísticas
              </h6>
            </Card.Header>
            <Card.Body className="py-2">
              <Row className="items-end">
                <Col xs={12} sm={6} md={3} className="mb-2">
                  <Form.Group>
                    <Form.Label className="text-[0.875em] font-semibold">Período</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filtroMes.periodo}
                      onChange={(e) => handleFiltroMesChange('periodo', e.target.value)}
                    >
                      <option value="dia">Hoy</option>
                      <option value="semana">Esta semana</option>
                      <option value="mes">Este mes</option>
                      <option value="año">Este año</option>
                      <option value="todos">Todos los períodos</option>
                      <option value="personalizado">Personalizado</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                {filtroMes.periodo === 'personalizado' && (
                  <>
                    <Col xs={12} sm={6} md={3} className="mb-2">
                      <Form.Group>
                        <Form.Label className="text-[0.875em] font-semibold">Mes/Año</Form.Label>
                        <Form.Select
                          size="sm"
                          value={`${filtroMes.anio}-${filtroMes.mes.toString().padStart(2, '0')}`}
                          onChange={(e) => {
                            const [anio, mes] = e.target.value.split('-');
                            handleFiltroMesChange('anio', anio);
                            handleFiltroMesChange('mes', parseInt(mes));
                          }}
                        >
                          <option value="">Seleccionar período</option>
                          {mesesDisponibles.map(mesData => (
                            <option key={mesData.value} value={mesData.value}>
                              {mesData.label} ({mesData.total_polizas} pólizas)
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col xs={12} sm={6} md={2} className="mb-2">
                      <Button
                        size="sm"
                        variant="info"
                        onClick={aplicarFiltroMes}
                        disabled={loadingStats || (!filtroMes.mes || !filtroMes.anio)}
                      >
                        <FaSearch className="me-1" />
                        Aplicar
                      </Button>
                    </Col>
                  </>
                )}
                <Col xs={12} md={4} className="mb-2">
                  <div className="text-right">
                    {!loadingStats && (
                      <Badge bg="secondary" className="px-2 py-1">
                        {estadisticas.periodo_descripcion || 'Este mes'}
                      </Badge>
                    )}
                    {loadingStats && (
                      <>
                        <Badge bg="info" className="px-2 py-1">
                          <Spinner size="sm" className="me-1" />
                          Cargando estadísticas...
                        </Badge>
                      </>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Primera fila - Métricas principales */}
      <Row className="mb-6">
        <Col xs={12} sm={6} lg={4} className="mb-4 lg:mb-0">
          <Card className="text-center h-full shadow-xs">
            <Card.Body className="py-4">
              <FaFileAlt className="text-primary mb-2" size={20} />
              <h5 className="text-[1.25rem] leading-tight tracking-tight text-corporate font-bold mb-1">{estadisticas.resumen?.total_polizas || 0}</h5>
              <small className="text-[0.875em] text-muted-foreground">Total Pólizas</small>
              {estadisticas.resumen?.poliza_promedio_dia && (
                <div className="mt-1">
                  <small className="text-[0.875em] text-info">
                    ~{estadisticas.resumen.poliza_promedio_dia}/día
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4} className="mb-4 lg:mb-0">
          <Card className="text-center h-full shadow-xs">
            <Card.Body className="py-4">
              <FaHourglassHalf className="text-warning mb-2" size={20} />
              <h5 className="text-[1.25rem] leading-tight tracking-tight text-corporate font-bold mb-1">{estadisticas.resumen?.polizas_en_proceso || 0}</h5>
              <small className="text-[0.875em] text-muted-foreground">En Proceso</small>
              <div className="mt-1">
                <small className="text-[0.875em] text-muted-foreground">
                  Firmadas: {estadisticas.resumen?.polizas_firmadas || 0}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={4} className="mb-4 lg:mb-0">
          <Card className="text-center h-full shadow-xs">
            <Card.Body className="py-4">
              <FaCheckCircle className="text-success mb-2" size={20} />
              <h5 className="text-[1.25rem] leading-tight tracking-tight text-corporate font-bold mb-1">{estadisticas.resumen?.polizas_finalizadas || 0}</h5>
              <small className="text-[0.875em] text-muted-foreground">Finalizadas</small>
              {estadisticas.metricas_calculadas?.finalization_rate && (
                <div className="mt-1">
                  <small className="text-[0.875em] text-success">
                    {estadisticas.metricas_calculadas.finalization_rate} del total
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Segunda fila - Métricas financieras */}
      {/* <Row className="mb-4">
        <Col xs={12} className="d-flex justify-content-center">
          <Card className="text-center shadow-sm" style={{ minWidth: '250px' }}>
            <Card.Body className="py-3">
              <FaMoneyBillWave className="text-success mb-2" size={20} />
              <h6 className="fw-bold mb-1">
                {estadisticas.metricas_calculadas?.facturacion_total_formateada || '$0'}
              </h6>
              <small className="text-muted">Facturación Total</small>
            </Card.Body>
          </Card>
        </Col>
      </Row> */}

      {/* Tercera fila - Distribución por estados (si hay datos) */}
      {estadisticas.distribucion_estados && estadisticas.distribucion_estados.length > 0 && (
        <Row className="mb-6">
          <Col xs={12}>
            <Card className="shadow-xs">
              <Card.Header>
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📊 Distribución por Estados</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  {estadisticas.distribucion_estados.slice(0, 6).map((estado, index) => (
                    <Col xs={6} sm={4} md={3} lg={2} key={estado.estado} className="text-center mb-4">
                      <div className="border rounded-md p-2 h-full">
                        <h6 className="mb-4 text-base leading-tight tracking-tight text-corporate font-bold">{estado.cantidad}</h6>
                        <small className="text-[0.875em] text-muted-foreground capitalize block" style={{ fontSize: '0.75rem' }}>
                          {estado.estado.replace('_', ' ')}
                        </small>
                        <div>
                          <small className="text-[0.875em] text-info">{estado.porcentaje}%</small>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </>
  );

  const renderFiltros = () => (
    <Card className="mb-6 shadow-xs">
      <Card.Header className="flex flex-col md:flex-row justify-between items-center">
        <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2 md:mb-0">🔍 Filtros y Búsqueda</h6>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setShowFiltros(!showFiltros)}
        >
          <FaFilter /> {showFiltros ? 'Ocultar' : 'Mostrar'}
        </Button>
      </Card.Header>
      {showFiltros && (
        <Card.Body>
          <Row>
            <Col xs={12} sm={6} lg={3} className="mb-4">
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
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} lg={3} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Vendedor</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.vendedor_id}
                  onChange={(e) => handleFiltroChange('vendedor_id', e.target.value)}
                >
                  <option value="todos">Todos</option>
                  {opcionesFiltro.vendedores.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.first_name} {v.last_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} lg={2} className="mb-4">
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
            <Col xs={12} sm={6} lg={2} className="mb-4">
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
            <Col xs={12} sm={6} lg={2} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">&nbsp;</Form.Label>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-full block"
                  onClick={limpiarFiltros}
                >
                  Limpiar
                </Button>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col xs={12} md={6} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Buscar</Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Buscar por póliza, prospecto, vendedor..."
                  value={filtros.buscar}
                  onChange={(e) => handleFiltroChange('buscar', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} md={3} className="mb-4">
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
            <Col xs={12} sm={6} md={3} className="mb-4">
              <Form.Group>
                <Form.Label className="text-[0.875em] font-semibold">Ordenar por</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtros.orden || 'mas_nuevos'}
                  onChange={(e) => handleFiltroChange('orden', e.target.value)}
                >
                  <option value="mas_nuevos">📅 Más nuevos primero</option>
                  <option value="mas_antiguos">📅 Más antiguos primero</option>
                  <option value="alfabetico">🔤 A-Z por cliente</option>
                  <option value="alfabetico_desc">🔤 Z-A por cliente</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      )}
    </Card>
  );

  const renderTabla = () => (
    <Card className="shadow-xs">
      <Card.Header className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="mb-2 md:mb-0">
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">Pólizas ({paginacion.total})</h6>
          <small className="text-[0.875em] text-muted-foreground block">
            {filtros.orden === 'mas_nuevos' && '📅 Ordenadas: Más nuevas primero'}
            {filtros.orden === 'mas_antiguos' && '📅 Ordenadas: Más antiguas primero'}
            {filtros.orden === 'alfabetico' && '🔤 Ordenadas: A-Z por cliente'}
            {filtros.orden === 'alfabetico_desc' && '🔤 Ordenadas: Z-A por cliente'}
          </small>
        </div>
        <div className="hidden md:flex flex-col sm:flex-row gap-2">
          <ButtonGroup size="sm">
            <Button
              variant={tipoVista === 'tabla' ? 'primary' : 'outline-primary'}
              onClick={() => setTipoVista('tabla')}
            >
              <FaList className="inline sm:hidden" />
              <span className="hidden sm:inline">Tabla</span>
            </Button>
            <Button
              variant={tipoVista === 'tarjetas' ? 'primary' : 'outline-primary'}
              onClick={() => setTipoVista('tarjetas')}
            >
              <FaThLarge className="inline sm:hidden" />
              <span className="hidden sm:inline">Tarjetas</span>
            </Button>
          </ButtonGroup>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {loading ? (
          <div className="text-center py-6">
            <Spinner animation="border" />
            <p className="mb-4 mt-2">Cargando pólizas...</p>
          </div>
        ) : polizas.length === 0 ? (
          <div className="text-center py-6">
            <p className="mb-4 text-muted-foreground">No se encontraron pólizas</p>
          </div>
        ) : tipoVista === 'tabla' ? (
          <Table responsive hover className="mb-0">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left whitespace-nowrap">Póliza</th>
                <th className="text-left whitespace-nowrap">Prospecto</th>
                <th className="text-left whitespace-nowrap hidden md:table-cell">Plan</th>
                <th className="text-left whitespace-nowrap hidden lg:table-cell">Vendedor</th>
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
                            <small className="text-[0.875em] text-muted-foreground">Sistema: {poliza.numero_poliza}</small>
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
                    <td>
                      <div className="flex flex-col gap-1">
                        <Badge bg={estadoBadge.bg}>{estadoBadge.text}</Badge>
                        <BadgeEstadoFirma poliza={poliza} />
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
                        {/* ✅ BOTÓN ENVIAR A FIRMA */}
                        <BotonEnviarFirma 
                          poliza={poliza}
                          size="sm"
                          showLabel={false}
                          userRole="supervisor"
                          onExito={() => {
                            fetchPolizas();
                          }}
                          onError={(error) => {
                            console.error('Error al enviar a firma:', error);
                          }}
                        />
                        {/* ✅ BOTÓN CARGAR PÓLIZA FIRMADA - Solo si está signed */}
                        {poliza.estado_firma === 'signed' && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => handleAbrirCargarPolizaFirmada(poliza)}
                            title="Cargar póliza firmada"
                          >
                            <FaCheckCircle className="me-1" />
                            Firmada
                          </Button>
                        )}
                        {/* ✅ AGREGAR BOTÓN DE EDITAR */}
                        <Button
                          variant="outline-success"
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
                        <Button
                          variant="outline-warning"
                          size="sm"
                          onClick={() => handleCambiarEstado(poliza)}
                          title="Cambiar estado"
                        >
                          <FaExchangeAlt />
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleVerHistorial(poliza)}
                          title="Ver historial de estados"
                        >
                          <FaHistory />
                        </Button>
                        <Button
                          variant="outline-info"
                          size="sm"
                          onClick={() => handleVerDocumentos(poliza)}
                          title="Ver documentos"
                        >
                          <FaFile />
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleDescargarPDF(poliza)}
                          title="Descargar PDF"
                          className="hidden sm:inline-block"
                        >
                          <FaDownload />
                        </Button>
                        {/* <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleEnviarWhatsApp(poliza)}
                          title="Enviar por WhatsApp"
                          className="d-none d-md-inline-block"
                        >
                          <FaWhatsapp />
                        </Button> */}
                        <BotonEliminarPoliza
                          poliza={poliza}
                          onEliminada={fetchPolizas}
                          size="sm"
                          showLabel={false}
                          endpointBase={`${API_URL}/supervisor/polizas`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Row className="p-4">
            {polizas.map(poliza => {
              const estadoBadge = getEstadoBadge(poliza.estado);
              return (
                <Col xs={12} sm={6} lg={4} xl={3} key={poliza.id} className="mb-4">
                  <Card className="h-full shadow-xs">
                    <Card.Header className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1 truncate">{poliza.numero_poliza_oficial || poliza.numero_poliza}</h6>
                          {poliza.numero_poliza_oficial && (
                            <small className="text-[0.875em] text-muted-foreground block">Sistema: {poliza.numero_poliza}</small>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge bg={estadoBadge.bg}>{estadoBadge.text}</Badge>
                          <BadgeEstadoFirma poliza={poliza} />
                        </div>
                      </div>
                    </Card.Header>
                    <Card.Body className="py-2">
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate truncate mb-1">{poliza.prospecto_nombre} {poliza.prospecto_apellido}</h6>
                      <p className="text-muted-foreground text-[0.875em] mb-1">
                        <strong>Plan:</strong> {poliza.plan_nombre}
                      </p>
                      <p className="text-muted-foreground text-[0.875em] mb-1">
                        <strong>Vendedor:</strong> {poliza.vendedor?.nombre} {poliza.vendedor?.apellido}
                      </p>
                      <div className="flex justify-between items-center">
                        <strong className="text-success">{formatCurrency(poliza.total_final)}</strong>
                        <small className="text-[0.875em] text-muted-foreground">{formatFecha(poliza.created_at)}</small>
                      </div>
                    </Card.Body>
                    <Card.Footer className="pt-2">
                      <div className="flex gap-1 flex-wrap">
                        {/* ✅ BOTÓN ENVIAR A FIRMA */}
                        <BotonEnviarFirma 
                          poliza={poliza}
                          size="sm"
                          showLabel={false}
                          userRole="supervisor"
                          onExito={() => {
                            fetchPolizas();
                          }}
                          onError={(error) => {
                            console.error('Error al enviar a firma:', error);
                          }}
                        />
                        {/* ✅ BOTÓN CARGAR PÓLIZA FIRMADA - Solo si está signed */}
                        {poliza.estado_firma === 'signed' && (
                          <Button size="sm" variant="outline-success" onClick={() => handleAbrirCargarPolizaFirmada(poliza)} title="Cargar póliza firmada">
                            <FaCheckCircle className="me-1" />
                            Firmada
                          </Button>
                        )}
                        <Button size="sm" variant="outline-success" onClick={() => handleEditarPoliza(poliza)} title="Editar póliza">
                          <FaEdit />
                        </Button>
                        <Button size="sm" variant="outline-success" onClick={() => handleSubirDocumentosLibres(poliza)} title="Agregar documentos">
                          <FaUpload />
                        </Button>
                        <Button size="sm" variant="outline-warning" onClick={() => handleCambiarEstado(poliza)} title="Cambiar estado">
                          <FaExchangeAlt />
                        </Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => handleVerHistorial(poliza)} title="Ver historial">
                          <FaHistory />
                        </Button>
                        <Button size="sm" variant="outline-primary" onClick={() => handleVerDocumentos(poliza)}>
                          <FaEye />
                        </Button>
                        <Button size="sm" variant="outline-success" onClick={() => handleDescargarPDF(poliza)}>
                          <FaDownload />
                        </Button>
                        <Button size="sm" variant="outline-info" onClick={() => handleEnviarWhatsApp(poliza)}>
                          <FaWhatsapp />
                        </Button>
                        <BotonEliminarPoliza
                          poliza={poliza}
                          onEliminada={fetchPolizas}
                          size="sm"
                          showLabel={false}
                          endpointBase={`${API_URL}/supervisor/polizas`}
                        />
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

  // ✅ FUNCIÓN PARA CAMBIAR ESTADO
  const handleCambiarEstado = (poliza) => {
    setPolizaCambioEstado(poliza);
    setEstadoSeleccionado(poliza.estado);
    setMotivoCambio('');
    setModalCambiarEstado(true);
  };

  const confirmarCambioEstado = async () => {
    if (!estadoSeleccionado || !motivoCambio.trim()) {
      Swal.fire('Error', 'Debe seleccionar un estado y proporcionar un motivo', 'error');
      return;
    }

    // ✅ VALIDAR QUE NO SEA EL MISMO ESTADO
    if (estadoSeleccionado === polizaCambioEstado.estado) {
      Swal.fire('Error', 'El estado seleccionado es el mismo que el actual', 'warning');
      return;
    }

    try {
      setLoadingCambioEstado(true);
      const token = localStorage.getItem("cober_token");

      // ✅ LOGS PARA DEBUG
      console.log('🔄 Enviando cambio de estado:', {
        poliza_id: polizaCambioEstado.id,
        estado_actual: polizaCambioEstado.estado,
        estado_nuevo: estadoSeleccionado,
        motivo: motivoCambio,
        url: `${getBaseUrl()}/${polizaCambioEstado.id}/estado`
      });

      const response = await axios.patch(
        `${getBaseUrl()}/${polizaCambioEstado.id}/estado`,
        {
          estado: estadoSeleccionado,
          motivo_cambio_estado: motivoCambio
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 segundos de timeout
        }
      );

      console.log('✅ Respuesta del servidor:', response.data);

      if (response.data.success) {
        setModalCambiarEstado(false);
        await fetchPolizas(); // Recargar lista

        Swal.fire({
          title: '¡Estado actualizado!',
          html: `
            <div class="text-center">
              <p><strong>Póliza:</strong> ${response.data.data.numero_poliza_oficial}</p>
              <p><strong>Cliente:</strong> ${response.data.data.prospecto}</p>
              <p><strong>Estado anterior:</strong> <span class="text-muted">${response.data.data.estado_anterior}</span></p>
              <p><strong>Estado nuevo:</strong> <span class="text-success">${response.data.data.estado_nuevo}</span></p>
              <p class="text-info">${response.data.data.mensaje}</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Entendido'
        });
      }

    } catch (error) {
      console.error('❌ Error completo cambiando estado:', error);

      let errorMessage = 'Error de conexión con el servidor';
      let errorDetails = '';

      if (error.response) {
        // El servidor respondió con un error
        errorMessage = error.response.data?.error || 'Error del servidor';
        errorDetails = error.response.data?.razon || error.response.data?.message || '';

        console.error('Error del servidor:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // La petición se hizo pero no hubo respuesta
        errorMessage = 'No se pudo conectar con el servidor';
        errorDetails = 'Verifique su conexión a internet';

        console.error('Error de red:', error.request);
      } else {
        // Error en la configuración de la petición
        errorMessage = 'Error configurando la petición';
        errorDetails = error.message;
      }

      Swal.fire({
        title: 'Error',
        html: `
          <div>
            <p><strong>${errorMessage}</strong></p>
            ${errorDetails ? `<p class="text-muted small">${errorDetails}</p>` : ''}
          </div>
        `,
        icon: 'error'
      });
    } finally {
      setLoadingCambioEstado(false);
    }
  };

  // ✅ NUEVA FUNCIÓN: Abrir modal de carga de póliza firmada
  const handleAbrirCargarPolizaFirmada = (poliza) => {
    setPolizaParaCargar(poliza);
    setModalCargarPolizaFirmada(true);
  };

  // ✅ NUEVA FUNCIÓN: Callback cuando se carga exitosamente la póliza firmada
  const handlePolizaFirmadaCargada = (resultado) => {
    Swal.fire('Éxito', '✅ Póliza firmada cargada exitosamente. Google Sheets actualizado automáticamente.', 'success');
    setModalCargarPolizaFirmada(false);
    setPolizaParaCargar(null);
    fetchPolizas(); // Recargar lista de pólizas
    
    // Si el modal de documentos está abierto, recargar documentos
    if (modalDocumentos && polizaSeleccionada) {
      handleVerDocumentos(polizaSeleccionada);
    }
  };

  // ✅ FUNCIÓN: Abrir modal estandarizado de edición de póliza
  const handleEditarPoliza = (poliza) => {
    setPolizaEdicion(poliza);
    setModalEditarPoliza(true);
  };

  return (
    <Container fluid className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-corporate">Dashboard de Pólizas</h2>
        <div className="flex gap-2">
          {/* <Button
            variant="success"
            onClick={() => setShowModalExportacion(true)}
            className="d-flex align-items-center"
          >
            <FaFile className="me-1" />
            <span className="d-none d-sm-inline">Exportar</span>
          </Button> */}
          <Button
            variant="primary"
            onClick={fetchEstadisticas}
            disabled={loadingStats}
          >
            {loadingStats ? <Spinner size="sm" /> : 'Actualizar'}
          </Button>
        </div>
      </div>

      {renderEstadisticas()}
      {renderFiltros()}
      
      {/* Separador visual entre filtros y tabla */}
      <div className="mb-6"></div>
      
      {renderTabla()}

      {/* Paginación */}
      {paginacion.total_pages > 1 && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline-primary"
            disabled={paginacion.current_page === 1}
            onClick={() => setPaginacion(prev => ({ ...prev, current_page: prev.current_page - 1 }))}
          >
            Anterior
          </Button>
          <span className="mx-4 self-center">
            Página {paginacion.current_page} de {paginacion.total_pages}
          </span>
          <Button
            variant="outline-primary"
            disabled={paginacion.current_page === paginacion.total_pages}
            onClick={() => setPaginacion(prev => ({ ...prev, current_page: prev.current_page + 1 }))}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* NUEVO MODAL: Documentos de la póliza */}
      <Modal show={modalDocumentos} onHide={() => setModalDocumentos(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Documentos de Póliza N° {polizaSeleccionada?.numero_poliza_oficial || polizaSeleccionada?.numero_poliza}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDocumentos ? (
            <div className="flex justify-center items-center" style={{ height: "50vh" }}>
              <Spinner animation="border" role="status">
                <span className="sr-only">Cargando documentos...</span>
              </Spinner>
            </div>
          ) : (
            <div>
              {Object.keys(documentos).length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  No hay documentos disponibles para esta póliza
                </div>
              ) : (
                Object.entries(documentos).map(([tipoDoc, docs]) => (
                  <div key={tipoDoc} className="mb-6">
                    <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate border-b pb-2">{formatTipoDocumento(tipoDoc)}</h5>
                    <Row className="[--gx:1rem] [--gy:1rem]">
                      {docs.map((documento) => (
                        <Col md={6} lg={4} key={documento.id}>
                          <Card className="h-full">
                            <Card.Header className="flex justify-between items-center">
                              <small className="text-[0.875em] text-muted-foreground">
                                {documento.integrante_index !== null && (
                                  <Badge bg="info" className="me-2">
                                    Integrante {documento.integrante_index + 1}
                                  </Badge>
                                )}
                                {formatFileSize(documento.tamaño_bytes)}
                              </small>
                            </Card.Header>
                            <Card.Body>
                              {documento.observaciones && (
                                <div className="mb-2">
                                  <strong>Título:</strong>
                                  <br />
                                  <span className="text-primary font-semibold">{documento.observaciones}</span>
                                </div>
                              )}
                              <div className="mb-2">
                                <strong>Archivo:</strong>
                                <br />
                                <small className="text-[0.875em] text-muted-foreground">{documento.nombre_original}</small>
                              </div>
                              <div className="mb-2">
                                <strong>Subido:</strong>
                                <br />
                                <small className="text-[0.875em] text-muted-foreground">
                                  {new Date(documento.created_at).toLocaleDateString('es-AR', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </small>
                              </div>
                            </Card.Body>
                            <Card.Footer>
                              <ButtonGroup size="sm" className="w-full mb-2">
                                <Button
                                  variant="primary"
                                  onClick={() => handleDescargarDocumento(documento.id, documento.nombre_original)}
                                  title="Descargar"
                                >
                                  <FaDownload />
                                </Button>
                                <Button
                                  variant="info"
                                  onClick={() => handlePreviewDocumento(documento.id, documento.tipo_mime)}
                                  title="Vista previa"
                                >
                                  <FaEye />
                                </Button>
                                <Button
                                  variant="warning"
                                  onClick={() => handleActualizarDocumento(documento)}
                                  title="Actualizar documento"
                                >
                                  <FaEdit />
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => handleEliminarDocumento(documento.id)}
                                  title="Eliminar"
                                >
                                  <FaTrash />
                                </Button>
                              </ButtonGroup>
                            </Card.Footer>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-between w-full">
            <Button 
              variant="primary" 
              onClick={() => handleAbrirCargaDocumentos(polizaSeleccionada)}
              className="me-2"
            >
              <FaFile className="me-2" />
              Cargar Más Documentos
            </Button>
            <Button variant="secondary" onClick={() => setModalDocumentos(false)}>
              Cerrar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* NUEVO MODAL: Preview de documento */}
      <DocumentPreviewModal
        show={showPreview}
        onHide={() => {
          setShowPreview(false);
          if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        previewUrl={previewUrl}
        previewMime={previewMime}
        documentName="Documento de Póliza"
        onDownload={() => {
          if (previewUrl) {
            // Crear un enlace temporal para descargar
            const link = document.createElement('a');
            link.href = previewUrl;
            link.download = `documento_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />

      {/* ✅ NUEVO MODAL: Actualizar Documento */}
      <Modal show={modalActualizarDoc} onHide={() => setModalActualizarDoc(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Actualizar Documento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {documentoActualizar && (
            <>
              <Alert variant="info">
                <strong>Documento actual:</strong> {documentoActualizar.nombre_original}
                <br />
                <small className="text-[0.875em] text-muted-foreground">
                  Tipo: {formatTipoDocumento(documentoActualizar.tipo_documento)} | 
                  Tamaño: {formatFileSize(documentoActualizar.tamaño_bytes)}
                </small>
              </Alert>
              
              <Form.Group className="mb-4">
                <Form.Label>Seleccionar nuevo archivo</Form.Label>
                <Form.Control
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setArchivoNuevo(e.target.files[0])}
                />
                <Form.Text className="text-muted-foreground">
                  Formatos permitidos: PDF, JPG, PNG, DOC, DOCX (máximo 10MB)
                </Form.Text>
              </Form.Group>

              {archivoNuevo && (
                <Alert variant="success">
                  <strong>Archivo seleccionado:</strong> {archivoNuevo.name}
                  <br />
                  <small className="text-[0.875em]">Tamaño: {formatFileSize(archivoNuevo.size)}</small>
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setModalActualizarDoc(false)}
            disabled={loadingActualizacion}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={confirmarActualizacionDocumento}
            disabled={!archivoNuevo || loadingActualizacion}
          >
            {loadingActualizacion ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Actualizando...
              </>
            ) : (
              'Actualizar Documento'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* MODAL: Cambiar Estado de Póliza */}
      <Modal show={modalCambiarEstado} onHide={() => setModalCambiarEstado(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Cambiar Estado - Póliza N° {polizaCambioEstado?.numero_poliza_oficial || polizaCambioEstado?.numero_poliza}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {polizaCambioEstado && (
            <div>
              <div className="mb-4">
                <strong>Cliente:</strong> {polizaCambioEstado.prospecto_nombre} {polizaCambioEstado.prospecto_apellido}
              </div>
              <div className="mb-4">
                <strong>Estado actual:</strong>
                <Badge bg={getEstadoBadge(polizaCambioEstado.estado).bg} className="ms-2">
                  {getEstadoBadge(polizaCambioEstado.estado).text}
                </Badge>
              </div>

              <Form.Group className="mb-4">
                <Form.Label>Nuevo Estado *</Form.Label>
                <Form.Select
                  value={estadoSeleccionado}
                  onChange={(e) => setEstadoSeleccionado(e.target.value)}
                  required
                >
                  <option value="">Seleccionar estado...</option>
                  <option value="asesor">Asesor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="back_office">Back Office</option>
                  <option value="venta_cerrada">Venta Cerrada</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Motivo del cambio *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  placeholder="Explique el motivo del cambio de estado..."
                  required
                />
              </Form.Group>

              <Alert variant="info" className="text-[0.875em]">
                <strong>Nota:</strong> Este cambio quedará registrado en el historial de la póliza
                y se notificará automáticamente al vendedor responsable.
              </Alert>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalCambiarEstado(false)} disabled={loadingCambioEstado}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmarCambioEstado}
            disabled={loadingCambioEstado || !estadoSeleccionado || !motivoCambio.trim()}
          >
            {loadingCambioEstado ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Actualizando...
              </>
            ) : (
              'Confirmar Cambio'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Modal estandarizado de edición de póliza */}
      <EditarPolizaModal
        show={modalEditarPoliza}
        onHide={() => { setModalEditarPoliza(false); setPolizaEdicion(null); }}
        poliza={polizaEdicion}
        onActualizar={fetchPolizas}
        apiContext={context === 'backoffice' ? 'backoffice' : 'supervisor'}
      />

      {/* ✅ Modal para subir documentos libres */}
      <SubirDocumentosLibresModal
        show={showSubirDocumentosModal}
        onHide={() => { setShowSubirDocumentosModal(false); setPolizaSubirDocumentos(null); }}
        poliza={polizaSubirDocumentos}
        apiContext={context === 'backoffice' ? 'backoffice' : 'supervisor'}
        onDocumentosActualizados={fetchPolizas}
      />

      {/* ✅ MODAL: Conversaciones WhatsApp */}
      <Modal show={modalConversaciones} onHide={() => setModalConversaciones(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaWhatsapp className="me-2 text-success" />
            Conversaciones WhatsApp
            {prospectoSeleccionado && (
              <div className="mt-1">
                <small className="text-[0.875em] text-muted-foreground">
                  {prospectoSeleccionado.nombre} {prospectoSeleccionado.apellido} - {prospectoSeleccionado.telefono}
                </small>
              </div>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingConversaciones ? (
            <div className="text-center py-6">
              <Spinner animation="border" role="status">
                <span className="sr-only">Cargando conversaciones...</span>
              </Spinner>
            </div>
          ) : conversacionesProspecto.length === 0 ? (
            <div className="text-center py-6">
              <div className="mb-4">
                <FaWhatsapp size={48} className="text-muted-foreground" />
              </div>
              <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-muted-foreground">No hay conversaciones iniciadas</h6>
              <p className="mb-4 text-muted-foreground">Este prospecto aún no tiene conversaciones de WhatsApp</p>
              <Button variant="success" onClick={handleNuevaConversacion}>
                <FaWhatsapp className="me-2" />
                Iniciar Nueva Conversación
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">Conversaciones ({conversacionesProspecto.length})</h6>
                <Button size="sm" variant="outline-success" onClick={handleNuevaConversacion}>
                  <FaWhatsapp className="me-1" />
                  Nueva
                </Button>
              </div>
              
              <div className="flex flex-col gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {conversacionesProspecto.map((conv) => {
                  const estadoConv = getEstadoConversacion(conv.estado);
                  const tipoOrigen = getTipoOrigen(conv.tipo_origen);
                  
                  return (
                    <Card key={conv.id} className="mb-4 border-0 shadow-xs">
                      <Card.Body className="py-4">
                        <div className="flex justify-between items-start">
                          <div className="grow">
                            <div className="flex items-center mb-2">
                              <Badge bg={estadoConv.color} className="me-2">
                                {estadoConv.texto}
                              </Badge>
                              <small className="text-[0.875em] text-muted-foreground">
                                {tipoOrigen.icon} {tipoOrigen.texto}
                              </small>
                              {conv.poliza_id && (
                                <small className="text-[0.875em] text-info ms-2">
                                  📄 Póliza #{conv.numero_poliza}
                                </small>
                              )}
                            </div>
                            
                            <div className="mb-2">
                              <strong>Conversación #{conv.numero_conversacion}</strong>
                              <br />
                              <small className="text-[0.875em] text-muted-foreground">
                                📞 {conv.telefono}
                              </small>
                            </div>

                            {conv.ultimo_mensaje && (
                              <div className="truncate text-sm text-muted-foreground bg-muted p-2 rounded-md">
                                <small className="text-[0.875em]">
                                  <strong>Último mensaje:</strong>
                                  <br />
                                  {conv.ultimo_mensaje.contenido.length > 100 
                                    ? `${conv.ultimo_mensaje.contenido.substring(0, 100)}...`
                                    : conv.ultimo_mensaje.contenido
                                  }
                                  <br />
                                  <span className="text-muted-foreground">
                                    {formatearFecha(conv.ultimo_mensaje.created_at)}
                                  </span>
                                </small>
                              </div>
                            )}

                            <div className="mt-2">
                              <Row>
                                <Col>
                                  <small className="text-[0.875em] text-muted-foreground">
                                    💬 {conv.total_mensajes} mensajes
                                  </small>
                                </Col>
                                <Col className="text-right">
                                  <small className="text-[0.875em] text-muted-foreground">
                                    🕒 {formatearFecha(conv.ultima_actividad)}
                                  </small>
                                </Col>
                              </Row>
                              {conv.mensajes_no_leidos > 0 && (
                                <Badge bg="danger" className="mt-1">
                                  {conv.mensajes_no_leidos} sin leer
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="ms-4">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => handleVerConversacion(conv)}
                            >
                              <FaEye className="me-1" />
                              Ver Chat
                            </Button>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalConversaciones(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Exportación */}
      <ModalExportacion
        show={showModalExportacion}
        onHide={() => setShowModalExportacion(false)}
        userRole="supervisor"
      />

      {/* ✅ NUEVO MODAL: Carga múltiple de documentos */}
      <Modal 
        show={modalCargaDocumentos} 
        onHide={handleCerrarCargaDocumentos} 
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaFile className="me-2 text-primary" />
            Cargar Documentos - Póliza #{polizaCargaDocumentos?.id}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {polizaCargaDocumentos && (
            <div className="mb-4 p-4 bg-muted rounded-md">
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">Información de la Póliza:</h6>
              <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]">
                <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                  <small className="text-[0.875em]"><strong>ID:</strong> {polizaCargaDocumentos.id}</small>
                </div>
                <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                  <small className="text-[0.875em]"><strong>Cliente:</strong> {polizaCargaDocumentos.nombre_prospecto}</small>
                </div>
                <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                  <small className="text-[0.875em]"><strong>Plan:</strong> {polizaCargaDocumentos.plan_nombre}</small>
                </div>
                <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                  <small className="text-[0.875em]"><strong>Estado:</strong> <Badge bg={getEstadoBadge(polizaCargaDocumentos.estado).bg}>{getEstadoBadge(polizaCargaDocumentos.estado).text}</Badge></small>
                </div>
              </div>
            </div>
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

      {/* ✅ MODAL SEPARADO: Carga de documentos múltiples */}
      {polizaCargaDocumentos && (
        <CargaMultipleDocumentos 
          polizaId={polizaCargaDocumentos.id}
          show={modalCargaDocumentos}
          onHide={handleCerrarCargaDocumentos}
          onDocumentosActualizados={handleDocumentosActualizados}
        />
      )}

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
                      <small className="text-[0.875em]"><strong>Cliente:</strong> {polizaHistorial.nombre_prospecto}</small>
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

      {/* ✅ MODAL: Cargar Póliza Firmada */}
      <CargarPolizaFirmadaModal
        show={modalCargarPolizaFirmada}
        onHide={() => {
          setModalCargarPolizaFirmada(false);
          setPolizaParaCargar(null);
        }}
        polizaId={polizaParaCargar?.id}
        numeroPoliza={polizaParaCargar?.numero_poliza}
        onSuccess={handlePolizaFirmadaCargada}
      />

    </Container>
  );
};


export default PolizasSupervisor;