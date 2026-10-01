import { useEffect, useState } from "react";
import { Card, Row, Col, Container, Button, Badge } from "@/components/compat/bootstrap";
import axios from "axios";
import { API_URL } from "../../config";

const TIPO_AFILIACION = {
  1: "Particular/autónomo",
  2: "Con recibo de sueldo",
  3: "Monotributista",
};


const CotizacionesCards = () => {
  const [cotizaciones, setCotizaciones] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/cotizaciones`).then(res => setCotizaciones(res.data));
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <Container className="my-6">
      <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-corporate">Cotizaciones</h4>
      <Row xs={1} md={2} lg={3} className="[--gx:1.5rem] [--gy:1.5rem]">
        {cotizaciones.map(cot => (
          <Col key={cot.id}>
            <Card className="h-full shadow-xs">
              <Card.Header className="bg-primary text-white text-center">
                <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">{cot.plan_nombre}</h5>
              </Card.Header>
              <Card.Body>
                <Card.Title className="text-primary">
                  {cot.prospecto_nombre}
                </Card.Title>
                
                {/* Información financiera */}
                <div className="mb-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Total Bruto:</span>
                    <span className="font-bold">{formatCurrency(cot.total_bruto)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Descuento:</span>
                    <span className="text-warning font-bold">{formatCurrency(cot.descuento_aporte || cot.total_descuento)}</span>
                  </div>
                  <div className="flex justify-between mb-2 border-t pt-1">
                    <span className="font-bold">Total Final:</span>
                    <span className="font-bold text-success text-[1.25rem] leading-snug">{formatCurrency(cot.total_final)}</span>
                  </div>
                </div>

                {/* Información adicional */}
                <div className="mb-4">
                  <div className="mb-2">
                    <small className="text-[0.875em] text-muted-foreground">Fecha:</small>
                    <div>{new Date(cot.fecha).toLocaleDateString()}</div>
                  </div>
                  
                  {/* Mostrar tipo de afiliación si está disponible */}
                  {cot.detalles && cot.detalles.length > 0 && (
                    <div className="mb-2">
                      <small className="text-[0.875em] text-muted-foreground block">Tipo de Afiliación:</small>
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(cot.detalles.map(det => det.tipo_afiliacion_id).filter(Boolean))].map(tipoId => (
                          <Badge key={tipoId} bg="info" className="text-[0.875em]">
                            {TIPO_AFILIACION[tipoId] || `Tipo ${tipoId}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Número de personas cubiertas */}
                  {cot.detalles && cot.detalles.length > 0 && (
                    <div className="mb-2">
                      <small className="text-[0.875em] text-muted-foreground">Personas cubiertas:</small>
                      <div>
                        <Badge bg="secondary">{cot.detalles.length} persona{cot.detalles.length > 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                  )}
                </div>

                <Button size="sm" variant="info" className="w-full">
                  Ver Detalle
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default CotizacionesCards;