import React from "react";
import { Card, Row, Col, Form, Button, Alert, Badge } from "@/components/compat/bootstrap";
import {
  PeopleFill,
  Person,
  Telephone,
  InfoCircleFill,
  Trash3Fill,
  PersonPlus,
  CheckCircleFill
} from "@/lib/icons";

const PasoReferencias = ({
  referencias,
  handleReferenciaChange,
  agregarReferencia,
  eliminarReferencia
}) => (
  <Card className="border-0 shadow-xs">
    <Card.Header className="bg-[#e5d6e9] text-white">
      <PeopleFill className="me-2" size={20} />
      <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 inline">Referencias Personales</h6>
      <Badge bg="secondary" className="ms-2">
        {referencias.length} / 3
      </Badge>
    </Card.Header>
    <Card.Body>
      <Alert variant="info" className="mb-6">
        <InfoCircleFill className="me-2" size={16} />
        <strong>Para tu historia clínica:</strong> Vamos a necesitar que nos des 3 referencias de contacto en caso que sea necesario hacerlo.
      </Alert>

      {referencias.map((referencia, index) => (
        <Card key={index} className="mb-4 border-0 bg-muted">
          <Card.Header className="bg-teal text-white flex justify-between items-center">
            <span>
              <Person className="me-2" size={16} />
              Referencia {index + 1}
            </span>
            {referencias.length > 1 && (
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => eliminarReferencia(index)}
              >
                <Trash3Fill size={14} />
              </Button>
            )}
          </Card.Header>
          <Card.Body>
            <Row className="[--gx:1rem] [--gy:1rem]">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>
                    <Person className="me-1" size={16} />
                    Nombre y Apellido *
                  </Form.Label>
                  <Form.Control
                    value={referencia.nombre}
                    onChange={e => handleReferenciaChange(index, "nombre", e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    required
                    className="h-12 text-lg"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Relación *</Form.Label>
                  <Form.Select
                    value={referencia.relacion}
                    onChange={e => handleReferenciaChange(index, "relacion", e.target.value)}
                    required
                    className="h-12 text-lg"
                  >
                    <option value="">Seleccionar relación</option>
                    <option value="Familiar">Familiar</option>
                    <option value="Amigo/a">Amigo/a</option>
                    <option value="Compañero/a de trabajo">Compañero/a de trabajo</option>
                    <option value="Vecino/a">Vecino/a</option>
                    <option value="Conocido/a">Conocido/a</option>
                    <option value="Otro">Otro</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>
                    <Telephone className="me-1" size={16} />
                    Teléfono de Contacto *
                  </Form.Label>
                  <Form.Control
                    value={referencia.telefono}
                    onChange={e => handleReferenciaChange(index, "telefono", e.target.value)}
                    placeholder="Ej: +54 9 11 1234-5678"
                    required
                    className="h-12 text-lg"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}

      {referencias.length < 3 && (
        <div className="text-center mt-6">
          <Button
            variant="outline-primary"
            onClick={agregarReferencia}
            size="lg"
          >
            <PersonPlus className="me-2" size={16} />
            Agregar otra referencia
          </Button>
        </div>
      )}

      {referencias.length === 3 && (
        <Alert variant="success" className="mt-4">
          <CheckCircleFill className="me-2" size={16} />
          Has completado las 3 referencias requeridas. Puedes continuar al siguiente paso.
        </Alert>
      )}
    </Card.Body>
  </Card>
);

export default PasoReferencias;