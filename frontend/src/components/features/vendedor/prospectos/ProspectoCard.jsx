import { Link } from "react-router-dom";
import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  FlameIcon,
  HistoryIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  RepeatIcon,
  SearchIcon,
  StarIcon,
  ZapIcon,
  ArrowRightIcon,
  RecycleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToneBadge } from "@/components/app/tone-badge";
import { NativeSelect } from "@/components/app/native-select";
import { ESTADOS_PROSPECTO, ESTADO_PORCENTAJE, CALIDAD_TONE, getEstadoUI, progresoTone } from "@/lib/estados";
import { formatEdad } from "../../../utils/estadosHelper";
import { cn } from "@/lib/utils";

const PREFERENCIA = {
  email: { label: "Email", Icon: MailIcon },
  whatsapp: { label: "WhatsApp", Icon: MessageCircleIcon },
  llamada: { label: "Llamada", Icon: PhoneIcon },
};

export function ProspectoTags({ prospecto, gecrosHabilitado }) {
  const tags = [];
  if (prospecto.es_reciclado === 1 && prospecto.visible_refrito === 1)
    tags.push(<ToneBadge key="rec" tone="pending"><RecycleIcon />Reciclado</ToneBadge>);
  if (prospecto.origen === "flujo-wss")
    tags.push(<ToneBadge key="wss" tone="teal"><ZapIcon />Super Lead · WA validado</ToneBadge>);
  if (prospecto.origen === "Reafiliacion")
    tags.push(<ToneBadge key="reaf" tone="corporate"><RepeatIcon />Reafiliación</ToneBadge>);
  if (gecrosHabilitado && prospecto.gecros_estado)
    tags.push(
      <ToneBadge key="gecros" tone={prospecto.gecros_estado === "Con Cobertura" ? "success" : "neutral"}>
        {prospecto.gecros_estado}
      </ToneBadge>
    );
  if (!tags.length) return null;
  return <div className="flex flex-wrap gap-1.5">{tags}</div>;
}

