import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import {
  Container, Row, Col, Button, Table, Modal, Form, InputGroup, Badge,
  Card, Spinner, Alert, Nav, OverlayTrigger, Tooltip
} from "@/components/compat/bootstrap";
import { 
  FaEdit, FaTrash, FaPlus, FaPercentage, FaEye, FaFileExport, 
  FaFileImport, FaSearch, FaFilter, FaSort, FaSortUp, FaSortDown,
  FaCheck, FaTimes, FaClone, FaInfoCircle, FaArrowUp, FaArrowDown // ✅ Agregar iconos
} from "@/lib/icons";


const ListaPreciosAdmin = () => {
  const [precios, setPrecios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAumento, setShowAumento] = useState(false);
  const [showDescuento, setShowDescuento] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);
  const [precioEdit, setPrecioEdit] = useState({});
  const [nuevoPrecio, setNuevoPrecio] = useState({});
  const [porcentaje, setPorcentaje] = useState("");
  const [porcentajeDescuento, setPorcentajeDescuento] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [detalle, setDetalle] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [tabActiva, setTabActiva] = useState("lista");
  const [ordenPor, setOrdenPor] = useState("id");
  const [ordenDir, setOrdenDir] = useState("asc");
  const [showImportar, setShowImportar] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [showExito, setShowExito] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [showClonar, setShowClonar] = useState(false);
  const [anioOrigen, setAnioOrigen] = useState(new Date().getFullYear() - 1);
  const [anioDestino, setAnioDestino] = useState(new Date().getFullYear());
  const [incrementoClonacion, setIncrementoClonacion] = useState(10);
  
  // Filtros
  const [filtroPlan, setFiltroPlan] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroTipoFamilia, setFiltroTipoFamilia] = useState("");
  const [planesDisponibles, setPlanesDisponibles] = useState([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [tiposFamiliaDisponibles, setTiposFamiliaDisponibles] = useState([]);

  // Función auxiliar para formatear precio para mostrar
  const formatearPrecioParaMostrar = (precio) => {
    if (!precio) return "";
    const numero = parseFloat(precio);
    if (isNaN(numero)) return "";
    return numero.toLocaleString('es-AR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Al cargar el componente, trae los valores únicos de los precios existentes
  useEffect(() => {
    fetchPrecios();
    fetchPlanes();
    fetchCategorias();
    fetchTiposFamilia();
  }, [anio]);

  const fetchPrecios = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/admin/lista-precios?anio=${anio}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrecios(data);
      setError(null);
    } catch (error) {
      console.error("Error al cargar precios:", error);
      setError("No se pudieron cargar los precios. " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanes = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/cotizaciones/planes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlanesDisponibles(data);
    } catch (error) {
      console.error("Error al cargar planes:", error);
    }
  };

  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/cotizaciones/categorias`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategoriasDisponibles(data);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    }
  };

  const fetchTiposFamilia = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/cotizaciones/tipos-familia`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTiposFamiliaDisponibles(data);
    } catch (error) {
      console.error("Error al cargar tipos de familia:", error);
    }
  };

  // La banda "21 a 30" se muestra como "21 a 25" para HIJO: los hijos se cubren hasta los 25 años inclusive
  const bandaVisible = (categoriaEdad, tipoFamilia) =>
    tipoFamilia === "HIJO" && categoriaEdad === "21 a 30" ? "21 a 25" : categoriaEdad;

  // Obtener valores únicos para los filtros
  const planes = [...new Set(precios.map(p => p.plan))];
  const categorias = [...new Set(precios.map(p => p.categoria_edad))];
  const tiposFamilia = [...new Set(precios.map(p => p.tipo_familia))];

  // Filtrar precios según los filtros y búsqueda
  const preciosFiltrados = precios
    .filter(row => {
      const terminoBusqueda = busqueda.toLowerCase();
      return (
        (!filtroPlan || row.plan === filtroPlan) &&
        (!filtroCategoria || row.categoria_edad === filtroCategoria) &&
        (!filtroTipoFamilia || row.tipo_familia === filtroTipoFamilia) &&
        (!busqueda || 
          row.plan.toLowerCase().includes(terminoBusqueda) ||
          bandaVisible(row.categoria_edad, row.tipo_familia).toLowerCase().includes(terminoBusqueda) ||
          row.tipo_familia.toLowerCase().includes(terminoBusqueda) ||
          String(row.precio).includes(terminoBusqueda)
        )
      );
    })
    .sort((a, b) => {
      let valorA, valorB;
      
      // Determinar los valores a comparar según el campo
      switch (ordenPor) {
        case "plan":
          valorA = a.plan.toLowerCase();
          valorB = b.plan.toLowerCase();
          break;
        case "categoria":
          valorA = a.categoria_edad.toLowerCase();
          valorB = b.categoria_edad.toLowerCase();
          break;
        case "tipo":
          valorA = a.tipo_familia.toLowerCase();
          valorB = b.tipo_familia.toLowerCase();
          break;
        case "precio":
          valorA = parseFloat(a.precio);
          valorB = parseFloat(b.precio);
          break;
        default: // id
          valorA = a.id;
          valorB = b.id;
      }
      
      // Comparar según la dirección
      if (ordenDir === "asc") {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });

  const handleEdit = (precio) => {
    setPrecioEdit(precio);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      // Validar y limpiar el precio antes de enviarlo
      const precioLimpio = parseFloat(precioEdit.precio);
      if (isNaN(precioLimpio) || precioLimpio <= 0) {
        setError("Por favor, ingrese un precio válido mayor a 0");
        return;
      }
      
      await axios.put(`${API_URL}/admin/lista-precios/${precioEdit.id}`, { 
        precio: precioLimpio.toFixed(2) 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEdit(false);
      setMensajeExito("Precio actualizado correctamente");
      setShowExito(true);
      fetchPrecios();
    } catch (error) {
      console.error("Error al actualizar precio:", error);
      setError("Error al actualizar precio: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    // Pedir confirmación antes de eliminar
    if (!window.confirm("¿Estás seguro de que deseas eliminar este precio?")) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      await axios.delete(`${API_URL}/admin/lista-precios/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMensajeExito("Precio eliminado correctamente");
      setShowExito(true);
      fetchPrecios();
    } catch (error) {
      console.error("Error al eliminar precio:", error);
      setError("Error al eliminar precio: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");

      // Validar y limpiar el precio
      const precioLimpio = parseFloat(nuevoPrecio.precio);
      if (isNaN(precioLimpio) || precioLimpio <= 0) {
        setError("Por favor, ingrese un precio válido mayor a 0");
        return;
      }

      // Asigna valores predeterminados si algún campo está vacío
      const precioFinal = {
        plan_id: nuevoPrecio.plan_id || "",
        categoria_id: nuevoPrecio.categoria_id || "",
        tipo_familia_id: nuevoPrecio.tipo_familia_id || "",
        precio: precioLimpio.toFixed(2),
        anio: nuevoPrecio.anio || anio
      };

      // Verifica que todos los campos requeridos estén presentes
      if (!precioFinal.plan_id || !precioFinal.categoria_id || !precioFinal.tipo_familia_id || !precioFinal.anio) {
        setError("Por favor, completa todos los campos.");
        return;
      }

      await axios.post(`${API_URL}/admin/lista-precios`, precioFinal, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAdd(false);
      setNuevoPrecio({});
      setMensajeExito("Precio agregado correctamente");
      setShowExito(true);
      fetchPrecios();
    } catch (error) {
      console.error("Error al agregar precio:", error);
      setError("Error al agregar precio: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAumento = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      // ✅ VALIDAR: Que el porcentaje sea válido
      if (!porcentaje || isNaN(porcentaje) || Number(porcentaje) <= 0) {
        setError("Por favor, ingresa un porcentaje válido.");
        return;
      }
      
      if (Number(porcentaje) > 999.99) {
        setError("El porcentaje de aumento no puede ser mayor a 999.99%.");
        return;
      }
      
      await axios.put(`${API_URL}/admin/lista-precios/aumentar/todos`, { porcentaje, anio }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAumento(false);
      setPorcentaje("");
      setMensajeExito(`Precios aumentados correctamente en ${porcentaje}%`);
      setShowExito(true);
      fetchPrecios();
    } catch (error) {
      console.error("Error al aplicar aumento:", error);
      setError("Error al aplicar aumento: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ AGREGAR: Función para aplicar descuento
  const handleDescuento = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      // Validar que el porcentaje sea válido
      if (!porcentajeDescuento || isNaN(porcentajeDescuento) || Number(porcentajeDescuento) <= 0) {
        setError("Por favor, ingresa un porcentaje válido.");
        return;
      }
      
      if (Number(porcentajeDescuento) >= 100) {
        setError("El porcentaje de descuento no puede ser mayor o igual a 100%.");
        return;
      }
      
      await axios.put(`${API_URL}/admin/lista-precios/disminuir/todos`, { 
        porcentaje: porcentajeDescuento, 
        anio 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowDescuento(false);
      setPorcentajeDescuento("");
      setMensajeExito(`Precios disminuidos correctamente en ${porcentajeDescuento}%`);
      setShowExito(true);
      fetchPrecios();
    } catch (error) {
      console.error("Error al aplicar descuento:", error);
      setError("Error al aplicar descuento: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDetalle = (row) => {
    setDetalle(row);
    setShowDetalle(true);
  };

  const handleOrdenar = (campo) => {
    if (ordenPor === campo) {
      // Cambiar dirección si ya estamos ordenando por este campo
      setOrdenDir(ordenDir === "asc" ? "desc" : "asc");
    } else {
      // Establecer nuevo campo y dirección por defecto
      setOrdenPor(campo);
      setOrdenDir("asc");
    }
  };

  // Obtener el ícono de ordenación para la columna actual
  const getIconoOrden = (campo) => {
    if (ordenPor !== campo) return <FaSort className="ms-1 text-muted-foreground" size={12} />;
    return ordenDir === "asc" ? <FaSortUp className="ms-1 text-primary" size={12} /> : <FaSortDown className="ms-1 text-primary" size={12} />;
  };

  const handleImportarCSV = async (e) => {
    e.preventDefault();
    if (!archivo) {
      setError("Por favor, selecciona un archivo CSV");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const formData = new FormData();
      formData.append('csv_file', archivo);
      
      await axios.post(`${API_URL}/admin/lista-precios/importar`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setShowImportar(false);
      setArchivo(null);
      setMensajeExito("Archivo importado correctamente");
      setShowExito(true);
      fetchPrecios();
    } catch (error) {
      console.error("Error al importar archivo:", error);
      setError("Error al importar archivo: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ MEJORAR: Función de exportación con mejor manejo de errores
  const handleExportarCSV = async () => {
    try {
      setLoading(true);
      
      // Validar que hay datos para exportar
      if (precios.length === 0) {
        setError(`No hay precios disponibles para exportar en el año ${anio}`);
        return;
      }

      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/lista-precios/exportar?anio=${anio}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // ✅ MEJORAR: Crear nombre de archivo más descriptivo
      const fecha = new Date().toISOString().split('T')[0];
      const filename = `lista_precios_${anio}_${fecha}.csv`;
      
      // Crear URL del archivo descargado
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMensajeExito(`Archivo ${filename} exportado correctamente (${precios.length} registros)`);
      setShowExito(true);
      
    } catch (error) {
      console.error("Error al exportar archivo:", error);
      
      if (error.response?.status === 404) {
        setError(`No hay precios disponibles para exportar en el año ${anio}`);
      } else {
        setError("Error al exportar archivo: " + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ AGREGAR: Función para descargar template
  const handleDescargarTemplate = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(`${API_URL}/admin/lista-precios/template`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template_lista_precios.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setMensajeExito("Template CSV descargado correctamente");
      setShowExito(true);
      
    } catch (error) {
      console.error("Error al descargar template:", error);
      setError("Error al descargar template: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (loading && precios.length === 0) {
    return (
      <div className="text-center py-12">
        <Spinner animation="border" variant="primary" />
        <p className="mb-4 mt-4">Cargando lista de precios...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs de navegación */}
      <Card className="shadow-xs mb-6">
        <Card.Header className="bg-card">
          <Nav variant="tabs">
            <Nav.Item>
              <Nav.Link 
                active={tabActiva === "lista"} 
                onClick={() => setTabActiva("lista")}
              >
                Lista de Precios
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link 
                active={tabActiva === "importar"} 
                onClick={() => setTabActiva("importar")}
              >
                Importar/Exportar
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {showExito && (
            <Alert variant="success" dismissible onClose={() => setShowExito(false)}>
              {mensajeExito}
            </Alert>
          )}
          
          {tabActiva === "lista" && (
            <>
              {/* Encabezado y controles */}
              <Row className="mb-4 items-center">
                <Col md={6} className="mb-2 md:mb-0">
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setShowAdd(true)}>
                      <FaPlus className="me-1" /> Agregar
                    </Button>
                    
                    {/* ✅ MEJORAR: Botones de aumento y descuento con iconos distintivos */}
                    <Button variant="outline-success" onClick={() => setShowAumento(true)}>
                      <FaArrowUp className="me-1" /> Aumentar
                    </Button>
                    
                    {/* ✅ AGREGAR: Botón para descuento */}
                    <Button variant="outline-warning" onClick={() => setShowDescuento(true)}>
                      <FaArrowDown className="me-1" /> Descuento
                    </Button>
                    
                    <Button variant="outline-primary" onClick={() => setShowClonar(true)}>
                      <FaClone className="me-1" /> Clonar Año
                    </Button>
                  </div>
                </Col>
                <Col md={4} className="mb-2 md:mb-0">
                  <InputGroup>
                    <InputGroup.Text><FaSearch /></InputGroup.Text>
                    <Form.Control
                      placeholder="Buscar..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={2}>
                  <InputGroup>
                    <InputGroup.Text>Año</InputGroup.Text>
                    <Form.Control
                      type="number"
                      value={anio}
                      onChange={e => setAnio(e.target.value)}
                      min="2000"
                      max="2100"
                    />
                  </InputGroup>
                </Col>
              </Row>

              {/* Filtros */}
              <Row className="mb-4">
                <Col md={4} className="mb-2 md:mb-0">
                  <Form.Select value={filtroPlan} onChange={e => setFiltroPlan(e.target.value)}>
                    <option value="">Todos los planes</option>
                    {planes.map(plan => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="mb-2 md:mb-0">
                  <Form.Select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                    <option value="">Todas las categorías</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <div className="flex">
                    <Form.Select 
                      value={filtroTipoFamilia} 
                      onChange={e => setFiltroTipoFamilia(e.target.value)}
                      className="me-2"
                    >
                      <option value="">Todos los tipos</option>
                      {tiposFamilia.map(tipo => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </Form.Select>
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => {
                        setFiltroPlan("");
                        setFiltroCategoria("");
                        setFiltroTipoFamilia("");
                        setBusqueda("");
                      }}
                    >
                      <FaTimes />
                    </Button>
                  </div>
                </Col>
              </Row>

              {/* Tabla de precios */}
              <div className="w-full overflow-x-auto">
                <Table striped bordered hover className="mb-0">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("id")}>
                        ID {getIconoOrden("id")}
                      </th>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("plan")}>
                        Plan {getIconoOrden("plan")}
                      </th>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("categoria")}>
                        Categoría Edad {getIconoOrden("categoria")}
                      </th>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("tipo")}>
                        Tipo Familia {getIconoOrden("tipo")}
                      </th>
                      <th className="text-left cursor-pointer" onClick={() => handleOrdenar("precio")}>
                        Precio {getIconoOrden("precio")}
                      </th>
                      <th className="text-left" style={{ width: "150px" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preciosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-6">
                          No hay precios que coincidan con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      preciosFiltrados.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td><Badge bg="info">{row.plan}</Badge></td>
                          <td>{bandaVisible(row.categoria_edad, row.tipo_familia)}</td>
                          <td>{row.tipo_familia}</td>
                          <td className="text-right">${parseFloat(row.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td>
                            <div className="flex gap-1 justify-center">
                              <OverlayTrigger placement="top" overlay={<Tooltip>Editar precio</Tooltip>}>
                                <Button variant="outline-primary" size="sm" onClick={() => handleEdit(row)}>
                                  <FaEdit />
                                </Button>
                              </OverlayTrigger>
                              <OverlayTrigger placement="top" overlay={<Tooltip>Eliminar precio</Tooltip>}>
                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(row.id)}>
                                  <FaTrash />
                                </Button>
                              </OverlayTrigger>
                              <OverlayTrigger placement="top" overlay={<Tooltip>Ver detalles</Tooltip>}>
                                <Button variant="outline-info" size="sm" onClick={() => handleDetalle(row)}>
                                  <FaEye />
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
              
              {/* Paginación (si es necesaria) */}
              <div className="flex justify-between items-center mt-4">
                <div>
                  <small className="text-[0.875em] text-muted-foreground">Mostrando {preciosFiltrados.length} de {precios.length} precios</small>
                </div>
              </div>
            </>
          )}
          
          {tabActiva === "importar" && (
            <div className="py-4">
              <Row>
                <Col md={6} className="mb-6">
                  <Card>
                    <Card.Header className="bg-muted">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                        <FaFileImport className="me-2" />
                        Importar precios desde CSV
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <p className="mb-4">Sube un archivo CSV con los precios que deseas importar.</p>
                      <p className="mb-4"><strong>Formato requerido:</strong></p>
                      <ul className="mb-4 list-disc pl-8 text-[0.875em]">
                        <li><code className="font-mono text-[0.875em] text-destructive">plan_id</code> - ID del plan (número)</li>
                        <li><code className="font-mono text-[0.875em] text-destructive">categoria_id</code> - ID de la categoría (número)</li>
                        <li><code className="font-mono text-[0.875em] text-destructive">tipo_familia_id</code> - ID del tipo de familia (número)</li>
                        <li><code className="font-mono text-[0.875em] text-destructive">precio</code> - Monto (decimal)</li>
                        <li><code className="font-mono text-[0.875em] text-destructive">anio</code> - Año (número)</li>
                      </ul>
                      <div className="flex gap-2 justify-center mt-4">
                        <Button variant="outline-info" onClick={handleDescargarTemplate}>
                          <FaFileExport className="me-2" /> 
                          Descargar Template
                        </Button>
                        <Button variant="primary" onClick={() => setShowImportar(true)}>
                          <FaFileImport className="me-2" /> 
                          Importar CSV
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header className="bg-muted">
                      <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                        <FaFileExport className="me-2" />
                        Exportar precios a CSV
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <p className="mb-4">Descarga todos los precios del año <strong>{anio}</strong> en formato CSV.</p>
                      <div className="bg-muted p-2 rounded-md mb-4">
                        <small className="text-[0.875em]">
                          <strong>Información incluida:</strong><br />
                          • Datos completos de precios<br />
                          • Información de planes y categorías<br />
                          • Compatible con Excel<br />
                          • Codificación UTF-8
                        </small>
                      </div>
                      <div className="flex justify-center">
                        <Button 
                          variant="success" 
                          onClick={handleExportarCSV}
                          disabled={loading || precios.length === 0}
                        >
                          {loading ? (
                            <Spinner size="sm" animation="border" className="me-2" />
                          ) : (
                            <FaFileExport className="me-2" />
                          )}
                          Exportar CSV ({precios.length} registros)
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              {/* ✅ AGREGAR: Información adicional */}
              <Row className="mt-6">
                <Col>
                  <Alert variant="info">
                    <FaInfoCircle className="me-2" />
                    <strong>Consejos para usar CSV:</strong>
                    <ul className="list-disc pl-8 mb-0 mt-2">
                      <li>Los archivos exportados incluyen todos los datos necesarios para reimportar</li>
                      <li>Usa el template para crear nuevos registros con el formato correcto</li>
                      <li>Los archivos están codificados en UTF-8 para compatibilidad con Excel</li>
                      <li>Los precios se exportan con 2 decimales de precisión</li>
                    </ul>
                  </Alert>
                </Col>
              </Row>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal Detalle */}
      <Modal show={showDetalle} onHide={() => setShowDetalle(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Detalle del Precio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table bordered hover size="sm">
            <tbody>
              <tr>
                <th className="text-left" style={{ width: "40%" }}>Plan:</th>
                <td><Badge bg="info">{detalle.plan}</Badge></td>
              </tr>
              <tr>
                <th className="text-left">Categoría Edad:</th>
                <td>{bandaVisible(detalle.categoria_edad, detalle.tipo_familia)}</td>
              </tr>
              <tr>
                <th className="text-left">Tipo Familia:</th>
                <td>{detalle.tipo_familia}</td>
              </tr>
              <tr>
                <th className="text-left">Precio:</th>
                <td className="font-bold">${parseFloat(detalle.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <th className="text-left">Año:</th>
                <td>{detalle.anio}</td>
              </tr>
              <tr>
                <th className="text-left">ID:</th>
                <td>{detalle.id}</td>
              </tr>
              <tr>
                <th className="text-left">Categoría ID:</th>
                <td>{detalle.categoria_id}</td>
              </tr>
              <tr>
                <th className="text-left">Plan ID:</th>
                <td>{detalle.plan_id}</td>
              </tr>
              <tr>
                <th className="text-left">Tipo Familia ID:</th>
                <td>{detalle.tipo_familia_id}</td>
              </tr>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetalle(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Editar Precio */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Precio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Precio</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={precioEdit.precio || ""}
                onChange={e => setPrecioEdit({ ...precioEdit, precio: e.target.value })}
                placeholder="106605.00"
                autoFocus
              />
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              <strong>Formato:</strong> Use punto (.) como separador decimal. Ej: 106605.00 para $106.605,00
            </Form.Text>
            {precioEdit.precio && !isNaN(parseFloat(precioEdit.precio)) && (
              <div className="mt-2">
                <small className="text-[0.875em] text-info">
                  <strong>Vista previa:</strong> ${formatearPrecioParaMostrar(precioEdit.precio)}
                </small>
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEdit(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Agregar Precio */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Agregar Precio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Plan</Form.Label>
            <Form.Select
              value={nuevoPrecio.plan_id || ""}
              onChange={e => setNuevoPrecio({ ...nuevoPrecio, plan_id: e.target.value })}
            >
              <option value="">Seleccione un plan</option>
              {planesDisponibles.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Categoría Edad</Form.Label>
            <Form.Select
              value={nuevoPrecio.categoria_id || ""}
              onChange={e => setNuevoPrecio({ ...nuevoPrecio, categoria_id: e.target.value })}
            >
              <option value="">Seleccione una categoría</option>
              {categoriasDisponibles.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Tipo Familia</Form.Label>
            <Form.Select
              value={nuevoPrecio.tipo_familia_id || ""}
              onChange={e => setNuevoPrecio({ ...nuevoPrecio, tipo_familia_id: e.target.value })}
            >
              <option value="">Seleccione un tipo</option>
              {tiposFamiliaDisponibles.map(tipo => (
                <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Precio</Form.Label>
            <InputGroup>
              <InputGroup.Text>$</InputGroup.Text>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={nuevoPrecio.precio || ""}
                onChange={e => setNuevoPrecio({ ...nuevoPrecio, precio: e.target.value })}
                placeholder="106605.00"
              />
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              <strong>Formato:</strong> Use punto (.) como separador decimal. Ej: 106605.00 para $106.605,00
            </Form.Text>
            {nuevoPrecio.precio && !isNaN(parseFloat(nuevoPrecio.precio)) && (
              <div className="mt-2">
                <small className="text-[0.875em] text-info">
                  <strong>Vista previa:</strong> ${formatearPrecioParaMostrar(nuevoPrecio.precio)}
                </small>
              </div>
            )}
          </Form.Group>
          <Form.Group>
            <Form.Label>Año</Form.Label>
            <Form.Control
              type="number"
              value={nuevoPrecio.anio || anio} // Usa el año actual como valor predeterminado
              onChange={e => setNuevoPrecio({ ...nuevoPrecio, anio: e.target.value })}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            Agregar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ AGREGAR: Modal para Descuento */}
      <Modal show={showDescuento} onHide={() => setShowDescuento(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaArrowDown className="me-2 text-warning" />
            Aplicar Descuento a Todos los Precios
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="mb-4">
            <FaInfoCircle className="me-2" />
            <strong>¡Atención!</strong> Esta acción aplicará un descuento del porcentaje especificado 
            a todos los precios del año {anio}. Esta acción no se puede deshacer fácilmente.
          </Alert>
          
          <Form.Group>
            <Form.Label>Porcentaje de descuento</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <FaArrowDown className="text-warning" />
              </InputGroup.Text>
              <Form.Control
                type="number"
                value={porcentajeDescuento}
                onChange={e => setPorcentajeDescuento(e.target.value)}
                placeholder="Ej: 10"
                min="0.01"
                max="99.99"
                step="0.01"
              />
              <InputGroup.Text>%</InputGroup.Text>
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              Ingresa un valor entre 0.01% y 99.99%. Los precios se reducirán en este porcentaje.
            </Form.Text>
          </Form.Group>
          
          {/* Vista previa del cálculo */}
          {porcentajeDescuento && !isNaN(porcentajeDescuento) && Number(porcentajeDescuento) > 0 && Number(porcentajeDescuento) < 100 && (
            <Alert variant="info" className="mt-4">
              <strong>Vista previa:</strong> Un precio de $1,000 se convertirá en ${(1000 * (1 - Number(porcentajeDescuento) / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDescuento(false)}>
            Cancelar
          </Button>
          <Button 
            variant="warning" 
            onClick={handleDescuento}
            disabled={!porcentajeDescuento || isNaN(porcentajeDescuento) || Number(porcentajeDescuento) <= 0 || Number(porcentajeDescuento) >= 100}
          >
            <FaArrowDown className="me-1" />
            Aplicar Descuento
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ MEJORAR: Modal de Aumento con mejor diseño */}
      <Modal show={showAumento} onHide={() => setShowAumento(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaArrowUp className="me-2 text-success" />
            Aumentar Todos los Precios
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-4">
            <FaInfoCircle className="me-2" />
            Esta acción aplicará un aumento del porcentaje especificado 
            a todos los precios del año {anio}.
          </Alert>
          
          <Form.Group>
            <Form.Label>Porcentaje de aumento</Form.Label>
            <InputGroup>
              <InputGroup.Text>
                <FaArrowUp className="text-success" />
              </InputGroup.Text>
              <Form.Control
                type="number"
                value={porcentaje}
                onChange={e => setPorcentaje(e.target.value)}
                placeholder="Ej: 2.3"
                min="0.01"
                max="999.99"
                step="0.01"
              />
              <InputGroup.Text>%</InputGroup.Text>
            </InputGroup>
            <Form.Text className="text-muted-foreground">
              Ingresa el porcentaje de aumento (0.01% a 999.99%). Soporta decimales (ej: 2.3 para 2.3%)
            </Form.Text>
          </Form.Group>
          
          {/* Vista previa del cálculo */}
          {porcentaje && !isNaN(porcentaje) && Number(porcentaje) > 0 && (
            <Alert variant="success" className="mt-4">
              <strong>Vista previa:</strong> Un precio de $1,000 se convertirá en ${(1000 * (1 + Number(porcentaje) / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
            disabled={!porcentaje || isNaN(porcentaje) || Number(porcentaje) <= 0 || Number(porcentaje) > 999.99}
          >
            <FaArrowUp className="me-1" />
            Aplicar Aumento
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Importar CSV */}
      <Modal show={showImportar} onHide={() => setShowImportar(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Importar precios desde CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleImportarCSV}>
            <Form.Group>
              <Form.Label>Archivo CSV</Form.Label>
              <Form.Control
                type="file"
                accept=".csv"
                onChange={e => setArchivo(e.target.files[0])}
                required
              />
            </Form.Group>
            <Form.Group className="mt-4">
              <Form.Label>Opciones de importación</Form.Label>
              <div>
                <Form.Check
                  type="radio"
                  label="Agregar nuevos precios"
                  name="importarOpciones"
                  value="agregar"
                  defaultChecked
                />
                <Form.Check
                  type="radio"
                  label="Reemplazar precios existentes"
                  name="importarOpciones"
                  value="reemplazar"
                />
              </div>
            </Form.Group>
            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={() => setShowImportar(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" className="ms-2">
                {loading ? <Spinner size="sm" animation="border" /> : "Importar"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ListaPreciosAdmin;