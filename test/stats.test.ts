import { describe, it, expect } from "vitest";
import { percentile, median, describe as summarise, countBy } from "../src/core/stats.js";

describe("percentile", () => {
  it("interpolates between neighbours", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3], 0.5)).toBe(2);
  });

  it("clamps at the extremes", () => {
    expect(percentile([5, 1, 9], 0)).toBe(1);
    expect(percentile([5, 1, 9], 1)).toBe(9);
  });

  it("returns null for an empty sample", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(median([])).toBeNull();
  });

  it("does not mutate the caller's array", () => {
    const values = [3, 1, 2];
    percentile(values, 0.5);
    expect(values).toEqual([3, 1, 2]);
  });

  it("resists the skew that a single Palm Jumeirah sale would create in a mean", () => {
    const values = [1_000_000, 1_100_000, 1_200_000, 900_000_000];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(median(values)).toBeLessThan(2_000_000);
    expect(mean).toBeGreaterThan(200_000_000);
  });
});

describe("describe", () => {
  it("summarises a distribution", () => {
    const result = summarise([1, 2, 3, 4, 5]);
    expect(result).toMatchObject({ count: 5, min: 1, median: 3, max: 5 });
  });

  it("drops non-finite values", () => {
    expect(summarise([1, Number.NaN, Number.POSITIVE_INFINITY, 3]).count).toBe(2);
  });

  it("returns an empty summary rather than throwing", () => {
    expect(summarise([])).toEqual({ count: 0, min: null, p25: null, median: null, p75: null, max: null });
  });
});

describe("countBy", () => {
  it("counts and skips nulls", () => {
    expect(countBy([{ r: "a" }, { r: "a" }, { r: null }], (x) => x.r)).toEqual({ a: 2 });
  });
});
