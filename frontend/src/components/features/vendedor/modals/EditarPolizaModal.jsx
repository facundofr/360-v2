import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Spinner, ProgressBar, Card, Row, Col } from '@/components/compat/bootstrap';
import { FaSpinner, FaArrowLeft, FaArrowRight, FaSave, FaEdit, FaTrash } from '@/lib/icons';
import axios from 'axios';
import Swal from '@/lib/alerts';
import { API_URL } from '../../../config';
import DocumentPreviewModal from '../../../common/DocumentPreviewModal';

// ✅ Importar los mismos pasos que usa PolizaForm
import PasoDatosPersonales from '../poliza-form/PasoDatosPersonales';
import PasoDeclaracionJurada from '../poliza-form/PasoDeclaracionJurada';
import PasoIntegrantesDocumentos from '../poliza-form/PasoIntegrantesDocumentos';
import PasoReferencias from '../poliza-form/pasoReferencias';
import PasoSaludTerminos from '../poliza-form/PasoSaludTerminos';

// ✅ Configuración de pasos y opciones (igual que PolizaForm)
// Tipos de documento con ranura fija en el paso "Integrantes y Documentos"
const TIPOS_DOC_SLOT = ['dni_frente', 'dni_dorso', 'recibo_sueldo'];
// Límite de multer en /poliza-documentos/upload (backend/config/multer.js)
const MAX_TAMANIO_DOC = 5 * 1024 * 1024;

const etapas = [
  "Datos Personales",
  "Integrantes y Documentos", 
  "Referencias",
  "Salud y Términos"
];

const preguntasDeclaracionJurada = [
  "¿Algún integrante del grupo toma Medicación?",
  "¿Algún integrante encuentra actualmente bajo Tratamiento médico?",
  "¿Algún integrante del grupo tiene diagnosticada alguna Enfermedad en los últimos 12 meses?",
  "¿Algún integrante del grupo tiene indicado realizarse estudios, análisis y/o prácticas médicas?",
  "¿Algún integrante del grupo ha sido internado/a?",
  "¿Algún integrante del grupo posee alguna de las siguientes enfermedades, patologías y/o diagnósticos?"
];

const enfermedadesPatologias = [
  "Antecedentes Neurológicos / Psiquiátricos",
  "Alteraciones Visuales",
  "Alteraciones de nariz, garganta u oído",
  "Diabetes / Obesidad",
  "Adicciones a drogas o alcohol",
  "Alteraciones de la sangre",
  "Alteraciones Pulmonares",
  "Nódulos, Quistes o Tumores",
  "Alteraciones renales/vejiga/próstata",
  "Alteraciones ginecológicas y/u obstétricas",
  "Embarazo",
  "Afecciones musculares y/o de huesos",
  "Enfermedades congénitas o hereditarias"
];

const opcionesCondicionIVA = [
  "Responsable Inscripto",
  "Responsable No Inscripto", 
  "IVA Exento",
  "Consumidor Final",
  "Responsable Monotributo"
];

const opcionesTipoDomicilio = ["Particular", "Comercial", "Legal"];
const opcionesFormasPago = [
  "Débito automático de tarjeta de crédito | Mercado Pago",
  "Débito automático de tarjeta de crédito",
  "Débito automático de cuenta (CBU)",
  "Transferencia",
  "Efectivo"
];
const opcionesEstadoCivil = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Concubinato", "Separado/a"];
const opcionesNacionalidad = [
  "Argentina", "Boliviana", "Brasileña", "Chilena", "Colombiana", 
  "Ecuatoriana", "Paraguaya", "Peruana", "Uruguaya", "Venezolana", "Otra"
];

