import React, { useState, useEffect } from "react";
import { Card, Row, Col, Form, Alert, Badge, Accordion } from "@/components/compat/bootstrap";
import {
  Activity,
  Heart,
  Eye,
  PersonFillGear,
  Lungs,
  PlusCircle,
  FileText,
  ShieldCheck,
  PersonFill,
  Hospital,
  Prescription,
  InfoCircleFill,
  ExclamationTriangleFill
} from "@/lib/icons";

const coberturasMedicas = [
  "Sin cobertura anterior",
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Medicus",
  "Hospital Italiano",
  "Hospital Alemán",
  "IOMA",
  "OSECAC",
  "OSDEPYM",
  "OSPLAD",
  "OSPRERA",
  "UNION PERSONAL",
  "SANCOR SALUD",
  "ACCORD SALUD",
  "FEDERADA SALUD",
  "Otra"
];

const PasoSaludTerminos = ({
  saludTerminos,
  setSaludTerminos,
  aceptaTerminos,
  setAceptaTerminos,
  datosPersonales,
  integrantes
}) => {
  // ✅ CORREGIR: Crear lista completa de integrantes incluyendo titular
  // Ordenar: Titular → Cónyuge/Pareja/Matrimonio → resto de integrantes
  const esConyuge = (vinculo) => {
    const v = (vinculo || '').toLowerCase();
    return v.includes('matrimonio') || v.includes('conyuge') || v.includes('cónyuge') || v.includes('pareja');
  };

  const integrantesMapeados = (integrantes || []).map((integrante, idx) => ({
    nombre: integrante.nombre || 'Sin nombre',
    apellido: integrante.apellido || '',
    vinculo: integrante.vinculo || 'Familiar',
    index: idx + 1
  }));

  const todosLosIntegrantes = [
    {
      nombre: datosPersonales?.nombre || 'Titular',
      apellido: datosPersonales?.apellido || '',
      vinculo: 'Titular',
      index: 0
    },
    ...integrantesMapeados.filter(i => esConyuge(i.vinculo)),
    ...integrantesMapeados.filter(i => !esConyuge(i.vinculo))
  ];

  console.log('👥 Integrantes detectados:', todosLosIntegrantes);

  // ✅ CORREGIR: Preguntas de salud con categorías
  const preguntasSalud = [
    { 
      id: 'internacion', 
      pregunta: '¿Tuviste que ser internado en alguna oportunidad?', 
      detalle: 'Aclará motivos, mes y año',
      categoria: 'internaciones'
    },
    { 
      id: 'internacion_colegiales', 
      pregunta: '¿Fuiste internado en el Sanatorio Colegiales?', 
      detalle: 'Aclará motivo, mes y año',
      categoria: 'internaciones'
    },
    { 
      id: 'cirugia', 
      pregunta: '¿Tuviste que ser intervenido quirúrgicamente alguna vez?', 
      detalle: 'Especificar tipo, fecha y resultado',
      categoria: 'internaciones'
    },
    
    // Enfermedades y Secuelas
    { 
      id: 'secuelas', 
      pregunta: '¿Tenés secuelas o algún tipo de enfermedad?', 
      detalle: 'Describir tipo y gravedad',
      categoria: 'general'
    },
    { 
      id: 'accidentes', 
      pregunta: '¿Padeciste accidentes, fracturas o traumatismos?', 
      detalle: 'Aclará motivo, si requirieron cirugías, mes, año y si quedaron secuelas',
      categoria: 'general'
    },
    { 
      id: 'transfusiones', 
      pregunta: '¿Te realizaron transfusiones de sangre?', 
      detalle: 'Motivo y fecha',
      categoria: 'general'
    },
    
    // Estudios y Tratamientos
    { 
      id: 'estudios_anuales', 
      pregunta: '¿Realizaste tus análisis y estudios en el último año?', 
      detalle: 'Tipo de estudios y resultados',
      categoria: 'estudios'
    },
    { 
      id: 'indicacion_medica', 
      pregunta: '¿Tenés alguna indicación médica para los próximos meses?', 
      detalle: 'Especificá cuál y el diagnóstico presuntivo',
      categoria: 'estudios'
    },
    
    // Salud Mental
    { 
      id: 'psicologico', 
      pregunta: '¿Estás o estuviste en un tratamiento psicológico?', 
      detalle: 'Motivo y duración',
      categoria: 'mental'
    },
    { 
      id: 'psiquiatrico', 
      pregunta: '¿Estás o estuviste en un tratamiento psiquiátrico?', 
      detalle: 'Motivo, medicación y duración',
      categoria: 'mental'
    },
    { 
      id: 'internacion_mental', 
      pregunta: '¿Estuviste internado en alguna institución de Salud Mental?', 
      detalle: 'Motivo, duración y fecha',
      categoria: 'mental'
    },
    
    // Diabetes
    { 
      id: 'diabetes', 
      pregunta: '¿Tenés diabetes?', 
      detalle: '¿Desde cuándo? ¿Tomás medicación por boca? ¿Recibís insulina? ¿Cumplís algún tipo de dieta? ¿Tenés familiares diabéticos?',
      categoria: 'diabetes'
    },
    
    // Problemas Visuales y Auditivos
    { 
      id: 'auditivas', 
      pregunta: '¿Tenés dificultades auditivas?', 
      detalle: 'Tipo y gravedad',
      categoria: 'sentidos'
    },
    { 
      id: 'vista', 
      pregunta: '¿Tenés problemas de vista? ¿De qué tipo?', 
      detalle: 'Especificar tipo de problema',
      categoria: 'sentidos'
    },
    { 
      id: 'lentes', 
      pregunta: '¿Usás lentes de contacto o anteojos?', 
      detalle: 'Graduación aproximada',
      categoria: 'sentidos'
    },
    { 
      id: 'glaucoma', 
      pregunta: '¿Tenés glaucoma (presión alta en el ojo) o cataratas?', 
      detalle: 'Tratamiento actual',
      categoria: 'sentidos'
    },
    
    // Alergias
    { 
      id: 'alergias', 
      pregunta: '¿Tenés alergias?', 
      detalle: 'Tipo de alergia y tratamiento',
      categoria: 'alergias'
    },
    
    // Cardíacas
    { 
      id: 'infarto', 
      pregunta: '¿Tuviste ataques cardíacos o infartos?', 
      detalle: 'Fecha y tratamiento',
      categoria: 'cardiacas'
    },
    { 
      id: 'presion_arterial', 
      pregunta: '¿Cuál es tu presión arterial actual?', 
      detalle: 'Ej: 120/80 mmHg - Indicar si es alta, baja o normal',
      categoria: 'cardiacas'
    },
    
    // Embarazo (solo para mujeres)
    { 
      id: 'test_embarazo', 
      pregunta: '¿Te realizaste algún test de embarazo en las últimas semanas?', 
      detalle: 'Resultado',
      categoria: 'embarazo'
    },
    { 
      id: 'sintomas_embarazo', 
      pregunta: '¿Presentaste náuseas o vómitos recientemente / mareos o dolores de cabeza?', 
      detalle: 'Frecuencia y intensidad',
      categoria: 'embarazo'
    },
    { 
      id: 'embarazo_actual', 
      pregunta: '¿Te encontrás cursando un embarazo ahora?', 
      detalle: 'Semanas de gestación',
      categoria: 'embarazo'
    },
    { 
      id: 'aborto', 
      pregunta: '¿Tuviste algún aborto espontáneo?', 
      detalle: 'Fecha y causa',
      categoria: 'embarazo'
    },
    { 
      id: 'partos', 
      pregunta: '¿Tuviste partos normales?', 
      detalle: 'Cantidad y fechas',
      categoria: 'embarazo'
    },

    // Problemas Físicos
    { 
      id: 'columna', 
      pregunta: '¿Tenés problemas de columna?', 
      detalle: 'Tipo de problema y tratamiento',
      categoria: 'fisico'
    },
    { 
      id: 'protesis', 
      pregunta: '¿Tenés colocada alguna prótesis?', 
      detalle: 'Tipo y ubicación',
      categoria: 'fisico'
    },
    { 
      id: 'deporte', 
      pregunta: '¿Practicás algún deporte?', 
      detalle: 'Tipo y frecuencia',
      categoria: 'fisico'
    },
    { 
      id: 'deporte_riesgo', 
      pregunta: '¿Practicás algún deporte de riesgo?', 
      detalle: 'Especificar cuál',
      categoria: 'fisico'
    },
    { 
      id: 'indicacion_protesis', 
      pregunta: '¿Tenés indicación para la colocación de alguna prótesis?', 
      detalle: 'Tipo y fecha prevista',
      categoria: 'fisico'
    },
    
    // Neurológicas
    { 
      id: 'neurologicas', 
      pregunta: '¿Tenés o tuviste trastornos neurológicos o circulatorios cerebrales?', 
      detalle: 'Tipo y tratamiento',
      categoria: 'neurologicas'
    },
    { 
      id: 'epilepsia', 
      pregunta: '¿Tenés o tuviste epilepsia?', 
      detalle: 'Medicación y control',
      categoria: 'neurologicas'
    },
    
    // Respiratorias
    { 
      id: 'respiratorias', 
      pregunta: '¿Tenés o tuviste asma, bronquitis crónica, enfisema pulmonar?', 
      detalle: 'Tipo y tratamiento',
      categoria: 'respiratorias'
    },
    { 
      id: 'tuberculosis', 
      pregunta: '¿Tenés o tuviste tuberculosis?', 
      detalle: 'Fecha y tratamiento',
      categoria: 'respiratorias'
    },
    
    // Otras Enfermedades
    { 
      id: 'fiebre_reumatica', 
      pregunta: '¿Tenés o tuviste fiebre reumática o enfermedades de los huesos?', 
      detalle: 'Tipo y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'hepatitis', 
      pregunta: '¿Tenés o tuviste ictericia, hepatitis (de cualquier tipo), cirrosis?', 
      detalle: 'Tipo y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'colicos', 
      pregunta: '¿Tenés o tuviste cólicos renales o vesiculares?', 
      detalle: 'Frecuencia y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'infecciones_urinarias', 
      pregunta: '¿Tenés o tuviste infecciones urinarias repetidas?', 
      detalle: 'Frecuencia y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'anemia', 
      pregunta: '¿Tenés o tuviste pérdida de sangre o anemia?', 
      detalle: 'Causa y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'transmision_sexual', 
      pregunta: '¿Tenés enfermedades de transmisión sexual? (Sida, Hepatitis B u otras)', 
      detalle: 'Tipo y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'infecciosas', 
      pregunta: '¿Tenés o tuviste otras enfermedades infecciosas?', 
      detalle: 'Tipo y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'tumores', 
      pregunta: '¿Tenés o tuviste tumores?', 
      detalle: 'Tipo, ubicación y tratamiento',
      categoria: 'otras'
    },
    { 
      id: 'tiroides', 
      pregunta: '¿Tenés o tuviste enfermedades de las glándulas tiroides?', 
      detalle: 'Tipo y medicación',
      categoria: 'otras'
    },
    { 
      id: 'gastritis', 
      pregunta: '¿Tenés o tuviste úlceras, gastritis y/o alguna otra enfermedad del estómago?', 
      detalle: 'Tipo y tratamiento',
      categoria: 'otras'
    },
    
    // Hábitos
    { 
      id: 'tabaquismo', 
      pregunta: '¿Fumás o fumaste?', 
      detalle: 'Cantidad diaria y desde cuándo',
      categoria: 'habitos'
    },
    { 
      id: 'alcoholismo', 
      pregunta: '¿Bebés alcohol habitualmente?', 
      detalle: 'Tipo y frecuencia',
      categoria: 'habitos'
    },
    { 
      id: 'drogas', 
      pregunta: '¿Consumís drogas?', 
      detalle: 'Tipo y frecuencia',
      categoria: 'habitos'
    },
    { 
      id: 'perdida_peso', 
      pregunta: '¿Perdiste peso en los últimos 6 meses sin hacer dieta?', 
      detalle: 'Cantidad y causa',
      categoria: 'habitos'
    },
    { 
      id: 'diagnostico_reciente', 
      pregunta: '¿Se te diagnosticó recientemente alguna enfermedad?', 
      detalle: 'Cuál y tratamiento',
      categoria: 'habitos'
    },
    { 
      id: 'discapacidad', 
      pregunta: '¿Tenés, tuviste o estás tramitando un certificado de discapacidad?', 
      detalle: 'Tipo y porcentaje',
      categoria: 'habitos'
    }
  ];

  // ✅ CORREGIR: Inicialización correcta con TEXTO en lugar de BOOLEAN
  const respuestasPorDefecto = todosLosIntegrantes.reduce((acc, integrante) => {
    acc[integrante.index] = preguntasSalud.reduce((preguntasAcc, pregunta) => {
      preguntasAcc[pregunta.id] = { 
        respuesta: 'no',  // ✅ CORREGIDO: Usar texto 'no' en lugar de false
        detalle: '' 
      };
      return preguntasAcc;
    }, {});
    
    // ✅ CORREGIR: Agregar pregunta especial para mujeres
    if (
      (integrante.vinculo === "Titular" && datosPersonales?.sexo === "femenino") ||
      (integrante.vinculo !== "Titular" && integrantes?.[integrante.index - 1]?.sexo === "femenino")
    ) {
      acc[integrante.index].ultima_menstruacion = {
        corresponde: 'si', // 'si' = muestra fecha, 'no' = muestra detalle (ej: menopausia)
        respuesta: '', // ✅ CORREGIDO: fecha como string
        detalle: ''
      };
    }
    
    return acc;
  }, {});

  // ✅ CORREGIR: Cobertura médica POR INTEGRANTE
  const coberturaDefectoPorIntegrante = todosLosIntegrantes.reduce((acc, integrante) => {
    acc[integrante.index] = {
      cobertura: 'Sin cobertura anterior',
      fecha_desde: '',
      fecha_hasta: '',
      motivo_baja: ''
    };
    return acc;
  }, {});

  // ✅ Inicializar estados locales desde saludTerminos
  const respuestasIniciales = (saludTerminos?.respuestas && Object.keys(saludTerminos.respuestas).length > 0)
    ? saludTerminos.respuestas
    : respuestasPorDefecto;

  const coberturaInicial = (saludTerminos?.coberturaAnterior && Object.keys(saludTerminos.coberturaAnterior).length > 0)
    ? saludTerminos.coberturaAnterior
    : coberturaDefectoPorIntegrante;

  const medicacionInicialPorIntegrante = (saludTerminos?.medicacion && typeof saludTerminos.medicacion === 'object')
    ? (saludTerminos.medicacion[0] !== undefined
        // Si medicacion es un objeto por integrante (nuevo formato)
        ? saludTerminos.medicacion
        // Si es el formato viejo (objeto simple con solo 'detalle'), convertirlo
        : todosLosIntegrantes.reduce((acc, integrante) => {
            acc[integrante.index] = { detalle: saludTerminos.medicacion?.detalle || 'Ninguna' };
            return acc;
          }, {}))
    : todosLosIntegrantes.reduce((acc, integrante) => {
        acc[integrante.index] = { detalle: 'Ninguna' };
        return acc;
      }, {});

  const datosAdicionalesIniciales = (saludTerminos?.datosAdicionales && typeof saludTerminos.datosAdicionales === 'object')
    ? (saludTerminos.datosAdicionales[0] !== undefined
        ? saludTerminos.datosAdicionales
        : todosLosIntegrantes.reduce((acc, integrante) => {
            acc[integrante.index] = {
              declaracion_adicional: saludTerminos.datosAdicionales?.declaracion_adicional || '',
              medico_tratante: saludTerminos.datosAdicionales?.medico_tratante || '',
              instituciones_anteriores: saludTerminos.datosAdicionales?.instituciones_anteriores || ''
            };
            return acc;
          }, {}))
    : todosLosIntegrantes.reduce((acc, integrante) => {
        acc[integrante.index] = {
          declaracion_adicional: '',
          medico_tratante: '',
          instituciones_anteriores: ''
        };
        return acc;
      }, {});

  // Inicializar/normalizar en el estado padre cuando falten sub-secciones
  useEffect(() => {
    const faltanRespuestas = !saludTerminos || Object.keys(saludTerminos?.respuestas || {}).length === 0;
    const faltaCobertura = !saludTerminos || Object.keys(saludTerminos?.coberturaAnterior || {}).length === 0;
    const faltaMedicacion = !saludTerminos || Object.keys(saludTerminos?.medicacion || {}).length === 0;
    const faltanDatosAdicionales = !saludTerminos || Object.keys(saludTerminos?.datosAdicionales || {}).length === 0;

    if (faltanRespuestas || faltaCobertura || faltaMedicacion || faltanDatosAdicionales) {
      const datosCompletos = {
        respuestas: faltanRespuestas ? respuestasPorDefecto : saludTerminos.respuestas,
        coberturaAnterior: faltaCobertura ? coberturaDefectoPorIntegrante : saludTerminos.coberturaAnterior,
        medicacion: faltaMedicacion
          ? todosLosIntegrantes.reduce((acc, integrante) => {
              acc[integrante.index] = { detalle: 'Ninguna' };
              return acc;
            }, {})
          : saludTerminos.medicacion,
        datosAdicionales: faltanDatosAdicionales
          ? todosLosIntegrantes.reduce((acc, integrante) => {
              acc[integrante.index] = { declaracion_adicional: '', medico_tratante: '', instituciones_anteriores: '' };
              return acc;
            }, {})
          : saludTerminos.datosAdicionales
      };

      console.log('🏥 Normalizando saludTerminos con defaults si faltan subclaves:', datosCompletos);
      setSaludTerminos(datosCompletos);
    }
  }, [todosLosIntegrantes.length]);

  // Estados locales para la UI
  const [respuestas, setRespuestas] = useState(respuestasIniciales);
  const [coberturaAnteriorPorIntegrante, setCoberturaAnteriorPorIntegrante] = useState(coberturaInicial);
  const [medicacionPorIntegrante, setMedicacionPorIntegrante] = useState(medicacionInicialPorIntegrante);
  const [datosAdicionalesPorIntegrante, setDatosAdicionalesPorIntegrante] = useState(datosAdicionalesIniciales);

  const categorias = {
    internaciones: { titulo: 'Internaciones y Cirugías', icono: Hospital, color: 'danger' },
    general: { titulo: 'Enfermedades Generales', icono: Activity, color: 'warning' },
    estudios: { titulo: 'Estudios y Tratamientos', icono: FileText, color: 'info' },
    mental: { titulo: 'Salud Mental', icono: PersonFillGear, color: 'secondary' },
    diabetes: { titulo: 'Diabetes', icono: Heart, color: 'danger' },
    sentidos: { titulo: 'Vista y Audición', icono: Eye, color: 'primary' },
    alergias: { titulo: 'Alergias', icono: ExclamationTriangleFill, color: 'warning' },
    cardiacas: { titulo: 'Enfermedades Cardíacas', icono: Heart, color: 'danger' },
    embarazo: { titulo: 'Embarazo y Ginecología', icono: PersonFill, color: 'info' },
    fisico: { titulo: 'Problemas Físicos', icono: Activity, color: 'success' },
    neurologicas: { titulo: 'Enfermedades Neurológicas', icono: PersonFillGear, color: 'dark' },
    respiratorias: { titulo: 'Enfermedades Respiratorias', icono: Lungs, color: 'info' },
    otras: { titulo: 'Otras Enfermedades', icono: PlusCircle, color: 'secondary' },
    habitos: { titulo: 'Hábitos y Estilo de Vida', icono: Activity, color: 'warning' }
  };

  // ✅ CORREGIR: Handler con conversión correcta boolean → texto
  const handleRespuestaChange = (integranteIndex, preguntaId, campo, valor) => {
    console.log(`🏥 Cambiando respuesta: Integrante ${integranteIndex}, Pregunta ${preguntaId}, Campo ${campo}, Valor:`, valor);
    
    // ✅ Deep copy del integrante específico para evitar mutación del estado compartido
    const prevIntegrante = respuestas[integranteIndex] || {};
    const prevPregunta = prevIntegrante[preguntaId] || { respuesta: 'no', detalle: '' };

    const valorFinal = (campo === 'respuesta' && typeof valor === 'boolean')
      ? (valor ? 'si' : 'no')
      : valor;

    const nuevasRespuestas = {
      ...respuestas,
      [integranteIndex]: {
        ...prevIntegrante,
        [preguntaId]: { ...prevPregunta, [campo]: valorFinal }
      }
    };
    
    setRespuestas(nuevasRespuestas);
    
    // ✅ CORREGIR: Actualizar inmediatamente el estado del padre
    const datosActualizados = {
      ...saludTerminos,
      respuestas: nuevasRespuestas
    };
    
    console.log('🏥 Enviando datos actualizados al padre:', datosActualizados);
    setSaludTerminos(datosActualizados);
  };

  // ✅ CORREGIR: Handler de cobertura POR INTEGRANTE
  const handleCoberturaChange = (integranteIndex, campo, valor) => {
    console.log(`🏥 Cambiando cobertura Integrante ${integranteIndex}: ${campo}: ${valor}`);
    
    const nuevaCoberturaIntegrante = { ...coberturaAnteriorPorIntegrante };
    if (!nuevaCoberturaIntegrante[integranteIndex]) {
      nuevaCoberturaIntegrante[integranteIndex] = {
        cobertura: 'Sin cobertura anterior',
        fecha_desde: '',
        fecha_hasta: '',
        motivo_baja: ''
      };
    }
    nuevaCoberturaIntegrante[integranteIndex][campo] = valor;
    setCoberturaAnteriorPorIntegrante(nuevaCoberturaIntegrante);
    
    const datosActualizados = {
      ...saludTerminos,
      coberturaAnterior: nuevaCoberturaIntegrante
    };
    
    console.log('🏥 Cobertura actualizada:', datosActualizados);
    setSaludTerminos(datosActualizados);
  };

  // ✅ CORREGIR: Handler de medicación POR INTEGRANTE - Validación Simple
  const handleMedicacionChange = (integranteIndex, campo, valor) => {
    console.log(`🏥 Cambiando medicación Integrante ${integranteIndex}: ${campo}: ${valor}`);
    
    const nuevaMedicacionPorIntegrante = { ...medicacionPorIntegrante };
    if (!nuevaMedicacionPorIntegrante[integranteIndex]) {
      nuevaMedicacionPorIntegrante[integranteIndex] = { detalle: 'Ninguna' };
    }
    
    // ✅ Si el campo queda vacío, asignar "Ninguna". Permitir espacios en el texto ingresado.
    nuevaMedicacionPorIntegrante[integranteIndex][campo] = valor === '' ? 'Ninguna' : valor;
    setMedicacionPorIntegrante(nuevaMedicacionPorIntegrante);
    
    const datosActualizados = {
      ...saludTerminos,
      medicacion: nuevaMedicacionPorIntegrante
    };
    
    console.log('🏥 Medicación actualizada:', datosActualizados);
    setSaludTerminos(datosActualizados);
  };

  // ✅ CORREGIR: Handler de datos adicionales POR INTEGRANTE
  const handleDatosAdicionalesChange = (integranteIndex, campo, valor) => {
    const nuevosDatosPorIntegrante = { ...datosAdicionalesPorIntegrante };
    if (!nuevosDatosPorIntegrante[integranteIndex]) {
      nuevosDatosPorIntegrante[integranteIndex] = {
        declaracion_adicional: '',
        medico_tratante: '',
        instituciones_anteriores: ''
      };
    }
    nuevosDatosPorIntegrante[integranteIndex][campo] = valor;
    setDatosAdicionalesPorIntegrante(nuevosDatosPorIntegrante);
    
    const datosActualizados = {
      ...saludTerminos,
      datosAdicionales: nuevosDatosPorIntegrante // ✅ CORREGIDO: Enviar datos adicionales por integrante
    };
    
    setSaludTerminos(datosActualizados);
  };

  const preguntasPorCategoria = Object.keys(categorias).reduce((acc, categoria) => {
    acc[categoria] = preguntasSalud.filter(p => p.categoria === categoria);
    return acc;
  }, {});

  // Calcular estadísticas para debug
  const numRespuestas = Object.keys(respuestas).length;
  const respuestasAfirmativas = Object.values(respuestas).filter(r => r.respuesta === 'si').length;

  return (
    <div>
      {/* Estilos personalizados para radio buttons */}

      <Alert variant="info" className="mb-6">
        <InfoCircleFill className="me-2" size={16} />
        <strong>Declaración Jurada de Salud:</strong> Complete todas las preguntas de manera veraz y detallada.
      </Alert>

      {/* ✅ CORREGIR: Cuestionario por integrante con checkbox corregido */}
      {todosLosIntegrantes.map((integrante, integranteIdx) => (
        <Card key={integrante.index} className="mb-6 border-0 shadow-xs">
          <Card.Header className="bg-[#caacd3] text-white">
            <PersonFill className="me-2" size={20} />
            <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">
              {integrante.nombre} {integrante.apellido} ({integrante.vinculo?.toLowerCase() === 'matrimonio' || integrante.vinculo?.toLowerCase() === 'pareja/conyuge' ? 'Cónyuge' : integrante.vinculo})
            </h6>
          </Card.Header>
          <Card.Body>
            {/* Encabezado de instrucciones */}
            <Alert variant="light" className="mb-6 border border-primary">
              <div className="flex justify-between items-center">
                <div>
                  <InfoCircleFill className="me-2 text-primary" size={16} />
                  <strong>Para cada pregunta, seleccione una opción:</strong>
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center">
                    <div className="bg-success text-white px-4 py-1 rounded-md me-2">NO</div>
                    <span className="text-[0.875em] text-muted-foreground">No aplica / No tengo</span>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-destructive text-white px-4 py-1 rounded-md me-2">SÍ</div>
                    <span className="text-[0.875em] text-muted-foreground">Sí aplica / Sí tengo</span>
                  </div>
                </div>
              </div>
            </Alert>

            {/* Preguntas de salud con checkbox CORREGIDO */}
            {preguntasSalud.map((pregunta) => {
              // Filtrar preguntas de embarazo solo para mujeres
              if (
                pregunta.categoria === "embarazo" &&
                !(
                  (integrante.vinculo === "Titular" && datosPersonales?.sexo === "femenino") ||
                  (integrante.vinculo !== "Titular" && integrantes?.[integrante.index - 1]?.sexo === "femenino")
                )
              ) {
                return null;
              }
              return (
                <Card key={pregunta.id} className="mb-4 border bg-card shadow-xs">
                  <Card.Body className="py-4">
                    <Row className="items-center">
                      <Col md={8}>
                        <div className="mb-1">
                          <strong className="text-foreground">{pregunta.pregunta}</strong>
                        </div>
                        {pregunta.detalle && (
                          <div className="text-muted-foreground text-[0.875em]">
                            <em>{pregunta.detalle}</em>
                          </div>
                        )}
                      </Col>
                      <Col md={4}>
                        <div className="flex justify-center items-center gap-6">
                          <Form.Check
                            type="radio"
                            name={`${integrante.index}-${pregunta.id}`}
                            id={`${integrante.index}-${pregunta.id}-no`}
                            checked={respuestas[integrante.index]?.[pregunta.id]?.respuesta === 'no'}
                            onChange={() =>
                              handleRespuestaChange(
                                integrante.index,
                                pregunta.id,
                                "respuesta",
                                false
                              )
                            }
                            label="NO"
                            className="items-center [&>input]:size-5 [&>label]:rounded-full [&>label]:border-2 [&>label]:border-transparent [&>label]:bg-muted [&>label]:px-3 [&>label]:py-1 [&>label]:text-base [&>label]:font-bold [&>label]:transition-colors [&>label]:text-success [&>input:checked+label]:border-success [&>input:checked+label]:bg-success [&>input:checked+label]:text-white"
                          />
                          <Form.Check
                            type="radio"
                            name={`${integrante.index}-${pregunta.id}`}
                            id={`${integrante.index}-${pregunta.id}-si`}
                            checked={respuestas[integrante.index]?.[pregunta.id]?.respuesta === 'si'}
                            onChange={() =>
                              handleRespuestaChange(
                                integrante.index,
                                pregunta.id,
                                "respuesta",
                                true
                              )
                            }
                            label="SÍ"
                            className="items-center [&>input]:size-5 [&>label]:rounded-full [&>label]:border-2 [&>label]:border-transparent [&>label]:bg-muted [&>label]:px-3 [&>label]:py-1 [&>label]:text-base [&>label]:font-bold [&>label]:transition-colors [&>label]:text-destructive [&>input:checked+label]:border-destructive [&>input:checked+label]:bg-destructive [&>input:checked+label]:text-white"
                          />
                        </div>
                      </Col>
                    </Row>
                    {/* ✅ CORREGIR: Mostrar detalle solo si respuesta es 'si' */}
                    {respuestas[integrante.index]?.[pregunta.id]?.respuesta === 'si' && (
                      <Row>
                        <Col md={12}>
                          <Form.Group>
                            <Form.Label className="text-[0.875em] text-muted-foreground">
                              Detalle requerido *
                            </Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={2}
                              value={respuestas[integrante.index]?.[pregunta.id]?.detalle || ""}
                              onChange={e =>
                                handleRespuestaChange(
                                  integrante.index,
                                  pregunta.id,
                                  "detalle",
                                  e.target.value
                                )
                              }
                              placeholder="Proporcione detalles específicos..."
                              required
                              className="h-9 text-sm"
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    )}
                  </Card.Body>
                </Card>
              );
            })}

            {/* ✅ CORREGIR: Cobertura Médica Anterior POR INTEGRANTE */}
            <Card className="mb-6 border-0 shadow-xs">
              <Card.Header className="bg-[#e5d6e9] text-white">
                <ShieldCheck className="me-2" size={20} />
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Cobertura Médica Anterior</h6>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>¿Cuál fue tu última cobertura médica? *</Form.Label>
                      <Form.Select
                        value={coberturaAnteriorPorIntegrante[integrante.index]?.cobertura || 'Sin cobertura anterior'}
                        onChange={e => handleCoberturaChange(integrante.index, 'cobertura', e.target.value)}
                        required
                      >
                        {coberturasMedicas.map(cobertura => (
                          <option key={cobertura} value={cobertura}>{cobertura}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-4">
                      <Form.Label>Fecha desde {coberturaAnteriorPorIntegrante[integrante.index]?.cobertura !== 'Sin cobertura anterior' ? '*' : ''}</Form.Label>
                      <Form.Control
                        type="date"
                        value={coberturaAnteriorPorIntegrante[integrante.index]?.fecha_desde || ''}
                        onChange={e => handleCoberturaChange(integrante.index, 'fecha_desde', e.target.value)}
                        required={coberturaAnteriorPorIntegrante[integrante.index]?.cobertura !== 'Sin cobertura anterior'}
                        disabled={coberturaAnteriorPorIntegrante[integrante.index]?.cobertura === 'Sin cobertura anterior'}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-4">
                      <Form.Label>Fecha hasta {coberturaAnteriorPorIntegrante[integrante.index]?.cobertura !== 'Sin cobertura anterior' ? '*' : ''}</Form.Label>
                      <Form.Control
                        type="date"
                        value={coberturaAnteriorPorIntegrante[integrante.index]?.fecha_hasta || ''}
                        onChange={e => handleCoberturaChange(integrante.index, 'fecha_hasta', e.target.value)}
                        required={coberturaAnteriorPorIntegrante[integrante.index]?.cobertura !== 'Sin cobertura anterior'}
                        disabled={coberturaAnteriorPorIntegrante[integrante.index]?.cobertura === 'Sin cobertura anterior'}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                {/* ✅ AGREGAR: Campo motivo de baja */}
                {coberturaAnteriorPorIntegrante[integrante.index]?.cobertura !== 'Sin cobertura anterior' && (
                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-4">
                        <Form.Label>Motivo de baja (opcional)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={coberturaAnteriorPorIntegrante[integrante.index]?.motivo_baja || ''}
                          onChange={e => handleCoberturaChange(integrante.index, 'motivo_baja', e.target.value)}
                          placeholder="Especifique el motivo por el cual dejó la cobertura anterior"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                )}
              </Card.Body>
            </Card>

            {/* ✅ CORREGIR: Medicación POR INTEGRANTE - Validación Simple */}
            <Card className="mb-6 border-0 shadow-xs">
              <Card.Header className="bg-[#e5d6e9] text-white">
                <Prescription className="me-2" size={20} />
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Medicación</h6>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>Medicación actual</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={medicacionPorIntegrante[integrante.index]?.detalle || ''}
                    onChange={e => handleMedicacionChange(integrante.index, 'detalle', e.target.value)}
                    onKeyDown={(e) => {
                      // ✅ Permitir espacios explícitamente
                      if (e.code === 'Space') {
                        // Solo aceptar espacios normalmente, sin bloquear
                      }
                    }}
                    placeholder="Ingresa el tipo de medicación (ej: Ibuprofeno 400mg). Déjalo vacío si no toma medicación."
                  />
                  <Form.Text className="text-muted-foreground text-[0.875em] block mt-2">
                    Si no toma medicación, simplemente deja este campo vacío.
                  </Form.Text>
                </Form.Group>
              </Card.Body>
            </Card>

            {/* ✅ CORREGIR: Información Adicional POR INTEGRANTE */}
            <Card className="mb-6 border-0 shadow-xs">
              <Card.Header className="bg-[#e5d6e9] text-white">
                <FileText className="me-2" size={20} />
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Información Adicional</h6>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>¿Deseás declarar algún dato adicional que consideres relevante?</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={datosAdicionalesPorIntegrante[integrante.index]?.declaracion_adicional || ''}
                    onChange={e => handleDatosAdicionalesChange(integrante.index, 'declaracion_adicional', e.target.value)}
                    placeholder="Información adicional relevante (opcional)"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>¿Contás con un médico de familia o médico tratante?</strong>
                  </Form.Label>
                  <Form.Control
                    value={datosAdicionalesPorIntegrante[integrante.index]?.medico_tratante || ''}
                    onChange={e => handleDatosAdicionalesChange(integrante.index, 'medico_tratante', e.target.value)}
                    placeholder="Nombre del médico y especialidad (opcional)"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>Informá instituciones dónde se ha atendido/a con anterioridad</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={datosAdicionalesPorIntegrante[integrante.index]?.instituciones_anteriores || ''}
                    onChange={e => handleDatosAdicionalesChange(integrante.index, 'instituciones_anteriores', e.target.value)}
                    placeholder="Hospitales, clínicas, sanatorios, etc."
                  />
                </Form.Group>
              </Card.Body>
            </Card>

            {/* Pregunta especial para mujeres - última fecha de menstruación con segmented control */}
            {(
              (integrante.vinculo === "Titular" && datosPersonales?.sexo === "femenino") ||
              (integrante.vinculo !== "Titular" && integrantes?.[integrante.index - 1]?.sexo === "femenino")
            ) ? (
              <div className="mb-4">
                <Form.Label><strong>¿Última fecha de menstruación?</strong></Form.Label>

                {/* Segmented control: Corresponde / No corresponde */}
                <div style={{ position: 'relative', display: 'flex', width: '100%', background: '#f3f4f6', borderRadius: '12px', padding: '4px', marginBottom: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    left: (respuestas[integrante.index]?.ultima_menstruacion?.corresponde ?? 'si') === 'no' ? 'calc(50%)' : '4px',
                    bottom: '4px',
                    width: 'calc(50% - 4px)',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 0
                  }} />
                  <button
                    type="button"
                    style={{ position: 'relative', zIndex: 1, flex: 1, padding: '10px', textAlign: 'center', border: 'none', background: 'transparent', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', color: (respuestas[integrante.index]?.ultima_menstruacion?.corresponde ?? 'si') !== 'no' ? '#2563eb' : '#6b7280', transition: 'color 0.2s' }}
                    onClick={() => handleRespuestaChange(integrante.index, 'ultima_menstruacion', 'corresponde', 'si')}
                  >
                    Corresponde
                  </button>
                  <button
                    type="button"
                    style={{ position: 'relative', zIndex: 1, flex: 1, padding: '10px', textAlign: 'center', border: 'none', background: 'transparent', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', color: (respuestas[integrante.index]?.ultima_menstruacion?.corresponde ?? 'si') === 'no' ? '#2563eb' : '#6b7280', transition: 'color 0.2s' }}
                    onClick={() => handleRespuestaChange(integrante.index, 'ultima_menstruacion', 'corresponde', 'no')}
                  >
                    No corresponde
                  </button>
                </div>

                {/* Campo condicional: fecha o detalle */}
                {(respuestas[integrante.index]?.ultima_menstruacion?.corresponde ?? 'si') !== 'no' ? (
                  <Form.Control
                    type="date"
                    value={respuestas[integrante.index]?.ultima_menstruacion?.respuesta || ""}
                    onChange={e => handleRespuestaChange(integrante.index, "ultima_menstruacion", "respuesta", e.target.value)}
                  />
                ) : (
                  <Form.Control
                    type="text"
                    value={respuestas[integrante.index]?.ultima_menstruacion?.detalle || ""}
                    onChange={e => handleRespuestaChange(integrante.index, "ultima_menstruacion", "detalle", e.target.value)}
                    placeholder="Detalle: ej. Menopausia"
                  />
                )}
              </div>
            ) : (
              <Form.Group className="mb-4">
                <Form.Label>
                  <strong>¿Última fecha de menstruación?</strong>
                </Form.Label>
                <Form.Control
                  type="text"
                  value="No aplica"
                  disabled
                />
              </Form.Group>
            )}
          </Card.Body>
        </Card>
      ))}

      {/* Términos y Condiciones */}
      <Card className="border-0 shadow-xs">
        <Card.Header className="bg-success text-white">
          <ShieldCheck className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Términos y Condiciones</h6>
        </Card.Header>
        <Card.Body>
          <Form.Check
            type="checkbox"
            id="acepta-terminos-salud"
            checked={aceptaTerminos}
            onChange={e => setAceptaTerminos(e.target.checked)}
            label={
              <span>
                <strong>Leí y estoy de acuerdo con los Términos y Condiciones del Contrato de Afiliación.</strong>
                <br />
                <small className="text-[0.875em] text-muted-foreground">
                  Declaro bajo juramento que toda la información proporcionada es verdadera y completa.
                </small>
              </span>
            }
            className="mt-4"
            required
          />
        </Card.Body>
      </Card>
    </div>
  );
};

export default PasoSaludTerminos;