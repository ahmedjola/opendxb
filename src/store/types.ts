import type { DubaiRecord } from "../core/types.js";

/** Provenance for one ingested source. */
export interface StoreMeta {
  readonly sourceId: string;
  readonly authority: string;
  /** ISO timestamp of the ingest that produced this data. */
  readonly ingestedAt: string;
  readonly recordCount: number;
  /** Upstream URL the data came from, so a stale set can be traced. */
  readonly endpoint: string;
  readonly license: string;
}

/** Persistence for normalised records, keyed by source id. */
export interface Store {
  put(meta: StoreMeta, records: readonly DubaiRecord[]): Promise<void>;
  all<T extends DubaiRecord>(sourceId: string): Promise<T[] | null>;
  meta(sourceId: string): Promise<StoreMeta | null>;
  list(): Promise<string[]>;
}
