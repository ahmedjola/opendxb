import { join } from "node:path";
import { homedir } from "node:os";
import { getResolver } from "./geo/communities.js";
import type { CommunityResolver } from "./geo/resolver.js";
import type { Community, Resolution } from "./geo/types.js";
import { FileStore } from "./store/file.js";
import type { Store, StoreMeta } from "./store/types.js";
import { ALL_SOURCES, getSource } from "./sources/index.js";
import type { Source, IngestReport } from "./sources/types.js";
import { PulseTokenManager, type PulseCredentials } from "./auth/pulse-token.js";
import { NotIngestedError } from "./core/errors.js";
import { describe, countBy, median, type Distribution } from "./core/stats.js";
import type {
  DubaiRecord, PropertyTransaction, RentalContract, School, HealthFacility, TransitStation,
  AreaTransactionSummary,
} from "./core/types.js";

export interface OpenDXBOptions {
  /** Where ingested data lives. Defaults to ~/.opendxb. */
  readonly dataDir?: string;
  /** Dubai Pulse credentials, needed only for sources that require auth. */
  readonly credentials?: PulseCredentials;
  /** Inject a store, e.g. MemoryStore in tests. */
  readonly store?: Store;
  /** Inject a resolver with non-default matching options. */
  readonly resolver?: CommunityResolver;
}

/** Filters accepted by the record queries. */
export interface TransactionFilter {
  readonly community?: string;
  readonly from?: string;
  readonly to?: string;
  readonly propertyType?: PropertyTransaction["propertyType"];
  readonly kind?: PropertyTransaction["kind"];
  readonly minAmountAed?: number;
  readonly maxAmountAed?: number;
  readonly limit?: number;
}

export interface RentFilter {
  readonly community?: string;
  readonly from?: string;
  readonly to?: string;
  readonly propertyType?: RentalContract["propertyType"];
  readonly limit?: number;
}

/**
 * A single community described across every authority at once.
 *
 * This is the shape no Dubai government portal produces, because no single
 * authority holds more than one row of it. DLD knows what property costs,
 * KHDA knows the schools, DHA knows the clinics, RTA knows the metro — and
 * they are four separate portals with four different names for the same place.
 */
export interface CommunityProfile {
  readonly community: Community;
  readonly sales: {
    readonly count: number;
    readonly amountAed: Distribution;
    readonly pricePerSqm: Distribution;
    readonly offPlanShare: number | null;
  };
  readonly rents: {
    readonly count: number;
    readonly annualRentAed: Distribution;
  };
  /** Median rent over median sale price, as a percentage. Null when either is missing. */
  readonly grossYieldPct: number | null;
  readonly schools: {
    readonly count: number;
    readonly byRating: Record<string, number>;
    readonly byCurriculum: Record<string, number>;
  };
  readonly health: { readonly count: number; readonly byType: Record<string, number> };
  readonly transit: { readonly count: number; readonly byMode: Record<string, number> };
  /** Which sources actually had data; the rest were not ingested. */
  readonly sourcesUsed: readonly string[];
  readonly missingSources: readonly string[];
}

/** The Dubai open-data layer. */
export class OpenDXB {
  readonly #store: Store;
  readonly #resolver: CommunityResolver;
  readonly #credentials: PulseCredentials | undefined;
  #token: PulseTokenManager | null = null;

  constructor(options: OpenDXBOptions = {}) {
    this.#store = options.store ?? new FileStore(options.dataDir ?? defaultDataDir());
    this.#resolver = options.resolver ?? getResolver();
    this.#credentials = options.credentials;
  }

  /** The canonical community registry. */
  get communities(): readonly Community[] {
    return this.#resolver.list();
  }

  /** Every source the layer can ingest. */
  get sources(): ReadonlyArray<Source<DubaiRecord>> {
    return ALL_SOURCES;
  }

  get store(): Store {
    return this.#store;
  }

  /** Resolve any spelling of a Dubai place name to a canonical community. */
  resolve(name: string): Resolution {
    return this.#resolver.resolve(name);
  }

  /** Provenance for an ingested source, or null if it has not been ingested. */
  async provenance(sourceId: string): Promise<StoreMeta | null> {
    return this.#store.meta(sourceId);
  }

