import { MapPinned, RadioTower, Thermometer, Wind } from "lucide-react";
import { PanelCard } from "./PanelCard";
import type { DashboardAnalytics } from "@/hooks/use-cag-data";
import type { VavReading } from "@/lib/mock-data";

type Severity = "normal" | "baixo" | "moderado" | "alto" | "critico" | "sem_dados";

type ZoneConfig = {
  id: string;
  title: string;
  sensors: string[];
  maskSrc: string;
  label: { x: number; y: number };
};

type ZoneStatus = ZoneConfig & {
  avgTemp: number | null;
  maxTemp: number | null;
  criticalPct: number;
  criticalReadings: number;
  severity: Severity;
  worstSensor: string;
};

const FLOOR_IMG = "/floor-terreo-clean-v8.png";
const VIEWBOX = "0 0 1668 795";
const SOURCE_W = 1164;
const SOURCE_H = 561;
const TARGET_W = 1668;
const TARGET_H = 795;
const sx = TARGET_W / SOURCE_W;
const sy = TARGET_H / SOURCE_H;

function sp(x: number, y: number) {
  return { x: Math.round(x * sx), y: Math.round(y * sy) };
}

// Máscaras geradas a partir do termográfico real do térreo.
// Elas seguem os traços/limites internos do próprio supervisório, em vez de polígonos aproximados.
// Isso evita pintar áreas internas de lojas e mantém o overlay alinhado aos corredores atendidos.
const zoneConfigs: ZoneConfig[] = [
  { id: "A1", title: "A1 · VAV 36", sensors: ["vav_36"], maskSrc: "/zone-masks-v11/A1.png", label: sp(220, 205) },
  { id: "B1", title: "B1 · VAV 34 / VAV 35", sensors: ["vav_34", "vav_35"], maskSrc: "/zone-masks-v11/B1.png", label: sp(525, 204) },
  { id: "C1", title: "C1 · VAV 32", sensors: ["vav_32"], maskSrc: "/zone-masks-v11/C1.png", label: sp(785, 145) },
  { id: "D1", title: "D1 · VAV 30 / VAV 33", sensors: ["vav_30", "vav_33"], maskSrc: "/zone-masks-v11/D1.png", label: sp(1015, 265) },
  { id: "F1", title: "F1 · VAV 37 / VAV 38 / VAV 39", sensors: ["vav_37", "vav_38", "vav_39"], maskSrc: "/zone-masks-v11/F1.png", label: sp(350, 374) },
  { id: "G1", title: "G1 · VAV 31 / VAV 40", sensors: ["vav_31", "vav_40"], maskSrc: "/zone-masks-v11/G1.png", label: sp(695, 355) },
];

const severityRank: Record<Severity, number> = {
  sem_dados: 0,
  normal: 1,
  baixo: 2,
  moderado: 3,
  alto: 4,
  critico: 5,
};

const severityStyle: Record<Severity, { label: string; color: string; rgba: string; border: string; glow: string }> = {
  normal: { label: "Normal", color: "var(--success)", rgba: "rgba(34,197,94,.48)", border: "rgba(34,197,94,.85)", glow: "0 0 28px rgba(34,197,94,.38)" },
  baixo: { label: "Baixo", color: "var(--success)", rgba: "rgba(34,197,94,.28)", border: "rgba(34,197,94,.55)", glow: "0 0 22px rgba(34,197,94,.22)" },
  moderado: { label: "Atenção", color: "var(--warning)", rgba: "rgba(245,158,11,.54)", border: "rgba(245,158,11,.85)", glow: "0 0 30px rgba(245,158,11,.42)" },
  alto: { label: "Alto", color: "#fb923c", rgba: "rgba(249,115,22,.58)", border: "rgba(249,115,22,.94)", glow: "0 0 34px rgba(249,115,22,.48)" },
  critico: { label: "Crítico", color: "var(--destructive)", rgba: "rgba(239,68,68,.66)", border: "rgba(239,68,68,.98)", glow: "0 0 42px rgba(239,68,68,.6)" },
  sem_dados: { label: "Sem dados", color: "var(--muted-foreground)", rgba: "rgba(148,163,184,.18)", border: "rgba(148,163,184,.42)", glow: "0 0 18px rgba(148,163,184,.14)" },
};

function sensorKey(value: unknown) {
  return String(value ?? "").trim().replace("-", "_").toLowerCase();
}

