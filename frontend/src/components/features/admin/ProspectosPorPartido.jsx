import { MapPinIcon } from "lucide-react";
import { SimpleBarChart } from "@/components/app/charts";

// Reemplaza al mapa (Leaflet): ranking de partidos por cantidad de prospectos.
export default function ProspectosPorPartido({ data = [], limite = 15 }) {
  const filas = [...data]
    .filter((d) => d && d.partido)
    .map((d) => ({ partido: d.partido, cantidad: Number(d.cantidad) || 0 }))
    .sort((a, b) => b.cantidad - a.cantidad);
  const top = filas.slice(0, limite);
  const total = filas.reduce((acc, d) => acc + d.cantidad, 0);

  return (
    <section className=" rounded-xl border bg-card p-4 shadow-xs">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-corporate">
            <MapPinIcon className="size-4 text-primary" aria-hidden />
            Prospectos por partido
          </h3>
          <p className="text-sm text-muted-foreground">
            {filas.length} partidos · {total.toLocaleString("es-AR")} prospectos
            {filas.length > limite && ` · se muestran los ${limite} con más prospectos`}
          </p>
        </div>
      </header>
      <SimpleBarChart
        data={top}
        xKey="partido"
        horizontal
        showLabels
        yAxisWidth={150}
        height={Math.max(220, top.length * 32)}
        series={[{ key: "cantidad", label: "Prospectos" }]}
      />
    </section>
  );
}
