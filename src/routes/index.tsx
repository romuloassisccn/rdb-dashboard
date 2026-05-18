import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { AlertTriangle, Bolt, Gauge, Leaf, Snowflake, Thermometer, ThermometerSun, Target, Wind } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import {
  ChilledWaterChart,
  CondenserWaterChart,
  EfficiencyScatter,
  KwtrVsTrScatter,
  OatChart,
  TrChart,
} from "@/components/dashboard/Charts";
import { isNum, avgSafe } from "@/lib/safe";
import { VavHeatmap } from "@/components/dashboard/VavHeatmap";
import { OperationalFloorMap } from "@/components/dashboard/OperationalFloorMap";
import { Co2Panel } from "@/components/dashboard/Co2Panel";
import {
  CapacityDistributionPanel,
  ChillerHealthPanel,
  CriticalRankings,
  EsgCommandPanel,
  ScoreCommandCenter,
} from "@/components/dashboard/AnalyticsPanels";
import { useCagData } from "@/hooks/use-cag-data";
import type { ChillerPoint, Period } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAG · Rio Design Barra — Monitoramento Energético" },
      { name: "description", content: "Dashboard premium em tempo real para a Central de Água Gelada do Rio Design Barra: eficiência energética, chillers, temperaturas e qualidade do ar." },
      { property: "og:title", content: "CAG · Rio Design Barra" },
      { property: "og:description", content: "Monitoramento NOC futurista da Central de Água Gelada." },
    ],
  }),
  component: Dashboard,
});


type ChillerDelta = { unit: string; ag: number | null; ac: number | null };

