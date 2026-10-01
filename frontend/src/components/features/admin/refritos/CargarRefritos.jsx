import { useState, useEffect, useRef } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Alert,
  Spinner,
  ProgressBar,
  ListGroup,
  Badge
} from "@/components/compat/bootstrap";
import { FaUpload, FaCheck, FaTimes, FaFile, FaDownload } from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../../config";

const INTERVALO_CONSULTA_MS = 3000;

const CargarRefritos = ({ onSuccess }) => {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [progreso, setProgreso] = useState(0);
  const [avance, setAvance] = useState(null); // { procesadas, total } de la carga en segundo plano
  const consultaRef = useRef(null);
  const montadoRef = useRef(true);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("cober_token")}` });

  // Si hay una carga en segundo plano (p. ej. se recargó la pantalla), retomar su seguimiento
  useEffect(() => {
    montadoRef.current = true;
    axios
      .get(`${API_URL}/admin/refritos/cargar/en-curso`, { headers: authHeaders() })
      .then(({ data }) => {
        if (montadoRef.current && data?.carga) seguirCarga(data.carga.id);
      })
      .catch(() => {});
    return () => {
      montadoRef.current = false;
      clearTimeout(consultaRef.current);
    };
  }, []);

  const mostrarResultado = (data) => {
    setResultado(data);
    const exitosos = data.resultados.exitosos;
    const totalNuevos = exitosos.filter(e => !e.esDuplicado).length;
    Swal.fire({
      icon: "success",
      title: "Archivo cargado",
      html: `<strong>${exitosos.length}</strong> refritos asignados a vendedores<br/><small class="text-muted">${totalNuevos} nuevos · ${exitosos.length - totalNuevos} reasignados</small>`,
      timer: 4000
    });
    if (onSuccess) {
      onSuccess();
    }
  };

  const terminarCarga = () => {
    setCargando(false);
    setAvance(null);
  };

  // Consulta el estado de una carga en segundo plano hasta que termina
  const seguirCarga = (cargaId) => {
    setCargando(true);
    setResultado(null);

    const consultar = async () => {
      if (!montadoRef.current) return;
      try {
        const { data } = await axios.get(`${API_URL}/admin/refritos/cargar/${cargaId}`, { headers: authHeaders() });
        if (!montadoRef.current) return;
        setAvance({ procesadas: data.procesadas, total: data.total });
        setProgreso(data.total ? Math.round((data.procesadas / data.total) * 100) : 0);

        if (data.estado === "procesando") {
          consultaRef.current = setTimeout(consultar, INTERVALO_CONSULTA_MS);
          return;
        }

        terminarCarga();
        if (data.estado === "completada") {
          setProgreso(100);
          mostrarResultado(data);
          return;
        }
        setProgreso(0);
        Swal.fire({
          icon: "error",
          title: data.estado === "interrumpida" ? "Carga interrumpida" : "Error al procesar el archivo",
          text: data.estado === "interrumpida"
            ? `El servidor se reinició durante la carga (${data.procesadas} de ${data.total} filas procesadas). Podés volver a subir el mismo archivo: las filas ya cargadas se detectan como duplicadas y no se vuelven a asignar.`
            : data.error || "Error desconocido"
        });
      } catch (error) {
        if (!montadoRef.current) return;
        // Un corte momentáneo (red, reinicio, rate limit) no cancela la carga: reintentar
        const status = error.response?.status;
        if (!status || status >= 500 || status === 429) {
          consultaRef.current = setTimeout(consultar, INTERVALO_CONSULTA_MS * 2);
          return;
        }
        terminarCarga();
        Swal.fire({
          icon: "error",
          title: "No se pudo consultar la carga",
          text: error.response?.data?.message || error.message
        });
      }
    };

    consultar();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["csv", "xlsx", "xls"].includes(ext)) {
        Swal.fire({
          icon: "error",
          title: "Archivo no válido",
          text: "Solo se permiten archivos CSV, XLSX o XLS"
        });
        return;
      }
      setArchivo(file);
      setResultado(null);
    }
  };

  const handleCargar = async () => {
    if (!archivo) {
      Swal.fire({
        icon: "warning",
        title: "Selecciona un archivo",
        text: "Por favor selecciona un archivo CSV o XLSX"
      });
      return;
    }

    setCargando(true);
    setProgreso(0);
    setAvance(null);
    setResultado(null);
    const formData = new FormData();
    formData.append("archivo", archivo);

    try {
      const response = await axios.post(
        `${API_URL}/admin/refritos/cargar`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...authHeaders()
          },
          onUploadProgress: (e) => {
            if (e.total) setProgreso(Math.round((e.loaded / e.total) * 100));
          }
        }
      );

      setArchivo(null);

      // Resetear input file
      document.getElementById("archivoInput").value = "";

      // El backend procesa en segundo plano: seguir el avance hasta que termine
      if (response.data.cargaId) {
        setAvance({ procesadas: 0, total: response.data.total });
        setProgreso(0);
        seguirCarga(response.data.cargaId);
        return;
      }

      // Backend que todavía responde con el resultado completo al terminar
      setProgreso(100);
      setCargando(false);
      mostrarResultado(response.data);
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.cargaId) {
        Swal.fire({
          icon: "info",
          title: "Ya hay una carga en proceso",
          text: "Te mostramos el avance de la carga que se está procesando. Cuando termine podés subir tu archivo.",
          timer: 5000
        });
        seguirCarga(error.response.data.cargaId);
        return;
      }
      const msg = error.response?.data?.message || error.message;
      const faltantes = error.response?.data?.columnas_faltantes;
      Swal.fire({
        icon: "error",
        title: "Error al cargar archivo",
        html: faltantes && Array.isArray(faltantes) && faltantes.length > 0
          ? `${msg}<br/><br/><strong>Faltan columnas:</strong> ${faltantes.join(', ')}`
          : msg
      });
      setProgreso(0);
      setCargando(false);
    }
  };

  const descargarEjemplo = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const response = await axios.get(
        `${API_URL}/admin/refritos/descargar-ejemplo`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Crear blob y descargar
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "ejemplo_refritos.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando archivo:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo descargar el archivo de ejemplo"
      });
    }
  };

  return (
    <Container fluid className="py-6">
      <Row>
        <Col lg={8}>
          <Card className="shadow-xs border-0">
            <Card.Header className="bg-muted border-0">
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">
                <FaUpload className="me-2" />
                Cargar Archivo de Refritos
              </h5>
            </Card.Header>

            <Card.Body className="p-6">
              {/* Instrucciones */}
              <Alert variant="info" className="mb-6">
                <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-2">📋 Requisitos del archivo:</h6>
                <ul className="list-disc pl-8 mb-0 text-[0.875em]">
                  <li>Formato: CSV, XLSX o XLS</li>
                  <li>
                    Columnas obligatorias: nombre, apellido, edad, numero_contacto, correo, localidad
                    <br/>
                    <small className="text-[0.875em] text-muted-foreground">Nota: la columna <strong>correo</strong> debe existir, pero su valor puede estar vacío (si viene, debe ser un email válido).</small>
                  </li>
                  <li>Columnas opcionales: tipo_afiliacion_id (por defecto 1 = Particular/Autónomo), sueldo_bruto, categoria_monotributo, comentario</li>
                  <li>Edad: debe ser un número entre 1 y 120 años</li>
                  <li>Tipos de afiliación: 1 (Particular), 2 (Con Recibo), 3 (Monotributo)</li>
                </ul>
              </Alert>

              {/* Input de archivo */}
              <Form.Group className="mb-6">
                <Form.Label className="font-bold">Seleccionar archivo:</Form.Label>
                <Form.Control
                  id="archivoInput"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={cargando}
                  className="h-12 text-lg"
                />
                <Form.Text className="text-muted-foreground">
                  {archivo ? `📁 ${archivo.name}` : "Arrastra o selecciona un archivo"}
                </Form.Text>
              </Form.Group>

              {/* Barra de progreso */}
              {cargando && (
                <div className="mb-6">
                  <ProgressBar now={progreso} label={`${progreso}%`} animated />
                  <small className="text-[0.875em] text-muted-foreground block mt-1">
                    {avance
                      ? `Procesando ${avance.procesadas} de ${avance.total} filas. Podés salir de esta pantalla: la carga sigue en el servidor.`
                      : "Subiendo archivo..."}
                  </small>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCargar}
                  disabled={!archivo || cargando}
                  className="flex items-center"
                >
                  {cargando ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <FaUpload className="me-2" />
                      Cargar Archivo
                    </>
                  )}
                </Button>

                <Button
                  variant="outline-secondary"
                  size="lg"
                  onClick={descargarEjemplo}
                  className="flex items-center"
                >
                  <FaDownload className="me-2" />
                  Descargar Ejemplo
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Columna de ayuda */}
        <Col lg={4}>
          <Card className="shadow-xs border-0 mb-4">
            <Card.Header className="bg-muted border-0">
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">🥚 Tipos de Afiliación</h6>
            </Card.Header>
            <Card.Body className="p-4">
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <strong>ID 1:</strong> Particular/Autónomo
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>ID 2:</strong> Con Recibo de Sueldo
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>ID 3:</strong> Monotributista
                </ListGroup.Item>
              </ListGroup>
            </Card.Body>
          </Card>

          <Card className="shadow-xs border-0">
            <Card.Header className="bg-muted border-0">
              <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-0">📝 Columnas del CSV</h6>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="text-[0.875em]">
                <div className="mb-2">
                  <Badge bg="danger" className="me-1">Obligatorio</Badge>
                  <span>
                    nombre, apellido, edad, numero_contacto, correo, localidad
                    <br/>
                    <small className="text-[0.875em] text-muted-foreground">La columna correo puede quedar vacía; si se completa, debe ser válida.</small>
                  </span>
                </div>
                <div>
                  <Badge bg="warning" className="me-1">Opcional</Badge>
                  <span>tipo_afiliacion_id (default 1), sueldo_bruto, categoria_monotributo, comentario</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Resultados */}
      {resultado && (
        <Row className="mt-6">
          <Col>
            <Card className="shadow-xs border-0">
              <Card.Header className="bg-muted border-0">
                <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-0">📊 Resultado de la carga</h5>
              </Card.Header>

              <Card.Body>
                {/* Resumen */}
                <Row className="mb-6">
                  <Col md={3} className="mb-4">
                    <div className="text-center">
                      <h3 className="mb-4 text-[1.75rem] font-bold leading-tight tracking-tight text-success">
                        <FaCheck className="me-2" />
                        {resultado.resultados.exitosos.length}
                      </h3>
                      <p className="text-muted-foreground mb-0">Asignados a vendedor</p>
                      <small className="text-[0.875em] text-muted-foreground">(pasaron todos los filtros)</small>
                    </div>
                  </Col>
                  <Col md={3} className="mb-4">
                    <div className="text-center">
                      <h3 className="mb-4 text-[1.75rem] font-bold leading-tight tracking-tight text-primary">
                        {resultado.resultados.exitosos.filter(e => !e.esDuplicado).length}
                      </h3>
                      <p className="text-muted-foreground mb-0">Nuevos ingresados</p>
                      <small className="text-[0.875em] text-muted-foreground">(no existían en la DB)</small>
                    </div>
                  </Col>
                  <Col md={3} className="mb-4">
                    <div className="text-center">
                      <h3 className="mb-4 text-[1.75rem] font-bold leading-tight tracking-tight text-warning">
                        {resultado.resultados.exitosos.filter(e => e.esDuplicado).length}
                      </h3>
                      <p className="text-muted-foreground mb-0">Reasignados</p>
                      <small className="text-[0.875em] text-muted-foreground">(duplicados reciclados)</small>
                    </div>
                  </Col>
                  <Col md={3} className="mb-4">
                    <div className="text-center">
                      <h3 className="mb-4 text-[1.75rem] font-bold leading-tight tracking-tight text-destructive">
                        <FaTimes className="me-2" />
                        {resultado.resultados.errores.length}
                      </h3>
                      <p className="text-muted-foreground mb-0">Errores / Omitidos</p>
                      <small className="text-[0.875em] text-muted-foreground">(no se asignaron)</small>
                    </div>
                  </Col>
                </Row>

                {/* Exitosos */}
                {resultado.resultados.exitosos.length > 0 && (
                  <div className="mb-6">
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">✅ Refritos cargados:</h6>
                    <ListGroup variant="flush">
                      {resultado.resultados.exitosos.slice(0, 5).map((item, idx) => (
                        <ListGroup.Item key={idx} className="flex justify-between items-center">
                          <div>
                            <strong>{item.nombre} {item.apellido}</strong>
                            <br />
                            <small className="text-[0.875em] text-muted-foreground">
                              Prospecto #{item.prospectoId} → {item.vendedorAsignado}
                            </small>
                          </div>
                          <Badge bg="success">OK</Badge>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                    {resultado.resultados.exitosos.length > 5 && (
                      <p className="mb-4 text-muted-foreground text-[0.875em] mt-2">
                        +{resultado.resultados.exitosos.length - 5} más...
                      </p>
                    )}
                  </div>
                )}

                {/* Errores */}
                {resultado.resultados.errores.length > 0 && (
                  <div>
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">❌ Errores detectados:</h6>
                    <ListGroup variant="flush">
                      {resultado.resultados.errores.slice(0, 5).map((item, idx) => (
                        <ListGroup.Item key={idx} className="border-destructive">
                          <small className="text-[0.875em]">
                            <strong>Fila {item.fila}:</strong> {item.nombre || "Sin nombre"}
                            <br />
                            {Array.isArray(item.errores)
                              ? item.errores.join(", ")
                              : item.error}
                          </small>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                    {resultado.resultados.errores.length > 5 && (
                      <p className="mb-4 text-muted-foreground text-[0.875em] mt-2">
                        +{resultado.resultados.errores.length - 5} más...
                      </p>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default CargarRefritos;
