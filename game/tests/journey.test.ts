import { afterEach, describe, expect, it } from 'vitest';
import { ANSWERS, getAnswerById, hasRealSource } from '../src/content/loader';
import {
  PATHS,
  STATUS_IDS,
  answersForStep,
  blockedRange,
  currentStepIndex,
  getPath,
  isStatusId,
  isUnlocked,
  markComplete,
  markIncomplete,
  normalizeCompleted,
  progressPercent,
  referencedAnswerIds,
  resetPath,
  stepStates,
  toggleStep,
} from '../src/site/journey';
import {
  STORAGE_KEY,
  browserStorage,
  clearProgress,
  defaultProgress,
  parseProgress,
  readProgress,
  serializeProgress,
  writeProgress,
  type Progress,
  type StorageLike,
} from '../src/site/progress';

const MOVING = getPath('moving');

/** An in-memory stand-in for localStorage. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** A storage that throws on every call — a private window, or blocked site data. */
function throwingStorage(): StorageLike {
  return {
    getItem() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    setItem() {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    },
    removeItem() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  };
}

describe('journey shape', () => {
  it('gives the "moving here" path exactly nine steps, in the documented order', () => {
    expect(MOVING.steps.map((step) => step.id)).toEqual([
      'arrival',
      'medical',
      'residence-visa',
      'emirates-id',
      'home-ejari',
      'dewa',
      'health-insurance',
      'bank-account',
      'driving-licence',
    ]);
    expect(MOVING.steps).toHaveLength(9);
    expect(MOVING.sequential).toBe(true);
  });

  it('keeps step ids unique inside every path', () => {
    for (const status of STATUS_IDS) {
      const ids = PATHS[status].steps.map((step) => step.id);
      expect(new Set(ids).size, `${status} has duplicate step ids`).toBe(ids.length);
    }
  });

  it('gives visiting and resident their own shorter, non-sequential paths', () => {
    for (const status of ['visiting', 'resident'] as const) {
      const path = getPath(status);
      expect(path.steps.length, `${status} path is empty`).toBeGreaterThan(0);
      expect(path.steps.length, `${status} path is not shorter`).toBeLessThan(
        MOVING.steps.length,
      );
      // Nothing is locked on these — those questions are not prerequisites.
      expect(path.sequential).toBe(false);
      expect(stepStates(path, resetPath(path))).not.toContain('locked');
    }
  });

  it('resolves every referenced answer id and never invents one', () => {
    for (const id of referencedAnswerIds()) {
      expect(getAnswerById(id), `path references unknown answer "${id}"`).toBeDefined();
    }
    for (const status of STATUS_IDS) {
      for (const step of PATHS[status].steps) {
        expect(
          answersForStep(step).length,
          `step "${step.id}" points at no real answer`,
        ).toBeGreaterThan(0);
        expect(answersForStep(step).length).toBe(step.answerIds.length);
      }
    }
  });
});

