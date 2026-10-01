import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { InfoIcon } from "lucide-react";
import { Card, Row, Col, Alert, Badge, Table, Button, Spinner, Form, InputGroup } from "@/components/compat/bootstrap";
import {
  PersonFill,
  ShieldCheck,
  FileEarmarkText,
  CheckCircleFill,
  Download,
  Send,
  Whatsapp,
  Envelope
} from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../../config";


const PasoResumen = ({
  form,
  cotizacion,
  prospecto,
  aceptaTerminos,
  setAceptaTerminos,
  onPolizaCreada
}) => {
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [polizaGenerada, setPolizaGenerada] = useState(null);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // ✅ NUEVA: Función para calcular IMC
  const calcularIMC = (peso, altura) => {
    if (!peso || !altura) return null;
    const alturaEnMetros = altura / 100;
    return (peso / (alturaEnMetros * alturaEnMetros)).toFixed(1);
  };

  // ✅ NUEVA: Función para verificar si requiere auditoría médica
  const verificarRequiereAuditoria = () => {
    // Condición 1: IMC elevado
    const imcTitular = calcularIMC(
      form.declaracion_jurada?.datos_fisicos?.titular_peso,
      form.declaracion_jurada?.datos_fisicos?.titular_altura
    );
    
    const imcIntegrantes = (form.declaracion_jurada?.datos_fisicos?.integrantes || []).map(integrante =>
      calcularIMC(integrante.peso, integrante.altura)
    );

    const tieneIMCElevado = (imcTitular && imcTitular > 30) || 
                            imcIntegrantes.some(imc => imc && imc > 30);

    // Condición 2: Respuestas afirmativas en CUALQUIERA de los niveles
    // ✅ CORREGIDO: Verificar también saludTerminos.respuestas de TODOS los integrantes
    const tieneRespuestasAfirmativasDeclaracion = form.declaracion_jurada?.preguntas?.some(p => p.respuesta === 'si') ||
                                                  (form.declaracion_jurada?.enfermedades_seleccionadas?.length || 0) > 0;
    
    // Buscar respuestas SÍ en el cuestionario de salud por integrante
    const tieneRespuestasAfirmativasSalud = Object.values(form.saludTerminos?.respuestas || {}).some(respuestasIntegrante => {
      return Object.values(respuestasIntegrante).some(respuesta => respuesta?.respuesta === 'si');
    });
    
    console.log('🏥 Auditoría médica - Verificación:', {
      tieneIMCElevado,
      tieneRespuestasAfirmativasDeclaracion,
      tieneRespuestasAfirmativasSalud
    });

    return tieneIMCElevado || tieneRespuestasAfirmativasDeclaracion || tieneRespuestasAfirmativasSalud;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Un valor negativo en descuento_promocion representa una promoción de tipo
  // "incremento" (suma al precio en lugar de restar).
  const getInfoPromocion = (valor) => {
    const num = parseFloat(valor || 0);
    const esIncremento = num < 0;
    return {
      esIncremento,
      monto: esIncremento ? `+ ${formatCurrency(Math.abs(num))}` : formatCurrency(num),
      label: esIncremento ? 'Incremento' : 'Descuento Promoción',
      textClass: esIncremento ? 'text-destructive' : 'text-success',
    };
  };

  const handleGenerarPoliza = async () => {
    if (!aceptaTerminos) {
      Swal.fire({
        title: 'Términos no aceptados',
        text: 'Debe aceptar los términos y condiciones para continuar',
        icon: 'warning'
      });
      return;
    }

    setEnviando(true);

    try {
      // ✅ MAPEAR DATOS FÍSICOS CORRECTAMENTE
      const integrantesConDatosFisicos = form.integrantes.map((integrante, index) => {
        const datosFisicos = form.declaracion_jurada?.datos_fisicos?.integrantes?.[index] || {};
        
        return {
          ...integrante,
          // ✅ SOLO USAR peso Y altura (sin duplicados)
          peso: datosFisicos.peso || '',
          altura: datosFisicos.altura || ''
        };
      });

      // ✅ AGREGAR: Debug completo de saludTerminos
      console.log('🔍 DEBUG - saludTerminos completo:', form.saludTerminos);
      console.log('🔍 DEBUG - medicacion:', form.saludTerminos?.medicacion);
      console.log('🔍 DEBUG - coberturaAnterior:', form.saludTerminos?.coberturaAnterior);

      // ✅ CALCULAR: Si requiere auditoría médica
      const requiereAuditoriaMedica = verificarRequiereAuditoria();
      console.log('🏥 Requiere auditoría médica:', requiereAuditoriaMedica);

      // ✅ CORREGIDO: Incluir saludTerminos en el envío
      const formCompleto = {
        ...form,
        integrantes: integrantesConDatosFisicos,
        datos_personales: {
          ...form.datos_personales,
          peso: form.declaracion_jurada?.datos_fisicos?.titular_peso || '',
          altura: form.declaracion_jurada?.datos_fisicos?.titular_altura || ''
        },
        declaracion_jurada: {
          ...form.declaracion_jurada,
          datos_fisicos: {
            titular_peso: form.declaracion_jurada?.datos_fisicos?.titular_peso || '',
            titular_altura: form.declaracion_jurada?.datos_fisicos?.titular_altura || '',
            integrantes: form.declaracion_jurada?.datos_fisicos?.integrantes || []
          },
          requiere_auditoria_medica: requiereAuditoriaMedica // ✅ NUEVO: Incluir flag
        },
        // ✅ AGREGAR: saludTerminos completo
        saludTerminos: {
          respuestas: form.saludTerminos?.respuestas || {},
          coberturaAnterior: form.saludTerminos?.coberturaAnterior || {
            cobertura: 'Sin cobertura anterior',
            fecha_desde: '',
            fecha_hasta: ''
          },
          medicacion: form.saludTerminos?.medicacion || {
            detalle: 'Ninguna'
          },
          datosAdicionales: form.saludTerminos?.datosAdicionales || {}
        }
      };

      // ✅ DEBUG: Verificar que saludTerminos se incluya
      console.log('📤 ENVIANDO - formCompleto con saludTerminos:', {
        tiene_saludTerminos: !!formCompleto.saludTerminos,
        medicacion: formCompleto.saludTerminos?.medicacion,
        cobertura: formCompleto.saludTerminos?.coberturaAnterior
      });

      const token = localStorage.getItem("cober_token");
      // 1. Crear la póliza definitiva (con datos físicos mapeados)
      const response = await axios.post(
        `${API_URL}/polizas`,
        {
          prospecto_id: prospecto.id,
          cotizacion_id: cotizacion.id,
          form: formCompleto, // ✅ Ahora incluye saludTerminos
          detalles: cotizacion.detalles || [] // Asegurarse de enviar los detalles del plan
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const polizaId = response.data.data.id;

      // 2. Subir documentos del titular
      for (const tipo of ['dni_frente', 'dni_dorso', 'recibo_sueldo']) {
        const file = form.documentos_titular[tipo];
        if (file) {
          const formData = new FormData();
          formData.append('documento', file);
          formData.append('poliza_id', polizaId);
          formData.append('tipo_documento', tipo);
          
          await axios.post(
            `${API_URL}/poliza-documentos/upload`,
            formData,
            { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              },
              timeout: 60000 // 60 segundos de timeout
            }
          );
        }
      }

      // 3. Subir documentos de integrantes
      for (let i = 0; i < form.integrantes.length; i++) {
        for (const tipo of ['dni_frente', 'dni_dorso', 'recibo_sueldo']) {
          const file = form.integrantes[i].documentos?.[tipo];
          if (file) {
            const formData = new FormData();
            formData.append('documento', file);
            formData.append('poliza_id', polizaId);
            formData.append('tipo_documento', tipo);
            formData.append('integrante_index', i);
            await axios.post(
              `${API_URL}/poliza-documentos/upload`,
              formData,
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }
        }
      }

      setPolizaGenerada(response.data.data);

      // ✅ IMPORTANTE: Llamar al callback ANTES del modal de éxito
      console.log('🔄 Llamando a onPolizaCreada con:', response.data.data);
      onPolizaCreada?.(response.data.data);

      // Modal simplificado con número de póliza oficial
      const numeroPolizaOficial = form.datos_personales?.numero_poliza_vendedor || response.data.data.numero_poliza;
      const esNumeroOficial = !!form.datos_personales?.numero_poliza_vendedor;
      
      await Swal.fire({
        title: '¡Póliza generada correctamente!',
        html: `
          <div class="text-center">
            <div class="mb-3">
              <i class="fas fa-check-circle text-success" style="font-size: 3rem;"></i>
            </div>
            <p><strong>Número de Póliza ${esNumeroOficial ? 'Oficial' : ''}:</strong></p>
            <p class="h5 text-primary mb-2">${numeroPolizaOficial}</p>
            ${esNumeroOficial ? 
              '<p class="text-muted small mb-3">(Número asignado por el vendedor)</p>' : 
              '<p class="text-muted small mb-3">(Número generado automáticamente)</p>'
            }
            <p class="text-muted mb-3">Su póliza ha sido generada exitosamente.</p>
            <div class="alert alert-info">
              
              <strong>Serás redirigido a "Mis Pólizas" automáticamente.</strong>
            </div>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#28a745'
      });

      // Redirigir a la sección de pólizas después de cerrar el modal
      navigate('/prospectos', { state: { vista: 'polizas' } });

    } catch (error) {
      console.error('Error generando póliza:', error);
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || 'Error al generar la póliza',
        icon: 'error'
      });
    } finally {
      setEnviando(false);
    }
  };

  const descargarPDF = async (polizaId) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/polizas/${polizaId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `poliza-${polizaGenerada?.numero_poliza || polizaId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error descargando PDF:', error);
      Swal.fire('Error', 'Error al descargar el PDF', 'error');
    }
  };

  const enviarPorWhatsApp = async (polizaData) => {
    // Obtener el número telefónico desde el formulario
    const telefonoInicial = form.datos_personales.telefono || 
                           form.datos_personales.celular || 
                           '';
    
    // Mostrar SweetAlert con el campo para editar
    const { value: telefono, dismiss } = await Swal.fire({
      title: 'Enviar por WhatsApp',
      html: `
        <div class="mb-3">
          <label for="swal-input-telefono" class="form-label">Número de teléfono (con código de país)</label>
          <input 
            id="swal-input-telefono" 
            class="swal2-input" 
            placeholder="Ej: +5491123456789" 
            value="${telefonoInicial}" 
          />
        </div>
        <p class="text-muted small">
          Formato recomendado: +549XXXXXXXXXX (para Argentina)<br>
          Se enviará un enlace para descargar la póliza
        </p>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        // Asegurarse que el campo tenga el foco para facilitar la edición
        const input = document.getElementById('swal-input-telefono');
        input.focus();
        // Posicionar el cursor al final del texto
        input.setSelectionRange(input.value.length, input.value.length);
      },
      preConfirm: () => {
        const tel = document.getElementById('swal-input-telefono').value.trim();
        
        // Validaciones
        if (!tel) {
          Swal.showValidationMessage('Por favor ingrese un número de teléfono');
          return false;
        }
        
        // Validar formato (básico)
        const telLimpio = tel.replace(/\s+/g, '');
        if (telLimpio.length < 8) {
          Swal.showValidationMessage('El número parece ser demasiado corto');
          return false;
        }
        
        return telLimpio; // Devolver el número sin espacios
      }
    });

    if (!telefono || dismiss === Swal.DismissReason.cancel) {
      return; // El usuario canceló o no hay teléfono
    }

    setEnviandoWhatsApp(true);
    try {
      const token = localStorage.getItem("cober_token");
      await axios.post(
        `${API_URL}/polizas/${polizaData.id}/enviar-whatsapp`,
        { telefono },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        title: '¡Enviado!',
        text: 'La póliza ha sido enviada por WhatsApp exitosamente',
        icon: 'success'
      });
    } catch (error) {
      console.error('Error enviando por WhatsApp:', error);
      
      // Mensaje de error más informativo
      let mensajeError = 'Error al enviar por WhatsApp';
      if (error.response?.data?.message) {
        mensajeError = error.response.data.message;
      } else if (error.response?.status === 503) {
        mensajeError = 'El servicio de WhatsApp no está disponible en este momento';
      }
      
      Swal.fire('Error', mensajeError, 'error');
    } finally {
      setEnviandoWhatsApp(false);
    }
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

  const enviarPorEmail = async (polizaData) => {
    const { value: email } = await Swal.fire({
      title: 'Enviar por Email',
      html: `
        <div class="mb-3">
          <label for="swal-input-email" class="form-label">Dirección de email</label>
          <input id="swal-input-email" class="swal2-input" type="email" placeholder="ejemplo@email.com" value="${maskEmail(form.datos_personales.email || '')}" />
          <small class="text-muted">Ingrese el email completo del destinatario</small>
        </div>
        <p class="text-muted small">Se enviará la póliza como archivo adjunto</p>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const emailValue = document.getElementById('swal-input-email').value;
        if (!emailValue) {
          Swal.showValidationMessage('Por favor ingrese un email');
          return false;
        }
        if (!/\S+@\S+\.\S+/.test(emailValue)) {
          Swal.showValidationMessage('Por favor ingrese un email válido');
          return false;
        }
        return emailValue;
      }
    });

    if (email) {
      setEnviandoEmail(true);
      try {
        const token = localStorage.getItem("cober_token");
        await axios.post(
          `${API_URL}/polizas/${polizaData.id}/enviar-email`,
          { email },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        Swal.fire({
          title: '¡Enviado!',
          text: 'La póliza ha sido enviada por email exitosamente',
          icon: 'success'
        });
      } catch (error) {
        console.error('Error enviando por email:', error);
        Swal.fire('Error', 'Error al enviar por email', 'error');
      } finally {
        setEnviandoEmail(false);
      }
    }
  };

  return (
    <div>
      <Alert variant="info" className="mb-6">
        <CheckCircleFill className="me-2" size={16} />
        <strong>Resumen de la Solicitud:</strong> Revise cuidadosamente toda la información antes de generar la póliza.
      </Alert>

      {/* Información del Plan */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="text-white">
          <ShieldCheck className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Plan Seleccionado</h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-primary">{cotizacion.plan_nombre}</h5>
              <p className="mb-2"><strong>Grupo Familiar:</strong> {cotizacion.detalles?.length || 0} integrante(s)</p>
              <p className="mb-0"><strong>Tipo de Afiliación:</strong> {form.datos_personales.tipo_afiliacion}</p>
            </Col>
            <Col md={6} className="text-right">
              <div className="bg-muted p-4 rounded-md">
                <div className="mb-2">
                  <small className="text-[0.875em] text-muted-foreground">Total Bruto:</small>
                  <div className="text-muted-foreground">{formatCurrency(cotizacion.total_bruto)}</div>
                </div>
                {parseFloat(cotizacion.total_descuento_promocion || 0) !== 0 && (
                  <div className="mb-2">
                    <small className={cn("text-[0.875em]", getInfoPromocion(cotizacion.total_descuento_promocion).textClass)}>
                      {getInfoPromocion(cotizacion.total_descuento_promocion).label}:
                    </small>
                    <div className={getInfoPromocion(cotizacion.total_descuento_promocion).textClass}>
                      {getInfoPromocion(cotizacion.total_descuento_promocion).monto}
                    </div>
                  </div>
                )}
                <hr className="border-t border-border my-2" />
                <div>
                  <strong className="text-success">Total Final:</strong>
                  <div className="text-[1.125rem] font-bold leading-snug text-success mb-0">{formatCurrency(cotizacion.total_final)}</div>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Datos del Titular */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="text-white">
          <PersonFill className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Datos del Titular</h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <p className="mb-4"><strong>Nombre completo:</strong> {form.datos_personales.nombre} {form.datos_personales.apellido}</p>
              <p className="mb-4"><strong>DNI:</strong> {form.datos_personales.dni}</p>
              <p className="mb-4"><strong>CUIL:</strong> {form.datos_personales.cuil}</p>
              <p className="mb-4"><strong>Fecha de nacimiento:</strong> {form.datos_personales.fecha_nacimiento}</p>
              <p className="mb-4"><strong>Edad:</strong> {form.datos_personales.edad} años</p>
              <p className="mb-4"><strong>Sexo:</strong> {form.datos_personales.sexo}</p>
            </Col>
            <Col md={6}>
              <p className="mb-4"><strong>Email:</strong> {form.datos_personales.email}</p>
              <p className="mb-4"><strong>Teléfono:</strong> {form.datos_personales.telefono}</p>
              <p className="mb-4"><strong>Estado civil:</strong> {form.datos_personales.estado_civil}</p>
              <p className="mb-4"><strong>Nacionalidad:</strong> {form.datos_personales.nacionalidad}</p>
              <p className="mb-4"><strong>Condición IVA:</strong> {form.datos_personales.condicion_iva}</p>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Integrantes del Grupo Familiar */}
      {form.integrantes && form.integrantes.length > 0 && (
        <Card className="mb-6 border-0 shadow-xs">
          <Card.Header className="text-white">
            <PersonFill className="me-2" size={20} />
            <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Integrantes del Grupo Familiar</h6>
            <Badge bg="light" text="dark" className="ms-2">
              {form.integrantes.length} integrante(s)
            </Badge>
          </Card.Header>
          <Card.Body>
            <Table responsive striped>
              <thead>
                <tr>
                  <th className="text-left">Nombre</th>
                  <th className="text-left">Vínculo</th>
                  <th className="text-left">DNI</th>
                  <th className="text-left">Edad</th>
                  <th className="text-left">Sexo</th>
                </tr>
              </thead>
              <tbody>
                {form.integrantes.map((integrante, index) => (
                  <tr key={index}>
                    <td>{integrante.nombre} {integrante.apellido}</td>
                    <td>{integrante.vinculo}</td>
                    <td>{integrante.dni}</td>
                    <td>{integrante.edad} años</td>
                    <td>{integrante.sexo}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Documentación */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="text-foreground">
          <FileEarmarkText className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Documentación Adjunta</h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Documentos del Titular:</h6>
              <ul className="mb-4 list-none pl-0">
                <li className={form.documentos_titular?.dni_frente ? 'text-success' : 'text-destructive'}>
                  {form.documentos_titular?.dni_frente ? '✓' : '✗'} DNI Frente
                </li>
                <li className={form.documentos_titular?.dni_dorso ? 'text-success' : 'text-destructive'}>
                  {form.documentos_titular?.dni_dorso ? '✓' : '✗'} DNI Dorso
                </li>
                <li className={form.documentos_titular?.recibo_sueldo ? 'text-success' : 'text-muted-foreground'}>
                  {form.documentos_titular?.recibo_sueldo ? '✓' : '○'} Recibo de Sueldo (opcional)
                </li>
              </ul>
            </Col>
            <Col md={6}>
              <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Referencias Personales:</h6>
              {form.referencias?.map((ref, index) => (
                <p key={index} className="mb-1">
                  <strong>{ref.nombre}</strong> - {ref.relacion} ({ref.telefono})
                </p>
              ))}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Detalle de la Cotización */}
      {cotizacion.detalles && cotizacion.detalles.length > 0 && (
        <Card className="mb-6 border-0 shadow-xs">
          <Card.Header className="text-foreground">
            <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">Detalle de la Cotización</h6>
          </Card.Header>
          <Card.Body>
            <Table responsive striped>
              <thead>
                <tr>
                  <th className="text-left">Persona</th>
                  <th className="text-left">Vínculo</th>
                  <th className="text-left">Edad</th>
                  <th className="text-left">Base</th>
                  <th className="text-left">Desc. Aporte</th>
                  <th className="text-left">Desc. Promoción</th>
                  <th className="text-left">Promoción</th>
                  <th className="text-left">Final</th>
                </tr>
              </thead>
              <tbody>
                {cotizacion.detalles.map((detalle, idx) => (
                  <tr key={detalle.id || idx}>
                    <td>{detalle.persona}</td>
                    <td>{detalle.vinculo}</td>
                    <td>{detalle.edad}</td>
                    <td>{formatCurrency(detalle.precio_base)}</td>
                    <td>
                      {formatCurrency(detalle.descuento_aporte)}
                    </td>
                    <td className={getInfoPromocion(detalle.descuento_promocion).textClass}>
                      {getInfoPromocion(detalle.descuento_promocion).monto}
                    </td>
                    <td>
                      {detalle.promocion_aplicada
                        ? <Badge bg={getInfoPromocion(detalle.descuento_promocion).esIncremento ? 'danger' : 'warning'} text={getInfoPromocion(detalle.descuento_promocion).esIncremento ? undefined : 'dark'}>{detalle.promocion_aplicada}</Badge>
                        : <span className="text-muted-foreground text-[0.875em]">Sin promoción</span>}
                    </td>
                    <td className="font-bold text-success">
                      {formatCurrency(detalle.precio_final)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Declaración de Salud */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="text-white">
          <FileEarmarkText className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Declaración Jurada de Salud</h6>
        </Card.Header>
        <Card.Body>
          {/* Resumen por Integrante */}
          {Object.entries(form.saludTerminos?.respuestas || {}).map(([integranteIndex, respuestasIntegrante]) => {
            const respuestasAfirmativas = Object.entries(respuestasIntegrante || {})
              .filter(([key, valor]) => valor?.respuesta === 'si')
              .map(([key, valor]) => ({ key, ...valor }));

            const coberturaIntegrante = form.saludTerminos?.coberturaAnterior?.[integranteIndex];
            const medicacionIntegrante = form.saludTerminos?.medicacion?.[integranteIndex];

            // Obtener fecha de última menstruación si aplica
            const ultimaMenstruacion = respuestasIntegrante?.ultima_menstruacion?.respuesta;
            
            // Obtener presión arterial si fue completada
            const presionArterial = respuestasIntegrante?.presion_arterial;

            // Obtener nombre del integrante
            const nombreIntegrante = integranteIndex === '0' 
              ? `${form.datos_personales?.nombre} ${form.datos_personales?.apellido} (Titular)`
              : form.integrantes?.[parseInt(integranteIndex) - 1]
                ? `${form.integrantes[parseInt(integranteIndex) - 1]?.nombre} ${form.integrantes[parseInt(integranteIndex) - 1]?.apellido}`
                : `Integrante ${integranteIndex}`;

            return (
              <div key={integranteIndex} className="mb-6 pb-6 border-b">
                <h6 className="text-base font-bold leading-tight tracking-tight text-primary mb-4">
                  <PersonFill className="me-2" size={16} />
                  {nombreIntegrante}
                </h6>

                {/* Datos Especiales (Menstruación y Presión Arterial) */}
                {(ultimaMenstruacion || (presionArterial && presionArterial.detalle)) && (
                  <div className="mb-4 p-4 bg-info/10 rounded-md border border-info">
                    <strong className="text-info">Datos de Salud:</strong>
                    <ul className="list-disc pl-8 mt-2 mb-0 ps-6">
                      {ultimaMenstruacion && (
                        <li><strong>Última menstruación:</strong> {ultimaMenstruacion}</li>
                      )}
                      {presionArterial && presionArterial.detalle && (
                        <li><strong>Presión arterial:</strong> {presionArterial.detalle}</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preguntas Afirmativas */}
                {respuestasAfirmativas.length > 0 && (
                  <div className="mb-4">
                    <strong className="text-destructive">Respuestas Afirmativas ({respuestasAfirmativas.length}):</strong>
                    <ul className="list-disc pl-8 mt-2 mb-0 ps-6">
                      {respuestasAfirmativas.map((item, idx) => (
                        <li key={idx} className="mb-2">
                          <strong>{item.key}:</strong> {item.detalle || '(sin detalle)'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cobertura Anterior */}
                {coberturaIntegrante && coberturaIntegrante.cobertura !== 'Sin cobertura anterior' && (
                  <div className="mb-4 p-4 bg-muted rounded-md">
                    <strong>Cobertura Anterior:</strong>
                    <ul className="list-disc pl-8 mt-2 mb-0 ps-6">
                      <li><strong>Plan:</strong> {coberturaIntegrante.cobertura}</li>
                      {coberturaIntegrante.fecha_desde && (
                        <li><strong>Desde:</strong> {coberturaIntegrante.fecha_desde}</li>
                      )}
                      {coberturaIntegrante.fecha_hasta && (
                        <li><strong>Hasta:</strong> {coberturaIntegrante.fecha_hasta}</li>
                      )}
                      {coberturaIntegrante.motivo_baja && (
                        <li><strong>Motivo de baja:</strong> {coberturaIntegrante.motivo_baja}</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Medicación */}
                {medicacionIntegrante && medicacionIntegrante.detalle && medicacionIntegrante.detalle !== 'Ninguna' && (
                  <div className="mb-4 p-4 bg-muted rounded-md">
                    <strong>Medicación:</strong>
                    <p className="mb-0 mt-2">{medicacionIntegrante.detalle}</p>
                  </div>
                )}

                {/* Sin respuestas afirmativas */}
                {respuestasAfirmativas.length === 0 && 
                  (!coberturaIntegrante || coberturaIntegrante.cobertura === 'Sin cobertura anterior') &&
                  (!medicacionIntegrante || medicacionIntegrante.detalle === 'Ninguna') &&
                  !ultimaMenstruacion && !(presionArterial && presionArterial.detalle) && (
                  <Alert variant="info" className="mb-0">
                    <small className="text-[0.875em]">No hay respuestas afirmativas registradas para este integrante</small>
                  </Alert>
                )}
              </div>
            );
          })}

          {/* Resumen General */}
          <div className="mt-6 pt-4 border-t">
            <Row>
              <Col md={4}>
                <p className="mb-1"><strong>Total de preguntas respondidas:</strong></p>
                <p className="mb-4 text-[1.125rem] font-bold leading-snug text-corporate">{
                  form.saludTerminos?.respuestas ? 
                    Object.values(form.saludTerminos.respuestas).reduce((total, integranteRespuestas) => {
                      return total + Object.keys(integranteRespuestas || {}).length;
                    }, 0) : 0
                }</p>
              </Col>
              <Col md={4}>
                <p className="mb-1"><strong>Respuestas afirmativas:</strong></p>
                <p className="mb-4 text-[1.125rem] font-bold leading-snug text-corporate">{
                  form.saludTerminos?.respuestas ? 
                    Object.values(form.saludTerminos.respuestas).reduce((total, integranteRespuestas) => {
                      return total + Object.values(integranteRespuestas || {}).filter(r => r.respuesta === 'si').length;
                    }, 0) : 0
                }</p>
              </Col>
              <Col md={4}>
                <p className="mb-1"><strong>Requiere Auditoría Médica:</strong></p>
                <p className={cn("mb-4", `text-[1.125rem] font-bold leading-snug text-corporate ${verificarRequiereAuditoria() ? 'text-warning' : 'text-success'}`)}>
                  {verificarRequiereAuditoria() ? '⚠️ Sí' : '✓ No'}
                </p>
              </Col>
            </Row>
          </div>
        </Card.Body>
      </Card>

      {/* Términos y Condiciones */}
      <Card className="mb-6 border-0 shadow-xs">
        <Card.Header className="text-white">
          <CheckCircleFill className="me-2" size={20} />
          <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Términos y Condiciones</h6>
        </Card.Header>
        <Card.Body>
          <div className="flex items-start gap-2">
            <input
              className="peer mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
              type="checkbox"
              id="terminos-finales"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
            />
            <label className="inline-block cursor-pointer text-sm leading-snug" htmlFor="terminos-finales">
              <strong>Acepto los términos y condiciones</strong>
            </label>
          </div>
          <div className="mt-4 p-4 bg-muted rounded-md">
            <small className="text-[0.875em] text-muted-foreground">
              <strong>Declaro bajo juramento que:</strong>
              <ul className="list-disc pl-8 mt-2 mb-0">
                <li>Entendí cada una de las preguntas y contesté con absoluta verdad.</li>
                <li>No omití información ni falseé su contenido.</li>
                <li>Asumo responsabilidad por el contenido de las respuestas brindadas.</li>
                <li>Entiendo que la aprobación queda sujeta al análisis de la Auditoría Médica.</li>
              </ul>
            </small>
          </div>
        </Card.Body>
      </Card>

      {/* Botón de Generar Póliza */}
      <div className="text-center">
        {!polizaGenerada ? (
          <Button
            variant="success"
            size="lg"
            onClick={handleGenerarPoliza}
            disabled={!aceptaTerminos || enviando}
            className="px-12"
          >
            {enviando ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Generando Póliza...
              </>
            ) : (
              <>
                <Send className="me-2" size={20} />
                Generar Póliza Final
              </>
            )}
          </Button>
        ) : (
          <div>
            <Alert variant="success" className="mb-4">
              <CheckCircleFill className="me-2" size={16} />
              <strong>¡Póliza generada correctamente!</strong>
              <br />
              Número de Póliza {form.datos_personales?.numero_poliza_vendedor ? 'Oficial' : ''}: <strong>{form.datos_personales?.numero_poliza_vendedor || polizaGenerada.numero_poliza}</strong>
              {form.datos_personales?.numero_poliza_vendedor && (
                <small className="text-[0.875em] block text-muted-foreground">(Número asignado por el vendedor)</small>
              )}
            </Alert>
            
            <Alert variant="info" className="text-center">
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2">
                <InfoIcon className="me-2 inline size-4" />
                Póliza Lista
              </h6>
              <p className="mb-0">
                Ve a la sección <strong>"Mis Pólizas"</strong> para poder descargar o enviar por WhatsApp.
              </p>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasoResumen;