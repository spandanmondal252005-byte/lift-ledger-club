import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

type Point = { label: string; value: number };

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload || payload.length === 0) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-border-strong bg-popover px-3 py-2 shadow-card">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="stat-num text-sm font-semibold">{format(v)}</p>
    </div>
  );
}

export function BarTrend({
  data,
  format,
  height = 220,
  highlightLast = true,
}: {
  data: Point[];
  format: (v: number) => string;
  height?: number;
  highlightLast?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...axisProps} width={48} tickFormatter={(v: number) => compact(v)} />
        <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<ChartTooltip format={format} />} />
        <Bar
          dataKey="value"
          radius={[5, 5, 0, 0]}
          maxBarSize={36}
          shape={(props: unknown) => {
            const p = props as { x: number; y: number; width: number; height: number; index: number };
            const isLast = highlightLast && p.index === data.length - 1;
            return (
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={Math.max(0, p.height)}
                rx={5}
                fill={isLast ? "var(--primary)" : "var(--chart-2)"}
                fillOpacity={isLast ? 1 : 0.55}
              />
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({
  data,
  format,
  height = 220,
  color = "var(--primary)",
  id = "trend",
}: {
  data: Point[];
  format: (v: number) => string;
  height?: number;
  color?: string;
  id?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => compact(v)} />
        <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={<ChartTooltip format={format} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.25}
          fill={`url(#fill-${id})`}
          dot={data.length < 20 ? { r: 3, fill: color, strokeWidth: 0 } : false}
          activeDot={{ r: 5, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function compact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v * 10) / 10);
}
