/*
 * Reemplazo de SweetAlert2 con shadcn/ui (Dialog) + Sonner.
 *
 * Acepta la misma forma de llamada que `Swal.fire`, así cada archivo migra
 * cambiando solo la importación:
 *
 *   import Swal from "@/lib/alerts";
 *
 * - Los mensajes simples (título + texto + ícono, o con `timer` / `toast`)
 *   se muestran como avisos de Sonner.
 * - Todo lo que pide una decisión o un dato (cancelar, inputs, html,
 *   preConfirm, didOpen, cargando...) se muestra como diálogo.
 *
 * Requiere <AlertsHost /> montado una vez en la raíz (ver main.jsx).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  CircleCheckIcon,
  CircleHelpIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const DismissReason = Object.freeze({
  cancel: "cancel",
  backdrop: "backdrop",
  close: "close",
  esc: "esc",
  timer: "timer",
});

// ---------------------------------------------------------------------------
// Estado global (un diálogo a la vez, como SweetAlert)
// ---------------------------------------------------------------------------

let current = null; // { id, options, resolve, loading, validation, inputValue }
let popupEl = null;
let timerId = null;
let seq = 0;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => current;

const setCurrent = (patch) => {
  if (!current) return;
  current = { ...current, ...patch };
  emit();
};

const settle = (result) => {
  if (!current) return;
  const { resolve, options } = current;
  clearTimeout(timerId);
  current = null;
  popupEl = null;
  emit();
  try {
    options.willClose?.();
  } catch (e) {
    console.error(e);
  }
  resolve(result);
  try {
    options.didClose?.();
  } catch (e) {
    console.error(e);
  }
};

const dismissed = (reason) => ({
  isConfirmed: false,
  isDenied: false,
  isDismissed: true,
  dismiss: reason,
  value: undefined,
});

// ---------------------------------------------------------------------------
// Normalización de argumentos
// ---------------------------------------------------------------------------

const normalize = (a, b, c) => {
  if (a && typeof a === "object") return { ...a };
  const o = {};
  if (a !== undefined) o.title = a;
  if (b !== undefined) o.text = b;
  if (c !== undefined) o.icon = c;
  return o;
};

const needsDialog = (o) =>
  !o.toast &&
  !(o.timer && o.showConfirmButton === false) &&
  Boolean(
    o.html ||
      o.input ||
      o.showCancelButton ||
      o.showDenyButton ||
      o.preConfirm ||
      o.didOpen ||
      o.allowOutsideClick === false ||
      o.showConfirmButton === false ||
      o.footer
  );

const Html = ({ html }) =>
  typeof html === "string" ? (
    <div className="alerts-html" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div className="alerts-html">{html}</div>
  );

const showToast = (o) => {
  const title = o.title || o.titleText || "";
  const description = o.html ? <Html html={o.html} /> : o.text || undefined;
  const duration = o.timer || (o.icon === "error" || o.icon === "warning" ? 6000 : 3500);
  const opts = { description, duration };
  const fn =
    {
      success: toast.success,
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
      question: toast.info,
    }[o.icon] || toast;
  fn(title || o.text || "", title ? opts : { ...opts, description: undefined });
  return Promise.resolve(dismissed(o.timer ? DismissReason.timer : DismissReason.close));
};

// ---------------------------------------------------------------------------
// API pública (compatible con el subconjunto de SweetAlert2 que usa la app)
// ---------------------------------------------------------------------------

function fire(a, b, c) {
  const o = normalize(a, b, c);
  if (!needsDialog(o)) return showToast(o);

  // Un fire nuevo reemplaza al diálogo abierto (mismo comportamiento que Swal)
  if (current) settle(dismissed(DismissReason.close));

  return new Promise((resolve) => {
    current = {
      id: ++seq,
      options: o,
      resolve,
      loading: false,
      validation: null,
      inputValue: o.inputValue ?? (o.input === "checkbox" ? false : ""),
    };
    emit();
    if (o.timer) {
      timerId = setTimeout(() => settle(dismissed(DismissReason.timer)), o.timer);
    }
  });
}

const Swal = {
  fire,
  mixin: (base) => {
    const mixed = { ...Swal };
    mixed.fire = (a, b, c) => fire({ ...base, ...normalize(a, b, c) });
    return mixed;
  },
  close: (result) => settle(result ? { ...dismissed(DismissReason.close), ...result } : dismissed(DismissReason.close)),
  showLoading: () => setCurrent({ loading: true }),
  hideLoading: () => setCurrent({ loading: false }),
  isLoading: () => Boolean(current?.loading),
  isVisible: () => Boolean(current),
  getPopup: () => popupEl,
  getHtmlContainer: () => popupEl?.querySelector(".alerts-html") || null,
  getInput: () => popupEl?.querySelector("[data-alerts-input]") || null,
  getConfirmButton: () => popupEl?.querySelector("[data-alerts-confirm]") || null,
  showValidationMessage: (msg) => setCurrent({ validation: msg }),
  resetValidationMessage: () => setCurrent({ validation: null }),
  DismissReason,
};

export default Swal;
export { Swal };

// El código heredado marcaba las acciones peligrosas pintando el botón de rojo
const isDestructive = (color) => /^(#d33|#dc3545|#e53e3e|#c53030|#d9534f|#ef4444|#dc2626|red)$/i.test(String(color || "").trim());

// ---------------------------------------------------------------------------
// Host (renderiza el diálogo activo)
// ---------------------------------------------------------------------------

const ICONS = {
  success: { Icon: CircleCheckIcon, className: "text-success bg-success/10" },
  error: { Icon: OctagonXIcon, className: "text-destructive bg-destructive/10" },
  warning: { Icon: TriangleAlertIcon, className: "text-warning bg-warning/10" },
  info: { Icon: InfoIcon, className: "text-info bg-info/10" },
  question: { Icon: CircleHelpIcon, className: "text-primary bg-primary/10" },
};

const optionEntries = (inputOptions) => {
  if (!inputOptions) return [];
  if (inputOptions instanceof Map) return [...inputOptions.entries()];
  return Object.entries(inputOptions);
};

function AlertInput({ o, value, onChange, onEnter }) {
  const common = {
    "data-alerts-input": "",
    id: "alerts-input",
    placeholder: o.inputPlaceholder,
    ...o.inputAttributes,
  };
  switch (o.input) {
    case "textarea":
      return <Textarea {...common} value={value} onChange={(e) => onChange(e.target.value)} rows={4} autoFocus />;
    case "select":
      return (
        <select
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-md border-2 border-border bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
          autoFocus
        >
          {o.inputPlaceholder && <option value="">{o.inputPlaceholder}</option>}
          {optionEntries(o.inputOptions).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div role="radiogroup" className="flex flex-col gap-2">
          {optionEntries(o.inputOptions).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-3 rounded-md border px-4 has-checked:border-primary has-checked:bg-accent">
              <input type="radio" name="alerts-radio" value={k} checked={value === k} onChange={() => onChange(k)} className="size-4 accent-primary" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-3">
          <input type="checkbox" {...common} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />
          <span>{o.inputPlaceholder || o.inputLabel}</span>
        </label>
      );
    default:
      return (
        <Input
          {...common}
          type={o.input === "text" ? "text" : o.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter()}
          autoFocus
        />
      );
  }
}

export function AlertsHost() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const contentRef = useRef(null);
  const [openedId, setOpenedId] = useState(null);

  // didOpen: se llama una vez, con el HTML ya en el documento
  useEffect(() => {
    if (!state || state.id === openedId) return;
    const id = state.id;
    const raf = requestAnimationFrame(() => {
      if (current?.id !== id) return;
      popupEl = contentRef.current;
      setOpenedId(id);
      try {
        state.options.didOpen?.(popupEl);
      } catch (e) {
        console.error(e);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [state, openedId]);

  if (!state) return null;
  const { options: o, loading, validation, inputValue } = state;
  const icon = ICONS[o.icon];
  const showConfirm = o.showConfirmButton !== false;
  const onlyLoading = loading && !showConfirm && !o.showCancelButton;

  const confirm = async () => {
    if (!current || current.loading) return;
    let value = o.input ? current.inputValue : true;
    if (o.inputValidator) {
      const msg = await o.inputValidator(value);
      if (msg) return setCurrent({ validation: msg });
    }
    if (o.preConfirm) {
      setCurrent({ validation: null, loading: Boolean(o.showLoaderOnConfirm) });
      try {
        const ret = await o.preConfirm(value);
        if (!current) return;
        if (ret === false) return setCurrent({ loading: false });
        if (ret !== undefined) value = ret;
      } catch (e) {
        return setCurrent({ loading: false, validation: e?.message || String(e) });
      }
    }
    settle({ isConfirmed: true, isDenied: false, isDismissed: false, value });
  };

  const deny = () => settle({ isConfirmed: false, isDenied: true, isDismissed: false, value: false });

  const onOpenChange = (open) => {
    if (!open && !loading) settle(dismissed(DismissReason.close));
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        key={state.id}
        showCloseButton={o.showCloseButton ?? (!onlyLoading && o.allowOutsideClick !== false)}
        onInteractOutside={(e) => {
          if (o.allowOutsideClick === false || loading) e.preventDefault();
          else {
            e.preventDefault();
            settle(dismissed(DismissReason.backdrop));
          }
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (o.allowEscapeKey === false || loading) return;
          settle(dismissed(DismissReason.esc));
        }}
        onOpenAutoFocus={(e) => {
          if (!o.input) e.preventDefault();
        }}
        className={cn("max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-md", o.width && "sm:max-w-2xl")}
      >
        <DialogHeader className="items-center text-center sm:items-start sm:text-left">
          {(icon || onlyLoading) && (
            <div
              className={cn(
                "mb-1 flex size-12 items-center justify-center rounded-full",
                onlyLoading ? "bg-accent text-primary" : icon.className
              )}
            >
              {onlyLoading ? <Loader2Icon className="size-6 animate-spin" /> : <icon.Icon className="size-6" />}
            </div>
          )}
          <DialogTitle className="text-xl leading-tight font-bold text-corporate">
            {o.title || o.titleText || " "}
          </DialogTitle>
          {o.text ? (
            <DialogDescription className="text-base text-muted-foreground">{o.text}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{o.title || "Mensaje"}</DialogDescription>
          )}
        </DialogHeader>

        {o.html && <Html html={o.html} />}

        {o.input && (
          <div className="flex flex-col gap-2">
            {o.inputLabel && o.input !== "checkbox" && <Label htmlFor="alerts-input">{o.inputLabel}</Label>}
            <AlertInput
              o={o}
              value={inputValue}
              onChange={(v) => setCurrent({ inputValue: v, validation: null })}
              onEnter={confirm}
            />
          </div>
        )}

        {validation && (
          <p role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            <OctagonXIcon className="size-4 shrink-0" />
            {validation}
          </p>
        )}

        {o.footer && <Html html={o.footer} />}

        {!onlyLoading && (showConfirm || o.showCancelButton || o.showDenyButton) && (
          <DialogFooter className={cn("gap-2", o.reverseButtons && "sm:flex-row-reverse sm:justify-start")}>
            {o.showCancelButton && (
              <Button variant="outline" size="lg" disabled={loading} onClick={() => settle(dismissed(DismissReason.cancel))}>
                {o.cancelButtonText || "Cancelar"}
              </Button>
            )}
            {o.showDenyButton && (
              <Button variant="destructive" size="lg" disabled={loading} onClick={deny}>
                {o.denyButtonText || "No"}
              </Button>
            )}
            {showConfirm && (
              <Button
                data-alerts-confirm=""
                size="lg"
                variant={isDestructive(o.confirmButtonColor) ? "destructive" : "default"}
                disabled={loading}
                onClick={confirm}
              >
                {loading && <Loader2Icon className="animate-spin" />}
                {o.confirmButtonText || "Aceptar"}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
