import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Barra superior de cada pantalla: botón de menú (celular), título y acciones
export function PageHeader({ title, onOpenMenu, actions, className }) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "sticky top-[60px] z-20 md:top-20 flex min-h-16 items-center gap-3 border-b bg-card px-4 py-3 shadow-xs md:px-6",
        className
      )}
    >
      {onOpenMenu && (
        <Button
          variant="outline"
          size="icon-lg"
          className="md:hidden"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
        >
          <MenuIcon />
        </Button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-corporate md:text-2xl">
        {title}
      </h1>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