export function CalidadDetalle({ prospecto }) {
  if (!prospecto.calidad_categoria) return null;
  const tone = CALIDAD_TONE[prospecto.calidad_categoria] || "neutral";
  const detalle = prospecto.calidad_detalle || [];
  return (
    <Collapsible className="rounded-md border bg-muted/40">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 rounded-md">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <StarIcon className="size-4 text-muted-foreground" />
          Calidad
        </span>
        <span className="flex items-center gap-2">
          <ToneBadge tone={tone}>
            {prospecto.calidad_categoria} · {prospecto.calidad_prospecto}/100
          </ToneBadge>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-2 text-sm">
        <p className="mb-2 text-xs text-muted-foreground">
          El puntaje se calcula automáticamente en base a patrones del historial de contratación. Base: 50 pts.
        </p>
        {prospecto.calidad_override && (
          <p className="mb-2 flex items-start gap-1.5 text-xs font-semibold text-destructive">
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            {prospecto.calidad_override}
          </p>
        )}
        <ul className="divide-y">
          {detalle.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0">
                <span className="font-semibold">{item.factor}:</span>{" "}
                <span className="text-muted-foreground">{item.valor}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-bold tabular-nums",
                  item.puntos > 0 ? "text-success" : item.puntos < 0 ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {item.puntos > 0 ? `+${item.puntos}` : item.puntos === 0 ? "—" : item.puntos}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EstadoSelect({ value, onChange, size, id, ...props }) {
  return (
    <NativeSelect id={id} size={size} value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      {!ESTADOS_PROSPECTO.includes(value) && value && <option value={value}>{value}</option>}
      {ESTADOS_PROSPECTO.map((estado) => (
        <option key={estado} value={estado}>
          {estado}
        </option>
      ))}
    </NativeSelect>
  );
}

export function Progreso({ porcentaje, className }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label="Avance en el embudo"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", progresoTone(porcentaje))}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-bold text-muted-foreground tabular-nums">{porcentaje}%</span>
    </div>
  );
}

export function GuardadoAviso({ alerta, prospectoId }) {
  const visible = alerta.show && alerta.prospectoId === prospectoId;
  const error = alerta.mensaje?.startsWith("Error");
  return (
    <p aria-live="polite" className={cn("min-h-5 text-xs font-semibold", error ? "text-destructive" : "text-success")}>
      {visible && (
        <span className="inline-flex items-center gap-1">
          {error ? <CircleAlertIcon className="size-3.5" /> : <CircleCheckIcon className="size-3.5" />}
          {alerta.mensaje}
        </span>
      )}
    </p>
  );
}

export default function ProspectoCard({
  prospecto,
  values,
  tiposAfiliacion,
  alertaGuardado,
  gecrosHabilitado,
  maskPhoneNumber,
  maskEmail,
  onCardChange,
  onGuardar,
  onConsultarGecros,
  onHistorial,
  onWhatsApp,
  onLlamar,
}) {
  const estadoActual = values.estado !== undefined ? values.estado : prospecto.estado;
  const comentarioActual = values.comentario !== undefined ? values.comentario : prospecto.comentario || "";
  const dniActual = values.dni !== undefined ? values.dni : prospecto.dni || "";
  const progreso = ESTADO_PORCENTAJE[estadoActual] || 0;
  const estadoUI = getEstadoUI(estadoActual, comentarioActual);
  const tipoAfiliacion = tiposAfiliacion.find((t) => t.id === Number(prospecto.tipo_afiliacion_id))?.etiqueta;
  const preferencia = PREFERENCIA[prospecto.preferencia_contacto];
  const fieldId = (name) => `prospecto-${prospecto.id}-${name}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      {prospecto.validado === 1 && (
        <p className="flex items-center justify-center gap-1.5 bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground">
          <FlameIcon className="size-3.5" />
          Validado por WhatsApp · Atención urgente
        </p>
      )}

      <header className="flex flex-col gap-2 border-b px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-corporate">
              {prospecto.nombre} {prospecto.apellido}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatEdad(prospecto.edad)}
              {tipoAfiliacion && <> · {tipoAfiliacion}</>}
            </p>
          </div>
          <ToneBadge tone={estadoUI.tone}>{estadoUI.label}</ToneBadge>
        </div>
        <ProspectoTags prospecto={prospecto} gecrosHabilitado={gecrosHabilitado} />
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="tabular-nums">{maskPhoneNumber(prospecto.numero_contacto) || "Sin teléfono"}</span>
            {preferencia && (
              <ToneBadge tone="neutral" className="ml-auto" title="Preferencia de contacto">
                <preferencia.Icon />
                Prefiere {preferencia.label}
              </ToneBadge>
            )}
          </li>
          {prospecto.correo && (
            <li className="flex items-center gap-2">
              <MailIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{maskEmail(prospecto.correo)}</span>
            </li>
          )}
          {prospecto.localidad && (
            <li className="flex items-center gap-2">
              <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{prospecto.localidad}</span>
            </li>
          )}
        </ul>

        <CalidadDetalle prospecto={prospecto} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fieldId("estado")}>Estado</Label>
          <EstadoSelect
            id={fieldId("estado")}
            value={estadoActual}
            onChange={async (valor) => {
              onCardChange(prospecto.id, "estado", valor);
              await onGuardar(prospecto, "estado", valor);
            }}
          />
          <Progreso porcentaje={progreso} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fieldId("dni")}>DNI</Label>
          <div className="flex gap-2">
            <Input
              id={fieldId("dni")}
              inputMode="numeric"
              value={dniActual}
              onChange={(e) => onCardChange(prospecto.id, "dni", e.target.value)}
              onBlur={async (e) => {
                await onGuardar(prospecto, "dni", e.target.value);
                if (e.target.value && e.target.value.length >= 7) {
                  onConsultarGecros({ ...prospecto, dni: e.target.value });
                }
              }}
              placeholder="Ej: 41379369"
              maxLength={20}
            />
            {gecrosHabilitado && dniActual && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onConsultarGecros({ ...prospecto, dni: dniActual })}
                title="Consultar historial en Gecros"
              >
                <SearchIcon />
                Gecros
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fieldId("comentario")}>Comentario</Label>
          <Textarea
            id={fieldId("comentario")}
            rows={2}
            value={comentarioActual}
            onChange={(e) => onCardChange(prospecto.id, "comentario", e.target.value)}
            onBlur={(e) => onGuardar(prospecto, "comentario", e.target.value)}
            placeholder="Agregá un comentario…"
          />
          <GuardadoAviso alerta={alertaGuardado} prospectoId={prospecto.id} />
        </div>
      </div>

      <footer className="grid grid-cols-4 gap-2 border-t bg-muted/30 p-3">
        <Button variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => onHistorial(prospecto)}>
          <HistoryIcon className="size-5" />
          Historial
        </Button>
        <Button
          variant="outline"
          className="h-14 flex-col gap-1 text-xs text-teal hover:bg-teal/10 hover:text-teal"
          onClick={() => onWhatsApp(prospecto)}
        >
          <MessageCircleIcon className="size-5" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          className="h-14 flex-col gap-1 text-xs"
          onClick={() => onLlamar(prospecto)}
          disabled={!prospecto.numero_contacto}
        >
          <PhoneIcon className="size-5" />
          Llamar
        </Button>
        <Button asChild className="h-14 flex-col gap-1 text-xs">
          <Link to={`/prospectos/${prospecto.id}`}>
            <ArrowRightIcon className="size-5" />
            Cotizar
          </Link>
        </Button>
      </footer>
    </article>
  );
}
