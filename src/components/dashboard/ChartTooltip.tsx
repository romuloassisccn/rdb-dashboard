import { TooltipProps } from "recharts";

const REPORT_TIME_ZONE = "UTC";

export const formatDateTime = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));

export function ChartTooltip({ active, payload, label, valueSuffix = "" }: TooltipProps<number, string> & { valueSuffix?: string }) {
  if (!active || !payload?.length) return null;
  const labelText = typeof label === "number" ? formatDateTime(label) : String(label);
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-2xl border-border min-w-[160px]">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{labelText}</div>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              <span className="text-foreground/80">{p.name}</span>
            </div>
            <span className="font-mono text-foreground">
              {typeof p.value === "number" ? p.value.toFixed(2) : p.value}{valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const formatTime = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t)).replace(",", "");

export const formatHour = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));

export const formatDay = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(t));
