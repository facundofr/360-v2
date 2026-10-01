
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { Card, Row, Col, Form, Container, Alert, Badge, Spinner } from "@/components/compat/bootstrap";
import { PersonFill, FileEarmarkText, Calendar3, Flag, Building, ShieldCheck, CashCoin, Gift, CreditCard } from "@/lib/icons";
import {  API_URL } from "../../../config";
import CuilInput from "./CuilInput";


const TIPO_AFILIACION_PARTICULAR_ID = 1;

// Próximo período a abonar: rango de años aceptado. Evita que se guarden fechas como
// 0026-11-01 cuando el año se tipea con 2 dígitos en el input type="date".
const ANIO_ACTUAL = new Date().getFullYear();
const PERIODO_MIN = `${ANIO_ACTUAL - 1}-01-01`;
const PERIODO_MAX = `${ANIO_ACTUAL + 2}-12-31`;

// Año de 2 dígitos (0026) → 2026. Se aplica al salir del campo, no mientras se tipea.
const normalizarFechaPeriodo = (valor) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor || '');
  if (!m || Number(m[1]) >= 100) return valor;
  return `${2000 + Number(m[1])}-${m[2]}-${m[3]}`;
};

const esPeriodoValido = (valor) =>
  /^\d{4}-\d{2}-\d{2}$/.test(valor || '') && valor >= PERIODO_MIN && valor <= PERIODO_MAX;

