import { useEffect, useState, useCallback } from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PwaUpdateToast() {
  const [open, setOpen] = useState(false);
  const [registration, setRegistration] = useState(null);

  const handleClose = () => setOpen(false);

  const applyUpdate = useCallback(async () => {
    try {
      const reg = registration;
      if (!reg) return;
      const waitingWorker = reg.waiting;
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      } else {
        await reg.update();
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [registration]);

  useEffect(() => {
    const onUpdateAvailable = (e) => {
      setRegistration(e.detail?.registration || null);
      setOpen(true);
    };
    window.addEventListener("pwa-update-available", onUpdateAvailable);
    return () => window.removeEventListener("pwa-update-available", onUpdateAvailable);
  }, []);

  if (!open) return null;

  return (
    <div
      role="status"
      className=" fixed inset-x-3 bottom-3 z-[1080] mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-xl bg-corporate p-3 pl-4 text-corporate-foreground shadow-lg animate-in fade-in slide-in-from-bottom-4"
    >
      <RefreshCwIcon className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-semibold">Hay una nueva versión disponible</p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={handleClose}>
          Más tarde
        </Button>
        <Button size="sm" onClick={applyUpdate}>
          Actualizar
        </Button>
      </div>
      <button type="button" onClick={handleClose} aria-label="Cerrar" className="sr-only">
        <XIcon />
      </button>
    </div>
  );
}
