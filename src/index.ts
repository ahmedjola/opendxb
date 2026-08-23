/**
 * opendxb — one typed, bilingual, cross-authority data layer for Dubai's open
 * government data.
 *
 * Dubai publishes an unusual amount of open data, but it is published
 * vertically: DLD ships property, KHDA ships schools, DHA ships clinics, RTA
 * ships transit. Each uses its own identifiers, its own column names, its own
 * spelling of the same place, and half of it is bilingual. Asking a question
 * that crosses two authorities means first rebuilding the join by hand.
 *
 * This package is that join, done once.
 */

export { OpenDXB, defaultDataDir, credentialsFromEnv } from "./client.js";
export type {
  OpenDXBOptions, TransactionFilter, RentFilter, CommunityProfile, AreaActivity,
} from "./client.js";

export {
  normalizeName, normalizeArabic, normalizeLatin, similarity, isArabic,
  CommunityResolver, loadCommunities, getResolver,
} from "./geo/index.js";
export type { Community, Resolution, ResolutionMatch, MatchKind } from "./geo/index.js";

export { ALL_SOURCES, getSource } from "./sources/index.js";
export type { Source, IngestReport, NormalizeContext } from "./sources/types.js";

export { FileStore } from "./store/file.js";
export { MemoryStore } from "./store/memory.js";
export { SampleStore } from "./store/sample.js";
export type { Store, StoreMeta } from "./store/types.js";

export { PulseTokenManager } from "./auth/pulse-token.js";
export type { PulseCredentials } from "./auth/pulse-token.js";

export {
  OpenDxbError, UpstreamError, AuthError, SchemaError, NotIngestedError,
} from "./core/errors.js";
export { parseCsv, parseCsvRows } from "./core/csv.js";
export { describe as describeDistribution, median, percentile } from "./core/stats.js";
export type { Distribution } from "./core/stats.js";

export type {
  Authority, DubaiRecord, PropertyTransaction, RentalContract, School,
  HealthFacility, TransitStation, PropertyType, TransactionKind, KhdaRating,
  AreaTransactionSummary, AreaProjectSummary,
} from "./core/types.js";
