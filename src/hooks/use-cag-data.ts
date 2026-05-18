import { useQuery } from "@tanstack/react-query";
import type {
  ChillerPoint,
  Co2Reading,
  Period,
  VavReading,
} from "@/lib/mock-data";

const ENDPOINT =
  "https://ancar-n8n.gpfgqx.easypanel.host/webhook/dados-rdb";

export type DashboardAnalytics = {
  kpis?: Record<string, unknown>;
  score?: Record<string, unknown>;
  diagnostico?: Record<string, unknown>;
  esg?: Record<string, unknown> & { serieDiaria?: unknown[] };
  conforto?: Record<string, unknown> & { vavsCriticos?: unknown[]; serieDiaria?: unknown[] };
  qualidadeDoAr?: Record<string, unknown> & { sensoresCriticos?: unknown[]; serieDiaria?: unknown[] };
  eficiencia?: Record<string, unknown> & { serieDiaria?: unknown[] };
  chillers?: unknown[];
  capacidadeChillers?: unknown[];
  scoreDiario?: unknown[];
  pioresDias?: unknown[];
  qualidadeDados?: Record<string, unknown>;
};

interface RawPayload {
  series?: unknown[];
  vavs?: unknown[];
  co2?: unknown[];
  cagStatus?: unknown[];
  cag_status?: unknown[];
  analytics?: DashboardAnalytics;
  meta?: Record<string, unknown>;
}

interface CagPayload {
  series: ChillerPoint[];
  vavs: VavReading[];
  co2: Co2Reading[];
  cagStatus: RawTimedRow[];
  analytics: DashboardAnalytics | null;
  meta: Record<string, unknown> | null;
}

function vavFloor(n: number): string {
  if (n <= 40) return "Térreo";
  if (n <= 46) return "2º Pavimento";
  return "3º Pavimento";
}

function toNum(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(String(v).replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function normalizeKey(value: string): string {
  return String(value)
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeRecordKeys(point: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...point };
  for (const key of Object.keys(point)) {
    const normalized = normalizeKey(key);
    if (!(normalized in out)) out[normalized] = point[key];
  }
  return out;
}

function parseDateRange(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (!text) return null;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
    const t = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return Number.isFinite(t) ? t : null;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTimestampMs(v: unknown): number | null {
  const dateRangeTs = parseDateRange(v);
  if (dateRangeTs !== null) return dateRangeTs;

  const numeric = toNum(v);
  if (numeric !== null) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;

  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getRowTimestamp(point: Record<string, unknown>): number | null {
  return toTimestampMs(
    point.Date_Range
      ?? point["Date Range"]
      ?? point.date_range
      ?? point.reportDateTime
      ?? point.report_datetime
      ?? point.t
      ?? point.timestamp
      ?? point.datetime
      ?? point.created_at
      ?? point.createdAt,
  );
}

function reportDateKey(timestampMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestampMs));
}

function filterSeriesByPeriod(series: ChillerPoint[], period: Period): ChillerPoint[] {
  if (series.length === 0) return [];
  const latestT = series.at(-1)?.t ?? Date.now();

  if (period === "ontem") {
    const referenceDay = reportDateKey(latestT);
    return series.filter((point) => reportDateKey(point.t) === referenceDay);
  }

  const limitMs = period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return series.filter((point) => point.t >= latestT - limitMs);
}

function normalizeSeries(rows: unknown[]): ChillerPoint[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const point = row as Record<string, unknown>;
      const t = getRowTimestamp(point);
      if (t === null) return null;
      return { ...normalizeRecordKeys(point), t } as ChillerPoint;
    })
    .filter((point): point is ChillerPoint => point !== null)
    .sort((a, b) => a.t - b.t);
}

export type RawTimedRow = Record<string, unknown> & { t: number };

function normalizeTimedRows(rows: unknown[]): RawTimedRow[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const point = row as Record<string, unknown>;
      const t = getRowTimestamp(point);
      if (t === null) return null;
      return { ...normalizeRecordKeys(point), t } as RawTimedRow;
    })
    .filter((point): point is RawTimedRow => point !== null)
    .sort((a, b) => a.t - b.t);
}

