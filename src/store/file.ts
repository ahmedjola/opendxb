import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { Store, StoreMeta } from "./types.js";
import type { DubaiRecord } from "../core/types.js";

interface Envelope {
  meta: StoreMeta;
  records: DubaiRecord[];
}

/**
 * JSON-file store, one file per source.
 *
 * Deliberately simple: an ingest is an occasional batch job and the read path
 * is "load once, filter in memory", which is fast enough for the record counts
 * involved and keeps the package free of a database dependency. `Store` is an
 * interface precisely so a SQLite or DuckDB backend can replace this when full
 * DLD history stops fitting comfortably in memory.
 */
export class FileStore implements Store {
  readonly #dir: string;
  readonly #cache = new Map<string, DubaiRecord[]>();

  constructor(dir: string) {
    this.#dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  get directory(): string {
    return this.#dir;
  }

  #path(sourceId: string): string {
    // Source ids are dotted and safe, but a traversal here would be nasty.
    return join(this.#dir, `${sourceId.replace(/[^a-z0-9._-]/gi, "_")}.json`);
  }

  async put(meta: StoreMeta, records: readonly DubaiRecord[]): Promise<void> {
    const envelope: Envelope = { meta, records: [...records] };
    const target = this.#path(meta.sourceId);
    // Write-then-rename so an interrupted ingest cannot leave a half-written
    // file that parses as valid-but-truncated JSON on next read.
    const temp = `${target}.tmp`;
    writeFileSync(temp, JSON.stringify(envelope), "utf8");
    renameSync(temp, target);
    this.#cache.set(meta.sourceId, envelope.records);
  }

  async all<T extends DubaiRecord>(sourceId: string): Promise<T[] | null> {
    const cached = this.#cache.get(sourceId);
    if (cached) return cached as T[];
    const envelope = this.#read(sourceId);
    if (!envelope) return null;
    this.#cache.set(sourceId, envelope.records);
    return envelope.records as T[];
  }

  async meta(sourceId: string): Promise<StoreMeta | null> {
    return this.#read(sourceId)?.meta ?? null;
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.#dir)) return [];
    return readdirSync(this.#dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length));
  }

  #read(sourceId: string): Envelope | null {
    const path = this.#path(sourceId);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as Envelope;
  }
}
