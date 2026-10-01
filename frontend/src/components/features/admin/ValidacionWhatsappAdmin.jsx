import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { Row, Col, Card, Button, Table, Badge, Spinner, Alert, Form, ProgressBar, Pagination } from "@/components/compat/bootstrap";
import { FaSync, FaWhatsapp, FaCheckCircle, FaHourglassHalf, FaTimesCircle, FaClock, FaFireAlt, FaSearch, FaCommentDots } from "@/lib/icons";
import Swal from "@/lib/alerts";
import { ChartJsBar, ChartJsLine } from "@/components/app/charts";
import ValidacionConversacionModal from "./ValidacionConversacionModal";


const ESTADOS = [
  { key: "urgentes", label: "Interesado (urgente)", color: "#198754", bg: "success" },
  { key: "averiguando", label: "Averiguando", color: "var(--teal)", bg: "success" },
  { key: "pendientes", label: "Pendientes", color: "#0dcaf0", bg: "info" },
  { key: "timeout", label: "Sin respuesta (auto)", color: "#ffc107", bg: "warning" },
  { key: "corregir", label: "A corregir", color: "#dc3545", bg: "danger" },
  { key: "no_interesado", label: "No interesado", color: "#6c757d", bg: "secondary" },
];

const ESTADO_BADGE = {
  "Pendiente validación WhatsApp": "info",
  "Validación: esperando confirmación": "info",
  "Lead": "success",
  "Lead (validado - interesado)": "success",
  "Lead (validado - averiguando)": "success",
  "Lead (sin respuesta a validación)": "warning",
  "Corregir datos": "danger",
  "No interesado": "secondary",
};

const ESTADO_FILTRO_OPCIONES = [
  { value: "", label: "Todos los estados" },
  { value: "Pendiente validación WhatsApp", label: "Pendiente validación WhatsApp" },
  { value: "Validación: esperando confirmación", label: "Esperando confirmación" },
  { value: "Lead (validado - interesado)", label: "Validado - interesado (urgente)" },
  { value: "Lead (validado - averiguando)", label: "Validado - averiguando" },
  { value: "Lead (sin respuesta a validación)", label: "Sin respuesta (auto-asignado)" },
  { value: "Corregir datos", label: "Corregir datos" },
  { value: "No interesado", label: "No interesado" },
];

const PAGE_SIZE = 20;

