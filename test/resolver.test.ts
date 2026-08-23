import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getResolver, loadCommunities } from "../src/geo/communities.js";
import { CommunityResolver } from "../src/geo/resolver.js";

const resolver = getResolver();

/** Resolve and return the slug, or null. */
function slugOf(query: string): string | null {
  return resolver.resolve(query).match?.community.slug ?? null;
}

describe("registry", () => {
  it("loads and has unique slugs", () => {
    const communities = loadCommunities();
    expect(communities.length).toBeGreaterThan(50);
    expect(new Set(communities.map((c) => c.slug)).size).toBe(communities.length);
  });

  it("never asserts an official identifier it cannot source", () => {
    // The rule is about provenance, not absence. communityNumber is either
    // unset, or DLD's own areaId read from its public register by
    // scripts/sync-areas.mjs — never a value invented here. Any registry
    // carrying ids must therefore record when it was reconciled.
    const communities = loadCommunities();
    const withIds = communities.filter((c) => c.communityNumber !== null);

    for (const community of communities) {
      expect(
        community.communityNumber === null ||
          (Number.isInteger(community.communityNumber) && community.communityNumber! > 0),
      ).toBe(true);
    }

    if (withIds.length > 0) {
      const raw = JSON.parse(
        readFileSync(new URL("../data/communities.json", import.meta.url), "utf8"),
      ) as { areasSyncedAt?: string };
      expect(raw.areasSyncedAt, "registry has official ids but no record of where they came from")
        .toBeTruthy();
    }
  });

  it("gives every official id to at most one community", () => {
    // Two communities sharing a DLD areaId means the registry is conflating
    // distinct places, and every join for both would be wrong.
    const seen = new Map<number, string>();
    for (const community of loadCommunities()) {
      if (community.communityNumber === null) continue;
      const existing = seen.get(community.communityNumber);
      expect(existing, `areaId ${community.communityNumber} claimed by ${existing} and ${community.slug}`)
        .toBeUndefined();
      seen.set(community.communityNumber, community.slug);
    }
  });
});

describe("official name resolution", () => {
  it("resolves DLD official English names", () => {
    expect(slugOf("Al Barsha First")).toBe("al-barsha-first");
    expect(slugOf("Marsa Dubai")).toBe("marsa-dubai");
    expect(slugOf("Al Thanyah Fifth")).toBe("al-thanyah-fifth");
  });

  it("resolves DLD official Arabic names", () => {
    expect(slugOf("مرسى دبي")).toBe("marsa-dubai");
    expect(slugOf("البرشاء الأولى")).toBe("al-barsha-first");
    expect(slugOf("الثنية الخامسة")).toBe("al-thanyah-fifth");
    expect(slugOf("برج خليفة")).toBe("burj-khalifa");
  });
});

describe("market name resolution — the actual point of the layer", () => {
  it("maps what residents say to what DLD calls it", () => {
    // Nobody in Dubai has ever said "Marsa Dubai" out loud.
    expect(slugOf("Dubai Marina")).toBe("marsa-dubai");
    expect(slugOf("JLT")).toBe("al-thanyah-fifth");
    expect(slugOf("Jumeirah Lake Towers")).toBe("al-thanyah-fifth");
    expect(slugOf("Downtown Dubai")).toBe("burj-khalifa");
    expect(slugOf("Palm Jumeirah")).toBe("nakhlat-jumeirah");
    expect(slugOf("JVC")).toBe("al-barsha-south-fourth");
    expect(slugOf("Jumeirah Village Circle")).toBe("al-barsha-south-fourth");
    expect(slugOf("DIFC")).toBe("trade-centre-first");
    expect(slugOf("International City")).toBe("warsan-first");
    expect(slugOf("Dubai Hills Estate")).toBe("hadaeq-sheikh-mohammed-bin-rashid");
    expect(slugOf("Motor City")).toBe("al-hebiah-first");
    expect(slugOf("Dubai South")).toBe("madinat-al-mataar");
  });

  it("maps Arabic market names too", () => {
    expect(slugOf("دبي مارينا")).toBe("marsa-dubai");
    expect(slugOf("قرية جميرا الدائرية")).toBe("al-barsha-south-fourth");
  });

  it("round-trips its own slugs", () => {
    for (const community of loadCommunities()) {
      expect(slugOf(community.slug.replace(/-/g, " "))).toBe(community.slug);
    }
  });
});

describe("DLD's own spelling drift", () => {
  // Every pair below was found by reconciling against DLD's live area
  // register. Before these were handled, each produced either a fuzzy match
  // needing human review or a duplicate community in the registry.
  it("matches DLD's areawise spellings to the canonical community", () => {
    expect(slugOf("Al Goze First")).toBe("al-quoz-first");
    expect(slugOf("Al Goze Industrial First")).toBe("al-quoz-industrial-first");
    expect(slugOf("Trade Center First")).toBe("trade-centre-first");
    expect(slugOf("Trade Center Second")).toBe("trade-centre-second");
    expect(slugOf("Um Suqaim Third")).toBe("umm-suqeim-third");
    expect(slugOf("Al Saffa First")).toBe("al-safa-first");
    expect(slugOf("Al Jadaf")).toBe("al-jaddaf");
    expect(slugOf("Nad Al Shiba Third")).toBe("nad-al-sheba-third");
    expect(slugOf("Al Thanayah Fourth")).toBe("al-thanyah-fourth");
    expect(slugOf("Muhaisanah Fourth")).toBe("muhaisnah-fourth");
    expect(slugOf("Al Barshaa South Third")).toBe("al-barsha-south-third");
    expect(slugOf("Al Rega")).toBe("al-rigga");
  });

  it("keeps Palm Deira apart from Palm Jumeirah", () => {
    // Different islands. Fuzzy matching scored them 0.727 against each other,
    // above the 0.72 threshold — which is why an official id is never assigned
    // on a fuzzy match.
    expect(slugOf("Palm Deira")).toBe("palm-deira");
    expect(slugOf("Palm Jumeirah")).toBe("nakhlat-jumeirah");
  });

  it("keeps areas DLD registers separately from being conflated", () => {
    // Each of these was previously a market-name alias of the other entry,
    // which made two distinct DLD areas resolve to one community.
    expect(slugOf("Hor Al Anz")).toBe("hor-al-anz");
    expect(slugOf("Hor Al Anz East")).toBe("hor-al-anz-east");
    expect(slugOf("Umm Hurair Second")).toBe("umm-hurair-second");
    expect(slugOf("Oud Metha")).toBe("oud-metha");
    expect(slugOf("Rega Al Buteen")).toBe("rega-al-buteen");
  });
});

