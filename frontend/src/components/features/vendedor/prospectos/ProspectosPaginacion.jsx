import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProspectosPaginacion({ pagina, totalPaginas, total, porPagina, onChange }) {
  if (total === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const numeros = Array.from({ length: totalPaginas }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1
  );

  return (
    <nav
      aria-label="Paginación de prospectos"
      className="flex flex-col items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs sm:flex-row"
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {desde}–{hasta} de {total} prospectos
      </p>
      {totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button variant="ghost" size="icon" disabled={pagina === 1} onClick={() => onChange(1)} aria-label="Primera página">
            <ChevronsLeftIcon />
          </Button>
          <Button variant="ghost" size="icon" disabled={pagina === 1} onClick={() => onChange(pagina - 1)} aria-label="Página anterior">
            <ChevronLeftIcon />
          </Button>
          {numeros.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - numeros[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
              <Button
                variant={n === pagina ? "default" : "ghost"}
                size="icon"
                aria-current={n === pagina ? "page" : undefined}
                aria-label={`Página ${n}`}
                onClick={() => onChange(n)}
                className="tabular-nums"
              >
                {n}
              </Button>
            </span>
          ))}
          <Button variant="ghost" size="icon" disabled={pagina === totalPaginas} onClick={() => onChange(pagina + 1)} aria-label="Página siguiente">
            <ChevronRightIcon />
          </Button>
          <Button variant="ghost" size="icon" disabled={pagina === totalPaginas} onClick={() => onChange(totalPaginas)} aria-label="Última página">
            <ChevronsRightIcon />
          </Button>
        </div>
      )}
    </nav>
  );
}
