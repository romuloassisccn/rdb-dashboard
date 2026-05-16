import { TrendingDown, TrendingUp, Minus, LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  unit?: string;
  trend?: number; // % change
  icon: LucideIcon;
  accent?: "primary" | "success" | "violet" | "warning";
  hint?: string;
  bar?: { value: number; max: number; segments?: { color: string; threshold: number }[] };
}

export function KpiCard({ label, value, unit, trend, icon: Icon, accent = "primary", hint, bar }: Props) {
  const color = {
    primary: "var(--cyan)",
    success: "var(--success)",
    violet: "var(--violet)",
    warning: "var(--warning)",
  }[accent];

  const trendIcon = trend === undefined ? null : trend > 0.5 ? <TrendingUp className="size-3.5" /> : trend < -0.5 ? <TrendingDown className="size-3.5" /> : <Minus className="size-3.5" />;
  const trendColor = trend === undefined ? "" : trend > 0.5 ? "text-warning" : trend < -0.5 ? "text-success" : "text-muted-foreground";

  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden fade-in-up group hover:-translate-y-0.5 transition-transform">
      <div
        aria-hidden
        className="absolute -right-12 -top-12 size-40 rounded-full opacity-20 blur-2xl pointer-events-none group-hover:opacity-30 transition-opacity"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold font-mono tracking-tight" style={{ color }}>{value}</span>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div
          className="size-10 rounded-xl grid place-items-center"
          style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 35%, transparent)` }}
        >
          <Icon className="size-5" style={{ color }} />
        </div>
      </div>

      {bar && (
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (bar.value / bar.max) * 100)}%`, background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 50%, transparent))` }}
            />
          </div>
        </div>
      )}

      {trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs ${trendColor}`}>
          {trendIcon}
          <span className="font-mono">{trend >= 0 ? "+" : ""}{trend.toFixed(1)}%</span>
          <span className="text-muted-foreground">vs período anterior</span>
        </div>
      )}
    </div>
  );
}
