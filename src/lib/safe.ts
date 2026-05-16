// Defensive helpers — never let missing/NaN/undefined break renders.
export const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export const num = (v: unknown, fallback: number | null = null): number | null =>
  isNum(v) ? v : fallback;

export const numOr = (v: unknown, fallback: number): number =>
  isNum(v) ? v : fallback;

export const arr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

export const avgSafe = (values: Array<number | null | undefined>): number | null => {
  const f = values.filter(isNum);
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
};

export const fmt = (v: number | null | undefined, digits = 2, fallback = "—"): string =>
  isNum(v) ? v.toFixed(digits) : fallback;

export const hasData = <T,>(v: T[] | undefined | null): boolean => Array.isArray(v) && v.length > 0;
