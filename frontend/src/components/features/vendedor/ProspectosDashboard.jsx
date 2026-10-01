import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutGridIcon, ListIcon, Loader2Icon, PlusIcon, SearchXIcon } from "lucide-react";
import Swal from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/app/page-header";
import { ENDPOINTS, API_URL, GECROS_HABILITADO } from "../../config";
import PromocionesModal from "./PromocionesModal";
import DocumentPreviewModal from "../../common/DocumentPreviewModal";
import PolizasDashboard from "./PolizasDashboard";
import WhatsAppVista from "./WhatsAppVista";
import VendedorSidebar from "../../layout/VendedorSidebar";
import ManualWidget from "../../common/ManualWidget";
import CargaDocumentosModal from "../../common/CargaDocumentosModal";
import EditarPolizaModal from "./modals/EditarPolizaModal";
import SubirDocumentosLibresModal from "./modals/SubirDocumentosLibresModal";
import ProspectoCard from "./prospectos/ProspectoCard";
import ProspectosTabla from "./prospectos/ProspectosTabla";
import ProspectosFiltros, { FILTROS_VACIOS } from "./prospectos/ProspectosFiltros";
import ProspectosPaginacion from "./prospectos/ProspectosPaginacion";
import NuevoProspectoDialog from "./prospectos/NuevoProspectoDialog";
import HistorialDialog from "./prospectos/HistorialDialog";
import { ActualizarDocumentoDialog, DocumentosPolizaDialog } from "./prospectos/DocumentosPolizaDialog";
import { cn } from "@/lib/utils";

