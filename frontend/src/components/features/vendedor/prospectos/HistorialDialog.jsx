import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToneBadge } from "@/components/app/tone-badge";

export default function HistorialDialog({ open, onOpenChange, historial }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-corporate">Historial de acciones</DialogTitle>
          <DialogDescription>Registro de lo que se hizo con este prospecto.</DialogDescription>
        </DialogHeader>
        <div className="-mx-6 max-h-[60dvh] overflow-y-auto px-6">
          {historial.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No hay registros de historial para este prospecto.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {historial.map((accion, index) => (
                <li key={index} className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <ToneBadge tone={accion.accion === "APLICAR_PROMOCION" ? "success" : "contact"}>{accion.accion}</ToneBadge>
                    <time className="text-xs text-muted-foreground tabular-nums">
                      {new Date(accion.fecha).toLocaleString("es-AR")}
                    </time>
                  </div>
                  <p className="text-sm">{accion.descripcion}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Por {accion.first_name} {accion.last_name}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