// ✅ Función helper para formatear nombres de preguntas médicas (igual que supervisor)
const formatearPregunta = (key) => {
  const mapeo = {
    internacion: "¿Ha sido internado/a en los últimos 12 meses?",
    internacion_colegiales: "¿Ha sido internado/a en Colegiales?",
    cirugia: "¿Ha sido sometido/a a alguna cirugía?",
    secuelas: "¿Padece secuelas de accidentes o enfermedades?",
    accidentes: "¿Ha tenido accidentes graves?",
    transfusiones: "¿Ha recibido transfusiones de sangre?",
    estudios_anuales: "¿Se realiza estudios médicos anuales?",
    indicacion_medica: "¿Tiene indicación médica pendiente?",
    psicologico: "¿Ha recibido tratamiento psicológico?",
    psiquiatrico: "¿Ha recibido tratamiento psiquiátrico?",
    internacion_mental: "¿Ha sido internado/a en institución mental?",
    diabetes: "¿Padece diabetes?",
    auditivas: "¿Tiene problemas auditivos?",
    vista: "¿Tiene problemas de vista?",
    lentes: "¿Usa lentes o anteojos?",
    glaucoma: "¿Padece glaucoma?",
    alergias: "¿Tiene alergias?",
    infarto: "¿Ha sufrido infarto?",
    test_embarazo: "¿Se ha realizado test de embarazo?",
    sintomas_embarazo: "¿Presenta síntomas de embarazo?",
    embarazo_actual: "¿Se encuentra embarazada actualmente?",
    aborto: "¿Ha tenido abortos?",
    partos: "¿Ha tenido partos?",
    columna: "¿Tiene problemas de columna?",
    protesis: "¿Usa prótesis?",
    deporte: "¿Practica deportes?",
    deporte_riesgo: "¿Practica deportes de riesgo?",
    indicacion_protesis: "¿Tiene indicación de prótesis?",
    neurologicas: "¿Padece enfermedades neurológicas?",
    epilepsia: "¿Padece epilepsia?",
    respiratorias: "¿Padece enfermedades respiratorias?",
    tuberculosis: "¿Ha padecido tuberculosis?",
    fiebre_reumatica: "¿Ha padecido fiebre reumática?",
    hepatitis: "¿Ha padecido hepatitis?",
    colicos: "¿Padece cólicos frecuentes?",
    infecciones_urinarias: "¿Padece infecciones urinarias frecuentes?",
    anemia: "¿Padece anemia?",
    transmision_sexual: "¿Ha padecido enfermedades de transmisión sexual?",
    infecciosas: "¿Ha padecido enfermedades infecciosas?",
    tumores: "¿Ha padecido tumores?",
    tiroides: "¿Tiene problemas de tiroides?",
    gastritis: "¿Padece gastritis?",
    tabaquismo: "¿Fuma o ha fumado?",
    alcoholismo: "¿Consume alcohol en exceso?",
    drogas: "¿Ha consumido drogas?",
    perdida_peso: "¿Ha tenido pérdida de peso significativa?",
    diagnostico_reciente: "¿Tiene algún diagnóstico médico reciente?",
    discapacidad: "¿Tiene alguna discapacidad?"
  };
  
  return mapeo[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const EditarPolizaModal = ({ 
  show, 
  onHide, 
  poliza, 
  onActualizar,
  apiContext = 'vendedor' // 'vendedor' | 'supervisor' | 'backoffice'
}) => {
  // Calcular la URL base según el contexto del rol
  const getApiBase = () => {
    if (apiContext === 'supervisor') return `${API_URL}/supervisor/polizas`;
    if (apiContext === 'backoffice') return `${API_URL}/backoffice/polizas`;
    return `${API_URL}/vendedor/polizas`;
  };
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    datos_personales: {},
    declaracion_jurada: {},
    integrantes: [],
    documentos_titular: {},
    referencias: [],
    saludTerminos: {}
  });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [dataLoadKey, setDataLoadKey] = useState(0);
  const [cotizacionInfo, setCotizacionInfo] = useState(null);

  // ✅ Estados para gestión de documentos existentes
  const [documentos, setDocumentos] = useState([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [modalActualizarDoc, setModalActualizarDoc] = useState(false);
  const [documentoActualizar, setDocumentoActualizar] = useState(null);
  const [nuevoArchivo, setNuevoArchivo] = useState(null);
  const [motivoActualizacion, setMotivoActualizacion] = useState('');
  const [loadingActualizar, setLoadingActualizar] = useState(false);

  // ✅ Estados para previsualización de documentos
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState(null);
  const [previewName, setPreviewName] = useState('Documento');
  const [showPreview, setShowPreview] = useState(false);

  // Cargar datos de la póliza cuando se abre el modal
  useEffect(() => {
    if (show && poliza?.id) {
      cargarDatosParaEditar();
      fetchDocumentosPoliza(poliza.id);
    }
  }, [show, poliza?.id]);

  // ✅ Cargar documentos existentes de la póliza
  const fetchDocumentosPoliza = async (polizaId) => {
    try {
      setLoadingDocumentos(true);
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(
        `${getApiBase()}/${polizaId}/documentos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data;
      // El endpoint devuelve { success, documentos: { tipo: [docs...] } }
      // Hay que aplanar el objeto agrupado en un array
      const docsAgrupados = data.documentos || {};
      const docsArray = [];
      Object.entries(docsAgrupados).forEach(([tipo, docs]) => {
        docs.forEach(doc => docsArray.push({ ...doc, tipo_documento: tipo }));
      });
      setDocumentos(docsArray);
    } catch (err) {
      console.warn('No se pudieron cargar los documentos:', err);
      setDocumentos([]);
    } finally {
      setLoadingDocumentos(false);
    }
  };

  // ✅ Abrir modal para actualizar un documento
  const handleActualizarDocumento = (documento) => {
    setDocumentoActualizar(documento);
    setNuevoArchivo(null);
    setMotivoActualizacion('');
    setModalActualizarDoc(true);
  };

  // ✅ Seleccionar archivo nuevo (con validación de tamaño)
  const handleNuevoArchivoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      Swal.fire('Error', 'El archivo es demasiado grande. Máximo 10MB.', 'error');
      e.target.value = '';
      return;
    }
    setNuevoArchivo(file);
  };

  // ✅ Enviar actualización de documento vía multipart/form-data (endpoint vendedor con ownership check)
  const handleSubmitActualizacionDoc = async (e) => {
    e.preventDefault();
    if (!nuevoArchivo) {
      Swal.fire('Error', 'Seleccioná un archivo', 'error');
      return;
    }
    if (!motivoActualizacion.trim()) {
      Swal.fire('Error', 'Ingresá el motivo de la actualización', 'error');
      return;
    }
    try {
      setLoadingActualizar(true);
      const fd = new FormData();
      fd.append('documento', nuevoArchivo);
      fd.append('motivo_actualizacion', motivoActualizacion.trim());
      const token = localStorage.getItem('cober_token');
      const response = await axios.put(
        `${getApiBase()}/documentos/${documentoActualizar.id}/actualizar`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      if (response.data.success) {
        setModalActualizarDoc(false);
        setDocumentoActualizar(null);
        setNuevoArchivo(null);
        setMotivoActualizacion('');
        await fetchDocumentosPoliza(poliza.id);
        Swal.fire('¡Actualizado!', 'El documento fue actualizado correctamente.', 'success');
      } else {
        throw new Error(response.data.message || 'Error al actualizar');
      }
    } catch (err) {
      console.error('Error actualizando documento:', err);
      Swal.fire('Error', err.response?.data?.message || err.message || 'No se pudo actualizar el documento', 'error');
    } finally {
      setLoadingActualizar(false);
    }
  };

  // ✅ Previsualizar documento usando DocumentPreviewModal (igual que ProspectosDashboard)
  const handlePreviewDocumento = async (doc) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(
        `${getApiBase()}/documentos/${doc.id}/preview`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const mimeType = doc.tipo_mime || response.data.type;
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      setPreviewUrl(url);
      setPreviewMime(mimeType);
      setPreviewName(doc.nombre_original || 'Documento');
      setShowPreview(true);
    } catch (err) {
      console.error('Error al previsualizar:', err);
      Swal.fire('Error', 'No se pudo previsualizar el documento', 'error');
    }
  };

  // ✅ Eliminar documento (con confirmación)
  const handleEliminarDocumento = async (doc) => {
    const result = await Swal.fire({
      title: '¿Eliminar documento?',
      html: `<strong>${formatTipoDoc(doc.tipo_documento)}</strong><br/><small>${doc.nombre_original}</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.delete(
        `${getApiBase()}/documentos/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        await Swal.fire('¡Eliminado!', 'El documento fue eliminado.', 'success');
        await fetchDocumentosPoliza(poliza.id);
      } else {
        throw new Error(response.data.message || 'Error al eliminar');
      }
    } catch (err) {
      console.error('Error eliminando documento:', err);
      Swal.fire('Error', err.response?.data?.message || err.message || 'No se pudo eliminar el documento', 'error');
    }
  };

  // ✅ Formatear tipo de documento para mostrar al usuario
  const formatTipoDoc = (tipo) => {
    const mapa = {
      dni_frente: '🪪 DNI Frente',
      dni_dorso: '🪪 DNI Dorso',
      recibo_sueldo: '💰 Recibo de Sueldo',
      poliza_firmada: '📄 Póliza Firmada',
      auditoria_medica: '🏥 Auditoría Médica',
      codem: '📋 CODEM',
      formulario_f152: '📝 Formulario F152',
      formulario_f184: '📋 Formulario F184',
      constancia_inscripcion: '✅ Constancia de Inscripción',
      comprobante_pago_cuota: '💳 Comprobante de Pago',
      estudios_medicos: '🏥 Estudios Médicos',
      documento_adicional: '📎 Documento Adicional',
    };
    return mapa[tipo] || tipo;
  };

  const cargarDatosParaEditar = async () => {
    try {
      setLoading(true);
      setError(null);
      setStep(0); // Reiniciar al paso 1
      
      const response = await axios.get(
        `${getApiBase()}/${poliza.id}/editar`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('cober_token')}`
          }
        }
      );

      if (response.data.success && response.data.data) {
        const polizaData = response.data.data;
        
        // ✅ Parsear todos los datos JSON de la póliza
        const datosPersonales = typeof polizaData.datos_personales === 'string' 
          ? JSON.parse(polizaData.datos_personales) 
          : polizaData.datos_personales || {};

        // ✅ Normalizar clave de email: preferimos 'email' y mantenemos 'correo' por compatibilidad
        if (!datosPersonales.email && datosPersonales.correo) {
          datosPersonales.email = datosPersonales.correo;
        }
        if (!datosPersonales.correo && datosPersonales.email) {
          datosPersonales.correo = datosPersonales.email;
        }
        // ✅ Completar desde prospecto si falta totalmente
        if (!datosPersonales.email && polizaData.prospecto_email) {
          datosPersonales.email = polizaData.prospecto_email;
          datosPersonales.correo = polizaData.prospecto_email;
        }

        const declaracionJurada = typeof polizaData.declaracion_salud === 'string'
          ? JSON.parse(polizaData.declaracion_salud)
          : polizaData.declaracion_salud || { preguntas: [], enfermedades_seleccionadas: [], datos_fisicos: {} };

        // ✅ Asegurar que datos_fisicos siempre exista con la estructura correcta
        if (!declaracionJurada.datos_fisicos) {
          declaracionJurada.datos_fisicos = { titular_peso: '', titular_altura: '', integrantes: [] };
        } else {
          if (!declaracionJurada.datos_fisicos.integrantes) {
            declaracionJurada.datos_fisicos.integrantes = [];
          }
          if (declaracionJurada.datos_fisicos.titular_peso === undefined) {
            declaracionJurada.datos_fisicos.titular_peso = '';
          }
          if (declaracionJurada.datos_fisicos.titular_altura === undefined) {
            declaracionJurada.datos_fisicos.titular_altura = '';
          }
        }

        console.log('📋 Declaración salud cargada desde BD:', declaracionJurada);

        // 🔁 Igual que con documentos_titular más abajo: el JSON guardado en BD trae
        // placeholders vacíos ({}) para dni_frente/dni_dorso desde la carga original,
        // nunca objetos File reales. Si no se limpian, FileUploadComponent los toma
        // como "archivo ya seleccionado" (currentFile.size = NaN) y pisa el estado real
        // que sí viene de documentosExistentes/getDocExistente (tabla poliza_documentos).
        // Ver auditoría 2026-08-20, póliza COB-202608-0160.
        const integrantesRaw = typeof polizaData.integrantes === 'string'
          ? JSON.parse(polizaData.integrantes)
          : polizaData.integrantes || [];
        const integrantes = integrantesRaw.map(integrante => ({ ...integrante, documentos: {} }));

        const documentosTitular = typeof polizaData.documentos_titular === 'string'
          ? JSON.parse(polizaData.documentos_titular)
          : polizaData.documentos_titular || {};

        const referencias = typeof polizaData.referencias === 'string'
          ? JSON.parse(polizaData.referencias)
          : polizaData.referencias || [{ nombre: "", relacion: "", telefono: "" }];

        // ✅ Salud y Términos (paso 5): preferir datos_comerciales; si está vacío, reconstruir desde declaracion_salud
        let saludTerminos = typeof polizaData.datos_comerciales === 'string'
          ? JSON.parse(polizaData.datos_comerciales)
          : polizaData.datos_comerciales || {};

        const tieneRespuestasGuardadas = saludTerminos && typeof saludTerminos === 'object' && Object.keys(saludTerminos).length > 0 && saludTerminos.respuestas && Object.keys(saludTerminos.respuestas).length > 0;

        if (!tieneRespuestasGuardadas && declaracionJurada) {
          // Reconstruir estructura esperada por PasoSaludTerminos desde declaracion_salud
          const reconstruido = {
            respuestas: declaracionJurada.respuestas || {},
            medicacion: declaracionJurada.medicacion !== undefined ? declaracionJurada.medicacion : {},
            coberturaAnterior: declaracionJurada.coberturaAnterior || declaracionJurada.cobertura_anterior || {},
            datosAdicionales: declaracionJurada.datos_adicionales || {}
          };

          // Solo asignar si hay algo real para mostrar
          const hayAlgo = (Object.keys(reconstruido.respuestas || {}).length > 0) ||
                          (Object.keys(reconstruido.medicacion || {}).length > 0) ||
                          (Object.keys(reconstruido.coberturaAnterior || {}).length > 0) ||
                          (Object.keys(reconstruido.datosAdicionales || {}).length > 0);
          if (hayAlgo) {
            saludTerminos = reconstruido;
          }
        }

        // ✅ Cargar en el estado del formulario
        // Nota: documentos_titular se limpia intencionalmente porque los valores guardados
        // en BD son strings/rutas, no objetos File. El componente FileUploadComponent
        // espera objetos File reales (.name, .size). Los documentos existentes se gestionan
        // desde la sección "Documentos de la Póliza" con el botón Actualizar.
        setFormData({
          datos_personales: datosPersonales,
          declaracion_jurada: declaracionJurada,
          integrantes: integrantes,
          documentos_titular: {},
          referencias: referencias.length > 0 ? referencias : [{ nombre: "", relacion: "", telefono: "" }],
          saludTerminos: saludTerminos
        });
        // ✅ Construir el mismo objeto cotizacion que usa PolizaForm.
        // El endpoint vendedor devuelve estructura plana (polizaData.total_final),
        // mientras que supervisor/backoffice devuelven estructura anidada
        // (polizaData.cotizacion.total_final, polizaData.plan.nombre, etc.).
        // Usamos fallback para soportar ambas estructuras.
        const cot = polizaData.cotizacion || {};
        const prosp = polizaData.prospecto || {};
        setCotizacionInfo({
          id: polizaData.cotizacion_id,
          tipo_afiliacion_id: polizaData.tipo_afiliacion_id || prosp.tipo_afiliacion_id,
          tipo_afiliacion_nombre: polizaData.tipo_afiliacion_nombre || prosp.tipo_afiliacion_nombre,
          tipo_afiliacion: polizaData.tipo_afiliacion_nombre || prosp.tipo_afiliacion_nombre,
          plan_nombre: polizaData.plan_nombre || polizaData.plan?.nombre,
          total_final: polizaData.total_final ?? cot.total_final,
          total_bruto: polizaData.total_bruto ?? cot.total_bruto,
          total_descuento_aporte: polizaData.total_descuento_aporte ?? cot.total_descuento_aporte,
          total_descuento_promocion: polizaData.total_descuento_promocion ?? cot.total_descuento_promocion,
          // detalles de cotizaciones_detalles: disponible plano (vendedor) o anidado (supervisor/backoffice)
          detalles: polizaData.cotizacion_detalles || cot.detalles || []
        });
        // Incrementar key para forzar remount de PasoSaludTerminos con datos frescos
        setDataLoadKey(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError(err.response?.data?.message || 'Error al cargar los datos de la póliza');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handlers para cada tipo de cambio (igual que PolizaForm)
  const handlePersonalChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      datos_personales: {
        ...prev.datos_personales,
        [field]: value
      }
    }));
  };

  const handleDeclaracionChange = (field, value, index = null, subField = null) => {
    console.log('🔄 Declaración cambiada:', { field, value, index, subField });
    
    setFormData(prev => {
      let newDeclaracionJurada = { ...prev.declaracion_jurada };
      
      // ✅ CORRECCIÓN: Solo actualizar el campo específico que se está editando
      // NO intentar mapear preguntas → respuestas["0"] porque son estructuras diferentes
      
      if (field === 'preguntas' && index !== null && subField) {
        // Actualizar array de preguntas
        newDeclaracionJurada.preguntas = (prev.declaracion_jurada.preguntas || []).map((item, i) => 
          i === index ? { ...item, [subField]: value } : item
        );
        
        console.log(`✅ Actualizado preguntas[${index}].${subField}:`, value);
      } 
      // Para datos_fisicos con integrantes (estructura especial)
      else if (field === 'datos_fisicos' && index !== null && subField === 'integrante') {
        const prevDatosFisicos = newDeclaracionJurada.datos_fisicos || { titular_peso: '', titular_altura: '', integrantes: [] };
        const prevIntegrantes = [...(prevDatosFisicos.integrantes || [])];
        prevIntegrantes[index] = { ...(prevIntegrantes[index] || { peso: '', altura: '' }), [value.field]: value.value };
        newDeclaracionJurada.datos_fisicos = { ...prevDatosFisicos, integrantes: prevIntegrantes };
      }
      // Para datos_fisicos del titular
      else if (field === 'datos_fisicos' && subField) {
        newDeclaracionJurada.datos_fisicos = {
          ...(newDeclaracionJurada.datos_fisicos || { titular_peso: '', titular_altura: '', integrantes: [] }),
          [subField]: value
        };
      }
      // Para arrays con índice
      else if (index !== null && subField) {
        newDeclaracionJurada[field] = (prev.declaracion_jurada[field] || []).map((item, i) => 
          i === index ? { ...item, [subField]: value } : item
        );
      } 
      // Para campos simples
      else {
        newDeclaracionJurada[field] = value;
      }
      
      console.log('📋 Nueva declaración jurada completa:', newDeclaracionJurada);
      
      return {
        ...prev,
        declaracion_jurada: newDeclaracionJurada
      };
    });
  };

  const handleIntegranteChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      integrantes: prev.integrantes.map((integrante, i) =>
        i === index ? { ...integrante, [field]: value } : integrante
      )
    }));
  };

  const handleFileUpload = (tipo, integranteIndex, file) => {
    if (integranteIndex === null) {
      setFormData(prev => ({
        ...prev,
        documentos_titular: {
          ...prev.documentos_titular,
          [tipo]: file
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        integrantes: prev.integrantes.map((integrante, i) =>
          i === integranteIndex
            ? {
                ...integrante,
                documentos: {
                  ...integrante.documentos,
                  [tipo]: file
                }
              }
            : integrante
        )
      }));
    }
  };

  const handleRemoveFile = (tipo, integranteIndex = null) => {
    if (integranteIndex === null) {
      setFormData(prev => ({
        ...prev,
        documentos_titular: {
          ...prev.documentos_titular,
          [tipo]: null
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        integrantes: prev.integrantes.map((integrante, i) =>
          i === integranteIndex
            ? {
                ...integrante,
                documentos: {
                  ...integrante.documentos,
                  [tipo]: null
                }
              }
            : integrante
        )
      }));
    }
  };

  const handleReferenciaChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      referencias: prev.referencias.map((ref, i) =>
        i === index ? { ...ref, [field]: value } : ref
      )
    }));
  };

  const agregarReferencia = () => {
    if (formData.referencias.length < 3) {
      setFormData(prev => ({
        ...prev,
        referencias: [...prev.referencias, { nombre: "", relacion: "", telefono: "" }]
      }));
    }
  };

  const eliminarReferencia = (index) => {
    if (formData.referencias.length > 1) {
      setFormData(prev => ({
        ...prev,
        referencias: prev.referencias.filter((_, i) => i !== index)
      }));
    }
  };

  // ✅ Navegación entre pasos
  const handleNext = () => {
    if (step < etapas.length - 1) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  // ✅ Documentos nuevos seleccionados en el paso "Integrantes y Documentos"
  // Los objetos File NO se pueden enviar dentro del PUT JSON de actualización
  // (JSON.stringify(File) === "{}"), por eso se suben aparte por multipart al
  // mismo endpoint que usa el alta (PasoResumen): /poliza-documentos/upload.
  const sinArchivos = (obj) => Object.fromEntries(
    Object.entries(obj || {}).filter(([, valor]) => valor && !(valor instanceof File))
  );

  const recolectarDocumentosPendientes = () => {
    const pendientes = [];

    TIPOS_DOC_SLOT.forEach(tipo => {
      const file = formData.documentos_titular?.[tipo];
      if (file instanceof File) pendientes.push({ tipo, integranteIndex: null, file });
    });

    (formData.integrantes || []).forEach((integrante, index) => {
      TIPOS_DOC_SLOT.forEach(tipo => {
        const file = integrante?.documentos?.[tipo];
        if (file instanceof File) pendientes.push({ tipo, integranteIndex: index, file });
      });
    });

    return pendientes;
  };

  const etiquetaPendiente = ({ tipo, integranteIndex }) =>
    `${formatTipoDoc(tipo)} ${integranteIndex === null ? '(titular)' : `(integrante ${integranteIndex + 1})`}`;

  const subirDocumentosPendientes = async (pendientes) => {
    const errores = [];
    let subidos = 0;

    if (!pendientes.length) return { subidos, errores };

    const token = localStorage.getItem('cober_token');

    for (const pendiente of pendientes) {
      const { tipo, integranteIndex, file } = pendiente;

      if (file.size > MAX_TAMANIO_DOC) {
        errores.push(`${etiquetaPendiente(pendiente)}: supera el máximo de 5MB`);
        continue;
      }

      try {
        const fd = new FormData();
        fd.append('documento', file);
        fd.append('poliza_id', poliza.id);
        fd.append('tipo_documento', tipo);
        if (integranteIndex !== null) fd.append('integrante_index', integranteIndex);

        await axios.post(
          `${API_URL}/poliza-documentos/upload`,
          fd,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            },
            timeout: 60000
          }
        );
        subidos++;
      } catch (err) {
        console.error('Error subiendo documento nuevo:', err);
        const detalle = err.response?.data?.message || err.response?.data?.error || err.message;
        errores.push(`${etiquetaPendiente(pendiente)}: ${detalle}`);
      }
    }

    return { subidos, errores };
  };

  // Limpia del estado los archivos ya subidos (pasan a gestionarse como documentos existentes)
  const limpiarDocumentosPendientes = () => {
    setFormData(prev => ({
      ...prev,
      documentos_titular: {},
      integrantes: (prev.integrantes || []).map(integrante => ({ ...integrante, documentos: {} }))
    }));
  };

  // ✅ Guardar cambios (actualiza todos los pasos)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      console.log('📦 Estado completo del formulario:', formData);
      console.log('📋 Declaración jurada a enviar:', formData.declaracion_jurada);
      console.log('🔍 RESPUESTAS["0"] específicas:', formData.declaracion_jurada?.respuestas?.['0']);
      console.log('🔍 PREGUNTAS array:', formData.declaracion_jurada?.preguntas);

      // ✅ Preparar datos completos para enviar
      // El formato del payload difiere según el contexto de rol:
      // - vendedor: datos_personales aplanados + campo "declaracion_jurada"
      // - supervisor/backoffice: datos_personales anidados + campo "declaracion_salud"
      // ⚠️ Los File del paso 2 no sobreviven a JSON.stringify: se separan del payload
      // y se suben por multipart una vez guardada la póliza.
      const documentosPendientes = recolectarDocumentosPendientes();
      const integrantesSinArchivos = (formData.integrantes || []).map(integrante => ({
        ...integrante,
        documentos: sinArchivos(integrante?.documentos)
      }));
      const documentosTitularSinArchivos = sinArchivos(formData.documentos_titular);

      let datosActualizados;
      if (apiContext === 'vendedor') {
        datosActualizados = {
          ...formData.datos_personales,
          declaracion_jurada: formData.declaracion_jurada,
          integrantes: integrantesSinArchivos,
          documentos_titular: documentosTitularSinArchivos,
          referencias: formData.referencias,
          saludTerminos: formData.saludTerminos
        };
      } else {
        // supervisor / backoffice: enviar datos_personales y "declaracion_salud"
        // Además, persistir el paso 5 en "datos_comerciales" y reflejar respuestas en declaracion_salud
        const declaracionSaludActualizada = { ...(formData.declaracion_jurada || {}) };
        const saludTerminos = formData.saludTerminos || {};

        if (saludTerminos && typeof saludTerminos === 'object') {
          if (saludTerminos.respuestas) {
            declaracionSaludActualizada.respuestas = saludTerminos.respuestas;
          }
          if (saludTerminos.medicacion !== undefined) {
            declaracionSaludActualizada.medicacion = saludTerminos.medicacion;
          }
          if (saludTerminos.coberturaAnterior !== undefined) {
            declaracionSaludActualizada.coberturaAnterior = saludTerminos.coberturaAnterior;
            declaracionSaludActualizada.cobertura_anterior = saludTerminos.coberturaAnterior;
          }
          if (saludTerminos.datosAdicionales !== undefined) {
            declaracionSaludActualizada.datos_adicionales = saludTerminos.datosAdicionales;
          }
        }

        datosActualizados = {
          datos_personales: formData.datos_personales,
          declaracion_salud: declaracionSaludActualizada,
          integrantes: integrantesSinArchivos,
          documentos_titular: documentosTitularSinArchivos,
          referencias: formData.referencias,
          datos_comerciales: formData.saludTerminos
        };
      }

      console.log('📤 Enviando datos actualizados:', datosActualizados);
      console.log('📤 Declaración jurada en datosActualizados:', datosActualizados.declaracion_jurada);

      const response = await axios.put(
        `${getApiBase()}/${poliza.id}/actualizar`,
        datosActualizados,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('cober_token')}`
          }
        }
      );

      if (response.data.success) {
        // ✅ Subir los documentos nuevos seleccionados en el paso 2
        const { subidos, errores } = await subirDocumentosPendientes(documentosPendientes);

        if (subidos > 0) {
          limpiarDocumentosPendientes();
          await fetchDocumentosPoliza(poliza.id);
        }

        // Los datos de la póliza sí se guardaron: avisar qué documentos quedaron sin subir
        if (errores.length > 0) {
          onActualizar();
          await Swal.fire({
            title: 'Cambios guardados, documentos pendientes',
            html: `
              <div class="text-start">
                <p class="text-success mb-2">Los datos de la póliza se guardaron correctamente.</p>
                ${subidos > 0 ? `<p class="mb-2">Documentos subidos: <strong>${subidos}</strong></p>` : ''}
                <p class="mb-1">No se pudieron subir:</p>
                ${errores.map(e => `<div class="small text-danger">• ${e}</div>`).join('')}
              </div>
            `,
            icon: 'warning',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ffc107'
          });
          return;
        }

        setSuccess(true);
        
        // ✅ Mostrar SweetAlert de éxito
        await Swal.fire({
          title: '¡Póliza actualizada!',
          html: `
            <div class="text-center">
              <p><strong>Póliza:</strong> ${poliza?.numero_poliza}</p>
              <p class="text-success">Los cambios han sido guardados correctamente</p>
              ${subidos > 0 ? `<p class="small text-muted">Documentos subidos: ${subidos}</p>` : ''}
              ${response.data.data?.campos_actualizados ? 
                `<p class="small text-muted">Campos actualizados: ${response.data.data.campos_actualizados.length}</p>` 
                : ''}
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#28a745'
        });

        // Cerrar modal y actualizar lista
        onActualizar();
        onHide();
        setSuccess(false);
        setStep(0);
      }
    } catch (err) {
      console.error('Error actualizando póliza:', err);
      setError(err.response?.data?.message || 'Error al actualizar la póliza');
      
      // ✅ Mostrar SweetAlert de error
      Swal.fire({
        title: 'Error al guardar',
        text: err.response?.data?.message || 'No se pudieron guardar los cambios. Por favor intente nuevamente.',
        icon: 'error',
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#dc3545'
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Renderizar paso actual
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <PasoDatosPersonales
            datosPersonales={formData.datos_personales}
            handleChange={handlePersonalChange}
            opcionesEstadoCivil={opcionesEstadoCivil}
            opcionesNacionalidad={opcionesNacionalidad}
            opcionesCondicionIVA={opcionesCondicionIVA}
            opcionesTipoDomicilio={opcionesTipoDomicilio}
            opcionesFormasPago={opcionesFormasPago}
            cotizacion={cotizacionInfo}
            polizaIdActual={poliza?.id}
          />
        );
      
      case 1:
        return (
          <PasoIntegrantesDocumentos
            integrantes={formData.integrantes}
            documentosTitular={formData.documentos_titular}
            datosPersonales={formData.datos_personales}
            cotizacion={cotizacionInfo}
            handleIntegranteChange={handleIntegranteChange}
            opcionesNacionalidad={opcionesNacionalidad}
            handleFileUpload={handleFileUpload}
            handleRemoveFile={handleRemoveFile}
            documentosExistentes={documentos}
            onActualizarDoc={handleActualizarDocumento}
            onEliminarDoc={handleEliminarDocumento}
            onPreviewDoc={handlePreviewDocumento}
            declaracionJurada={formData.declaracion_jurada}
            handleDeclaracionChange={handleDeclaracionChange}
          />
        );
      
      case 2:
        return (
          <PasoReferencias
            referencias={formData.referencias}
            handleReferenciaChange={handleReferenciaChange}
            agregarReferencia={agregarReferencia}
            eliminarReferencia={eliminarReferencia}
          />
        );
      
      case 3:
        return (
          <PasoSaludTerminos
            key={`salud-${poliza?.id}-${dataLoadKey}`}
            saludTerminos={formData.saludTerminos}
            setSaludTerminos={(data) => setFormData(prev => ({ ...prev, saludTerminos: data }))}
            aceptaTerminos={aceptaTerminos}
            setAceptaTerminos={setAceptaTerminos}
            datosPersonales={formData.datos_personales}
            integrantes={formData.integrantes}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" backdrop="static" fullscreen="lg-down">
      <Modal.Header closeButton>
        <Modal.Title>
          Editar Póliza #{poliza?.numero_poliza}
          <small className="text-[0.875em] text-muted-foreground ms-2">
            Paso {step + 1} de {etapas.length}: {etapas[step]}
          </small>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert variant="success">✅ Póliza actualizada correctamente</Alert>}

        {/* Barra de progreso */}
        <ProgressBar 
          now={((step + 1) / etapas.length) * 100} 
          label={`${step + 1}/${etapas.length}`}
          className="mb-6"
          style={{ height: '25px' }}
        />

        {loading && !formData.datos_personales?.nombre ? (
          <div className="text-center py-12">
            <Spinner animation="border" role="status">
              <span className="sr-only">Cargando...</span>
            </Spinner>
            <p className="mb-4 mt-4">Cargando datos de la póliza...</p>
          </div>
        ) : (
          <Form onSubmit={handleSubmit}>
            {renderStep()}
          </Form>
        )}
      </Modal.Body>

      <Modal.Footer className="flex justify-between">
        <Button 
          variant="secondary" 
          onClick={onHide}
          disabled={loading}
        >
          Cancelar
        </Button>

        <div>
          {step > 0 && (
            <Button 
              variant="outline-secondary" 
              onClick={handlePrev}
              disabled={loading}
              className="me-2"
            >
              <FaArrowLeft className="me-1" />
              Anterior
            </Button>
          )}
          
          {step < etapas.length - 1 ? (
            <Button 
              variant="primary" 
              onClick={handleNext}
              disabled={loading}
            >
              Siguiente
              <FaArrowRight className="ms-1" />
            </Button>
          ) : (
            <Button 
              variant="success" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="me-2" style={{ animation: 'spin 1s linear infinite' }} />
                  Guardando...
                </>
              ) : (
                <>
                  <FaSave className="me-1" />
                  Guardar Cambios
                </>
              )}
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>

      {/* ✅ Modal para actualizar documento individual */}
      <Modal
        show={modalActualizarDoc}
        onHide={() => {
          if (!loadingActualizar) {
            setModalActualizarDoc(false);
            setDocumentoActualizar(null);
            setNuevoArchivo(null);
            setMotivoActualizacion('');
          }
        }}
        centered
        style={{ zIndex: 1100 }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Actualizar Documento</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitActualizacionDoc}>
          <Modal.Body>
            {documentoActualizar && (
              <Alert variant="info">
                <strong>Documento actual:</strong><br />
                {formatTipoDoc(documentoActualizar.tipo_documento)}<br />
                <small className="text-[0.875em] text-muted-foreground">{documentoActualizar.nombre_original}</small>
              </Alert>
            )}

            <Form.Group className="mb-4">
              <Form.Label>Nuevo archivo <span className="text-destructive">*</span></Form.Label>
              <Form.Control
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleNuevoArchivoChange}
                required
              />
              <Form.Text className="text-muted-foreground">Formatos: PDF, JPG, PNG. Máximo 10MB.</Form.Text>
            </Form.Group>

            {nuevoArchivo && (
              <Alert variant="success" className="py-2">
                <strong>Seleccionado:</strong> {nuevoArchivo.name}{' '}
                <small className="text-[0.875em]">({(nuevoArchivo.size / 1024 / 1024).toFixed(2)} MB)</small>
              </Alert>
            )}

            <Form.Group className="mb-4">
              <Form.Label>Motivo de la actualización <span className="text-destructive">*</span></Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={motivoActualizacion}
                onChange={(e) => setMotivoActualizacion(e.target.value)}
                placeholder="Ej: Documento ilegible, información incorrecta..."
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                setModalActualizarDoc(false);
                setDocumentoActualizar(null);
                setNuevoArchivo(null);
                setMotivoActualizacion('');
              }}
              disabled={loadingActualizar}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="warning"
              disabled={loadingActualizar || !nuevoArchivo || !motivoActualizacion.trim()}
            >
              {loadingActualizar ? (
                <><Spinner size="sm" animation="border" className="me-1" />Actualizando...</>
              ) : (
                <><FaEdit className="me-1" />Actualizar Documento</>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ✅ Modal para previsualizar documentos */}
      <DocumentPreviewModal
        show={showPreview}
        onHide={() => {
          setShowPreview(false);
          if (previewUrl) window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setPreviewMime(null);
        }}
        previewUrl={previewUrl}
        previewMime={previewMime}
        documentName={previewName}
        onDownload={() => {
          if (previewUrl) {
            const link = document.createElement('a');
            link.href = previewUrl;
            link.download = previewName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />
    </>
  );
};

export default EditarPolizaModal;