function filterRowsByPeriod<T extends { t: number }>(rows: T[], period: Period): T[] {
  if (rows.length === 0) return [];
  const latestT = rows.at(-1)?.t ?? Date.now();

  if (period === "ontem") {
    const referenceDay = reportDateKey(latestT);
    return rows.filter((point) => reportDateKey(point.t) === referenceDay);
  }

  const limitMs = period === "30d" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return rows.filter((point) => point.t >= latestT - limitMs);
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function trendLast6h(rows: RawTimedRow[], key: string): number | undefined {
  if (rows.length === 0) return undefined;
  const latestT = rows.at(-1)?.t ?? Date.now();
  const sixHours = 6 * 60 * 60 * 1000;
  const recent = rows
    .filter((row) => row.t > latestT - sixHours)
    .map((row) => toNum(row[key]))
    .filter((value): value is number => value !== null && value > 0);
  const previous = rows
    .filter((row) => row.t <= latestT - sixHours && row.t > latestT - 2 * sixHours)
    .map((row) => toNum(row[key]))
    .filter((value): value is number => value !== null && value > 0);

  const recentAvg = avg(recent);
  const previousAvg = avg(previous);
  if (recentAvg === null || previousAvg === null) return undefined;
  return recentAvg - previousAvg;
}

function mapVavs(rows: RawTimedRow[]): VavReading[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: VavReading[] = [];

  for (let i = 30; i <= 52; i++) {
    const key = `vav_${i}`;
    const values = rows
      .map((row) => toNum(row[key]))
      .filter((value): value is number => value !== null && value > 0);

    if (values.length === 0) continue;

    out.push({
      id: key,
      floor: vavFloor(i),
      temp: avg(values) ?? values.at(-1) ?? 0,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      trend: trendLast6h(rows, key),
    });
  }

  return out;
}

function mapCo2(rows: RawTimedRow[]): Co2Reading[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: Co2Reading[] = [];

  for (let i = 1; i <= 8; i++) {
    const key = `co2_${i}`;
    const values = rows
      .map((row) => toNum(row[key]))
      .filter((value): value is number => value !== null && value > 0);

    if (values.length === 0) continue;

    out.push({
      id: key,
      ppm: avg(values) ?? values.at(-1) ?? 0,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      trend: trendLast6h(rows, key),
    });
  }

  return out;
}

function periodDays(period: Period): number {
  if (period === "30d") return 30;
  if (period === "7d") return 7;
  return 1;
}

function round(value: number | null, digits = 2): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function isChillerOn(point: Record<string, unknown>, ur: 1 | 2 | 3): boolean {
  const kw = toNum(point[`kw_ur${ur}`]);
  return kw !== null && kw > 10;
}

function calcTrValue(point: Record<string, unknown>, ur: 1 | 2 | 3): number | null {
  if (!isChillerOn(point, ur)) return null;

  const tr = toNum(point[`tr_ur${ur}`]);
  if (tr !== null && tr > 0) return tr;

  const kw = toNum(point[`kw_ur${ur}`]);
  const kwtr = toNum(point[`kwtr_ur${ur}`]);
  if (kw !== null && kw > 10 && kwtr !== null && kwtr > 0) return kw / kwtr;

  return null;
}

function scoreEficiencia(kwTr: number | null): number | null {
  if (kwTr === null) return null;
  if (kwTr <= 0.88) return 100;
  if (kwTr <= 0.924) return 80;
  if (kwTr <= 1.012) return 60;
  if (kwTr <= 1.144) return 40;
  return 20;
}

function scoreConforto(pct: number | null): number | null {
  if (pct === null) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function scoreCo2(acima900: number): number {
  if (acima900 === 0) return 100;
  if (acima900 <= 5) return 80;
  if (acima900 <= 15) return 60;
  if (acima900 <= 40) return 40;
  return 20;
}

function scoreGeral(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}

function classificarScore(score: number | null): string {
  if (score === null) return "sem_dados";
  if (score >= 85) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 55) return "atencao";
  return "critico";
}

function dateKeyUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function severityFromPercent(percent: number | null): string {
  if (percent === null) return "sem_dados";
  if (percent >= 80) return "critico";
  if (percent >= 50) return "alto";
  if (percent >= 25) return "moderado";
  if (percent > 0) return "baixo";
  return "normal";
}

function hourKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const h = d.getUTCHours();
  return `${String(h).padStart(2, "0")}:00-${String((h + 1) % 24).padStart(2, "0")}:00`;
}

