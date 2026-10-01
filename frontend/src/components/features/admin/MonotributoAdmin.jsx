import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Alert,
  Spinner,
  InputGroup,
  Badge,
  OverlayTrigger,
  Tooltip,
} from "@/components/compat/bootstrap";
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaPercentage,
  FaArrowUp,
  FaArrowDown,
  FaInfoCircle,
  FaCheck,
} from "@/lib/icons";
import axios from "axios";
import { API_URL } from "../../config";

const MonotributoAdmin = () => {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAumento, setShowAumento] = useState(false);
  const [categoriaEdit, setCategoriaEdit] = useState({});
  const [nuevaCategoria, setNuevaCategoria] = useState({});
  const [porcentaje, setPorcentaje] = useState("");
  const [showExito, setShowExito] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  const token = localStorage.getItem("cober_token");

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/monotributo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategorias(response.data || []);
      setError(null);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
      setError(
        error.response?.data?.message || "Error al cargar las categorías de monotributo"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (categoria) => {
    setCategoriaEdit(categoria);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      await axios.put(
        `${API_URL}/monotributo/${categoriaEdit.id}`,
        {
          letra: categoriaEdit.letra,
          aporte_presuntivo: categoriaEdit.aporte_presuntivo,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMensajeExito("Categoría actualizada correctamente");
      setShowExito(true);
      setShowEdit(false);
      fetchCategorias();
      setTimeout(() => setShowExito(false), 3000);
    } catch (error) {
      console.error("Error al actualizar:", error);
      setError(error.response?.data?.message || "Error al actualizar la categoría");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta categoría?")) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/monotributo/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMensajeExito("Categoría eliminada correctamente");
      setShowExito(true);
      fetchCategorias();
      setTimeout(() => setShowExito(false), 3000);
    } catch (error) {
      console.error("Error al eliminar:", error);
      setError(error.response?.data?.message || "Error al eliminar la categoría");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!nuevaCategoria.letra || !nuevaCategoria.aporte_presuntivo) {
      setError("Por favor completa todos los campos");
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/monotributo`,
        {
          letra: nuevaCategoria.letra.toUpperCase(),
          aporte_presuntivo: nuevaCategoria.aporte_presuntivo,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMensajeExito("Categoría agregada correctamente");
      setShowExito(true);
      setShowAdd(false);
      setNuevaCategoria({});
      fetchCategorias();
      setTimeout(() => setShowExito(false), 3000);
    } catch (error) {
      console.error("Error al agregar:", error);
      setError(error.response?.data?.message || "Error al agregar la categoría");
    } finally {
      setLoading(false);
    }
  };

  const handleAumento = async () => {
    if (!porcentaje || isNaN(porcentaje) || Number(porcentaje) <= 0) {
      setError("Por favor ingresa un porcentaje válido");
      return;
    }

    if (!window.confirm(`¿Aplicar aumento del ${porcentaje}% a todas las categorías?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/monotributo/aumentar`,
        { porcentaje: Number(porcentaje) },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMensajeExito(`Aumento del ${porcentaje}% aplicado correctamente`);
      setShowExito(true);
      setShowAumento(false);
      setPorcentaje("");
      fetchCategorias();
      setTimeout(() => setShowExito(false), 3000);
    } catch (error) {
      console.error("Error al aplicar aumento:", error);
      setError(error.response?.data?.message || "Error al aplicar el aumento");
    } finally {
      setLoading(false);
    }
  };

  const formatearPrecio = (precio) => {
    if (!precio) return "0.00";
    const numero = parseFloat(precio);
    if (isNaN(numero)) return "0.00";
    return numero.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading && categorias.length === 0) {
    return (
      <div className="text-center py-12">
        <Spinner animation="border" variant="primary" />
        <p className="mb-4 mt-2">Cargando categorías de monotributo...</p>
      </div>
    );
  }

  return (
    <div>
      <Card className="shadow-xs mb-6">
        <Card.Header className="bg-card flex justify-between items-center">
          <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
            <FaPercentage className="me-2" />
            Categorías de Monotributo
          </h5>
          <Badge bg="info">{categorias.length} categorías</Badge>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {showExito && (
            <Alert variant="success" dismissible onClose={() => setShowExito(false)}>
              <FaCheck className="me-2" />
              {mensajeExito}
            </Alert>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2 mb-4">
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <FaPlus className="me-1" /> Agregar Categoría
            </Button>
            <Button variant="outline-success" onClick={() => setShowAumento(true)}>
              <FaArrowUp className="me-1" /> Aplicar Aumento
            </Button>
          </div>

          {/* Tabla de categorías */}
          <div className="w-full overflow-x-auto">
            <Table striped bordered hover className="mb-0">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left" style={{ width: "10%" }}>ID</th>
                  <th className="text-left" style={{ width: "20%" }}>Categoría</th>
                  <th className="text-left" style={{ width: "40%" }}>Aporte Presuntivo</th>
                  <th className="text-left" style={{ width: "30%" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categorias.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-6">
                      No hay categorías de monotributo registradas.
                    </td>
                  </tr>
                ) : (
                  categorias.map((cat) => (
                    <tr key={cat.id}>
                      <td>{cat.id}</td>
                      <td>
                        <Badge bg="primary" className="text-base px-4 py-2">
                          {cat.letra}
                        </Badge>
                      </td>
                      <td className="text-right font-bold">
                        ${formatearPrecio(cat.aporte_presuntivo)}
                      </td>
                      <td>
                        <div className="flex gap-1 justify-center">
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Editar categoría</Tooltip>}
                          >
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(cat)}
                            >
                              <FaEdit />
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Eliminar categoría</Tooltip>}
                          >
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(cat.id)}
                            >
                              <FaTrash />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-4">
            <Alert variant="info" className="mb-0">
              <FaInfoCircle className="me-2" />
              <strong>Información:</strong> Las categorías de monotributo determinan
              el aporte presuntivo mensual que debe pagar cada afiliado según su categoría.
            </Alert>
          </div>
        </Card.Body>
      </Card>

      {/* Modal Editar */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Categoría de Monotributo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-4">
            <Form.Label>Categoría (Letra)</Form.Label>
            <Form.Control
              type="text"
              maxLength="1"
              value={categoriaEdit.letra || ""}
              onChange={(e) =>
                setCategoriaEdit({
                  ...categoriaEdit,
                  letra: e.target.value.toUpperCase(),
                })
              }
              placeholder="A"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Aporte Presuntivo</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={categoriaEdit.aporte_presuntivo || ""}
                onChange={(e) =>
                  setCategoriaEdit({
                    ...categoriaEdit,
                    aporte_presuntivo: e.target.value,
                  })
                }
                placeholder="15391.98"
              />
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              Use punto (.) como separador decimal.
            </Form.Text>
            {categoriaEdit.aporte_presuntivo && (
              <div className="mt-2">
                <small className="text-[0.875em] text-info">
                  <strong>Vista previa:</strong> $
                  {formatearPrecio(categoriaEdit.aporte_presuntivo)}
                </small>
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEdit(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveEdit} disabled={loading}>
            {loading ? <Spinner size="sm" animation="border" /> : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Agregar */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Agregar Categoría de Monotributo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-4">
            <Form.Label>Categoría (Letra) *</Form.Label>
            <Form.Control
              type="text"
              maxLength="1"
              value={nuevaCategoria.letra || ""}
              onChange={(e) =>
                setNuevaCategoria({
                  ...nuevaCategoria,
                  letra: e.target.value.toUpperCase(),
                })
              }
              placeholder="L"
            />
            <Form.Text className="text-muted-foreground">
              Ingresa una letra única (A-Z).
            </Form.Text>
          </Form.Group>
          <Form.Group>
            <Form.Label>Aporte Presuntivo *</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={nuevaCategoria.aporte_presuntivo || ""}
                onChange={(e) =>
                  setNuevaCategoria({
                    ...nuevaCategoria,
                    aporte_presuntivo: e.target.value,
                  })
                }
                placeholder="56000.00"
              />
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              Use punto (.) como separador decimal.
            </Form.Text>
            {nuevaCategoria.aporte_presuntivo && (
              <div className="mt-2">
                <small className="text-[0.875em] text-info">
                  <strong>Vista previa:</strong> $
                  {formatearPrecio(nuevaCategoria.aporte_presuntivo)}
                </small>
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAdd} disabled={loading}>
            {loading ? <Spinner size="sm" animation="border" /> : "Agregar"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Aumento */}
      <Modal show={showAumento} onHide={() => setShowAumento(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaArrowUp className="me-2 text-success" />
            Aplicar Aumento a Todas las Categorías
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-4">
            <FaInfoCircle className="me-2" />
            Esta acción aplicará un aumento del porcentaje especificado a todas las
            categorías de monotributo.
          </Alert>

          <Form.Group>
            <Form.Label>Porcentaje de Aumento</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <FaArrowUp className="text-success" />
              </InputGroup.Text>
              <Form.Control
                type="number"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="Ej: 10"
                min="0.01"
                max="999.99"
                step="0.01"
              />
              <InputGroup.Text>%</InputGroup.Text>
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              Ingresa el porcentaje de aumento (0.01% a 999.99%). Soporta decimales.
            </Form.Text>
          </Form.Group>

          {porcentaje && !isNaN(porcentaje) && Number(porcentaje) > 0 && (
            <Alert variant="success" className="mt-4">
              <strong>Vista previa:</strong> Un aporte de $15.391,98 se convertirá en $
              {formatearPrecio(15391.98 * (1 + Number(porcentaje) / 100))}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAumento(false)}>
            Cancelar
          </Button>
          <Button
            variant="success"
            onClick={handleAumento}
            disabled={
              !porcentaje ||
              isNaN(porcentaje) ||
              Number(porcentaje) <= 0 ||
              Number(porcentaje) > 999.99 ||
              loading
            }
          >
            {loading ? (
              <Spinner size="sm" animation="border" />
            ) : (
              <>
                <FaArrowUp className="me-1" />
                Aplicar Aumento
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MonotributoAdmin;
