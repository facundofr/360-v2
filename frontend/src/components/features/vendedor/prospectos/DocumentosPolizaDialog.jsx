import { DownloadIcon, EyeIcon, FileTextIcon, Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToneBadge } from "@/components/app/tone-badge";

const fechaSubida = (fecha) =>
  new Date(fecha).toLocaleDateString("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function DocumentosPolizaDialog({
  open,
  onOpenChange,
  poliza,
  documentos,
  loading,
  formatTipoDocumento,
  formatFileSize,
  onDescargar,
  onActualizar,
  onVer,
  onCargar,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-corporate">
            Documentos de la póliza N° {poliza?.numero_poliza}
          </DialogTitle>
          <DialogDescription>Descargá, revisá o reemplazá los archivos cargados.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div role="status" className="flex min-h-60 items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
            Cargando documentos…
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-muted-foreground">
            <FileTextIcon className="size-8" />
            <p>Esta póliza todavía no tiene documentos.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {documentos.map((documento) => (
              <li key={documento.id} className="flex flex-col rounded-xl border bg-card shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <p className="font-semibold text-corporate">
                    {documento.observaciones || formatTipoDocumento(documento.tipo_documento)}
                  </p>
                  {documento.integrante_index !== null && documento.integrante_index !== undefined && (
                    <ToneBadge tone="contact">Integrante {documento.integrante_index + 1}</ToneBadge>
                  )}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <dt className="text-muted-foreground">Archivo</dt>
                  <dd className="truncate">{documento.nombre_original}</dd>
                  <dt className="text-muted-foreground">Tamaño</dt>
                  <dd className="tabular-nums">{formatFileSize(documento.tamaño_bytes)}</dd>
                  <dt className="text-muted-foreground">Subido</dt>
                  <dd className="tabular-nums">{fechaSubida(documento.created_at)}</dd>
                </dl>
                <div className="mt-auto flex flex-wrap gap-2 border-t px-4 py-3">
                  <Button size="sm" onClick={() => onVer(documento.id, documento.tipo_mime)}>
                    <EyeIcon />
                    Ver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDescargar(documento.id, documento.nombre_original)}>
                    <DownloadIcon />
                    Descargar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onActualizar(documento)}>
                    <PencilIcon />
                    Reemplazar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button size="lg" onClick={onCargar}>
            <PlusIcon />
            Cargar documentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ActualizarDocumentoDialog({
  open,
  onCancel,
  documento,
  formatTipoDocumento,
  nuevoArchivo,
  onFileChange,
  motivo,
  onMotivoChange,
  loading,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onCancel()}>
      <DialogContent className="rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-corporate">Reemplazar documento</DialogTitle>
          {documento ? (
            <DialogDescription>
              Actual: <span className="font-semibold text-foreground">{documento.nombre_original}</span> ·{" "}
              {formatTipoDocumento(documento.tipo_documento)}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Reemplazar documento</DialogDescription>
          )}
        </DialogHeader>

        <form id="actualizar-documento" onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-archivo">Nuevo archivo</Label>
            <Input
              id="doc-archivo"
              type="file"
              onChange={onFileChange}
              accept=".pdf,.jpg,.jpeg,.png"
              required
              className="py-2 file:mr-3 file:rounded-sm file:bg-accent file:px-3 file:text-primary"
            />
            <p className="text-xs text-muted-foreground">PDF, JPG o PNG. Máximo 10 MB.</p>
            {nuevoArchivo && (
              <p className="text-sm text-success">
                Seleccionado: <span className="font-semibold">{nuevoArchivo.name}</span> ({(nuevoArchivo.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-motivo">Motivo del reemplazo</Label>
            <Textarea
              id="doc-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => onMotivoChange(e.target.value)}
              placeholder="Ej: documento ilegible, información incompleta…"
              required
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button size="lg" type="submit" form="actualizar-documento" disabled={loading}>
            {loading ? <Loader2Icon className="animate-spin" /> : <PencilIcon />}
            {loading ? "Reemplazando…" : "Reemplazar documento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
