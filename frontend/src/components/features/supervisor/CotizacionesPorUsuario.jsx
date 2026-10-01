import { useEffect, useState } from "react";
import { Table, Button, Modal, Badge, Spinner, Card, Row, Col } from "@/components/compat/bootstrap";
import { FaEye, FaWhatsapp } from "@/lib/icons";
import axios from "axios";
import { API_URL } from "../../config";

const TIPO_AFILIACION = {
  1: "Particular/autónomo",
  2: "Con recibo de sueldo",
  3: "Monotributista",
};


const PLAN_COLORS = {
  "Plan Oro": "warning",
  "Plan Plata": "secondary",
  "Plan Bronce": "info",
};

const getPlanColorClass = (planNombre) => {
  if (!planNombre) return "bg-primary";
  const nombre = planNombre.toLowerCase();
  if (nombre.includes("classic")) return "bg-primary";
  if (nombre.includes("taylored")) return "bg-success";
  if (nombre.includes("wagon")) return "bg-warning";
  if (nombre.includes("cober x")) return "bg-danger";
  return "bg-primary";
};

const CotizacionesPorUsuario = () => {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cotizacionesUsuario, setCotizacionesUsuario] = useState([]);
  const [usuarioNombre, setUsuarioNombre] = useState("");
  const [showDetallesCotizacion, setShowDetallesCotizacion] = useState({});

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
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

  const toggleDetallesCotizacion = (index) => {
    setShowDetallesCotizacion(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  useEffect(() => {
    axios.get(`${API_URL}/cotizaciones/todas`)
      .then(res => setCotizaciones(res.data))
      .catch(error => {
        console.error("Error al cargar cotizaciones:", error);
        setCotizaciones([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Agrupa cotizaciones por prospecto_id para mostrar el nombre del prospecto
  const cotizacionesPorProspecto = cotizaciones.reduce((acc, cot) => {
    if (!acc[cot.prospecto_id]) {
      acc[cot.prospecto_id] = {
        prospecto_nombre: cot.prospecto_nombre || 'Sin nombre',
        cotizaciones: []
      };
    }
    acc[cot.prospecto_id].cotizaciones.push(cot);
    return acc;
  }, {});

  const handleVerMas = (prospecto_id, prospecto_nombre) => {
    setCotizacionesUsuario(cotizacionesPorProspecto[prospecto_id].cotizaciones);
    setUsuarioNombre(prospecto_nombre);
    setShowDetallesCotizacion({}); // Reset details visibility
    setModalOpen(true);
  };

  if (loading) {
    return <div className="text-center my-12"><Spinner animation="border" /></div>;
  }

  return (
    <>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th className="text-left">Prospecto</th>
            <th className="text-left">Ver Cotizaciones</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(cotizacionesPorProspecto).map(([prospecto_id, data]) => (
            <tr key={prospecto_id}>
              <td>{data.prospecto_nombre}</td>
              <td>
                <Button size="sm" variant="primary" onClick={() => handleVerMas(prospecto_id, data.prospecto_nombre)}>
                  Ver más detalles ({data.cotizaciones.length})
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={modalOpen} onHide={() => setModalOpen(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Cotizaciones de {usuarioNombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cotizacionesUsuario.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">Sin cotizaciones disponibles</div>
          ) : (
            <div className="gap-4">
              {cotizacionesUsuario.map((cotizacion, index) => (
                <Card key={cotizacion.id} className="mb-6 shadow-xs border-0">
                  <Card.Header className={`flex justify-between items-center text-white ${getPlanColorClass(cotizacion.plan_nombre)}`}>
                    <div>
                      <h6 className="text-base leading-tight tracking-tight text-corporate mb-0 font-bold">{cotizacion.plan_nombre}</h6>
                      <small className="text-[0.875em] text-black/50">Año: {cotizacion.anio || new Date().getFullYear()}</small>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[1.25rem] leading-snug text-success">{formatCurrency(cotizacion.total_final)}</span>
                      <br />
                      <small className="text-[0.875em] text-black/50">Total Final</small>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <Row className="mb-2">
                      <Col xs={6} md={3}>
                        <div className="text-muted-foreground text-[0.875em]">Bruto</div>
                        <div className="font-bold text-info">{formatCurrency(cotizacion.total_bruto)}</div>
                      </Col>
                      <Col xs={6} md={3}>
                        {(() => {
                          const ajuste = getInfoPromocion(parseFloat(cotizacion.total_descuento_aporte || 0) + parseFloat(cotizacion.total_descuento_promocion || 0));
                          return (
                            <>
                              <div className="text-muted-foreground text-[0.875em]">{ajuste.esIncremento ? 'Incremento' : 'Descuento'}</div>
                              <div className={`font-bold ${ajuste.textClass}`}>{ajuste.monto}</div>
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
                        <div className="font-bold">{new Date(cotizacion.fecha).toLocaleDateString()}</div>
                      </Col>
                    </Row>
                    <div className="flex gap-2 mb-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => toggleDetallesCotizacion(index)}
                      >
                        <FaEye className="me-1" />
                        {showDetallesCotizacion[index] ? 'Ocultar' : 'Ver'} Detalles
                      </Button>
                    </div>
                    {showDetallesCotizacion[index] && (
                      <div className="mt-4 border-t pt-4">
                        {cotizacion.detalles && cotizacion.detalles.length > 0 ? (
                          <Table size="sm" responsive className="mb-0 [&_tbody_tr:nth-child(odd)]:bg-muted/40 align-middle">
                            <thead>
                              <tr>
                                <th className="text-left">Persona</th>
                                <th className="text-left">Vínculo</th>
                                <th className="text-left">Edad</th>
                                <th className="text-left">Tipo Afiliación</th>
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
                                  <td>{TIPO_AFILIACION[detalle.tipo_afiliacion_id] || detalle.tipo_afiliacion || 'No especificado'}</td>
                                  <td>{formatCurrency(detalle.precio_base)}</td>
                                  <td>
                                    {formatCurrency(detalle.descuento_aporte)}
                                    {parseFloat(detalle.descuento_aporte || 0) > 0 && (
                                      <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-info ms-1 text-white">Aporte</span>
                                    )}
                                  </td>
                                  <td>
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
                                  <td>
                                    {detalle.promocion_aplicada
                                      ? <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${getInfoPromocion(detalle.descuento_promocion).badgeClass}`}>{detalle.promocion_aplicada}</span>
                                      : <span className="text-muted-foreground text-[0.875em]">Sin promoción</span>
                                    }
                                  </td>
                                  <td className="font-bold text-success">{formatCurrency(detalle.precio_final)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        ) : (
                          <div className="text-muted-foreground">Sin detalles disponibles</div>
                        )}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CotizacionesPorUsuario;