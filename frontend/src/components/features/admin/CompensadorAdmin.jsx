import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { Row, Col, Card, Button, Table, Badge, Spinner, Alert, Form, Nav, Modal } from "@/components/compat/bootstrap";
import { FaSync, FaPause, FaPlay, FaEdit, FaUsers, FaBan, FaCheckCircle } from "@/lib/icons";
import Swal from "@/lib/alerts";

// Dashboard nativo del compensador de leads (balanceador entre Producción y
// Bariloche). No le habla directo al Lead Router — pasa por
// backend/routes/admin/compensadorRoutes.js, que reenvía la llamada
// autenticado como servicio confiable. Misma información en el admin de las
// dos unidades: este componente es intencionalmente idéntico al de Bariloche,
// salvo la clave de localStorage del token ("cober_token" acá, "token" allá).

const ESTADO_SALUD_BADGE = { sana: "success", degradada: "danger", desconocida: "secondary" };

export default function CompensadorAdmin() {
  const token = useMemo(() => localStorage.getItem("cober_token"), []);
  const http = useMemo(() => {
    const instance = axios.create({ baseURL: `${API_URL}/admin/compensador` });
    instance.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [token]);

  const [tab, setTab] = useState("unidades");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [unidades, setUnidades] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [latencias, setLatencias] = useState(null);
  const [eventos, setEventos] = useState([]);

  const [editando, setEditando] = useState(null); // unidad en edición, o null
  const [vendedoresDe, setVendedoresDe] = useState(null); // unidad cuyos vendedores se muestran, o null
  const [vendedores, setVendedores] = useState([]);
  const [vendedoresLoading, setVendedoresLoading] = useState(false);

  const cargarTodo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, rRes, lRes, eRes] = await Promise.all([
        http.get("/unidades"),
        http.get("/metricas/resumen"),
        http.get("/metricas/latencias"),
        http.get("/metricas/eventos?limite=30"),
      ]);
      setUnidades(uRes.data);
      setResumen(rRes.data);
      setLatencias(lRes.data);
      setEventos(eRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo cargar el compensador de leads");
    } finally {
      setLoading(false);
    }
  }, [http]);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  async function pausar(unidad) {
    const confirm = await Swal.fire({
      icon: "warning",
      title: `¿Pausar ${unidad.nombre}?`,
      text: "Sale del reparto de leads hasta que se reactive.",
      showCancelButton: true,
      confirmButtonText: "Pausar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await http.post(`/unidades/${unidad.id}/pausar`, { motivo: "Pausada desde el admin" });
      await Swal.fire({ icon: "success", title: "Pausada", timer: 1500 });
      cargarTodo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo pausar" });
    }
  }

  async function reactivar(unidad) {
    try {
      await http.post(`/unidades/${unidad.id}/reactivar`);
      await Swal.fire({ icon: "success", title: "Reactivada", timer: 1500 });
      cargarTodo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo reactivar" });
    }
  }

  async function recalcularPeso(unidad) {
    try {
      await http.post(`/unidades/${unidad.id}/recalcular-peso`);
      cargarTodo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo recalcular" });
    }
  }

  async function abrirVendedores(unidad) {
    setVendedoresDe(unidad);
    setVendedoresLoading(true);
    try {
      const { data } = await http.get(`/unidades/${unidad.id}/vendedores`);
      setVendedores(data.vendedores || []);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo leer vendedores" });
    } finally {
      setVendedoresLoading(false);
    }
  }

  async function excluirVendedor(vendedor) {
    const { value: motivo } = await Swal.fire({
      title: `Excluir a ${vendedor.email}`,
      input: "text",
      inputLabel: "Motivo",
      inputPlaceholder: "ej. cuenta de prueba, sin verificar",
      showCancelButton: true,
      confirmButtonText: "Excluir",
    });
    if (!motivo) return;
    try {
      await http.post(`/unidades/${vendedoresDe.id}/vendedores/excluir`, {
        vendedorId: vendedor.id,
        vendedorRef: vendedor.email,
        motivo,
      });
      abrirVendedores(vendedoresDe);
      cargarTodo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo excluir" });
    }
  }

  async function incluirVendedor(vendedor) {
    try {
      await http.delete(`/unidades/${vendedoresDe.id}/vendedores/${vendedor.id}/excluir`);
      abrirVendedores(vendedoresDe);
      cargarTodo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo incluir" });
    }
  }

  async function guardarEdicion(datos) {
    try {
      await http.put(`/unidades/${editando.id}`, datos);
      setEditando(null);
      cargarTodo();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "No se pudo guardar" });
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-corporate mb-0">Compensador de leads</h4>
        <Button variant="outline-secondary" size="sm" onClick={cargarTodo}>
          <FaSync className="me-1" /> Actualizar
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Nav variant="tabs" activeKey={tab} onSelect={setTab} className="mb-4">
        <Nav.Item><Nav.Link eventKey="unidades">Unidades</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="metricas">Métricas</Nav.Link></Nav.Item>
      </Nav>

      {tab === "unidades" && (
        <Card>
          <Card.Body>
            <div className="w-full overflow-x-auto">
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th className="text-left">Unidad</th>
                    <th className="text-left">Webhook</th>
                    <th className="text-right">Vendedores</th>
                    <th className="text-right">Peso</th>
                    <th className="text-left">Salud</th>
                    <th className="text-left">Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((u) => {
                    const r = resumen?.unidades?.find((x) => x.unidadId === u.id);
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="font-semibold">{u.nombre}</div>
                          <small className="text-[0.875em] text-muted-foreground">{u.slug}</small>
                        </td>
                        <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <small className="text-[0.875em]">{u.webhook_url}</small>
                        </td>
                        <td className="text-right">{u.tipo === "cober360_crm" ? (u.vendedores_efectivos_cache ?? "—") : "—"}</td>
                        <td className="text-right">{r?.pesoConfiguradoPct != null ? `${r.pesoConfiguradoPct}%` : "—"}</td>
                        <td><Badge bg={ESTADO_SALUD_BADGE[u.salud_estado] || "secondary"}>{u.salud_estado}</Badge></td>
                        <td><Badge bg={u.activa ? "light" : "warning"} text={u.activa ? "dark" : undefined}>{u.activa ? "activa" : "pausada"}</Badge></td>
                        <td className="text-right">
                          {u.tipo === "cober360_crm" && (
                            <Button variant="link" size="sm" title="Vendedores" onClick={() => abrirVendedores(u)}>
                              <FaUsers />
                            </Button>
                          )}
                          <Button variant="link" size="sm" title="Recalcular peso" onClick={() => recalcularPeso(u)}>
                            <FaSync />
                          </Button>
                          <Button variant="link" size="sm" title="Editar" onClick={() => setEditando(u)}>
                            <FaEdit />
                          </Button>
                          {u.activa ? (
                            <Button variant="link" size="sm" title="Pausar" className="text-destructive" onClick={() => pausar(u)}>
                              <FaPause />
                            </Button>
                          ) : (
                            <Button variant="link" size="sm" title="Reactivar" className="text-success" onClick={() => reactivar(u)}>
                              <FaPlay />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {tab === "metricas" && resumen && (
        <>
          <Row className="mb-4">
            {resumen.unidades.map((u) => (
              <Col md={4} key={u.unidadId} className="mb-4">
                <Card>
                  <Card.Body>
                    <div className="uppercase text-muted-foreground text-[0.875em]">{u.nombre} · hoy</div>
                    <div className="text-[1.75rem] leading-tight font-bold">{u.enviadosHoy}</div>
                    <div className="text-muted-foreground text-[0.875em]">{u.repartoRealPct ?? "—"}% real · {u.pesoConfiguradoPct ?? "—"}% configurado</div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
            <Col md={4} className="mb-4">
              <Card>
                <Card.Body>
                  <div className="uppercase text-muted-foreground text-[0.875em]">Outbox pendiente</div>
                  <div className="text-[1.75rem] leading-tight font-bold">{resumen.outboxPendiente}</div>
                  <div className="text-muted-foreground text-[0.875em]">{resumen.outboxPendiente > 0 ? "revisar — leads sin entregar" : "sin leads pendientes"}</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="mb-4">
            <Card.Body>
              <Card.Title className="text-base">Detalle por unidad</Card.Title>
              <div className="w-full overflow-x-auto">
                <Table size="sm">
                  <thead>
                    <tr>
                      <th className="text-left">Unidad</th><th className="text-right">Enviados</th><th className="text-right">Confirmados</th>
                      <th className="text-right">Fallidos</th><th className="text-right">Failovers</th>
                      <th className="text-right">Por afinidad</th><th className="text-right">Déficit vivo</th><th className="text-left">Salud</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.unidades.map((u) => (
                      <tr key={u.unidadId}>
                        <td>{u.nombre}</td>
                        <td className="text-right">{u.enviadosHoy}</td>
                        <td className="text-right">{u.confirmadosHoy}</td>
                        <td className="text-right">{u.fallidosHoy}</td>
                        <td className="text-right">{u.failoversRecibidosHoy}</td>
                        <td className="text-right">{u.porAfinidadHoy}</td>
                        <td className="text-right">{u.deficitVivo ?? "—"}</td>
                        <td><Badge bg={ESTADO_SALUD_BADGE[u.saludEstado] || "secondary"}>{u.saludEstado}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {latencias && (
            <Row className="mb-4">
              {["p50", "p95", "p99"].map((k) => (
                <Col md={4} key={k}>
                  <Card>
                    <Card.Body>
                      <div className="uppercase text-muted-foreground text-[0.875em]">{k}</div>
                      <div className="text-[1.5rem] leading-snug font-bold">{latencias[k] != null ? `${latencias[k]} ms` : "—"}</div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Card>
            <Card.Body>
              <Card.Title className="text-base">Últimos eventos del ledger</Card.Title>
              <div className="w-full overflow-x-auto">
                <Table size="sm">
                  <thead>
                    <tr><th className="text-left">Lead key</th><th className="text-left">Motivo</th><th className="text-left">Estado</th><th className="text-right">Intentos</th><th className="text-right">Latencia</th><th className="text-left">Cuándo</th></tr>
                  </thead>
                  <tbody>
                    {eventos.map((e) => (
                      <tr key={e.id}>
                        <td><code className="font-mono text-destructive text-[0.875em]">{e.lead_key}</code></td>
                        <td>{e.motivo_decision || "—"}</td>
                        <td><Badge bg={e.estado === "confirmado" ? "success" : e.estado === "fallido" || e.estado === "outbox" ? "danger" : "secondary"}>{e.estado}</Badge></td>
                        <td className="text-right">{e.intentos}</td>
                        <td className="text-right">{e.latencia_ms != null ? `${e.latencia_ms} ms` : "—"}</td>
                        <td><small className="text-[0.875em]">{new Date(e.creado_en).toLocaleString("es-AR")}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}

      {/* Modal de edición de unidad */}
      <Modal show={Boolean(editando)} onHide={() => setEditando(null)}>
        {editando && <EditarUnidadForm unidad={editando} onGuardar={guardarEdicion} onCancelar={() => setEditando(null)} />}
      </Modal>

      {/* Modal de vendedores excluidos */}
      <Modal show={Boolean(vendedoresDe)} onHide={() => setVendedoresDe(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>Vendedores — {vendedoresDe?.nombre}</Modal.Title></Modal.Header>
        <Modal.Body>
          {vendedoresLoading ? (
            <div className="text-center py-6"><Spinner animation="border" /></div>
          ) : (
            <Table size="sm">
              <thead><tr><th className="text-left">Vendedor</th><th className="text-left">Rol</th><th className="text-left">Cuenta para el peso</th><th className="text-left">Acción</th></tr></thead>
              <tbody>
                {vendedores.map((v) => (
                  <tr key={v.id}>
                    <td>{v.nombre || "(sin nombre)"} <small className="text-[0.875em] text-muted-foreground">{v.email}</small></td>
                    <td>{v.role}</td>
                    <td><Badge bg={v.cuentaParaPeso ? "success" : "danger"}>{v.cuentaParaPeso ? "cuenta" : "excluido"}</Badge></td>
                    <td>
                      {v.excluido ? (
                        <Button size="sm" variant="outline-success" onClick={() => incluirVendedor(v)}>
                          <FaCheckCircle className="me-1" /> Incluir
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline-danger" onClick={() => excluirVendedor(v)}>
                          <FaBan className="me-1" /> Excluir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

function EditarUnidadForm({ unidad, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    webhook_url: unidad.webhook_url || "",
    webhook_header_name: unidad.webhook_header_name || "",
    webhook_header_value: "",
    peso_modo: unidad.peso_modo,
    peso_manual: unidad.peso_manual ?? 10,
  });

  function set(campo, valor) { setForm((f) => ({ ...f, [campo]: valor })); }

  function submit(e) {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.webhook_header_value) delete payload.webhook_header_value;
    onGuardar(payload);
  }

  return (
    <Form onSubmit={submit}>
      <Modal.Header closeButton onHide={onCancelar}><Modal.Title>Editar {unidad.nombre}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-4">
          <Form.Label>Webhook URL</Form.Label>
          <Form.Control value={form.webhook_url} onChange={(e) => set("webhook_url", e.target.value)} />
        </Form.Group>
        <Row>
          <Col>
            <Form.Group className="mb-4">
              <Form.Label>Header (nombre)</Form.Label>
              <Form.Control value={form.webhook_header_name} onChange={(e) => set("webhook_header_name", e.target.value)} placeholder="X-Internal-Key" />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group className="mb-4">
              <Form.Label>Header (valor)</Form.Label>
              <Form.Control type="password" value={form.webhook_header_value} onChange={(e) => set("webhook_header_value", e.target.value)}
                placeholder={unidad.webhook_header_configurado ? "•••• (dejar vacío para no cambiar)" : ""} />
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col>
            <Form.Group className="mb-4">
              <Form.Label>Peso</Form.Label>
              <Form.Select value={form.peso_modo} onChange={(e) => set("peso_modo", e.target.value)}>
                <option value="automatico">Automático (por vendedores)</option>
                <option value="manual">Manual</option>
              </Form.Select>
            </Form.Group>
          </Col>
          {form.peso_modo === "manual" && (
            <Col>
              <Form.Group className="mb-4">
                <Form.Label>Peso manual</Form.Label>
                <Form.Control type="number" value={form.peso_manual} onChange={(e) => set("peso_manual", Number(e.target.value))} />
              </Form.Group>
            </Col>
          )}
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
        <Button variant="primary" type="submit">Guardar</Button>
      </Modal.Footer>
    </Form>
  );
}
