import type { Co2Reading } from "@/lib/mock-data";
import { isNum } from "@/lib/safe";
import { EmptyState } from "./EmptyState";

function band(p: number) {
  if (p <= 600) return { c: "var(--success)", l: "Excelente" };
  if (p <= 800) return { c: "var(--cyan)", l: "Bom" };
  if (p <= 1000) return { c: "var(--warning)", l: "Moderado" };
  return { c: "var(--destructive)", l: "Ruim" };
}

export function Co2Panel({ data }: { data: Co2Reading[] | undefined | null }) {
  const sensors = (Array.isArray(data) ? data : []).filter(
    (s) => s && typeof s.id === "string" && isNum(s.ppm) && s.ppm > 0,
  );

  if (sensors.length === 0) return <EmptyState label="Sensores de CO₂ indisponíveis" height={140} />;

  const max = 1400;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {sensors.map((s) => {
        const b = band(s.ppm);
        const pct = Math.min(100, (s.ppm / max) * 100);
        return (
          <div key={s.id} className="rounded-xl bg-secondary/40 border border-border p-3 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-start justify-between text-[11px] text-muted-foreground">
              <div>
                <div className="font-mono">{s.id}</div>
                {isNum(s.min) && isNum(s.max) && (
                  <div className="text-[10px] font-mono mt-0.5">mín {Math.round(s.min)} · máx {Math.round(s.max)}</div>
                )}
              </div>
              <span style={{ color: b.c }}>{b.l}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-mono font-semibold" style={{ color: b.c }}>{Math.round(s.ppm)}</span>
              <span className="text-[10px] text-muted-foreground">ppm média</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-background/60 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--success), var(--warning), var(--destructive))` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
