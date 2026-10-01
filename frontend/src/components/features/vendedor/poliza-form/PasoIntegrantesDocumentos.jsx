import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Card, Row, Col, Form, Button, Alert, Container, Badge, Spinner } from "@/components/compat/bootstrap";
import { API_URL, GECROS_HABILITADO } from "../../../config";
import CuilInput, { normalizarDni } from "./CuilInput";
import {
  ArrowClockwise,
  PeopleFill,
  PersonFill,
  FileEarmarkText,
  Calendar3,
  Flag,
  CloudUploadFill,
  FileEarmarkImageFill,
  FileEarmarkPdfFill,
  CardImage,
  CreditCard2BackFill,
  CheckCircle,
  Trash3Fill,
  PersonCheckFill,
  EnvelopeFill,
  PencilSquare,
  FileEarmarkArrowUp,
  Eye,
  Activity,
  BodyText,
  InfoCircleFill
} from "@/lib/icons";

// ─── Muestra un documento ya subido a la BD con botones Actualizar / Eliminar / Preview ─
const DocumentoExistente = ({ doc, onActualizar, onEliminar, onPreview }) => (
  <div className="border rounded-md p-2 bg-success/10">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 overflow-hidden">
        <CheckCircle className="text-success shrink-0" size={18} />
        <div className="overflow-hidden">
          <div className="font-semibold text-[0.875em] break-words">{doc.nombre_original}</div>
          {doc.fecha_subida && (
            <small className="text-[0.875em] text-muted-foreground">
              {new Date(doc.fecha_subida).toLocaleDateString('es-AR')}
            </small>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {onPreview && (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 border-info bg-card text-info hover:bg-info hover:text-info-foreground min-h-9 text-sm py-0 px-2"
            title="Ver documento"
            onClick={() => onPreview(doc)}
          >
            <Eye size={13} className="me-1" />
            Ver
          </button>
        )}
        {onActualizar && (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 border-warning bg-card text-warning hover:bg-warning hover:text-warning-foreground min-h-9 text-sm py-0 px-2"
            title="Reemplazar archivo"
            onClick={() => onActualizar(doc)}
          >
            <PencilSquare size={13} className="me-1" />
            Actualizar
          </button>
        )}
        {onEliminar && (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 border-destructive bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground min-h-9 text-sm py-0 px-2"
            title="Eliminar documento"
            onClick={() => onEliminar(doc)}
          >
            <Trash3Fill size={13} className="me-1" />
            Eliminar
          </button>
        )}
      </div>
    </div>
  </div>
);

const FileUploadComponent = ({ tipo, label, integranteIndex = null, currentFile, required = true, handleFileUpload, handleRemoveFile }) => {
  const inputId = `file-${tipo}-${integranteIndex ?? 'titular'}`;
  return (
    <div className="mb-4">
      <Form.Label className="font-bold">
        {tipo === 'dni_frente' && <CardImage className="me-1" size={16} />}
        {tipo === 'dni_dorso' && <CreditCard2BackFill className="me-1" size={16} />}
        {tipo === 'recibo_sueldo' && <FileEarmarkPdfFill className="me-1" size={16} />}
        {label} {required && <span className="text-destructive">*</span>}
      </Form.Label>
      {!currentFile ? (
        <div className="border-2 border-dashed border-primary rounded-md p-4 text-center">
          <CloudUploadFill className="text-primary mb-2" size={32} />
          <div>
            <Form.Control
              type="file"
              id={inputId}
              accept={tipo === 'recibo_sueldo' ? '.pdf,image/*' : 'image/*,.pdf'}
              onChange={e => handleFileUpload(tipo, integranteIndex, e.target.files[0])}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 min-h-10 px-4 py-2 text-sm border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => document.getElementById(inputId).click()}
            >
              Seleccionar Archivo
            </button>
          </div>
          <small className="text-[0.875em] text-muted-foreground block mt-1">
            {tipo === 'recibo_sueldo' 
              ? 'Formatos: PDF, JPG, PNG (Máx. 5MB)'
              : 'Formatos: JPG, PNG, PDF (Máx. 5MB)'
            }
          </small>
        </div>
      ) : (
        <div className="border rounded-md p-4 bg-muted">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="text-success me-2" size={20} />
              <div>
                <div className="font-bold">{currentFile.name}</div>
                <small className="text-[0.875em] text-muted-foreground">
                  {(currentFile.size / 1024 / 1024).toFixed(2)} MB
                </small>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 border-destructive bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground min-h-9 px-3 py-1 text-sm"
              onClick={() => handleRemoveFile(tipo, integranteIndex)}
            >
              <Trash3Fill size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Ranura de documento: muestra el existente (BD) o el input de carga ──────
const SlotDocumento = ({
  tipo, label, integranteIndex = null, currentFile, required = true,
  handleFileUpload, handleRemoveFile,
  docExistente, onActualizarDoc, onEliminarDoc, onPreviewDoc,
}) => {
  if (docExistente) {
    return (
      <div className="mb-4">
        <Form.Label className="font-bold flex items-center gap-2">
          {tipo === 'dni_frente' && <CardImage size={16} />}
          {tipo === 'dni_dorso' && <CreditCard2BackFill size={16} />}
          {tipo === 'recibo_sueldo' && <FileEarmarkPdfFill size={16} />}
          {label}
          {required && <span className="text-destructive">*</span>}
          <Badge bg="success" style={{ fontSize: '0.7rem' }}>✓ Cargado</Badge>
        </Form.Label>
        <DocumentoExistente
          doc={docExistente}
          onActualizar={onActualizarDoc}
          onEliminar={onEliminarDoc}
          onPreview={onPreviewDoc}
        />
      </div>
    );
  }
  return (
    <FileUploadComponent
      tipo={tipo}
      label={label}
      integranteIndex={integranteIndex}
      currentFile={currentFile}
      required={required}
      handleFileUpload={handleFileUpload}
      handleRemoveFile={handleRemoveFile}
    />
  );
};

// Consulta automática del estado de afiliación en Gecros al completar el DNI
const DNI_CONSULTABLE = /^\d{7,8}$/;
const GECROS_DEBOUNCE_MS = 600;

// ─── Estado de afiliación en Gecros, debajo del campo DNI ─
const EstadoGecros = ({ dni, gecros, consulta, onConsultar }) => {
  // ⚠️ TEMPORAL (2026-09-21): API de Gecros caída, no se muestra el estado.
  if (!GECROS_HABILITADO) return null;
  if (!DNI_CONSULTABLE.test(dni)) return null;

  if (consulta === 'cargando') {
    return (
      <small className="text-[0.875em] text-muted-foreground flex items-center gap-1 mt-1">
        <Spinner animation="border" size="sm" />
        Consultando Gecros…
      </small>
    );
  }

  if (consulta === 'error') {
    return (
      <small className="text-[0.875em] text-destructive flex items-center gap-1 mt-1">
        No se pudo consultar Gecros
        <Button type="button" variant="link" size="sm" className="p-0" onClick={onConsultar}>
          Reintentar
        </Button>
      </small>
    );
  }

  if (gecros?.dni !== dni) return null;

  const conCobertura = (gecros.estado || '').toLowerCase().startsWith('con cobertura');
  return (
    <div className="flex items-center gap-1 mt-1">
      <Badge
        bg={conCobertura ? 'success' : 'secondary'}
        className="text-wrap text-left"
        title={gecros.consultado_at ? `Consultado el ${new Date(gecros.consultado_at).toLocaleString('es-AR')}` : undefined}
      >
        Gecros: {gecros.estado}
      </Badge>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="p-0"
        title="Volver a consultar en Gecros"
        onClick={onConsultar}
      >
        <ArrowClockwise size={14} />
      </Button>
    </div>
  );
};

// Tipos de documento que corresponden a ranuras fijas del formulario
const TIPOS_SLOT = ['dni_frente', 'dni_dorso', 'recibo_sueldo'];

const TIPO_AFILIACION_PARTICULAR_ID = 1;

const PasoIntegrantesDocumentos = ({
  integrantes,
  documentosTitular,
  datosPersonales,
  cotizacion = null,
  handleIntegranteChange,
  opcionesNacionalidad,
  handleFileUpload,
  handleRemoveFile,
  // Props para peso/altura (datos_fisicos de declaración jurada)
  declaracionJurada = null,
  handleDeclaracionChange = null,
  // Props opcionales para modo edición (documentos ya subidos a la BD)
  documentosExistentes = [],
  onActualizarDoc = null,
  onEliminarDoc = null,
  onPreviewDoc = null,
}) => {
  const [erroresEdad, setErroresEdad] = useState({});
  // Consultas a Gecros en curso o fallidas, por DNI: 'cargando' | 'error'
  const [consultasGecros, setConsultasGecros] = useState({});
  const integrantesRef = useRef(integrantes);
  integrantesRef.current = integrantes;

  const consultarGecros = async (index, dni) => {
    // ⚠️ TEMPORAL (2026-09-21): API de Gecros caída, no se consulta.
    if (!GECROS_HABILITADO) return;
    setConsultasGecros(prev => ({ ...prev, [dni]: 'cargando' }));
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/gecros/consultar/dni/${dni}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!data?.success) throw new Error(data?.message || 'Respuesta inválida de Gecros');
      // Descarta la respuesta si el DNI cambió mientras se consultaba
      if (normalizarDni(integrantesRef.current[index]?.dni) === dni) {
        handleIntegranteChange(index, "gecros", {
          dni,
          estado: data.estado,
          consultado_at: data.consultado_at,
        });
      }
      setConsultasGecros(prev => { const c = { ...prev }; delete c[dni]; return c; });
    } catch (error) {
      console.error('Error al consultar Gecros:', error);
      setConsultasGecros(prev => ({ ...prev, [dni]: 'error' }));
    }
  };

  // Cambia sólo cuando cambia algún DNI o su resultado de Gecros (no con el resto de los campos)
  const claveDnisGecros = integrantes
    .map(i => `${normalizarDni(i.dni)}:${i.gecros?.dni ?? ''}`)
    .join('|');

  useEffect(() => {
    // ⚠️ TEMPORAL (2026-09-21): API de Gecros caída, sin consulta automática.
    if (!GECROS_HABILITADO) return;
    const timers = [];
    integrantes.forEach((integrante, index) => {
      const dni = normalizarDni(integrante.dni);
      // Si cambió el DNI, el resultado guardado corresponde a otra persona
      if (integrante.gecros && integrante.gecros.dni !== dni) {
        handleIntegranteChange(index, "gecros", null);
      }
      if (!DNI_CONSULTABLE.test(dni) || integrante.gecros?.dni === dni || consultasGecros[dni]) return;
      timers.push(setTimeout(() => consultarGecros(index, dni), GECROS_DEBOUNCE_MS));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDnisGecros, consultasGecros]);

  // Detecta si el tipo de afiliación es particular (oculta recibo de sueldo)
  const titularDetalle = cotizacion?.detalles?.find(
    d => (d.vinculo || '').toLowerCase().includes('titular')
  ) || cotizacion?.detalles?.[0];
  const esParticular =
    cotizacion?.tipo_afiliacion_id === TIPO_AFILIACION_PARTICULAR_ID ||
    titularDetalle?.tipo_afiliacion_id === TIPO_AFILIACION_PARTICULAR_ID ||
    (cotizacion?.tipo_afiliacion_nombre || cotizacion?.tipo_afiliacion || '').toLowerCase().includes('particular') ||
    datosPersonales?.tipo_afiliacion_id === TIPO_AFILIACION_PARTICULAR_ID ||
    (datosPersonales?.tipo_afiliacion || '').toLowerCase().includes('particular');

  // Devuelve el documento existente en BD para un tipo + integrante dado, o undefined
  const getDocExistente = (tipo, integranteIndex) => {
    if (!documentosExistentes.length) return undefined;
    return documentosExistentes.find(doc => {
      const tipoOk = doc.tipo_documento === tipo;
      const esNulo = integranteIndex === null;
      const indexOk = esNulo
        ? (doc.integrante_index === null || doc.integrante_index === undefined || doc.integrante_index === '')
        : String(doc.integrante_index) === String(integranteIndex);
      return tipoOk && indexOk;
    });
  };

  // Documentos cargados con tipos fuera de los slots fijos (p.ej. póliza firmada, auditoría…)
  const otrosDocumentos = documentosExistentes.filter(
    doc => !TIPOS_SLOT.includes(doc.tipo_documento)
  );

  // ✅ NUEVA FUNCIÓN: Determinar si un integrante es cónyuge con recibo de sueldo
  const esConyugeConRecibo = (integrante) => {
    if (!integrante) return false;
    
    // Verificar si es cónyuge (diferentes variaciones posibles)
    const esConyuge = integrante.vinculo?.toLowerCase() === 'matrimonio' || 
                      integrante.vinculo?.toLowerCase() === 'cónyuge' ||
                      integrante.vinculo?.toLowerCase().includes('conyugal');
    
    // Verificar si tiene tipo de afiliación con recibo de sueldo
    const tieneReciboSueldo = integrante.tipo_afiliacion_id === 2 || 
                              integrante.tipo_afiliacion?.toLowerCase?.()?.includes('recibo de sueldo') ||
                              integrante.tipo_afiliacion?.toLowerCase?.()?.includes('con recibo');
    
    return esConyuge && tieneReciboSueldo;
  };

  // Copia exacta de la validación de PasoDatosPersonales
  const handleFechaNacimientoChange = (i, value) => {
    const prevAge = integrantes[i].edad    // 1) guardo la edad que estaba
    // 2) actualizo sólo la fecha
    handleIntegranteChange(i, "fecha_nacimiento", value)

    // valido rangos igual que en PasoDatosPersonales
    const edadIngresada = parseInt(prevAge, 10)
    // ✅ PERMITE MENORES DE 1 AÑO: permita pasar si edad es 0 o está vacía
    if (!value) {
      setErroresEdad(prev => ({ 
        ...prev, 
        [i]: "Ingrese la fecha de nacimiento." 
      }))
    } else if (isNaN(edadIngresada) && prevAge !== "0" && prevAge !== 0) {
      setErroresEdad(prev => ({ 
        ...prev, 
        [i]: "Ingrese primero la edad y luego la fecha de nacimiento." 
      }))
    } else if (edadIngresada === 0) {
      // Menores de 1 año: acepta cualquier fecha reciente sin validación de rango
      setErroresEdad(prev => { const e = { ...prev }; delete e[i]; return e })
    } else {
      const hoy = new Date()
      const fechaNac = new Date(value)
      const desde = new Date(hoy.getFullYear() - edadIngresada - 1, hoy.getMonth(), hoy.getDate() + 1)
      const hasta = new Date(hoy.getFullYear() - edadIngresada, hoy.getMonth(), hoy.getDate())
      if (fechaNac >= desde && fechaNac <= hasta) {
        setErroresEdad(prev => { const e = { ...prev }; delete e[i]; return e })
      } else {
        setErroresEdad(prev => ({
          ...prev,
          [i]: `La fecha no corresponde a una persona de ${edadIngresada} años. Debe estar entre ${desde.toLocaleDateString()} y ${hasta.toLocaleDateString()}.`
        }))
      }
    }

    // 3) fuerza que la edad permanezca como antes
    handleIntegranteChange(i, "edad", prevAge)
  };

  return (
    <Container fluid>
      {/* Datos Físicos del Titular e Integrantes */}
      {declaracionJurada && handleDeclaracionChange && (
        <>
          <Card className="mb-6 border-0 shadow-xs">
            <Card.Header className="text-white" style={{ backgroundColor: '#6c757d' }}>
              <Activity className="me-2" size={20} />
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Datos Físicos del Titular</h6>
            </Card.Header>
            <Card.Body>
              <Row className="[--gx:1rem] [--gy:1rem]">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>
                      <BodyText className="me-1" size={16} />
                      Peso (kg) *
                    </Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      min="1"
                      max="300"
                      value={declaracionJurada.datos_fisicos?.titular_peso || ''}
                      onChange={e => handleDeclaracionChange('datos_fisicos', e.target.value, null, 'titular_peso')}
                      placeholder="Ej: 70.5"
                      required
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>
                      <BodyText className="me-1" size={16} />
                      Altura (cm) *
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min="50"
                      max="250"
                      value={declaracionJurada.datos_fisicos?.titular_altura || ''}
                      onChange={e => handleDeclaracionChange('datos_fisicos', e.target.value, null, 'titular_altura')}
                      placeholder="Ej: 175"
                      required
                      className="h-12 text-lg"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <div className="flex items-center h-full">
                    <Alert variant="info" className="mb-0 w-full">
                      <InfoCircleFill className="me-2" size={16} />
                      <strong>Titular:</strong> {datosPersonales.nombre} {datosPersonales.apellido}
                    </Alert>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {integrantes && integrantes.length > 0 && (
            <div className="mb-6">
              <h6 className="mb-4 text-base leading-tight tracking-tight text-corporate font-bold">Datos físicos de integrantes</h6>
              {integrantes.map((integrante, idx) => (
                <Card key={idx} className="mb-4 border-0 bg-muted">
                  <Card.Body className="p-4">
                    <Alert variant="info" className="mb-4">
                      <PersonFill className="me-2" size={16} />
                      <strong>Integrante {idx + 1}:</strong> {integrante.nombre} {integrante.apellido}
                    </Alert>
                    <Row className="[--gx:1rem] [--gy:1rem]">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Peso (kg) *</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            min={0}
                            max="300"
                            value={declaracionJurada.datos_fisicos?.integrantes?.[idx]?.peso || ''}
                            onChange={e =>
                              handleDeclaracionChange(
                                'datos_fisicos',
                                { field: 'peso', value: e.target.value },
                                idx,
                                'integrante'
                              )
                            }
                            placeholder="Ej: 70.5"
                            className="h-12 text-lg"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Altura (cm) *</Form.Label>
                          <Form.Control
                            type="number"
                            min={0}
                            max="250"
                            value={declaracionJurada.datos_fisicos?.integrantes?.[idx]?.altura || ''}
                            onChange={e =>
                              handleDeclaracionChange(
                                'datos_fisicos',
                                { field: 'altura', value: e.target.value },
                                idx,
                                'integrante'
                              )
                            }
                            placeholder="Ej: 170"
                            className="h-12 text-lg"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Sección del Titular */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="bg-[#e5d6e9] text-white">
          <PersonCheckFill className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Documentación del Titular</h6>
          <Badge bg="success" className="ms-2">Titular</Badge>
        </Card.Header>
        <Card.Body>
          <Alert variant="info" className="mb-6">
            <PersonCheckFill className="me-2" size={16} />
            <strong>Titular:</strong> {datosPersonales.nombre} {datosPersonales.apellido} - 
            DNI: <strong>{datosPersonales.dni || "No especificado"}</strong> CUIL: <strong>{datosPersonales.cuil || "No especificado"}</strong> - 
            Edad: {datosPersonales.edad} años
          </Alert>
          
          <h6 className="text-base font-bold leading-tight tracking-tight mb-4 text-primary">Documentación Requerida</h6>
          <Row className="[--gx:1.5rem] [--gy:1.5rem]">
            <Col md={4}>
              <SlotDocumento
                tipo="dni_frente"
                label="DNI Frente"
                integranteIndex={null}
                currentFile={documentosTitular?.dni_frente}
                handleFileUpload={handleFileUpload}
                handleRemoveFile={handleRemoveFile}
                docExistente={getDocExistente('dni_frente', null)}
                onActualizarDoc={onActualizarDoc}
                onEliminarDoc={onEliminarDoc}
                onPreviewDoc={onPreviewDoc}
              />
            </Col>
            <Col md={4}>
              <SlotDocumento
                tipo="dni_dorso"
                label="DNI Dorso"
                integranteIndex={null}
                currentFile={documentosTitular?.dni_dorso}
                handleFileUpload={handleFileUpload}
                handleRemoveFile={handleRemoveFile}
                docExistente={getDocExistente('dni_dorso', null)}
                onActualizarDoc={onActualizarDoc}
                onEliminarDoc={onEliminarDoc}
                onPreviewDoc={onPreviewDoc}
              />
            </Col>
            {(!esParticular || getDocExistente('recibo_sueldo', null)) && (
            <Col md={4}>
              <SlotDocumento
                tipo="recibo_sueldo"
                label="Recibo de Sueldo"
                integranteIndex={null}
                currentFile={documentosTitular?.recibo_sueldo}
                required={false}
                handleFileUpload={handleFileUpload}
                handleRemoveFile={handleRemoveFile}
                docExistente={getDocExistente('recibo_sueldo', null)}
                onActualizarDoc={onActualizarDoc}
                onEliminarDoc={onEliminarDoc}
                onPreviewDoc={onPreviewDoc}
              />
            </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      {/* Sección de Integrantes */}
      {integrantes.length > 0 ? (
        <Card className="border-0 shadow-xs">
          <Card.Header className="bg-[#e5d6e9] text-white">
            <PeopleFill className="me-2" size={20} />
            <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Integrantes del Grupo Familiar</h6>
            <Badge bg="secondary" className="ms-2">
              {integrantes.length} integrante{integrantes.length !== 1 ? 's' : ''}
            </Badge>
          </Card.Header>
          <Card.Body>
            {integrantes.map((integrante, index) => (
              <Card key={index} className="mb-6 border-0 bg-muted">
                <Card.Header className="bg-[#e5d6e9] text-gray-900">
                  <PersonFill className="me-2" size={16} />
                  <strong>Integrante {index + 1}: {integrante.nombre} {integrante.apellido}</strong>
                  <Badge bg="info" className="ms-2">{integrante.vinculo}</Badge>
                </Card.Header>
                <Card.Body>
                  <Row className="[--gx:1rem] [--gy:1rem] mb-6">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nombre *</Form.Label>
                        <Form.Control
                          value={integrante.nombre}
                          onChange={e => handleIntegranteChange(index, "nombre", e.target.value)}
                          required
                          className="h-12 text-lg"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Apellido *</Form.Label>
                        <Form.Control
                          value={integrante.apellido}
                          onChange={e => handleIntegranteChange(index, "apellido", e.target.value)}
                          required
                          className="h-12 text-lg"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>
                          <FileEarmarkText className="me-1" size={16} />
                          DNI *
                        </Form.Label>
                        <Form.Control
                          type="number"
                          value={integrante.dni || ""}
                          onChange={e => handleIntegranteChange(index, "dni", e.target.value)}
                          required
                          className="h-12 text-lg"
                          placeholder="12345678"
                        />
                        <EstadoGecros
                          dni={normalizarDni(integrante.dni)}
                          gecros={integrante.gecros}
                          consulta={consultasGecros[normalizarDni(integrante.dni)]}
                          onConsultar={() => consultarGecros(index, normalizarDni(integrante.dni))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>
                          <FileEarmarkText className="me-1" size={16} />
                          CUIL *
                        </Form.Label>
                        <CuilInput
                          dni={integrante.dni}
                          value={integrante.cuil}
                          onChange={cuil => handleIntegranteChange(index, "cuil", cuil)}
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
                          value={integrante.fecha_nacimiento}
                          onChange={e => handleFechaNacimientoChange(index, e.target.value)}
                          required
                          className="h-12 text-lg"
                          isInvalid={!!erroresEdad[index]}
                          max={new Date().toISOString().split("T")[0]}
                        />
                        <Form.Control.Feedback type="invalid">
                          {erroresEdad[index]}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    {/* CAMBIO: edad siempre editable cuando es menor de 1 año */}
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Edad</Form.Label>
                        <Form.Control
                          type={integrante.edad === 0 || integrante.edad === "0" ? "number" : "text"}
                          value={integrante.edad === 0 || integrante.edad === "0" ? "" : integrante.edad}
                          onChange={(e) => handleIntegranteChange(index, "edad", e.target.value || "0")}
                          disabled={integrante.edad !== 0 && integrante.edad !== "0"}
                          className="h-12 text-lg"
                          placeholder={integrante.edad === 0 || integrante.edad === "0" ? "Menor de 1 año" : ""}
                          min="0"
                          max="120"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group>
                        <Form.Label>Sexo *</Form.Label>
                        <Form.Select
                          value={integrante.sexo}
                          onChange={e => handleIntegranteChange(index, "sexo", e.target.value)}
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
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>
                          <Flag className="me-1" size={16} />
                          Nacionalidad *
                        </Form.Label>
                        <Form.Select
                          value={integrante.nacionalidad}
                          onChange={e => handleIntegranteChange(index, "nacionalidad", e.target.value)}
                          required
                          className="h-12 text-lg"
                        >
                          <option value="">Seleccionar</option>
                          {opcionesNacionalidad.map(nac => (
                            <option key={nac} value={nac}>{nac}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          <EnvelopeFill className="me-1" size={16} />
                          Correo Electrónico
                        </Form.Label>
                        <Form.Control
                          type="email"
                          value={integrante.email || ""}
                          onChange={e => handleIntegranteChange(index, "email", e.target.value)}
                          className="h-12 text-lg"
                          placeholder="correo@ejemplo.com"
                        />
                        <Form.Text className="text-muted-foreground">
                          Correo de contacto del integrante (opcional).
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <h6 className="text-base font-bold leading-tight tracking-tight mb-4 text-primary">Documentación del Integrante</h6>
                  <Row className="[--gx:1.5rem] [--gy:1.5rem]">
                    <Col md={6}>
                      <SlotDocumento
                        tipo="dni_frente"
                        label="DNI Frente"
                        integranteIndex={index}
                        currentFile={integrante.documentos?.dni_frente}
                        handleFileUpload={handleFileUpload}
                        handleRemoveFile={handleRemoveFile}
                        docExistente={getDocExistente('dni_frente', index)}
                        onActualizarDoc={onActualizarDoc}
                        onEliminarDoc={onEliminarDoc}
                        onPreviewDoc={onPreviewDoc}
                      />
                    </Col>
                    <Col md={6}>
                      <SlotDocumento
                        tipo="dni_dorso"
                        label="DNI Dorso"
                        integranteIndex={index}
                        currentFile={integrante.documentos?.dni_dorso}
                        handleFileUpload={handleFileUpload}
                        handleRemoveFile={handleRemoveFile}
                        docExistente={getDocExistente('dni_dorso', index)}
                        onActualizarDoc={onActualizarDoc}
                        onEliminarDoc={onEliminarDoc}
                        onPreviewDoc={onPreviewDoc}
                      />
                    </Col>
                    {/* Recibo de sueldo: si ya hay doc en BD lo muestra; si no, solo si es cónyuge con recibo */}
                    {(getDocExistente('recibo_sueldo', index) || esConyugeConRecibo(integrante)) && (
                      <Col md={6}>
                        <SlotDocumento
                          tipo="recibo_sueldo"
                          label="Recibo de Sueldo"
                          integranteIndex={index}
                          currentFile={integrante.documentos?.recibo_sueldo}
                          required={!getDocExistente('recibo_sueldo', index)}
                          handleFileUpload={handleFileUpload}
                          handleRemoveFile={handleRemoveFile}
                          docExistente={getDocExistente('recibo_sueldo', index)}
                          onActualizarDoc={onActualizarDoc}
                          onEliminarDoc={onEliminarDoc}
                          onPreviewDoc={onPreviewDoc}
                        />
                      </Col>
                    )}
                  </Row>
                </Card.Body>
              </Card>
            ))}
          </Card.Body>
        </Card>
      ) : (
        <Alert variant="info" className="mt-6">
          <PeopleFill className="me-2" size={16} />
          No hay integrantes adicionales en el grupo familiar. Solo se requiere la documentación del titular.
        </Alert>
      )}

      {/* Otros documentos: tipos fuera de los slots fijos (póliza firmada, auditoría, etc.) */}
      {otrosDocumentos.length > 0 && (
        <Card className="mt-6 border-0 shadow-xs">
          <Card.Header className="bg-teal text-white">
            <FileEarmarkArrowUp className="me-2" size={18} />
            <span className="font-semibold">Otros Documentos</span>
            <Badge bg="light" text="dark" className="ms-2">{otrosDocumentos.length}</Badge>
          </Card.Header>
          <Card.Body>
            <Row className="[--gx:1rem] [--gy:1rem]">
              {otrosDocumentos.map(doc => (
                <Col md={6} key={doc.id}>
                  <div className="mb-1">
                    <Form.Label className="font-bold text-[0.875em] mb-1">
                      {doc.observaciones
                        ? doc.observaciones
                        : doc.tipo_documento.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      {doc.integrante_index !== null && doc.integrante_index !== undefined && doc.integrante_index !== '' && (
                        <Badge bg="info" className="ms-2" style={{ fontSize: '0.7rem' }}>
                          Integrante {parseInt(doc.integrante_index) + 1}
                        </Badge>
                      )}
                    </Form.Label>
                    <DocumentoExistente
                      doc={doc}
                      onActualizar={onActualizarDoc}
                      onEliminar={onEliminarDoc}
                      onPreview={onPreviewDoc}
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default PasoIntegrantesDocumentos;