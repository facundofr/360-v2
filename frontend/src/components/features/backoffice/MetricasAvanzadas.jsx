import React, { useState, useEffect } from 'react';
import { textTone } from "@/lib/tone";
import { Container, Row, Col, Card, Table, Badge, Alert, Spinner, Tabs, Tab } from '@/components/compat/bootstrap';
import { 
  FaChartLine, 
  FaFilter, 
  FaUsers, 
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaCalendarAlt,
  FaDollarSign,
  FaChartPie
} from '@/lib/icons';
import { ChartJsLine, ChartJsPie } from '@/components/app/charts';
import axios from 'axios';
import { API_URL } from '../../config';

// Registrar componentes de Chart.js

const MetricasAvanzadas = () => {
  const [loading, setLoading] = useState(true);
  const [embudo, setEmbudo] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [tendencias, setTendencias] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('embudo');

  useEffect(() => {
    fetchTodasLasMetricas();
  }, []);

  const fetchTodasLasMetricas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [embudoRes, vendedoresRes, tendenciasRes, alertasRes] = await Promise.all([
        axios.get(`${API_URL}/backoffice/embudo`, config),
        axios.get(`${API_URL}/backoffice/vendedores/rendimiento?dias=30`, config),
        axios.get(`${API_URL}/backoffice/tendencias?dias=30`, config),
        axios.get(`${API_URL}/backoffice/alertas`, config)
      ]);

      setEmbudo(embudoRes.data.data || []);
      setVendedores(vendedoresRes.data.data || []);
      setTendencias(tendenciasRes.data.data || []);
      setAlertas(alertasRes.data.data || []);
    } catch (error) {
      console.error('Error al cargar métricas:', error);
      setError('Error al cargar las métricas avanzadas');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (number) => {
    if (number === null || number === undefined) return '0';
    return Number(number).toLocaleString('es-AR');
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '0%';
    return `${Number(value).toFixed(1)}%`;
  };

  const getEstadoColor = (estado) => {
    const colores = {
      'Lead': 'primary',
      '1º Contacto': 'info',
      'WhatsApp enviado': 'info',
      'Llamada telefónica': 'info',
      'Conversación iniciada por WhatsApp': 'info',
      'Promoción aplicada': 'warning',
      'Calificado Cotización': 'warning',
      'Calificado Póliza': 'secondary',
      'Calificado Pago': 'dark',
      'Póliza iniciada': 'primary',
      'Póliza generada': 'primary',
      'Póliza enviada a supervisor': 'primary',
      'Póliza pendiente a firma': 'warning',
      'Póliza firmada': 'success',
      'Venta': 'success',
      'Fuera de zona': 'danger',
      'Fuera de edad': 'danger',
      'No le interesa (económico)': 'danger',
      'No le interesa cartilla': 'danger',
      'No busca cobertura médica': 'danger',
      'No contesta': 'light'
    };
    return colores[estado] || 'secondary';
  };

  // Paleta específica (hex) para los estados de seguimiento del vendedor
  const coloresEstadoSeguimiento = {
    'Llamada telefónica': { backgroundColor: '#64748B', color: '#fff' },
    'WhatsApp enviado': { backgroundColor: '#86C6A5', color: '#1f2937' },
    'Conversación iniciada por WhatsApp': { backgroundColor: '#25A566', color: '#fff' },
    'Promoción aplicada': { backgroundColor: '#F59E0B', color: '#1f2937' },
    'Póliza iniciada': { backgroundColor: '#818CF8', color: '#1f2937' },
    'Póliza generada': { backgroundColor: '#4F46E5', color: '#fff' },
    'Póliza enviada a supervisor': { backgroundColor: '#0EA5E9', color: '#fff' },
    'Póliza pendiente a firma': { backgroundColor: '#F97316', color: '#1f2937' },
    'Póliza firmada': { backgroundColor: '#16A34A', color: '#fff' }
  };
  const getEstadoStyle = (estado) => coloresEstadoSeguimiento[estado] || undefined;

  const getAlertIcon = (tipo) => {
    switch (tipo) {
      case 'vendedores_inactivos':
        return <FaUsers className="text-warning" />;
      case 'baja_conversion':
        return <FaArrowDown className="text-destructive" />;
      case 'prospectos_estancados':
        return <FaExclamationTriangle className="text-warning" />;
      default:
        return <FaExclamationTriangle className="text-info" />;
    }
  };

  // Función para generar datos del gráfico pie
  const generatePieChartData = () => {
    if (!embudo || embudo.length === 0) return null;

    // Agrupar estados similares para mejor visualización
    const groupedData = embudo.reduce((acc, item) => {
      let category;
      if (item.estado === 'Venta') {
        category = 'Ventas Exitosas';
      } else if (['Lead', '1º Contacto'].includes(item.estado)) {
        category = 'Prospectos Iniciales';
      } else if (['Calificado Cotización', 'Calificado Póliza', 'Calificado Pago'].includes(item.estado)) {
        category = 'En Proceso';
      } else if (item.estado.includes('Fuera') || item.estado.includes('No le interesa')) {
        category = 'Rechazos';
      } else {
        category = 'Otros';
      }

      if (!acc[category]) {
        acc[category] = { cantidad: 0, estados: [] };
      }
      acc[category].cantidad += item.cantidad;
      acc[category].estados.push(item);
      return acc;
    }, {});

    const labels = Object.keys(groupedData);
    const data = Object.values(groupedData).map(group => group.cantidad);
    
    // Colores profesionales con transparencia y gradientes sutiles
    const colors = {
      'Ventas Exitosas': {
        background: 'rgba(34, 197, 94, 0.8)',    // Verde esmeralda transparente
        border: 'rgba(34, 197, 94, 1)',
        hover: 'rgba(34, 197, 94, 0.9)'
      },
      'En Proceso': {
        background: 'rgba(251, 191, 36, 0.8)',   // Ámbar transparente
        border: 'rgba(251, 191, 36, 1)',
        hover: 'rgba(251, 191, 36, 0.9)'
      },
      'Prospectos Iniciales': {
        background: 'rgba(59, 130, 246, 0.8)',   // Azul cielo transparente
        border: 'rgba(59, 130, 246, 1)',
        hover: 'rgba(59, 130, 246, 0.9)'
      },
      'Rechazos': {
        background: 'rgba(239, 68, 68, 0.8)',    // Rojo coral transparente
        border: 'rgba(239, 68, 68, 1)',
        hover: 'rgba(239, 68, 68, 0.9)'
      },
      'Otros': {
        background: 'rgba(107, 114, 128, 0.8)',  // Gris pizarra transparente
        border: 'rgba(107, 114, 128, 1)',
        hover: 'rgba(107, 114, 128, 0.9)'
      }
    };

    return {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: labels.map(label => colors[label]?.background || 'rgba(107, 114, 128, 0.8)'),
        borderColor: labels.map(label => colors[label]?.border || 'rgba(107, 114, 128, 1)'),
        hoverBackgroundColor: labels.map(label => colors[label]?.hover || 'rgba(107, 114, 128, 0.9)'),
        borderWidth: 2,
        hoverOffset: 15,
        hoverBorderWidth: 3
      }]
    };
  };

  // Opciones del gráfico pie
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '25%', // Hace el gráfico tipo donut para un look más moderno
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 25,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 13,
            family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            weight: '500'
          },
          color: '#374151',
          boxWidth: 12,
          boxHeight: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed * 100) / total).toFixed(1);
            return `${context.label}: ${context.formattedValue} prospectos (${percentage}%)`;
          }
        }
      }
    },
    elements: {
      arc: {
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
      easing: 'easeInOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Función para generar datos del gráfico de líneas de tendencias
  const generateLineChartData = () => {
    if (!tendencias || tendencias.length === 0) return null;

    // Ordenar por fecha ascendente para mostrar la tendencia cronológica
    const sortedTendencias = [...tendencias].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const labels = sortedTendencias.map(item => 
      new Date(item.fecha).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit'
      })
    );

    return {
      labels: labels,
      datasets: [
        {
          label: 'Nuevos Prospectos',
          data: sortedTendencias.map(item => item.nuevos_prospectos),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Cotizaciones',
          data: sortedTendencias.map(item => item.cotizaciones_realizadas),
          borderColor: 'rgba(251, 191, 36, 1)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(251, 191, 36, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Pólizas Generadas',
          data: sortedTendencias.map(item => item.polizas_creadas),
          borderColor: 'rgba(139, 69, 19, 1)',
          backgroundColor: 'rgba(139, 69, 19, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(139, 69, 19, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Ventas Cerradas',
          data: sortedTendencias.map(item => item.ventas_cerradas),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(34, 197, 94, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Ingresos (x1000)',
          data: sortedTendencias.map(item => Math.round(item.ingresos_dia / 1000)),
          borderColor: 'rgba(168, 85, 247, 1)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(168, 85, 247, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  // Opciones del gráfico de líneas
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 12,
            family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            weight: '500'
          },
          color: '#374151'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          afterLabel: function(context) {
            if (context.datasetIndex === 3) {
              return 'Valor real: ' + formatCurrency(context.raw * 1000);
            }
            return '';
          }
        }
      },
      title: {
        display: true,
        text: 'Tendencias de los Últimos 30 Días',
        color: '#374151',
        font: {
          size: 16,
          weight: '600',
          family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        padding: 20
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Fecha',
          color: '#6B7280',
          font: {
            size: 12,
            weight: '500'
          }
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 11
          }
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Cantidad',
          color: '#6B7280',
          font: {
            size: 12,
            weight: '500'
          }
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 11
          }
        },
        beginAtZero: true
      }
    },
    elements: {
      point: {
        hoverBackgroundColor: '#ffffff',
        hoverBorderWidth: 3
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  if (loading) {
    return (
      <Container className="flex justify-center items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="">
      <Row className="mb-6">
        <Col>
          <h2 className="mb-4 text-[2rem] font-bold leading-tight tracking-tight text-corporate">
            <FaChartLine className="me-2" />
            Métricas Avanzadas
          </h2>
          <p className="mb-4 text-muted-foreground">Análisis detallado del rendimiento comercial</p>
        </Col>
      </Row>

      {/* Alertas importantes */}
      {alertas.length > 0 && (
        <Row className="mb-6">
          <Col>
            <Alert variant="warning">
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate"><FaExclamationTriangle className="me-2" />Alertas Importantes</h5>
              {alertas.map((alerta, index) => (
                <div key={index} className="flex items-center mb-2">
                  {getAlertIcon(alerta.tipo)}
                  <span className="ms-2">{alerta.mensaje}</span>
                  <Badge bg={alerta.prioridad === 'alta' ? 'danger' : 'warning'} className="ms-auto">
                    {alerta.prioridad}
                  </Badge>
                </div>
              ))}
            </Alert>
          </Col>
        </Row>
      )}

      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-6">
        
        {/* TAB: EMBUDO DE VENTAS */}
        <Tab eventKey="embudo" title={<><FaChartPie className="me-2" />Embudo de Ventas</>}>
          <Row>
            {/* Gráfico Pie */}
            <Col lg={6}>
              <Card className="h-full">
                <Card.Header className="bg-primary text-primary-foreground">
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                    <FaChartPie className="me-2" />
                    Distribución del Embudo (90 días)
                  </h5>
                </Card.Header>
                <Card.Body className="flex items-center justify-center p-0">
                  {generatePieChartData() ? (
                    <div className="relative h-72 w-full">
                      <div style={{ position: 'relative', height: '350px', width: '100%' }}>
                        <ChartJsPie data={generatePieChartData()} height={300} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground p-6">
                      <FaExclamationTriangle size={48} className="mb-4 opacity-50" />
                      <p className="mb-0">No hay datos disponibles para mostrar</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Métricas Detalladas */}
            <Col lg={6}>
              <Card className="h-full">
                <Card.Header>
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                    <FaFilter className="me-2" />
                    Métricas Detalladas
                  </h5>
                </Card.Header>
                <Card.Body>
                  {/* Métricas principales */}
                  <Row className="mb-6">
                    <Col md={6}>
                      <div className="text-center p-4 border rounded-md">
                        <h3 className="text-[1.75rem] font-bold leading-tight tracking-tight text-success mb-1">
                          {formatPercentage(
                            embudo.find(e => e.estado === 'Venta')?.porcentaje || 0
                          )}
                        </h3>
                        <small className="text-[0.875em] text-muted-foreground">Tasa de Conversión</small>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="text-center p-4 border rounded-md">
                        <h3 className="text-[1.75rem] font-bold leading-tight tracking-tight text-primary mb-1">
                          {formatNumber(embudo.reduce((sum, e) => sum + e.cantidad, 0))}
                        </h3>
                        <small className="text-[0.875em] text-muted-foreground">Total Prospectos</small>
                      </div>
                    </Col>
                  </Row>

                  {/* Estados detallados */}
                  <div className="flex flex-wrap gap-2">
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">Estados Detallados:</h6>
                    {embudo.slice(0, 8).map((item, index) => (
                      <div key={index} className="flex justify-between items-center mb-2 p-2 border-b">
                        <div className="flex items-center">
                          <Badge bg={getEstadoStyle(item.estado) ? null : getEstadoColor(item.estado)} style={getEstadoStyle(item.estado)} className="me-2">
                            {item.estado}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <strong>{formatNumber(item.cantidad)}</strong>
                          <br />
                          <small className="text-[0.875em] text-muted-foreground">{formatPercentage(item.porcentaje)}</small>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de categorías */}
                  <div className="mt-6">
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">Resumen por Categoría:</h6>
                    <Row>
                      <Col md={6}>
                        <div className="text-center p-2 bg-muted rounded-md mb-2">
                          <strong className="text-info">
                            {formatNumber(
                              embudo
                                .filter(e => ['Lead', '1º Contacto', 'Calificado Cotización', 'Calificado Póliza', 'Calificado Pago'].includes(e.estado))
                                .reduce((sum, e) => sum + e.cantidad, 0)
                            )}
                          </strong>
                          <br />
                          <small className="text-[0.875em] text-muted-foreground">Activos</small>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="text-center p-2 bg-muted rounded-md mb-2">
                          <strong className="text-destructive">
                            {formatNumber(
                              embudo
                                .filter(e => e.estado.includes('Fuera') || e.estado.includes('No le interesa') || e.estado === 'No contesta')
                                .reduce((sum, e) => sum + e.cantidad, 0)
                            )}
                          </strong>
                          <br />
                          <small className="text-[0.875em] text-muted-foreground">Rechazos</small>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        {/* TAB: RENDIMIENTO DE VENDEDORES */}
        <Tab eventKey="vendedores" title={<><FaUsers className="me-2" />Rendimiento Vendedores</>}>
          <Card>
            <Card.Header>
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate"><FaUsers className="me-2" />Top Vendedores (30 días)</h5>
            </Card.Header>
            <Card.Body>
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th className="text-left">Vendedor</th>
                    <th className="text-left">Supervisor</th>
                    <th className="text-left">Prospectos</th>
                    <th className="text-left">Ventas</th>
                    <th className="text-left">Conversión</th>
                    <th className="text-left">Ticket Promedio</th>
                    <th className="text-left">Ingresos</th>
                    <th className="text-left">Actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedores.slice(0, 15).map((vendedor, index) => (
                    <tr key={index}>
                      <td>
                        <div>
                          <strong>{vendedor.vendedor_nombre}</strong>
                          <br />
                          <small className="text-[0.875em] text-muted-foreground">{vendedor.vendedor_email}</small>
                        </div>
                      </td>
                      <td>
                        <small className="text-[0.875em]">{vendedor.supervisor_nombre || 'Sin supervisor'}</small>
                      </td>
                      <td>
                        <Badge bg="info">{formatNumber(vendedor.total_prospectos)}</Badge>
                      </td>
                      <td>
                        <Badge bg="success">{formatNumber(vendedor.total_ventas)}</Badge>
                      </td>
                      <td>
                        <span className={textTone(vendedor.tasa_conversion >= 15 ? 'success' : vendedor.tasa_conversion >= 10 ? 'warning' : 'danger')}>
                          {formatPercentage(vendedor.tasa_conversion)}
                        </span>
                      </td>
                      <td>{formatCurrency(vendedor.ticket_promedio)}</td>
                      <td>
                        <strong className="text-success">
                          {formatCurrency(vendedor.ingresos_generados)}
                        </strong>
                      </td>
                      <td>
                        {vendedor.dias_sin_login <= 3 ? (
                          <Badge bg="success">Activo</Badge>
                        ) : vendedor.dias_sin_login <= 7 ? (
                          <Badge bg="warning">Moderado</Badge>
                        ) : (
                          <Badge bg="danger">{vendedor.dias_sin_login}d sin login</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* TAB: TENDENCIAS TEMPORALES */}
        <Tab eventKey="tendencias" title={<><FaCalendarAlt className="me-2" />Tendencias</>}>
          <Row>
            {/* Gráfico de Líneas */}
            <Col lg={8}>
              <Card className="h-full">
                <Card.Header className="bg-corporate text-corporate-foreground">
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                    <FaChartLine className="me-2" />
                    Evolución Temporal (30 días)
                  </h5>
                </Card.Header>
                <Card.Body className="p-0">
                  {generateLineChartData() ? (
                    <div className="relative h-72 w-full">
                      <div style={{ position: 'relative', height: '400px', width: '100%' }}>
                        <ChartJsLine data={generateLineChartData()} height={300} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground p-6">
                      <FaExclamationTriangle size={48} className="mb-4 opacity-50" />
                      <p className="mb-0">No hay datos de tendencias disponibles</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Métricas Resumen */}
            <Col lg={4}>
              <Card className="h-full">
                <Card.Header>
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                    <FaDollarSign className="me-2" />
                    Resumen del Período
                  </h5>
                </Card.Header>
                <Card.Body>
                  {tendencias.length > 0 && (
                    <>
                      {/* Totales del período */}
                      <div className="mb-6">
                        <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-4">Totales (30 días):</h6>
                        <div className="flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)] [--gx:0.5rem] [--gy:0.5rem]">
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-6/12">
                            <div className="text-center p-2 bg-primary/10 rounded-md">
                              <strong className="text-primary block">
                                {formatNumber(tendencias.reduce((sum, t) => sum + t.nuevos_prospectos, 0))}
                              </strong>
                              <small className="text-[0.875em] text-muted-foreground">Prospectos</small>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-6/12">
                            <div className="text-center p-2 bg-warning/10 rounded-md">
                              <strong className="text-warning block">
                                {formatNumber(tendencias.reduce((sum, t) => sum + t.cotizaciones_realizadas, 0))}
                              </strong>
                              <small className="text-[0.875em] text-muted-foreground">Cotizaciones</small>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-6/12">
                            <div className="text-center p-2 bg-teal/10 rounded-md">
                              <strong style={{ color: '#8B4513' }} className="block">
                                {formatNumber(tendencias.reduce((sum, t) => sum + t.polizas_creadas, 0))}
                              </strong>
                              <small className="text-[0.875em] text-muted-foreground">Pólizas</small>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-6/12">
                            <div className="text-center p-2 bg-success/10 rounded-md">
                              <strong className="text-success block">
                                {formatNumber(tendencias.reduce((sum, t) => sum + t.ventas_cerradas, 0))}
                              </strong>
                              <small className="text-[0.875em] text-muted-foreground">Ventas</small>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap -mx-[calc(var(--gx)/2)] [--gx:0.5rem] [--gy:0.5rem] mt-2">
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="text-center p-2 bg-info/10 rounded-md">
                              <strong className="text-info block">
                                {formatCurrency(tendencias.reduce((sum, t) => sum + t.ingresos_dia, 0))}
                              </strong>
                              <small className="text-[0.875em] text-muted-foreground">Ingresos Totales</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Promedios diarios */}
                      <div className="mb-6">
                        <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-4">Promedios Diarios:</h6>
                        <div className="flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)] [--gx:0.5rem] [--gy:0.5rem]">
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="flex justify-between items-center p-2 border-b">
                              <span className="text-muted-foreground">Prospectos/día:</span>
                              <strong className="text-primary">
                                {Math.round(tendencias.reduce((sum, t) => sum + t.nuevos_prospectos, 0) / tendencias.length)}
                              </strong>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="flex justify-between items-center p-2 border-b">
                              <span className="text-muted-foreground">Cotizaciones/día:</span>
                              <strong className="text-warning">
                                {Math.round(tendencias.reduce((sum, t) => sum + t.cotizaciones_realizadas, 0) / tendencias.length)}
                              </strong>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="flex justify-between items-center p-2 border-b">
                              <span className="text-muted-foreground">Pólizas/día:</span>
                              <strong style={{ color: '#8B4513' }}>
                                {Math.round(tendencias.reduce((sum, t) => sum + t.polizas_creadas, 0) / tendencias.length)}
                              </strong>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="flex justify-between items-center p-2 border-b">
                              <span className="text-muted-foreground">Ventas/día:</span>
                              <strong className="text-success">
                                {Math.round(tendencias.reduce((sum, t) => sum + t.ventas_cerradas, 0) / tendencias.length)}
                              </strong>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="flex justify-between items-center p-2 border-b">
                              <span className="text-muted-foreground">Conversión general:</span>
                              <strong className="text-info">
                                {formatPercentage(
                                  (tendencias.reduce((sum, t) => sum + t.ventas_cerradas, 0) * 100) /
                                  Math.max(tendencias.reduce((sum, t) => sum + t.nuevos_prospectos, 0), 1)
                                )}
                              </strong>
                            </div>
                          </div>
                          <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                            <div className="flex justify-between items-center p-2">
                              <span className="text-muted-foreground">Cotización → Póliza:</span>
                              <strong className="text-teal">
                                {formatPercentage(
                                  (tendencias.reduce((sum, t) => sum + t.polizas_creadas, 0) * 100) /
                                  Math.max(tendencias.reduce((sum, t) => sum + t.cotizaciones_realizadas, 0), 1)
                                )}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mejores y peores días */}
                      <div>
                        <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-4">Destacados:</h6>
                        {(() => {
                          const mejorDia = tendencias.reduce((max, t) => 
                            t.ventas_cerradas > max.ventas_cerradas ? t : max
                          );
                          const peorDia = tendencias.reduce((min, t) => 
                            t.ventas_cerradas < min.ventas_cerradas ? t : min
                          );
                          
                          return (
                            <>
                              <div className="flex justify-between items-center p-2 bg-success/10 rounded-md mb-2">
                                <div>
                                  <small className="text-[0.875em] text-muted-foreground">Mejor día:</small>
                                  <br />
                                  <strong className="text-success">
                                    {new Date(mejorDia.fecha).toLocaleDateString('es-AR')}
                                  </strong>
                                </div>
                                <Badge bg="success">{mejorDia.ventas_cerradas} ventas</Badge>
                              </div>
                              
                              <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                                <div>
                                  <small className="text-[0.875em] text-muted-foreground">Día más bajo:</small>
                                  <br />
                                  <strong className="text-teal">
                                    {new Date(peorDia.fecha).toLocaleDateString('es-AR')}
                                  </strong>
                                </div>
                                <Badge bg="secondary">{peorDia.ventas_cerradas} ventas</Badge>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabla detallada (opcional, compacta) */}
          <Row className="mt-6">
            <Col>
              <Card>
                <Card.Header>
                  <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">
                    <FaCalendarAlt className="me-2" />
                    Datos Detallados (últimos 10 días)
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Table responsive striped size="sm">
                    <thead>
                      <tr>
                        <th className="text-left">Fecha</th>
                        <th className="text-left">Prospectos</th>
                        <th className="text-left">Cotizaciones</th>
                        <th className="text-left">Pólizas</th>
                        <th className="text-left">Ventas</th>
                        <th className="text-left">Ingresos</th>
                        <th className="text-left">Conversión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tendencias.slice(0, 10).map((dia, index) => (
                        <tr key={index}>
                          <td>
                            <strong>
                              {new Date(dia.fecha).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </strong>
                          </td>
                          <td>
                            <Badge bg="primary" size="sm">{formatNumber(dia.nuevos_prospectos)}</Badge>
                          </td>
                          <td>
                            <Badge bg="warning" size="sm">{formatNumber(dia.cotizaciones_realizadas)}</Badge>
                          </td>
                          <td>
                            <Badge bg="secondary" size="sm">{formatNumber(dia.polizas_creadas)}</Badge>
                          </td>
                          <td>
                            <Badge bg="success" size="sm">{formatNumber(dia.ventas_cerradas)}</Badge>
                          </td>
                          <td>
                            <strong className="text-success">
                              {formatCurrency(dia.ingresos_dia)}
                            </strong>
                          </td>
                          <td>
                            <span className={textTone(
                              dia.nuevos_prospectos > 0 
                                ? (dia.ventas_cerradas / dia.nuevos_prospectos * 100) >= 15 
                                  ? 'success' : 'warning' 
                                : 'muted'
                            )}>
                              {dia.nuevos_prospectos > 0 
                                ? formatPercentage((dia.ventas_cerradas / dia.nuevos_prospectos) * 100)
                                : '0%'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

      </Tabs>
    </Container>
  );
};

export default MetricasAvanzadas;
