import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2Icon } from "lucide-react";
import { API_URL } from "../../config";
import { SimpleBarChart, SimplePieChart } from "@/components/app/charts";

function Panel({ title, className, children }) {
  return (
    <section className={`rounded-xl border bg-card p-4 shadow-xs ${className || ""}`}>
      <h3 className="mb-3 text-base font-bold text-corporate">{title}</h3>
      {children}
    </section>
  );
}

const MetricasVendedor = () => {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    prospectosPorVendedor: [],
    conversionPorVendedor: [],
    estadosPorVendedor: [],
    tiempoPromedioConversion: [],
  });

  useEffect(() => {
    const fetchMetricas = async () => {
      try {
        const token = localStorage.getItem("cober_token");
        const { data } = await axios.get(`${API_URL}/supervisor/metricas-vendedor`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMetricas(data);
      } catch {
        setMetricas({
          prospectosPorVendedor: [],
          conversionPorVendedor: [],
          estadosPorVendedor: [],
          tiempoPromedioConversion: [],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchMetricas();
  }, []);

  if (loading) {
    return (
      <div role="status" className=" my-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        Cargando métricas…
      </div>
    );
  }

  // Datos para las gráficas
  const barData = metricas.conversionPorVendedor.map((row) => {
    const tiempo = metricas.tiempoPromedioConversion.find((t) => t.vendedor_id === row.vendedor_id);
    return {
      vendedor: row.vendedor,
      prospectos: row.total_prospectos,
      ventas: row.ventas,
      tiempo: tiempo ? tiempo.horas_promedio_conversion : 0,
    };
  });

  const pieData = metricas.conversionPorVendedor.map((row) => ({
    name: row.vendedor,
    value: row.tasa_conversion,
  }));

  // Barras apiladas: prospectos por estado y vendedor
  const estados = [...new Set(metricas.estadosPorVendedor.map((e) => e.estado))];
  const vendedores = [...new Set(metricas.estadosPorVendedor.map((e) => e.vendedor))];
  const stackedData = vendedores.map((vendedor) => {
    const obj = { vendedor };
    estados.forEach((estado, i) => {
      const found = metricas.estadosPorVendedor.find((e) => e.vendedor === vendedor && e.estado === estado);
      obj[`e${i}`] = found ? found.cantidad : 0;
    });
    return obj;
  });

  return (
    <div className=" my-6 flex flex-col gap-4">
      <h2 className="text-xl font-bold text-corporate">Métricas por vendedor</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel title="Prospectos y ventas por vendedor" className="lg:col-span-7">
          <SimpleBarChart
            data={barData}
            xKey="vendedor"
            height={320}
            showLabels
            series={[
              { key: "prospectos", label: "Prospectos" },
              { key: "ventas", label: "Ventas", color: "var(--chart-2)" },
            ]}
          />
        </Panel>
        <Panel title="Tasa de conversión (%)" className="lg:col-span-5">
          <SimplePieChart data={pieData} height={320} />
        </Panel>
        <Panel title="Tiempo promedio de conversión (hs)" className="lg:col-span-6">
          <SimpleBarChart data={barData} xKey="vendedor" height={260} showLabels series={[{ key: "tiempo", label: "Tiempo promedio (hs)", color: "var(--chart-3)" }]} />
        </Panel>
        <Panel title="Prospectos por estado y vendedor" className="lg:col-span-6">
          <SimpleBarChart data={stackedData} xKey="vendedor" height={260} stacked series={estados.map((estado, i) => ({ key: `e${i}`, label: estado }))} />
        </Panel>
      </div>
    </div>
  );
};

export default MetricasVendedor;
