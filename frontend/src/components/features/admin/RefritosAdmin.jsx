import { useState, useEffect } from "react";
import { Container, Row, Col, Nav, Tab, Card, Spinner, Alert } from "@/components/compat/bootstrap";
import { FaEgg, FaUpload, FaChartBar, FaHistory } from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";
import CargarRefritos from "./refritos/CargarRefritos";
import EstadisticasRefritos from "./refritos/EstadisticasRefritos";
import HistoricoRefritos from "./refritos/HistoricoRefritos";

const RefritosAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("cargar");
  const [estadisticas, setEstadisticas] = useState(null);
  const [refreshStats, setRefreshStats] = useState(0);

  useEffect(() => {
    obtenerEstadisticas();
  }, [refreshStats]);

  const obtenerEstadisticas = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/refritos/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstadisticas(response.data.estadisticas);
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
    }
  };

  const handleRefreshStats = () => {
    setRefreshStats(prev => prev + 1);
  };

  return (
    <Container fluid className="py-6">
      <Row className="mb-6">
        <Col>
          <div className="mb-4">
            <h1 className="mb-4 text-[2.5rem] font-bold leading-tight tracking-tight text-corporate">Módulo Refritos - Campaña de Reciclado</h1>
          </div>
          <p className="mb-4 text-muted-foreground">
            Carga y distribuye prospectos reciclados entre vendedores. Los refritos se reasignan 
            automáticamente cuando se marcan como "No contesta".
          </p>
        </Col>
      </Row>

      {/* Cards de Estadísticas Rápidas */}
      {estadisticas && (
        <Row className="mb-6">
          <Col md={3} className="mb-4">
            <Card className="text-center border-0 shadow-xs">
              <Card.Body>
                <h5 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Total Refritos</h5>
                <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-primary">{estadisticas.total_refritos}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="text-center border-0 shadow-xs">
              <Card.Body>
                <h5 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Pendientes</h5>
                <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-warning">{estadisticas.pendientes}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="text-center border-0 shadow-xs">
              <Card.Body>
                <h5 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Contactados</h5>
                <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-info">{estadisticas.contactados}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="text-center border-0 shadow-xs">
              <Card.Body>
                <h5 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Ventas</h5>
                <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-success">{estadisticas.ventas}</h2>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Tabs */}
      <Card className="shadow-xs">
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Card.Header className="border-0">
            <Nav variant="pills" className="flex-row">
              <Nav.Item>
                <Nav.Link eventKey="cargar" className="flex items-center">
                  <FaUpload className="me-2" />
                  Cargar Archivo
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="estadisticas" className="flex items-center">
                  <FaChartBar className="me-2" />
                  Estadísticas
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="historico" className="flex items-center">
                  <FaHistory className="me-2" />
                  Histórico
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>

          <Card.Body>
            <Tab.Content>
              <Tab.Pane eventKey="cargar">
                <CargarRefritos onSuccess={handleRefreshStats} />
              </Tab.Pane>
              <Tab.Pane eventKey="estadisticas">
                <EstadisticasRefritos refreshTrigger={refreshStats} />
              </Tab.Pane>
              <Tab.Pane eventKey="historico">
                <HistoricoRefritos refreshTrigger={refreshStats} />
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Tab.Container>
      </Card>
    </Container>
  );
};

export default RefritosAdmin;
