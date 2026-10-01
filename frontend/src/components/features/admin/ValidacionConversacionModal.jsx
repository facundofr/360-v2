import { useEffect, useState } from "react";
import axios from "axios";
import { Modal, Badge, Spinner, Alert } from "@/components/compat/bootstrap";
import { FaWhatsapp, FaCheck, FaClock, FaTimes } from "@/lib/icons";
import { API_URL } from "../../config";
import { cn } from "@/lib/utils";

const ESTADO_ENTREGA_ICON = {
  pendiente: <FaClock style={{ fontSize: 11, opacity: 0.6 }} />,
  enviando: <FaClock style={{ fontSize: 11, opacity: 0.6 }} />,
  enviado: <FaCheck style={{ fontSize: 11, opacity: 0.75 }} />,
  entregado: (
    <span style={{ display: "inline-flex" }}>
      <FaCheck style={{ fontSize: 11, opacity: 0.75 }} />
      <FaCheck style={{ fontSize: 11, opacity: 0.75, marginLeft: -3 }} />
    </span>
  ),
  leido: (
    <span style={{ display: "inline-flex" }}>
      <FaCheck style={{ fontSize: 11, color: "#34B7F1" }} />
      <FaCheck style={{ fontSize: 11, color: "#34B7F1", marginLeft: -3 }} />
    </span>
  ),
  fallido: <FaTimes style={{ fontSize: 11, color: "#ff6b6b" }} />,
};

export default function ValidacionConversacionModal({ show, onHide, prospectoId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!show || !prospectoId) return;

    let cancelado = false;
    const cargar = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const token = localStorage.getItem("cober_token");
        const res = await axios.get(
          `${API_URL}/admin/validacion-whatsapp/prospectos/${prospectoId}/conversacion`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelado) setData(res.data?.data || null);
      } catch (e) {
        if (!cancelado) {
          setError(
            e?.response?.status === 404
              ? "Este lead todavía no tiene conversación de WhatsApp registrada."
              : e?.response?.data?.message || "Error al cargar la conversación"
          );
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [show, prospectoId]);

  const prospecto = data?.prospecto;
  const mensajes = data?.mensajes || [];

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-success text-white">
        <Modal.Title className="flex items-center gap-2">
          <FaWhatsapp />
          <span>
            {prospecto ? `${prospecto.nombre} ${prospecto.apellido}`.trim() : "Conversación de WhatsApp"}
          </span>
          {prospecto?.numero_contacto && (
            <small className="text-[0.875em] opacity-75 ms-1">({prospecto.numero_contacto})</small>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 0 }}>
        {loading && (
          <div className="text-center py-12">
            <Spinner animation="border" variant="success" />
          </div>
        )}
        {!loading && error && (
          <Alert variant="warning" className="m-4 mb-0">
            {error}
          </Alert>
        )}
        {!loading && !error && (
          <div
            className="p-4"
            style={{ backgroundColor: "#e5ddd5", minHeight: 300, maxHeight: "65vh", overflowY: "auto" }}
          >
            {mensajes.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <FaWhatsapp size={32} className="mb-2 opacity-50" />
                <p className="mb-0">Todavía no hay mensajes en esta conversación.</p>
              </div>
            ) : (
              mensajes.map((m) => (
                <div
                  key={m.id}
                  className={`flex mb-2 ${m.origen === "cliente" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`rounded-lg p-2 shadow-xs ${m.origen === "cliente" ? "bg-card" : "bg-primary text-white"}`}
                    style={{ maxWidth: "75%" }}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.mensaje}</div>
                    <div className="flex justify-between items-center mt-1 gap-2">
                      <small className={cn("text-[0.875em]", m.origen === "cliente" ? "text-muted-foreground" : "text-white/60")}>
                        {new Date(m.created_at).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      {m.origen !== "cliente" && ESTADO_ENTREGA_ICON[m.estado_entrega]}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="flex justify-between">
        <div className="text-[0.875em] text-muted-foreground">
          {prospecto && (
            <>
              Estado actual: <Badge bg="dark">{prospecto.estado}</Badge>
            </>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}
