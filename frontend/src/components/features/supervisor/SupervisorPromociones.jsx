import { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Card, Button, Table, Badge, Form, InputGroup, Spinner, Alert } from "@/components/compat/bootstrap";
import axios from "axios";
import { FaSync, FaSearch } from "@/lib/icons";
import { API_URL } from "../../config";

const estadoBadge = (activa) => (
  <Badge bg={activa ? "success" : "secondary"}>{activa ? "Activa" : "Inactiva"}</Badge>
);

const tipoBadge = (tipo) => (
  <Badge bg={tipo === "incremento" ? "warning" : "info"} text={tipo === "incremento" ? "dark" : undefined}>
    {tipo === "incremento" ? "Incremento" : "Descuento"}
  </Badge>
);

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  try {
    return new Date(fecha).toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return fecha;
  }
};

const initialForm = {
  id: null,
  nombre: "",
  descripcion: "",
  descuento_porcentaje: 0,
  activa: true,
};

const SupervisorPromociones = () => {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloActivas, setSoloActivas] = useState(true);

  useEffect(() => {
    fetchPromociones();
  }, []);

  const fetchPromociones = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/supervisor/promociones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPromociones(data || []);
      setError("");
    } catch (err) {
      console.error("Error al obtener promociones", err);
      setError(err.response?.data?.message || "No se pudieron cargar las promociones.");
    } finally {
      setLoading(false);
    }
  };

  const promocionesFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return promociones
      .filter((p) => !soloActivas || p.activa)
      .filter(
        (p) =>
          !term ||
          p.nombre?.toLowerCase().includes(term) ||
          p.descripcion?.toLowerCase().includes(term) ||
          String(p.descuento_porcentaje).includes(term)
      )
      .sort((a, b) => b.id - a.id);
  }, [promociones, busqueda, soloActivas]);

  return (
    <Container fluid className="p-6">
      <Row className="[--gx:1rem] [--gy:1rem] h-full">
        <Col xs={12} className="flex flex-col">
          <Card className="shadow-xs h-full flex flex-col">
            <Card.Header className="flex justify-between items-center">
              <div>
                <Card.Title as="h5" className="mb-0">Promociones</Card.Title>
                <Card.Subtitle className="text-muted-foreground">Vista de lectura - Información de promociones activas</Card.Subtitle>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline-secondary" size="sm" onClick={fetchPromociones} disabled={loading}>
                  <FaSync className={loading ? "animate-spin" : ""} />
                </Button>
              </div>
            </Card.Header>

            <Card.Body className="grow flex flex-col">
              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
              <Alert variant="info" className="mb-4">
                <strong>Modo Lectura:</strong> Puedes visualizar todas las promociones disponibles.
              </Alert>

              <Row className="items-center mb-4 [--gx:0.5rem] [--gy:0.5rem]">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control
                      placeholder="Buscar por nombre, descripción o porcentaje"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={3} className="flex items-center gap-2">
                  <Form.Check
                    type="switch"
                    id="solo-activas"
                    label="Solo activas"
                    checked={soloActivas}
                    onChange={(e) => setSoloActivas(e.target.checked)}
                  />
                </Col>
              </Row>

              {loading ? (
                <div className="flex justify-center items-center grow">
                  <div className="text-center">
                    <Spinner animation="border" variant="primary" className="mb-4" />
                    <p className="mb-4 text-muted-foreground">Cargando promociones...</p>
                  </div>
                </div>
              ) : (
                <div className="w-full overflow-x-auto grow">
                  <Table hover className="align-middle mb-0">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left">ID</th>
                        <th className="text-left">Nombre</th>
                        <th className="text-left">Descripción</th>
                        <th className="text-center">Tipo</th>
                        <th className="text-center">Porcentaje</th>
                        <th className="text-center">Estado</th>
                        <th className="text-left">Creación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promocionesFiltradas.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-muted-foreground">
                            <p className="mb-0">No hay promociones para mostrar</p>
                          </td>
                        </tr>
                      )}
                      {promocionesFiltradas.map((promo) => (
                        <tr key={promo.id}>
                          <td>{promo.id}</td>
                          <td className="font-semibold">{promo.nombre}</td>
                          <td className="text-muted-foreground" style={{ maxWidth: 320 }}>{promo.descripcion}</td>
                          <td className="text-center">{tipoBadge(promo.tipo)}</td>
                          <td className="text-center font-semibold">
                            {promo.tipo === "incremento" ? "+" : "-"}{promo.descuento_porcentaje}%
                          </td>
                          <td className="text-center">{estadoBadge(promo.activa)}</td>
                          <td>{formatearFecha(promo.fecha_creacion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default SupervisorPromociones;
