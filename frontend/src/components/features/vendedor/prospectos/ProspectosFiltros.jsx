import { useState } from "react";
import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/app/native-select";
import { ESTADOS_PROSPECTO } from "@/lib/estados";
import { cn } from "@/lib/utils";

export const FILTROS_VACIOS = {
  nombre: "",
  apellido: "",
  edad: "",
  estado: "",
  origen: "",
  fechaDesde: "",
  fechaHasta: "",
  horaDesde: "",
  horaHasta: "",
};

function Campo({ id, label, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function ProspectosFiltros({ filtros, onFiltroChange, ordenLeads, onOrdenChange, onLimpiar }) {
  const [abierto, setAbierto] = useState(false);
  const activos = Object.values(filtros).filter((v) => v !== "").length + (ordenLeads !== "llegada_asc" ? 1 : 0);

  return (
    <section aria-label="Filtros de prospectos" className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="prospectos-filtros"
          className="flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-corporate outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 md:pointer-events-none"
        >
          <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
          Filtros
          {activos > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground tabular-nums">
              {activos}
            </span>
          )}
          <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform md:hidden", abierto && "rotate-180")} />
        </button>
        {activos > 0 && (
          <Button variant="ghost" size="sm" onClick={onLimpiar}>
            <XIcon />
            Limpiar
          </Button>
        )}
      </div>

      <div
        id="prospectos-filtros"
        className={cn(
          "grid grid-cols-2 gap-3 border-t px-4 pt-3 pb-4 md:grid-cols-4 xl:grid-cols-6",
          !abierto && "hidden md:grid"
        )}
      >
        <Campo id="filtro-nombre" label="Nombre">
          <Input id="filtro-nombre" name="nombre" value={filtros.nombre} onChange={onFiltroChange} placeholder="Buscar…" />
        </Campo>
        <Campo id="filtro-apellido" label="Apellido">
          <Input id="filtro-apellido" name="apellido" value={filtros.apellido} onChange={onFiltroChange} placeholder="Buscar…" />
        </Campo>
        <Campo id="filtro-edad" label="Edad">
          <Input id="filtro-edad" name="edad" type="number" min="0" inputMode="numeric" value={filtros.edad} onChange={onFiltroChange} />
        </Campo>
        <Campo id="filtro-estado" label="Estado">
          <Input id="filtro-estado" name="estado" list="filtro-estado-opciones" value={filtros.estado} onChange={onFiltroChange} placeholder="Cualquiera" />
          <datalist id="filtro-estado-opciones">
            {ESTADOS_PROSPECTO.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </Campo>
        <Campo id="filtro-origen" label="Origen" className="col-span-2 md:col-span-1">
          <NativeSelect id="filtro-origen" name="origen" value={filtros.origen} onChange={onFiltroChange}>
            <option value="">Todos los orígenes</option>
            <option value="reciclado">Reciclados</option>
            <option value="Formulario Web">Formulario web</option>
            <option value="Vendedor-App">Vendedor-App</option>
          </NativeSelect>
        </Campo>
        <Campo id="filtro-orden" label="Ordenar por llegada" className="col-span-2 md:col-span-1">
          <NativeSelect id="filtro-orden" value={ordenLeads} onChange={(e) => onOrdenChange(e.target.value)}>
            <option value="llegada_asc">Más antiguos primero</option>
            <option value="llegada_desc">Más recientes primero</option>
          </NativeSelect>
        </Campo>
        <Campo id="filtro-fecha-desde" label="Llegada desde">
          <Input id="filtro-fecha-desde" type="date" name="fechaDesde" value={filtros.fechaDesde} onChange={onFiltroChange} />
        </Campo>
        <Campo id="filtro-fecha-hasta" label="Llegada hasta">
          <Input
            id="filtro-fecha-hasta"
            type="date"
            name="fechaHasta"
            value={filtros.fechaHasta}
            onChange={onFiltroChange}
            min={filtros.fechaDesde || undefined}
          />
        </Campo>
        <Campo id="filtro-hora-desde" label="Hora desde">
          <Input id="filtro-hora-desde" type="time" name="horaDesde" value={filtros.horaDesde} onChange={onFiltroChange} />
        </Campo>
        <Campo id="filtro-hora-hasta" label="Hora hasta">
          <Input id="filtro-hora-hasta" type="time" name="horaHasta" value={filtros.horaHasta} onChange={onFiltroChange} />
        </Campo>
      </div>
    </section>
  );
}