export default function ValidacionWhatsappAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [activo, setActivo] = useState(false);
  const [cupoDiario, setCupoDiario] = useState(20);

  const [prospectos, setProspectos] = useState({ rows: [], total: 0, page: 1, limit: PAGE_SIZE });
  const [prospectosLoading, setProspectosLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const [conversacionProspectoId, setConversacionProspectoId] = useState(null);

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
      const [configRes, metricasRes] = await Promise.all([
        http.get(`/admin/validacion-whatsapp`),
        http.get(`/admin/validacion-whatsapp/metricas`),
      ]);
      setActivo(!!configRes.data?.data?.activo);
      setCupoDiario(configRes.data?.data?.cupo_diario ?? 20);
      setMetricas(metricasRes.data?.data || null);
      await fetchProspectos(pagina, filtroEstado, busqueda);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || "Error al cargar la información");
    } finally {
      setLoading(false);
    }
  };

  const fetchProspectos = async (page = pagina, estado = filtroEstado, search = busqueda) => {
    setProspectosLoading(true);
    try {
      const res = await http.get(`/admin/validacion-whatsapp/prospectos`, {
        params: { page, limit: PAGE_SIZE, estado: estado || undefined, search: search || undefined },
      });
      setProspectos(res.data?.data || { rows: [], total: 0, page: 1, limit: PAGE_SIZE });
    } catch (e) {
      console.error(e);
    } finally {
      setProspectosLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (pagina !== 1) {
        setPagina(1);
      } else {
        fetchProspectos(1, filtroEstado, busqueda);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, busqueda]);

  useEffect(() => {
    fetchProspectos(pagina, filtroEstado, busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  const guardarConfig = async (nuevoActivo, nuevoCupo) => {
    setSaving(true);
    try {
      const res = await http.put(`/admin/validacion-whatsapp`, {
        activo: nuevoActivo,
        cupo_diario: nuevoCupo,
      });
      setActivo(!!res.data?.data?.activo);
      setCupoDiario(res.data?.data?.cupo_diario ?? nuevoCupo);
      await fetchAll();
    } catch (e) {
      Swal.fire("Error", e?.response?.data?.message || "No se pudo actualizar la configuración", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (checked) => {
    if (checked) {
      const result = await Swal.fire({
        title: "¿Activar el validador de WhatsApp?",
        text: `A partir de ahora, hasta ${cupoDiario} leads por día se van a derivar al circuito de validación antes de asignarse a un vendedor.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, activar",
        cancelButtonText: "Cancelar",
      });
      if (!result.isConfirmed) return;
    }
    setActivo(checked);
    await guardarConfig(checked, cupoDiario);
  };

  const guardarCupo = async () => {
    await guardarConfig(activo, Number(cupoDiario));
  };

  const totales = metricas?.totales || {};
  const cupo = metricas?.cupo || { usado_hoy: 0, cupo_diario: cupoDiario, activo };
  const cupoPct = cupo.cupo_diario > 0 ? Math.min(100, Math.round((cupo.usado_hoy / cupo.cupo_diario) * 100)) : 0;

  const chartData = useMemo(() => {
    const t = metricas?.totales || {};
    return {
      labels: ESTADOS.map((e) => e.label),
      datasets: [
        {
          label: "Prospectos",
          data: ESTADOS.map((e) => t[e.key] || 0),
          backgroundColor: ESTADOS.map((e) => e.color),
        },
      ],
    };
  }, [metricas]);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  const tendenciaData = useMemo(() => {
    const t = metricas?.tendencia || [];
    return {
      labels: t.map((d) => new Date(`${d.fecha}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })),
      datasets: [
        {
          label: "Enviados",
          data: t.map((d) => d.enviados),
          borderColor: "#0d6efd",
          backgroundColor: "#0d6efd",
          tension: 0.3,
        },
        {
          label: "Confirmados",
          data: t.map((d) => d.confirmados),
          borderColor: "#198754",
          backgroundColor: "#198754",
          tension: 0.3,
        },
      ],
    };
  }, [metricas]);

  const tendenciaOptions = {
    responsive: true,
    plugins: { legend: { display: true, position: "top" } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  const GESTION_BUCKETS = [
    { key: "urgente", label: "Urgente", color: "var(--success)", icon: FaFireAlt },
    { key: "averiguando", label: "Averiguando", color: "#20c997", icon: FaCommentDots },
    { key: "otros", label: "Otros (sin respuesta / legacy)", color: "var(--warning)", icon: FaHourglassHalf },
  ];

  const gestionChartOptionsBase = {
    indexAxis: "y",
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  const buildGestionChartData = (bucketKey, color) => {
    const rows = metricas?.porEstadoGestion?.[bucketKey] || [];
    return {
      labels: rows.map((r) => r.estado),
      datasets: [
        {
          label: "Prospectos",
          data: rows.map((r) => r.total),
          backgroundColor: color,
        },
      ],
    };
  };

  const totalPaginas = Math.max(1, Math.ceil((prospectos.total || 0) / (prospectos.limit || PAGE_SIZE)));

  return (
    <div className="grid gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FaWhatsapp className="text-success" />
          <span className="font-bold">Validador de leads por WhatsApp</span>
        </div>
        <Button variant="primary" onClick={fetchAll} disabled={loading}>
          <FaSync className="me-1" /> Actualizar
        </Button>
      </div>

      {error && <Alert variant="danger" className="mb-0">{error}</Alert>}

      {loading ? (
        <div className="text-center py-12">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          <Card>
            <Card.Body>
              <Row className="items-center [--gx:1rem] [--gy:1rem]">
                <Col md="auto">
                  <Form.Check
                    type="switch"
                    id="validacion-activa-switch"
                    label={<span className="font-semibold">Circuito de validación</span>}
                    checked={activo}
                    disabled={saving}
                    onChange={(e) => handleToggle(e.target.checked)}
                  />
                  <Badge bg={activo ? "success" : "secondary"} className="mt-1">
                    {activo ? "Activo" : "Inactivo"}
                  </Badge>
                </Col>
                <Col md="auto">
                  <Form.Label className="mb-0 text-[0.875em] text-muted-foreground">Cupo diario</Form.Label>
                  <div className="flex gap-2">
                    <Form.Control
                      type="number"
                      min={0}
                      style={{ width: 100 }}
                      value={cupoDiario}
                      disabled={saving}
                      onChange={(e) => setCupoDiario(e.target.value)}
                    />
                    <Button variant="outline-primary" size="sm" onClick={guardarCupo} disabled={saving}>
                      Guardar
                    </Button>
                  </div>
                </Col>
                <Col>
                  <div className="text-[0.875em] text-muted-foreground">Cupo usado hoy</div>
                  <ProgressBar
                    now={cupoPct}
                    label={`${cupo.usado_hoy}/${cupo.cupo_diario}`}
                    variant={cupoPct >= 100 ? "danger" : "primary"}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Row className="[--gx:1rem] [--gy:1rem]">
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Enviados a validación</div>
                  <div className="text-[2.5rem] leading-tight font-bold">{totales.total_enviados || 0}</div>
                  <div className="text-[0.875em] text-muted-foreground">Desde que existe el circuito</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Tasa de confirmación</div>
                  <div className="text-[1.25rem] font-bold leading-snug mb-1 text-success">
                    <FaCheckCircle className="me-1" />
                    {metricas?.tasa_confirmacion_pct != null ? `${metricas.tasa_confirmacion_pct}%` : "—"}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Sobre los ya resueltos</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Tiempo promedio de respuesta</div>
                  <div className="text-[1.25rem] font-bold leading-snug mb-1 text-info">
                    <FaClock className="me-1" />
                    {metricas?.tiempo_promedio_respuesta_minutos != null
                      ? `${metricas.tiempo_promedio_respuesta_minutos} min`
                      : "—"}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Envío del template → resolución</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Pendientes ahora</div>
                  <div className="text-[1.25rem] font-bold leading-snug mb-1 text-warning">
                    <FaHourglassHalf className="me-1" />
                    {totales.pendientes || 0}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Esperando respuesta del lead</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="[--gx:1rem] [--gy:1rem]">
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Interesados (urgente)</div>
                  <div className="text-[1.25rem] font-bold leading-snug mb-1 text-success">
                    <FaFireAlt className="me-1" />
                    {totales.urgentes || 0}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Quieren avanzar lo antes posible</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Averiguando</div>
                  <div className="text-[1.25rem] font-bold leading-snug text-corporate mb-1" style={{ color: "#20c997" }}>
                    <FaCommentDots className="me-1" />
                    {totales.averiguando || 0}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Confirmaron datos, sin apuro</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Tasa sin respuesta</div>
                  <div className="text-[1.25rem] font-bold leading-snug mb-1 text-warning">
                    {metricas?.tasa_timeout_pct != null ? `${metricas.tasa_timeout_pct}%` : "—"}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Auto-asignados por timeout (2h)</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-full">
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Tasa no interesado</div>
                  <div className="text-[1.25rem] font-bold leading-snug mb-1 text-teal">
                    {metricas?.tasa_no_interesado_pct != null ? `${metricas.tasa_no_interesado_pct}%` : "—"}
                  </div>
                  <div className="text-[0.875em] text-muted-foreground">Sobre los ya resueltos</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="[--gx:1rem] [--gy:1rem]">
            <Col md={5}>
              <Card className="h-full">
                <Card.Header className="flex items-center gap-2">
                  <FaCheckCircle className="text-success" />
                  <span className="font-semibold">Resultado del circuito</span>
                </Card.Header>
                <Card.Body>
                  {totales.total_enviados > 0 ? (
                    <ChartJsBar data={chartData} height={280} />
                  ) : (
                    <div className="text-muted-foreground">Todavía no se derivó ningún lead al validador.</div>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={7}>
              <Card className="h-full">
                <Card.Header className="flex items-center gap-2">
                  <FaClock className="text-info" />
                  <span className="font-semibold">Envíos y confirmaciones (últimos 14 días)</span>
                </Card.Header>
                <Card.Body>
                  {metricas?.tendencia?.length > 0 ? (
                    <ChartJsLine data={tendenciaData} height={280} />
                  ) : (
                    <div className="text-muted-foreground">Todavía no hay historial suficiente.</div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card>
            <Card.Header className="flex items-center gap-2">
              <FaWhatsapp className="text-success" />
              <span className="font-semibold">Qué pasa con los prospectos después de asignarse al vendedor</span>
            </Card.Header>
            <Card.Body>
              <Row className="[--gx:1rem] [--gy:1rem]">
                {GESTION_BUCKETS.map((b) => {
                  const rows = metricas?.porEstadoGestion?.[b.key] || [];
                  const total = rows.reduce((acc, r) => acc + r.total, 0);
                  const Icon = b.icon;
                  return (
                    <Col md={4} key={b.key}>
                      <Card className="h-full">
                        <Card.Header className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-semibold" style={{ color: b.color }}>
                            <Icon /> {b.label}
                          </span>
                          <Badge bg="light" text="dark">{total}</Badge>
                        </Card.Header>
                        <Card.Body>
                          {rows.length > 0 ? (
                            <ChartJsBar
                              data={buildGestionChartData(b.key, b.color)}
                              horizontal
                              showLabels
                              height={Math.max(180, rows.length * 32)}
                            />
                          ) : (
                            <div className="text-muted-foreground">Sin prospectos en este grupo todavía.</div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FaTimesCircle className="text-teal" />
                <span className="font-semibold">Números derivados al validador y su último estado</span>
                <Badge bg="light" text="dark">{prospectos.total || 0}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <FaSearch className="absolute text-muted-foreground" style={{ left: 10, top: 10 }} />
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Buscar por nombre o teléfono"
                    style={{ paddingLeft: 30, minWidth: 220 }}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
                <Form.Select
                  size="sm"
                  style={{ minWidth: 220 }}
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  {ESTADO_FILTRO_OPCIONES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Form.Select>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="w-full overflow-x-auto">
                <Table hover className="mb-0 align-middle">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left">Prospecto</th>
                      <th className="text-left">Teléfono</th>
                      <th className="text-left">Estado</th>
                      <th className="text-left">Enviado</th>
                      <th className="text-left">Resuelto</th>
                      <th className="text-left">Conversación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospectosLoading && (
                      <tr>
                        <td colSpan={6} className="text-center py-6">
                          <Spinner animation="border" size="sm" variant="primary" />
                        </td>
                      </tr>
                    )}
                    {!prospectosLoading && prospectos.rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted-foreground py-4">
                          Sin datos para mostrar
                        </td>
                      </tr>
                    )}
                    {!prospectosLoading && prospectos.rows.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre} {p.apellido}</td>
                        <td>{p.numero_contacto}</td>
                        <td>
                          <Badge bg={ESTADO_BADGE[p.estado] || "dark"}>{p.estado}</Badge>
                        </td>
                        <td className="text-[0.875em] text-muted-foreground">
                          {p.validacion_enviada_at ? new Date(p.validacion_enviada_at).toLocaleString("es-AR") : "—"}
                        </td>
                        <td className="text-[0.875em] text-muted-foreground">
                          {p.validacion_resuelta_at ? new Date(p.validacion_resuelta_at).toLocaleString("es-AR") : "—"}
                        </td>
                        <td>
                          <Button
                            variant="outline-success"
                            size="sm"
                            disabled={!p.tiene_conversacion}
                            onClick={() => setConversacionProspectoId(p.id)}
                          >
                            <FaWhatsapp className="me-1" />
                            Ver chat
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
            {totalPaginas > 1 && (
              <Card.Footer className="flex justify-center">
                <Pagination className="mb-0">
                  <Pagination.Prev
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  />
                  <Pagination.Item disabled>{pagina} / {totalPaginas}</Pagination.Item>
                  <Pagination.Next
                    disabled={pagina >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  />
                </Pagination>
              </Card.Footer>
            )}
          </Card>
        </>
      )}

      <ValidacionConversacionModal
        show={!!conversacionProspectoId}
        onHide={() => setConversacionProspectoId(null)}
        prospectoId={conversacionProspectoId}
      />
    </div>
  );
}