function DeltaBadges({ values, type }: { values: ChillerDelta[]; type: "ag" | "ac" }) {
  const label = type === "ag" ? "ΔT AG" : "ΔT AC";
  const visible = values.filter((item) => isNum(item[type]));

  if (!visible.length) {
    return <span className="text-[10px] text-muted-foreground font-mono">{label}: —</span>;
  }

  return (
    <div className="hidden sm:flex flex-wrap items-center justify-end gap-1.5 max-w-[320px]">
      {visible.map((item) => {
        const value = item[type];
        const accent = type === "ag"
          ? !isNum(value) ? "text-muted-foreground" : value >= 5.5 ? "text-success" : value >= 4 ? "text-warning" : "text-violet"
          : !isNum(value) ? "text-muted-foreground" : value >= 4 ? "text-success" : value >= 2.5 ? "text-warning" : "text-violet";

        return (
          <span key={`${type}-${item.unit}`} className="rounded-full border border-border/70 bg-secondary/35 px-2 py-1 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {item.unit} • <span className="text-muted-foreground/80">ΔT</span> <span className={accent}>{value!.toFixed(1)}°C</span>
          </span>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const [period, setPeriod] = useState<Period>("ontem");
  const { series: rawSeries, vavs, co2, analytics } = useCagData(period);
  const rootRef = useRef<HTMLDivElement>(null);

  const series = Array.isArray(rawSeries) ? rawSeries.filter((d) => d && isNum(d.t)) : [];

  const stats = useMemo(() => {
    const last = series[series.length - 1];
    const pick = (sel: (d: typeof series[number]) => unknown, predicate: (v: number) => boolean) =>
      series.map(sel).filter((v): v is number => isNum(v) && predicate(v));

    const kwAvg = avgSafe(pick((d) => d.kw_ur1, (v) => v >= 10).concat(pick((d) => d.kw_ur2, (v) => v >= 10), pick((d) => d.kw_ur3, (v) => v >= 10)));
    const kwLast = last
      ? avgSafe([last.kw_ur1, last.kw_ur2, last.kw_ur3].filter((v) => isNum(v) && v >= 10))
      : null;

    const kwtrAvg = avgSafe(pick((d) => d.kwtr_ur1, (v) => v > 0 && v <= 4).concat(pick((d) => d.kwtr_ur2, (v) => v > 0 && v <= 4), pick((d) => d.kwtr_ur3, (v) => v > 0 && v <= 4)));

    const cagAvg = avgSafe(pick((d) => d.kw_tr_cag, (v) => v > 0));
    const cagLast = last && isNum(last.kw_tr_cag) ? last.kw_tr_cag : null;

    const oatValid = series.filter((d) => isNum(d.oat) && d.oat !== 0 && d.oat <= 60);
    const oatValues = oatValid.map((d) => d.oat);
    const oatMin = oatValues.length ? Math.min(...oatValues) : null;
    const oatMax = oatValues.length ? Math.max(...oatValues) : null;
    const oatAvg = avgSafe(oatValues);
    const oatNow = last && isNum(last.oat) && last.oat !== 0 && last.oat <= 60 ? last.oat : null;

    const half = Math.floor(series.length / 2);
    const trend = (sel: (d: typeof series[number]) => unknown) => {
      const a = avgSafe(series.slice(0, half).map(sel).filter((v): v is number => isNum(v) && v > 0));
      const b = avgSafe(series.slice(half).map(sel).filter((v): v is number => isNum(v) && v > 0));
      if (!isNum(a) || !isNum(b) || a === 0) return undefined;
      return ((b - a) / a) * 100;
    };

    return {
      kwAvg, kwLast,
      kwtrAvg,
      cagAvg, cagLast,
      oatMin, oatMax, oatAvg, oatNow,
      trendKw: trend((d) => ((isNum(d.kw_ur1) ? d.kw_ur1 : 0) + (isNum(d.kw_ur2) ? d.kw_ur2 : 0) + (isNum(d.kw_ur3) ? d.kw_ur3 : 0)) / 3),
      trendKwTr: trend((d) => d.kw_tr_cag),
    };
  }, [series]);

  const operationalStats = useMemo(() => {
    const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const fmtTrend = (value: number | null | undefined, unit: string, digits = 1) => {
      if (!isNum(value)) return "sem tendência 6h";
      const sign = value > 0 ? "+" : "";
      const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "–";
      return `${arrow} ${sign}${value.toFixed(digits)} ${unit} nas últimas 6h`;
    };

    const validVavs = vavs.filter((v) => isNum(v.temp) && v.temp > 0);
    const comfortCount = validVavs.filter((v) => v.temp >= 23 && v.temp <= 24.5).length;
    const criticalZones = validVavs.filter((v) => v.temp < 23 || v.temp > 25).length;
    const comfortPct = validVavs.length ? (comfortCount / validVavs.length) * 100 : null;
    const tempAvg = avg(validVavs.map((v) => v.temp));
    const tempTrend = avg(validVavs.map((v) => v.trend).filter(isNum));

    const validCo2 = co2.filter((sensor) => isNum(sensor.ppm) && sensor.ppm > 0);
    const co2Avg = avg(validCo2.map((sensor) => sensor.ppm));
    const co2Trend = avg(validCo2.map((sensor) => sensor.trend).filter(isNum));

    const kwTrTarget = 0.88;
    const kwTrAvg = avg(series.map((point) => point.kw_tr_cag).filter((value): value is number => isNum(value) && value > 0));
    const kwTrDelta = isNum(kwTrAvg) ? kwTrAvg - kwTrTarget : null;


    const getTr = (point: typeof series[number], ur: 1 | 2 | 3) => {
      const direct = point[`tr_ur${ur}` as keyof ChillerPoint];
      if (isNum(direct) && direct > 0) return direct;
      const kw = point[`kw_ur${ur}` as keyof ChillerPoint];
      const kwtr = point[`kwtr_ur${ur}` as keyof ChillerPoint];
      if (isNum(kw) && kw > 0 && isNum(kwtr) && kwtr > 0 && kwtr <= 4) return kw / kwtr;
      return null;
    };
    const trTotals = series
      .map((point) => [getTr(point, 1), getTr(point, 2), getTr(point, 3)]
        .filter((value): value is number => isNum(value) && value > 0)
        .reduce((sum, value) => sum + value, 0))
      .filter((value) => value > 0);
    const trAvg = avg(trTotals);

    const powerTotals = series
      .map((point) => [point.kw_ur1, point.kw_ur2, point.kw_ur3]
        .filter((value): value is number => isNum(value) && value > 0)
        .reduce((sum, value) => sum + value, 0))
      .filter((value) => value > 0);
    const powerAvg = avg(powerTotals);

    const sixHours = 6 * 60 * 60 * 1000;
    const trendBySeries = (selector: (point: typeof series[number]) => number | null | undefined) => {
      const latestT = series.at(-1)?.t;
      if (!isNum(latestT)) return null;
      const recent = series
        .filter((point) => point.t > latestT - sixHours)
        .map(selector)
        .filter((value): value is number => isNum(value) && value > 0);
      const previous = series
        .filter((point) => point.t <= latestT - sixHours && point.t > latestT - 2 * sixHours)
        .map(selector)
        .filter((value): value is number => isNum(value) && value > 0);
      const recentAvg = avg(recent);
      const previousAvg = avg(previous);
      return isNum(recentAvg) && isNum(previousAvg) ? recentAvg - previousAvg : null;
    };

    const kwTrTrend = trendBySeries((point) => point.kw_tr_cag);
    const trTrend = trendBySeries((point) => {
      const total = [getTr(point, 1), getTr(point, 2), getTr(point, 3)]
        .filter((value): value is number => isNum(value) && value > 0)
        .reduce((sum, value) => sum + value, 0);
      return total > 0 ? total : null;
    });

    const powerTrend = trendBySeries((point) => {
      const total = [point.kw_ur1, point.kw_ur2, point.kw_ur3]
        .filter((value): value is number => isNum(value) && value > 0)
        .reduce((sum, value) => sum + value, 0);
      return total > 0 ? total : null;
    });

    return {
      comfortPct,
      tempAvg,
      tempTrend,
      criticalZones,
      co2Avg,
      co2Trend,
      kwTrAvg,
      kwTrDelta,
      kwTrTrend,
      trAvg,
      trTrend,
      powerAvg,
      powerTrend,
      fmtTrend,
    };
  }, [series, vavs, co2]);

  const chillerDeltaStats = useMemo<ChillerDelta[]>(() => {
    const units = [
      { unit: "UR1", kwtr: "kwtr_ur1", ewt: "ewt_ur1", lwt: "lwt_ur1", ect: "ect_ur1", lct: "lct_ur1" },
      { unit: "UR2", kwtr: "kwtr_ur2", ewt: "ewt_ur2", lwt: "lwt_ur2", ect: "ect_ur2", lct: "lct_ur2" },
      { unit: "UR3", kwtr: "kwtr_ur3", ewt: "ewt_ur3", lwt: "lwt_ur3", ect: "ect_ur3", lct: "lct_ur3" },
    ] as const;

    const deltaAvg = (unit: typeof units[number], mode: "ag" | "ac") => {
      const values = series
        .map((point) => {
          const enter = point[(mode === "ag" ? unit.ewt : unit.ect) as keyof ChillerPoint];
          const leave = point[(mode === "ag" ? unit.lwt : unit.lct) as keyof ChillerPoint];
          return isNum(enter) && isNum(leave) ? (mode === "ag" ? enter - leave : leave - enter) : null;
        })
        .filter((value): value is number => isNum(value) && value > 0 && value < 30);

      return avgSafe(values);
    };

    return units.map((unit) => ({
      unit: unit.unit,
      ag: deltaAvg(unit, "ag"),
      ac: deltaAvg(unit, "ac"),
    }));
  }, [series]);

  const handleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div ref={rootRef} className="min-h-screen ring-grid">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <TopBar
          externalTemp={stats.oatAvg}
          externalTempMin={stats.oatMin}
          externalTempMax={stats.oatMax}
          cagConsumption={stats.cagAvg}
          cagTarget={0.88}
          onFullscreen={handleFullscreen}
        />

        {/* Filtro */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Visão geral · período</div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>

        {/* Centro de comando analítico */}
        <ScoreCommandCenter analytics={analytics} />

        {/* Linha 1: KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <KpiCard
            label="Consumo médio dos chillers"
            value={isNum(stats.kwAvg) ? stats.kwAvg.toFixed(0) : "—"}
            unit="kW"
            icon={Bolt}
            accent="primary"
            trend={stats.trendKw}
            hint={`Atual: ${isNum(stats.kwLast) ? stats.kwLast.toFixed(0) : "—"} kW`}
            bar={isNum(stats.kwLast) ? { value: stats.kwLast, max: 600 } : undefined}
          />
          <KpiCard
            label="Eficiência média kW/TR"
            value={isNum(stats.kwtrAvg) ? stats.kwtrAvg.toFixed(2) : "—"}
            unit="kW/TR"
            icon={Gauge}
            accent={!isNum(stats.kwtrAvg) ? "primary" : stats.kwtrAvg < 0.8 ? "success" : stats.kwtrAvg < 1 ? "primary" : "warning"}
            trend={stats.trendKwTr}
            hint={!isNum(stats.kwtrAvg) ? "Sem dados" : stats.kwtrAvg < 0.8 ? "Excelente" : stats.kwtrAvg < 1 ? "Adequada" : "Acima da meta"}
            bar={isNum(stats.kwtrAvg) ? { value: stats.kwtrAvg, max: 1.5 } : undefined}
          />
          <KpiCard
            label="Consumo geral CAG (kW/TR)"
            value={isNum(stats.cagAvg) ? stats.cagAvg.toFixed(2) : "—"}
            unit="kW/TR"
            icon={Snowflake}
            accent="violet"
            hint={`Tempo real: ${isNum(stats.cagLast) ? stats.cagLast.toFixed(2) : "—"} kW/TR`}
            bar={isNum(stats.cagLast) ? { value: stats.cagLast, max: 1.5 } : undefined}
          />
        </div>

        <EsgCommandPanel analytics={analytics} />

        <CriticalRankings analytics={analytics} />

        {/* Linha 2: Chillers */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <PanelCard
            title="Água Gelada — Entrada / Saída"
            subtitle="EWT (tracejado) · LWT (sólido) por chiller"
            glow="primary"
            right={<DeltaBadges values={chillerDeltaStats} type="ag" />}
          >
            <ChilledWaterChart data={series} period={period} />
          </PanelCard>
          <PanelCard
            title="Água Condensada — Entrada / Saída"
            subtitle="ECT (tracejado) · LCT (sólido) por chiller"
            right={<DeltaBadges values={chillerDeltaStats} type="ac" />}
          >
            <CondenserWaterChart data={series} period={period} />
          </PanelCard>
          <PanelCard title="Capacidade térmica (TR)" subtitle="Toneladas de refrigeração por chiller">
            <TrChart data={series} period={period} />
          </PanelCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <ChillerHealthPanel analytics={analytics} />
          <CapacityDistributionPanel analytics={analytics} />
        </div>

        {/* Linha 3: OAT */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <KpiCard
            label="Temperatura externa média"
            value={isNum(stats.oatAvg) ? stats.oatAvg.toFixed(1) : "—"}
            unit="°C"
            icon={ThermometerSun}
            accent="warning"
            hint={isNum(stats.oatMin) && isNum(stats.oatMax) ? `mín ${stats.oatMin.toFixed(1)}° · máx ${stats.oatMax.toFixed(1)}°` : `Agora: ${isNum(stats.oatNow) ? stats.oatNow.toFixed(1) : "—"}°C`}
            bar={isNum(stats.oatAvg) ? { value: stats.oatAvg, max: 45 } : undefined}
          />
          <PanelCard title="Temperatura externa" subtitle="Comportamento ao longo do período" className="xl:col-span-2">
            <OatChart data={series} period={period} />
          </PanelCard>
        </div>

        {/* Linha 4: Scatters */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PanelCard
            title="Eficiência vs Temperatura externa"
            subtitle="Impacto da OAT no kW/TR de cada chiller (UR1 · UR2 · UR3)"
            glow="violet"
          >
            <EfficiencyScatter data={series} />
          </PanelCard>
          <PanelCard
            title="kW/TR x TR Produzido"
            subtitle="Eficiência por carga térmica de cada chiller (UR1 · UR2 · UR3)"
            glow="primary"
          >
            <KwtrVsTrScatter data={series} />
          </PanelCard>
        </div>

        {/* Linha 5: Resumo operacional do período */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <KpiCard
            label="Conforto térmico"
            value={isNum(operationalStats.comfortPct) ? operationalStats.comfortPct.toFixed(0) : "—"}
            unit="%"
            icon={Leaf}
            accent={!isNum(operationalStats.comfortPct) ? "primary" : operationalStats.comfortPct >= 80 ? "success" : operationalStats.comfortPct >= 60 ? "warning" : "violet"}
            hint={isNum(operationalStats.tempAvg) ? `Temp. média ${operationalStats.tempAvg.toFixed(1)}°C · ${operationalStats.fmtTrend(operationalStats.tempTrend, "°C")}` : "Sem dados VAV"}
            bar={isNum(operationalStats.comfortPct) ? { value: operationalStats.comfortPct, max: 100 } : undefined}
          />
          <KpiCard
            label="CO₂ médio"
            value={isNum(operationalStats.co2Avg) ? operationalStats.co2Avg.toFixed(0) : "—"}
            unit="ppm"
            icon={Wind}
            accent={!isNum(operationalStats.co2Avg) ? "primary" : operationalStats.co2Avg <= 800 ? "success" : operationalStats.co2Avg <= 1000 ? "warning" : "violet"}
            hint={operationalStats.fmtTrend(operationalStats.co2Trend, "ppm", 0)}
            bar={isNum(operationalStats.co2Avg) ? { value: operationalStats.co2Avg, max: 1200 } : undefined}
          />
          <KpiCard
            label="Zonas críticas"
            value={isNum(operationalStats.criticalZones) ? String(operationalStats.criticalZones) : "—"}
            icon={AlertTriangle}
            accent={operationalStats.criticalZones === 0 ? "success" : operationalStats.criticalZones <= 3 ? "warning" : "violet"}
            hint="VAVs <23°C ou >25°C"
            bar={isNum(operationalStats.criticalZones) ? { value: operationalStats.criticalZones, max: Math.max(1, vavs.length) } : undefined}
          />
          <KpiCard
            label="kW/TR vs meta"
            value={isNum(operationalStats.kwTrAvg) ? operationalStats.kwTrAvg.toFixed(2) : "—"}
            unit="kW/TR"
            icon={Target}
            accent={!isNum(operationalStats.kwTrAvg) ? "primary" : operationalStats.kwTrAvg <= 0.88 ? "success" : operationalStats.kwTrAvg <= 0.95 ? "warning" : "violet"}
            hint={isNum(operationalStats.kwTrDelta) ? `${operationalStats.kwTrDelta <= 0 ? "Dentro da meta" : "Acima da meta"} · ${operationalStats.kwTrDelta >= 0 ? "+" : ""}${operationalStats.kwTrDelta.toFixed(2)} vs 0.88 · ${operationalStats.fmtTrend(operationalStats.kwTrTrend, "kW/TR", 2)}` : "Meta 0.88 kW/TR"}
            bar={isNum(operationalStats.kwTrAvg) ? { value: operationalStats.kwTrAvg, max: 1.2 } : undefined}
          />
          <KpiCard
            label="TR médio"
            value={isNum(operationalStats.trAvg) ? operationalStats.trAvg.toFixed(0) : "—"}
            unit="TR"
            icon={Snowflake}
            accent="primary"
            hint={operationalStats.fmtTrend(operationalStats.trTrend, "TR", 0)}
            bar={isNum(operationalStats.trAvg) ? { value: operationalStats.trAvg, max: 1200 } : undefined}
          />
          <KpiCard
            label="Potência média CAG"
            value={isNum(operationalStats.powerAvg) ? operationalStats.powerAvg.toFixed(0) : "—"}
            unit="kW"
            icon={Bolt}
            accent="primary"
            hint={operationalStats.fmtTrend(operationalStats.powerTrend, "kW", 0)}
            bar={isNum(operationalStats.powerAvg) ? { value: operationalStats.powerAvg, max: 1200 } : undefined}
          />
        </div>

        {/* Linha 6: VAVs */}
        <PanelCard
          title="Temperaturas ambiente por andar"
          subtitle="Mapa térmico VAV — janela operacional 11h às 22h"
          right={<Wind className="size-4 text-muted-foreground" />}
        >
          <VavHeatmap vavs={vavs} />
        </PanelCard>

        <OperationalFloorMap analytics={analytics} vavs={vavs} />

        {/* Linha 7: CO2 */}
        <PanelCard
          title="Qualidade do ar — CO₂ ambiente"
          subtitle="Sensores co2-1 a co2-8"
          right={<Thermometer className="size-4 text-muted-foreground" />}
        >
          <Co2Panel data={co2} />
        </PanelCard>

        <footer className="pt-2 pb-6 text-center text-[11px] text-muted-foreground">
          Rio Design Barra · Central de Água Gelada · Dados atualizados após o report diário
        </footer>
      </div>
    </div>
  );
}
