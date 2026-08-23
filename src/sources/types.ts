import type { CommunityResolver } from "../geo/resolver.js";
import type { Authority, DubaiRecord } from "../core/types.js";
import type { PulseTokenManager } from "../auth/pulse-token.js";

/** Context handed to an adapter while it normalises rows. */
export interface NormalizeContext {
  readonly resolver: CommunityResolver;
  /** Called when a row's location could not be resolved, for the ingest report. */
  readonly onUnresolved: (rawLocation: string) => void;
}

export interface FetchContext {
  /** Present only when the source declares `requiresAuth`. */
  readonly token?: PulseTokenManager;
  readonly signal?: AbortSignal;
}

/**
 * A data source: one dataset, from one authority, normalised into one record
 * type.
 *
 * Adapters are deliberately thin and declarative. Everything hard — auth,
 * retries, community resolution, storage — lives in the layer, so adding an
 * authority is a matter of describing its columns rather than re-solving the
 * plumbing.
 */
export interface Source<T extends DubaiRecord> {
  /** Stable dotted identifier, e.g. "dld.transactions". */
  readonly id: string;
  readonly authority: Authority;
  readonly title: string;
  readonly description: string;
  /** Upstream dataset URL. */
  readonly endpoint: string;
  /** Whether a Dubai Pulse token is needed. */
  readonly requiresAuth: boolean;
  /** Licence the authority publishes this under. */
  readonly license: string;
  /** Human-readable note on what this adapter does and does not cover. */
  readonly caveats?: string;

  /** Retrieve raw payload text from the authority. */
  fetchRaw(context: FetchContext): Promise<string>;
  /** Split raw payload into untyped rows. */
  parse(raw: string): Array<Record<string, string>>;
  /** Convert one raw row to a typed record, or null to skip it. */
  normalize(row: Record<string, string>, context: NormalizeContext): T | null;
}

/** Outcome of ingesting one source. */
export interface IngestReport {
  readonly sourceId: string;
  readonly fetchedRows: number;
  readonly storedRecords: number;
  readonly skippedRows: number;
  /** Rows whose location did not resolve to a community, by raw string. */
  readonly unresolvedLocations: ReadonlyMap<string, number>;
  readonly durationMs: number;
}
