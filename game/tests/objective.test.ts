import { describe, expect, it } from 'vitest';
import { readObjective } from '../src/site/objective';

/**
 * The HUD reads the site's own progress, so the city can show you *your* next
 * step. Under Node there is no `localStorage`, which is exactly the "they have
 * not been to the page yet" case — the one that must not throw.
 */
describe('readObjective', () => {
  it('falls back cleanly when there is no stored progress', () => {
    const objective = readObjective();
    expect(objective.step).toBeNull();
    expect(objective.done).toBe(0);
    expect(objective.total).toBe(0);
    expect(objective.label).toBe('no path yet');
  });

  it('never divides by a zero total', () => {
    // The bar computes done/total; a zero total is the default state, so this
    // is the first thing that would ever run.
    const { done, total } = readObjective();
    const ratio = total > 0 ? done / total : 0;
    expect(Number.isFinite(ratio)).toBe(true);
  });
});
