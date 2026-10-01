import { cn } from "@/lib/utils";
import React, { useState, useEffect } from 'react';
import { bgSoft, textTone } from "@/lib/tone";
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Table, 
  Badge, 
  Button, 
  Alert,
  Spinner,
  Offcanvas,
  Form,
} from '@/components/compat/bootstrap';
import { 
  FaUsers, 
  FaUserTie, 
  FaChartLine, 
  FaDollarSign,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaEye,
  FaDownload,
  FaHandshake,
  FaTachometerAlt,
  FaBuilding,
  FaBars,
  FaTimes,
  FaSignOutAlt,
  FaFileAlt,
  FaUserFriends,
  FaUserCheck,
  FaMoneyBillWave,
  FaTag
} from '@/lib/icons';
import axios from 'axios';
import { API_URL } from '../../config';
import MetricasAvanzadas from './MetricasAvanzadas';
import SupervisoresBackOffice from './SupervisoresBackOffice';
import VendedoresBackOffice from './VendedoresBackOffice';
import PolizasBackOffice from './PolizasBackOffice';
import ProspectosBackOffice from './ProspectosBackOffice';
import PromocionesBackOffice from './PromocionesBackOffice';
import { SimpleLineChart } from '@/components/app/charts';

const BackOfficeDashboard = () => {
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('dashboard');
  const [openDrawer, setOpenDrawer] = useState(false);
  const [periodType, setPeriodType] = useState('month'); // 'month' | 'year'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1..12
  const navigate = useNavigate();

  // Menú items para el sidebar
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Principal',
      icon: FaTachometerAlt,
      description: 'Vista general y métricas principales'
    },
    {
      id: 'prospectos',
      label: 'Gestión Prospectos',
      icon: FaHandshake,
      description: 'Administrar prospectos y asignaciones'
    },
    {
      id: 'polizas',
      label: 'Gestión Pólizas',
      icon: FaFileAlt,
      description: 'Administrar pólizas del sistema'
    },
    {
      id: 'supervisores',
      label: 'Gestión Supervisores',
      icon: FaUserTie,
      description: 'Administrar supervisores y equipos'
    },
    {
      id: 'vendedores',
      label: 'Gestión Vendedores',
      icon: FaUsers,
      description: 'Administrar vendedores y asignaciones'
    },
    {
      id: 'promociones',
      label: 'Gestión Promociones',
      icon: FaTag,
      description: 'Administrar promociones y descuentos'
    }
  ];

  useEffect(() => {
    if (vista === 'dashboard') {
      fetchEstadisticas();
    }
  }, [vista, periodType, selectedYear, selectedMonth]);

  const fetchEstadisticas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');
      
      if (!token) {
        navigate('/');
        return;
      }

      const params = new URLSearchParams();
      params.append('periodType', periodType);
      params.append('year', String(selectedYear));
      if (periodType === 'month') params.append('month', String(selectedMonth));

      const response = await axios.get(`${API_URL}/backoffice/dashboard?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setEstadisticas(response.data.data);
      } else {
        setError('Error al cargar estadísticas');
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/');
      } else {
        setError('Error al conectar con el servidor');
      }
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

  // Serie simple para mini-gráficos (sparklines)
  const buildSpark = (base = 0) => {
    const v = Number(base) || 0;
    const arr = [0.6, 0.8, 1, 0.9, 1.1].map((k) => Math.max(0, Math.round(v * k)));
    // Evitar todo cero para que el gráfico se vea
    return arr.every((n) => n === 0) ? [1, 2, 1, 2, 1] : arr;
  };

  // Generar datos históricos de prospectos/ventas/pólizas
  const getHistoricoProspectos = (datos) => {
    // Si backend envía etiquetas, usarlas directamente
    if (Array.isArray(datos?.labels) && datos.labels.length > 0) {
      const len = datos.labels.length;
      const normalize = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return Array(len).fill(0);
        if (arr.length === len) return arr;
        const diff = len - arr.length;
        return [...Array(diff).fill(0), ...arr.slice(-len)];
      };
      return {
        meses: datos.labels,
        prospectos: normalize(datos?.prospectos_historico),
        ventas: normalize(datos?.ventas_historico),
        polizas: normalize(datos?.polizas_historico),
      };
    }
    const lPros = (datos?.prospectos_historico || []).length;
    const lVent = (datos?.ventas_historico || []).length;
    const lPoli = (datos?.polizas_historico || []).length;
    let len = Math.max(lPros, lVent, lPoli, 8);

    // Si recibimos 12 puntos, asumimos meses del año en curso (enero..diciembre)
    const isFullYear = len === 12 && (lPros === 12 || lVent === 12 || lPoli === 12);
    let meses;
    if (isFullYear) {
      const year = new Date().getFullYear();
      meses = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1).toLocaleString('es', { month: 'short' }));
      len = 12;
    } else {
      meses = Array.from({ length: len }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (len - 1 - i));
        return d.toLocaleString('es', { month: 'short' });
      });
    }

    const normalize = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return Array(len).fill(0);
      if (arr.length === len) return arr;
      const diff = len - arr.length;
      return [...Array(diff).fill(0), ...arr.slice(-len)];
    };

    return {
      meses,
      prospectos: normalize(datos?.prospectos_historico),
      ventas: normalize(datos?.ventas_historico),
      polizas: normalize(datos?.polizas_historico),
    };
  };

  const getVistaTitle = () => {
    const titles = {
      'dashboard': 'Dashboard Principal',
      'metricas': 'Métricas Avanzadas',
      'prospectos': 'Gestión de Prospectos',
      'polizas': 'Gestión de Pólizas',
      'supervisores': 'Gestión de Supervisores',
      'vendedores': 'Gestión de Vendedores',
      'promociones': 'Gestión de Promociones'
    };
    return titles[vista] || 'Back Office';
  };  const handleLogout = () => {
    localStorage.removeItem('cober_token');
    localStorage.removeItem('cober_user_id');
    localStorage.removeItem('cober_first_name');
    localStorage.removeItem('cober_last_name');
    localStorage.removeItem('cober_user_role');
    localStorage.removeItem('cober_user_email');
    navigate('/');
  };

  // Sidebar content
  const drawerContent = (
    <div className="flex flex-col bg-sidebar h-full">
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h5 className="tracking-tight flex items-center gap-2 text-lg font-bold text-corporate mb-0">
            <FaBuilding className="text-primary" />
            Back Office <span className="font-light">Panel</span>
          </h5>
          <Button
            variant="light"
            size="sm"
            className="size-10 p-0 md:hidden"
            onClick={() => setOpenDrawer(false)}
          >
            <FaTimes />
          </Button>
        </div>
      </div>

      <div className="flex-1 gap-1 p-3 h-full flex flex-col">
        <div className="grow">
          {menuItems.map((item) => (
            <div key={item.id} className="">
              <button
                className={`relative flex min-h-12 w-full items-center gap-3 rounded-md px-4 text-left font-medium text-sidebar-foreground transition-colors outline-none hover:bg-primary/5 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 w-full text-left ${vista === item.id ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : ""}`}
                onClick={() => {
                  setVista(item.id);
                  setOpenDrawer(false);
                }}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Logout section */}
        <div className="border-t border-sidebar-border p-3">
          {/* <button
            className="logout-btn"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Cerrar Sesión</span>
          </button> */}
        </div>
      </div>
    </div>
  );

  // Renderizar contenido según la vista seleccionada
  const renderVistaContent = () => {
    switch (vista) {
      case 'metricas':
        return <MetricasAvanzadas />;
      case 'prospectos':
        return <ProspectosBackOffice />;
      case 'polizas':
        return <PolizasBackOffice />;
      case 'supervisores':
        return <SupervisoresBackOffice />;
      case 'vendedores':
        return <VendedoresBackOffice />;
      case 'promociones':
        return <PromocionesBackOffice />;
      case 'dashboard':
      default:
        return renderDashboardContent();
    }
  };

  const renderDashboardContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center" style={{ minHeight: '500px' }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" size="lg" />
            <p className="mb-4 mt-4 text-muted-foreground">Cargando dashboard de Back Office...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="danger">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      );
    }

    const { generales, porSupervisor } = estadisticas || {};

    // Verificar que los datos existan
    if (!generales || !porSupervisor) {
      return (
        <Alert variant="warning">
          <FaExclamationTriangle className="me-2" />
          No hay datos disponibles para mostrar.
        </Alert>
      );
    }

    // Calcular tasas de conversión y otras métricas
    const tasaConversionGeneral = generales.prospectos_activos_total > 0 
      ? (generales.ventas_mes / generales.prospectos_activos_total * 100) 
      : 0;

  // Los ingresos ahora vienen directamente de la base de datos (polizas cerradas)
  const ingresosTotales = generales.ingresos_mes || 0;
  // Normalizar histórico para el chart principal (usar estadisticas completas, no solo 'generales')
  const hist = getHistoricoProspectos(estadisticas);

    // Componente de card de estadísticas (igual que Supervisor)
    const StatCard = ({ icon: Icon, title, value, change, changeType, color }) => (
      <Card className="h-full border-0 shadow-xs">
        <Card.Body className="flex items-center">
          <div className={`rounded-full p-4 me-4 ${bgSoft(color)}`}>
            <Icon className={`${textTone(color)} text-[1.5rem] leading-snug`} />
          </div>
          <div className="grow">
            <h6 className="text-base leading-tight tracking-tight text-muted-foreground mb-1 font-normal">{title}</h6>
            <h3 className="text-[1.75rem] leading-tight tracking-tight text-corporate mb-0 font-bold">{value}</h3>
            {change !== undefined && (
              <div className="flex items-center mt-1">
                {changeType === 'up' && <FaArrowUp className="text-success me-1" size={12} />}
                {changeType === 'down' && <FaArrowDown className="text-destructive me-1" size={12} />}
                {changeType !== 'up' && changeType !== 'down' && <span className="text-muted-foreground me-1">—</span>}
                <small className={cn("text-[0.875em]", textTone(changeType === 'up' ? 'success' : changeType === 'down' ? 'danger' : 'muted'))}>{change || 0}% vs mes anterior</small>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
    );

  // Datos para cards (usar totales globales provistos por el backend)
  const totalProspectos = generales.total_prospectos ?? generales.prospectos_activos_total ?? 0;
  const vendedoresActivos = generales.total_vendedores_activos ?? generales.vendedores_activos ?? 0;
  const ventasConfirmadas = generales.ventas_confirmadas_total ?? generales.ventas_mes ?? 0;
  const totalPolizas = generales.polizas_generadas_total ?? generales.polizas_mes ?? 0;
  const totalFacturado = generales.total_facturado ?? ingresosTotales ?? 0;

    // Datos de gráfica al estilo Supervisor
    const chartData = (hist.meses || []).map((mes, i) => ({
      mes,
      nuevosProspectos: (hist.prospectos || [])[i] || 0,
      vendedores: vendedoresActivos, // No hay histórico; línea plana
      ventas: (hist.ventas || [])[i] || 0,
      polizasGeneradas: (hist.polizas || [])[i] || 0,
    }));

    return (
      <>
        {/* Fila de tarjetas de estadísticas */}
        <Row className="[--gx:1.5rem] [--gy:1.5rem] mb-6">
          <Col lg className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] lg:flex-[1_0_0%] lg:w-auto">
            <StatCard icon={FaUserFriends} title="Total Prospectos" value={formatNumber(totalProspectos)} color="" />
          </Col>
          <Col lg className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] lg:flex-[1_0_0%] lg:w-auto">
            <StatCard icon={FaUsers} title="Vendedores Activos" value={formatNumber(vendedoresActivos)} color="success" />
          </Col>
          {/* <Col lg className="col-lg">
            <StatCard icon={FaUserCheck} title="Ventas Confirmadas" value={formatNumber(ventasConfirmadas)} color="warning" />
          </Col> */}
          <Col lg className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] lg:flex-[1_0_0%] lg:w-auto">
            <StatCard icon={FaFileAlt} title="Pólizas Generadas" value={formatNumber(totalPolizas)} color="info" />
          </Col>
        </Row>

        {/* Filtros de período (UX/UI) debajo de las cards */}
        <Card className="shadow-xs border-0 mb-6">
          <Card.Body>
            <Row className="[--gx:1rem] [--gy:1rem] items-end">
              <Col xs={12} md={4}>
                <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Período</Form.Label>
                <Form.Select size="sm" value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
                  <option value="month">Mes</option>
                  <option value="year">Año</option>
                </Form.Select>
              </Col>

              {periodType === 'month' && (
                <>
                  <Col xs={6} md={4}>
                    <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Mes</Form.Label>
                    <Form.Select size="sm" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                      {[
                        'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
                      ].map((mName, idx) => (
                        <option key={idx+1} value={idx+1}>{mName}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={3}>
                    <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Año</Form.Label>
                    <Form.Select size="sm" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                      {Array.from({length: 5}, (_,i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </>
              )}

              {periodType === 'year' && (
                <Col xs={12} md={4}>
                  <Form.Label className="text-[0.875em] text-muted-foreground mb-1">Año</Form.Label>
                  <Form.Select size="sm" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                    {Array.from({length: 7}, (_,i) => new Date().getFullYear() - 3 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              <Col className="flex justify-end">
                <Button variant="primary" size="sm" onClick={fetchEstadisticas}>
                  <FaArrowUp className="me-1" /> Actualizar
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Fila: Gráfica de Tendencias */}
        <Row className="[--gx:1.5rem] [--gy:1.5rem]">
          <Col lg={12}>
            <Card className="h-full border-0 shadow-xs transition-shadow hover:shadow-md">
              <Card.Header className="bg-card border-0 pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-[1.25rem] leading-tight tracking-tight text-corporate mb-1 font-bold">Tendencias Mensuales</h5>
                    <p className="text-muted-foreground mb-0 text-[0.875em]">Evolución de prospectos, vendedores, ventas y pólizas</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center">
                      <div className="bg-primary rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                      <small className="text-[0.875em] text-muted-foreground">Nuevos Prospectos</small>
                    </div>
                    <div className="flex items-center">
                      <div className="bg-success rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                      <small className="text-[0.875em] text-muted-foreground">Vendedores</small>
                    </div>
                    <div className="flex items-center">
                      <div className="bg-warning rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                      <small className="text-[0.875em] text-muted-foreground">Ventas</small>
                    </div>
                    <div className="flex items-center">
                      <div className="bg-info rounded-full me-2" style={{ width: '12px', height: '12px' }}></div>
                      <small className="text-[0.875em] text-muted-foreground">Pólizas Generadas</small>
                    </div>
                  </div>
                </div>
              </Card.Header>
              <Card.Body>
                <SimpleLineChart
                  data={chartData}
                  xKey="mes"
                  height={300}
                  showLegend={false}
                  series={[
                    { key: "nuevosProspectos", label: "Nuevos prospectos", color: "var(--primary)" },
                    { key: "vendedores", label: "Vendedores", color: "var(--success)" },
                    { key: "ventas", label: "Ventas", color: "var(--warning)" },
                    { key: "polizasGeneradas", label: "Pólizas generadas", color: "var(--info)" },
                  ]}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
      };

      return (
        <>
          {/* Layout para Desktop y Tablet */}
          <div className=" hidden md:flex min-h-dvh" style={{ background: "#f8fafc" }}>
            {/* Sidebar fijo */}
            <div className="sticky top-20 h-[calc(100dvh-80px)] w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar">
              {drawerContent}
            </div>

            {/* Contenido principal */}
            <div className="min-w-0 flex-1">
              {/* Header */}
              <div className="sticky top-[60px] z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card px-4 py-3 shadow-xs md:top-20 md:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-xl font-bold text-corporate md:text-2xl">
                    <FaTachometerAlt className="shrink-0 text-primary" />
                    <span className="truncate">{getVistaTitle()}</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2"></div>
              </div>

              {/* Contenido de la vista */}
              <div className="min-w-0 flex-1">
                <Container fluid className="px-0">
                  {renderVistaContent()}
                </Container>
              </div>
            </div>
          </div>

          {/* Layout para Mobile */}
          <div className=" md:hidden min-h-dvh" style={{ background: "#f8fafc" }}>
            {/* Header mobile */}
            <div className="sticky top-[60px] z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-card px-4 py-3 shadow-xs">
              <Button
                variant="light"
                size="sm"
                onClick={() => setOpenDrawer(true)}
                className="me-2"
              >
                <FaBars />
              </Button>
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0 grow truncate" title={getVistaTitle()}>
                {getVistaTitle()}
              </h6>
              <Button variant="outline-primary" size="sm" onClick={fetchEstadisticas}>
                <FaArrowUp />
              </Button>
            </div>

            {/* Contenido mobile */}
            <div className="p-3">
              <Container fluid className="px-0">
                {renderVistaContent()}
              </Container>
            </div>

            {/* Offcanvas Sidebar para mobile */}
            <Offcanvas
              show={openDrawer}
              onHide={() => setOpenDrawer(false)}
              placement="start"
              className="w-72 max-w-[85vw]"
            >
              <Offcanvas.Body className="p-0">
                {drawerContent}
              </Offcanvas.Body>
            </Offcanvas>
          </div>
        </>
      );
    };
    
    export default BackOfficeDashboard;
