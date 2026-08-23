/**
 * Progress, kept in localStorage and nowhere else.
 *
 * Nothing is sent anywhere. There is no account, no analytics call and no
 * server: what you have ticked off lives in your own browser.
 *
 * Every single access is wrapped, because `localStorage` is not a safe object.
 * In a private window, in an embedded webview, or with site data blocked, even
 * *reading* `window.localStorage` throws — before you get to call `getItem`.
 * So the whole site is built to render correctly with storage empty, storage
 * broken, or storage absent, and the UI says so when it cannot save.
 */
import { STATUS_IDS, isStatusId, type StatusId } from './journey';

export const STORAGE_KEY = 'landing-in-dubai.progress.v1';

/** The tiny slice of the Storage interface this project uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Progress {
  status: StatusId | null;
  /** completed step ids, keyed by status — switching path keeps both. */
  completed: Record<string, string[]>;
}

export function defaultProgress(): Progress {
  return { status: null, completed: {} };
}

/**
 * Parse whatever came out of storage. Anything unrecognised degrades to the
 * default rather than throwing: a corrupted key must not take the page down.
 */
export function parseProgress(raw: string | null | undefined): Progress {
  if (typeof raw !== 'string' || raw.trim() === '') return defaultProgress();

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultProgress();
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return defaultProgress();
  }

  const record = data as Record<string, unknown>;
  const status = isStatusId(record['status']) ? record['status'] : null;

  const completed: Record<string, string[]> = {};
  const rawCompleted = record['completed'];
  if (typeof rawCompleted === 'object' && rawCompleted !== null && !Array.isArray(rawCompleted)) {
    for (const key of STATUS_IDS) {
      const value = (rawCompleted as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        completed[key] = value.filter((item): item is string => typeof item === 'string');
      }
    }
  }

  return { status, completed };
}

export function serializeProgress(progress: Progress): string {
  return JSON.stringify({ status: progress.status, completed: progress.completed });
}

/**
 * The browser's localStorage, or null if touching it throws or it is missing.
 * Reading the property itself is inside the try on purpose.
 */
export function browserStorage(): StorageLike | null {
  try {
    const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!storage) return null;
    // Prove it actually works before trusting it: some browsers expose the
    // object and then throw on write.
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Read progress. Never throws; an unreadable store just means "no progress". */
export function readProgress(storage: StorageLike | null): Progress {
  if (!storage) return defaultProgress();
  try {
    return parseProgress(storage.getItem(STORAGE_KEY));
  } catch {
    return defaultProgress();
  }
}

/** Write progress. Returns false when the store refused — the caller says so. */
export function writeProgress(storage: StorageLike | null, progress: Progress): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, serializeProgress(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
