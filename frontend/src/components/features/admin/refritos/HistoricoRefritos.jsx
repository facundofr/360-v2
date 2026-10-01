import { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Table,
  Form,
  Button,
  InputGroup,
  Badge
} from "@/components/compat/bootstrap";
import { FaHistory, FaSearch, FaEye, FaSync } from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../../config";

const HistoricoRefritos = ({ refreshTrigger }) => {
  const [refritos, setRefritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    obtenerRefritos();
  }, [refreshTrigger]);

  const obtenerRefritos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");

      // Obtener estadísticas para acceder a los refritos
      const statsResponse = await axios.get(
        `${API_URL}/admin/refritos/estadisticas`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Para este caso, vamos a obtener una lista simulada
      // En una implementación real, tendríamos un endpoint que liste todos los refritos
      const refritosSimulados = [
        {
          id: 1,
          nombre: "Juan",
          apellido: "Pérez",
          numero_contacto: "+541173931525",
          localidad: "Buenos Aires",
          estado: "Lead",
          es_reciclado: true,
          fecha_asignacion: new Date().toISOString()
        }
        // En producción, estos vendrían de la API
      ];

      setRefritos(refritosSimulados);
    } catch (error) {
      console.error("Error al obtener histórico:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar el histórico"
      });
    } finally {
      setLoading(false);
    }
  };

  const verHistorialProspecto = async (prospectoId, nombreProspecto) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/admin/refritos/historial/${prospectoId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const historial = response.data.historial || [];

      let htmlContenido = `
        <div class="text-start">
          <h6>Historial de ${nombreProspecto}</h6>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Estado</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
      `;

      historial.forEach((item) => {
        const fecha = new Date(item.fecha_asignacion).toLocaleDateString("es-AR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });

        htmlContenido += `
          <tr>
            <td><small>${fecha}</small></td>
            <td>${item.vendedor || "N/A"}</td>
            <td>
              <span class="badge bg-${
                item.estado === "Venta"
                  ? "success"
                  : item.estado === "No contesta"
                  ? "danger"
                  : "warning"
              }">
                ${item.estado}
              </span>
            </td>
            <td><small>${item.comentario || "-"}</small></td>
          </tr>
        `;
      });

      htmlContenido += `
            </tbody>
          </table>
        </div>
      `;

      Swal.fire({
        title: `📋 Historial`,
        html: htmlContenido,
        icon: "info",
        width: 800
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo obtener el historial"
      });
    }
  };

  const getEstadoBadge = (estado) => {
    const badgeMap = {
      Lead: "warning",
      "1º Contacto": "info",
      "Calificado Cotización": "info",
      Venta: "success",
      "No contesta": "danger",
      "Dato repetido": "secondary"
    };
    return badgeMap[estado] || "secondary";
  };

  // Filtrar refritos
  const refritosFiltrados = refritos.filter((refrito) => {
    const cumpleBusqueda =
      refrito.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      refrito.apellido.toLowerCase().includes(busqueda.toLowerCase()) ||
      refrito.numero_contacto.includes(busqueda);

    const cumpleFiltro = !filtroEstado || refrito.estado === filtroEstado;

    return cumpleBusqueda && cumpleFiltro;
  });

  if (loading) {
    return (
      <Container className="text-center py-12">
        <Spinner animation="border" role="status">
          <span className="sr-only">Cargando...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="py-6">
      {/* Controles de búsqueda y filtro */}
      <Row className="mb-6">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              placeholder="Buscar por nombre, apellido o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </InputGroup>
        </Col>

        <Col md={3}>
          <Form.Select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="Lead">Lead</option>
            <option value="1º Contacto">1º Contacto</option>
            <option value="Venta">Venta</option>
            <option value="No contesta">No contesta</option>
          </Form.Select>
        </Col>

        <Col md={3}>
          <Button
            variant="outline-secondary"
            onClick={obtenerRefritos}
            disabled={loading}
            className="w-full flex items-center justify-center"
          >
            <FaSync className="me-2" />
            Actualizar
          </Button>
        </Col>
      </Row>

      {/* Tabla de Histórico */}
      <Row>
        <Col>
          <Card className="shadow-xs border-0">
            <Card.Header className="bg-muted border-0">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaHistory className="me-2" />
                Histórico de Refritos
                <span className="ms-2 text-muted-foreground text-[0.875em]">
                  ({refritosFiltrados.length} resultados)
                </span>
              </h5>
            </Card.Header>

            <Card.Body className="p-0">
              {refritosFiltrados && refritosFiltrados.length > 0 ? (
                <Table hover responsive className="mb-0">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left">Prospecto</th>
                      <th className="text-left">Teléfono</th>
                      <th className="text-left">Localidad</th>
                      <th className="text-left">Estado</th>
                      <th className="text-left">Tipo</th>
                      <th className="text-left">Fecha</th>
                      <th className="text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refritosFiltrados.map((refrito) => (
                      <tr key={refrito.id}>
                        <td className="font-bold">
                          {refrito.nombre} {refrito.apellido}
                        </td>
                        <td>
                          <code className="font-mono text-[0.875em] text-destructive">{refrito.numero_contacto}</code>
                        </td>
                        <td>{refrito.localidad}</td>
                        <td>
                          <Badge bg={getEstadoBadge(refrito.estado)}>
                            {refrito.estado}
                          </Badge>
                        </td>
                        <td>
                          {refrito.es_reciclado && (
                            <Badge bg="warning" className="text-foreground">
                              ♻️ Reciclado
                            </Badge>
                          )}
                        </td>
                        <td>
                          <small className="text-[0.875em] text-muted-foreground">
                            {new Date(refrito.fecha_asignacion).toLocaleDateString(
                              "es-AR"
                            )}
                          </small>
                        </td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() =>
                              verHistorialProspecto(
                                refrito.id,
                                `${refrito.nombre} ${refrito.apellido}`
                              )
                            }
                            className="flex items-center"
                          >
                            <FaEye className="me-1" /> Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Alert variant="info" className="m-4 mb-0">
                  {busqueda || filtroEstado
                    ? "No se encontraron refritos con los filtros aplicados."
                    : "No hay refritos aún."}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Información adicional */}
      <Row className="mt-6">
        <Col>
          <Alert variant="light" className="border-0">
            <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2">ℹ️ Información de Estados:</h6>
            <small className="text-[0.875em]">
              <ul className="list-disc pl-8 mb-0">
                <li>
                  <Badge bg="warning" className="me-2">
                    Lead
                  </Badge>
                  Prospecto pendiente de contacto
                </li>
                <li>
                  <Badge bg="info" className="me-2">
                    1º Contacto
                  </Badge>
                  Se estableció contacto inicial
                </li>
                <li>
                  <Badge bg="success" className="me-2">
                    Venta
                  </Badge>
                  Venta concretada
                </li>
                <li>
                  <Badge bg="danger" className="me-2">
                    No contesta
                  </Badge>
                  Sin contacto después de intentos
                </li>
              </ul>
            </small>
          </Alert>
        </Col>
      </Row>
    </Container>
  );
};

export default HistoricoRefritos;
