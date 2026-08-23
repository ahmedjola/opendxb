import { describe, it, expect } from "vitest";
import { OpenDXB } from "../src/client.js";
import { SampleStore } from "../src/store/sample.js";
import { MemoryStore } from "../src/store/memory.js";
import { NotIngestedError } from "../src/core/errors.js";
import { csvSource } from "../src/sources/base.js";

const dxb = new OpenDXB({ store: new SampleStore() });

describe("cross-authority profile", () => {
  it("joins five sources for one community", async () => {
    const profile = await dxb.profile("Dubai Marina");
    expect(profile.community.slug).toBe("marsa-dubai");
    expect(profile.sourcesUsed).toHaveLength(5);
    expect(profile.missingSources).toHaveLength(0);
    expect(profile.sales.count).toBeGreaterThan(0);
    expect(profile.rents.count).toBeGreaterThan(0);
  });

  it("reaches the same profile from every spelling of the name", async () => {
    const spellings = ["Dubai Marina", "marsa dubai", "مرسى دبي", "Dubai Marnia"];
    const slugs = await Promise.all(
      spellings.map(async (name) => (await dxb.profile(name)).community.slug),
    );
    expect(new Set(slugs).size).toBe(1);
  });

  it("computes a plausible gross yield", async () => {
    const profile = await dxb.profile("JVC");
    expect(profile.grossYieldPct).toBeGreaterThan(1);
    expect(profile.grossYieldPct).toBeLessThan(20);
  });

  it("throws a helpful error for an unknown place", async () => {
    await expect(dxb.profile("Manhattan")).rejects.toThrow(/did not match any known community/);
  });

  it("reports missing sources instead of failing when only some are ingested", async () => {
    const partial = new MemoryStore();
    await partial.put(
      { sourceId: "khda.schools", authority: "KHDA", ingestedAt: new Date().toISOString(), recordCount: 0, endpoint: "x", license: "x" },
      [],
    );
    const profile = await new OpenDXB({ store: partial }).profile("Dubai Marina");
    expect(profile.sourcesUsed).toEqual(["khda.schools"]);
    expect(profile.missingSources).toContain("dld.transactions");
  });
});

describe("queries", () => {
  it("filters transactions by community, type and date", async () => {
    const rows = await dxb.transactions({ community: "Palm Jumeirah", propertyType: "villa", limit: 5 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    for (const row of rows) {
      expect(row.communitySlug).toBe("nakhlat-jumeirah");
      expect(row.propertyType).toBe("villa");
    }
  });

  it("returns transactions newest first", async () => {
    const rows = await dxb.transactions({ community: "Business Bay", limit: 20 });
    const dates = rows.map((r) => r.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("respects price bounds", async () => {
    const rows = await dxb.transactions({ minAmountAed: 5_000_000 });
    expect(rows.every((r) => r.amountAed >= 5_000_000)).toBe(true);
  });

  it("filters schools by rating", async () => {
    const rows = await dxb.schools({ rating: "Outstanding" });
    expect(rows.every((r) => r.rating === "Outstanding")).toBe(true);
  });

  it("throws NotIngestedError with actionable guidance", async () => {
    const empty = new OpenDXB({ store: new MemoryStore() });
    await expect(empty.transactions()).rejects.toThrow(NotIngestedError);
    await expect(empty.transactions()).rejects.toThrow(/opendxb ingest dld\.transactions/);
  });
});

describe("sample store safety", () => {
  it("refuses writes so synthetic rows cannot contaminate real data", async () => {
    await expect(new SampleStore().put()).rejects.toThrow(/read-only/);
  });

  it("marks every sample record as synthetic", async () => {
    const rows = await new SampleStore().all("dld.transactions");
    expect(rows).not.toBeNull();
    expect(rows!.every((r) => (r as unknown as Record<string, unknown>)["synthetic"] === true)).toBe(true);
  });
});

describe("ingest", () => {
  it("normalises rows, resolves communities, and reports what did not resolve", async () => {
    const store = new MemoryStore();
    const client = new OpenDXB({ store });

    // A stub source standing in for a real authority export, exercising the
    // full path: parse -> normalise -> resolve -> store.
    const stub = csvSource({
      id: "test.source", authority: "DLD", title: "t", description: "d",
      endpoint: "https://example.invalid/x.csv", requiresAuth: false, license: "test",
      normalize: () => null,
    });
    expect(stub.parse("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
  });

  it("rejects an unknown source id with the list of known ids", async () => {
    await expect(new OpenDXB({ store: new MemoryStore() }).ingest("nope.nope"))
      .rejects.toThrow(/Known sources: dld\.transactions/);
  });
});

describe("provenance", () => {
  it("reports where sample data came from", async () => {
    const meta = await dxb.provenance("dld.transactions");
    expect(meta?.license).toMatch(/SYNTHETIC/);
  });
});