function inOperationalWindow(timestampMs: number): boolean {
  // Os reports do WebCTRL chegam normalizados como UTC no parser atual.
  // Mantemos a mesma janela usada no relatório mensal: 11h às 22h.
  const h = new Date(timestampMs).getUTCHours();
  return h >= 11 && h <= 22;
}

function buildVavAnalyticsFromRows(rows: RawTimedRow[]) {
  const stats = new Map<string, { values: number[]; critical: number; comfort: number; total: number }>();
  const daily = new Map<string, { total: number; comfort: number; critical: number }>();
  const hourCritical = new Map<string, number>();

  for (const row of rows) {
    if (!inOperationalWindow(row.t)) continue;
    const day = dateKeyUtc(row.t);
    const dayStats = daily.get(day) ?? { total: 0, comfort: 0, critical: 0 };

    for (const key of Object.keys(row)) {
      const sensor = normalizeKey(key);
      if (!sensor.startsWith("vav_")) continue;
      const value = toNum(row[key]);
      if (value === null || value <= 0) continue;

      const current = stats.get(sensor) ?? { values: [], critical: 0, comfort: 0, total: 0 };
      current.values.push(value);
      current.total += 1;
      dayStats.total += 1;

      if (value >= 23 && value <= 24.5) {
        current.comfort += 1;
        dayStats.comfort += 1;
      }

      if (value < 23 || value > 25) {
        current.critical += 1;
        dayStats.critical += 1;
        const hour = hourKey(row.t);
        hourCritical.set(hour, (hourCritical.get(hour) ?? 0) + 1);
      }

      stats.set(sensor, current);
    }

    if (dayStats.total > 0) daily.set(day, dayStats);
  }

  const totalReadings = [...stats.values()].reduce((sum, s) => sum + s.total, 0);
  const comfortReadings = [...stats.values()].reduce((sum, s) => sum + s.comfort, 0);
  const criticalReadings = [...stats.values()].reduce((sum, s) => sum + s.critical, 0);
  const comfortPct = totalReadings ? (comfortReadings / totalReadings) * 100 : null;

  const allSensors = [...stats.entries()].map(([sensor, s]) => {
    const pct = s.total ? (s.critical / s.total) * 100 : 0;
    return {
      sensor,
      media: round(avg(s.values), 1),
      min: round(Math.min(...s.values), 1),
      max: round(Math.max(...s.values), 1),
      maxRegistrado: round(Math.max(...s.values), 1),
      leituras: s.total,
      leiturasCriticas: s.critical,
      pontosCriticos: s.critical,
      percentualCritico: round(pct, 1),
      severidade: severityFromPercent(pct),
    };
  });

  return {
    percentual: round(comfortPct, 1),
    leituras: totalReadings,
    leiturasCriticas: criticalReadings,
    // Para o mapa, mantemos também sensores normais. O ranking visual limita/ordena no componente.
    vavsCriticos: allSensors
      .sort((a, b) => (b.leiturasCriticas - a.leiturasCriticas) || ((b.percentualCritico ?? 0) - (a.percentualCritico ?? 0))),
    serieDiaria: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, s]) => ({
      data,
      percentualConforto: s.total ? round((s.comfort / s.total) * 100, 1) : null,
      leituras: s.total,
      leiturasCriticas: s.critical,
    })),
    horariosCriticos: [...hourCritical.entries()]
      .map(([faixa, leiturasCriticas]) => ({ faixa, leiturasCriticas }))
      .sort((a, b) => b.leiturasCriticas - a.leiturasCriticas)
      .slice(0, 3),
  };
}

