// Realistic mock data generator for CAG (Central de Água Gelada) - Rio Design Barra
// Simulates n8n -> Redis -> API payloads.

export type Period = "ontem" | "7d" | "30d";

export interface ChillerPoint {
  t: number; // timestamp ms
  kw_ur1: number; kw_ur2: number; kw_ur3: number;
  kwtr_ur1: number; kwtr_ur2: number; kwtr_ur3: number;
  tr_ur1: number; tr_ur2: number; tr_ur3: number;
  ewt_ur1: number; lwt_ur1: number;
  ewt_ur2: number; lwt_ur2: number;
  ewt_ur3: number; lwt_ur3: number;
  ect_ur1: number; lct_ur1: number;
  ect_ur2: number; lct_ur2: number;
  ect_ur3: number; lct_ur3: number;
  kw_tr_cag: number;
  oat: number;
}

export interface VavReading { id: string; floor: string; temp: number; min?: number; max?: number; count?: number; trend?: number; }
export interface Co2Reading { id: string; ppm: number; min?: number; max?: number; count?: number; trend?: number; }

// Seedable PRNG so charts stay stable per render cycle
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function periodConfig(period: Period) {
  switch (period) {
    case "ontem": return { points: 96, stepMs: 15 * 60 * 1000 };     // Ontem, 15min
    case "7d":  return { points: 168, stepMs: 60 * 60 * 1000 };      // 1h
    case "30d": return { points: 180, stepMs: 4 * 60 * 60 * 1000 };  // 4h
  }
}

export function generateSeries(period: Period, seed = 42): ChillerPoint[] {
  const { points, stepMs } = periodConfig(period);
  const rand = mulberry32(seed);
  const now = Date.now();
  const out: ChillerPoint[] = [];

  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const d = new Date(t);
    const hour = d.getHours() + d.getMinutes() / 60;
    // Daily occupancy curve (peak ~14h)
    const occ = Math.max(0, Math.sin(((hour - 6) / 14) * Math.PI));
    // Outdoor temp daily curve 22-34°C
    const oat = 24 + 8 * Math.max(0, Math.sin(((hour - 7) / 13) * Math.PI)) + (rand() - 0.5) * 1.5;

    const load = 0.35 + occ * 0.65 + (rand() - 0.5) * 0.08;
    const ur1On = load > 0.25;
    const ur2On = load > 0.5;
    const ur3On = load > 0.75;

    const kw_ur1 = ur1On ? 180 + load * 220 + (rand() - 0.5) * 18 : 2;
    const kw_ur2 = ur2On ? 170 + load * 230 + (rand() - 0.5) * 20 : 2;
    const kw_ur3 = ur3On ? 175 + load * 225 + (rand() - 0.5) * 22 : 2;

    const tr_ur1 = ur1On ? 120 + load * 200 + (rand() - 0.5) * 12 : 0;
    const tr_ur2 = ur2On ? 115 + load * 210 + (rand() - 0.5) * 12 : 0;
    const tr_ur3 = ur3On ? 118 + load * 205 + (rand() - 0.5) * 12 : 0;

    const eff = (oatV: number) => 0.55 + (oatV - 24) * 0.025 + (rand() - 0.5) * 0.06;
    const kwtr_ur1 = ur1On ? Math.max(0.4, Math.min(1.4, eff(oat))) : 0;
    const kwtr_ur2 = ur2On ? Math.max(0.4, Math.min(1.4, eff(oat) + 0.04)) : 0;
    const kwtr_ur3 = ur3On ? Math.max(0.4, Math.min(1.4, eff(oat) + 0.07)) : 0;

    const ewt_ur1 = 11.5 + (rand() - 0.5) * 0.4;
    const lwt_ur1 = 6.7 + (rand() - 0.5) * 0.3;
    const ewt_ur2 = 11.6 + (rand() - 0.5) * 0.4;
    const lwt_ur2 = 6.8 + (rand() - 0.5) * 0.3;
    const ewt_ur3 = 11.7 + (rand() - 0.5) * 0.4;
    const lwt_ur3 = 6.9 + (rand() - 0.5) * 0.3;

    const ect_ur1 = oat + 4 + (rand() - 0.5) * 0.6;
    const lct_ur1 = ect_ur1 + 4.5 + (rand() - 0.5) * 0.5;
    const ect_ur2 = oat + 4.1 + (rand() - 0.5) * 0.6;
    const lct_ur2 = ect_ur2 + 4.6 + (rand() - 0.5) * 0.5;
    const ect_ur3 = oat + 4.2 + (rand() - 0.5) * 0.6;
    const lct_ur3 = ect_ur3 + 4.7 + (rand() - 0.5) * 0.5;

    const totalKw = (ur1On ? kw_ur1 : 0) + (ur2On ? kw_ur2 : 0) + (ur3On ? kw_ur3 : 0);
    const totalTr = tr_ur1 + tr_ur2 + tr_ur3;
    const kw_tr_cag = totalTr > 0 ? totalKw / totalTr : 0;

    out.push({
      t,
      kw_ur1, kw_ur2, kw_ur3,
      kwtr_ur1, kwtr_ur2, kwtr_ur3,
      tr_ur1, tr_ur2, tr_ur3,
      ewt_ur1, lwt_ur1, ewt_ur2, lwt_ur2, ewt_ur3, lwt_ur3,
      ect_ur1, lct_ur1, ect_ur2, lct_ur2, ect_ur3, lct_ur3,
      kw_tr_cag,
      oat,
    });
  }
  return out;
}

export function generateVavs(seed = 7): VavReading[] {
  const rand = mulberry32(seed);
  const arr: VavReading[] = [];
  const make = (start: number, end: number, floor: string) => {
    for (let i = start; i <= end; i++) {
      arr.push({
        id: `vav-${i}`,
        floor,
        temp: 22 + rand() * 4.5,
      });
    }
  };
  make(30, 40, "Térreo");
  make(41, 46, "2º Pavimento");
  make(47, 52, "3º Pavimento");
  return arr;
}

export function generateCo2(seed = 11): Co2Reading[] {
  const rand = mulberry32(seed);
  return Array.from({ length: 8 }, (_, i) => ({
    id: `co2-${i + 1}`,
    ppm: 420 + rand() * 600,
  }));
}
