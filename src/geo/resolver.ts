import { normalizeName, similarity, isArabic } from "./normalize.js";
import type { Community, Resolution, ResolutionMatch } from "./types.js";

/**
 * Resolves any spelling of a Dubai place name — official, market, Arabic,
 * abbreviated or misspelt — to one canonical community.
 *
 * This is the join engine. Every cross-authority query in the SDK goes through
 * it, so its failure modes are chosen deliberately: it would rather return
 * nothing than return the wrong community. A missed join shows up as a gap a
 * caller can see; a wrong join silently attributes a school in Al Barsha 2 to
 * Al Barsha 1 and nobody ever notices.
 */

/** Minimum similarity for a fuzzy match to be offered at all. */
const DEFAULT_THRESHOLD = 0.72;

/**
 * Minimum gap between the best and second-best candidate. Below this the
 * result is flagged ambiguous rather than guessed.
 */
const AMBIGUITY_MARGIN = 0.05;

interface AliasEntry {
  readonly normalized: string;
  readonly original: string;
  readonly community: Community;
  /** Official names outrank market names when both match equally well. */
  readonly official: boolean;
}

export interface ResolverOptions {
  /** Minimum similarity for a fuzzy match. Defaults to 0.72. */
  readonly threshold?: number;
  /** Maximum runners-up to return. Defaults to 5. */
  readonly maxCandidates?: number;
}

export class CommunityResolver {
  readonly #communities: readonly Community[];
  readonly #bySlug = new Map<string, Community>();
  /** Normalised alias -> entries. Collisions are possible and kept. */
  readonly #index = new Map<string, AliasEntry[]>();
  readonly #aliases: AliasEntry[] = [];
  readonly #threshold: number;
  readonly #maxCandidates: number;

  constructor(communities: readonly Community[], options: ResolverOptions = {}) {
    this.#communities = communities;
    this.#threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.#maxCandidates = options.maxCandidates ?? 5;

    for (const community of communities) {
      this.#bySlug.set(community.slug, community);
      this.#add(community.nameEn, community, true);
      this.#add(community.nameAr, community, true);
      // The slug itself resolves, so round-tripping an API response works.
      this.#add(community.slug.replace(/-/g, " "), community, true);
      for (const name of community.marketNames) this.#add(name, community, false);
      for (const name of community.marketNamesAr) this.#add(name, community, false);
    }
  }

  #add(raw: string, community: Community, official: boolean): void {
    if (!raw) return;
    const normalized = normalizeName(raw);
    if (!normalized) return;
    const entry: AliasEntry = { normalized, original: raw, community, official };
    this.#aliases.push(entry);
    const bucket = this.#index.get(normalized);
    if (bucket) bucket.push(entry);
    else this.#index.set(normalized, [entry]);
  }

  /** Every community in the registry. */
  list(): readonly Community[] {
    return this.#communities;
  }

  /** Direct slug lookup; no fuzzy matching. */
  bySlug(slug: string): Community | null {
    return this.#bySlug.get(slug) ?? null;
  }

  /**
   * Resolve a name to a community, with the full candidate list and an
   * ambiguity flag.
   */
  resolve(query: string): Resolution {
    const normalized = normalizeName(query ?? "");
    if (!normalized) {
      return { query, normalized: "", match: null, candidates: [], ambiguous: false };
    }

    // Exact hit on a normalised alias. Prefer official names on collision.
    const direct = this.#index.get(normalized);
    if (direct && direct.length > 0) {
      const sorted = [...direct].sort((a, b) => Number(b.official) - Number(a.official));
      const best = sorted[0]!;
      const distinct = new Set(direct.map((entry) => entry.community.slug));
      const match: ResolutionMatch = {
        community: best.community,
        score: 1,
        kind: best.official ? "exact" : "alias",
        matchedOn: best.original,
      };
      return {
        query,
        normalized,
        match,
        candidates: [match],
        // Two different communities claiming the same alias is a registry bug,
        // but it must surface rather than silently pick one.
        ambiguous: distinct.size > 1,
      };
    }

    // Fuzzy pass. Restricted to aliases in the same script as the query:
    // comparing Arabic against Latin keys only ever produces noise.
    const queryIsArabic = isArabic(query);
    const scored: ResolutionMatch[] = [];
    const bestPerCommunity = new Map<string, ResolutionMatch>();

    for (const entry of this.#aliases) {
      if (isArabic(entry.original) !== queryIsArabic) continue;
      const score = similarity(normalized, entry.normalized);
      if (score < this.#threshold) continue;
      const candidate: ResolutionMatch = {
        community: entry.community,
        score,
        kind: "fuzzy",
        matchedOn: entry.original,
      };
      const existing = bestPerCommunity.get(entry.community.slug);
      if (!existing || candidate.score > existing.score) {
        bestPerCommunity.set(entry.community.slug, candidate);
      }
    }

    scored.push(...bestPerCommunity.values());
    scored.sort((a, b) => b.score - a.score || Number(b.community.slug < a.community.slug));

    const candidates = scored.slice(0, this.#maxCandidates);
    const best = candidates[0] ?? null;
    const runnerUp = candidates[1];
    const ambiguous =
      best != null && runnerUp != null && best.score - runnerUp.score < AMBIGUITY_MARGIN;

    return {
      query,
      normalized,
      // An ambiguous fuzzy result is reported as no match, with the candidates
      // attached so the caller can decide. Guessing here corrupts joins.
      match: best && !ambiguous ? best : null,
      candidates,
      ambiguous,
    };
  }

  /**
   * Resolve or throw. For call sites where a silent null would produce a
   * misleading empty result set rather than an error.
   */
  resolveOrThrow(query: string): Community {
    const resolution = this.resolve(query);
    if (resolution.match) return resolution.match.community;
    const hint = resolution.candidates.length
      ? ` Did you mean: ${resolution.candidates.map((c) => c.community.nameEn).join(", ")}?`
      : "";
    const reason = resolution.ambiguous ? "is ambiguous" : "did not match any known community";
    throw new Error(`Dubai community "${query}" ${reason}.${hint}`);
  }
}