function buildCo2AnalyticsFromRows(rows: RawTimedRow[]) {
  const stats = new Map<string, { values: number[]; high: number; total: number }>();
  const daily = new Map<string, { values: number[]; high: number; total: number }>();

  for (const row of rows) {
    if (!inOperationalWindow(row.t)) continue;
    const day = dateKeyUtc(row.t);
    const dayStats = daily.get(day) ?? { values: [], high: 0, total: 0 };

    for (const key of Object.keys(row)) {
      const sensor = normalizeKey(key);
      if (!sensor.startsWith("co2_")) continue;
      const value = toNum(row[key]);
      if (value === null || value <= 0) continue;

      const current = stats.get(sensor) ?? { values: [], high: 0, total: 0 };
      current.values.push(value);
      current.total += 1;
      dayStats.values.push(value);
      dayStats.total += 1;

      if (value > 900) {
        current.high += 1;
        dayStats.high += 1;
      }

      stats.set(sensor, current);
    }

    if (dayStats.total > 0) daily.set(day, dayStats);
  }

  const allValues = [...stats.values()].flatMap((s) => s.values);
  const highTotal = [...stats.values()].reduce((sum, s) => sum + s.high, 0);
  const total = [...stats.values()].reduce((sum, s) => sum + s.total, 0);

  return {
    co2Medio: round(avg(allValues), 0),
    co2Maximo: allValues.length ? round(Math.max(...allValues), 0) : null,
    leituras: total,
    leiturasAcima900: highTotal,
    conformidadePercentual: total ? round(((total - highTotal) / total) * 100, 1) : null,
    sensoresCriticos: [...stats.entries()]
      .map(([sensor, s]) => ({
        sensor,
        media: round(avg(s.values), 0),
        max: s.values.length ? round(Math.max(...s.values), 0) : null,
        leiturasAcima900: s.high,
        severidade: s.high >= 20 ? "critico" : s.high >= 10 ? "alto" : s.high >= 5 ? "moderado" : s.high > 0 ? "baixo" : "normal",
      }))
      .filter((s) => s.leiturasAcima900 > 0)
      .sort((a, b) => b.leiturasAcima900 - a.leiturasAcima900),
    serieDiaria: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, s]) => ({
      data,
      media: round(avg(s.values), 0),
      max: s.values.length ? round(Math.max(...s.values), 0) : null,
      leituras: s.total,
      leiturasAcima900: s.high,
    })),
  };
}