const ProspectosDashboard = () => {
  const [prospectos, setProspectos] = useState([]);
  const [tiposAfiliacion, setTiposAfiliacion] = useState([]);
  const [localidades, setLocalidades] = useState([]); // ✅ AGREGAR estado para localidades
  const [loading, setLoading] = useState(true);
  const [showFiltrosMobile, setShowFiltrosMobile] = useState(false);
  const [alertaGuardado, setAlertaGuardado] = useState({ show: false, mensaje: "", prospectoId: null });


  const [selectedProspecto, setSelectedProspecto] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    edad: "",
    tipo_afiliacion_id: "",
    sueldo_bruto: "",
    categoria_monotributo: "",
    estado: "Lead",
    comentario: "",
  });
  const [editValues, setEditValues] = useState({});
  const [familiares, setFamiliares] = useState([]);
  const [nuevoFamiliar, setNuevoFamiliar] = useState({
    vinculo: "",
    nombre: "",
    edad: "",
    tipo_afiliacion_id: "",
    sueldo_bruto: "",
    categoria_monotributo: ""
  });
  const [menorDeUnAnioTitular, setMenorDeUnAnioTitular] = useState(false);
  const [menorDeUnAnioFamiliar, setMenorDeUnAnioFamiliar] = useState(false);
  const [showFamiliar, setShowFamiliar] = useState(false);
  const [categoriasMonotributo] = useState(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"]);
  const [showPromocionesModal, setShowPromocionesModal] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [promociones, setPromociones] = useState([]);
  const [openDrawer, setOpenDrawer] = useState(false);
  const location = useLocation();
  const [vista, setVista] = useState(location.state?.vista || "prospectos");
  const [tipoVista, setTipoVista] = useState("tarjetas"); // "tabla" o "tarjetas"
  const [filtros, setFiltros] = useState({
    nombre: "",
    apellido: "",
    edad: "",
    estado: "",
    origen: "",
    fechaDesde: "",
    fechaHasta: "",
    horaDesde: "",
    horaHasta: "",
  });
  const [ordenLeads, setOrdenLeads] = useState("llegada_asc"); // "llegada_asc" | "llegada_desc"
  const [paginaActual, setPaginaActual] = useState(1);
  const PROSPECTOS_POR_PAGINA = 20;
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);

  // Agregar estados para pólizas
  const [polizas, setPolizas] = useState([]);
  const [loadingPolizas, setLoadingPolizas] = useState(false);

  // Agregar estados para documentos
  const [documentos, setDocumentos] = useState([]);
  const [modalDocumentos, setModalDocumentos] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState(null);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);

  // Estados para actualización de documentos
  const [modalActualizarDoc, setModalActualizarDoc] = useState(false);
  const [documentoActualizar, setDocumentoActualizar] = useState(null);
  const [nuevoArchivo, setNuevoArchivo] = useState(null);
  const [motivoActualizacion, setMotivoActualizacion] = useState('');
  const [loadingActualizar, setLoadingActualizar] = useState(false);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [modalCargaDocumentos, setModalCargaDocumentos] = useState(false); // ✅ Estado para modal de carga de documentos

  // ✅ NUEVO: Estados para editar póliza
  const [showEditarPolizaModal, setShowEditarPolizaModal] = useState(false);
  const [polizaEditando, setPolizaEditando] = useState(null);

  // ✅ NUEVO: Estados para subir documentos libres
  const [showSubirDocumentosModal, setShowSubirDocumentosModal] = useState(false);
  const [polizaSubirDocumentos, setPolizaSubirDocumentos] = useState(null);

  // 🎮 GAMING: Estados para métricas motivadoras
  const [metricsVisible, setMetricsVisible] = useState(true);
  const [gamingStats, setGamingStats] = useState({
    nivel: 1,
    experiencia: 0,
    experienciaParaSiguienteNivel: 100,
    ventasHoy: 0,
    ventasSemana: 0,
    ventasMes: 0,
    streakActual: 0,
    mejorStreak: 0,
    puntuacionTotal: 0,
    logrosDesbloqueados: []
  });

  const navigate = useNavigate();

  const vinculos = [
    { value: "pareja/conyuge", label: "Pareja/Conyuge" },
    { value: "hijo/a", label: "Hijo/a" },
    { value: "familiar a cargo", label: "Familiar a cargo" }
  ];

  useEffect(() => {
    fetchProspectos();
    fetchTiposAfiliacion();
    fetchPromociones();
    fetchLocalidades(); // ✅ AGREGAR llamada para cargar localidades
  }, []);

  // ✅ AGREGAR función para cargar localidades
  const fetchLocalidades = async () => {
    try {
      const response = await axios.get(`${API_URL}/localidades/buenos-aires`);
      setLocalidades(response.data);
    } catch (error) {
      console.error("Error al obtener localidades:", error);
      setLocalidades([]); // En caso de error, mantener array vacío
    }
  };

  const guardarCambioProspecto = async (prospecto, campo, valor) => {
    const token = localStorage.getItem("cober_token");

    // Evitar guardados innecesarios: verificar cambios reales
    const valorActual = campo === "comentario"
      ? (prospecto.comentario || "")
      : (campo === "estado" ? (prospecto.estado || "") : prospecto[campo]);

    const valorNuevo = (valor ?? "");
    if (String(valorNuevo).trim() === String(valorActual).trim()) {
      return; // No hay cambios reales, no guardar ni mostrar alerta
    }

    try {
      // Solo enviar los campos necesarios (no re-enviar familiares para evitar re-validación)
      const { familiares, ...prospectoSinFamiliares } = prospecto;
      await axios.put(
        `${ENDPOINTS.PROSPECTOS}/${prospecto.id}`,
        { ...prospectoSinFamiliares, [campo]: valor },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlertaGuardado({ show: true, mensaje: `Cambio de ${campo === "estado" ? "estado" : "comentario"} guardado correctamente.`, prospectoId: prospecto.id });
      setTimeout(() => setAlertaGuardado({ show: false, mensaje: "", prospectoId: null }), 2500);
      await fetchProspectos();
      if (campo === "estado") {
        actualizarMetricasGaming();
      }
    } catch (error) {
      setAlertaGuardado({ show: true, mensaje: "Error al guardar el cambio.", prospectoId: prospecto.id });
      setTimeout(() => setAlertaGuardado({ show: false, mensaje: "", prospectoId: null }), 2500);
    }
  };

  // 🎮 GAMING: Crear una versión estable de los datos para evitar recálculos innecesarios
  const prospectoDataStable = useMemo(() => {
    const estadosHash = prospectos.map(p => `${p.id}-${p.estado}-${p.updated_at}`).join('|');
    const totalProspectos = prospectos.length;
    const totalVentas = prospectos.filter(p => p.estado === 'Venta').length;

    return {
      totalProspectos,
      totalVentas,
      estadosHash,
      prospectos: prospectos
    };
  }, [prospectos.map(p => `${p.id}-${p.estado}-${p.updated_at}`).join('|')]);

  // 🎮 GAMING: Calcular métricas solo cuando realmente cambien los estados
  const gamingStatsCalculated = useMemo(() => {
    if (prospectoDataStable.totalProspectos === 0) {
      return {
        nivel: 1,
        experiencia: 0,
        experienciaParaSiguienteNivel: 500,
        ventasHoy: 0,
        ventasSemana: 0,
        ventasMes: 0,
        streakActual: 0,
        mejorStreak: 0,
        puntuacionTotal: 0,
        logrosDesbloqueados: []
      };
    }

    const hoy = new Date().toDateString();
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const inicioMes = new Date();
    inicioMes.setDate(1);

    // Contar ventas por período
    const ventasHoy = prospectoDataStable.prospectos.filter(p =>
      p.estado === 'Venta' &&
      new Date(p.updated_at).toDateString() === hoy
    ).length;

    const ventasSemana = prospectoDataStable.prospectos.filter(p =>
      p.estado === 'Venta' &&
      new Date(p.updated_at) >= inicioSemana
    ).length;

    const ventasMes = prospectoDataStable.prospectos.filter(p =>
      p.estado === 'Venta' &&
      new Date(p.updated_at) >= inicioMes
    ).length;

    // Calcular puntuación total
    let puntuacionTotal = 0;
    prospectoDataStable.prospectos.forEach(p => {
      switch (p.estado) {
        case 'Venta': puntuacionTotal += 100; break;
        case 'Calificado Pago': puntuacionTotal += 75; break;
        case 'Calificado Póliza': puntuacionTotal += 50; break;
        case 'Calificado Cotización': puntuacionTotal += 25; break;
        case '1º Contacto': puntuacionTotal += 10; break;
        default: puntuacionTotal += 5; break;
      }
    });

    // Calcular nivel y experiencia
    const nivel = Math.floor(puntuacionTotal / 500) + 1;
    const experiencia = puntuacionTotal % 500;
    const experienciaParaSiguienteNivel = 500;

    // Calcular streak
    const ventasPorDia = {};
    prospectoDataStable.prospectos.filter(p => p.estado === 'Venta').forEach(p => {
      const fecha = new Date(p.updated_at).toDateString();
      ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + 1;
    });

    let streakActual = 0;
    let mejorStreak = 0;
    let racha = 0;

    const fechas = Object.keys(ventasPorDia).sort((a, b) => new Date(b) - new Date(a));

    for (let i = 0; i < fechas.length; i++) {
      const fechaActual = new Date(fechas[i]);
      const fechaAnterior = i > 0 ? new Date(fechas[i - 1]) : null;

      if (!fechaAnterior || (fechaAnterior - fechaActual) / (1000 * 60 * 60 * 24) === 1) {
        racha++;
        if (i === 0) streakActual = racha;
      } else {
        mejorStreak = Math.max(mejorStreak, racha);
        racha = 1;
      }
    }

    mejorStreak = Math.max(mejorStreak, racha);

    // Calcular logros
    const logrosDesbloqueados = [];
    const totalVentas = prospectoDataStable.totalVentas;
    const totalProspectos = prospectoDataStable.totalProspectos;

    // Logros por cantidad de ventas
    if (totalVentas >= 1) logrosDesbloqueados.push({ id: 'primera_venta', titulo: '🎯 Primera Venta', descripcion: '¡Tu primera venta!' });
    if (totalVentas >= 5) logrosDesbloqueados.push({ id: 'vendedor_junior', titulo: '🥉 Vendedor Junior', descripcion: '5 ventas completadas' });
    if (totalVentas >= 10) logrosDesbloqueados.push({ id: 'vendedor_experto', titulo: '🥈 Vendedor Experto', descripcion: '10 ventas completadas' });
    if (totalVentas >= 25) logrosDesbloqueados.push({ id: 'vendedor_master', titulo: '🥇 Vendedor Master', descripcion: '25 ventas completadas' });
    if (totalVentas >= 50) logrosDesbloqueados.push({ id: 'vendedor_legend', titulo: '💎 Vendedor Legendario', descripcion: '50 ventas completadas' });

    // Logros por streak
    if (mejorStreak >= 3) logrosDesbloqueados.push({ id: 'racha_3', titulo: '🔥 En Racha', descripcion: '3 días consecutivos vendiendo' });
    if (mejorStreak >= 7) logrosDesbloqueados.push({ id: 'racha_7', titulo: '🚀 Imparable', descripcion: '7 días consecutivos vendiendo' });

    // Logros por productividad
    if (totalProspectos >= 50) logrosDesbloqueados.push({ id: 'prospector', titulo: '📈 Gran Prospector', descripcion: '50 prospectos gestionados' });
    if (totalProspectos >= 100) logrosDesbloqueados.push({ id: 'super_prospector', titulo: '🎪 Super Prospector', descripcion: '100 prospectos gestionados' });

    return {
      nivel,
      experiencia,
      experienciaParaSiguienteNivel,
      ventasHoy,
      ventasSemana,
      ventasMes,
      streakActual,
      mejorStreak,
      puntuacionTotal,
      logrosDesbloqueados
    };
  }, [prospectoDataStable.estadosHash]); // Solo cuando cambien realmente los estados

  // 🎮 GAMING: Crear valores estables para evitar re-renders innecesarios
  const gamingStatsStable = useMemo(() => ({
    nivel: gamingStats.nivel,
    experiencia: gamingStats.experiencia,
    experienciaParaSiguienteNivel: gamingStats.experienciaParaSiguienteNivel,
    ventasHoy: gamingStats.ventasHoy,
    ventasSemana: gamingStats.ventasSemana,
    ventasMes: gamingStats.ventasMes,
    streakActual: gamingStats.streakActual,
    logrosDesbloqueados: gamingStats.logrosDesbloqueados
  }), [
    gamingStats.nivel,
    gamingStats.experiencia,
    gamingStats.ventasHoy,
    gamingStats.ventasSemana,
    gamingStats.ventasMes,
    gamingStats.streakActual,
    gamingStats.logrosDesbloqueados.length
  ]);

  // 🎮 GAMING: Función estable para actualizar métricas solo cuando cambia estado
  const actualizarMetricasGaming = useCallback(() => {
    // 🛡️ PROTECCIÓN: No actualizar durante verificaciones de sesión
    const isSessionChecking = document.body.classList.contains('session-check-active');
    if (isSessionChecking) {
      // Retrasar actualización hasta que termine la verificación de sesión
      setTimeout(() => {
        setGamingStats(prevStats => {
          if (JSON.stringify(prevStats) !== JSON.stringify(gamingStatsCalculated)) {
            return gamingStatsCalculated;
          }
          return prevStats;
        });
      }, 250);
      return;
    }

    setGamingStats(prevStats => {
      // Solo actualizar si realmente hay cambios
      if (JSON.stringify(prevStats) !== JSON.stringify(gamingStatsCalculated)) {
        return gamingStatsCalculated;
      }
      return prevStats;
    });
  }, [gamingStatsCalculated]);

  // 🎮 GAMING: Cargar métricas iniciales solo una vez y cuando cambien los estados
  useEffect(() => {
    if (prospectoDataStable.totalProspectos > 0) {
      // 🛡️ PROTECCIÓN: Verificar que no hay verificación de sesión activa
      const isSessionChecking = document.body.classList.contains('session-check-active');
      if (!isSessionChecking) {
        setGamingStats(gamingStatsCalculated);
      } else {
        // Si hay verificación de sesión, retrasar la actualización
        setTimeout(() => {
          setGamingStats(gamingStatsCalculated);
        }, 200);
      }
    }
  }, [prospectoDataStable.estadosHash]); // Solo cuando cambien realmente los estados

  // 🎮 GAMING: Función para mostrar celebración de venta - ELIMINADA para evitar animaciones
  // Esta función ha sido removida para eliminar las animaciones de celebración

  // 🎮 GAMING: Función para obtener clase CSS según el valor
  // 🎮 GAMING: Función para obtener clase CSS según el valor - memoizada para Service Worker
  const getStatClass = useCallback((value, type) => {
    let baseClass = "stat-number";

    if (type === 'ventas') {
      if (value >= 50) return `${baseClass} diamond`;
      if (value >= 25) return `${baseClass} gold`;
      if (value >= 10) return `${baseClass} silver`;
      if (value >= 5) return `${baseClass} bronze`;
    } else if (type === 'streak') {
      if (value >= 7) return `${baseClass} diamond`;
      if (value >= 5) return `${baseClass} gold`;
      if (value >= 3) return `${baseClass} silver`;
      if (value >= 1) return `${baseClass} bronze`;
    }

    return baseClass;
  }, []);

  // 🎮 GAMING: Función para obtener mensaje motivacional dinámico - estable
  const getMensajeMotivacional = useCallback((stats) => {
    const { ventasHoy, streakActual, nivel } = stats || gamingStats;

    if (ventasHoy === 0) {
      const mensajes = [
        "¡Es hora de conseguir tu primera venta del día! 💪",
        "¡Un nuevo día, nuevas oportunidades! ¡Ve por esa venta! 🎯",
        "¡Tu próxima venta está esperándote! ¡Adelante! 🚀"
      ];
      return mensajes[Math.floor(Math.random() * mensajes.length)];
    } else if (ventasHoy === 1) {
      return "¡Excelente! Ya tienes una venta. ¿Puedes conseguir una más? 🎯";
    } else if (streakActual >= 5) {
      return `¡INCREÍBLE! ${streakActual} días vendiendo consecutivos. ¡Eres una máquina! 🔥`;
    } else if (ventasHoy >= 5) {
      return `¡BRUTAL! ${ventasHoy} ventas hoy. ¡Estás en modo bestia! 🦁`;
    } else {
      return `¡Genial! ${ventasHoy} ventas hoy. ¡Sigue así, campeón! 🌟`;
    }
  }, []); // Sin dependencias para evitar re-renders

  // Función para obtener prospectos
  const fetchProspectos = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${ENDPOINTS.PROSPECTOS}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // ✅ ORDENAR: refrito visible en cola primero, luego Super Leads (flujo-wss)
      // y validados por WhatsApp, luego por fecha real descendente
      const prospectosOrdenados = [...response.data].sort((a, b) => {
        const aEsRefritoVisible = a.es_reciclado === 1 && a.visible_refrito === 1 && a.estado === 'Lead';
        const bEsRefritoVisible = b.es_reciclado === 1 && b.visible_refrito === 1 && b.estado === 'Lead';
        if (aEsRefritoVisible && !bEsRefritoVisible) return -1;
        if (!aEsRefritoVisible && bEsRefritoVisible) return 1;

        const aPrioridad = (a.origen === 'flujo-wss' ? 1 : 0) + (a.validado === 1 ? 1 : 0);
        const bPrioridad = (b.origen === 'flujo-wss' ? 1 : 0) + (b.validado === 1 ? 1 : 0);
        if (bPrioridad !== aPrioridad) return bPrioridad - aPrioridad;

        const fechaA = new Date(a.fecha_hora_registro || a.fecha_registro || 0).getTime();
        const fechaB = new Date(b.fecha_hora_registro || b.fecha_registro || 0).getTime();

        if (fechaA !== fechaB) {
          return fechaB - fechaA;
        }

        return (b.id || 0) - (a.id || 0);
      });
      setProspectos(prospectosOrdenados);
    } catch (error) {
      console.error("Error al obtener los prospectos:", error);
      Swal.fire("Error", "No se pudieron cargar los prospectos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTiposAfiliacion = async () => {
    try {
      const response = await axios.get(`${ENDPOINTS.TIPOS_AFILIACION}`);
      setTiposAfiliacion(response.data);
    } catch (error) {
      console.error("Error al obtener los tipos de afiliación:", error);
      Swal.fire("Error", "No se pudieron cargar los tipos de afiliación.", "error");
    }
  };

  const fetchPromociones = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/vendedor/promociones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPromociones(data);
    } catch (error) {
      console.error("Error al obtener promociones:", error);
    }
  };

  // Función para obtener pólizas
  const fetchPolizas = async () => {
    try {
      setLoadingPolizas(true);
      console.log('🔍 Iniciando fetchPolizas...');

      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/polizas/vendedor/mis-polizas`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log('📊 Respuesta completa del servidor:', data);
      console.log('📋 Datos de pólizas:', data?.data);
      console.log('📋 Cantidad de pólizas:', data?.data?.length);

      if (data?.data?.length > 0) {
        console.log('🔍 Primera póliza recibida:', data.data[0]);
        console.log('👤 Datos del prospecto en primera póliza:', {
          nombre: data.data[0].prospecto_nombre,
          apellido: data.data[0].prospecto_apellido,
          plan: data.data[0].plan_nombre,
          total: data.data[0].total_final
        });
      }

      setPolizas(data.data || []);
    } catch (error) {
      console.error("❌ Error al obtener pólizas:", error);
      Swal.fire("Error", "No se pudieron cargar las pólizas.", "error");
    } finally {
      setLoadingPolizas(false);
    }
  };

  const fetchHistorial = async (prospectoId) => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/prospectos/${prospectoId}/historial`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistorial(data);
    } catch (error) {
      console.error("Error al obtener historial:", error);
      setHistorial([]);
    }
  };

  // Función para obtener documentos de una póliza
  const fetchDocumentosPoliza = async (polizaId) => {
    try {
      setLoadingDocumentos(true);
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/vendedor/polizas/${polizaId}/documentos`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('📄 Documentos obtenidos del vendedor:', data);
      // El backend devuelve { success, documentos: {...}, total_documentos }
      // Convertir el objeto agrupado en un array plano para el componente
      const documentosArray = [];
      if (data.documentos) {
        Object.entries(data.documentos).forEach(([tipo, docs]) => {
          docs.forEach(doc => {
            documentosArray.push({ ...doc, tipo_documento: tipo });
          });
        });
      }
      setDocumentos(documentosArray);
    } catch (error) {
      console.error("Error al obtener documentos:", error);
      setDocumentos([]);
    } finally {
      setLoadingDocumentos(false);
    }
  };

  const handlePreviewDocumento = async (documentoId, mimeType) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/vendedor/polizas/documentos/${documentoId}/preview`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      setPreviewUrl(url);
      setPreviewMime(mimeType);
      setShowPreview(true);
    } catch (error) {
      console.error("Error al previsualizar documento:", error);
      Swal.fire("Error", "No se pudo previsualizar el documento", "error");
    }
  };

  // Funciones para actualizar documentos
  const handleActualizarDocumento = (documento) => {
    setDocumentoActualizar(documento);
    setMotivoActualizacion('');
    setNuevoArchivo(null);
    setModalActualizarDoc(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        Swal.fire("Error", "El archivo es demasiado grande. Máximo 10MB permitido.", "error");
        e.target.value = '';
        return;
      }
      setNuevoArchivo(file);
    }
  };

  const handleSubmitActualizacion = async (e) => {
    e.preventDefault();

    if (!nuevoArchivo) {
      Swal.fire("Error", "Debe seleccionar un archivo", "error");
      return;
    }

    if (!motivoActualizacion.trim()) {
      Swal.fire("Error", "Debe ingresar el motivo de la actualización", "error");
      return;
    }

    setLoadingActualizar(true);

    try {
      const formData = new FormData();
      formData.append('documento', nuevoArchivo);
      formData.append('motivo_actualizacion', motivoActualizacion.trim());

      const token = localStorage.getItem("cober_token");
      const response = await axios.put(
        `${API_URL}/polizas/documentos/${documentoActualizar.id}/actualizar`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        Swal.fire("Éxito", "Documento actualizado correctamente", "success");
        setModalActualizarDoc(false);
        // Recargar documentos
        await fetchDocumentosPoliza(polizaSeleccionada.id);
      } else {
        throw new Error(response.data.message || 'Error al actualizar documento');
      }

    } catch (error) {
      console.error("Error actualizando documento:", error);
      const errorMsg = error.response?.data?.message || error.message || "Error al actualizar documento";
      Swal.fire("Error", errorMsg, "error");
    } finally {
      setLoadingActualizar(false);
    }
  };

  const handleCancelarActualizacion = () => {
    setModalActualizarDoc(false);
    setDocumentoActualizar(null);
    setNuevoArchivo(null);
    setMotivoActualizacion('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === "tipo_afiliacion_id") {
      const tipo = tiposAfiliacion.find(t => t.id === Number(value));
      if (tipo?.requiere_sueldo !== 1) newFormData.sueldo_bruto = "";
      if (tipo?.requiere_categoria !== 1) newFormData.categoria_monotributo = "";
    }

    // ✅ Auto-consultar Gecros cuando el DNI tenga al menos 7 dígitos
    if (name === 'dni' && value.length >= 7) {
      setTimeout(() => handleConsultarGecros({ dni: value, id: formData.id || null }), 500);
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("cober_token");

    // ✅ NO enviar 'origen' para que el backend asigne automáticamente "Vendedor-App"
    const { origen, ...formDataSinOrigen } = formData;

    const data = {
      ...formDataSinOrigen,
      familiares: familiares.map(fam => ({
        vinculo: fam.vinculo,
        nombre: fam.nombre,
        edad: (fam.edad !== '' && fam.edad !== null && fam.edad !== undefined) ? Number(fam.edad) : null,
        tipo_afiliacion_id: fam.tipo_afiliacion_id ? Number(fam.tipo_afiliacion_id) : null,
        sueldo_bruto: fam.sueldo_bruto ? Number(fam.sueldo_bruto) : null,
        categoria_monotributo: fam.categoria_monotributo || null,
      })),
    };

    // 🔍 DEBUG: Verificar qué se está enviando
    console.log('📤 Datos a enviar:', data);
    console.log('📤 ¿Tiene origen?', 'origen' in data);

    try {
      const response = await axios.post(`${ENDPOINTS.PROSPECTOS}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // ✅ Verificar si es prospecto existente y mostrar información precisa según el caso
      if (response.data.esProspectoExistente && response.data.reasignacionPermitida) {
        // 🔁 Dato repetido SIN evolución (estancado 14+ días) - se reasignó automáticamente a este vendedor
        const diasInfo = response.data.diasEstancado != null
          ? `<br/><small>Estuvo ${response.data.diasEstancado} días sin novedades en estado "${response.data.estadoActual || ''}".</small>`
          : '';
        const idInfo = response.data.prospectoId
          ? `<div style="background-color: #e8f4f8; border: 1px solid #bee5eb; border-radius: 4px; padding: 8px; margin-top: 10px; font-size: 0.9em;"><strong>📋 ID de referencia: #${response.data.prospectoId}</strong></div>`
          : '';

        Swal.fire({
          title: "Dato Repetido Reasignado a Vos",
          html: `<div style="background-color: #d1e7dd; border: 1px solid #badbcc; border-radius: 4px; padding: 10px;"><strong>✅ Este contacto ya estaba en el sistema, pero no tuvo novedades y quedó estancado.</strong>${diasInfo}<br/>Se te asignó para que lo retomes.</div>${idInfo}`,
          icon: "success",
          confirmButtonText: "Entendido"
        });
      } else if (response.data.esProspectoExistente) {
        // ⛔ Duplicado que SÍ está siendo gestionado activamente por otro vendedor - no se reasigna
        const vendedoresInfo = response.data.vendedoresAsignados && response.data.vendedoresAsignados.length > 0
          ? `<div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin-top: 10px;"><strong>⚠️ Prospecto en gestión activa</strong><br/>Este prospecto ya está registrado y asignado a:<br/><ul style="margin-bottom: 0;">${response.data.vendedoresAsignados.map(v => `<li>${v}</li>`).join('')}</ul></div>`
          : '';

        const idInfo = response.data.prospectoId
          ? `<div style="background-color: #e8f4f8; border: 1px solid #bee5eb; border-radius: 4px; padding: 8px; margin-top: 8px; font-size: 0.9em;"><strong>📋 ID del prospecto existente: #${response.data.prospectoId}</strong><br/><small>Informá este número al back office para localizarlo.</small></div>`
          : '';

        Swal.fire({
          title: "Prospecto Duplicado - En Gestión",
          html: `${response.data.message}${vendedoresInfo}${idInfo}`,
          icon: "warning",
          confirmButtonText: "Entendido"
        });
      } else {
        Swal.fire("Éxito", response.data.message || "Prospecto creado y cotizado correctamente.", "success");
      }

      setShowFormModal(false);

      // ✅ Actualizar la lista de prospectos primero
      await fetchProspectos();

      // 🎮 GAMING: Actualizar métricas después de crear nuevo prospecto
      setTimeout(() => {
        actualizarMetricasGaming();
      }, 100);

      setFormData({
        nombre: "",
        apellido: "",
        edad: "",
        tipo_afiliacion_id: "",
        sueldo_bruto: "",
        categoria_monotributo: "",
        numero_contacto: "",
        correo: "",
        localidad: "",
        estado: "Lead",
        comentario: "",
      });
      setFamiliares([]); // ✅ Limpiar familiares
      setNuevoFamiliar({ vinculo: "", nombre: "", edad: "", tipo_afiliacion_id: "", sueldo_bruto: "", categoria_monotributo: "" }); // ✅ Limpiar formulario de familiar
      setMenorDeUnAnioTitular(false);
      setMenorDeUnAnioFamiliar(false);
    } catch (error) {
      console.error("Error al guardar el prospecto:", error);

      // Verificar si hay errores de validación específicos
      if (error.response && error.response.data && error.response.data.errores) {
        // Crear una lista HTML con los errores
        const erroresList = error.response.data.errores.map(err => `• ${err}`).join('<br>');

        Swal.fire({
          title: "Error de validación",
          html: `Por favor, corrige los siguientes errores:<br><br>${erroresList}`,
          icon: "warning",
          confirmButtonText: "Entendido"
        });
      } else {
        // Mensaje genérico para otros tipos de errores
        Swal.fire("Error",
          error.response?.data?.message || "No se pudo guardar el prospecto.",
          "error");
      }
    }
  };

  const handleCardChange = (id, field, value) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleCardSave = async (prospecto) => {
    const token = localStorage.getItem("cober_token");
    const values = editValues[prospecto.id] || {};

    // Detectar cambio de estado y comentario actual
    const estadoCambiado = values.estado !== undefined && values.estado !== prospecto.estado;
    const comentarioActual = values.comentario !== undefined ? values.comentario : prospecto.comentario;

    // 🎮 GAMING: Detectar nueva venta
    const nuevaVenta = estadoCambiado && values.estado === 'Venta' && prospecto.estado !== 'Venta';

    try {
      await axios.put(
        `${ENDPOINTS.PROSPECTOS}/${prospecto.id}`,
        {
          ...prospecto,
          estado: values.estado !== undefined ? values.estado : prospecto.estado,
          comentario: comentarioActual,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // ✅ Actualizar la lista de prospectos primero
      await fetchProspectos();

      // 🎮 GAMING: Actualizar métricas solo cuando cambia el estado
      if (estadoCambiado) {
        setTimeout(() => {
          actualizarMetricasGaming();
        }, 100); // Pequeño delay para que se actualicen los prospectos primero
      }

      // 🎮 GAMING: Celebración eliminada - solo actualización silenciosa de métricas

      Swal.fire("Éxito", "Prospecto actualizado correctamente.", "success");
      setEditValues((prev) => ({ ...prev, [prospecto.id]: {} }));
    } catch (error) {
      console.error("Error al actualizar el prospecto:", error);

      // Verificar si hay errores de validación específicos
      if (error.response && error.response.data && error.response.data.errores) {
        // Crear una lista HTML con los errores
        const erroresList = error.response.data.errores.map(err => `• ${err}`).join('<br>');

        Swal.fire({
          title: "Error de validación",
          html: `Por favor, corrige los siguientes errores:<br><br>${erroresList}`,
          icon: "warning",
          confirmButtonText: "Entendido"
        });
      } else {
        // Mensaje genérico para otros tipos de errores
        Swal.fire("Error",
          error.response?.data?.message || "No se pudo actualizar el prospecto.",
          "error");
      }
    }
  };

  const handleFamiliarChange = e => {
    setNuevoFamiliar({ ...nuevoFamiliar, [e.target.name]: e.target.value });
  };

  const agregarFamiliar = () => {
    // Regla de negocio: hijo/a se cubre como HIJO hasta los 25 años inclusive (25 años y 11 meses)
    if (nuevoFamiliar.vinculo === "hijo/a" && !menorDeUnAnioFamiliar && Number(nuevoFamiliar.edad) > 25) {
      Swal.fire("Atención", 'Un hijo/a puede tener hasta 25 años inclusive. Para mayores de 25 años, usá el vínculo "Familiar a cargo".', "warning");
      return;
    }
    if (
      nuevoFamiliar.vinculo &&
      nuevoFamiliar.nombre &&
      (nuevoFamiliar.edad !== '' || menorDeUnAnioFamiliar) &&
      (
        nuevoFamiliar.vinculo !== "pareja/conyuge" ||
        (
          nuevoFamiliar.tipo_afiliacion_id &&
          (
            (tiposAfiliacion.find(t => t.id === Number(nuevoFamiliar.tipo_afiliacion_id))?.requiere_sueldo !== 1 || nuevoFamiliar.sueldo_bruto) &&
            (tiposAfiliacion.find(t => t.id === Number(nuevoFamiliar.tipo_afiliacion_id))?.requiere_categoria !== 1 || nuevoFamiliar.categoria_monotributo)
          )
        )
      )
    ) {
      setFamiliares([...familiares, { ...nuevoFamiliar, edad: menorDeUnAnioFamiliar ? 0 : nuevoFamiliar.edad }]);
      setNuevoFamiliar({ vinculo: "", nombre: "", edad: "", tipo_afiliacion_id: "", sueldo_bruto: "", categoria_monotributo: "" });
      setMenorDeUnAnioFamiliar(false);
    } else {
      Swal.fire("Atención", "Completa todos los datos requeridos del familiar.", "warning");
    }
  };

  // ✅ NUEVA FUNCIÓN: Eliminar familiar por índice
  const eliminarFamiliar = (indice) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminará este familiar de la lista',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const nuevaListaFamiliares = familiares.filter((_, idx) => idx !== indice);
        setFamiliares(nuevaListaFamiliares);
        Swal.fire({
          title: 'Eliminado',
          text: 'El familiar ha sido eliminado',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const handleOpenPromocionesModal = (prospectoId) => {
    setProspectoSeleccionado(prospectoId);
    setShowPromocionesModal(true);
  };

  const handleFiltroChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const handleLogout = () => {
    localStorage.removeItem("cober_token");
    navigate("/");
  };

  const handleOpenHistorial = (prospecto) => {
    setSelectedProspecto(prospecto);
    fetchHistorial(prospecto.id);
    setModalHistorial(true);
  };

  const handleVerDocumentos = (poliza) => {
    setPolizaSeleccionada(poliza);
    setModalDocumentos(true);
    fetchDocumentosPoliza(poliza.id);
  };

  // ✅ NUEVA FUNCIÓN: Manejar carga de documentos exitosa
  const handleDocumentosActualizados = async () => {
    if (polizaSeleccionada) {
      await fetchDocumentosPoliza(polizaSeleccionada.id);
    }
  };

  const handleDescargarDocumento = async (documentoId, nombreOriginal) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/vendedor/polizas/documentos/${documentoId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nombreOriginal);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar documento:", error);
      Swal.fire("Error", "No se pudo descargar el documento", "error");
    }
  };

  // ✅ Obtener la fecha/hora de llegada real del prospecto
  const getFechaLlegada = (p) => {
    const fecha = p.fecha_hora_registro || p.fecha_registro;
    return fecha ? new Date(fecha) : null;
  };

  // Filtrado dinámico
  const prospectosFiltrados = prospectos.filter((p) => {
    const origenMatch = () => {
      if (filtros.origen === "") return true;
      if (filtros.origen === "reciclado") return p.es_reciclado === 1;
      if (filtros.origen === "nuevo") return p.es_reciclado !== 1;
      return (p.origen || "").toLowerCase().includes(filtros.origen.toLowerCase());
    };
    // ✅ Filtro por rango de fecha de llegada (calendario)
    const fechaMatch = () => {
      if (!filtros.fechaDesde && !filtros.fechaHasta) return true;
      const llegada = getFechaLlegada(p);
      if (!llegada || isNaN(llegada.getTime())) return false;
      // Comparar por fecha local en formato YYYY-MM-DD (igual que el input type="date")
      const fechaLocal = `${llegada.getFullYear()}-${String(llegada.getMonth() + 1).padStart(2, '0')}-${String(llegada.getDate()).padStart(2, '0')}`;
      if (filtros.fechaDesde && fechaLocal < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && fechaLocal > filtros.fechaHasta) return false;
      return true;
    };
    // ✅ Filtro por rango de hora de llegada
    const horaMatch = () => {
      if (!filtros.horaDesde && !filtros.horaHasta) return true;
      const llegada = getFechaLlegada(p);
      if (!llegada || isNaN(llegada.getTime())) return false;
      const horaLocal = `${String(llegada.getHours()).padStart(2, '0')}:${String(llegada.getMinutes()).padStart(2, '0')}`;
      if (filtros.horaDesde && horaLocal < filtros.horaDesde) return false;
      if (filtros.horaHasta && horaLocal > filtros.horaHasta) return false;
      return true;
    };
    return (
      (filtros.nombre === "" || p.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) &&
      (filtros.apellido === "" || p.apellido.toLowerCase().includes(filtros.apellido.toLowerCase())) &&
      (filtros.edad === "" || String(p.edad) === filtros.edad) &&
      (filtros.estado === "" || p.estado.toLowerCase().includes(filtros.estado.toLowerCase())) &&
      origenMatch() &&
      fechaMatch() &&
      horaMatch()
    );
  });

  // ✅ Ordenamiento por fecha/hora de llegada
  const prospectosOrdenadosVista = useMemo(() => {
    const ordenados = [...prospectosFiltrados].sort((a, b) => {
      const fechaA = getFechaLlegada(a)?.getTime() || 0;
      const fechaB = getFechaLlegada(b)?.getTime() || 0;
      return ordenLeads === "llegada_asc" ? fechaA - fechaB : fechaB - fechaA;
    });
    return ordenados;
  }, [prospectosFiltrados, ordenLeads]);

  // ✅ Paginación de 20 prospectos por página
  const totalPaginas = Math.max(1, Math.ceil(prospectosOrdenadosVista.length / PROSPECTOS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const prospectosPaginados = prospectosOrdenadosVista.slice(
    (paginaSegura - 1) * PROSPECTOS_POR_PAGINA,
    paginaSegura * PROSPECTOS_POR_PAGINA
  );

  // ✅ Volver a la página 1 cuando cambian los filtros o el orden
  useEffect(() => {
    setPaginaActual(1);
  }, [filtros, ordenLeads]);

  // Drawer/Sidebar content mejorado - Reemplazar el drawerContent existente
  const drawerContent = (
    <VendedorSidebar
      vista={vista}
      setVista={setVista}
      onNuevoProspecto={() => setShowFormModal(true)}
      onCloseDrawer={() => setOpenDrawer(false)}
    />
  );

  // Cargar pólizas cuando cambie la vista
  useEffect(() => {
    if (vista === "polizas") {
      fetchPolizas();
    }
  }, [vista]);

  // Formatear fecha
  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR');
  };

  // Formatear estado de póliza
  const getEstadoPoliza = (estado) => {
    const estados = {
      'borrador': { bg: 'secondary', text: 'Borrador' },
      'pendiente': { bg: 'warning', text: 'Pendiente' },
      'activa': { bg: 'success', text: 'Activa' },
      'cancelada': { bg: 'danger', text: 'Cancelada' },
      'vencida': { bg: 'dark', text: 'Vencida' }
    };
    return estados[estado] || { bg: 'secondary', text: estado };
  };

  const handleVerDetallePoliza = (poliza) => {
    Swal.fire({
      title: `Póliza N° ${poliza.numero_poliza}`,
      html: `
        <div class="text-start">
          <p><strong>Prospecto:</strong> ${poliza.cliente?.nombre || 'Sin nombre'} ${poliza.cliente?.apellido || 'Sin apellido'}</p>
          <p><strong>Plan:</strong> ${poliza.plan?.nombre || 'Sin plan'}</p>
          <p><strong>Total:</strong> ${formatCurrency(poliza.plan?.total_final || 0)}</p>
          <p><strong>Estado:</strong> ${getEstadoPoliza(poliza.estado).text}</p>
          <p><strong>Fecha de creación:</strong> ${formatFecha(poliza.created_at)}</p>
          ${poliza.cliente?.localidad ? `<p><strong>Localidad:</strong> ${poliza.cliente.localidad}</p>` : ''}
          ${poliza.cliente?.telefono ? `<p><strong>Contacto:</strong> ${poliza.cliente.telefono}</p>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Descargar PDF',
      cancelButtonText: 'Cerrar',
      width: 600
    }).then((result) => {
      if (result.isConfirmed) {
        window.open(`${API_URL}/polizas/${poliza.id}/pdf`, '_blank');
      }
    });
  };

  const handleEnviarPolizaPorWhatsApp = async (poliza) => {
    try {
      // Obtener el número del prospecto y enmascararlo
      const numeroProspecto = poliza.prospecto_telefono || poliza.cliente?.telefono || '';
      const numeroEnmascarado = numeroProspecto ? maskPhoneNumber(numeroProspecto) : '';

      const { value: formValues } = await Swal.fire({
        title: 'Enviar Póliza por WhatsApp',
        html: `
          <div class="text-start">
            <div class="mb-3">
              <label for="swal-poliza-info" class="form-label">Póliza a enviar:</label>
              <div class="alert alert-info">
                <strong>N° ${poliza.numero_poliza_oficial || poliza.numero_poliza}</strong><br>
                <small>Plan: ${poliza.plan_nombre || 'Plan no especificado'}</small><br>
                <small>Cliente: ${poliza.prospecto_nombre || 'Sin nombre'} ${poliza.prospecto_apellido || 'Sin apellido'}</small><br>
                <small>Total: ${formatCurrency(poliza.total_final || 0)}</small>
              </div>
            </div>
            <div class="mb-3">
              <label for="swal-telefono-poliza" class="form-label">Número de WhatsApp:</label>
              <input 
                id="swal-telefono-poliza" 
                class="swal2-input" 
                type="tel"
                placeholder="Haz clic para ingresar número" 
                value="${numeroEnmascarado}" 
                style="margin-top: 0.5rem;"
              />
              <small class="text-muted d-block mt-1">
                ${numeroProspecto ? 'Número del prospecto enmascarado por seguridad. Haz clic para usar otro número.' : 'Ingresa el número de WhatsApp donde enviar la póliza'}
              </small>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Enviar Póliza',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        preConfirm: () => {
          const telefonoInput = document.getElementById('swal-telefono-poliza');
          const telefono = telefonoInput.value.trim();

          if (!telefono) {
            Swal.showValidationMessage('Por favor ingresa un número de teléfono');
            return false;
          }

          if (telefono.length < 10) {
            Swal.showValidationMessage('Número de teléfono inválido (mínimo 10 dígitos)');
            return false;
          }

          return { telefono };
        },
        didOpen: () => {
          const telefonoInput = document.getElementById('swal-telefono-poliza');
          let estaEnModoEdicion = false;

          // Al hacer foco, permitir edición
          telefonoInput.addEventListener('focus', () => {
            if (!estaEnModoEdicion && numeroProspecto) {
              // Si es la primera vez que hace clic y hay número del prospecto
              telefonoInput.value = '';
              telefonoInput.placeholder = 'Ingresa número de WhatsApp o deja vacío para usar el del prospecto';
              estaEnModoEdicion = true;
            }
          });
        }
      });

      if (formValues && formValues.telefono) {
        // Determinar qué número usar
        const telefonoIngresado = formValues.telefono.trim();
        const numeroEnmascaradoComparacion = numeroProspecto ? maskPhoneNumber(numeroProspecto) : '';

        // Si el teléfono ingresado es igual al enmascarado, usar el número real del prospecto
        const numeroFinal = telefonoIngresado === numeroEnmascaradoComparacion || telefonoIngresado === ''
          ? numeroProspecto
          : telefonoIngresado;

        if (!numeroFinal) {
          Swal.fire({
            title: 'Error',
            text: 'No hay número disponible para enviar la póliza',
            icon: 'error'
          });
          return;
        }

        const token = localStorage.getItem("cober_token");
        await axios.post(
          `${API_URL}/polizas/${poliza.id}/enviar-whatsapp`,
          { telefono: numeroFinal },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        Swal.fire({
          title: '¡Enviado!',
          text: `Póliza enviada por WhatsApp exitosamente al ${maskPhoneNumber(numeroFinal)}`,
          icon: 'success',
          timer: 3000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error enviando póliza por WhatsApp:', error);
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.error || 'Error al enviar la póliza',
        icon: 'error'
      });
    }
  };

  /*
  // Implementación anterior: envío automático mediante Twilio/Meta.
  const handleEnviarPrimerContactoWhatsApp = async (prospecto) => {
    try {
      if (!prospecto.numero_contacto) {
        Swal.fire({
          title: 'Error',
          text: 'Este prospecto no tiene número de contacto registrado',
          icon: 'error'
        });
        return;
      }

      const result = await Swal.fire({
        title: '¿Iniciar conversación WhatsApp?',
        html: `
          <div class="text-start">
            <div class="mb-3">
              <strong>Prospecto:</strong> ${prospecto.nombre} ${prospecto.apellido}<br>
              <strong>Teléfono:</strong> ${maskPhoneNumber(prospecto.numero_contacto)}
            </div>
            <div class="alert alert-info">
              <strong>📱 Mensaje que se enviará:</strong><br><br>
              <em>👋 Hola ${prospecto.nombre},<br>
              Te contactamos desde Cober | Medicina Privada por la consulta que realizaste en nuestra web 🌐.<br><br>
              Si querés que un representante oficial se comunique con vos 📞 para brindarte más información ℹ️, respondé "Sí" ✅ a este mensaje.</em>
            </div>
            <small class="text-muted">
              Este mensaje utiliza un template aprobado por Meta/WhatsApp para primer contacto.
            </small>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#25D366',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '📱 Enviar WhatsApp',
        cancelButtonText: 'Cancelar',
        width: '600px'
      });

      if (result.isConfirmed) {
        const token = localStorage.getItem("cober_token");

        Swal.fire({
          title: 'Enviando mensaje...',
          text: 'Por favor espera mientras se envía el mensaje por WhatsApp',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        const response = await axios.post(
          `${API_URL}/prospectos/${prospecto.id}/primer-contacto-whatsapp`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          Swal.fire({
            title: '¡Mensaje enviado!',
            html: `
              <div class="text-start">
                <p><strong>✅ Primer contacto enviado exitosamente</strong></p>
                <p><strong>Destinatario:</strong> ${prospecto.nombre} ${prospecto.apellido}</p>
                <p><strong>Teléfono:</strong> ${maskPhoneNumber(prospecto.numero_contacto)}</p>
                <p><strong>Conversación ID:</strong> #${response.data.data.conversacion_id}</p>
                <hr>
                <small class="text-muted">
                  <strong>📝 Próximos pasos:</strong><br>
                  • El prospecto recibirá el mensaje en WhatsApp<br>
                  • Cuando responda, aparecerá en tu bandeja de chat<br>
                  • Podrás continuar la conversación desde el panel de chat
                </small>
              </div>
            `,
            icon: 'success',
            timer: 8000,
            showConfirmButton: true,
            confirmButtonText: 'Entendido'
          });

          await fetchProspectos();
        } else {
          throw new Error(response.data.message || 'Error al enviar mensaje');
        }
      }
    } catch (error) {
      console.error('Error enviando primer contacto WhatsApp:', error);

      let mensajeError = 'Error al enviar el mensaje por WhatsApp';

      if (error.response?.data?.message) {
        mensajeError = error.response.data.message;
      } else if (error.message) {
        mensajeError = error.message;
      }

      Swal.fire({
        title: 'Error al enviar WhatsApp',
        text: mensajeError,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    }
  };
  */

  const getWhatsAppPhoneNumber = (phone) => {
    let cleaned = String(phone || '').replace(/\D/g, '');

    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

    if (cleaned.startsWith('54')) {
      return cleaned.startsWith('549') ? cleaned : `549${cleaned.slice(2)}`;
    }

    return `549${cleaned}`;
  };

  // Abre la conversación en WhatsApp Web o en la aplicación instalada.
  const handleEnviarPrimerContactoWhatsApp = async (prospecto) => {
    const whatsappPhone = getWhatsAppPhoneNumber(prospecto.numero_contacto);

    if (!prospecto.numero_contacto || whatsappPhone.length < 12 || whatsappPhone.length > 15) {
      Swal.fire({
        title: 'Número inválido',
        text: 'El prospecto debe tener un celular válido, preferentemente en formato +549XXXXXXXXXX.',
        icon: 'error'
      });
      return;
    }

    const mensaje = `Hola ${prospecto.nombre}, te contactamos desde Cober | Medicina Privada por la consulta que realizaste en nuestra web. Si querés recibir más información, respondé este mensaje.`;
    const result = await Swal.fire({
      title: '¿Abrir conversación en WhatsApp?',
      html: `
        <div class="text-start">
          <div class="mb-3">
            <strong>Prospecto:</strong> ${prospecto.nombre} ${prospecto.apellido}<br>
            <strong>Teléfono:</strong> ${maskPhoneNumber(prospecto.numero_contacto)}
          </div>
          <div class="alert alert-info mb-2">
            <strong>Mensaje precargado:</strong><br><br>
            <em>${mensaje}</em>
          </div>
          <small class="text-muted">
            Se abrirá WhatsApp Web o la aplicación instalada. El mensaje no se enviará hasta que presiones Enviar en WhatsApp.
          </small>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#25D366',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Abrir WhatsApp',
      cancelButtonText: 'Cancelar',
      width: '600px'
    });

    if (result.isConfirmed) {
      window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
    }
  };

  // ☎️ NUEVA: Función para registrar llamada telefónica
  const handleRegistrarLlamada = async (prospecto) => {
    try {
      // Verificar que el prospecto tenga número de contacto
      if (!prospecto.numero_contacto) {
        Swal.fire({
          title: 'Error',
          text: 'Este prospecto no tiene número de contacto registrado',
          icon: 'error'
        });
        return;
      }

      const token = localStorage.getItem("cober_token");

      // Registrar la llamada en el backend
      const response = await axios.post(
        `${API_URL}/prospectos/${prospecto.id}/registrar-llamada`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Mostrar confirmación
        Swal.fire({
          title: '☎️ Llamada registrada',
          html: `
            <div class="text-start">
              <p><strong>✅ Llamada registrada exitosamente</strong></p>
              <p><strong>Prospecto:</strong> ${response.data.data.prospecto_nombre}</p>
              <p><strong>Hora:</strong> ${new Date(response.data.data.timestamp).toLocaleTimeString('es-AR')}</p>
              <hr>
              <small class="text-muted">
                La llamada ha sido registrada en el historial de acciones
              </small>
            </div>
          `,
          icon: 'success',
          timer: 3000,
          showConfirmButton: true,
          confirmButtonText: 'Entendido'
        });

        // Actualizar la lista de prospectos para reflejar el cambio
        await fetchProspectos();
      } else {
        throw new Error(response.data.message || 'Error al registrar la llamada');
      }

    } catch (error) {
      console.error('Error registrando llamada:', error);

      let mensajeError = 'Error al registrar la llamada';

      if (error.response?.data?.message) {
        mensajeError = error.response.data.message;
      } else if (error.message) {
        mensajeError = error.message;
      }

      Swal.fire({
        title: 'Error',
        text: mensajeError,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    }
  };

  // ✅ NUEVA: Función para editar póliza
  const handleEditarPoliza = (poliza) => {
    setPolizaEditando(poliza);
    setShowEditarPolizaModal(true);
  };

  // ✅ NUEVA: Función para actualizar póliza tras edición
  const handleActualizarPoliza = async () => {
    // Recargar pólizas
    await fetchPolizas();
  };

  // ✅ NUEVA: Función para abrir modal de subir documentos libres
  const handleSubirDocumentosLibres = (poliza) => {
    setPolizaSubirDocumentos(poliza);
    setShowSubirDocumentosModal(true);
  };

  // ✅ NUEVA: Función para consultar estado en Gecros (simplificada)
  const handleConsultarGecros = async (prospecto) => {
    // ⚠️ TEMPORAL (2026-09-21): API de Gecros caída, no se consulta.
    if (!GECROS_HABILITADO) return;
    if (!prospecto.dni || prospecto.dni.trim() === '') {
      return; // No hacer nada si no hay DNI
    }

    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/gecros/consultar/dni/${prospecto.dni}?prospectoId=${prospecto.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        // Actualizar el estado del prospecto en la lista local
        setProspectos(prevProspectos =>
          prevProspectos.map(p =>
            p.id === prospecto.id
              ? { ...p, gecros_estado: response.data.estado, gecros_consultado_at: response.data.consultado_at }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error al consultar Gecros:', error);
      // No mostrar error al usuario, solo fallar silenciosamente
    }
  };

  // ✅ NUEVA: Función para descargar credencial
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

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
      'dni_frente': 'DNI Frente',
      'dni_dorso': 'DNI Dorso',
      'constancia_ingresos': 'Constancia de Ingresos',
      'recibo_sueldo': 'Recibo de Sueldo',
      'autorizacion_debito': 'Autorización de Débito',
      'declaracion_jurada': 'Declaración Jurada',
      'poliza_firmada': 'Póliza Firmada',
      'auditoria_medica': 'Auditoría Médica',
      'documento_identidad_adicional': 'Documento de Identidad Adicional',
      'comprobante_ingresos': 'Comprobante de Ingresos',
      'otros': 'Otros'
    };
    return tipos[tipo] || tipo;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ✅ NUEVA: Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, ''); // Remover caracteres no numéricos
    if (cleaned.length < 4) return phone; // Si es muy corto, devolver tal como está

    // Mostrar solo los últimos 4 dígitos
    const masked = '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);

    // Mantener formato original si tiene caracteres especiales
    if (phone.includes('+')) {
      return `+${masked}`;
    } else if (phone.includes('-') || phone.includes(' ') || phone.includes('(')) {
      // Para formatos como (011) 1234-5678 o 011 1234-5678
      return `******${cleaned.slice(-4)}`;
    }

    return masked;
  };

  // ✅ NUEVA: Función para enmascarar correos electrónicos
  const maskEmail = (email) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (!domain) return email; // Si no tiene @, devolver tal como está

    if (localPart.length <= 2) {
      return `**@${domain}`;
    }

    // Mostrar los primeros 2 caracteres y enmascarar el resto hasta @
    const maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 2);
    return `${maskedLocal}@${domain}`;
  };

  // ☎️ Registrar la llamada y abrir el teléfono
  const handleLlamar = (prospecto) => {
    handleRegistrarLlamada(prospecto);
    if (prospecto.numero_contacto) {
      setTimeout(() => {
        window.open(`tel:${prospecto.numero_contacto}`, "_self");
      }, 500);
    }
  };

  const handleCerrarFormulario = () => {
    setShowFormModal(false);
    setFamiliares([]);
    setNuevoFamiliar({ vinculo: "", nombre: "", edad: "", tipo_afiliacion_id: "", sueldo_bruto: "", categoria_monotributo: "" });
  };

  const vistaToggle = (
    <div role="group" aria-label="Tipo de vista" className="hidden rounded-md border border-input bg-card p-0.5 md:flex">
      {[
        { key: "tarjetas", label: "Vista de tarjetas", Icon: LayoutGridIcon },
        { key: "tabla", label: "Vista de tabla", Icon: ListIcon },
      ].map(({ key, label, Icon }) => (
        <Button
          key={key}
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={tipoVista === key}
          onClick={() => setTipoVista(key)}
          className={cn(tipoVista === key && "bg-accent text-primary hover:bg-accent")}
        >
          <Icon />
        </Button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div role="status" className=" flex min-h-[60dvh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        Cargando prospectos…
      </div>
    );
  }

  // En el celular las tarjetas son la única vista (la tabla no entra)
  const vistaProspectos = tipoVista === "tabla" ? "tabla" : "tarjetas";

  return (
    <div className=" min-h-[calc(100dvh-80px)] bg-background">
      {/* Menú lateral fijo en escritorio */}
      <aside className="fixed top-20 bottom-0 left-0 z-[1020] hidden w-60 border-r border-sidebar-border md:block">
        {drawerContent}
      </aside>

      {/* Menú lateral en el celular */}
      <Sheet open={openDrawer} onOpenChange={setOpenDrawer}>
        <SheetContent side="left" showCloseButton={false} className="w-72 max-w-[85vw] gap-0 p-0">
          <SheetTitle className="sr-only">Menú del vendedor</SheetTitle>
          <SheetDescription className="sr-only">Navegación entre prospectos, pólizas y WhatsApp</SheetDescription>
          {drawerContent}
        </SheetContent>
      </Sheet>

      <main className="md:ml-60">
        {vista === "prospectos" && (
          <>
            <PageHeader
              title="Prospectos"
              onOpenMenu={() => setOpenDrawer(true)}
              actions={
                <>
                  {vistaToggle}
                  <Button size="lg" onClick={() => setShowFormModal(true)} aria-label="Nuevo prospecto">
                    <PlusIcon />
                    <span className="hidden sm:inline">Nuevo prospecto</span>
                  </Button>
                </>
              }
            />

            <div className="flex flex-col gap-4 p-4 pb-28 md:p-6 md:pb-24">
              <ProspectosFiltros
                filtros={filtros}
                onFiltroChange={handleFiltroChange}
                ordenLeads={ordenLeads}
                onOrdenChange={setOrdenLeads}
                onLimpiar={() => {
                  setFiltros(FILTROS_VACIOS);
                  setOrdenLeads("llegada_asc");
                }}
              />

              {prospectosOrdenadosVista.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
                  <SearchXIcon className="size-8 text-muted-foreground" />
                  {prospectos.length === 0 ? (
                    <>
                      <p className="font-semibold text-corporate">Todavía no tenés prospectos asignados</p>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Cuando te asignen uno aparece acá. También podés cargarlo vos.
                      </p>
                      <Button onClick={() => setShowFormModal(true)}>
                        <PlusIcon />
                        Nuevo prospecto
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-corporate">Ningún prospecto coincide con los filtros</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFiltros(FILTROS_VACIOS);
                          setOrdenLeads("llegada_asc");
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className={cn(vistaProspectos === "tabla" && "md:hidden")}>
                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {prospectosPaginados.map((prospecto) => (
                        <li key={prospecto.id}>
                          <ProspectoCard
                            prospecto={prospecto}
                            values={editValues[prospecto.id] || {}}
                            tiposAfiliacion={tiposAfiliacion}
                            alertaGuardado={alertaGuardado}
                            gecrosHabilitado={GECROS_HABILITADO}
                            maskPhoneNumber={maskPhoneNumber}
                            maskEmail={maskEmail}
                            onCardChange={handleCardChange}
                            onGuardar={guardarCambioProspecto}
                            onConsultarGecros={handleConsultarGecros}
                            onHistorial={handleOpenHistorial}
                            onWhatsApp={handleEnviarPrimerContactoWhatsApp}
                            onLlamar={handleLlamar}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  {vistaProspectos === "tabla" && (
                    <div className="hidden md:block">
                      <ProspectosTabla
                        prospectos={prospectosPaginados}
                        editValues={editValues}
                        tiposAfiliacion={tiposAfiliacion}
                        alertaGuardado={alertaGuardado}
                        gecrosHabilitado={GECROS_HABILITADO}
                        maskPhoneNumber={maskPhoneNumber}
                        onCardChange={handleCardChange}
                        onGuardar={guardarCambioProspecto}
                        onHistorial={handleOpenHistorial}
                        onWhatsApp={handleEnviarPrimerContactoWhatsApp}
                        onLlamar={handleLlamar}
                      />
                    </div>
                  )}

                  <ProspectosPaginacion
                    pagina={paginaSegura}
                    totalPaginas={totalPaginas}
                    total={prospectosOrdenadosVista.length}
                    porPagina={PROSPECTOS_POR_PAGINA}
                    onChange={setPaginaActual}
                  />
                </>
              )}
            </div>
          </>
        )}

        {vista === "polizas" && (
          <>
            <PageHeader
              title="Mis pólizas"
              onOpenMenu={() => setOpenDrawer(true)}
              actions={vistaToggle}
            />
            <PolizasDashboard
              polizas={polizas}
              loadingPolizas={loadingPolizas}
              formatCurrency={formatCurrency}
              formatFecha={formatFecha}
              getEstadoPoliza={getEstadoPoliza}
              handleVerDocumentos={handleVerDocumentos}
              handleEnviarPolizaPorWhatsApp={handleEnviarPolizaPorWhatsApp}
              handleVerDetallePoliza={handleVerDetallePoliza}
              handleEditarPoliza={handleEditarPoliza}
              handleSubirDocumentosLibres={handleSubirDocumentosLibres}
              tipoVista={tipoVista}
              setTipoVista={setTipoVista}
              drawerWidth={0}
            />
          </>
        )}

        {vista === "whatsapp" && <WhatsAppVista onOpenSidebar={() => setOpenDrawer(true)} />}
      </main>

      <NuevoProspectoDialog
        open={showFormModal}
        onClose={handleCerrarFormulario}
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        menorDeUnAnioTitular={menorDeUnAnioTitular}
        onMenorTitularChange={(checked) => {
          setMenorDeUnAnioTitular(checked);
          setFormData((prev) => ({ ...prev, edad: checked ? 0 : "" }));
        }}
        tiposAfiliacion={tiposAfiliacion}
        localidades={localidades}
        gecrosHabilitado={GECROS_HABILITADO}
        vinculos={vinculos}
        categoriasMonotributo={categoriasMonotributo}
        nuevoFamiliar={nuevoFamiliar}
        onFamiliarChange={handleFamiliarChange}
        menorDeUnAnioFamiliar={menorDeUnAnioFamiliar}
        onMenorFamiliarChange={(checked) => {
          setMenorDeUnAnioFamiliar(checked);
          setNuevoFamiliar((prev) => ({ ...prev, edad: checked ? 0 : "" }));
        }}
        familiares={familiares}
        onAgregarFamiliar={agregarFamiliar}
        onEliminarFamiliar={eliminarFamiliar}
      />

      <HistorialDialog open={modalHistorial} onOpenChange={setModalHistorial} historial={historial} />

      <PromocionesModal
        prospectoId={prospectoSeleccionado}
        show={showPromocionesModal}
        onClose={() => setShowPromocionesModal(false)}
      />

      {/* Se oculta mientras está abierto un modal heredado (Bootstrap) que se abre desde acá */}
      <DocumentosPolizaDialog
        open={modalDocumentos && !modalCargaDocumentos && !showPreview}
        onOpenChange={setModalDocumentos}
        poliza={polizaSeleccionada}
        documentos={documentos}
        loading={loadingDocumentos}
        formatTipoDocumento={formatTipoDocumento}
        formatFileSize={formatFileSize}
        onDescargar={handleDescargarDocumento}
        onActualizar={handleActualizarDocumento}
        onVer={handlePreviewDocumento}
        onCargar={() => setModalCargaDocumentos(true)}
      />

      <ActualizarDocumentoDialog
        open={modalActualizarDoc}
        onCancel={handleCancelarActualizacion}
        documento={documentoActualizar}
        formatTipoDocumento={formatTipoDocumento}
        nuevoArchivo={nuevoArchivo}
        onFileChange={handleFileChange}
        motivo={motivoActualizacion}
        onMotivoChange={setMotivoActualizacion}
        loading={loadingActualizar}
        onSubmit={handleSubmitActualizacion}
      />

      <CargaDocumentosModal
        polizaId={polizaSeleccionada?.id}
        userRole="vendedor"
        onDocumentosActualizados={handleDocumentosActualizados}
        show={modalCargaDocumentos}
        onHide={() => setModalCargaDocumentos(false)}
      />

      <EditarPolizaModal
        show={showEditarPolizaModal}
        onHide={() => {
          setShowEditarPolizaModal(false);
          setPolizaEditando(null);
        }}
        poliza={polizaEditando}
        onActualizar={handleActualizarPoliza}
      />

      <SubirDocumentosLibresModal
        show={showSubirDocumentosModal}
        onHide={() => {
          setShowSubirDocumentosModal(false);
          setPolizaSubirDocumentos(null);
        }}
        poliza={polizaSubirDocumentos}
        apiContext="vendedor"
        onDocumentosActualizados={fetchPolizas}
      />

      <DocumentPreviewModal
        show={showPreview}
        onHide={() => {
          setShowPreview(false);
          if (previewUrl) window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }}
        previewUrl={previewUrl}
        previewMime={previewMime}
        documentName="Documento de Póliza"
        onDownload={() => {
          if (previewUrl) {
            const link = document.createElement("a");
            link.href = previewUrl;
            link.download = `documento_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />

      {vista !== "whatsapp" && <ManualWidget userRole="vendedor" />}
    </div>
  );
};

export default ProspectosDashboard;
