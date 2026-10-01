import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from '@/components/compat/bootstrap';
import { SimpleBarChart, SimpleLineChart, SimplePieChart } from '@/components/app/charts';
import { FaChartLine, FaClock, FaUsers, FaVenusMars, FaCalendarAlt, FaSyncAlt } from '@/lib/icons';
import axios from 'axios';
import { API_URL } from '../../config.js';

const MetricasAvanzadas = () => {
  // Estados para los datos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metricas, setMetricas] = useState({
    leadsPorHora: [],
    leadsPorEdad: [],
    leadsPorSexo: [],
    leadsPorDia: [],
    resumen: {}
  });

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    fecha_desde: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Últimos 30 días
    fecha_hasta: new Date().toISOString().split('T')[0],
    vendedor_id: '',
    supervisor_id: ''
  });

  const [vendedores, setVendedores] = useState([]);
  const [supervisores, setSupervisores] = useState([]);

  useEffect(() => {
    cargarDatos();
    cargarVendedores();
    cargarSupervisores();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/admin/metricas-avanzadas`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filtros
      });

      if (response.data.success) {
        setMetricas(response.data.data);
      } else {
        setError('Error al cargar las métricas');
      }
    } catch (error) {
      console.error('Error cargando métricas:', error);
      setError('Error al cargar las métricas: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const cargarVendedores = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/admin/vendedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendedores(response.data.vendedores || []);
    } catch (error) {
      console.error('Error cargando vendedores:', error);
    }
  };

  const cargarSupervisores = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/admin/supervisores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSupervisores(response.data.supervisores || []);
    } catch (error) {
      console.error('Error cargando supervisores:', error);
    }
  };

  const aplicarFiltros = () => {
    cargarDatos();
  };

  const limpiarFiltros = () => {
    setFiltros({
      fecha_desde: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      fecha_hasta: new Date().toISOString().split('T')[0],
      vendedor_id: '',
      supervisor_id: ''
    });
  };

  // Preparar datos para gráficos
  const prepararDatosHoras = () => {
    if (!metricas.leadsPorHora || metricas.leadsPorHora.length === 0) {
      return { horas: [], datos: [] };
    }

    const horas = metricas.leadsPorHora.map(item => `${item.hora}:00`);
    const datos = metricas.leadsPorHora.map(item => parseInt(item.total_leads));

    return { horas, datos };
  };

  const prepararDatosEdad = () => {
    if (!metricas.leadsPorEdad || metricas.leadsPorEdad.length === 0) {
      return { rangos: [], datos: [] };
    }

    const rangos = metricas.leadsPorEdad.map(item => item.rango_edad);
    const datos = metricas.leadsPorEdad.map(item => parseInt(item.total_leads));

    return { rangos, datos };
  };

  const prepararDatosSexo = () => {
    if (!metricas.leadsPorSexo || metricas.leadsPorSexo.length === 0) {
      return [];
    }

    return metricas.leadsPorSexo.map((item, index) => ({
      id: index,
      value: parseInt(item.total_leads),
      label: item.sexo === 'M' ? 'Masculino' : item.sexo === 'F' ? 'Femenino' : 'No especificado'
    }));
  };

  const prepararDatosDias = () => {
    if (!metricas.leadsPorDia || metricas.leadsPorDia.length === 0) {
      return { fechas: [], datos: [] };
    }

    const fechas = metricas.leadsPorDia.map(item => {
      const fecha = new Date(item.fecha);
      return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    });
    const datos = metricas.leadsPorDia.map(item => parseInt(item.total_leads));

    return { fechas, datos };
  };

  if (loading) {
    return (
      <Container fluid>
        <div className="flex justify-center items-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <Spinner animation="border" role="status" variant="primary" />
            <div className="mt-2">Cargando métricas...</div>
          </div>
        </div>
      </Container>
    );
  }

  const { horas, datos: datosHoras } = prepararDatosHoras();
  const { rangos, datos: datosEdad } = prepararDatosEdad();
  const datosSexo = prepararDatosSexo();
  const { fechas, datos: datosDias } = prepararDatosDias();

  return (
    <Container fluid>
      {/* Header */}
      <Row className="mb-6">
        <Col xs={12}>
          <Card className="shadow-xs">
            <Card.Header>
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0 flex items-center gap-2">
                <FaChartLine className="text-primary" />
                Métricas Avanzadas de Leads
              </h5>
            </Card.Header>
            <Card.Body>
              {/* Filtros */}
              <Row className="mb-4">
                <Col md={3}>
                  <Form.Label>Fecha desde</Form.Label>
                  <Form.Control
                    type="date"
                    value={filtros.fecha_desde}
                    onChange={(e) => setFiltros({...filtros, fecha_desde: e.target.value})}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label>Fecha hasta</Form.Label>
                  <Form.Control
                    type="date"
                    value={filtros.fecha_hasta}
                    onChange={(e) => setFiltros({...filtros, fecha_hasta: e.target.value})}
                  />
                </Col>
                <Col md={2}>
                  <Form.Label>Vendedor</Form.Label>
                  <Form.Select
                    value={filtros.vendedor_id}
                    onChange={(e) => setFiltros({...filtros, vendedor_id: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {vendedores.map(vendedor => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.first_name} {vendedor.last_name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Label>Supervisor</Form.Label>
                  <Form.Select
                    value={filtros.supervisor_id}
                    onChange={(e) => setFiltros({...filtros, supervisor_id: e.target.value})}
                  >
                    <option value="">Todos</option>
                    {supervisores.map(supervisor => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.first_name} {supervisor.last_name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2} className="flex items-end gap-2">
                  <Button variant="primary" onClick={aplicarFiltros}>
                    <FaSyncAlt className="me-1" />
                    Aplicar
                  </Button>
                  <Button variant="outline-secondary" onClick={limpiarFiltros}>
                    Limpiar
                  </Button>
                </Col>
              </Row>

              {/* Resumen */}
              {metricas.resumen && (
                <Row className="mb-4">
                  <Col sm={3}>
                    <div className="h-full rounded-xl border bg-card p-4 text-center">
                      <div className="text-3xl font-bold tabular-nums text-primary">{metricas.resumen.total_leads || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Leads</div>
                    </div>
                  </Col>
                  <Col sm={3}>
                    <div className="h-full rounded-xl border bg-card p-4 text-center">
                      <div className="text-3xl font-bold tabular-nums text-success">{metricas.resumen.leads_convertidos || 0}</div>
                      <div className="text-sm text-muted-foreground">Convertidos ({((metricas.resumen.leads_convertidos / metricas.resumen.total_leads) * 100 || 0).toFixed(1)}%)</div>
                    </div>
                  </Col>
                  <Col sm={3}>
                    <div className="h-full rounded-xl border bg-card p-4 text-center">
                      <div className="text-3xl font-bold tabular-nums text-info">{metricas.resumen.hora_pico || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">Hora Pico</div>
                    </div>
                  </Col>
                  <Col sm={3}>
                    <div className="h-full rounded-xl border bg-card p-4 text-center">
                      <div className="text-3xl font-bold tabular-nums text-warning">{metricas.resumen.edad_promedio || 0}</div>
                      <div className="text-sm text-muted-foreground">Edad Promedio</div>
                    </div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {error && (
        <Row className="mb-6">
          <Col xs={12}>
            <Alert variant="danger">
              {error}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Gráficos */}
      <Row className="[--gx:1.5rem] [--gy:1.5rem]">
        {/* Leads por Hora */}
        <Col lg={6}>
          <Card className="shadow-xs h-full">
            <Card.Header>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 flex items-center gap-2">
                <FaClock className="text-primary" />
                Leads por Hora del Día
              </h6>
            </Card.Header>
            <Card.Body>
              {horas.length > 0 ? (
                <SimpleLineChart data={horas.map((hora, i) => ({ hora, leads: datosHoras[i] }))} xKey="hora" height={300} area series={[{ key: "leads", label: "Leads" }]} />
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <FaClock size={48} className="mb-4 opacity-50" />
                  <p className="mb-4">No hay datos disponibles para mostrar</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Leads por Edad */}
        <Col lg={6}>
          <Card className="shadow-xs h-full">
            <Card.Header>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 flex items-center gap-2">
                <FaUsers className="text-success" />
                Distribución por Edad
              </h6>
            </Card.Header>
            <Card.Body>
              {rangos.length > 0 ? (
                <SimpleBarChart data={rangos.map((rango, i) => ({ rango, leads: datosEdad[i] }))} xKey="rango" height={300} series={[{ key: "leads", label: "Leads", color: "var(--chart-2)" }]} />
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <FaUsers size={48} className="mb-4 opacity-50" />
                  <p className="mb-4">No hay datos disponibles para mostrar</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Leads por Sexo */}
        <Col lg={6}>
          <Card className="shadow-xs h-full">
            <Card.Header>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 flex items-center gap-2">
                <FaVenusMars className="text-warning" />
                Distribución por Sexo
              </h6>
            </Card.Header>
            <Card.Body>
              {datosSexo.length > 0 ? (
                <SimplePieChart data={datosSexo} nameKey="label" valueKey="value" height={300} />
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <FaVenusMars size={48} className="mb-4 opacity-50" />
                  <p className="mb-4">No hay datos disponibles para mostrar</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Tendencia por Días */}
        <Col lg={6}>
          <Card className="shadow-xs h-full">
            <Card.Header>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 flex items-center gap-2">
                <FaCalendarAlt className="text-info" />
                Tendencia por Días
              </h6>
            </Card.Header>
            <Card.Body>
              {fechas.length > 0 ? (
                <SimpleLineChart data={fechas.map((fecha, i) => ({ fecha, leads: datosDias[i] }))} xKey="fecha" height={300} series={[{ key: "leads", label: "Leads", color: "var(--chart-4)" }]} />
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <FaCalendarAlt size={48} className="mb-4 opacity-50" />
                  <p className="mb-4">No hay datos disponibles para mostrar</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

    </Container>
  );
};

export default MetricasAvanzadas;