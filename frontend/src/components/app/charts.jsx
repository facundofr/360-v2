/*
 * Gráficos de la app sobre shadcn/ui Charts (Recharts) con la paleta de DESIGN.md.
 * API chica y uniforme para reemplazar Chart.js, MUI X Charts y usos sueltos de Recharts.
 *
 *   <SimpleBarChart data={rows} xKey="mes" series={[{ key: "ventas", label: "Ventas" }]} />
 *   <SimpleLineChart data={rows} xKey="fecha" series={[...]} area />
 *   <SimplePieChart data={[{ name: "A", value: 3 }]} />
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis, LabelList } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#c05621",
  "#2f855a",
  "#a36eb2",
  "#5a6a7a",
  "#0d9488",
];

const colorAt = (i, explicit) => explicit || CHART_COLORS[i % CHART_COLORS.length];

const makeConfig = (series) =>
  Object.fromEntries(series.map((s, i) => [s.key, { label: s.label ?? s.key, color: colorAt(i, s.color) }]));

const numberFmt = (v) => (typeof v === "number" ? v.toLocaleString("es-AR") : v);

function EmptyChart({ height, message = "Sin datos para mostrar" }) {
  return (
    <div style={{ height }} className="flex w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function SimpleBarChart({
  data = [],
  xKey,
  series,
  height = 288,
  horizontal = false,
  stacked = false,
  showLegend,
  showLabels = false,
  valueFormatter = numberFmt,
  yAxisWidth,
  className,
}) {
  if (!data.length) return <EmptyChart height={height} />;
  const config = makeConfig(series);
  const legend = showLegend ?? series.length > 1;
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: 4, bottom: 4 }} accessibilityLayer>
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={valueFormatter} />
            <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} width={yAxisWidth ?? 110} tick={{ fontSize: 12 }} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={yAxisWidth ?? 44} tickFormatter={valueFormatter} allowDecimals={false} />
          </>
        )}
        <ChartTooltip cursor content={<ChartTooltipContent />} />
        {legend && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label ?? s.key}
            fill={colorAt(i, s.color)}
            radius={stacked ? 0 : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            stackId={stacked ? "a" : undefined}
            maxBarSize={48}
          >
            {showLabels && <LabelList dataKey={s.key} position={horizontal ? "right" : "top"} className="fill-foreground" fontSize={11} formatter={valueFormatter} />}
            {s.cellColors && data.map((_, i) => <Cell key={i} fill={s.cellColors[i % s.cellColors.length]} />)}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function SimpleLineChart({ data = [], xKey, series, height = 288, area = false, showLegend, valueFormatter = numberFmt, yAxisWidth, className }) {
  if (!data.length) return <EmptyChart height={height} />;
  const config = makeConfig(series);
  const legend = showLegend ?? series.length > 1;
  const Chart = area ? AreaChart : LineChart;
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <Chart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" tick={{ fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} width={yAxisWidth ?? 44} tickFormatter={valueFormatter} allowDecimals={false} />
        <ChartTooltip cursor content={<ChartTooltipContent />} />
        {legend && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) =>
          area ? (
            <Area key={s.key} dataKey={s.key} name={s.label ?? s.key} type="monotone" stroke={colorAt(i, s.color)} fill={colorAt(i, s.color)} fillOpacity={0.15} strokeWidth={2} />
          ) : (
            <Line key={s.key} dataKey={s.key} name={s.label ?? s.key} type="monotone" stroke={colorAt(i, s.color)} strokeWidth={2} dot={data.length <= 31} />
          )
        )}
      </Chart>
    </ChartContainer>
  );
}

export function SimplePieChart({ data = [], nameKey = "name", valueKey = "value", height = 288, donut = true, showLegend = true, colors, className }) {
  const rows = data.filter((d) => Number(d[valueKey]) > 0);
  if (!rows.length) return <EmptyChart height={height} />;
  const config = Object.fromEntries(rows.map((d, i) => [String(d[nameKey]), { label: String(d[nameKey]), color: colorAt(i, colors?.[i] || d.color) }]));
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} hideLabel />} />
        <Pie data={rows} dataKey={valueKey} nameKey={nameKey} innerRadius={donut ? "55%" : 0} outerRadius="85%" paddingAngle={rows.length > 1 ? 2 : 0} strokeWidth={2}>
          {rows.map((d, i) => (
            <Cell key={i} fill={colorAt(i, colors?.[i] || d.color)} />
          ))}
        </Pie>
        {showLegend && <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} className="flex-wrap gap-2" />}
      </PieChart>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Adaptadores para datos con la forma de Chart.js: { labels, datasets: [{ label, data }] }
// ---------------------------------------------------------------------------

function fromChartJs(data) {
  const labels = data?.labels || [];
  const ds = data?.datasets || [];
  const rows = labels.map((label, i) => {
    const row = { x: label };
    ds.forEach((d, j) => {
      row[`s${j}`] = Number(d.data?.[i] ?? 0);
    });
    return row;
  });
  const series = ds.map((d, j) => ({ key: `s${j}`, label: d.label || `Serie ${j + 1}` }));
  return { rows, series };
}

export function ChartJsBar({ data, height = 280, horizontal = false, stacked = false, showLabels = false, valueFormatter, className }) {
  const { rows, series } = fromChartJs(data);
  return (
    <SimpleBarChart
      data={rows}
      xKey="x"
      series={series}
      height={height}
      horizontal={horizontal}
      stacked={stacked}
      showLabels={showLabels}
      valueFormatter={valueFormatter}
      className={className}
    />
  );
}

export function ChartJsLine({ data, height = 280, area = false, valueFormatter, className }) {
  const { rows, series } = fromChartJs(data);
  return <SimpleLineChart data={rows} xKey="x" series={series} height={height} area={area} valueFormatter={valueFormatter} className={className} />;
}

export function ChartJsPie({ data, height = 280, donut = true, className }) {
  const labels = data?.labels || [];
  const values = data?.datasets?.[0]?.data || [];
  const rows = labels.map((name, i) => ({ name: String(name), value: Number(values[i] ?? 0) }));
  return <SimplePieChart data={rows} height={height} donut={donut} className={className} />;
}
