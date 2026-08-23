import { describe, it, expect } from "vitest";
import { dldAreawiseSales, dldAreawiseMortgage } from "../src/sources/dld-areawise.js";
import { getResolver } from "../src/geo/communities.js";
import { SchemaError } from "../src/core/errors.js";
import type { AreaTransactionSummary } from "../src/core/types.js";

/**
 * Fixtures below are verbatim from a live call to
 * gateway.dubailand.gov.ae/areawise/transaction/sales for July 2026, captured
 * in CI. Using the real payload rather than an invented one means these tests
 * fail if DLD changes its response shape, which is the failure we most need to
 * hear about.
 */
const REAL_ENVELOPE = JSON.stringify({
  timeStamp: "2026-08-23T16:48:18.072486+04:00",
  responseCode: 200,
  validationErrorsList: [],
  response: {
    result: [
      {
        areaId: 230,
        area: { englishName: "Abu Hail", arabicName: "ابو هيل" },
        worth: 9900000,
        count: 5,
        propertyCount: 5,
        firstSaleCount: 0,
        projects: [
          {
            projectId: -1,
            name: { englishName: "Other", arabicName: "أخرى" },
            worth: 9900000,
            count: 5,
            propertyCount: 5,
            firstSaleCount: 0,
            parentId: null,
          },
        ],
      },
      {
        areaId: 341,
        area: { englishName: "Marsa Dubai", arabicName: "مرسى دبي" },
        worth: 1250000000,
        count: 400,
        propertyCount: 398,
        firstSaleCount: 120,
        projects: [],
      },
    ],
    additionalData: null,
  },
});

function context() {
  const unresolved: string[] = [];
  return {
    ctx: { resolver: getResolver(), onUnresolved: (raw: string) => unresolved.push(raw) },
    unresolved,
  };
}

describe("dld.areawise source definition", () => {
  it("needs no credentials — the point of this source", () => {
    expect(dldAreawiseSales.requiresAuth).toBe(false);
    expect(dldAreawiseMortgage.requiresAuth).toBe(false);
  });

  it("documents that it is aggregate, not row-level", () => {
    expect(dldAreawiseSales.caveats).toMatch(/aggregate, not row-level/i);
  });

  it("has distinct ids for each transaction kind", () => {
    expect(dldAreawiseSales.id).toBe("dld.areawise-sales");
    expect(dldAreawiseMortgage.id).toBe("dld.areawise-mortgage");
  });
});

describe("parsing DLD's real envelope", () => {
  it("extracts the result array", () => {
    const rows = dldAreawiseSales.parse(REAL_ENVELOPE)!;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.areaId).toBe(230);
  });

  it("throws a typed error on non-JSON rather than crashing obscurely", () => {
    expect(() => dldAreawiseSales.parse("<html>login</html>")).toThrow(SchemaError);
    expect(() => dldAreawiseSales.parse("<html>login</html>")).toThrow(/expected JSON/);
  });

  it("throws when the envelope shape changes", () => {
    expect(() => dldAreawiseSales.parse('{"response":{}}')).toThrow(/no response.result array/);
  });
});

describe("normalising", () => {
  it("carries DLD's official areaId and both name forms", () => {
    const { ctx } = context();
    const rows = dldAreawiseSales.parse(REAL_ENVELOPE)!;
    const record = dldAreawiseSales.normalize(rows[0]!, ctx) as AreaTransactionSummary;

    expect(record.areaId).toBe(230);
    expect(record.areaNameEn).toBe("Abu Hail");
    expect(record.areaNameAr).toBe("ابو هيل");
    expect(record.kind).toBe("sale");
    expect(record.totalWorthAed).toBe(9900000);
    expect(record.transactionCount).toBe(5);
  });

  it("derives mean value per transaction", () => {
    const { ctx } = context();
    const rows = dldAreawiseSales.parse(REAL_ENVELOPE)!;
    const record = dldAreawiseSales.normalize(rows[0]!, ctx) as AreaTransactionSummary;
    expect(record.meanWorthAed).toBe(1_980_000);
  });

  it("joins to the canonical community where the registry knows the area", () => {
    const { ctx } = context();
    const rows = dldAreawiseSales.parse(REAL_ENVELOPE)!;
    const marina = dldAreawiseSales.normalize(rows[1]!, ctx) as AreaTransactionSummary;
    expect(marina.communitySlug).toBe("marsa-dubai");
  });

  it("reports an unresolved area rather than dropping it", () => {
    const { ctx, unresolved } = context();
    const rows = dldAreawiseSales.parse(REAL_ENVELOPE)!;
    const abuHail = dldAreawiseSales.normalize(rows[0]!, ctx) as AreaTransactionSummary;
    // Abu Hail is not in the seed registry, so it must surface as a gap while
    // still being stored with its raw name and official id intact.
    expect(abuHail.communitySlug).toBeNull();
    expect(abuHail.rawLocation).toBe("Abu Hail");
    expect(unresolved).toContain("Abu Hail");
  });

  it("flattens project breakdowns", () => {
    const { ctx } = context();
    const rows = dldAreawiseSales.parse(REAL_ENVELOPE)!;
    const record = dldAreawiseSales.normalize(rows[0]!, ctx) as AreaTransactionSummary;
    expect(record.projects).toHaveLength(1);
    expect(record.projects[0]).toMatchObject({ projectId: -1, nameEn: "Other", worthAed: 9900000 });
  });

  it("skips rows with no id or no name", () => {
    const { ctx } = context();
    expect(dldAreawiseSales.normalize({ worth: 100 } as never, ctx)).toBeNull();
    expect(dldAreawiseSales.normalize({ areaId: 1, area: {} } as never, ctx)).toBeNull();
  });

  it("handles a zero-transaction area without dividing by zero", () => {
    const { ctx } = context();
    const record = dldAreawiseSales.normalize(
      { areaId: 9, area: { englishName: "Nowhere" }, worth: 0, count: 0 } as never,
      ctx,
    ) as AreaTransactionSummary;
    expect(record.meanWorthAed).toBeNull();
  });
});
