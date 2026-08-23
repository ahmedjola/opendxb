/** Descriptive statistics used by the community profile. */

/**
 * Linear-interpolated percentile over an unsorted sample.
 *
 * Dubai property values are heavily skewed — a handful of penthouse sales sit
 * three orders of magnitude above the median — so the profile reports medians
 * and quartiles rather than means, which a single Palm Jumeirah transaction
 * would otherwise dominate.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p <= 0) return Math.min(...values);
  if (p >= 1) return Math.max(...values);

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function median(values: readonly number[]): number | null {
  return percentile(values, 0.5);
}

export interface Distribution {
  readonly count: number;
  readonly min: number | null;
  readonly p25: number | null;
  readonly median: number | null;
  readonly p75: number | null;
  readonly max: number | null;
}

export function describe(values: readonly number[]): Distribution {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return { count: 0, min: null, p25: null, median: null, p75: null, max: null };
  }
  return {
    count: finite.length,
    min: Math.min(...finite),
    p25: percentile(finite, 0.25),
    median: percentile(finite, 0.5),
    p75: percentile(finite, 0.75),
    max: Math.max(...finite),
  };
}

/** Count occurrences of each key. */
export function countBy<T>(items: readonly T[], key: (item: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    if (value === null) continue;
    out[value] = (out[value] ?? 0) + 1;
  }
  return out;
}
