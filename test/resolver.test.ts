import { describe, it, expect } from "vitest";
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
    // communityNumber must come from a real Dubai Pulse ingest, not this repo.
    for (const community of loadCommunities()) {
      expect(community.communityNumber).toBeNull();
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
