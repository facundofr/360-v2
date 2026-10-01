import { useState, useEffect } from "react";
import { bgSolid } from "@/lib/tone";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Table,
  Button,
  ButtonGroup,
  Pagination
} from "@/components/compat/bootstrap";
import { FaChartBar, FaSync, FaEye } from "@/lib/icons";
import { SimpleBarChart } from "@/components/app/charts";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../../config";

const EstadisticasRefritos = ({ refreshTrigger }) => {
  const [estadisticas, setEstadisticas] = useState(null);
  const [vendedores, setVendedores] = useState([]);
  const [reporteVendedores, setReporteVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingVendedores, setLoadingVendedores] = useState(false);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [todosRefritos, setTodosRefritos] = useState([]);
  const [loadingListado, setLoadingListado] = useState(false);
  const [filtroListado, setFiltroListado] = useState('todos'); // 'todos', 'definitivos', 'pendientes'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    obtenerEstadisticas();
  }, [refreshTrigger]);

  const obtenerEstadisticas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/refritos/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstadisticas(response.data.estadisticas);
      obtenerVendedoresConRefritos();
      obtenerListadoCompleto();
      obtenerReporteVendedores();
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las estadísticas"
      });
    } finally {
      setLoading(false);
    }
  };

  const obtenerListadoCompleto = async () => {
    try {
      setLoadingListado(true);
      const token = localStorage.getItem("cober_token");
      const resp = await axios.get(`${API_URL}/admin/refritos/listar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodosRefritos(resp.data.refritos || []);
    } catch (e) {
      console.error('Error al listar refritos:', e);
    } finally {
      setLoadingListado(false);
    }
  };

  const obtenerVendedoresConRefritos = async () => {
    try {
      setLoadingVendedores(true);
      const token = localStorage.getItem("cober_token");

      // Obtener primero la lista de vendedores
      const vendedoresResponse = await axios.get(`${API_URL}/admin/vendedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Para cada vendedor, obtener sus refritos
      const vendedoresConRefritos = await Promise.all(
        vendedoresResponse.data.map(async (vendedor) => {
          try {
            const refritosResponse = await axios.get(
              `${API_URL}/admin/refritos/vendedor/${vendedor.id}`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            return {
              ...vendedor,
              totalRefritos: refritosResponse.data.totalRefritos,
              refritos: refritosResponse.data.refritos || []
            };
          } catch {
            return {
              ...vendedor,
              totalRefritos: 0,
              refritos: []
            };
          }
        })
      );

      // Filtrar solo vendedores con refritos
      const conRefritos = vendedoresConRefritos.filter(v => v.totalRefritos > 0);
      setVendedores(conRefritos);
    } catch (error) {
      console.error("Error al obtener vendedores:", error);
    } finally {
      setLoadingVendedores(false);
    }
  };

  const obtenerReporteVendedores = async () => {
    try {
      setLoadingReporte(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/refritos/reporte-vendedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReporteVendedores(response.data.reporte || []);
    } catch (error) {
      console.error("Error al obtener reporte de vendedores:", error);
    } finally {
      setLoadingReporte(false);
    }
  };

  // Recalcular paginación ante cambios de filtro o datos
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroListado]);

  // Datos filtrados según el selector
  const filteredRefritos = todosRefritos.filter(r => {
    if (filtroListado === 'definitivos') {
      return r.comentario && r.comentario.includes('DEFINITIVO');
    }
    if (filtroListado === 'pendientes') {
      return r.estado === 'Lead';
    }
    return true;
  });

  // Asegurar que la página actual no exceda el total de páginas al cambiar la lista
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRefritos.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredRefritos.length]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRefritos.length);
  const currentItems = filteredRefritos.slice(startIndex, endIndex);
  const totalPages = Math.max(1, Math.ceil(filteredRefritos.length / pageSize));

  const verRefritosVendedor = async (vendedorId, vendedorNombre) => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/admin/refritos/vendedor/${vendedorId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const refritos = response.data.refritos || [];

      let htmlContenido = `
        <div class="text-start">
          <h6>Refritos de ${vendedorNombre}</h6>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Localidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
      `;

      refritos.forEach((refrito) => {
        htmlContenido += `
          <tr>
            <td>${refrito.nombre} ${refrito.apellido}</td>
            <td>${refrito.numero_contacto}</td>
            <td>${refrito.localidad}</td>
            <td>
              <span class="badge bg-${
                refrito.estado === "Venta"
                  ? "success"
                  : refrito.estado === "No contesta"
                  ? "danger"
                  : "warning"
              }">
                ${refrito.estado}
              </span>
            </td>
          </tr>
        `;
      });

      htmlContenido += `
            </tbody>
          </table>
        </div>
      `;

      Swal.fire({
        title: `📋 Refritos de ${vendedorNombre}`,
        html: htmlContenido,
        icon: "info",
        width: 700
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron obtener los refritos del vendedor"
      });
    }
  };

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
      {/* Botón de actualizar */}
      <Row className="mb-6">
        <Col>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={obtenerEstadisticas}
            disabled={loading}
            className="flex items-center"
          >
            <FaSync className="me-2" />
            Actualizar
          </Button>
        </Col>
      </Row>

      {/* Cards de Estadísticas Principales */}
      {estadisticas && (
        <>
          <Row className="mb-6">
            <Col md={6} lg={3} className="mb-4">
              <Card className="text-center border-0 shadow-xs h-full">
                <Card.Body>
                  <h6 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Total de Refritos</h6>
                  <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-primary mb-0">{estadisticas.total_refritos}</h2>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3} className="mb-4">
              <Card className="text-center border-0 shadow-xs h-full">
                <Card.Body>
                  <h6 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Pendientes de Contacto</h6>
                  <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-warning mb-0">{estadisticas.pendientes}</h2>
                  <small className="text-[0.875em] text-muted-foreground">
                    {estadisticas.total_refritos > 0
                      ? `${((estadisticas.pendientes / estadisticas.total_refritos) * 100).toFixed(1)}%`
                      : "0%"}
                  </small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3} className="mb-4">
              <Card className="text-center border-0 shadow-xs h-full">
                <Card.Body>
                  <h6 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Contactados</h6>
                  <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-info mb-0">{estadisticas.contactados}</h2>
                  <small className="text-[0.875em] text-muted-foreground">
                    {estadisticas.total_refritos > 0
                      ? `${((estadisticas.contactados / estadisticas.total_refritos) * 100).toFixed(1)}%`
                      : "0%"}
                  </small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3} className="mb-4">
              <Card className="text-center border-0 shadow-xs h-full">
                <Card.Body>
                  <h6 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Ventas Concretadas</h6>
                  <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-success mb-0">{estadisticas.ventas}</h2>
                  <small className="text-[0.875em] text-muted-foreground">
                    {estadisticas.total_refritos > 0
                      ? `${((estadisticas.ventas / estadisticas.total_refritos) * 100).toFixed(1)}%`
                      : "0%"}
                  </small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3} className="mb-4">
              <Card className="text-center border-0 shadow-xs h-full">
                <Card.Body>
                  <h6 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">Sin Contacto</h6>
                  <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-destructive mb-0">{estadisticas.sin_contacto}</h2>
                  <small className="text-[0.875em] text-muted-foreground">
                    {estadisticas.total_refritos > 0
                      ? `${((estadisticas.sin_contacto / estadisticas.total_refritos) * 100).toFixed(1)}%`
                      : "0%"}
                  </small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3} className="mb-4">
              <Card className="text-center border-0 shadow-xs h-full border-corporate">
                <Card.Body>
                  <h6 className="mb-4 font-bold tracking-tight text-muted-foreground text-[0.875em]">⛔ Definitivos</h6>
                  <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-foreground mb-0">
                    {todosRefritos.filter(r => r.comentario && r.comentario.includes('DEFINITIVO')).length}
                  </h2>
                  <small className="text-[0.875em] text-muted-foreground">
                    Pasaron por todos los vendedores
                  </small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Desglose por Estado - Gráfico de Barras */}
          {estadisticas.desglose_por_estado && estadisticas.desglose_por_estado.length > 0 && (
            <Row className="mb-6">
              <Col>
                <Card className="shadow-xs border-0">
                  <Card.Header className="bg-muted border-0">
                    <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">📊 Desglose por Estado</h5>
                  </Card.Header>
                  <Card.Body>
                    {(() => {
                      const colorMap = {
                        'Venta': 'var(--success)',
                        'No contesta': 'var(--destructive)',
                        'Lead': 'var(--warning)',
                        '1º Contacto': 'var(--primary)',
                      };
                      const data = [...estadisticas.desglose_por_estado]
                        .sort((a, b) => b.total - a.total)
                        .map(item => ({
                          name: item.estado,
                          value: item.total,
                          label: item.visible_refrito === 1 ? `${item.estado} ✓` : `${item.estado} (cola)`,
                          color: item.visible_refrito === 1
                            ? (colorMap[item.estado] || 'var(--primary)')
                            : '#b3bcc7',
                        }));
                      const chartHeight = Math.max(300, data.length * 40);
                      return (
                        <SimpleBarChart
                          data={data}
                          xKey="label"
                          horizontal
                          showLabels
                          yAxisWidth={170}
                          height={chartHeight}
                          series={[{ key: "value", label: "Refritos", cellColors: data.map((d) => d.color) }]}
                        />
                      );
                    })()}
                    <div className="mt-4 p-4 bg-muted rounded-md flex gap-6 flex-wrap">
                      <span><strong>Total:</strong> {estadisticas.desglose_por_estado.reduce((sum, i) => sum + i.total, 0)} refritos</span>
                      <span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" /> Color = visibles</span> <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#b3bcc7]" /> Gris = en cola</span></span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Reporte de Asignaciones por Vendedor */}
          <Row className="mt-12">
            <Col>
              <Card className="shadow-xs border-0">
                <Card.Header className="bg-muted border-0">
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">📊 Estado de Asignaciones por Vendedor</h5>
                </Card.Header>
                <Card.Body className="p-0">
                  {loadingReporte ? (
                    <div className="p-4 text-center">
                      <Spinner animation="border" />
                    </div>
                  ) : reporteVendedores && reporteVendedores.length > 0 ? (
                    <Table hover responsive className="mb-0" style={{ fontSize: '0.875rem' }}>
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="text-left">Vendedor</th>
                          <th className="text-center">Visibles</th>
                          <th className="text-center">En Cola</th>
                          <th className="text-center">No Contesta</th>
                          <th className="text-center">Trabajados</th>
                          <th className="text-center">Total</th>
                          <th className="text-left" style={{ minWidth: '150px' }}>% Avanzado</th>
                          <th className="text-left" style={{ minWidth: '150px' }}>% Gestionado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...reporteVendedores]
                          .sort((a, b) => {
                            const totalA = a.total_asignaciones || 0;
                            const totalB = b.total_asignaciones || 0;
                            const gestA = totalA > 0 ? (Number(a.no_contesta) + Number(a.otros_estados)) / totalA : 0;
                            const gestB = totalB > 0 ? (Number(b.no_contesta) + Number(b.otros_estados)) / totalB : 0;
                            return gestB - gestA;
                          })
                          .map((vendedor, idx) => {
                            const total = Number(vendedor.total_asignaciones) || 0;
                            const trabajados = Number(vendedor.otros_estados) || 0;
                            const noContesta = Number(vendedor.no_contesta) || 0;
                            const visibles = Number(vendedor.visible_actual) || 0;
                            const enCola = Number(vendedor.en_cola) || 0;
                            const sinRefritos = total === 0;
                            const pctAvanzado = total > 0 ? (trabajados / total) * 100 : 0;
                            const pctGestionado = total > 0 ? ((noContesta + trabajados) / total) * 100 : 0;
                            const gestionadoCompleto = !sinRefritos && Math.round(pctGestionado) === 100;
                            const sinGestion = !sinRefritos && pctGestionado === 0;
                            const barColorAvanzado = pctAvanzado >= 60 ? 'success' : pctAvanzado >= 20 ? 'warning' : 'danger';
                            const barColorGestionado = pctGestionado >= 60 ? 'success' : pctGestionado >= 20 ? 'warning' : 'danger';
                            return (
                              <tr key={idx}>
                                <td className="font-bold">
                                  {vendedor.first_name} {vendedor.last_name}
                                  {gestionadoCompleto && <span className="ms-2 text-success">✅</span>}
                                  {(sinGestion || sinRefritos) && <span className="ms-2 text-warning">⚠️</span>}
                                </td>
                                <td className="text-center">
                                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${visibles > 0 ? 'bg-success' : 'bg-teal'}`}>
                                    {sinRefritos ? '—' : visibles}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${enCola > 10 ? 'bg-info' : enCola > 0 ? 'bg-warning text-foreground' : 'bg-teal'}`}>
                                    {sinRefritos ? '—' : enCola}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-destructive text-white">{sinRefritos ? '—' : noContesta}</span>
                                </td>
                                <td className="text-center">
                                  <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-primary text-white">{sinRefritos ? '—' : trabajados}</span>
                                </td>
                                <td className="text-center font-bold">{sinRefritos ? '—' : total}</td>
                                <td>
                                  {sinRefritos ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <>
                                      <div className="flex justify-between mb-1">
                                        <small className="text-[0.875em] text-muted-foreground">{pctAvanzado.toFixed(1)}%</small>
                                      </div>
                                      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" style={{ height: '8px' }}>
                                        <div
                                          className={`flex h-full items-center justify-center overflow-hidden ${bgSolid(barColorAvanzado)} text-[0.7rem] font-bold text-white transition-[width] duration-500`}
                                          role="progressbar"
                                          style={{ width: `${pctAvanzado}%` }}
                                        />
                                      </div>
                                    </>
                                  )}
                                </td>
                                <td>
                                  {sinRefritos ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <>
                                      <div className="flex justify-between mb-1">
                                        <small className="text-[0.875em] text-muted-foreground">
                                          {pctGestionado.toFixed(1)}%
                                          {gestionadoCompleto && <span className="ms-1 text-success">✅</span>}
                                        </small>
                                      </div>
                                      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" style={{ height: '8px' }}>
                                        <div
                                          className={`flex h-full items-center justify-center overflow-hidden ${bgSolid(barColorGestionado)} text-[0.7rem] font-bold text-white transition-[width] duration-500`}
                                          role="progressbar"
                                          style={{ width: `${pctGestionado}%` }}
                                        />
                                      </div>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="info" className="m-4 mb-0">
                      No hay datos de asignaciones por vendedor.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabla de Vendedores con Refritos */}
          <Row className="mt-12">
            <Col>
              <Card className="shadow-xs border-0">
                <Card.Header className="bg-muted border-0">
                  <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                    👥 Distribución por Vendedor
                    {loadingVendedores && (
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        className="ms-2"
                      />
                    )}
                  </h5>
                </Card.Header>

                <Card.Body className="p-0">
                  {vendedores && vendedores.length > 0 ? (
                    <Table hover className="mb-0">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="text-left">Vendedor</th>
                          <th className="text-left">Total Refritos</th>
                          <th className="text-left">Pendientes</th>
                          <th className="text-left">Contactados</th>
                          <th className="text-left">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendedores.map((vendedor) => {
                          const pendientes = vendedor.refritos.filter(
                            (r) => r.estado === "Lead"
                          ).length;
                          const contactados = vendedor.refritos.filter(
                            (r) => r.estado !== "Lead" && r.estado !== "No contesta"
                          ).length;

                          return (
                            <tr key={vendedor.id}>
                              <td className="font-bold">{vendedor.nombre} {vendedor.apellido}</td>
                              <td>
                                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-primary text-white">
                                  {vendedor.totalRefritos}
                                </span>
                              </td>
                              <td>
                                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-warning text-foreground">
                                  {pendientes}
                                </span>
                              </td>
                              <td>
                                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-info text-white">
                                  {contactados}
                                </span>
                              </td>
                              <td>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() =>
                                    verRefritosVendedor(
                                      vendedor.id,
                                      `${vendedor.nombre} ${vendedor.apellido}`
                                    )
                                  }
                                  className="flex items-center"
                                >
                                  <FaEye className="me-1" /> Ver
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="info" className="m-4 mb-0">
                      No hay refritos asignados aún.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Listado completo de refritos */}
      <Row className="mt-12">
        <Col>
          <Card className="shadow-xs border-0">
            <Card.Header className="bg-muted border-0 flex justify-between items-center flex-wrap gap-2">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">📋 Listado de refritos (asignación actual)</h5>
              <div className="flex gap-2 items-center">
                <ButtonGroup size="sm">
                  <Button 
                    variant={filtroListado === 'todos' ? 'primary' : 'outline-primary'}
                    onClick={() => setFiltroListado('todos')}
                  >
                    Todos
                  </Button>
                  <Button 
                    variant={filtroListado === 'pendientes' ? 'warning' : 'outline-warning'}
                    onClick={() => setFiltroListado('pendientes')}
                  >
                    Pendientes
                  </Button>
                  <Button 
                    variant={filtroListado === 'definitivos' ? 'dark' : 'outline-dark'}
                    onClick={() => setFiltroListado('definitivos')}
                  >
                    ⛔ Definitivos
                  </Button>
                </ButtonGroup>
                <Button variant="outline-secondary" size="sm" onClick={obtenerListadoCompleto} disabled={loadingListado}>
                  <FaSync className="me-2"/>Actualizar
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {loadingListado ? (
                <div className="p-4 text-center">
                  <Spinner animation="border"/>
                </div>
              ) : (
                <Table hover responsive className="mb-0">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left">Prospecto</th>
                      <th className="text-left">Teléfono</th>
                      <th className="text-left">Localidad</th>
                      <th className="text-left">Estado</th>
                      <th className="text-left">Vendedor asignado</th>
                      <th className="text-left">Fecha asignación</th>
                      <th className="text-left">Intentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRefritos.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No hay refritos con este filtro</td></tr>
                    ) : currentItems.map(r => {
                      const esDefinitivo = r.comentario && r.comentario.includes('DEFINITIVO');
                      return (
                        <tr key={`${r.id}-${r.id_vendedor}`} className={esDefinitivo ? 'bg-destructive/5' : ''}>
                          <td>
                            {r.nombre} {r.apellido}
                            {esDefinitivo && (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-corporate ms-2 text-white" title="Pasó por todos los vendedores sin contacto">
                                ⛔ Definitivo
                              </span>
                            )}
                          </td>
                          <td>{r.numero_contacto}</td>
                          <td>{r.localidad}</td>
                          <td>
                            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${bgSolid(r.estado === 'Venta' ? 'success' : r.estado === 'No contesta' ? 'danger' : 'warning')}`}>
                              {r.estado}
                            </span>
                          </td>
                          <td>{r.vendedor}</td>
                          <td>{new Date(r.fecha_asignacion).toLocaleString()}</td>
                          <td>
                            {r.total_intentos ? (
                              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap text-white ${r.total_intentos >= 3 ? 'bg-destructive' : 'bg-teal'}`}>
                                {r.total_intentos} intento{r.total_intentos > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 align-middle text-xs leading-normal font-bold whitespace-nowrap bg-teal text-white">1</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card.Body>
            <Card.Footer className="bg-muted flex justify-between items-center flex-wrap gap-2">
              <div className="text-muted-foreground text-[0.875em]">
                {filteredRefritos.length > 0
                  ? `Mostrando ${startIndex + 1}–${endIndex} de ${filteredRefritos.length}`
                  : 'Sin resultados'}
              </div>
              <Pagination className="mb-0">
                <Pagination.First disabled={currentPage === 1} onClick={() => setCurrentPage(1)} />
                <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
                <Pagination.Item active>{currentPage}</Pagination.Item>
                <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
                <Pagination.Last disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} />
              </Pagination>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default EstadisticasRefritos;
