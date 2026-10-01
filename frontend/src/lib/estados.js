// Estados de prospecto y su tono visual (DESIGN.md: "The One Status Language Rule").
// Reemplaza a utils/estadosHelper.js en las pantallas migradas.

export const ESTADOS_PROSPECTO = [
  "Lead",
  "1º Contacto",
  "WhatsApp enviado",
  "Llamada telefónica",
  "Conversación iniciada por WhatsApp",
  "Promoción aplicada",
  "Calificado Cotización",
  "Calificado Póliza",
  "Calificado Pago",
  "Póliza iniciada",
  "Póliza generada",
  "Póliza enviada a supervisor",
  "Póliza pendiente a firma",
  "Póliza firmada",
  "Venta",
  "Fuera de zona",
  "Fuera de edad",
  "Preexistencia",
  "Reafiliación",
  "No contesta",
  "prueba interna",
  "Ya es socio",
  "Busca otra Cobertura",
  "Teléfono erróneo",
  "No le interesa (económico)",
  "No le interesa cartilla",
  "No busca cobertura médica",
];

// Porcentaje de avance en el embudo de venta
export const ESTADO_PORCENTAJE = {
  Lead: 10,
  "1º Contacto": 25,
  "WhatsApp enviado": 25,
  "Llamada telefónica": 25,
  "Conversación iniciada por WhatsApp": 35,
  "Promoción aplicada": 40,
  "Calificado Cotización": 50,
  "Calificado Póliza": 75,
  "Calificado Pago": 90,
  "Póliza iniciada": 91,
  "Póliza generada": 92,
  "Póliza enviada a supervisor": 94,
  "Póliza pendiente a firma": 96,
  "Póliza firmada": 98,
  Venta: 100,
};

// Etiqueta corta + tono. Tonos: neutral, contact, progress, pending, success, lost
const ESTADO_UI = {
  Lead: { label: "Lead", tone: "neutral" },
  "1º Contacto": { label: "1º Contacto", tone: "contact" },
  "WhatsApp enviado": { label: "WhatsApp enviado", tone: "contact" },
  "Llamada telefónica": { label: "Llamada", tone: "contact" },
  "Conversación iniciada por WhatsApp": { label: "Chat WhatsApp", tone: "contact" },
  "Promoción aplicada": { label: "Promo aplicada", tone: "progress" },
  "Calificado Cotización": { label: "Cotización", tone: "progress" },
  "Calificado Póliza": { label: "Póliza", tone: "progress" },
  "Calificado Pago": { label: "Pago", tone: "progress" },
  "Póliza iniciada": { label: "Póliza iniciada", tone: "progress" },
  "Póliza generada": { label: "Póliza generada", tone: "progress" },
  "Póliza enviada a supervisor": { label: "Env. supervisor", tone: "progress" },
  "Póliza pendiente a firma": { label: "Pend. firma", tone: "pending" },
  "Póliza firmada": { label: "Firmada", tone: "success" },
  Venta: { label: "Venta", tone: "success" },
  "No contesta": { label: "No contesta", tone: "pending" },
  "Busca otra Cobertura": { label: "Otra cobertura", tone: "lost" },
  "Ya es socio": { label: "Ya es socio", tone: "neutral" },
  "Reafiliación": { label: "Reafiliación", tone: "neutral" },
  "prueba interna": { label: "Prueba interna", tone: "neutral" },
  "Fuera de zona": { label: "Fuera zona", tone: "lost" },
  "Fuera de edad": { label: "Fuera edad", tone: "lost" },
  Preexistencia: { label: "Preexistencia", tone: "lost" },
  "Teléfono erróneo": { label: "Tel. erróneo", tone: "lost" },
  "No le interesa (económico)": { label: "No interesa", tone: "lost" },
  "No le interesa cartilla": { label: "No interesa", tone: "lost" },
  "No busca cobertura médica": { label: "No cobertura", tone: "lost" },
};

export function getEstadoUI(estado, comentario) {
  const base = ESTADO_UI[estado] || { label: estado || "Sin estado", tone: "neutral" };
  if (estado === "Promoción aplicada" && comentario) {
    const match = String(comentario).match(/\((\d+(?:[.,]\d+)?)\s*%/);
    if (match) return { ...base, label: `Promo ${match[1]}%` };
  }
  return base;
}

// Tonos de las insignias: fondo suave + texto fuerte (contraste ≥ 4.5:1)
export const TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground border-border",
  contact: "bg-info/10 text-info border-info/25",
  progress: "bg-accent text-primary border-primary/20",
  pending: "bg-warning-soft text-warning border-warning/25",
  success: "bg-success-soft text-success border-success/25",
  lost: "bg-destructive/8 text-destructive border-destructive/20",
  teal: "bg-teal/10 text-teal border-teal/25",
  corporate: "bg-corporate/8 text-corporate border-corporate/20",
};

// Calidad del prospecto
export const CALIDAD_TONE = {
  Alta: "success",
  Buena: "progress",
  Regular: "pending",
  Baja: "lost",
};

// Color de la barra de progreso según avance
export function progresoTone(porcentaje) {
  if (porcentaje >= 98) return "bg-success";
  if (porcentaje >= 50) return "bg-primary";
  if (porcentaje > 0) return "bg-warning";
  return "bg-destructive";
}
