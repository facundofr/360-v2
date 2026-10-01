import { Link } from "react-router-dom";
import { ArrowRightIcon, HistoryIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToneBadge } from "@/components/app/tone-badge";
import { CALIDAD_TONE, ESTADO_PORCENTAJE } from "@/lib/estados";
import { EstadoSelect, GuardadoAviso, Progreso, ProspectoTags } from "./ProspectoCard";

function IconAction({ label, children, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function ProspectosTabla({
  prospectos,
  editValues,
  tiposAfiliacion,
  alertaGuardado,
  gecrosHabilitado,
  maskPhoneNumber,
  onCardChange,
  onGuardar,
  onHistorial,
  onWhatsApp,
  onLlamar,
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead className="min-w-44">Prospecto</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Afiliación</TableHead>
            <TableHead>Calidad</TableHead>
            <TableHead className="min-w-56">Estado y comentario</TableHead>
            <TableHead className="min-w-28">Progreso</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospectos.map((prospecto) => {
            const values = editValues[prospecto.id] || {};
            const estadoActual = values.estado !== undefined ? values.estado : prospecto.estado;
            const comentarioActual = values.comentario !== undefined ? values.comentario : prospecto.comentario || "";
            return (
              <TableRow key={prospecto.id} className="align-top">
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">{prospecto.id}</TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-semibold text-foreground">
                      {prospecto.nombre} {prospecto.apellido}
                    </span>
                    <span className="text-xs text-muted-foreground">{prospecto.edad} años</span>
                    {prospecto.validado === 1 && <ToneBadge tone="lost">Validado · Urgente</ToneBadge>}
                    <ProspectoTags prospecto={prospecto} gecrosHabilitado={gecrosHabilitado} />
                  </div>
                </TableCell>
                <TableCell className="text-sm tabular-nums">{maskPhoneNumber(prospecto.numero_contacto)}</TableCell>
                <TableCell className="whitespace-normal">
                  {tiposAfiliacion.find((t) => t.id === Number(prospecto.tipo_afiliacion_id))?.etiqueta || (
                    <span className="text-muted-foreground">Sin datos</span>
                  )}
                </TableCell>
                <TableCell>
                  {prospecto.calidad_categoria ? (
                    <ToneBadge
                      tone={CALIDAD_TONE[prospecto.calidad_categoria] || "neutral"}
                      title={`Puntaje: ${prospecto.calidad_prospecto}/100`}
                    >
                      {prospecto.calidad_categoria} · {prospecto.calidad_prospecto}
                    </ToneBadge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-2">
                    <EstadoSelect
                      size="sm"
                      aria-label={`Estado de ${prospecto.nombre} ${prospecto.apellido}`}
                      value={estadoActual}
                      onChange={async (valor) => {
                        onCardChange(prospecto.id, "estado", valor);
                        await onGuardar(prospecto, "estado", valor);
                      }}
                    />
                    <Textarea
                      rows={2}
                      aria-label={`Comentario de ${prospecto.nombre} ${prospecto.apellido}`}
                      value={comentarioActual}
                      onChange={(e) => onCardChange(prospecto.id, "comentario", e.target.value)}
                      onBlur={(e) => onGuardar(prospecto, "comentario", e.target.value)}
                      placeholder="Agregá un comentario…"
                      className="min-h-14"
                    />
                    <GuardadoAviso alerta={alertaGuardado} prospectoId={prospecto.id} />
                  </div>
                </TableCell>
                <TableCell>
                  <Progreso porcentaje={ESTADO_PORCENTAJE[estadoActual] || 0} className="pt-3" />
                </TableCell>
                <TableCell>
                  <div className="grid grid-cols-2 justify-end gap-1.5 2xl:flex">
                    <IconAction label="Ver historial" onClick={() => onHistorial(prospecto)}>
                      <HistoryIcon />
                    </IconAction>
                    <IconAction label="Abrir WhatsApp" className="text-teal" onClick={() => onWhatsApp(prospecto)}>
                      <MessageCircleIcon />
                    </IconAction>
                    <IconAction label="Llamar" onClick={() => onLlamar(prospecto)} disabled={!prospecto.numero_contacto}>
                      <PhoneIcon />
                    </IconAction>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild size="icon" aria-label="Ver cotizaciones y detalle">
                          <Link to={`/prospectos/${prospecto.id}`}>
                            <ArrowRightIcon />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver cotizaciones y detalle</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
