import { describe, expect, it } from 'vitest';
import { PAL, TILE, fillGrid, rect, rng, row, set } from '../src/scenes/pixels';

/**
 * The pixel helpers are the foundation every sprite is drawn on. A silent
 * off-by-one here shows up as art that is subtly wrong everywhere at once, so
 * the primitives are pinned down directly.
 */
describe('grid primitives', () => {
  it('builds a rectangular grid at the tile size', () => {
    const g = fillGrid('b');
    expect(g).toHaveLength(TILE);
    expect(new Set(g.map((r) => r.length))).toEqual(new Set([TILE]));
  });

  it('writes a single pixel without changing the row length', () => {
    const g = fillGrid('.', 5, 2);
    set(g, 2, 0, 'a');
    expect(g[0]).toBe('..a..');
    expect(g[1]).toBe('.....');
  });

  it('ignores writes outside the grid rather than corrupting it', () => {
    // Sprite maths goes out of bounds constantly — a stepped disc, a tuft near
    // an edge. Silently clipping is correct; growing the row is not.
    const g = fillGrid('.', 4, 2);
    set(g, -1, 0, 'a');
    set(g, 9, 0, 'a');
    set(g, 0, 7, 'a');
    expect(g).toEqual(['....', '....']);
  });

  it('draws runs and rectangles at the stated size', () => {
    const g = fillGrid('.', 6, 3);
    row(g, 1, 0, 3, 'x');
    expect(g[0]).toBe('.xxx..');

    rect(g, 2, 1, 3, 2, 'y');
    expect(g[1]).toBe('..yyy.');
    expect(g[2]).toBe('..yyy.');
  });

  it('clips a run at the right-hand edge', () => {
    const g = fillGrid('.', 4, 1);
    row(g, 2, 0, 10, 'x');
    expect(g[0]).toBe('..xx');
  });
});

describe('palette', () => {
  it('maps "." to transparent and everything else to a colour', () => {
    expect(PAL['.']).toBeNull();
    for (const [key, value] of Object.entries(PAL)) {
      if (key === '.') continue;
      expect(typeof value, `palette key "${key}"`).toBe('number');
      expect(value as number).toBeGreaterThanOrEqual(0);
      expect(value as number).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('has no duplicate colours', () => {
    // Two keys with the same value means a ramp step that does nothing, which
    // reads as a flat fill — the exact thing this palette exists to avoid.
    const colours = Object.entries(PAL)
      .filter(([key]) => key !== '.')
      .map(([, value]) => value);
    expect(new Set(colours).size).toBe(colours.length);
  });
});

describe('rng', () => {
  it('is deterministic, so ground detail does not reshuffle on reload', () => {
    const a = Array.from({ length: 8 }, rng(42));
    const b = Array.from({ length: 8 }, rng(42));
    expect(a).toEqual(b);
  });

  it('gives different streams for different seeds', () => {
    expect(Array.from({ length: 4 }, rng(1))).not.toEqual(Array.from({ length: 4 }, rng(2)));
  });

  it('stays inside [0, 1)', () => {
    const next = rng(7);
    for (let i = 0; i < 200; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
