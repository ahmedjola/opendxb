import type { Store, StoreMeta } from "./types.js";
import type { DubaiRecord } from "../core/types.js";

/** In-memory store, for tests and short-lived processes. */
export class MemoryStore implements Store {
  readonly #records = new Map<string, DubaiRecord[]>();
  readonly #meta = new Map<string, StoreMeta>();

  async put(meta: StoreMeta, records: readonly DubaiRecord[]): Promise<void> {
    this.#meta.set(meta.sourceId, meta);
    this.#records.set(meta.sourceId, [...records]);
  }

  async all<T extends DubaiRecord>(sourceId: string): Promise<T[] | null> {
    return (this.#records.get(sourceId) as T[] | undefined) ?? null;
  }

  async meta(sourceId: string): Promise<StoreMeta | null> {
    return this.#meta.get(sourceId) ?? null;
  }

  async list(): Promise<string[]> {
    return [...this.#records.keys()];
  }
}
