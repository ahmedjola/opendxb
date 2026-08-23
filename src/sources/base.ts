import { fetchText } from "../core/http.js";
import { parseCsv, field } from "../core/csv.js";
import type { Source, FetchContext, NormalizeContext } from "./types.js";
import type { Authority, DubaiRecord, PropertyType } from "../core/types.js";

/**
 * Resolve a row's location string to a canonical community.
 *
 * Adapters pass every location-ish column they know about, in preference
 * order. An unresolved location is recorded rather than dropped silently: the
 * ingest report surfaces them so the community registry can be extended, which
 * is how the crosswalk improves over time.
 */
export function resolveLocation(
  row: Record<string, string>,
  context: NormalizeContext,
  ...columns: string[]
): { communitySlug: string | null; rawLocation: string | null } {
  const raw = field(row, ...columns);
  if (!raw) return { communitySlug: null, rawLocation: null };
  const resolution = context.resolver.resolve(raw);
  if (!resolution.match) {
    context.onUnresolved(raw);
    return { communitySlug: null, rawLocation: raw };
  }
  return { communitySlug: resolution.match.community.slug, rawLocation: raw };
}

/** Map an authority's free-text property type onto our closed set. */
export function classifyPropertyType(raw: string | null): PropertyType {
  if (!raw) return "other";
  const text = raw.toLowerCase();
  if (text.includes("flat") || text.includes("apartment") || text.includes("unit")) return "apartment";
  if (text.includes("villa") || text.includes("townhouse")) return "villa";
  if (text.includes("land") || text.includes("plot")) return "land";
  if (text.includes("building") || text.includes("tower")) return "building";
  if (text.includes("office")) return "office";
  if (text.includes("shop") || text.includes("retail")) return "shop";
  return "other";
}

/** Options shared by every CSV-over-HTTP source. */
export interface CsvSourceConfig<T extends DubaiRecord> {
  readonly id: string;
  readonly authority: Authority;
  readonly title: string;
  readonly description: string;
  readonly endpoint: string;
  readonly requiresAuth: boolean;
  readonly license: string;
  readonly caveats?: string;
  readonly normalize: (row: Record<string, string>, context: NormalizeContext) => T | null;
}

/**
 * Environment variable that overrides a source's endpoint.
 *
 * `dld.transactions` becomes `OPENDXB_ENDPOINT_DLD_TRANSACTIONS`.
 */
export function endpointEnvVar(sourceId: string): string {
  return `OPENDXB_ENDPOINT_${sourceId.toUpperCase().replace(/[.-]/g, "_")}`;
}

/**
 * Resolve a source's endpoint, preferring an environment override.
 *
 * Dubai Pulse reorganises dataset paths without notice, and the resource URLs
 * baked into this package are the best known at the time of writing rather
 * than a contract. Rather than requiring a package release every time a path
 * moves, any endpoint can be overridden from the environment — see
 * docs/DATA-SOURCES.md for how to confirm the current path.
 */
function resolveEndpoint(sourceId: string, fallback: string): string {
  return process.env[endpointEnvVar(sourceId)] ?? fallback;
}

/**
 * Build a Source for the common case: a CSV export fetched over HTTPS,
 * optionally behind a Dubai Pulse token.
 */
export function csvSource<T extends DubaiRecord>(config: CsvSourceConfig<T>): Source<T> {
  return {
    id: config.id,
    authority: config.authority,
    title: config.title,
    description: config.description,
    get endpoint(): string {
      return resolveEndpoint(config.id, config.endpoint);
    },
    requiresAuth: config.requiresAuth,
    license: config.license,
    ...(config.caveats !== undefined ? { caveats: config.caveats } : {}),

    async fetchRaw(context: FetchContext): Promise<string> {
      const headers: Record<string, string> = { accept: "text/csv,*/*" };
      if (config.requiresAuth && context.token) {
        Object.assign(headers, await context.token.authHeader());
      }
      return fetchText(resolveEndpoint(config.id, config.endpoint), {
        headers,
        authority: config.authority,
        // These exports run to hundreds of megabytes; the default 60s is not
        // enough for a full-history download on a normal connection.
        timeoutMs: 10 * 60_000,
        ...(context.signal ? { signal: context.signal } : {}),
      });
    },

    parse: parseCsv,
    normalize: config.normalize,
  };
}