function n(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function severityFromPercent(percent: number | null): Severity {
  if (percent === null) return "sem_dados";
  if (percent >= 80) return "critico";
  if (percent >= 50) return "alto";
  if (percent >= 25) return "moderado";
  if (percent > 0) return "baixo";
  return "normal";
}

function severityFromRaw(value: unknown): Severity {
  const raw = text(value, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["critico", "critical"].includes(raw)) return "critico";
  if (["alto", "high"].includes(raw)) return "alto";
  if (["moderado", "medio", "atencao", "attention", "warn", "warning"].includes(raw)) return "moderado";
  if (["baixo", "low"].includes(raw)) return "baixo";
  if (["normal", "bom", "boa", "ok"].includes(raw)) return "normal";
  return "sem_dados";
}

function buildZoneStatuses(analytics: DashboardAnalytics | null, vavs: VavReading[]): ZoneStatus[] {
  const critical = Array.isArray(analytics?.conforto?.vavsCriticos) ? analytics.conforto.vavsCriticos : [];
  const criticalMap = new Map<string, Record<string, unknown>>();
  critical.forEach((item) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      criticalMap.set(sensorKey(record.sensor), record);
    }
  });

  const vavMap = new Map<string, VavReading>();
  vavs.forEach((item) => vavMap.set(sensorKey(item.id), item));

  return zoneConfigs.map((zone) => {
    const sensorRows = zone.sensors.map((sensor) => ({ sensor, critical: criticalMap.get(sensorKey(sensor)), reading: vavMap.get(sensorKey(sensor)) }));

    const pctValues = sensorRows.map(({ critical }) => n(critical?.percentualCritico)).filter((value): value is number => value !== null);
    const tempValues = sensorRows
      .map(({ critical, reading }) => n(critical?.media) ?? n(reading?.temp))
      .filter((value): value is number => value !== null && value > 0);
    const maxValues = sensorRows
      .map(({ critical, reading }) => n(critical?.max) ?? n(critical?.maxRegistrado) ?? n(reading?.max) ?? n(reading?.temp))
      .filter((value): value is number => value !== null && value > 0);
    const readings = sensorRows.map(({ critical }) => n(critical?.leiturasCriticas)).filter((value): value is number => value !== null);

    // Considera que a zona tem dado somente quando existe algum valor numérico útil
    // no período filtrado. A existência de um objeto VAV sem temperatura não deve
    // transformar a zona em Normal; nesse caso ela precisa aparecer como Sem dados.
    const hasUsefulData =
      pctValues.length > 0 ||
      tempValues.length > 0 ||
      maxValues.length > 0 ||
      readings.length > 0;

    const worst = sensorRows.reduce<{ sensor: string; pct: number; severity: Severity }>((acc, row) => {
      const pct = n(row.critical?.percentualCritico);
      const rawSeverity = row.critical ? severityFromRaw(row.critical.severidade) : "sem_dados";
      const sev = pct !== null ? severityFromPercent(pct) : rawSeverity;
      const pctScore = pct ?? 0;
      if (severityRank[sev] > severityRank[acc.severity] || pctScore > acc.pct) return { sensor: row.sensor, pct: pctScore, severity: sev };
      return acc;
    }, { sensor: zone.sensors[0], pct: 0, severity: pctValues.length ? severityFromPercent(Math.max(...pctValues)) : hasUsefulData ? "normal" : "sem_dados" });

    const maxPct = pctValues.length ? Math.max(...pctValues) : hasUsefulData ? 0 : null;
    const pctSeverity = severityFromPercent(maxPct);
    const severity = hasUsefulData
      ? (severityRank[worst.severity] >= severityRank[pctSeverity] ? worst.severity : pctSeverity)
      : "sem_dados";

    return {
      ...zone,
      avgTemp: tempValues.length ? tempValues.reduce((sum, value) => sum + value, 0) / tempValues.length : null,
      maxTemp: maxValues.length ? Math.max(...maxValues) : null,
      criticalPct: Math.round((maxPct ?? 0) * 10) / 10,
      criticalReadings: readings.reduce((sum, value) => sum + value, 0),
      severity,
      worstSensor: worst.sensor,
    };
  });
}

function StatusPill({ severity }: { severity: Severity }) {
  const style = severityStyle[severity];
  return (
    <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: style.color, borderColor: style.border, background: `color-mix(in oklab, ${style.color} 14%, transparent)` }}>
      {style.label}
    </span>
  );
}