function buildFallbackAnalytics(series: ChillerPoint[], vavs: VavReading[], co2: Co2Reading[], vavRows: RawTimedRow[] = [], co2Rows: RawTimedRow[] = []): DashboardAnalytics {
  const activeRows = series.filter((p) => ([1, 2, 3] as const).some((ur) => isChillerOn(p as unknown as Record<string, unknown>, ur)));
  const kwtrValues = activeRows.map((p) => toNum((p as unknown as Record<string, unknown>).kw_tr_cag)).filter((v): v is number => v !== null && v > 0);
  const kwTrMedio = round(avg(kwtrValues), 2);

  const powerTotals = series.map((p) => [p.kw_ur1, p.kw_ur2, p.kw_ur3].map(toNum).filter((v): v is number => v !== null && v > 10).reduce((sum, value) => sum + value, 0)).filter((v) => v > 0);
  const trTotals = series.map((p) => ([1, 2, 3] as const).map((ur) => calcTrValue(p as unknown as Record<string, unknown>, ur)).filter((v): v is number => v !== null && v > 0).reduce((sum, value) => sum + value, 0)).filter((v) => v > 0);
  const intervalH = 0.25;

  const energiaTotalKwh = powerTotals.reduce((sum, value) => sum + value * intervalH, 0);
  const trhTotal = trTotals.reduce((sum, value) => sum + value * intervalH, 0);
  const fator = 0.0385;
  const kgCo2e = energiaTotalKwh * fator;

  const vavAnalytics = vavRows.length ? buildVavAnalyticsFromRows(vavRows) : null;
  const co2Analytics = co2Rows.length ? buildCo2AnalyticsFromRows(co2Rows) : null;

  const validVavs = vavs.filter((v) => toNum(v.temp) !== null && v.temp > 0);
  const comfortCount = validVavs.filter((v) => v.temp >= 23 && v.temp <= 24.5).length;
  const fallbackConfortoPct = validVavs.length ? (comfortCount / validVavs.length) * 100 : null;
  const fallbackVavsCriticos = validVavs
    .map((v) => {
      const maxTemp = v.max ?? v.temp;
      const critical = v.count && (v.min !== undefined || v.max !== undefined)
        ? (maxTemp > 25 || (v.min ?? 99) < 23 ? Math.max(1, Math.round((v.count ?? 1) * 0.2)) : 0)
        : (v.temp > 25 || v.temp < 23 ? 1 : 0);
      const pct = v.count ? (critical / v.count) * 100 : critical ? 100 : 0;
      return {
        sensor: v.id,
        media: round(v.temp, 1),
        min: v.min,
        max: v.max ?? v.temp,
        maxRegistrado: v.max ?? v.temp,
        leituras: v.count ?? 1,
        leiturasCriticas: critical,
        pontosCriticos: critical,
        percentualCritico: round(pct, 1),
        severidade: severityFromPercent(pct),
      };
    });

  const validCo2 = co2.filter((s) => toNum(s.ppm) !== null && s.ppm > 0);
  const fallbackCo2Acima900 = validCo2.reduce((sum, sensor) => sum + ((sensor.max ?? sensor.ppm) > 900 ? (sensor.count ?? 1) : 0), 0);
  const fallbackSensoresCriticos = validCo2
    .filter((sensor) => sensor.ppm > 900 || (sensor.max ?? 0) > 900)
    .map((sensor) => ({
      sensor: sensor.id,
      media: Math.round(sensor.ppm),
      max: sensor.max ? Math.round(sensor.max) : Math.round(sensor.ppm),
      leiturasAcima900: sensor.count ?? 1,
      severidade: (sensor.max ?? sensor.ppm) > 1000 ? "alto" : "moderado",
    }));

  const confortoPct = vavAnalytics?.percentual ?? round(fallbackConfortoPct, 1);
  const co2Acima900 = co2Analytics?.leiturasAcima900 ?? fallbackCo2Acima900;
  const sEnergia = scoreEficiencia(kwTrMedio);
  const sConforto = scoreConforto(confortoPct ?? null);
  const sCo2 = scoreCo2(co2Acima900);
  const sGeral = scoreGeral([sEnergia, sConforto, sCo2]);

  const byDay = new Map<string, { kwtr: number[]; energia: number; trh: number }>();
  for (const p of series) {
    const key = dateKeyUtc(p.t);
    const current = byDay.get(key) ?? { kwtr: [], energia: 0, trh: 0 };
    const row = p as unknown as Record<string, unknown>;
    const hasActiveChiller = ([1, 2, 3] as const).some((ur) => isChillerOn(row, ur));
    const kwtr = toNum(row.kw_tr_cag);
    if (hasActiveChiller && kwtr !== null && kwtr > 0) current.kwtr.push(kwtr);
    const kw = [p.kw_ur1, p.kw_ur2, p.kw_ur3].map(toNum).filter((v): v is number => v !== null && v > 10).reduce((sum, value) => sum + value, 0);
    const tr = ([1, 2, 3] as const).map((ur) => calcTrValue(p as unknown as Record<string, unknown>, ur)).filter((v): v is number => v !== null && v > 0).reduce((sum, value) => sum + value, 0);
    current.energia += kw * intervalH;
    current.trh += tr * intervalH;
    byDay.set(key, current);
  }

  const serieDiaria = [...byDay.entries()].map(([data, value]) => ({
    data,
    energiaKwh: round(value.energia, 1),
    emissoesKgCo2e: round(value.energia * fator, 1),
    trh: round(value.trh, 1),
    intensidadeKwhPorTrh: value.trh > 0 ? round(value.energia / value.trh, 3) : null,
  }));

  const scoreDiario = [...byDay.entries()].map(([data, value]) => {
    const e = scoreEficiencia(round(avg(value.kwtr), 2));
    const confortoDia = (vavAnalytics?.serieDiaria as Array<Record<string, unknown>> | undefined)?.find((d) => d.data === data);
    const co2Dia = (co2Analytics?.serieDiaria as Array<Record<string, unknown>> | undefined)?.find((d) => d.data === data);
    const confortoScore = scoreConforto(toNum(confortoDia?.percentualConforto) ?? confortoPct ?? null);
    const co2Score = scoreCo2(toNum(co2Dia?.leiturasAcima900) ?? co2Acima900);
    return {
      data,
      scoreGeral: scoreGeral([e, confortoScore, co2Score]),
      scoreEficiencia: e,
      scoreConforto: confortoScore,
      scoreCo2: co2Score,
      principalProblema: confortoScore !== null && confortoScore < 60 ? "conforto térmico" : co2Score < 60 ? "qualidade do ar" : e !== null && e < 60 ? "eficiência energética" : "sem anomalias relevantes",
    };
  });

  const chiller = ([1, 2, 3] as const).map((ur) => {
    const rows = series.filter((p) => {
      const row = p as unknown as Record<string, unknown>;
      return isChillerOn(row, ur);
    });
    const horas = rows.length * intervalH;
    const kwtr = rows.map((p) => toNum((p as unknown as Record<string, unknown>)[`kwtr_ur${ur}`])).filter((v): v is number => v !== null && v > 0);
    const trValues = rows.map((p) => calcTrValue(p as unknown as Record<string, unknown>, ur)).filter((v): v is number => v !== null && v > 0);
    const avgKwtr = avg(kwtr);
    const avgTr = avg(trValues);
    const maxTr = trValues.length ? Math.max(...trValues) : null;
    const capacidadeMedia = avgTr !== null && maxTr !== null && maxTr > 0 ? (avgTr / maxTr) * 100 : null;
    const score = horas < 5 ? null : Math.max(0, Math.round(100 - (avgKwtr && avgKwtr > 0.88 ? 15 : 0)));
    return {
      ur: `UR${ur}`,
      horasValidas: round(horas, 1),
      capacidadeMedia: round(capacidadeMedia, 1),
      kwTrMedio: round(avgKwtr, 2),
      estabilidade: trValues.length > 4 ? "calculada" : "sem_dados",
      score,
      classificacao: horas < 5 ? "amostra_insuficiente" : classificarScore(score),
      amostraInsuficiente: horas < 5,
    };
  });

  const qualidadeDoAr = co2Analytics ?? {
    co2Medio: round(avg(validCo2.map((s) => s.ppm)), 0),
    co2Maximo: round(Math.max(0, ...validCo2.map((s) => s.max ?? s.ppm)), 0),
    leituras: validCo2.reduce((sum, s) => sum + (s.count ?? 1), 0),
    leiturasAcima900: fallbackCo2Acima900,
    conformidadePercentual: validCo2.length ? round(((validCo2.length - fallbackCo2Acima900) / validCo2.length) * 100, 1) : null,
    sensoresCriticos: fallbackSensoresCriticos,
    serieDiaria: [],
  };

  return {
    kpis: {
      kwTrMedio,
      metaKwTr: 0.88,
      dentroMeta: kwTrMedio !== null ? kwTrMedio <= 0.88 : null,
      confortoPercentual: confortoPct,
      co2Medio: qualidadeDoAr.co2Medio,
      co2Maximo: qualidadeDoAr.co2Maximo,
      leiturasCo2Acima900: co2Acima900,
      energiaKwh: round(energiaTotalKwh, 1),
      energiaMwh: round(energiaTotalKwh / 1000, 3),
      emissoesKgCo2e: round(kgCo2e, 1),
      emissoesTCo2e: round(kgCo2e / 1000, 3),
      intensidadeKwhPorTrh: trhTotal > 0 ? round(energiaTotalKwh / trhTotal, 3) : null,
    },
    score: { geral: sGeral, eficiencia: sEnergia, conforto: sConforto, co2: sCo2, classificacao: classificarScore(sGeral) },
    diagnostico: {
      eficiencia: kwTrMedio !== null && kwTrMedio <= 0.88 ? "dentro_da_meta" : "acima_da_meta",
      conforto: classificarScore(sConforto),
      co2: co2Acima900 > 40 ? "critico" : co2Acima900 > 0 ? "atencao" : "normal",
      prioridadePrincipal: sConforto !== null && sConforto < 60 ? "conforto térmico" : co2Acima900 > 0 ? "qualidade do ar" : "operação estável",
      horariosCriticos: vavAnalytics?.horariosCriticos ?? [],
    },
    esg: { fatorEmissaoKgCo2PorKwh: fator, energiaTotalKwh: round(energiaTotalKwh, 1), energiaTotalMwh: round(energiaTotalKwh / 1000, 3), emissoesKgCo2e: round(kgCo2e, 1), emissoesTCo2e: round(kgCo2e / 1000, 3), trhTotal: round(trhTotal, 1), intensidadeKwhPorTrh: trhTotal > 0 ? round(energiaTotalKwh / trhTotal, 3) : null, serieDiaria },
    conforto: vavAnalytics ?? { percentual: confortoPct, leituras: validVavs.reduce((sum, v) => sum + (v.count ?? 1), 0), leiturasCriticas: fallbackVavsCriticos.reduce((sum, v) => sum + (v.leiturasCriticas ?? 0), 0), vavsCriticos: fallbackVavsCriticos, serieDiaria: [] },
    qualidadeDoAr,
    eficiencia: { kwTrMedio, serieDiaria: [...byDay.entries()].map(([data, value]) => ({ data, kwTrMedio: round(avg(value.kwtr), 2), energiaKwh: round(value.energia, 1), trh: round(value.trh, 1) })) },
    chillers: chiller,
    scoreDiario,
    pioresDias: [...scoreDiario].sort((a, b) => (a.scoreGeral ?? 999) - (b.scoreGeral ?? 999)).slice(0, 5),
    qualidadeDados: { totalSeries: series.length, totalVavs: vavRows.length || vavs.length, totalCo2: co2Rows.length || co2.length, observacao: "Analytics recalculado no frontend com o período filtrado." },
  };
}