  /**
   * Download, normalise and store one source.
   *
   * Community resolution happens here rather than at query time so that the
   * expensive fuzzy matching runs once per row per ingest, and so the report
   * can tell you which locations failed to resolve — that list is the backlog
   * for extending the community registry.
   */
  async ingest(sourceId: string, options: { signal?: AbortSignal } = {}): Promise<IngestReport> {
    const source = getSource(sourceId);
    if (!source) {
      throw new Error(
        `Unknown source "${sourceId}". Known sources: ${ALL_SOURCES.map((s) => s.id).join(", ")}`,
      );
    }

    const started = Date.now();
    const unresolved = new Map<string, number>();
    const context = {
      resolver: this.#resolver,
      onUnresolved: (raw: string) => unresolved.set(raw, (unresolved.get(raw) ?? 0) + 1),
    };

    const raw = await source.fetchRaw({
      ...(source.requiresAuth ? { token: this.#tokenManager() } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const rows = source.parse(raw);

    const records: DubaiRecord[] = [];
    for (const row of rows) {
      const record = source.normalize(row, context);
      if (record) records.push(record);
    }

    await this.#store.put(
      {
        sourceId: source.id,
        authority: source.authority,
        ingestedAt: new Date().toISOString(),
        recordCount: records.length,
        endpoint: source.endpoint,
        license: source.license,
      },
      records,
    );

    return {
      sourceId: source.id,
      fetchedRows: rows.length,
      storedRecords: records.length,
      skippedRows: rows.length - records.length,
      unresolvedLocations: unresolved,
      durationMs: Date.now() - started,
    };
  }

  /** Registered property transactions. */
  async transactions(filter: TransactionFilter = {}): Promise<PropertyTransaction[]> {
    const all = await this.#require<PropertyTransaction>("dld.transactions");
    const slug = filter.community ? this.#slug(filter.community) : null;

    let rows = all.filter((row) => {
      if (slug && row.communitySlug !== slug) return false;
      if (filter.from && row.date < filter.from) return false;
      if (filter.to && row.date > filter.to) return false;
      if (filter.propertyType && row.propertyType !== filter.propertyType) return false;
      if (filter.kind && row.kind !== filter.kind) return false;
      if (filter.minAmountAed !== undefined && row.amountAed < filter.minAmountAed) return false;
      if (filter.maxAmountAed !== undefined && row.amountAed > filter.maxAmountAed) return false;
      return true;
    });

    rows = rows.sort((a, b) => b.date.localeCompare(a.date));
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }

  /** Registered tenancy contracts. */
  async rents(filter: RentFilter = {}): Promise<RentalContract[]> {
    const all = await this.#require<RentalContract>("dld.rents");
    const slug = filter.community ? this.#slug(filter.community) : null;

    const rows = all.filter((row) => {
      if (slug && row.communitySlug !== slug) return false;
      if (filter.from && row.startDate < filter.from) return false;
      if (filter.to && row.startDate > filter.to) return false;
      if (filter.propertyType && row.propertyType !== filter.propertyType) return false;
      return true;
    }).sort((a, b) => b.startDate.localeCompare(a.startDate));

    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }

  /** KHDA private schools. */
  async schools(options: { community?: string; rating?: string } = {}): Promise<School[]> {
    const all = await this.#require<School>("khda.schools");
    const slug = options.community ? this.#slug(options.community) : null;
    return all.filter((row) => {
      if (slug && row.communitySlug !== slug) return false;
      if (options.rating && row.rating !== options.rating) return false;
      return true;
    });
  }

  /** DHA licensed health facilities. */
  async healthFacilities(options: { community?: string } = {}): Promise<HealthFacility[]> {
    const all = await this.#require<HealthFacility>("dha.facilities");
    const slug = options.community ? this.#slug(options.community) : null;
    return slug ? all.filter((row) => row.communitySlug === slug) : all;
  }

  /**
   * Area-level transaction totals from DLD's public gateway.
   *
   * The only property data obtainable without credentials or a UAE IP, so this
   * is the query most installations can actually answer.
   */
  async areaTransactions(
    options: { community?: string; kind?: "sale" | "mortgage" } = {},
  ): Promise<AreaTransactionSummary[]> {
    const sourceId = options.kind === "mortgage" ? "dld.areawise-mortgage" : "dld.areawise-sales";
    const all = await this.#require<AreaTransactionSummary>(sourceId);
    const slug = options.community ? this.#slug(options.community) : null;
    const rows = slug ? all.filter((row) => row.communitySlug === slug) : all;
    return [...rows].sort((a, b) => b.totalWorthAed - a.totalWorthAed);
  }

  /** RTA transit stations. */
  async stations(options: { community?: string } = {}): Promise<TransitStation[]> {
    const all = await this.#require<TransitStation>("rta.stations");
    const slug = options.community ? this.#slug(options.community) : null;
    return slug ? all.filter((row) => row.communitySlug === slug) : all;
  }

  /**
   * Everything four authorities know about one place, in a single call.
   *
   * Sources that have not been ingested are reported in `missingSources`
   * rather than throwing, so a partial install still returns a useful profile
   * instead of nothing.
   */
  async profile(name: string): Promise<CommunityProfile> {
    const community = this.#resolver.resolveOrThrow(name);
    const used: string[] = [];
    const missing: string[] = [];

    const load = async <T extends DubaiRecord>(sourceId: string): Promise<T[]> => {
      const rows = await this.#store.all<T>(sourceId);
      if (rows === null) { missing.push(sourceId); return []; }
      used.push(sourceId);
      return rows.filter((row) => row.communitySlug === community.slug);
    };

    const [sales, rentals, schools, health, transit] = await Promise.all([
      load<PropertyTransaction>("dld.transactions"),
      load<RentalContract>("dld.rents"),
      load<School>("khda.schools"),
      load<HealthFacility>("dha.facilities"),
      load<TransitStation>("rta.stations"),
    ]);

    const saleAmounts = sales.filter((s) => s.kind === "sale").map((s) => s.amountAed);
    const rentAmounts = rentals.map((r) => r.annualRentAed);
    const medianSale = median(saleAmounts);
    const medianRent = median(rentAmounts);

    const offPlanKnown = sales.filter((s) => s.isOffPlan !== null);

    return {
      community,
      sales: {
        count: sales.length,
        amountAed: describe(saleAmounts),
        pricePerSqm: describe(sales.map((s) => s.pricePerSqm).filter((v): v is number => v !== null)),
        offPlanShare: offPlanKnown.length
          ? offPlanKnown.filter((s) => s.isOffPlan).length / offPlanKnown.length
          : null,
      },
      rents: { count: rentals.length, annualRentAed: describe(rentAmounts) },
      // Gross yield only: it ignores service charges, vacancy and transaction
      // costs, and comparing a whole community's rents against a whole
      // community's sales mixes unit sizes. Useful as a signal, not a valuation.
      grossYieldPct:
        medianSale && medianRent && medianSale > 0
          ? Number(((medianRent / medianSale) * 100).toFixed(2))
          : null,
      schools: {
        count: schools.length,
        byRating: countBy(schools, (s) => s.rating),
        byCurriculum: countBy(schools, (s) => s.curriculum),
      },
      health: { count: health.length, byType: countBy(health, (f) => f.facilityType) },
      transit: { count: transit.length, byMode: countBy(transit, (s) => s.mode) },
      sourcesUsed: used,
      missingSources: missing,
    };
  }

  #slug(name: string): string {
    return this.#resolver.resolveOrThrow(name).slug;
  }

  #tokenManager(): PulseTokenManager {
    if (!this.#credentials) {
      throw new Error(
        "This source requires Dubai Pulse credentials. Pass `credentials` to OpenDXB, " +
          "or set DUBAI_PULSE_CLIENT_ID and DUBAI_PULSE_CLIENT_SECRET.",
      );
    }
    this.#token ??= new PulseTokenManager(this.#credentials);
    return this.#token;
  }

  async #require<T extends DubaiRecord>(sourceId: string): Promise<T[]> {
    const rows = await this.#store.all<T>(sourceId);
    if (rows === null) throw new NotIngestedError(sourceId);
    return rows;
  }
}

/** Default on-disk location for ingested data. */
export function defaultDataDir(): string {
  return process.env["OPENDXB_DATA_DIR"] ?? join(homedir(), ".opendxb");
}

/** Read Dubai Pulse credentials from the environment, if present. */
export function credentialsFromEnv(): PulseCredentials | undefined {
  const clientId = process.env["DUBAI_PULSE_CLIENT_ID"];
  const clientSecret = process.env["DUBAI_PULSE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}
