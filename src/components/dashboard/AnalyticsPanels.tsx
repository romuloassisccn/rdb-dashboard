import { Activity, AlertTriangle, BarChart3, BrainCircuit, Gauge, Leaf, LineChart, ShieldCheck, Trees, Wind, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PanelCard } from "./PanelCard";
import type { DashboardAnalytics } from "@/hooks/use-cag-data";
import { isNum } from "@/lib/safe";

type Accent = "primary" | "success" | "warning" | "violet" | "danger";

const accentColor: Record<Accent, string> = {
  primary: "var(--cyan)",
  success: "var(--success)",
  warning: "var(--warning)",
  violet: "var(--violet)",
  danger: "var(--destructive)",
};

function n(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function classifyAccent(classificacao?: unknown): Accent {
  const c = text(classificacao, "").toLowerCase();
  if (["excelente", "bom", "normal", "dentro_da_meta", "estavel"].includes(c)) return "success";
  if (["atencao", "atenção", "moderado", "moderada", "atencao_pontual"].includes(c)) return "warning";
  if (["critico", "crítico", "ruim", "alto", "instavel", "instável"].includes(c)) return "danger";
  return "primary";
}

function label(value: unknown) {
  const raw = text(value);
  return raw
    .replaceAll("_", " ")
    .replace("critico", "crítico")
    .replace("instavel", "instável")
    .replace("atencao", "atenção")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function Badge({ value }: { value: unknown }) {
  const accent = classifyAccent(value);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{
        color: accentColor[accent],
        borderColor: `color-mix(in oklab, ${accentColor[accent]} 38%, transparent)`,
        background: `color-mix(in oklab, ${accentColor[accent]} 12%, transparent)`,
      }}
    >
      {label(value)}
    </span>
  );
}