function mergeDashboardAnalytics(fallback: DashboardAnalytics, backend: DashboardAnalytics | null | undefined): DashboardAnalytics {
  if (!backend || typeof backend !== "object") return fallback;

  const backendChillers = Array.isArray(backend.chillers) ? backend.chillers : [];
  const backendCapacidade = Array.isArray(backend.capacidadeChillers) ? backend.capacidadeChillers : [];

  return {
    ...fallback,
    ...backend,
    kpis: { ...(fallback.kpis ?? {}), ...(backend.kpis ?? {}) },
    score: { ...(fallback.score ?? {}), ...(backend.score ?? {}) },
    diagnostico: { ...(fallback.diagnostico ?? {}), ...(backend.diagnostico ?? {}) },
    esg: { ...(fallback.esg ?? {}), ...(backend.esg ?? {}) },
    conforto: { ...(fallback.conforto ?? {}), ...(backend.conforto ?? {}) },
    qualidadeDoAr: { ...(fallback.qualidadeDoAr ?? {}), ...(backend.qualidadeDoAr ?? {}) },
    eficiencia: { ...(fallback.eficiencia ?? {}), ...(backend.eficiencia ?? {}) },
    qualidadeDados: { ...(fallback.qualidadeDados ?? {}), ...(backend.qualidadeDados ?? {}) },
    chillers: backendChillers.length ? backendChillers : fallback.chillers,
    capacidadeChillers: backendCapacidade.length ? backendCapacidade : fallback.capacidadeChillers,
    scoreDiario: Array.isArray(backend.scoreDiario) && backend.scoreDiario.length ? backend.scoreDiario : fallback.scoreDiario,
    pioresDias: Array.isArray(backend.pioresDias) && backend.pioresDias.length ? backend.pioresDias : fallback.pioresDias,
  };
}

