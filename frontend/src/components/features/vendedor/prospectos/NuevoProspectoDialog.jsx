import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/app/native-select";
import { formatEdad } from "../../../utils/estadosHelper";
import { cn } from "@/lib/utils";

const categoriasDeTipo = (tipo) => {
  if (!tipo) return [];
  if (Array.isArray(tipo.categorias)) return tipo.categorias;
  try {
    const parsed = JSON.parse(tipo.categorias || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function Campo({ id, label, hint, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MenorDeUnAnio({ id, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      Menor de 1 año
    </label>
  );
}

export default function NuevoProspectoDialog({
  open,
  onClose,
  formData,
  onChange,
  onSubmit,
  menorDeUnAnioTitular,
  onMenorTitularChange,
  tiposAfiliacion,
  localidades,
  gecrosHabilitado,
  vinculos,
  categoriasMonotributo,
  nuevoFamiliar,
  onFamiliarChange,
  menorDeUnAnioFamiliar,
  onMenorFamiliarChange,
  familiares,
  onAgregarFamiliar,
  onEliminarFamiliar,
}) {
  const tipoTitular = tiposAfiliacion.find((t) => t.id === Number(formData.tipo_afiliacion_id));
  const tipoFamiliar = tiposAfiliacion.find((t) => t.id === Number(nuevoFamiliar.tipo_afiliacion_id));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-corporate">Nuevo prospecto</DialogTitle>
          <DialogDescription>Se cotiza automáticamente al guardarlo.</DialogDescription>
        </DialogHeader>

        <form id="nuevo-prospecto" onSubmit={onSubmit} className="flex flex-col gap-6">
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <legend className="sr-only">Datos del titular</legend>
            <Campo id="np-nombre" label="Nombre" className="sm:col-span-3">
              <Input id="np-nombre" name="nombre" value={formData.nombre} onChange={onChange} required maxLength={100} autoComplete="given-name" />
            </Campo>
            <Campo id="np-apellido" label="Apellido" className="sm:col-span-3">
              <Input id="np-apellido" name="apellido" value={formData.apellido} onChange={onChange} required maxLength={100} autoComplete="family-name" />
            </Campo>
            <Campo id="np-edad" label="Edad" className="sm:col-span-2">
              <Input
                id="np-edad"
                type="number"
                inputMode="numeric"
                name="edad"
                value={menorDeUnAnioTitular ? 0 : formData.edad}
                onChange={onChange}
                min={0}
                max={120}
                disabled={menorDeUnAnioTitular}
                required
              />
              <MenorDeUnAnio id="np-menor" checked={menorDeUnAnioTitular} onChange={onMenorTitularChange} />
            </Campo>
            <Campo id="np-tipo" label="Tipo de afiliación" className="sm:col-span-4">
              <NativeSelect id="np-tipo" name="tipo_afiliacion_id" value={formData.tipo_afiliacion_id} onChange={onChange} required>
                <option value="">Seleccioná…</option>
                {tiposAfiliacion.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.etiqueta}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            {tipoTitular?.requiere_sueldo === 1 && (
              <Campo id="np-sueldo" label="Sueldo bruto" className="sm:col-span-3">
                <Input
                  id="np-sueldo"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  name="sueldo_bruto"
                  value={formData.sueldo_bruto}
                  onChange={onChange}
                  min={0}
                  max={99999999.99}
                  required
                />
              </Campo>
            )}
            {tipoTitular?.requiere_categoria === 1 && (
              <Campo id="np-categoria" label="Categoría monotributo" className="sm:col-span-3">
                <NativeSelect id="np-categoria" name="categoria_monotributo" value={formData.categoria_monotributo || ""} onChange={onChange} required>
                  <option value="">Seleccioná…</option>
                  {categoriasDeTipo(tipoTitular).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
            )}

            <Campo id="np-telefono" label="Número de contacto" className="sm:col-span-3">
              <Input
                id="np-telefono"
                type="tel"
                inputMode="tel"
                name="numero_contacto"
                value={formData.numero_contacto || ""}
                onChange={onChange}
                required
                maxLength={30}
                autoComplete="tel"
              />
            </Campo>
            <Campo id="np-correo" label="Correo" className="sm:col-span-3">
              <Input
                id="np-correo"
                type="email"
                name="correo"
                value={formData.correo || ""}
                onChange={onChange}
                required
                maxLength={100}
                autoComplete="email"
              />
            </Campo>
            <Campo id="np-localidad" label="Localidad" className="sm:col-span-3">
              <NativeSelect id="np-localidad" name="localidad" value={formData.localidad || ""} onChange={onChange} required>
                <option value="">Seleccioná…</option>
                {localidades.map((loc) => (
                  <option key={loc.id} value={loc.nombre}>
                    {loc.nombre}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
            <Campo
              id="np-dni"
              label="DNI"
              hint={gecrosHabilitado ? "Se consulta automáticamente en Gecros al ingresarlo." : undefined}
              className="sm:col-span-3"
            >
              <Input id="np-dni" inputMode="numeric" name="dni" value={formData.dni} onChange={onChange} maxLength={20} placeholder="Ej: 41379369" />
            </Campo>
            <Campo id="np-comentario" label="Comentario" className="sm:col-span-6">
              <Textarea
                id="np-comentario"
                name="comentario"
                value={formData.comentario}
                onChange={onChange}
                maxLength={500}
                placeholder="Algo que convenga recordar de este prospecto"
                rows={3}
              />
            </Campo>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
            <legend className="flex items-center gap-2 px-1 text-base font-bold text-corporate">
              <UsersIcon className="size-4 text-muted-foreground" />
              Familiares
            </legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <Campo id="nf-vinculo" label="Vínculo" className="sm:col-span-2">
                <NativeSelect id="nf-vinculo" name="vinculo" value={nuevoFamiliar.vinculo} onChange={onFamiliarChange}>
                  <option value="">Seleccioná…</option>
                  {vinculos.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <Campo id="nf-nombre" label="Nombre" className="sm:col-span-2">
                <Input id="nf-nombre" name="nombre" value={nuevoFamiliar.nombre} onChange={onFamiliarChange} maxLength={100} />
              </Campo>
              <Campo id="nf-edad" label="Edad" className="sm:col-span-2">
                <Input
                  id="nf-edad"
                  type="number"
                  inputMode="numeric"
                  name="edad"
                  value={menorDeUnAnioFamiliar ? 0 : nuevoFamiliar.edad}
                  onChange={onFamiliarChange}
                  min={0}
                  max={120}
                  disabled={menorDeUnAnioFamiliar}
                />
                <MenorDeUnAnio id="nf-menor" checked={menorDeUnAnioFamiliar} onChange={onMenorFamiliarChange} />
              </Campo>

              {nuevoFamiliar.vinculo === "pareja/conyuge" && (
                <>
                  <Campo id="nf-tipo" label="Tipo de afiliación" className="sm:col-span-6">
                    <NativeSelect id="nf-tipo" name="tipo_afiliacion_id" value={nuevoFamiliar.tipo_afiliacion_id} onChange={onFamiliarChange}>
                      <option value="">Seleccioná…</option>
                      {tiposAfiliacion.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.etiqueta}
                        </option>
                      ))}
                    </NativeSelect>
                  </Campo>
                  {tipoFamiliar?.requiere_sueldo === 1 && (
                    <Campo id="nf-sueldo" label="Sueldo bruto" className="sm:col-span-3">
                      <Input
                        id="nf-sueldo"
                        type="number"
                        inputMode="decimal"
                        name="sueldo_bruto"
                        value={nuevoFamiliar.sueldo_bruto}
                        onChange={onFamiliarChange}
                        min={0}
                      />
                    </Campo>
                  )}
                  {tipoFamiliar?.requiere_categoria === 1 && (
                    <Campo id="nf-categoria" label="Categoría monotributo" className="sm:col-span-3">
                      <NativeSelect id="nf-categoria" name="categoria_monotributo" value={nuevoFamiliar.categoria_monotributo} onChange={onFamiliarChange}>
                        <option value="">Seleccioná…</option>
                        {categoriasMonotributo.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </NativeSelect>
                    </Campo>
                  )}
                </>
              )}
            </div>

            <Button type="button" variant="outline" className="self-start" onClick={onAgregarFamiliar}>
              <PlusIcon />
              Agregar familiar
            </Button>

            {familiares.length > 0 && (
              <ul className="flex flex-col divide-y rounded-md border bg-card">
                {familiares.map((fam, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold capitalize">
                        {fam.vinculo}: <span className="normal-case">{fam.nombre}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          formatEdad(fam.edad),
                          fam.tipo_afiliacion_id && tiposAfiliacion.find((t) => t.id === Number(fam.tipo_afiliacion_id))?.etiqueta,
                          fam.sueldo_bruto && `Sueldo: $${parseFloat(fam.sueldo_bruto).toLocaleString("es-AR")}`,
                          fam.categoria_monotributo && `Categoría: ${fam.categoria_monotributo}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onEliminarFamiliar(idx)}
                      aria-label={`Quitar a ${fam.nombre}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </form>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" type="submit" form="nuevo-prospecto">
            Crear prospecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
