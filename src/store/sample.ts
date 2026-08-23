import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Store, StoreMeta } from "./types.js";
import type { DubaiRecord } from "../core/types.js";

/**
 * Read-only store over the bundled synthetic sample.
 *
 * Its purpose is a working first five minutes: `npx opendxb demo` should show
 * a real cross-authority join without anyone first registering for Dubai Pulse
 * credentials and waiting on a multi-hundred-megabyte download. Every record
 * and every meta block is flagged synthetic, and writes are refused, so sample
 * data cannot leak into a real dataset.
 */
export class SampleStore implements Store {
  readonly #dir: string;
  readonly #cache = new Map<string, DubaiRecord[]>();

  constructor(dir = findSampleDir()) {
    this.#dir = dir;
  }

  async put(): Promise<never> {
    throw new Error(
      "The bundled sample is read-only. Use a FileStore to ingest real Dubai open data.",
    );
  }

  async all<T extends DubaiRecord>(sourceId: string): Promise<T[] | null> {
    const cached = this.#cache.get(sourceId);
    if (cached) return cached as T[];
    const path = join(this.#dir, `${sourceId}.json`);
    if (!existsSync(path)) return null;
    const envelope = JSON.parse(readFileSync(path, "utf8")) as { records: DubaiRecord[] };
    this.#cache.set(sourceId, envelope.records);
    return envelope.records as T[];
  }

  async meta(sourceId: string): Promise<StoreMeta | null> {
    const path = join(this.#dir, `${sourceId}.json`);
    if (!existsSync(path)) return null;
    return (JSON.parse(readFileSync(path, "utf8")) as { meta: StoreMeta }).meta;
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.#dir)) return [];
    return readdirSync(this.#dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length));
  }
}

/** Locate `data/samples`, working from both `src/` and `dist/` layouts. */
function findSampleDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(dir, "data", "samples");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("opendxb: bundled sample data not found (expected data/samples).");
}
