import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartTooltip, formatDay, formatHour } from "./ChartTooltip";
import { EmptyState } from "./EmptyState";
import type { ChillerPoint, Period } from "@/lib/mock-data";
import { isNum, num } from "@/lib/safe";

const axis = { stroke: "oklch(1 0 0 / 0.25)", fontSize: 10, tickLine: false, axisLine: false } as const;


function startOfUtcDay(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}

function buildTicks(start: number, end: number, stepMs: number): number[] {
  const ticks: number[] = [];
  for (let t = start; t <= end; t += stepMs) ticks.push(t);
  return ticks;
}

function makeTimeAxis(data: ChillerPoint[], period: Period) {
  const valid = (Array.isArray(data) ? data : [])
    .map((d) => d?.t)
    .filter(isNum)
    .sort((a, b) => a - b);
  const reference = valid.at(-1) ?? Date.now();
  const dayStart = startOfUtcDay(reference);

  if (period === "ontem") {
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    return {
      type: "number" as const,
      scale: "time" as const,
      domain: [dayStart, dayEnd] as [number, number],
      ticks: [...buildTicks(dayStart, dayStart + 21 * 60 * 60 * 1000, 3 * 60 * 60 * 1000), dayEnd],
      tickFormatter: formatHour,
      minTickGap: 26,
      interval: 0,
      allowDataOverflow: false,
    };
  }

  if (period === "7d") {
    const start = dayStart - 6 * 24 * 60 * 60 * 1000;
    const end = dayStart + 24 * 60 * 60 * 1000 - 1;
    return {
      type: "number" as const,
      scale: "time" as const,
      domain: [start, end] as [number, number],
      ticks: buildTicks(start, dayStart, 24 * 60 * 60 * 1000),
      tickFormatter: formatDay,
      minTickGap: 32,
      interval: 0,
      allowDataOverflow: false,
    };
  }

  const start = dayStart - 29 * 24 * 60 * 60 * 1000;
  const end = dayStart + 24 * 60 * 60 * 1000 - 1;
  return {
    type: "number" as const,
    scale: "time" as const,
    domain: [start, end] as [number, number],
    ticks: buildTicks(start, dayStart, 5 * 24 * 60 * 60 * 1000),
    tickFormatter: formatDay,
    minTickGap: 38,
    interval: 0,
    allowDataOverflow: false,
  };
}

type TimeAxisConfig = ReturnType<typeof makeTimeAxis>;

function enforceTimeDomain<T extends { t: number }>(rows: T[], timeAxis: TimeAxisConfig): T[] {
  const [start, end] = timeAxis.domain;
  const out = [...rows];

  // Pontos sentinela sem valores. Eles forçam todos os gráficos a ocuparem
  // o mesmo domínio temporal, mesmo quando uma série válida termina cedo
  // porque valores zero foram ignorados.
  if (!out.some((row) => row.t === start)) out.unshift({ t: start } as T);
  if (!out.some((row) => row.t === end)) out.push({ t: end } as T);

  return out.sort((a, b) => a.t - b.t);
}

function useHidden() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key?: string | number) => {
    if (key === undefined || key === null) return;
    const k = String(key);
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const legendStyle = (key: string) => ({
    color: hidden.has(key) ? "oklch(1 0 0 / 0.35)" : undefined,
    textDecoration: hidden.has(key) ? "line-through" as const : undefined,
    cursor: "pointer" as const,
  });
  return { hidden, toggle, legendStyle };
}

// Build a series with defensive null-coalescing; returns array of { t, [key]: number|null }
function buildSeries<T extends Record<string, number | null>>(
  data: ChillerPoint[],
  mapper: (d: ChillerPoint) => T,
) {
  return (Array.isArray(data) ? data : [])
    .filter((d) => d && isNum(d.t))
    .map((d) => {
      const mapped = mapper(d);
      return { t: d.t, ...mapped };
    })
    .filter((row) => Object.entries(row).some(([key, value]) => key !== "t" && isNum(value)));
}

function seriesHasAny(rows: Array<Record<string, unknown>>, key: string): boolean {
  return rows.some((r) => isNum(r[key]));
}

