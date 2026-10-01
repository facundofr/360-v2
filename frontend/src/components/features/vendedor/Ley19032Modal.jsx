import { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner, Table } from "@/components/compat/bootstrap";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config";
import { formatEdad } from "../../utils/estadosHelper";


const Ley19032Modal = ({ prospectoId, show, onClose, onLey19032Aplicada, integrantesConReciboSueldo = [] }) => {
  const [loading, setLoading] = useState(false);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [calculoPreview, setCalculoPreview] = useState({});
  const [totalCotizacionesConRecibo, setTotalCotizacionesConRecibo] = useState(0);
  const [integrantesSeleccionados, setIntegrantesSeleccionados] = useState({});
  const [importesLey19032, setImportesLey19032] = useState({});
  const [integrantesUnicos, setIntegrantesUnicos] = useState([]);

  // ✅ DEDUPLICAR integrantes cuando cambie el prop
  useEffect(() => {
    const integrantesMap = new Map();
    
    integrantesConReciboSueldo.forEach((integrante) => {
      const clave = `${(integrante.vinculo || '').toLowerCase()}|${(integrante.nombre || '').trim()}`;
      if (!integrantesMap.has(clave)) {
        integrantesMap.set(clave, integrante);
      }
    });
    
    const deduplicados = Array.from(integrantesMap.values());
    setIntegrantesUnicos(deduplicados);
    
    // Reinicializar importes
    const importesIniciales = {};
    deduplicados.forEach((_, idx) => {
      importesIniciales[idx] = '';
    });
    setImportesLey19032(importesIniciales);
  }, [integrantesConReciboSueldo]);

  useEffect(() => {
    if (show) {
      fetchCotizaciones();
    }
  }, [show]);

  useEffect(() => {
    // Calcular preview cuando cambien los importes
    calcularAportesPresuntivos();
  }, [importesLey19032]);

  const fetchCotizaciones = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      const { data } = await axios.get(
        `${API_URL}/lead/${prospectoId}/cotizaciones?detalles=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Filtrar solo cotizaciones que tienen personas con tipo de afiliación "Con recibo de sueldo" (tipo_afiliacion_id = 2)
      const cotizacionesConRecibo = data.filter(cotizacion => 
        cotizacion.detalles && cotizacion.detalles.some(detalle => 
          detalle.tipo_afiliacion_id === 2
        )
      );
      
      setCotizaciones(cotizacionesConRecibo);
      
      // Contar total de personas con recibo de sueldo en todas las cotizaciones
      const totalPersonasConRecibo = cotizacionesConRecibo.reduce((total, cotizacion) => {
        return total + cotizacion.detalles.filter(detalle => detalle.tipo_afiliacion_id === 2).length;
      }, 0);
      
      setTotalCotizacionesConRecibo(totalPersonasConRecibo);
    } catch (error) {
      console.error("Error al obtener cotizaciones:", error);
      Swal.fire("Error", "No se pudieron cargar las cotizaciones", "error");
    } finally {
      setLoading(false);
    }
  };

  const calcularAportesPresuntivos = () => {
    const nuevoCalculoPreview = {};
    let hayAlgunImporte = false;

    integrantesConReciboSueldo.forEach((integrante, idx) => {
      const importe = parseFloat(importesLey19032[idx] || 0);
      
      if (importe > 0) {
        hayAlgunImporte = true;
        const sueldoBruto = importe / 0.03;
        const aportePresuntivo = sueldoBruto * 0.06732;
        
        nuevoCalculoPreview[idx] = {
          nombre: integrante.nombre,
          vinculo: integrante.vinculo,
          importeLey19032: importe,
          sueldoBruto: sueldoBruto,
          aportePresuntivo: aportePresuntivo
        };
      }
    });

    setCalculoPreview(hayAlgunImporte ? nuevoCalculoPreview : {});
  };

  const handleAplicarLey19032 = async () => {
    if (cotizaciones.length === 0) {
      Swal.fire("Error", "No hay cotizaciones disponibles con personas que tengan recibo de sueldo", "error");
      return;
    }

    if (Object.keys(calculoPreview).length === 0) {
      Swal.fire("Error", "Debe ingresar importes válidos de Ley 19032 para al menos un integrante", "error");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("cober_token");
      
      // Construir array de integrantes con sus aportes
      const integrantesConAporte = Object.entries(calculoPreview).map(([, datos]) => ({
        nombre: datos.nombre,
        vinculo: datos.vinculo,
        importe_ley19032: datos.importeLey19032,
        sueldo_bruto_calculado: datos.sueldoBruto,
        aporte_presuntivo: datos.aportePresuntivo
      }));
      
      // Aplicar la ley a todas las cotizaciones
      const promises = cotizaciones.map(cotizacion =>
        axios.post(
          `${API_URL}/cotizaciones/${cotizacion.id}/aplicar-ley19032`,
          {
            integrantesConAporte: integrantesConAporte
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );

      await Promise.all(promises);

      const totalAporte = Object.values(calculoPreview).reduce((sum, calc) => sum + calc.aportePresuntivo, 0);

      Swal.fire({
        icon: "success",
        title: "¡Ley 19032 aplicada!",
        text: `Aporte presuntivo total de $${totalAporte.toLocaleString('es-AR')} aplicado a ${Object.keys(calculoPreview).length} integrante(s) en ${cotizaciones.length} cotización(es)`,
        confirmButtonText: "Continuar"
      });

      onLey19032Aplicada();
      handleClose();
    } catch (error) {
      console.error("Error al aplicar Ley 19032:", error);
      Swal.fire("Error", "No se pudo aplicar la Ley 19032 a las cotizaciones", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setImportesLey19032({});
    setCalculoPreview({});
    setTotalCotizacionesConRecibo(0);
    setIntegrantesSeleccionados({});
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Aplicar Ley 19032 - Aporte Presuntivo</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-6">
            <Spinner animation="border" variant="primary" />
            <p className="mb-4 mt-2">Cargando...</p>
          </div>
        ) : (
          <>
            <Alert variant="info">
              <strong>Ley 19032 - Cálculo de Aporte Presuntivo</strong>
              <br />
              Ingrese el importe de descuento por Ley 19032 que figura en el recibo de sueldo.
              <br />
              <strong>Se aplicará automáticamente a todas las cotizaciones que contengan personas con recibo de sueldo.</strong>
              <div className="my-2 rounded-sm border-l-4 border-teal bg-muted p-2 font-mono text-sm">
                <strong>Fórmula:</strong> (Ley 19032 ÷ 0.03) × 0.06732 = Aporte Presuntivo
              </div>
            </Alert>

            {cotizaciones.length === 0 ? (
              <Alert variant="warning">
                No hay cotizaciones disponibles con tipo de afiliación "Con recibo de sueldo"
              </Alert>
            ) : (
              <>
                <Alert variant="success">
                  <strong>Cotizaciones encontradas:</strong> {cotizaciones.length}<br />
                  <strong>Total de personas con recibo de sueldo:</strong> {totalCotizacionesConRecibo}
                </Alert>

                {/* Mostrar integrantes con recibo de sueldo e ingresar importes individuales */}
                {integrantesUnicos.length > 0 && (
                  <div className="mb-6">
                    <h6 className="text-base font-bold leading-tight tracking-tight text-corporate mb-4">Ingrese el importe de Ley 19032 para cada integrante:</h6>
                    <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]">
                      {integrantesUnicos.map((integrante, idx) => (
                        <div key={idx} className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12 mb-4">
                          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground p-4">
                            <div className="mb-2">
                              <strong>{integrante.nombre}</strong><br />
                              <small className="text-[0.875em] text-muted-foreground">{integrante.vinculo} - {formatEdad(integrante.edad)}</small>
                            </div>
                            <Form.Group>
                              <Form.Label className="text-[0.875em]">Importe Ley 19032 ($)</Form.Label>
                              <Form.Control
                                type="number"
                                step="0.01"
                                placeholder="Ej: 40000"
                                value={importesLey19032[idx] || ''}
                                onChange={(e) => {
                                  const nuevoImportes = { ...importesLey19032 };
                                  nuevoImportes[idx] = e.target.value;
                                  setImportesLey19032(nuevoImportes);
                                }}
                                className="h-9 text-sm"
                              />
                            </Form.Group>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(calculoPreview).length > 0 && (
                  <div className="mt-4 rounded-md border border-teal/25 bg-teal/5 p-4 [&_table]:mb-0">
                    <h6 className="mb-4 text-base font-bold leading-tight tracking-tight text-corporate">Vista Previa del Cálculo por Integrante</h6>
                    <div className="[--gx:1.5rem] [--gy:0rem] flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)]">
                      {Object.entries(calculoPreview).map(([, datos]) => (
                        <div key={datos.nombre} className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12 mb-4">
                          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground p-4">
                            <div className="mb-2">
                              <strong>{datos.nombre}</strong><br />
                              <small className="text-[0.875em] text-muted-foreground">{datos.vinculo}</small>
                            </div>
                            <Table size="sm" className="mb-0">
                              <tbody>
                                <tr>
                                  <td><strong>Ley 19032:</strong></td>
                                  <td>{formatCurrency(datos.importeLey19032)}</td>
                                </tr>
                                <tr>
                                  <td><strong>Sueldo Bruto:</strong></td>
                                  <td>{formatCurrency(datos.sueldoBruto)}</td>
                                </tr>
                                <tr className="bg-success-soft">
                                  <td><strong>Aporte Presuntivo:</strong></td>
                                  <td><strong>{formatCurrency(datos.aportePresuntivo)}</strong></td>
                                </tr>
                              </tbody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="relative rounded-md border px-4 py-3 text-sm leading-relaxed border-success/25 bg-success-soft text-foreground mt-4">
                      <strong>Total Aporte Presuntivo:</strong> {
                        formatCurrency(
                          Object.values(calculoPreview).reduce((sum, calc) => sum + calc.aportePresuntivo, 0)
                        )
                      }
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleAplicarLey19032}
          disabled={loading || cotizaciones.length === 0 || Object.keys(calculoPreview).length === 0}
        >
          {loading ? <Spinner animation="border" size="sm" /> : "Aplicar Ley 19032 a Todas las Cotizaciones"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Ley19032Modal;