describe('every displayed answer carries its source', () => {
  it('has a real https source and an ISO checked date on every answer a step shows', () => {
    for (const status of STATUS_IDS) {
      for (const step of PATHS[status].steps) {
        for (const answer of answersForStep(step)) {
          expect(hasRealSource(answer), `"${answer.id}" would render without a source`).toBe(true);
          expect(answer.sourceUrl.startsWith('https://')).toBe(true);
          expect(answer.sourceEntity.trim()).not.toBe('');
          expect(answer.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it('leaves no answer in the content file unreachable from the site', () => {
    // Answers not on your path are shown in the "other questions" section, so
    // every entry must be renderable — and renderable means sourced.
    for (const answer of ANSWERS) {
      expect(hasRealSource(answer), `"${answer.id}" cannot be displayed`).toBe(true);
    }
  });
});

describe('dependency locking', () => {
  it('starts you at the medical test with steps 3 to 9 locked', () => {
    const completed = resetPath(MOVING);
    expect(completed).toEqual(['arrival']);
    expect(stepStates(MOVING, completed)).toEqual([
      'complete',
      'current',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(currentStepIndex(MOVING, completed)).toBe(1);
    expect(blockedRange(MOVING, completed)).toEqual({ from: 3, to: 9 });
  });

  it('refuses to complete a locked step', () => {
    const completed = resetPath(MOVING);
    expect(isUnlocked(MOVING, completed, 'emirates-id')).toBe(false);
    expect(markComplete(MOVING, completed, 'emirates-id')).toEqual(['arrival']);
    expect(toggleStep(MOVING, completed, 'dewa')).toEqual(['arrival']);
  });

  it('unlocks exactly one more step each time the current step is completed', () => {
    let completed = resetPath(MOVING);
    completed = markComplete(MOVING, completed, 'medical');
    expect(completed).toEqual(['arrival', 'medical']);

    const states = stepStates(MOVING, completed);
    expect(states[1]).toBe('complete');
    expect(states[2]).toBe('current');
    expect(states[3]).toBe('locked');
    expect(isUnlocked(MOVING, completed, 'residence-visa')).toBe(true);
    expect(isUnlocked(MOVING, completed, 'emirates-id')).toBe(false);
    expect(blockedRange(MOVING, completed)).toEqual({ from: 4, to: 9 });
  });

  it('walks the whole path and then reports nothing left blocked', () => {
    let completed = resetPath(MOVING);
    for (const step of MOVING.steps) {
      completed = markComplete(MOVING, completed, step.id);
    }
    expect(completed).toHaveLength(9);
    expect(stepStates(MOVING, completed).every((state) => state === 'complete')).toBe(true);
    expect(currentStepIndex(MOVING, completed)).toBe(-1);
    expect(blockedRange(MOVING, completed)).toBeNull();
    expect(progressPercent(MOVING, completed)).toBe(100);
  });

  it('un-ticking a step re-locks everything after it', () => {
    let completed = resetPath(MOVING);
    completed = markComplete(MOVING, completed, 'medical');
    completed = markComplete(MOVING, completed, 'residence-visa');
    completed = markComplete(MOVING, completed, 'emirates-id');
    expect(completed).toHaveLength(4);

    completed = markIncomplete(MOVING, completed, 'residence-visa');
    expect(completed).toEqual(['arrival', 'medical']);
    expect(stepStates(MOVING, completed)[3]).toBe('locked');
  });

  it('normalises impossible saved states instead of trusting them', () => {
    // A hand-edited localStorage value claiming step 9 without steps 2-8.
    expect(normalizeCompleted(MOVING, ['arrival', 'driving-licence'])).toEqual(['arrival']);
    // Unknown ids are dropped.
    expect(normalizeCompleted(MOVING, ['arrival', 'not-a-step', 'medical'])).toEqual([
      'arrival',
      'medical',
    ]);
    // Order follows the path, not the saved array.
    expect(normalizeCompleted(MOVING, ['medical', 'arrival'])).toEqual(['arrival', 'medical']);
    // Nothing complete at all still renders: step 1 becomes current.
    expect(stepStates(MOVING, [])[0]).toBe('current');
    expect(stepStates(MOVING, [])[1]).toBe('locked');
  });

  it('treats a non-sequential path as a checklist, in any order', () => {
    const resident = getPath('resident');
    const completed = markComplete(resident, [], 'r-schools');
    expect(completed).toEqual(['r-schools']);
    const states = stepStates(resident, completed);
    expect(states).not.toContain('locked');
    expect(states[0]).toBe('current');
    expect(states.filter((state) => state === 'complete')).toHaveLength(1);
  });
});

describe('status selection', () => {
  it('recognises exactly the three statuses', () => {
    expect(STATUS_IDS).toEqual(['visiting', 'moving', 'resident']);
    for (const status of STATUS_IDS) {
      expect(isStatusId(status)).toBe(true);
      expect(getPath(status).status).toBe(status);
      expect(getPath(status).labelAr.trim()).not.toBe('');
    }
    expect(isStatusId('tourist')).toBe(false);
    expect(isStatusId(undefined)).toBe(false);
    expect(isStatusId(null)).toBe(false);
    expect(isStatusId(3)).toBe(false);
  });

  it('keeps each path’s progress separate', () => {
    const progress: Progress = {
      status: 'moving',
      completed: { moving: ['arrival', 'medical'], visiting: ['v-entry'] },
    };
    const round = parseProgress(serializeProgress(progress));
    expect(round.completed['moving']).toEqual(['arrival', 'medical']);
    expect(round.completed['visiting']).toEqual(['v-entry']);
  });
});

describe('localStorage persistence', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('round-trips progress through a working store', () => {
    const storage = fakeStorage();
    const progress: Progress = { status: 'moving', completed: { moving: ['arrival', 'medical'] } };

    expect(writeProgress(storage, progress)).toBe(true);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect(readProgress(storage)).toEqual(progress);

    expect(clearProgress(storage)).toBe(true);
    expect(readProgress(storage)).toEqual(defaultProgress());
  });

  it('returns the default when the store is empty', () => {
    expect(readProgress(fakeStorage())).toEqual(defaultProgress());
    expect(readProgress(null)).toEqual(defaultProgress());
    expect(writeProgress(null, defaultProgress())).toBe(false);
    expect(clearProgress(null)).toBe(false);
  });

  it('survives a store that throws on every operation', () => {
    const storage = throwingStorage();
    expect(() => readProgress(storage)).not.toThrow();
    expect(readProgress(storage)).toEqual(defaultProgress());
    expect(writeProgress(storage, { status: 'moving', completed: {} })).toBe(false);
    expect(clearProgress(storage)).toBe(false);
  });

  it('survives garbage in the store rather than crashing the page', () => {
    expect(readProgress(fakeStorage({ [STORAGE_KEY]: 'not json {{' }))).toEqual(defaultProgress());
    expect(readProgress(fakeStorage({ [STORAGE_KEY]: '[1,2,3]' }))).toEqual(defaultProgress());
    expect(readProgress(fakeStorage({ [STORAGE_KEY]: 'null' }))).toEqual(defaultProgress());
    expect(parseProgress('{"status":"astronaut","completed":{"moving":["arrival",7]}}')).toEqual({
      status: null,
      completed: { moving: ['arrival'] },
    });
    expect(parseProgress('{"completed":"nope"}')).toEqual(defaultProgress());
    expect(parseProgress(null)).toEqual(defaultProgress());
    expect(parseProgress('')).toEqual(defaultProgress());
  });

  it('returns null from browserStorage when there is no localStorage at all', () => {
    expect(browserStorage()).toBeNull();
  });

  it('returns null from browserStorage when merely reading the property throws', () => {
    // Safari in a private window / "block all cookies": the getter itself throws.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    expect(browserStorage()).toBeNull();
  });

  it('returns null from browserStorage when the store exists but refuses writes', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: throwingStorage(),
    });
    expect(browserStorage()).toBeNull();
  });

  it('returns the store when it actually works', () => {
    const storage = fakeStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    expect(browserStorage()).toBe(storage);
    // The probe must not leave anything behind.
    expect(storage.data.size).toBe(0);
  });
});
