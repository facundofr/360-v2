import { useState, useEffect } from "react";
import { Modal, Button, Form, Card, Alert } from "@/components/compat/bootstrap";
import axios from "axios";
import Swal from "@/lib/alerts"; // Añadir esta importación
import { API_URL } from "../../config";


const PromocionesModal = ({ prospectoId, prospectoOrigen, show, onClose, onPromocionAplicada }) => {
  const esReafiliacion = prospectoOrigen === 'Reafiliacion';
  const [promociones, setPromociones] = useState([]);
  const [selectedPromocion, setSelectedPromocion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promocionActual, setPromocionActual] = useState(null);

  useEffect(() => {
    if (show) {
      fetchPromociones();
      fetchPromocionActual();
    }
  }, [show, prospectoId]);

  const fetchPromociones = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/vendedor/promociones`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setPromociones(data);
    } catch (error) {
      setError("Error al cargar promociones");
      console.error("Error al obtener promociones:", error);
    }
  };

  const fetchPromocionActual = async () => {
    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/vendedor/prospectos/${prospectoId}/promocion-actual`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (data && data.promocion) {
        setPromocionActual(data.promocion);
      } else {
        setPromocionActual(null);
      }
    } catch (error) {
      console.error("Error al obtener promoción actual:", error);
    }
  };

  const handleSelectPromocion = (promocion) => {
    setSelectedPromocion(promocion);
  };

  const handleAplicarPromocion = async () => {
    if (!selectedPromocion) {
      setError("Por favor selecciona una promoción");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("cober_token");
      await axios.post(
        `${API_URL}/vendedor/prospectos/${prospectoId}/aplicar-promocion`,
        { promocionId: selectedPromocion.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPromocionActual(selectedPromocion);

      // Cerrar modal inmediatamente
      onClose();
      setSelectedPromocion(null);

      // Actualizar las cotizaciones en el componente padre
      if (onPromocionAplicada) {
        onPromocionAplicada();
      }

      // Mostrar SweetAlert de éxito
      const etiquetaTipo = selectedPromocion.tipo === "incremento" ? "incremento" : "descuento";
      Swal.fire({
        title: '¡Promoción aplicada!',
        text: `La promoción "${selectedPromocion.nombre || selectedPromocion.titulo}" con ${selectedPromocion.descuento_porcentaje || selectedPromocion.descuento}% de ${etiquetaTipo} se ha aplicado correctamente.`,
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#28a745'
      });
      
    } catch (error) {
      setError("Error al aplicar la promoción");
      console.error("Error al aplicar promoción:", error);
      
      // Mostrar SweetAlert de error
      Swal.fire({
        title: 'Error',
        text: 'No se pudo aplicar la promoción. Por favor, inténtalo de nuevo.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Aplicar Promoción</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {promocionActual && (
          <Alert variant="info">
            <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate">Promoción actual aplicada:</h5>
            <p className="mb-4">
              <strong>{promocionActual.nombre || promocionActual.titulo}</strong> -{" "}
              {promocionActual.tipo === "incremento" ? "+" : ""}
              {promocionActual.descuento_porcentaje || promocionActual.descuento}%
              {promocionActual.tipo === "incremento" ? " (incremento)" : ""}
            </p>
            <p className="mb-4">{promocionActual.descripcion}</p>
          </Alert>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {esReafiliacion && (
          <Alert variant="warning">
            🔁 Este prospecto viene de <strong>Reafiliación</strong>: sólo se le puede aplicar la promoción del <strong>55% de descuento</strong>.
          </Alert>
        )}

        <Form>
          <Form.Group>
            <Form.Label>Selecciona una promoción:</Form.Label>
            <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]">
              {(esReafiliacion
                ? promociones.filter((p) => p.tipo === 'descuento' && Number(p.descuento_porcentaje) === 55)
                : promociones
              ).map((promocion) => (
                <div key={promocion.id} className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12 mb-4">
                  <Card
                    className={`h-full ${
                      selectedPromocion?.id === promocion.id 
                        ? "border-primary border-[3px] shadow-lg ring-[3px] ring-ring/25" 
                        : "border-border transition-shadow hover:border-primary hover:shadow-md"
                    }`}
                    onClick={() => handleSelectPromocion(promocion)}
                    style={{ 
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      transform: selectedPromocion?.id === promocion.id ? "scale(1.02)" : "scale(1)",
                      backgroundColor: selectedPromocion?.id === promocion.id ? "#f8f9ff" : "white"
                    }}
                  >
                    <Card.Body className="relative">
                      {selectedPromocion?.id === promocion.id && (
                        <div className="absolute top-0 right-0 m-2">
                          <div 
                            className="bg-primary text-white rounded-full flex items-center justify-center"
                            style={{ width: "30px", height: "30px" }}
                          >
                            ✓
                          </div>
                        </div>
                      )}
                      <Card.Title className={selectedPromocion?.id === promocion.id ? "text-primary font-bold" : ""}>
                        {promocion.nombre || promocion.titulo}
                      </Card.Title>
                      <Card.Text className={selectedPromocion?.id === promocion.id ? "text-foreground" : "text-muted-foreground"}>
                        {promocion.descripcion}
                      </Card.Text>
                      <Card.Text className={`font-bold ${selectedPromocion?.id === promocion.id ? "text-success text-[1.25rem] leading-snug" : "text-primary"}`}>
                        {promocion.tipo === "incremento" ? "📈 Incremento" : "🎯 Descuento"}: {promocion.descuento_porcentaje || promocion.descuento}%
                      </Card.Text>
                      {promocion.fecha_vencimiento && (
                        <Card.Text className="text-muted-foreground text-[0.875em]">
                          📅 Válido hasta:{" "}
                          {new Date(promocion.fecha_vencimiento).toLocaleDateString()}
                        </Card.Text>
                      )}
                      {selectedPromocion?.id === promocion.id && (
                        <div className="mt-2">
                          <small className="text-[0.875em] text-success font-bold">
                            ✅ Promoción seleccionada
                          </small>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              ))}
            </div>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleAplicarPromocion}
          disabled={loading || !selectedPromocion}
        >
          {loading ? "Aplicando..." : "Aplicar Promoción"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PromocionesModal;
