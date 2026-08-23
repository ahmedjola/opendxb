/** A canonical Dubai community, the join key for every source in the layer. */
export interface Community {
  /** Stable, URL-safe identifier minted by this project. Never changes. */
  readonly slug: string;
  /** Dubai Land Department official English name. */
  readonly nameEn: string;
  /** Dubai Land Department official Arabic name. */
  readonly nameAr: string;
  /** Names residents, portals and other authorities actually use, in English. */
  readonly marketNames: readonly string[];
  /** The same, in Arabic. */
  readonly marketNamesAr: readonly string[];
  /**
   * DLD community number. Null until `opendxb ingest` populates it from Dubai
   * Pulse — this project does not assert official identifiers it cannot source.
   */
  readonly communityNumber: number | null;
  /** DLD sector number, populated by ingest. */
  readonly sectorNumber: number | null;
}

/** How a name matched a community — the audit trail for a join. */
export type MatchKind = "exact" | "alias" | "fuzzy";

export interface ResolutionMatch {
  readonly community: Community;
  /** 1 for exact and alias hits; the similarity score for fuzzy hits. */
  readonly score: number;
  readonly kind: MatchKind;
  /** The specific alias string that matched, for debugging bad joins. */
  readonly matchedOn: string;
}

export interface Resolution {
  readonly query: string;
  readonly normalized: string;
  /** Null when nothing cleared the confidence threshold. */
  readonly match: ResolutionMatch | null;
  /** Ranked runners-up, for surfacing ambiguity to callers. */
  readonly candidates: readonly ResolutionMatch[];
  /**
   * True when the top two candidates are too close to separate confidently.
   * Callers joining data should treat an ambiguous resolution as a miss.
   */
  readonly ambiguous: boolean;
}
