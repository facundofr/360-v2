import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, FileTextIcon, LayoutDashboardIcon, MessageCircleIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { vista: "prospectos", label: "Prospectos", Icon: LayoutDashboardIcon },
  { vista: "polizas", label: "Mis pólizas", Icon: FileTextIcon },
  { vista: "whatsapp", label: "WhatsApp", Icon: MessageCircleIcon },
];

const VendedorSidebar = ({ vista, setVista, onNuevoProspecto, onCloseDrawer }) => {
  const navigate = useNavigate();

  const handleSetVista = (nuevaVista) => {
    if (setVista) {
      setVista(nuevaVista);
    } else {
      navigate("/prospectos", { state: { vista: nuevaVista } });
    }
    onCloseDrawer?.();
  };

  const handleNuevoProspecto = () => {
    if (onNuevoProspecto) onNuevoProspecto();
    else navigate("/prospectos/nuevo");
    onCloseDrawer?.();
  };

  return (
    <nav aria-label="Panel del vendedor" className=" flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-5 py-4">
        <p className="text-lg font-bold text-corporate">
          Panel <span className="font-normal text-muted-foreground">Vendedor</span>
        </p>
        {onCloseDrawer && (
          <Button variant="ghost" size="icon-lg" className="md:hidden" onClick={onCloseDrawer} aria-label="Cerrar menú">
            <ChevronLeftIcon />
          </Button>
        )}
      </div>

      <div className="px-3 pt-3">
        <Button size="lg" className="h-12 w-full" onClick={handleNuevoProspecto}>
          <UserPlusIcon />
          Nuevo prospecto
        </Button>
      </div>

      <ul className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ vista: key, label, Icon }) => {
          const active = vista === key;
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => handleSetVista(key)}
                className={cn(
                  "relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-md px-4 text-left font-medium text-sidebar-foreground transition-colors outline-none",
                  "hover:bg-primary/5 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30",
                  "before:absolute before:inset-y-0 before:left-0 before:w-1 before:scale-y-0 before:bg-primary before:transition-transform",
                  active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:scale-y-100"
                )}
              >
                <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>

    </nav>
  );
};

export default VendedorSidebar;
