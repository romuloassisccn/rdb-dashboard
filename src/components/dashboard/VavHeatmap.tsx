import type { VavReading } from "@/lib/mock-data";
import { isNum } from "@/lib/safe";
import { EmptyState } from "./EmptyState";

function tempColor(t: number): { bg: string; label: string } {
  if (t < 23) return { bg: "var(--chart-1)", label: "Frio" };
  if (t <= 24.5) return { bg: "var(--success)", label: "Ideal" };
  if (t <= 25) return { bg: "var(--warning)", label: "Atenção" };
  return { bg: "var(--destructive)", label: "Quente" };
}

export function VavHeatmap({ vavs }: { vavs: VavReading[] | undefined | null }) {
  const hour = new Date().getHours();
  const inWindow = hour >= 11 && hour <= 22;
  const data = (Array.isArray(vavs) ? vavs : []).filter(
    (v) => v && typeof v.id === "string" && isNum(v.temp) && v.temp > 0,
  );

  const groups = ["Térreo", "2º Pavimento", "3º Pavimento"]
    .map((floor) => ({
      floor,
      items: data.filter((v) => v.floor === floor),
    }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) return <EmptyState label="Sensores VAV indisponíveis" height={180} />;

  return (
    <div className="space-y-5">
      {!inWindow && (
        <div className="text-[11px] text-muted-foreground italic">Fora do horário de monitoramento (11h–22h). Exibindo última leitura.</div>
      )}
      {groups.map((g) => {
        const validTemps = g.items.map((i) => i.temp).filter(isNum);
        const avg = validTemps.length ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : null;
        return (
          <div key={g.floor}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{g.floor}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                média {isNum(avg) ? avg.toFixed(1) : "—"}°C
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {g.items.map((v) => {
                const c = tempColor(v.temp);
                const pct = Math.max(8, Math.min(100, ((v.temp - 20) / 8) * 100));
                return (
                  <div key={v.id} className="rounded-xl bg-secondary/40 border border-border p-2.5 hover:bg-secondary/60 transition-colors">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <div>
                        <div className="font-mono text-foreground/80">{v.id}</div>
                        {isNum(v.min) && isNum(v.max) && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            mín {v.min.toFixed(1)}° · máx {v.max.toFixed(1)}°
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-mono" style={{ color: c.bg }}>{v.temp.toFixed(1)}°C</span>
                        <div className="text-[10px] text-muted-foreground">média</div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-background/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, color-mix(in oklab, ${c.bg} 50%, transparent), ${c.bg})`,
                          boxShadow: `0 0 12px color-mix(in oklab, ${c.bg} 40%, transparent)`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Legend />
    </div>
  );
}

function Legend() {
  const items = [
    { c: "var(--chart-1)", l: "< 23°C" },
    { c: "var(--success)", l: "23 – 24,5°C" },
    { c: "var(--warning)", l: "24,5 – 25°C" },
    { c: "var(--destructive)", l: "> 25°C" },
  ];
  return (
    <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
      {items.map((i) => (
        <div key={i.l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ background: i.c, boxShadow: `0 0 8px ${i.c}` }} />
          {i.l}
        </div>
      ))}
    </div>
  );
}
