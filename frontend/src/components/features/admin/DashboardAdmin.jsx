import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Alert, Spinner, Nav } from "@/components/compat/bootstrap";
import { SimpleLineChart } from "@/components/app/charts";
import { FaSync, FaChartBar, FaChartLine, FaChartPie, FaHistory, FaUsers, FaFileContract, FaMoneyBillWave, FaExclamationTriangle } from "@/lib/icons";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "https://wspflows.cober.online/api";

export default function DashboardAdmin() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("cober_token");

      const response = await axios.get(`${API_URL}/admin/dashboard/completo`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setDashboardData(response.data.data);
      } else {
        setError("Error al cargar el dashboard");
      }
    } catch (err) {
      console.error("Error al cargar dashboard:", err);
      setError(err.message || "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" className="mb-4" />
          <p className="mb-4">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <strong>Error:</strong> {error}
      </Alert>
    );
  }

  if (!dashboardData) return null;

  const { resumen, actividad, vendedores, tendencia, distribucion, alertas } = dashboardData;

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

  return (
    <Container fluid className="py-6">
      {/* ENCABEZADO */}
      <Row className="mb-6">
        <Col>
          <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-corporate mb-1">Dashboard</h2>
          <p className="mb-4 text-muted-foreground">Vista general del sistema</p>
        </Col>
        <Col xs="auto">
          <Button variant="outline-primary" size="sm" onClick={cargarDashboard}>
            <FaSync className="me-2" />
            Actualizar
          </Button>
        </Col>
      </Row>

      {/* TARJETAS KPI */}
      <Row className="mb-6 [--gx:1rem] [--gy:1rem]">
        <Col xs={12} sm={6} lg={3}>
          <Card className="h-full border-0 shadow-xs">
            <Card.Body>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[0.875em] mb-1">Total Prospectos</p>
                  <h3 className="text-[1.75rem] font-bold leading-tight tracking-tight text-corporate mb-0">{resumen.prospectos?.total_prospectos || 0}</h3>
                  <small className="text-[0.875em] text-muted-foreground">{resumen.prospectos?.prospectos_nuevos || 0} nuevos</small>
                </div>
                <FaChartBar size={30} className="text-success opacity-50" />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ESPACIADOR */}

      {/* MÉTRICA: TENDENCIA DE PROSPECTOS */}
      <Row>
        <Col xs={12}>
          <Card className="shadow-xs">
            <Card.Header className="bg-card">
              <Card.Title className="mb-0 flex items-center gap-2 text-base">
                <FaChartLine className="text-primary" />
                Tendencia de prospectos (últimos 30 días)
              </Card.Title>
            </Card.Header>
            <Card.Body>
              <SimpleLineChart
                data={tendencia || []}
                xKey="fecha"
                height={380}
                series={[
                  { key: "total_prospectos", label: "Total" },
                  { key: "nuevos", label: "Nuevos", color: "var(--success)" },
                  { key: "cerrados", label: "Cerrados", color: "var(--warning)" },
                ]}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