const PasoDatosPersonales = ({
  datosPersonales,
  handleChange,
  opcionesEstadoCivil,
  opcionesNacionalidad,
  opcionesCondicionIVA,
  opcionesTipoDomicilio,
  opcionesFormasPago,
  cotizacion,
  polizaIdActual
}) => {
  // Detecta si el tipo de afiliación es particular (oculta datos de empresa)
  // El tipo_afiliacion_id puede estar en la raíz de cotizacion O en los detalles del Titular
  const titularDetalle = cotizacion?.detalles?.find(
    d => (d.vinculo || '').toLowerCase().includes('titular')
  ) || cotizacion?.detalles?.[0];
  const esParticular =
    cotizacion?.tipo_afiliacion_id === TIPO_AFILIACION_PARTICULAR_ID ||
    titularDetalle?.tipo_afiliacion_id === TIPO_AFILIACION_PARTICULAR_ID ||
    (cotizacion?.tipo_afiliacion_nombre || cotizacion?.tipo_afiliacion || '')
      .toLowerCase()
      .includes('particular');
  const [errorEdad, setErrorEdad] = useState("");
  const [localidades, setLocalidades] = useState([]);
  const [nombreVendedor, setNombreVendedor] = useState("");
  const [fechaSolicitudError, setFechaSolicitudError] = useState("");
  const [verificandoNumero, setVerificandoNumero] = useState(false);
  const [numeroPolizaEnUso, setNumeroPolizaEnUso] = useState(false);
  const [vigenciaEditadaManualmente, setVigenciaEditadaManualmente] = useState(false);
  const debounceRef = useRef(null);
  const prevMesIngresoRef = useRef(datosPersonales.mes_ingreso || '');
  const autoCalculandoRef = useRef(false);

  // Detectar cuando mes_ingreso se carga externamente (modo edición)
  // Si pasa de vacío a con valor SIN que sea un auto-cálculo → marcar como manual
  useEffect(() => {
    const prev = prevMesIngresoRef.current;
    const curr = datosPersonales.mes_ingreso || '';
    if (!prev && curr && !autoCalculandoRef.current) {
      setVigenciaEditadaManualmente(true);
    }
    prevMesIngresoRef.current = curr;
  }, [datosPersonales.mes_ingreso]);

  // Verificar disponibilidad del número de póliza con debounce
  useEffect(() => {
    const numero = datosPersonales.numero_poliza_vendedor;
    if (!numero || !numero.trim()) {
      setNumeroPolizaEnUso(false);
      setVerificandoNumero(false);
      return;
    }
    setVerificandoNumero(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('cober_token');
        const params = new URLSearchParams({ numero: numero.trim() });
        if (polizaIdActual) params.append('excluir_id', polizaIdActual);
        const res = await axios.get(
          `${API_URL}/polizas/vendedor/verificar-numero-poliza?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNumeroPolizaEnUso(!res.data.disponible);
      } catch {
        setNumeroPolizaEnUso(false);
      } finally {
        setVerificandoNumero(false);
      }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [datosPersonales.numero_poliza_vendedor, polizaIdActual]);

  const normalizarFechaYMD = (fecha) => {
    if (!fecha) return '';
    if (typeof fecha === 'string') {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return '';
  };

  // Helper: obtiene % de promoción desde detalles (prioriza Titular)
  const obtenerPorcentajeDesdeDetalles = (detalles) => {
    if (!Array.isArray(detalles) || detalles.length === 0) return null;
    const preferidos = detalles.filter(d => (d.vinculo || '').toLowerCase() === 'titular');
    const lista = preferidos.length ? preferidos : detalles;
    for (const d of lista) {
      if (d.porcentaje_promocion !== undefined && d.porcentaje_promocion !== null && d.porcentaje_promocion !== '') {
        const num = Number(String(d.porcentaje_promocion).replace(',', '.'));
        if (!Number.isNaN(num)) return num;
      }
      if (typeof d.promocion_aplicada === 'string') {
        const match = d.promocion_aplicada.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (match) {
          const num = parseFloat(match[1].replace(',', '.'));
          if (!Number.isNaN(num)) return num;
        }
      }
    }
    return null;
  };

  // ✅ Función para calcular mes de vigencia según fecha de solicitud
  const calcularMesVigencia = (fechaSolicitud) => {
    const fechaNormalizada = normalizarFechaYMD(fechaSolicitud);
    if (!fechaNormalizada) return '';
    
    try {
      // Asegurarse de que la fecha esté en formato YYYY-MM-DD
      const [anio, mes, dia] = fechaNormalizada.split('-').map(Number);
      if (!anio || !mes || !dia) return '';
      
      // LÓGICA CORRECTA:
      // - Día 1-13: vigencia en el MISMO mes (no suma)
      // - Día 14-31: vigencia en el MES SIGUIENTE (+1 mes)
      let mesVigencia = mes;
      let anioVigencia = anio;
      
      if (dia >= 14) {
        mesVigencia = mes + 1;
        // Si pasa de diciembre, ajustar al año siguiente
        if (mesVigencia > 12) {
          mesVigencia = 1;
          anioVigencia = anio + 1;
        }
      }
      
      const resultado = `${anioVigencia}-${String(mesVigencia).padStart(2, '0')}`;
      console.log(`📅 Cálculo vigencia: Fecha=${fechaNormalizada}, Día=${dia}, Resultado=${resultado}`);
      
      return resultado;
    } catch (error) {
      console.error('Error calculando mes de vigencia:', error);
      return '';
    }
  };

  // ✅ Maneja el cambio de fecha de solicitud
  const handleFechaSolicitudChange = (value) => {
    setFechaSolicitudError('');
    handleChange('fecha_solicitud', value);
    // Solo recalcular vigencia si NO fue editada manualmente
    if (!vigenciaEditadaManualmente) {
      autoCalculandoRef.current = true;
      setVigenciaEditadaManualmente(false);
      const mesVigencia = calcularMesVigencia(value);
      if (mesVigencia) {
        handleChange('mes_ingreso', mesVigencia);
      }
      autoCalculandoRef.current = false;
    }
  };

  // ✅ Maneja el cambio manual de vigencia
  const handleVigenciaChange = (value) => {
    setVigenciaEditadaManualmente(true);
    handleChange('mes_ingreso', value);
  };

  // ✅ Resetear vigencia al valor calculado automáticamente
  const resetearVigencia = () => {
    autoCalculandoRef.current = true;
    setVigenciaEditadaManualmente(false);
    const mesVigencia = calcularMesVigencia(datosPersonales.fecha_solicitud);
    if (mesVigencia) {
      handleChange('mes_ingreso', mesVigencia);
    }
    autoCalculandoRef.current = false;
  };

  // Obtener el nombre del vendedor desde el localStorage/token
  useEffect(() => {
    try {
      const firstName = localStorage.getItem("cober_first_name");
      const lastName = localStorage.getItem("cober_last_name");
      if (firstName && lastName) {
        const nombreCompleto = `${firstName} ${lastName}`;
        setNombreVendedor(nombreCompleto);
        // Auto-completar el campo de asesor si no está lleno
        if (!datosPersonales.asesor || datosPersonales.asesor.trim() === '') {
          handleChange("asesor", nombreCompleto);
        }
      }
    } catch (error) {
      console.log("Error obteniendo nombre del vendedor:", error);
    }
  }, []);

  // ✅ Auto-completar porcentaje de promoción, priorizando el aplicado en detalles
  useEffect(() => {
    const pctDetalles = obtenerPorcentajeDesdeDetalles(cotizacion?.detalles);
    if (pctDetalles !== null) {
      handleChange("porcentaje_promocion", pctDetalles);
      return;
    }
    if (cotizacion?.porcentaje_promocion && !datosPersonales.porcentaje_promocion) {
      handleChange("porcentaje_promocion", cotizacion.porcentaje_promocion);
    }
  }, [cotizacion?.detalles, cotizacion?.porcentaje_promocion]);

  // ✅ Auto-completar forma de pago según el porcentaje de promoción
  useEffect(() => {
    const pct = Number(datosPersonales.porcentaje_promocion);
    if (!pct || datosPersonales.forma_pago) return;
    if (pct === 35) {
      handleChange("forma_pago", "Débito automático de cuenta (CBU)");
    } else if (pct === 50) {
      handleChange("forma_pago", "Débito automático de tarjeta de crédito");
    }
  }, [datosPersonales.porcentaje_promocion]);

  // Función para validar que todos los campos obligatorios estén completos
  const validarCamposCompletos = () => {
    const camposObligatorios = [
      'numero_poliza_vendedor',
      'nombre',
      'apellido',
      'dni',
      'cuil',
      'fecha_nacimiento',
      'sexo',
      'estado_civil',
      'nacionalidad',
      'condicion_iva',
      'tipo_domicilio',
      'direccion',
      'numero',
      'cod_postal',
      'localidad',
      'forma_pago',
      'proximo_periodo_abonar'
    ];

    return camposObligatorios.every(campo => 
      datosPersonales[campo] && datosPersonales[campo].toString().trim() !== ''
    ) && !errorEdad && esPeriodoValido(datosPersonales.proximo_periodo_abonar);
  };

  // Función para verificar si un campo específico está vacío
  const esCampoVacio = (campo) => {
    return !datosPersonales[campo] || datosPersonales[campo].toString().trim() === '';
  };

   useEffect(() => {
    axios.get(`${API_URL}/localidades/buenos-aires`)
      .then(res => setLocalidades(res.data))
      .catch(() => setLocalidades([]));
  }, []);
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // ✅ Establecer fecha de solicitud por defecto (fecha actual)
  useEffect(() => {
    if (!datosPersonales.fecha_solicitud) {
      const hoy = new Date();
      const fechaActual = hoy.toISOString().split('T')[0];
      handleChange('fecha_solicitud', fechaActual);
      // mes_ingreso será calculado por el useEffect que observa fecha_solicitud
    }
  }, []);

  // ✅ Recalcular vigencia automáticamente cuando cambia la fecha de solicitud (solo si no fue editada manualmente)
  useEffect(() => {
    if (datosPersonales.fecha_solicitud && !vigenciaEditadaManualmente) {
      const mesVigencia = calcularMesVigencia(datosPersonales.fecha_solicitud);
      if (mesVigencia && mesVigencia !== datosPersonales.mes_ingreso) {
        handleChange('mes_ingreso', mesVigencia);
      }
    }
  }, [datosPersonales.fecha_solicitud, vigenciaEditadaManualmente]);

  // Calcula la edad a partir de la fecha de nacimiento
  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return "";
    const hoy = new Date();
    const fechaNac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const m = hoy.getMonth() - fechaNac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  };

  // Maneja el cambio de fecha de nacimiento y actualiza la edad
  const handleFechaNacimientoChange = (value) => {
    const edadIngresada = parseInt(datosPersonales.edad, 10);

    // ✅ PERMITE MENORES DE 1 AÑO: permita pasar si edad es 0 o está vacía
    if (!value) {
      setErrorEdad("Ingrese la fecha de nacimiento.");
      handleChange("fecha_nacimiento", value);
      return;
    }

    if (isNaN(edadIngresada) && datosPersonales.edad !== "0" && datosPersonales.edad !== 0) {
      setErrorEdad("Ingrese primero la edad y luego la fecha de nacimiento.");
      handleChange("fecha_nacimiento", value);
      return;
    }

    if (edadIngresada === 0) {
      // Menores de 1 año: acepta cualquier fecha reciente sin validación de rango
      setErrorEdad("");
      handleChange("fecha_nacimiento", value);
      return;
    }

    const hoy = new Date();
    const fechaNac = new Date(value);

    // Rango válido: desde (hoy - edadIngresada - 1 año + 1 día) hasta (hoy - edadIngresada años)
    const desde = new Date(hoy.getFullYear() - edadIngresada - 1, hoy.getMonth(), hoy.getDate() + 1);
    const hasta = new Date(hoy.getFullYear() - edadIngresada, hoy.getMonth(), hoy.getDate());

    if (fechaNac >= desde && fechaNac <= hasta) {
      setErrorEdad("");
      handleChange("fecha_nacimiento", value);
    } else {
      setErrorEdad(
        `La fecha no corresponde a una persona de ${edadIngresada} años. Debe estar entre ${desde.toLocaleDateString()} y ${hasta.toLocaleDateString()}.`
      );
      handleChange("fecha_nacimiento", value);
    }
  };

  return (
    <Container fluid>
      {/* Sección de información de la cotización */}
      {cotizacion && (
        <Card className="mb-6 border-0 shadow-xs bg-muted">
          <Card.Body className="py-4">
            <Row className="items-center">
              <Col md={4}>
                <div className="flex items-center">
                  <ShieldCheck className="me-2 text-primary" size={24} />
                  <div>
                    <h6 className="text-base font-bold leading-tight tracking-tight mb-0 text-primary">Plan Seleccionado</h6>
                    <p className="mb-0 font-bold">{cotizacion.plan_nombre || "Plan no especificado"}</p>
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="flex items-center">
                  <CashCoin className="me-2 text-success" size={24} />
                  <div>
                    <h6 className="text-base font-bold leading-tight tracking-tight mb-0 text-success">Costo Total</h6>
                    <p className="mb-0 font-bold text-[1.25rem] leading-snug">{formatCurrency(cotizacion.total_final)}</p>
                    {cotizacion.total_bruto && cotizacion.total_final < cotizacion.total_bruto && (
                      <small className="text-[0.875em] text-muted-foreground">
                        <del>{formatCurrency(cotizacion.total_bruto)}</del>
                      </small>
                    )}
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="flex items-center">
                  <Gift className="me-2 text-warning" size={24} />
                  <div>
                    <h6 className="text-base font-bold leading-tight tracking-tight mb-0 text-warning">Promoción Vigente</h6>
                    {cotizacion.total_descuento_promocion > 0 ? (
                      <div>
                        <Badge bg="success" className="me-1">
                          Descuento: {formatCurrency(cotizacion.total_descuento_promocion)}
                        </Badge>
                        {cotizacion.detalles && cotizacion.detalles.length > 0 && (
                          <p className="mb-0 text-[0.875em]">
                            {cotizacion.detalles.find(d => d.promocion_aplicada)?.promocion_aplicada || "Promoción aplicada"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge bg="secondary">Sin promoción</Badge>
                    )}
                  </div>
                </div>
              </Col>
            </Row>
            
            {/* Información adicional del grupo familiar */}
            {cotizacion.detalles && cotizacion.detalles.length > 1 && (
              <Alert variant="info" className="mt-4 mb-0">
                <div className="flex items-center">
                  <PersonFill className="me-2" size={16} />
                  <span>
                    <strong>Grupo Familiar:</strong> {cotizacion.detalles.length} integrante{cotizacion.detalles.length > 1 ? 's' : ''} 
                    ({cotizacion.detalles.map(d => d.vinculo === 'matrimonio' ? 'cónyuge' : d.vinculo).join(", ")})
                  </span>
                </div>
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Formulario de datos personales */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="bg-[#e5d6e9] text-white">
          <PersonFill className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Datos Personales del Titular</h6>
        </Card.Header>
        <Card.Body>
          {/* Campo de Número de Póliza del Vendedor */}
          <Row className="[--gx:1rem] [--gy:1rem] mb-6">
            <Col md={12}>
              <div className="relative rounded-md border px-4 py-3 text-sm leading-relaxed border-primary/15 bg-accent/70 text-foreground flex items-center mb-4">
                <FileEarmarkText className="me-2" size={20} />
                <div>
                  <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">Número de Póliza Oficial</h6>
                  <small className="text-[0.875em]">Este será el número de póliza que aparecerá en los documentos oficiales y PDF. Asegúrese de que sea único.</small>
                </div>
              </div>
              <Form.Group>
                <Form.Label>
                  <FileEarmarkText className="me-1" size={16} />
                  Número de Póliza Oficial *
                </Form.Label>
                <div className="relative">
                  <Form.Control
                    value={datosPersonales.numero_poliza_vendedor || ''}
                    onChange={e => handleChange("numero_poliza_vendedor", e.target.value)}
                    required
                    className="h-12 text-lg"
                    placeholder="Ej: POL-2024-001234"
                    isInvalid={esCampoVacio('numero_poliza_vendedor') || numeroPolizaEnUso}
                    style={{
                      fontWeight: '600',
                      fontSize: '1.1rem',
                      color: '#2D3047',
                      borderColor: numeroPolizaEnUso ? '#dc3545' : undefined,
                      paddingRight: verificandoNumero ? '2.5rem' : undefined
                    }}
                  />
                  {verificandoNumero && (
                    <Spinner
                      animation="border"
                      size="sm"
                      className="absolute"
                      style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}
                    />
                  )}
                </div>
                {numeroPolizaEnUso && (
                  <Form.Text className="text-destructive block mt-1">
                    ⚠️ Este número de póliza ya está en uso. Por favor ingresá otro.
                  </Form.Text>
                )}
                {!numeroPolizaEnUso && (
                  <Form.Text className="text-muted-foreground">
                    Este número aparecerá en los documentos oficiales y PDF de la póliza.
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          </Row>

          {/* Datos del Asesor y Período */}
          <Row className="[--gx:1rem] [--gy:1rem] mb-6">
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <PersonFill className="me-1" size={16} />
                  Asesor/Vendedor
                </Form.Label>
                <Form.Control
                  value={datosPersonales.asesor || nombreVendedor || ''}
                  onChange={e => handleChange("asesor", e.target.value)}
                  className="h-12 text-lg"
                  placeholder="Nombre del asesor"
                  style={{
                    fontWeight: '500',
                    backgroundColor: '#f8f9fa',
                  }}
                />
                <Form.Text className="text-muted-foreground">
                  Se auto-completa con tu nombre. Puedes editarlo si es necesario.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <Calendar3 className="me-1" size={16} />
                  Fecha de Solicitud <span className="text-destructive">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={datosPersonales.fecha_solicitud || ''}
                  onChange={(e) => handleFechaSolicitudChange(e.target.value)}
                  className="h-12 text-lg"
                  required
                />
                {fechaSolicitudError && (
                  <Form.Text className="text-destructive block">
                    {fechaSolicitudError}
                  </Form.Text>
                )}
                <Form.Text className="text-info block">
                  📅 Esta fecha aparecerá en el encabezado del PDF. Puedes seleccionar cualquier fecha.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <Calendar3 className="me-1" size={16} />
                  Vigencia a partir de (Mes de Ingreso) <span className="text-destructive">*</span>
                  {vigenciaEditadaManualmente && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-warning text-foreground ms-2" style={{ fontSize: '0.7rem' }}>✏️ Manual</span>
                  )}
                </Form.Label>
                <div className="flex gap-2 items-start">
                  <Form.Control
                    type="month"
                    value={datosPersonales.mes_ingreso || ''}
                    onChange={e => handleVigenciaChange(e.target.value)}
                    className="h-12 text-lg"
                    style={{
                      backgroundColor: vigenciaEditadaManualmente ? '#fff3cd' : '#e3f2fd',
                      fontWeight: 'bold',
                      color: vigenciaEditadaManualmente ? '#664d03' : '#0d47a1',
                      border: vigenciaEditadaManualmente ? '2px solid #ffc107' : '1px solid #ced4da'
                    }}
                  />
                  {vigenciaEditadaManualmente && (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 border-input bg-card text-foreground hover:bg-muted min-h-9 px-3 py-1 text-sm mt-1"
                      onClick={resetearVigencia}
                      title="Volver al cálculo automático"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      ↺ Auto
                    </button>
                  )}
                </div>
                <Form.Text className={vigenciaEditadaManualmente ? 'text-warning block font-bold' : 'text-info block'}>
                  {vigenciaEditadaManualmente
                    ? '✏️ Vigencia editada manualmente. Hacé clic en "↺ Auto" para restaurar el cálculo automático.'
                    : (
                    <>
                      ℹ️ Calculado automáticamente según el día 14:
                      {datosPersonales.fecha_solicitud && (
                        <span className="block font-bold mt-1">
                          {parseInt((normalizarFechaYMD(datosPersonales.fecha_solicitud).split('-')[2] || '0'), 10) >= 14
                            ? '• Del día 14 al fin de mes → Vigencia mes siguiente'
                            : '• Antes del día 14 → Vigencia en el mismo mes'}
                        </span>
                      )}
                    </>
                  )}
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <CashCoin className="me-1" size={16} />
                  Próximo Período a Abonar <span className="text-destructive">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={datosPersonales.proximo_periodo_abonar || ''}
                  onChange={e => handleChange("proximo_periodo_abonar", e.target.value)}
                  onBlur={e => {
                    const corregida = normalizarFechaPeriodo(e.target.value);
                    if (corregida !== e.target.value) handleChange("proximo_periodo_abonar", corregida);
                  }}
                  min={PERIODO_MIN}
                  max={PERIODO_MAX}
                  className="h-12 text-lg"
                  required
                  isInvalid={!esPeriodoValido(datosPersonales.proximo_periodo_abonar)}
                />
                <Form.Control.Feedback type="invalid">
                  {esCampoVacio('proximo_periodo_abonar')
                    ? 'Este campo es obligatorio.'
                    : `Fecha fuera de rango: el año debe estar entre ${PERIODO_MIN.slice(0, 4)} y ${PERIODO_MAX.slice(0, 4)}.`}
                </Form.Control.Feedback>
                <Form.Text className="text-muted-foreground">
                  Selecciona la fecha del próximo período que el afiliado debe abonar.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <Building className="me-1" size={16} />
                  Obra Social
                </Form.Label>
                <Form.Select
                  value={datosPersonales.obra_social || ''}
                  onChange={e => handleChange("obra_social", e.target.value)}
                  className="h-12 text-lg"
                >
                  <option value="">Seleccionar obra social</option>
                  <option value="OSDEPYM">OSDEPYM</option>
                  <option value="OSTVLA">OSTVLA</option>
                  <option value="OSFE">OSFE</option>
                  <option value="Otra">Otra (completar manual)</option>
                </Form.Select>
                <Form.Text className="text-muted-foreground">
                  Selecciona la obra social correspondiente.
                </Form.Text>
              </Form.Group>
            </Col>
            {datosPersonales.obra_social === "Otra" && (
              <Col md={6}>
                <Form.Group>
                  <Form.Label>
                    <Building className="me-1" size={16} />
                    Especificar Obra Social
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={datosPersonales.obra_social_otra || ''}
                    onChange={e => handleChange("obra_social_otra", e.target.value)}
                    className="h-12 text-lg"
                    placeholder="Nombre de la obra social"
                  />
                  <Form.Text className="text-muted-foreground">
                    Completa el nombre de la obra social.
                  </Form.Text>
                </Form.Group>
              </Col>
            )}
            <Col md={5}>
              <Form.Group>
                <Form.Label>
                  <Gift className="me-1" size={16} />
                  Porcentaje de Promoción
                </Form.Label>
                <div className="relative flex w-full items-stretch [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:-ml-px [&>*]:h-12 [&>*]:text-lg">
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={datosPersonales.porcentaje_promocion || ''}
                    onChange={e => handleChange("porcentaje_promocion", e.target.value)}
                    className="h-12 text-lg"
                    placeholder="Ej: %"
                  />
                  <span className="flex shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">%</span>
                </div>
                <Form.Text className="text-muted-foreground">
                  <strong>Campo automático:</strong> Se completa con el porcentaje de la cotización seleccionada.
                  {(datosPersonales?.porcentaje_promocion || cotizacion?.porcentaje_promocion) && (
                    <span className="text-success block mt-1">
                      ✓ Promoción del {datosPersonales?.porcentaje_promocion ?? cotizacion?.porcentaje_promocion}% aplicada
                    </span>
                  )}
                </Form.Text>
                {cotizacion?.total_descuento_promocion > 0 && (
                  <div className="relative rounded-md border border-primary/15 bg-accent/70 text-foreground mt-2 p-2 text-[0.875em]">
                    <Gift size={14} className="me-1" />
                    <strong>Descuento aplicado:</strong> {formatCurrency(cotizacion.total_descuento_promocion)}
                    {(cotizacion?.porcentaje_promocion || datosPersonales.porcentaje_promocion) && (
                      <span className="ms-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-info text-white">
                        {cotizacion?.porcentaje_promocion || datosPersonales.porcentaje_promocion}%
                      </span>
                    )}
                    {cotizacion.detalles && cotizacion.detalles.length > 0 && (
                      <div className="text-muted-foreground text-[0.875em] mt-1">
                        {cotizacion.detalles.find(d => d.promocion_aplicada)?.promocion_aplicada || ""}
                      </div>
                    )}
                  </div>
                )}
              </Form.Group>
            </Col>
            <Col md={7}>
              <Form.Group>
                <Form.Label>
                  <CreditCard className="me-1" size={16} />
                  Forma de Pago *
                </Form.Label>
                <Form.Select
                  value={datosPersonales.forma_pago || ''}
                  onChange={e => handleChange("forma_pago", e.target.value)}
                  className="h-12 text-lg"
                  required
                >
                  <option value="">Seleccionar forma de pago</option>
                  {opcionesFormasPago && opcionesFormasPago.map((forma, index) => (
                    <option key={index} value={forma}>{forma}</option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted-foreground">
                  Selecciona el método de pago preferido para abonar la póliza.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Row className="[--gx:1rem] [--gy:1rem]">
            {!esParticular && (
              <>
                <Col md={12}>
                  <div className="relative rounded-md border px-4 py-3 text-sm leading-relaxed border-border bg-muted text-foreground flex items-center mb-2">
                    <Building className="me-2" size={20} />
                    <div>
                      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-1">Datos de la Empresa</h6>
                      <small className="text-[0.875em]">Estos datos se imprimirán en la sección comercial de la póliza.</small>
                    </div>
                  </div>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Razón Social</Form.Label>
                    <Form.Control
                      value={datosPersonales.empresa_razon_social || ''}
                      onChange={e => handleChange("empresa_razon_social", e.target.value)}
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>CUIT</Form.Label>
                    <Form.Control
                      type="number"
                      inputMode="numeric"
                      value={datosPersonales.empresa_cuit || ''}
                      onChange={e => handleChange("empresa_cuit", e.target.value)}
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Dirección</Form.Label>
                    <Form.Control
                      value={datosPersonales.empresa_direccion || ''}
                      onChange={e => handleChange("empresa_direccion", e.target.value)}
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Código Postal</Form.Label>
                    <Form.Control
                      type="number"
                      inputMode="numeric"
                      value={datosPersonales.empresa_codigo_postal || ''}
                      onChange={e => handleChange("empresa_codigo_postal", e.target.value)}
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Localidad</Form.Label>
                    <Form.Control
                      value={datosPersonales.empresa_localidad || ''}
                      onChange={e => handleChange("empresa_localidad", e.target.value)}
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Teléfono</Form.Label>
                    <Form.Control
                      type="tel"
                      inputMode="tel"
                      value={datosPersonales.empresa_telefono || ''}
                      onChange={e => handleChange("empresa_telefono", e.target.value)}
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>
              </>
            )}

            <Col md={12} className="mt-2 mb-1">
              <div className="border-t pt-2">
                <small className="text-[0.875em] text-muted-foreground font-semibold">Datos del Titular</small>
              </div>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <PersonFill className="me-1" size={16} />
                  Nombre *
                </Form.Label>
                <Form.Control
                  value={datosPersonales.nombre}
                  onChange={e => handleChange("nombre", e.target.value)}
                  required
                  className="h-12 text-lg"
                  isInvalid={esCampoVacio('nombre')}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <PersonFill className="me-1" size={16} />
                  Apellido *
                </Form.Label>
                <Form.Control
                  value={datosPersonales.apellido}
                  onChange={e => handleChange("apellido", e.target.value)}
                  required
                  className="h-12 text-lg"
                  isInvalid={esCampoVacio('apellido')}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>
                  <FileEarmarkText className="me-1" size={16} />
                  DNI *
                </Form.Label>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  value={datosPersonales.dni}
                  onChange={e => handleChange("dni", e.target.value)}
                  required
                  className="h-12 text-lg"
                  isInvalid={esCampoVacio('dni')}
                  placeholder="Ej: 12345678"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>
                  <FileEarmarkText className="me-1" size={16} />
                  CUIL *
                </Form.Label>
                <CuilInput
                  dni={datosPersonales.dni}
                  value={datosPersonales.cuil}
                  onChange={cuil => handleChange("cuil", cuil)}
                  isInvalid={esCampoVacio('cuil')}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>
                  <Calendar3 className="me-1" size={16} />
                  Fecha de Nacimiento *
                </Form.Label>
                <Form.Control
                  type="date"
                  value={datosPersonales.fecha_nacimiento}
                  onChange={e => handleFechaNacimientoChange(e.target.value)}
                  required
                  className="h-12 text-lg"
                  isInvalid={!!errorEdad}
                  max={new Date().toISOString().split("T")[0]} // No permite fechas futuras
                />
                <Form.Control.Feedback type="invalid">
                  {errorEdad}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Edad</Form.Label>
                <Form.Control
                  type={datosPersonales.edad === 0 || datosPersonales.edad === "0" ? "number" : "text"}
                  value={datosPersonales.edad === 0 || datosPersonales.edad === "0" ? "" : datosPersonales.edad}
                  onChange={(e) => handleChange("edad", e.target.value || "0")}
                  disabled={datosPersonales.edad !== 0 && datosPersonales.edad !== "0"}
                  className="h-12 text-lg"
                  placeholder={datosPersonales.edad === 0 || datosPersonales.edad === "0" ? "Menor de 1 año" : ""}
                  min="0"
                  max="120"
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Sexo *</Form.Label>
                <Form.Select
                  value={datosPersonales.sexo}
                  onChange={e => handleChange("sexo", e.target.value)}
                  required
                  className="h-12 text-lg"
                >
                  <option value="">Seleccionar</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  📧 Correo Electrónico
                </Form.Label>
                <Form.Control
                  type="email"
                  value={datosPersonales.email || ''}
                  onChange={e => handleChange("email", e.target.value)}
                  className="h-12 text-lg"
                  placeholder="tu.email@ejemplo.com"
                />
                <Form.Text className="text-muted-foreground text-[0.875em] block mt-1">
                  ✓ Se auto-completa con el correo del prospecto si está disponible
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Estado Civil *</Form.Label>
                <Form.Select
                  value={datosPersonales.estado_civil}
                  onChange={e => handleChange("estado_civil", e.target.value)}
                  required
                  className="h-12 text-lg"
                >
                  <option value="">Seleccionar</option>
                  {opcionesEstadoCivil.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <Flag className="me-1" size={16} />
                  Nacionalidad *
                </Form.Label>
                <Form.Select
                  value={datosPersonales.nacionalidad}
                  onChange={e => handleChange("nacionalidad", e.target.value)}
                  required
                  className="h-12 text-lg"
                >
                  {opcionesNacionalidad.map(nac => (
                    <option key={nac} value={nac}>{nac}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Condición de IVA *</Form.Label>
                <Form.Select
                  value={datosPersonales.condicion_iva}
                  onChange={e => handleChange("condicion_iva", e.target.value)}
                  required
                  className="h-12 text-lg"
                >
                  {opcionesCondicionIVA.map(condicion => (
                    <option key={condicion} value={condicion}>{condicion}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>
                  <Building className="me-1" size={16} />
                  Tipo de Domicilio *
                </Form.Label>
                <Form.Select
                  value={datosPersonales.tipo_domicilio}
                  onChange={e => handleChange("tipo_domicilio", e.target.value)}
                  required
                  className="h-12 text-lg"
                >
                  {opcionesTipoDomicilio.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Calle *</Form.Label>
                <Form.Control
                  value={datosPersonales.direccion}
                  onChange={e => handleChange("direccion", e.target.value)}
                  required
                  className="h-12 text-lg"
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Número *</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  value={datosPersonales.numero}
                  onChange={e => handleChange("numero", e.target.value)}
                  required
                  className="h-12 text-lg"
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Código Postal *</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  value={datosPersonales.cod_postal}
                  onChange={e => handleChange("cod_postal", e.target.value)}
                  required
                  className="h-12 text-lg"
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Localidad *</Form.Label>
                <Form.Select
                  value={datosPersonales.localidad}
                  onChange={e => handleChange("localidad", e.target.value)}
                  required
                  className="h-12 text-lg"
                >
                  <option value="">Selecciona...</option>
                  {localidades.map(loc => (
                    <option key={loc.id} value={loc.nombre}>{loc.nombre}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {/* Mensaje de validación */}
          {!validarCamposCompletos() && (
            <Alert variant="warning" className="mt-4">
              <div className="flex items-center">
                <FileEarmarkText className="me-2" size={16} />
                <span>
                  <strong>Campos incompletos:</strong> Por favor complete todos los campos marcados con (*) para continuar al siguiente paso.
                </span>
              </div>
            </Alert>
          )}
    
        </Card.Body>
      </Card>
    </Container>
  );
};

// Agregar la función de validación como propiedad del componente
PasoDatosPersonales.validarCamposCompletos = (datosPersonales, errorEdad) => {
  const camposObligatorios = [
    'numero_poliza_vendedor',
    'nombre',
    'apellido',
    'dni',
    'cuil',
    'fecha_nacimiento',
    'sexo',
    'estado_civil',
    'nacionalidad',
    'condicion_iva',
    'tipo_domicilio',
    'direccion',
    'numero',
    'cod_postal',
    'localidad',
    'forma_pago',
    'proximo_periodo_abonar'
  ];

  return camposObligatorios.every(campo => 
    datosPersonales[campo] && datosPersonales[campo].toString().trim() !== ''
  ) && !errorEdad && esPeriodoValido(datosPersonales.proximo_periodo_abonar);
};

export default PasoDatosPersonales;