export function OperationalFloorMap({ analytics, vavs }: { analytics: DashboardAnalytics | null; vavs: VavReading[] }) {
  const zones = buildZoneStatuses(analytics, Array.isArray(vavs) ? vavs : []);
  const criticalZones = zones.filter((zone) => ["alto", "critico"].includes(zone.severity)).length;
  const topZone = [...zones].sort((a, b) => b.criticalPct - a.criticalPct)[0];

  return (
    <PanelCard title="Mapa operacional · Térreo" subtitle="Máscaras do termográfico real ajustadas, coloridas dinamicamente por conforto térmico" glow="primary" right={<MapPinned className="size-4 text-cyan" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Zonas críticas</div>
            <div className="mt-2 font-mono text-3xl font-semibold text-destructive">{criticalZones}</div>
            <div className="text-[11px] text-muted-foreground">alta/crítica no período filtrado</div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pior zona</div>
            <div className="mt-2 font-mono text-3xl font-semibold text-warning">{topZone?.id ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{topZone?.criticalPct.toFixed(1) ?? "—"}% crítico</div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Base do mapa</div>
            <div className="mt-2 flex items-center gap-2 font-mono text-lg text-cyan"><RadioTower className="size-4" /> A1–G1</div>
            <div className="text-[11px] text-muted-foreground">máscaras ajustadas do termográfico</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-background/50 p-3 shadow-[0_0_50px_rgba(34,211,238,.08)]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,.12),transparent_62%)]" />
          <div className="relative aspect-[1668/795] overflow-hidden rounded-2xl border border-cyan/15 bg-black/35">
            <img src={FLOOR_IMG} alt="Planta limpa do térreo Rio Design Barra" className="absolute inset-0 h-full w-full object-contain opacity-78 mix-blend-screen" />

            {zones.map((zone) => {
              const style = severityStyle[zone.severity];
              return (
                <div
                  key={`mask-${zone.id}`}
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: style.rgba,
                    WebkitMaskImage: `url(${zone.maskSrc})`,
                    maskImage: `url(${zone.maskSrc})`,
                    WebkitMaskSize: "100% 100%",
                    maskSize: "100% 100%",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskMode: "alpha",
                    maskMode: "alpha",
                    filter: `drop-shadow(${style.glow})`,
                  }}
                />
              );
            })}

            <svg viewBox={VIEWBOX} className="absolute inset-0 h-full w-full" role="img" aria-label="Mapa térmico operacional do térreo">
              <defs>
                <filter id="labelGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>

              {[303, 724, 1094, 1263].map((x) => <line key={x} x1={x} x2={x} y1="0" y2="795" stroke="rgba(125,211,252,.45)" strokeWidth="2" strokeDasharray="12 12" />)}
              <line x1="0" x2="1668" y1="401" y2="401" stroke="rgba(125,211,252,.34)" strokeWidth="2" strokeDasharray="12 12" />
              {["A", "B", "C", "D"].map((label, index) => <text key={label} x={[185, 505, 905, 1292][index]} y="60" fill="rgba(125,211,252,.92)" fontSize="48" fontWeight="800">{label}</text>)}
              {["E", "F", "G", "H"].map((label, index) => <text key={label} x={[185, 505, 905, 1292][index]} y="760" fill="rgba(125,211,252,.88)" fontSize="48" fontWeight="800">{label}</text>)}

              {zones.map((zone) => {
                const style = severityStyle[zone.severity];
                return (
                  <g key={zone.id} className="group cursor-pointer" filter="url(#labelGlow)">
                    <circle cx={zone.label.x} cy={zone.label.y} r="56" fill="rgba(0,0,0,.62)" stroke={style.border} strokeWidth="2" />
                    <text x={zone.label.x} y={zone.label.y - 25} textAnchor="middle" fill="white" fontSize="30" fontWeight="800">{zone.id}</text>
                    <text x={zone.label.x} y={zone.label.y + 2} textAnchor="middle" fill={style.color} fontSize="17" fontWeight="800">{style.label}</text>
                    <text x={zone.label.x} y={zone.label.y + 28} textAnchor="middle" fill="white" fontSize="18" fontWeight="700">{zone.maxTemp !== null ? `${zone.maxTemp.toFixed(1)} °C` : "— °C"}</text>
                    <text x={zone.label.x} y={zone.label.y + 51} textAnchor="middle" fill="rgba(255,255,255,.76)" fontSize="15">{zone.severity === "sem_dados" ? "sem dados" : `${zone.criticalPct.toFixed(1)}% crítico`}</text>
                    <title>{`${zone.title}\nSensores: ${zone.sensors.join(", ")}\nSeveridade: ${style.label}\nMáx: ${zone.maxTemp?.toFixed(1) ?? "—"} °C\n% crítico: ${zone.criticalPct.toFixed(1)}%`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="font-mono uppercase tracking-[0.18em] text-cyan">Legenda</span>
            {(["normal", "moderado", "alto", "critico", "sem_dados"] as Severity[]).map((sev) => <span key={sev} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: severityStyle[sev].color, boxShadow: `0 0 12px ${severityStyle[sev].color}` }} />{severityStyle[sev].label}</span>)}
            <span className="ml-auto font-mono uppercase tracking-[0.16em] text-muted-foreground">máscara = área delimitada do termográfico</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          {zones.map((zone) => (
            <div key={`row-${zone.id}`} className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-mono text-sm text-foreground">{zone.id}</div><div className="mt-1 text-[11px] text-muted-foreground">{zone.sensors.join(" · ")}</div></div>
                <StatusPill severity={zone.severity} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg bg-background/35 p-2"><Thermometer className="mb-1 size-3 text-muted-foreground" />{zone.maxTemp !== null ? `${zone.maxTemp.toFixed(1)}°C` : "—"}</div>
                <div className="rounded-lg bg-background/35 p-2"><Wind className="mb-1 size-3 text-muted-foreground" />{zone.severity === "sem_dados" ? "—" : `${zone.criticalPct.toFixed(1)}%`}</div>
                <div className="rounded-lg bg-background/35 p-2">{zone.criticalReadings} leit.</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}
