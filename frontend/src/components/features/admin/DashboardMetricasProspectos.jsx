import React, { useState, useEffect } from 'react';
import { bgSoft, textTone } from "@/lib/tone";
import { Container, Row, Col, Card, Badge, Table, Spinner, ButtonGroup, Button, Form } from '@/components/compat/bootstrap';
import { CHART_COLORS, SimpleBarChart, SimpleLineChart, SimplePieChart } from '@/components/app/charts';
import {
  FaUsers, FaChartLine, FaClock, FaDollarSign, FaChartBar,
  FaArrowUp, FaArrowDown, FaGlobe, FaUserFriends, FaPhone,
  FaWhatsapp, FaBullseye, FaFileAlt
} from '@/lib/icons';
import axios from 'axios';
import { API_URL } from '../../config';
import ProspectosPorPartido from './ProspectosPorPartido';

const DashboardMetricasProspectos = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  // Filtro único: rango de fechas (calendario)
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [hasta, setHasta] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchDashboardData();
  }, [desde, hasta]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');
      const params = {};
      if (!desde || !hasta) { setLoading(false); return; }
      params.desde = desde;
      params.hasta = hasta;

      const response = await axios.get(`${API_URL}/admin/dashboard/metricas`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setDashboardData(response.data.data);
      } else {
        console.error('Error en respuesta del servidor');
        setDashboardData(getEmptyData());
      }
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      // En caso de error, usar datos vacíos como fallback
      setDashboardData(getEmptyData());
      setLoading(false);
    }
  };

  // Datos vacíos (fallback sin hardcode)
  const getEmptyData = () => ({
    periodo: '',
    kpis: {
      fechas: { inicio: '', fin: '' },
      totalProspectos: { total: 0, hoy: 0, semana: 0, cambio: 0 },
      tasaConversion: { valor: 0, totalVentas: 0, cambio: 0, meta: 28 },
      tiempoRespuesta: { valor: 0, unidad: 'horas', descripcion: '' },
      tiempoContacto: { valor: 0, unidad: 'horas', descripcion: '' },
      polizasGeneradas: { total: 0, prospectosConPoliza: 0, valorPromedio: 0 },
      prospectosActivos: { total: 0, nuevo: 0, contactado: 0, cotizacion: 0, negociacion: 0, cierre: 0 }
    },
    prospectosPorDia: [],
    funnelData: [],
    prospectosPorCanal: [],
    ultimosProspectos: [],
    ventas: { total_ventas: 0 },
    ingresos: { total_polizas: 0, total_ingresos: '0.00' },
    prospectosPorLocalidad: [],
    prospectosPorPartido: [],
    asignacionesPorEstado: []
  });

  const TrendBadge = ({ value }) => {
    const isPositive = value > 0;
    return (
      <Badge 
        bg={isPositive ? 'success' : 'danger'} 
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ms-2"
      >
        {isPositive ? <FaArrowUp /> : <FaArrowDown />}
        {' '}{Math.abs(value)}%
      </Badge>
    );
  };

  const KPICard = ({ title, value, subtitle, trend, icon: Icon, color }) => (
    <Card className="rounded-xl bg-card p-4 h-full border-0 shadow-xs transition-shadow hover:shadow-md">
      <Card.Body>
        <div className="flex justify-between items-start mb-4">
          <div className={`flex size-10 items-center justify-center rounded-md ${bgSoft(color)} ${textTone(color)}`}>
            <Icon className={textTone(color)} />
          </div>
          {trend !== null && <TrendBadge value={trend} />}
        </div>
        <div className="font-semibold text-muted-foreground uppercase text-[0.875em] mb-2">
          {title}
        </div>
        <div className="text-3xl leading-tight font-bold text-corporate tabular-nums mb-1">
          {value}
        </div>
        <div className="text-muted-foreground text-[0.875em]">
          {subtitle}
        </div>
      </Card.Body>
    </Card>
  );

  const getEstadoBadge = (estado) => {
    const badges = {
      'Nuevo': 'primary',
      'Contactado': 'info',
      'Cotización': 'warning',
      'Negociación': 'secondary',
      'Cierre': 'success'
    };
    return <Badge bg={badges[estado] || 'secondary'}>{estado}</Badge>;
  };

  const getCanalIcon = (canal) => {
    const icons = {
      'Web': FaGlobe,
      'Referidos': FaUserFriends,
      'Redes Sociales': FaWhatsapp,
      'Llamada': FaPhone,
      'Broker': FaUserFriends,
      'Campaña': FaBullseye
    };
    const Icon = icons[canal] || FaGlobe;
    return <Icon className="me-2" />;
  };

  const COLORS = CHART_COLORS;

  // Utilidades para clasificar estados de asignaciones en positivos/negativos
  const normalize = (str) => (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const POSITIVE_STATES = new Set([
    'lead',
    '1er contacto',
    '1º contacto',
    'primer contacto',
    'contacto',
    'contactado',
    '1er contacto exitoso',
    'calificado cotizacion',
    'calificado cotizacion exitosa',
    'calificado poliza',
    'calificado pago',
    'venta',
    'vendido',
    'cierre'
  ].map(normalize));

  const deriveAsignacionesCounts = () => {
    const arr = Array.isArray(dashboardData?.asignacionesPorEstado)
      ? dashboardData.asignacionesPorEstado
      : [];
    let positivos = 0;
    let negativos = 0;
    arr.forEach((item) => {
      const key = normalize(item.estado || item.name || '');
      const cantidad = Number(item.total ?? item.cantidad ?? item.value ?? 0) || 0;
      if (POSITIVE_STATES.has(key)) positivos += cantidad; else negativos += cantidad;
    });
    return { positivos, negativos, total: positivos + negativos };
  };

  const buildAsignacionesByEstado = () => {
    const result = { positivos: [], negativos: [] };

    const arr = Array.isArray(dashboardData?.asignacionesPorEstado)
      ? dashboardData.asignacionesPorEstado
      : [];

    const source = arr.length
      ? arr.map(item => ({
          name: (item.estado || item.name || item.etiqueta || '').toString(),
          value: Number(item.total ?? item.cantidad ?? item.value ?? 0) || 0,
          porcentaje: parseFloat(item.porcentaje ?? 0)
        }))
      : Object.entries(dashboardData?.kpis?.prospectosActivos || {})
          .filter(([k]) => k !== 'total')
          .map(([k, v]) => ({ name: k, value: Number(v) || 0, porcentaje: 0 }));

    source.forEach(({ name, value, porcentaje }) => {
      if (!value) return;
      const group = POSITIVE_STATES.has(normalize(name)) ? 'positivos' : 'negativos';
      result[group].push({ name, value, porcentaje });
    });

    return result;
  };

  if (loading) {
    return (
      <div className="text-center p-12">
        <Spinner animation="border" variant="primary" />
        <p className="mb-4 mt-4">Cargando dashboard...</p>
      </div>
    );
  }

  const { kpis, prospectosPorDia, funnelData, prospectosPorCanal, ultimosProspectos } = dashboardData;
  const asignaciones = deriveAsignacionesCounts();
  const totalAsignaciones = asignaciones.total || 0;
  const asignacionesByEstado = buildAsignacionesByEstado();
  const positivosData = asignacionesByEstado.positivos;
  const negativosData = asignacionesByEstado.negativos;
  const prospectosPorLocalidad = dashboardData.prospectosPorLocalidad || [];

  return (
    <div className="">
      {/* Header del Dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Row className="items-center">
          <Col>
            <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-corporate mb-1">Dashboard de Prospectos</h2>
            <p className="text-muted-foreground mb-0">Métricas y análisis en tiempo real</p>
          </Col>
          <Col xs="auto">
            <Badge bg="primary" className="px-4 py-2">
              {kpis?.fechas ? `${kpis.fechas.inicio} → ${kpis.fechas.fin}` : 'Periodo'}
            </Badge>
          </Col>
        </Row>
      </div>

      {/* Gráfico de Prospectos + Funnel */}
      <Row className="[--gx:1.5rem] [--gy:1.5rem] mb-6">
        <Col lg={8}>
          <Card className="border-0 h-full shadow-xs transition-shadow hover:shadow-md">
            <Card.Header className="bg-card border-b">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">Prospectos Ingresados</h5>
                  <small className="text-[0.875em] text-muted-foreground">Nuevos prospectos vs. convertidos • {kpis?.fechas ? `${kpis.fechas.inicio} → ${kpis.fechas.fin}` : ''}</small>
                </div>
              </div>
              
              {/* Filtro de Período dentro de la card */}
              <Row className="items-center [--gx:0.5rem] [--gy:0.5rem]">
                <Col xs={12} sm={6}>
                  <Form.Group className="mb-0">
                    <Form.Label className="font-bold text-[0.875em] mb-1 block">Desde</Form.Label>
                    <Form.Control type="date" value={desde} onChange={(e) => setDesde(e.target.value)} size="sm" />
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Group className="mb-0">
                    <Form.Label className="font-bold text-[0.875em] mb-1 block">Hasta</Form.Label>
                    <Form.Control type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} size="sm" />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body>
              <SimpleLineChart
                data={prospectosPorDia}
                xKey="fecha"
                height={300}
                area
                series={[
                  { key: "prospectos", label: "Prospectos" },
                  { key: "convertidos", label: "Convertidos", color: "var(--chart-2)" },
                ]}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="border-0 h-full shadow-xs transition-shadow hover:shadow-md">
            <Card.Header className="bg-card border-b">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">Embudo de Ventas</h5>
              <small className="text-[0.875em] text-muted-foreground">Pipeline de conversión</small>
            </Card.Header>
            <Card.Body>
              <div className="flex flex-col gap-3">
                {/* Ventas */}
                <div className="flex flex-col gap-1 border-b pb-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Badge bg="secondary" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary me-2">1</Badge>
                      <span className="font-medium">Ventas</span>
                    </div>
                    <span className="font-bold">{dashboardData.ventas?.total_ventas || 0}</span>
                  </div>
                </div>

                {/* Pólizas Generadas */}
                <div className="flex flex-col gap-1 border-b pb-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Badge bg="secondary" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary me-2">2</Badge>
                      <span className="font-medium">Pólizas Generadas</span>
                    </div>
                    <span className="font-bold">{kpis.polizasGeneradas.total || 0}</span>
                  </div>
                </div>

                {/* Ingresos */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Badge bg="secondary" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary me-2">3</Badge>
                      <span className="font-medium">Ingresos Totales</span>
                    </div>
                    <span className="font-bold">${parseFloat(dashboardData.ingresos?.total_ingresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <small className="text-[0.875em] text-muted-foreground block mt-1">{dashboardData.ingresos?.total_polizas || 0} pólizas cerradas</small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Breakdown por Canal + Últimos Prospectos */}
      <Row className="[--gx:1.5rem] [--gy:1.5rem]">
        <Col lg={5}>
          <Card className="border-0 h-full shadow-xs transition-shadow hover:shadow-md">
            <Card.Header className="bg-card border-b">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">Prospectos por Canal</h5>
              <small className="text-[0.875em] text-muted-foreground">Distribución de origen</small>
            </Card.Header>
            <Card.Body>
              <SimplePieChart data={prospectosPorCanal} nameKey="canal" valueKey="cantidad" height={250} showLegend={false} />
              <div className="mt-4">
                {prospectosPorCanal.map((item, index) => (
                  <div key={item.canal} className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <div 
                        className="inline-block size-2.5 rounded-full me-2" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-[0.875em]">{getCanalIcon(item.canal)}{item.canal}</span>
                    </div>
                    <div>
                      <span className="font-bold text-[0.875em]">{item.cantidad}</span>
                      <span className="text-muted-foreground text-[0.875em] ms-1">({item.porcentaje}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Row className="[--gx:1.5rem] [--gy:1.5rem]">
            <Col md={6}>
              <Card className="border-0 h-full shadow-xs transition-shadow hover:shadow-md">
                <Card.Header className="bg-card border-b flex justify-between items-center">
                  <div>
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">Estados Positivos</h6>
                    <small className="text-[0.875em] text-muted-foreground">Desglose por estado</small>
                  </div>
                  <Badge bg="success" pill>{asignaciones.positivos}</Badge>
                </Card.Header>
                <Card.Body className="px-2">
                  {positivosData.length > 0 ? (
                    <SimpleBarChart data={positivosData} xKey="name" horizontal showLabels height={Math.max(180, positivosData.length * 38)} series={[{ key: "value", label: "Cantidad", color: "var(--success)" }]} />
                  ) : (
                    <p className="mb-4 text-muted-foreground text-[0.875em] text-center mt-6">Sin datos</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="border-0 h-full shadow-xs transition-shadow hover:shadow-md">
                <Card.Header className="bg-card border-b flex justify-between items-center">
                  <div>
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">Estados Negativos</h6>
                    <small className="text-[0.875em] text-muted-foreground">Desglose por estado</small>
                  </div>
                  <Badge bg="danger" pill>{asignaciones.negativos}</Badge>
                </Card.Header>
                <Card.Body className="px-2">
                  {negativosData.length > 0 ? (
                    <SimpleBarChart data={negativosData} xKey="name" horizontal showLabels height={Math.max(180, negativosData.length * 38)} series={[{ key: "value", label: "Cantidad", color: "var(--destructive)" }]} />
                  ) : (
                    <p className="mb-4 text-muted-foreground text-[0.875em] text-center mt-6">Sin datos</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Mapa Provincia de Buenos Aires - Distribución de Prospectos */}
      <Row className="[--gx:1.5rem] [--gy:1.5rem] mt-1">
        <Col lg={12}>
          <ProspectosPorPartido data={dashboardData.prospectosPorPartido || []} />
        </Col>
      </Row>
    </div>
  );
};

export default DashboardMetricasProspectos;