describe("cross-authority spelling drift", () => {
  it("absorbs the ordinal-vs-digit disagreement between DLD and KHDA", () => {
    expect(slugOf("Al Barsha 1")).toBe("al-barsha-first");
    expect(slugOf("AL BARSHA 1")).toBe("al-barsha-first");
    expect(slugOf("al-barsha-1")).toBe("al-barsha-first");
    expect(slugOf("Jumeirah 3")).toBe("jumeirah-third");
    expect(slugOf("Umm Suqeim 2")).toBe("umm-suqeim-second");
  });

  it("absorbs transliteration drift", () => {
    expect(slugOf("Jumeira 1")).toBe("jumeirah-first");
    expect(slugOf("Um Suqeim 3")).toBe("umm-suqeim-third");
    expect(slugOf("Za'abeel 1")).toBe("zaabeel-first");
    expect(slugOf("Zabeel 1")).toBe("zaabeel-first");
  });

  it("tolerates real typos", () => {
    expect(slugOf("Dubai Marnia")).toBe("marsa-dubai");
    expect(slugOf("Busines Bay")).toBe("business-bay");
  });
});

describe("refusing to guess — the correctness guarantee", () => {
  it("never confuses numbered sub-communities", () => {
    expect(slugOf("Al Barsha 1")).toBe("al-barsha-first");
    expect(slugOf("Al Barsha 2")).toBe("al-barsha-second");
    expect(slugOf("Al Barsha 3")).toBe("al-barsha-third");
    expect(slugOf("Jumeirah 1")).not.toBe(slugOf("Jumeirah 2"));
    expect(slugOf("Wadi Al Safa 5")).not.toBe(slugOf("Wadi Al Safa 7"));
  });

  it("does not confuse Jumeirah Village Circle with Jumeirah Village Triangle", () => {
    // Two adjacent, similarly-named communities. A fuzzy matcher that gets
    // this wrong misattributes thousands of transactions.
    expect(slugOf("Jumeirah Village Circle")).toBe("al-barsha-south-fourth");
    expect(slugOf("Jumeirah Village Triangle")).toBe("al-barsha-south-third");
    expect(slugOf("JVC")).not.toBe(slugOf("JVT"));
  });

  it("returns null rather than a wrong answer for unknown places", () => {
    expect(slugOf("Abu Dhabi Corniche")).toBeNull();
    expect(slugOf("Manhattan")).toBeNull();
    expect(slugOf("zzzzzzzz")).toBeNull();
    expect(slugOf("")).toBeNull();
  });

  it("does not match Arabic queries against Latin aliases", () => {
    const resolution = resolver.resolve("نيويورك");
    expect(resolution.match).toBeNull();
  });

  it("flags ambiguity instead of picking a winner", () => {
    const ambiguous = new CommunityResolver(
      [
        { slug: "a", nameEn: "Al Nahda Tower", nameAr: "", marketNames: [], marketNamesAr: [], communityNumber: null, sectorNumber: null },
        { slug: "b", nameEn: "Al Nahda Towers", nameAr: "", marketNames: [], marketNamesAr: [], communityNumber: null, sectorNumber: null },
      ],
      { threshold: 0.5 },
    );
    const resolution = ambiguous.resolve("Al Nahdah Towerz");
    expect(resolution.ambiguous).toBe(true);
    expect(resolution.match).toBeNull();
    expect(resolution.candidates.length).toBe(2);
  });
});

describe("resolution metadata", () => {
  it("reports how the match was made, for auditing bad joins", () => {
    expect(resolver.resolve("Al Barsha First").match?.kind).toBe("exact");
    expect(resolver.resolve("JVC").match?.kind).toBe("alias");
    expect(resolver.resolve("Dubai Marnia").match?.kind).toBe("fuzzy");
    expect(resolver.resolve("JVC").match?.matchedOn).toBe("JVC");
  });

  it("offers candidates even when it declines to match", () => {
    const resolution = resolver.resolve("Al Barshaa Souths");
    expect(resolution.match === null || resolution.candidates.length > 0).toBe(true);
  });
});

describe("resolveOrThrow", () => {
  it("returns the community when confident", () => {
    expect(resolver.resolveOrThrow("Dubai Marina").slug).toBe("marsa-dubai");
  });

  it("throws with a usable hint", () => {
    expect(() => resolver.resolveOrThrow("Manhattan")).toThrow(/did not match any known community/);
  });
});

describe("bySlug", () => {
  it("looks up directly without fuzzing", () => {
    expect(resolver.bySlug("marsa-dubai")?.nameEn).toBe("Marsa Dubai");
    expect(resolver.bySlug("not-a-slug")).toBeNull();
  });
});