function mergeChillerRows(analytics: DashboardAnalytics | null): Record<string, unknown>[] {
  const base = Array.isArray(analytics?.chillers) ? analytics.chillers : [];
  const capacidade = Array.isArray(analytics?.capacidadeChillers) ? analytics.capacidadeChillers : [];
  const byUr = new Map<string, Record<string, unknown>>();

  for (const item of base) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const ur = text(row.ur, "").toUpperCase();
    if (!ur) continue;
    byUr.set(ur, { ...row, ur });
  }

  for (const item of capacidade) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const ur = text(row.ur, "").toUpperCase();
    if (!ur) continue;
    byUr.set(ur, { ...(byUr.get(ur) ?? { ur }), ...row, ur });
  }

  return ["UR1", "UR2", "UR3"]
    .map((ur) => byUr.get(ur))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function MiniMetric({ title, value, unit, hint, accent = "primary", icon: Icon }: { title: string; value: string; unit?: string; hint?: string; accent?: Accent; icon?: typeof Activity }) {
  const color = accentColor[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/25 p-4">
      <div aria-hidden className="absolute -right-10 -top-12 size-28 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-semibold" style={{ color }}>{value}</span>
            {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
          </div>
          {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {Icon && <Icon className="size-5 shrink-0" style={{ color }} />}
      </div>
    </div>
  );
}

export function ScoreCommandCenter({ analytics }: { analytics: DashboardAnalytics | null }) {
  const score = analytics?.score ?? {};
  const diagnostico = analytics?.diagnostico ?? {};
  const kpis = analytics?.kpis ?? {};
  const geral = n(score.geral);
  const accent = classifyAccent(score.classificacao);
  const color = accentColor[accent];
  const prioridade = text(diagnostico.prioridadePrincipal, "operação estável").toUpperCase();

  return (
    <PanelCard
      title="Comando operacional inteligente"
      subtitle="Score, severidade e prioridade calculados a partir do motor analítico do relatório"
      glow="primary"
      right={<Badge value={score.classificacao ?? "sem_dados"} />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-4">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-secondary/25 p-5 min-h-[220px]">
          <div aria-hidden className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 20%, ${color}, transparent 55%)` }} />
          <div className="relative flex h-full flex-col items-center justify-center text-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Score geral</div>
            <div className="mt-2 font-mono text-7xl font-semibold tracking-tighter" style={{ color }}>{isNum(geral) ? geral : "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">de 100 · {label(score.classificacao)}</div>
            <div className="mt-5 w-full rounded-full bg-background/60 p-1">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(2, Math.min(100, geral ?? 0))}%`, background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 45%, transparent))` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <MiniMetric title="Eficiência" value={isNum(n(score.eficiencia)) ? String(score.eficiencia) : "—"} unit="/100" accent={classifyAccent(diagnostico.eficiencia)} icon={Gauge} hint={label(diagnostico.eficiencia)} />
          <MiniMetric title="Conforto" value={isNum(n(score.conforto)) ? String(score.conforto) : "—"} unit="/100" accent={classifyAccent(diagnostico.conforto)} icon={Leaf} hint={`${n(kpis.confortoPercentual)?.toFixed(1) ?? "—"}% dentro da faixa`} />
          <MiniMetric title="CO₂" value={isNum(n(score.co2)) ? String(score.co2) : "—"} unit="/100" accent={classifyAccent(diagnostico.co2)} icon={Wind} hint={`${n(kpis.leiturasCo2Acima900)?.toFixed(0) ?? "0"} leituras >900 ppm`} />
          <MiniMetric title="Prioridade" value={prioridade} accent={classifyAccent(diagnostico.conforto)} icon={BrainCircuit} hint="foco operacional atual" />
        </div>
      </div>
    </PanelCard>
  );
}

export function EsgCommandPanel({ analytics }: { analytics: DashboardAnalytics | null }) {
  const esg = analytics?.esg ?? {};
  const kpis = analytics?.kpis ?? {};
  const rows = (Array.isArray(esg.serieDiaria) ? esg.serieDiaria : []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      data: text(r.data),
      energia: n(r.energiaKwh) ?? 0,
      emissoes: n(r.emissoesKgCo2e) ?? 0,
    };
  });

  return (
    <PanelCard title="ESG HVAC" subtitle="Emissões indiretas estimadas por energia elétrica dos chillers" glow="violet" right={<Trees className="size-4 text-success" />}>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.3fr] gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MiniMetric title="Energia HVAC" value={(n(esg.energiaTotalMwh) ?? n(kpis.energiaMwh))?.toFixed(3) ?? "—"} unit="MWh" icon={Zap} accent="primary" hint={`${(n(esg.energiaTotalKwh) ?? n(kpis.energiaKwh))?.toFixed(0) ?? "—"} kWh`} />
          <MiniMetric title="Emissões" value={(n(esg.emissoesTCo2e) ?? n(kpis.emissoesTCo2e))?.toFixed(3) ?? "—"} unit="tCO₂e" icon={Leaf} accent="success" hint={`${(n(esg.emissoesKgCo2e) ?? n(kpis.emissoesKgCo2e))?.toFixed(1) ?? "—"} kgCO₂e`} />
          <MiniMetric title="Intensidade" value={(n(esg.intensidadeKwhPorTrh) ?? n(kpis.intensidadeKwhPorTrh))?.toFixed(3) ?? "—"} unit="kWh/TRh" icon={BarChart3} accent="violet" hint={`${n(esg.trhTotal)?.toFixed(0) ?? "—"} TRh`} />
          <MiniMetric title="Fator" value={n(esg.fatorEmissaoKgCo2PorKwh)?.toFixed(4) ?? "—"} unit="kgCO₂e/kWh" icon={ShieldCheck} accent="warning" hint="configurável" />
        </div>
        <div className="h-[250px] rounded-2xl border border-border bg-background/25 p-3">
          {rows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="data" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.04)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="energia" name="kWh" radius={[8, 8, 0, 0]} fill="var(--cyan)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">Sem série ESG disponível</div>
          )}
        </div>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">CO₂ ambiente em ppm é qualidade do ar, não pegada de carbono. ESG usa kWh estimado × fator de emissão.</div>
    </PanelCard>
  );
}

export function CriticalRankings({ analytics }: { analytics: DashboardAnalytics | null }) {
  const vavs = Array.isArray(analytics?.conforto?.vavsCriticos) ? analytics?.conforto?.vavsCriticos.slice(0, 8) : [];
  const co2 = Array.isArray(analytics?.qualidadeDoAr?.sensoresCriticos) ? analytics?.qualidadeDoAr?.sensoresCriticos.slice(0, 6) : [];
  const piores = Array.isArray(analytics?.pioresDias) ? analytics?.pioresDias.slice(0, 5) : [];

  const tableClass = "w-full text-left text-[11px]";
  const thClass = "pb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground";
  const tdClass = "border-t border-border/70 py-2 text-muted-foreground";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <PanelCard title="Ranking VAV crítico" subtitle="Zonas com maior recorrência fora da faixa" glow="violet">
        <table className={tableClass}>
          <thead><tr><th className={thClass}>VAV</th><th className={thClass}>% crítico</th><th className={thClass}>Severidade</th></tr></thead>
          <tbody>
            {vavs.map((item, idx) => {
              const r = item as Record<string, unknown>;
              return <tr key={`${r.sensor}-${idx}`}><td className={tdClass}>{text(r.sensor)}</td><td className={tdClass}>{n(r.percentualCritico)?.toFixed(1) ?? "—"}%</td><td className={tdClass}><Badge value={r.severidade} /></td></tr>;
            })}
            {!vavs.length && <tr><td className={tdClass} colSpan={3}>Sem VAVs críticos no período.</td></tr>}
          </tbody>
        </table>
      </PanelCard>

      <PanelCard title="Sensores CO₂ críticos" subtitle="Recorrência acima de 900 ppm">
        <table className={tableClass}>
          <thead><tr><th className={thClass}>Sensor</th><th className={thClass}>Leituras</th><th className={thClass}>Máx.</th></tr></thead>
          <tbody>
            {co2.map((item, idx) => {
              const r = item as Record<string, unknown>;
              return <tr key={`${r.sensor}-${idx}`}><td className={tdClass}>{text(r.sensor)}</td><td className={tdClass}>{n(r.leiturasAcima900)?.toFixed(0) ?? "—"}</td><td className={tdClass}>{n(r.max)?.toFixed(0) ?? "—"} ppm</td></tr>;
            })}
            {!co2.length && <tr><td className={tdClass} colSpan={3}>Sem sensores críticos no período.</td></tr>}
          </tbody>
        </table>
      </PanelCard>

      <PanelCard title="Piores dias" subtitle="Score e causa principal" glow="primary">
        <table className={tableClass}>
          <thead><tr><th className={thClass}>Dia</th><th className={thClass}>Score</th><th className={thClass}>Problema</th></tr></thead>
          <tbody>
            {piores.map((item, idx) => {
              const r = item as Record<string, unknown>;
              return <tr key={`${r.data}-${idx}`}><td className={tdClass}>{text(r.data)}</td><td className={tdClass}>{n(r.scoreGeral)?.toFixed(0) ?? "—"}</td><td className={tdClass}>{label(r.principalProblema)}</td></tr>;
            })}
            {!piores.length && <tr><td className={tdClass} colSpan={3}>Sem ranking disponível.</td></tr>}
          </tbody>
        </table>
      </PanelCard>
    </div>
  );
}

export function ChillerHealthPanel({ analytics }: { analytics: DashboardAnalytics | null }) {
  const rows = mergeChillerRows(analytics);
  return (
    <PanelCard title="Score e estabilidade por chiller" subtitle="Capacidade, estabilidade, amostra e performance operacional" glow="primary" right={<LineChart className="size-4 text-muted-foreground" />}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {rows.map((item, idx) => {
          const r = item as Record<string, unknown>;
          const score = n(r.score);
          const accent = r.amostraInsuficiente ? "warning" : classifyAccent(r.classificacao);
          return (
            <div key={`${r.ur}-${idx}`} className="rounded-2xl border border-border bg-secondary/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{text(r.ur)}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-semibold" style={{ color: accentColor[accent] }}>{score === null ? "N/A" : score}</span>
                    <span className="text-xs text-muted-foreground">score</span>
                  </div>
                </div>
                <Badge value={r.classificacao} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl bg-background/30 p-2"><div className="text-muted-foreground">Horas válidas</div><div className="font-mono">{n(r.horasValidas)?.toFixed(1) ?? "—"} h</div></div>
                <div className="rounded-xl bg-background/30 p-2"><div className="text-muted-foreground">Capacidade</div><div className="font-mono">{n(r.capacidadeMedia)?.toFixed(1) ?? "—"}%</div></div>
                <div className="rounded-xl bg-background/30 p-2"><div className="text-muted-foreground">kW/TR</div><div className="font-mono">{n(r.kwTrMedio)?.toFixed(2) ?? "—"}</div></div>
                <div className="rounded-xl bg-background/30 p-2"><div className="text-muted-foreground">Estabilidade</div><div className="font-mono">{label(r.estabilidade)}</div></div>
              </div>
            </div>
          );
        })}
        {!rows.length && <div className="text-xs text-muted-foreground">Sem dados de chiller enriquecidos.</div>}
      </div>
    </PanelCard>
  );
}

export function CapacityDistributionPanel({ analytics }: { analytics: DashboardAnalytics | null }) {
  const rows = mergeChillerRows(analytics);
  const data = rows
    .map((item) => {
      const r = item as Record<string, unknown>;
      const cap = n(r.capacidadeMedia);
      if (cap === null) return null;
      return {
        ur: text(r.ur),
        cap,
        fill: cap >= 80 ? "var(--destructive)" : cap >= 30 ? "var(--warning)" : "var(--cyan)",
      };
    })
    .filter((item): item is { ur: string; cap: number; fill: string } => item !== null);

  return (
    <PanelCard title="Capacidade operacional" subtitle="Leitura média por UR no período filtrado">
      <div className="h-[220px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="ur" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.04)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="cap" name="Capacidade média (%)" radius={[8, 8, 0, 0]}>
                {data.map((entry) => <Cell key={entry.ur} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">Sem capacidade disponível</div>
        )}
      </div>
    </PanelCard>
  );
}
