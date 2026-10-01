import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { Row, Col, Card, Button, Table, Badge, Spinner, Alert, Accordion, Form } from "@/components/compat/bootstrap";
import { ChartJsBar } from "@/components/app/charts";
import { FaSync, FaChartLine, FaClock, FaCheckCircle } from "@/lib/icons";


export default function ReasignacionAutomaticaAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estadisticasEfectividad, setEstadisticasEfectividad] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [anioFeriados, setAnioFeriados] = useState(new Date().getFullYear());
  const [loadingFeriados, setLoadingFeriados] = useState(false);
  const [mesFeriados, setMesFeriados] = useState(new Date().getMonth()); // 0-11

  const token = useMemo(() => localStorage.getItem("cober_token"), []);

  const http = useMemo(() => {
    const instance = axios.create({ baseURL: API_URL });
    instance.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [token]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [efectividadRes, candRes] = await Promise.all([
        http.get(`/reasignaciones/estadisticas-efectividad`),
        http.get(`/reasignaciones/candidatos`),
      ]);
      setEstadisticasEfectividad(efectividadRes.data || null);
      setCandidatos(candRes.data?.candidatos || []);
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message || e?.message || "Error al cargar la información"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchFeriados = async (anio, opts = {}) => {
    setLoadingFeriados(true);
    try {
      const res = await http.get(`/reasignaciones/feriados`, {
        params: { anio, refresh: opts.refresh ? 1 : 0 },
      });
      setFeriados(res.data?.holidays || []);
    } catch (e) {
      console.error(e);
      // no romper la vista principal
    } finally {
      setLoadingFeriados(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchFeriados(anioFeriados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioFeriados]);

  const efectividadPorHora = estadisticasEfectividad?.efectividad_por_hora || [];
  const resumenEfectividadHoy = estadisticasEfectividad?.resumen_hoy || {};
  const ultimaEjecucion = efectividadPorHora[0] || null; // viene ordenado DESC desde backend

  const promedioActividad = useMemo(() => {
    if (!efectividadPorHora.length) return 0;
    const sum = efectividadPorHora.reduce(
      (acc, e) => acc + (Number(e.porcentaje_con_actividad) || 0),
      0
    );
    return Math.round(sum / efectividadPorHora.length);
  }, [efectividadPorHora]);

  const promedioCambioEstado = useMemo(() => {
    if (!efectividadPorHora.length) return 0;
    const sum = efectividadPorHora.reduce(
      (acc, e) => acc + (Number(e.porcentaje_cambio_estado) || 0),
      0
    );
    return Math.round(sum / efectividadPorHora.length);
  }, [efectividadPorHora]);

  const chartEfectividadData = useMemo(() => {
    const labels = efectividadPorHora.map((e) => e.hora_ejecucion).reverse();
    const cambioEstado = efectividadPorHora
      .map((e) => Number(e.porcentaje_cambio_estado || 0))
      .reverse();
    const actividad = efectividadPorHora
      .map((e) => Number(e.porcentaje_con_actividad || 0))
      .reverse();
    return {
      labels,
      datasets: [
        {
          label: "% Cambio de estado",
          data: cambioEstado,
          backgroundColor: "#0d6efd",
        },
        {
          label: "% Actividad posterior",
          data: actividad,
          backgroundColor: "#20c997",
        },
      ],
    };
  }, [efectividadPorHora]);

  const chartEfectividadOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y ?? ctx.parsed.x ?? 0}%`,
        },
      },
    },
    scales: {
      y: { suggestedMax: 100, ticks: { callback: (v) => `${v}%` } },
    },
  };

  const horasMostradas = efectividadPorHora.slice(0, 6);

  const feriadosPorMes = useMemo(() => {
    const map = new Map();
    feriados.forEach((f) => {
      const d = new Date(f.date + 'T00:00:00');
      const mes = d.getMonth(); // 0-11
      if (!map.has(mes)) map.set(mes, []);
      map.get(mes).push(f);
    });
    // ordenar por fecha dentro de cada mes
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      map.set(k, arr);
    }
    return map;
  }, [feriados]);

  const nombreMes = (i) =>
    [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ][i];

  const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // lunes a domingo

  const feriadosSet = useMemo(() => new Set(feriados.map(f => f.date)), [feriados]);

  const pad2 = (n) => String(n).padStart(2, '0');
  const isoLocal = (y, m0, d) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`; // m0 base 0

  const buildMonthMatrix = (y, m0) => {
    // semana inicia lunes
    const first = new Date(y, m0, 1);
    let startIdx = first.getDay(); // 0 dom .. 6 sab
    startIdx = (startIdx + 6) % 7; // convertir a 0=lunes .. 6=domingo
    const daysInMonth = new Date(y, m0 + 1, 0).getDate();
    const prevMonthDays = new Date(y, m0, 0).getDate();
    const cells = [];
    // prev
    for (let i = 0; i < startIdx; i++) {
      const day = prevMonthDays - startIdx + 1 + i;
      const date = new Date(y, m0 - 1, day);
      const iso = isoLocal(date.getFullYear(), date.getMonth(), date.getDate());
      cells.push({ date, inMonth: false, iso, isHoliday: feriadosSet.has(iso) });
    }
    // month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m0, d);
      const iso = isoLocal(y, m0, d);
      cells.push({ date, inMonth: true, iso, isHoliday: feriadosSet.has(iso) });
    }
    // next
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      const iso = isoLocal(next.getFullYear(), next.getMonth(), next.getDate());
      cells.push({ date: next, inMonth: false, iso, isHoliday: feriadosSet.has(iso) });
    }
    // asegurar 6 filas
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      const iso = isoLocal(next.getFullYear(), next.getMonth(), next.getDate());
      cells.push({ date: next, inMonth: false, iso, isHoliday: feriadosSet.has(iso) });
    }
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));
    return rows;
  };

  const matrix = useMemo(() => buildMonthMatrix(anioFeriados, mesFeriados), [anioFeriados, mesFeriados, feriadosSet]);

  return (
    <div className="grid gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FaChartLine className="text-primary" />
          <span className="font-bold">Reasignación automática — vista simple</span>
        </div>
        <Button variant="primary" onClick={fetchAll} disabled={loading}>
          <FaSync className="me-1" /> Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-0">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          <Row className="[--gx:1rem] [--gy:1rem]">
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Última corrida</div>
                  {ultimaEjecucion ? (
                    <>
                      <div className="text-[1.125rem] font-bold leading-snug text-corporate mb-0">{ultimaEjecucion.hora_ejecucion}</div>
                      <div className="text-[0.875em] text-muted-foreground">{ultimaEjecucion.total_reasignados} reasignados</div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Sin ejecuciones hoy</div>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Efectividad hoy</div>
                  <div className="text-[1.125rem] font-bold leading-snug text-corporate mb-1">{resumenEfectividadHoy.porcentaje_efectividad_hoy || 0}%</div>
                  <div className="text-[0.875em] text-muted-foreground">Con actividad: {resumenEfectividadHoy.con_actividad_hoy || 0}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Promedio por hora</div>
                  <div className="text-base font-bold leading-snug mb-1 text-primary">Actividad {promedioActividad}%</div>
                  <div className="text-base font-bold leading-snug mb-0 text-info">Cambio de estado {promedioCambioEstado}%</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Candidatos en cola</div>
                  <div className="text-[2.5rem] leading-tight font-bold">{candidatos.length}</div>
                  <div className="text-[0.875em] text-muted-foreground">Pendientes de actividad</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card>
            <Card.Header className="flex items-center gap-2">
              <FaCheckCircle className="text-success" />
              <span className="font-semibold">Efectividad por hora (hoy)</span>
            </Card.Header>
            <Card.Body>
              {efectividadPorHora.length === 0 ? (
                <div className="text-muted-foreground">No hay ejecuciones registradas hoy.</div>
              ) : (
                <ChartJsBar data={chartEfectividadData} height={280} valueFormatter={(v) => `${v}%`} />
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="flex items-center gap-2">
              <FaClock className="text-teal" />
              <span className="font-semibold">Detalle rápido de las últimas horas</span>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="w-full overflow-x-auto">
                <Table hover className="mb-0 align-middle">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left">Hora</th>
                      <th className="text-right">Reasignados</th>
                      <th className="text-right">% Actividad</th>
                      <th className="text-right">% Cambio de estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horasMostradas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted-foreground py-4">
                          Sin datos para mostrar
                        </td>
                      </tr>
                    )}
                    {horasMostradas.map((h, idx) => (
                      <tr key={idx}>
                        <td>
                          <Badge bg="dark">{h.hora_ejecucion}</Badge>
                        </td>
                        <td className="text-right font-bold">{h.total_reasignados}</td>
                        <td className="text-right text-success">{h.porcentaje_con_actividad || 0}%</td>
                        <td className="text-right text-info">{h.porcentaje_cambio_estado || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body className="bg-muted">
              <div className="text-[0.875em] text-muted-foreground">
                Esta vista muestra solo lo esencial: última corrida, efectividad del día, promedios por hora y backlog de candidatos. Para más detalle puedes consultar los reportes históricos.
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Feriados nacionales (Argentina)</span>
              </div>
              <div className="flex items-center gap-2">
                <Form.Select
                  size="sm"
                  value={mesFeriados}
                  onChange={(e) => setMesFeriados(Number(e.target.value))}
                  style={{ width: 150 }}
                >
                  {Array.from({ length: 12 }).map((_, m) => (
                    <option key={m} value={m}>{nombreMes(m)}</option>
                  ))}
                </Form.Select>
                <Form.Select
                  size="sm"
                  value={anioFeriados}
                  onChange={(e) => setAnioFeriados(Number(e.target.value))}
                  style={{ width: 110 }}
                >
                  {[anioFeriados - 1, anioFeriados, anioFeriados + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Form.Select>
                <Button variant="outline-secondary" size="sm" onClick={() => fetchFeriados(anioFeriados, { refresh: true })} disabled={loadingFeriados}>
                  {loadingFeriados ? <Spinner animation="border" size="sm" /> : 'Refrescar'}
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {loadingFeriados ? (
                <div className="text-center py-4"><Spinner animation="border" variant="primary" /></div>
              ) : feriados.length === 0 ? (
                <div className="text-muted-foreground">Sin datos de feriados para {anioFeriados}.</div>
              ) : (
                <>
                  {/* Calendario mensual */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-semibold">{nombreMes(mesFeriados)} {anioFeriados}</div>
                      <div className="text-[0.875em] text-muted-foreground">Días feriados marcados en verde</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                      {diasSemana.map((d) => (
                        <div key={d} className="text-center text-[0.875em] text-muted-foreground">{d}</div>
                      ))}
                      {matrix.flat().map((cell, idx) => (
                        <div
                          key={idx}
                          className="border rounded-md p-2 text-center"
                          style={{
                            backgroundColor: cell.isHoliday ? '#e6f4ea' : '#fff',
                            opacity: cell.inMonth ? 1 : 0.5,
                            minHeight: 48
                          }}
                          title={cell.isHoliday ? (feriados.find(f => f.date === cell.iso)?.localName || feriados.find(f => f.date === cell.iso)?.name) : ''}
                        >
                          <div className="font-semibold" style={{ lineHeight: 1 }}>{cell.date.getDate()}</div>
                          {cell.isHoliday && <Badge bg="success" size="sm">Feriado</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lista agrupada por mes */}
                  <Accordion alwaysOpen>
                  {Array.from({ length: 12 }).map((_, mes) => {
                    const items = feriadosPorMes.get(mes) || [];
                    return (
                      <Accordion.Item eventKey={String(mes)} key={mes}>
                        <Accordion.Header>
                          <div className="flex items-center gap-2">
                            <span>{nombreMes(mes)}</span>
                            <Badge bg="secondary">{items.length}</Badge>
                          </div>
                        </Accordion.Header>
                        <Accordion.Body>
                          {items.length === 0 ? (
                            <div className="text-muted-foreground text-[0.875em]">Sin feriados</div>
                          ) : (
                            <div className="w-full overflow-x-auto">
                              <Table hover size="sm" className="mb-0">
                                <thead>
                                  <tr>
                                    <th className="text-left" style={{ width: 140 }}>Fecha</th>
                                    <th className="text-left">Nombre</th>
                                    <th className="text-left">Tipo</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((f, idx) => (
                                    <tr key={idx}>
                                      <td><Badge bg="dark">{f.date}</Badge></td>
                                      <td>{f.localName || f.name}</td>
                                      <td>
                                        {(Array.isArray(f.types) ? f.types : [f.type || 'Public']).map((t, i) => (
                                          <Badge key={i} bg={t === 'Public' ? 'success' : 'info'} className="me-1">{t}</Badge>
                                        ))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>
                    );
                  })}
                  </Accordion>
                </>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