async function requestRawPayload(period: Period, options: { includePeriodParams: boolean; days?: number }): Promise<RawPayload> {
  const url = new URL(ENDPOINT);

  if (options.includePeriodParams) {
    url.searchParams.set("period", period);
    url.searchParams.set("range", period);
    url.searchParams.set("periodo", period);
  }

  url.searchParams.set("days", String(options.days ?? periodDays(period)));
  url.searchParams.set("_", String(Date.now()));

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });

  if (!res.ok) throw new Error(`Falha ao buscar dados (${res.status})`);

  const json = await res.json().catch(() => ({}));
  const raw = Array.isArray(json) ? (json[0] ?? {}) : json;
  return raw.json ?? raw;
}

function rawPayloadHasRows(data: RawPayload): boolean {
  return Boolean(
    (Array.isArray(data?.series) && data.series.length > 0)
      || (Array.isArray(data?.vavs) && data.vavs.length > 0)
      || (Array.isArray(data?.co2) && data.co2.length > 0)
      || (Array.isArray(data?.cagStatus) && data.cagStatus.length > 0)
      || (Array.isArray(data?.cag_status) && data.cag_status.length > 0),
  );
}

async function loadRawPayload(period: Period): Promise<RawPayload> {
  const primary = await requestRawPayload(period, { includePeriodParams: true });

  // O webhook pode retornar vazio para 30d quando ainda não existe uma janela
  // completa de 30 dias. Nesse caso, buscamos a base sem o filtro textual de
  // período e deixamos o frontend aplicar a regra: mostrar tudo que existir
  // dentro dos últimos 30 dias relativos ao último timestamp disponível.
  if (rawPayloadHasRows(primary)) return primary;

  if (period === "30d" || period === "7d") {
    const fallback = await requestRawPayload(period, { includePeriodParams: false, days: periodDays(period) });
    if (rawPayloadHasRows(fallback)) return fallback;
  }

  return primary;
}

