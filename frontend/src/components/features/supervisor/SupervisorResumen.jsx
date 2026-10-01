import { useEffect, useState } from "react";
import axios from "axios";
import { CalendarDaysIcon, CalendarRangeIcon, ChartColumnIcon, CircleAlertIcon, Loader2Icon, TrendingUpIcon, UsersIcon } from "lucide-react";
import { API_URL } from "../../config";
import { cn } from "@/lib/utils";

// Componente reutilizable para animar el conteo
const CountUp = ({ end, duration = 1000, ...props }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span {...props}>{count}</span>;
};

const TONO = {
  primary: { icon: "bg-accent text-primary", bar: "bg-primary" },
  success: { icon: "bg-success-soft text-success", bar: "bg-success" },
  warning: { icon: "bg-warning-soft text-warning", bar: "bg-warning" },
  info: { icon: "bg-info/10 text-info", bar: "bg-info" },
};

const SupervisorResumen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resumen, setResumen] = useState({
    totalAsignados: 0,
    nuevosDia: 0,
    nuevosSemana: 0,
    nuevosMes: 0,
    totalVentas: 0,
    prospectosPorEstado: [],
  });

  useEffect(() => {
    const fetchResumen = async () => {
      try {
        const token = localStorage.getItem("cober_token");
        const { data } = await axios.get(`${API_URL}/supervisor/resumen`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setResumen(data);
        setError(false);
      } catch (err) {
        console.error("Error al cargar resumen:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchResumen();
  }, []);

  const conversion = Math.round((resumen.totalVentas / resumen.totalAsignados) * 100) || 0;

  const metricasData = [
    { id: "totalAsignados", value: resumen.totalAsignados, label: "Total asignados", description: "Prospectos en el sistema", icon: UsersIcon, type: "primary" },
    { id: "nuevosDia", value: resumen.nuevosDia, label: "Nuevos hoy", description: "Ingresados en el día", icon: CalendarDaysIcon, type: "success" },
    { id: "nuevosSemana", value: resumen.nuevosSemana, label: "Esta semana", description: "Prospectos semanales", icon: CalendarRangeIcon, type: "warning" },
    { id: "nuevosMes", value: resumen.nuevosMes, label: "Este mes", description: "Total del mes actual", icon: TrendingUpIcon, type: "info" },
    {
      id: "totalVentas",
      value: resumen.totalVentas,
      label: "Convertidos",
      description: `${conversion}% de conversión`,
      icon: ChartColumnIcon,
      type: "primary",
      progress: conversion,
    },
  ];

  if (loading) {
    return (
      <div role="status" className=" mb-6 flex min-h-40 items-center justify-center gap-2 rounded-xl border bg-card text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        Cargando resumen…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className=" mb-6 flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm">
        <CircleAlertIcon className="size-5 shrink-0 text-destructive" />
        No se pudo cargar el resumen. Revisá la conexión y recargá la página.
      </div>
    );
  }

  return (
    <section aria-label="Resumen del equipo" className=" mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
      {metricasData.map((metrica) => {
        const Icon = metrica.icon;
        const tono = TONO[metrica.type];
        return (
          <article key={metrica.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <span className={cn("flex size-10 items-center justify-center rounded-md", tono.icon)}>
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-3xl leading-none font-bold text-corporate tabular-nums">
                <CountUp end={metrica.value} duration={1200} />
              </p>
              <p className="mt-1 text-sm font-semibold">{metrica.label}</p>
              <p className="text-xs text-muted-foreground">{metrica.description}</p>
            </div>
            {metrica.progress !== undefined && (
              <div
                role="progressbar"
                aria-label="Tasa de conversión"
                aria-valuenow={metrica.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-auto h-2 overflow-hidden rounded-full bg-muted"
              >
                <div className={cn("h-full rounded-full transition-[width] duration-700", tono.bar)} style={{ width: `${Math.min(metrica.progress, 100)}%` }} />
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};

export default SupervisorResumen;