function positive(value: unknown): number | null {
  return isNum(value) && value > 0 ? value : null;
}

function derivedTr(point: ChillerPoint, ur: 1 | 2 | 3): number | null {
  const direct = positive(point[`tr_ur${ur}` as keyof ChillerPoint]);
  if (direct !== null) return direct;

  const kw = positive(point[`kw_ur${ur}` as keyof ChillerPoint]);
  const kwtr = positive(point[`kwtr_ur${ur}` as keyof ChillerPoint]);
  if (kw !== null && kwtr !== null && kwtr <= 4) return kw / kwtr;

  return null;
}

export function ChilledWaterChart({ data, period }: { data: ChillerPoint[]; period: Period }) {
  const { hidden, toggle, legendStyle } = useHidden();
  const timeAxis = makeTimeAxis(data, period);
  const cleaned = buildSeries(data, (d) => ({
    "EWT UR1": num(d.ewt_ur1) && d.ewt_ur1 > 0 ? num(d.ewt_ur1) : null,
    "LWT UR1": num(d.lwt_ur1) && d.lwt_ur1 > 0 ? num(d.lwt_ur1) : null,
    "EWT UR2": num(d.ewt_ur2) && d.ewt_ur2 > 0 ? num(d.ewt_ur2) : null,
    "LWT UR2": num(d.lwt_ur2) && d.lwt_ur2 > 0 ? num(d.lwt_ur2) : null,
    "EWT UR3": num(d.ewt_ur3) && d.ewt_ur3 > 0 ? num(d.ewt_ur3) : null,
    "LWT UR3": num(d.lwt_ur3) && d.lwt_ur3 > 0 ? num(d.lwt_ur3) : null,
  }));

  const colors = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)"];
  const units = (["UR1", "UR2", "UR3"] as const).filter(
    (u) => seriesHasAny(cleaned, `EWT ${u}`) || seriesHasAny(cleaned, `LWT ${u}`),
  );
  if (!cleaned.length || units.length === 0) return <EmptyState height={260} />;
  const chartData = enforceTimeDomain(cleaned, timeAxis);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="t" {...axis} {...timeAxis} />
        <YAxis {...axis} domain={["dataMin - 1", "dataMax + 1"]} unit="°" />
        <Tooltip content={<ChartTooltip valueSuffix="°C" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" onClick={(o) => toggle(o?.dataKey as string)} formatter={(value) => <span style={legendStyle(String(value))}>{value}</span>} />
        {units.flatMap((u) => {
          const i = (["UR1", "UR2", "UR3"] as const).indexOf(u);
          const ek = `EWT ${u}`;
          const lk = `LWT ${u}`;
          return [
            <Line key={ek} type="monotone" dataKey={ek} stroke={colors[i]} strokeWidth={2} dot={false} connectNulls strokeDasharray="4 3" hide={hidden.has(ek)} />,
            <Line key={lk} type="monotone" dataKey={lk} stroke={colors[i]} strokeWidth={2} dot={false} connectNulls hide={hidden.has(lk)} />,
          ];
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CondenserWaterChart({ data, period }: { data: ChillerPoint[]; period: Period }) {
  const { hidden, toggle, legendStyle } = useHidden();
  const timeAxis = makeTimeAxis(data, period);
  const cleaned = buildSeries(data, (d) => ({
    "ECT UR1": num(d.ect_ur1) && d.ect_ur1 > 0 ? num(d.ect_ur1) : null,
    "LCT UR1": num(d.lct_ur1) && d.lct_ur1 > 0 ? num(d.lct_ur1) : null,
    "ECT UR2": num(d.ect_ur2) && d.ect_ur2 > 0 ? num(d.ect_ur2) : null,
    "LCT UR2": num(d.lct_ur2) && d.lct_ur2 > 0 ? num(d.lct_ur2) : null,
    "ECT UR3": num(d.ect_ur3) && d.ect_ur3 > 0 ? num(d.ect_ur3) : null,
    "LCT UR3": num(d.lct_ur3) && d.lct_ur3 > 0 ? num(d.lct_ur3) : null,
  }));
  const colors = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)"];
  const units = (["UR1", "UR2", "UR3"] as const).filter(
    (u) => seriesHasAny(cleaned, `ECT ${u}`) || seriesHasAny(cleaned, `LCT ${u}`),
  );
  if (!cleaned.length || units.length === 0) return <EmptyState height={260} />;
  const chartData = enforceTimeDomain(cleaned, timeAxis);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="t" {...axis} {...timeAxis} />
        <YAxis {...axis} domain={["dataMin - 1", "dataMax + 1"]} unit="°" />
        <Tooltip content={<ChartTooltip valueSuffix="°C" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" onClick={(o) => toggle(o?.dataKey as string)} formatter={(value) => <span style={legendStyle(String(value))}>{value}</span>} />
        {units.flatMap((u) => {
          const i = (["UR1", "UR2", "UR3"] as const).indexOf(u);
          const ek = `ECT ${u}`;
          const lk = `LCT ${u}`;
          return [
            <Line key={ek} type="monotone" dataKey={ek} stroke={colors[i]} strokeWidth={2} dot={false} connectNulls strokeDasharray="4 3" hide={hidden.has(ek)} />,
            <Line key={lk} type="monotone" dataKey={lk} stroke={colors[i]} strokeWidth={2} dot={false} connectNulls hide={hidden.has(lk)} />,
          ];
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrChart({ data, period }: { data: ChillerPoint[]; period: Period }) {
  const { hidden, toggle, legendStyle } = useHidden();
  const timeAxis = makeTimeAxis(data, period);
  const cleaned = buildSeries(data, (d) => ({
    "TR UR1": derivedTr(d, 1),
    "TR UR2": derivedTr(d, 2),
    "TR UR3": derivedTr(d, 3),
  }));
  const units = (["1", "2", "3"] as const).filter((i) => seriesHasAny(cleaned, `TR UR${i}`));
  if (!cleaned.length || units.length === 0) return <EmptyState height={260} />;
  const chartData = enforceTimeDomain(cleaned, timeAxis);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <defs>
          {units.map((i) => {
            const idx = Number(i) - 1;
            return (
              <linearGradient key={i} id={`tr${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--chart-${idx + 1})`} stopOpacity={0.5} />
                <stop offset="100%" stopColor={`var(--chart-${idx + 1})`} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="t" {...axis} {...timeAxis} />
        <YAxis {...axis} unit=" TR" />
        <Tooltip content={<ChartTooltip valueSuffix=" TR" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" onClick={(o) => toggle(o?.dataKey as string)} formatter={(value) => <span style={legendStyle(String(value))}>{value}</span>} />
        {units.map((i) => {
          const idx = Number(i) - 1;
          const k = `TR UR${i}`;
          return (
            <Area key={i} type="monotone" dataKey={k} stroke={`var(--chart-${idx + 1})`} strokeWidth={2} fill={`url(#tr${i})`} connectNulls hide={hidden.has(k)} />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OatChart({ data, period }: { data: ChillerPoint[]; period: Period }) {
  const timeAxis = makeTimeAxis(data, period);
  const cleaned = (Array.isArray(data) ? data : [])
    .filter((d) => d && isNum(d.t) && isNum(d.oat) && d.oat !== 0 && d.oat <= 60)
    .map((d) => ({ t: d.t, "Temperatura externa": d.oat }));

  if (!cleaned.length) return <EmptyState height={220} />;
  const chartData = enforceTimeDomain(cleaned, timeAxis);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="oatG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="t" {...axis} {...timeAxis} />
        <YAxis {...axis} unit="°" />
        <Tooltip content={<ChartTooltip valueSuffix="°C" />} />
        <Area type="monotone" dataKey="Temperatura externa" stroke="var(--warning)" strokeWidth={2} fill="url(#oatG)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function KwtrVsTrScatter({ data }: { data: ChillerPoint[] }) {
  const { hidden, toggle, legendStyle } = useHidden();
  const safe = Array.isArray(data) ? data : [];
  const series = (kwtrKey: "kwtr_ur1" | "kwtr_ur2" | "kwtr_ur3", trKey: "tr_ur1" | "tr_ur2" | "tr_ur3") =>
    safe
      .filter((d) => d && isNum(d[kwtrKey]) && d[kwtrKey] > 0 && d[kwtrKey] <= 4 && isNum(d[trKey]) && d[trKey] > 0)
      .map((d) => ({ x: d[trKey], y: d[kwtrKey] }));

  const cfg = [
    { name: "Chiller UR1", data: series("kwtr_ur1", "tr_ur1"), color: "var(--chart-1)" },
    { name: "Chiller UR2", data: series("kwtr_ur2", "tr_ur2"), color: "var(--chart-3)" },
    { name: "Chiller UR3", data: series("kwtr_ur3", "tr_ur3"), color: "var(--chart-2)" },
  ].filter((s) => s.data.length > 0);

  if (cfg.length === 0) return <EmptyState height={280} />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
        <XAxis type="number" dataKey="x" name="TR" unit=" TR" {...axis} domain={["dataMin - 5", "dataMax + 5"]} />
        <YAxis type="number" dataKey="y" name="kW/TR" {...axis} domain={[0, 1.5]} />
        <ZAxis range={[40, 40]} />
        <Tooltip
          cursor={{ stroke: "oklch(1 0 0 / 0.15)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { x: number; y: number };
            const name = payload[0].name as string;
            return (
              <div className="glass rounded-xl px-3 py-2 text-xs">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{name}</div>
                <div className="font-mono">TR: {isNum(p.x) ? p.x.toFixed(1) : "—"}</div>
                <div className="font-mono">kW/TR: {isNum(p.y) ? p.y.toFixed(2) : "—"}</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" onClick={(o) => toggle(o?.value as string)} formatter={(value) => <span style={legendStyle(String(value))}>{value}</span>} />
        {cfg.map((s) => (
          <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} fillOpacity={0.7} hide={hidden.has(s.name)} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function EfficiencyScatter({ data }: { data: ChillerPoint[] }) {
  const { hidden, toggle, legendStyle } = useHidden();
  const safe = Array.isArray(data) ? data : [];
  const series = (key: "kwtr_ur1" | "kwtr_ur2" | "kwtr_ur3") =>
    safe
      .filter((d) => d && isNum(d[key]) && d[key] > 0 && d[key] <= 4 && isNum(d.oat) && d.oat > 0 && d.oat <= 60)
      .map((d) => ({ x: d.oat, y: d[key] }));

  const cfg = [
    { name: "Chiller UR1", data: series("kwtr_ur1"), color: "var(--chart-1)" },
    { name: "Chiller UR2", data: series("kwtr_ur2"), color: "var(--chart-3)" },
    { name: "Chiller UR3", data: series("kwtr_ur3"), color: "var(--chart-2)" },
  ].filter((s) => s.data.length > 0);

  if (cfg.length === 0) return <EmptyState height={280} />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
        <XAxis type="number" dataKey="x" name="OAT" unit="°C" {...axis} domain={["dataMin - 1", "dataMax + 1"]} />
        <YAxis type="number" dataKey="y" name="kW/TR" {...axis} domain={[0, 1.5]} />
        <ZAxis range={[40, 40]} />
        <Tooltip
          cursor={{ stroke: "oklch(1 0 0 / 0.15)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { x: number; y: number };
            const name = payload[0].name as string;
            return (
              <div className="glass rounded-xl px-3 py-2 text-xs">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{name}</div>
                <div className="font-mono">OAT: {isNum(p.x) ? p.x.toFixed(1) : "—"}°C</div>
                <div className="font-mono">kW/TR: {isNum(p.y) ? p.y.toFixed(2) : "—"}</div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" onClick={(o) => toggle(o?.value as string)} formatter={(value) => <span style={legendStyle(String(value))}>{value}</span>} />
        {cfg.map((s) => (
          <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} fillOpacity={0.7} hide={hidden.has(s.name)} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
