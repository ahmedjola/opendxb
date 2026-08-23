/**
 * What the player should do next, read off the site's own stored progress.
 *
 * Deliberately free of any Phaser import. This is a question about the reader's
 * journey, not about rendering — and keeping it out of the scene module means
 * it can be tested without booting a game engine.
 */
import { getPath, normalizeCompleted, stepStates, type JourneyStep } from './journey';
import { browserStorage, readProgress } from './progress';

export interface Objective {
  /** What to do next, or null when there is nothing to show. */
  step: JourneyStep | null;
  /** How far through the path they are. */
  done: number;
  total: number;
  /** Which path they picked on the site, for the panel's subtitle. */
  label: string;
}

/**
 * Read the player's real progress.
 *
 * Anything missing — no storage, nothing picked yet, a corrupted value — is a
 * legitimate state rather than an error: they simply have not been to the page.
 * The caller shows an invitation to pick a path instead.
 */
export function readObjective(): Objective {
  const progress = readProgress(browserStorage());
  if (!progress.status) return { step: null, done: 0, total: 0, label: 'no path yet' };

  const path = getPath(progress.status);
  const completed = normalizeCompleted(path, progress.completed[progress.status] ?? []);
  const index = stepStates(path, completed).indexOf('current');
  return {
    step: index >= 0 ? (path.steps[index] ?? null) : null,
    done: completed.length,
    total: path.steps.length,
    label: path.labelEn,
  };
}
