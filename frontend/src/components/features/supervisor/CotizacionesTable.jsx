import { useEffect, useState } from "react";
import { Container, Button, Table, Form } from "@/components/compat/bootstrap";
import axios from "axios";
import { API_URL } from "../../config";


const CotizacionesTabla = () => {
  const [prospectos, setProspectos] = useState([]);
  const [cotizaciones, setCotizaciones] = useState({});
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState("");

  useEffect(() => {
    // Obtener la lista de prospectos
    const fetchProspectos = async () => {
      try {
        const token = localStorage.getItem("cober_token");
        const { data } = await axios.get(`${API_URL}/supervisor/prospectos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProspectos(data);
      } catch (error) {
        console.error("Error al obtener prospectos:", error);
      }
    };

    fetchProspectos();
  }, []);

  const handleProspectoChange = async (e) => {
    const prospectoId = e.target.value;
    setProspectoSeleccionado(prospectoId);

    if (!prospectoId) {
      setCotizaciones({});
      return;
    }

    try {
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(`${API_URL}/supervisor/cotizaciones/${prospectoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Organizar cotizaciones por plan
      const cotizacionesPorPlan = data.reduce((acc, cot) => {
        const plan = cot.plan || "Sin Plan";
        if (!acc[plan]) acc[plan] = [];
        acc[plan].push(cot);
        return acc;
      }, {});

      setCotizaciones(cotizacionesPorPlan);
    } catch (error) {
      setCotizaciones({});
      console.error("Error al obtener cotizaciones:", error);
    }
  };

  return (
    <Container className="my-6">
      <h4 className="mb-4 text-[1.5rem] font-bold leading-tight tracking-tight text-corporate">Cotizaciones</h4>

      {/* Selector de prospectos */}
      <Form.Group className="mb-4">
        <Form.Label>Selecciona un prospecto</Form.Label>
        <Form.Select value={prospectoSeleccionado} onChange={handleProspectoChange}>
          <option value="">Selecciona...</option>
          {prospectos.map((prospecto) => (
            <option key={prospecto.id} value={prospecto.id}>
              {prospecto.nombre} {prospecto.apellido}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {/* Mostrar cotizaciones organizadas por plan */}
      {Object.keys(cotizaciones).length === 0 ? (
        <div className="text-muted-foreground">Sin cotizaciones</div>
      ) : (
        Object.entries(cotizaciones).map(([plan, cotizaciones]) => (
          <div key={plan} className="mb-6">
            <h5 className="mb-4 text-[1.25rem] leading-tight tracking-tight text-corporate font-bold">{plan}</h5>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th className="text-left">#</th>
                  <th className="text-left">Persona</th>
                  <th className="text-left">Vínculo</th>
                  <th className="text-left">Edad</th>
                  <th className="text-left">Tipo Afiliación</th>
                  <th className="text-left">Precio Base</th>
                  <th className="text-left">Descuento</th>
                  <th className="text-left">Precio Final</th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((cotizacion, index) => (
                  <tr key={cotizacion.id}>
                    <td>{index + 1}</td>
                    <td>{cotizacion.persona}</td>
                    <td>{cotizacion.vinculo}</td>
                    <td>{cotizacion.edad}</td>
                    <td>{cotizacion.tipo_afiliacion}</td>
                    <td>${cotizacion.precio_base}</td>
                    <td>${cotizacion.descuento_aporte}</td>
                    <td>${cotizacion.precio_final}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))
      )}
    </Container>
  );
};

export default CotizacionesTabla;