async function fetchCagData(period: Period): Promise<CagPayload> {
  const data = await loadRawPayload(period);

  const allSeries = normalizeSeries(Array.isArray(data?.series) ? data.series : []);
  const filteredSeries = filterSeriesByPeriod(allSeries, period);

  const allVavRows = normalizeTimedRows(Array.isArray(data?.vavs) ? data.vavs : []);
  const filteredVavRows = filterRowsByPeriod(allVavRows, period);
  const vavs = mapVavs(filteredVavRows);

  const allCo2Rows = normalizeTimedRows(Array.isArray(data?.co2) ? data.co2 : []);
  const filteredCo2Rows = filterRowsByPeriod(allCo2Rows, period);
  const co2 = mapCo2(filteredCo2Rows);

  const rawCagStatus = Array.isArray(data?.cagStatus)
    ? data.cagStatus
    : Array.isArray(data?.cag_status)
      ? data.cag_status
      : [];
  const allCagStatus = normalizeTimedRows(rawCagStatus);
  const cagStatus = filterRowsByPeriod(allCagStatus, period);

  const analytics = buildFallbackAnalytics(filteredSeries, vavs, co2, filteredVavRows, filteredCo2Rows);

  return {
    series: filteredSeries,
    vavs,
    co2,
    cagStatus,
    analytics,
    meta: data?.meta ?? null,
  };
}

export function useCagData(period: Period) {
  const query = useQuery({
    queryKey: ["cag-data", period],
    queryFn: () => fetchCagData(period),
    refetchOnWindowFocus: false,
  });

  const data = query.data ?? {
    series: [],
    vavs: [],
    co2: [],
    cagStatus: [],
    analytics: null,
    meta: null,
  };

  return {
    series: data.series ?? [],
    vavs: data.vavs ?? [],
    co2: data.co2 ?? [],
    cagStatus: data.cagStatus ?? [],
    analytics: data.analytics ?? null,
    meta: data.meta ?? null,
    lastUpdate: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : new Date(),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}
