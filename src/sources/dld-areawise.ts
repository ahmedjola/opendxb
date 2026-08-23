import { fetchText } from "../core/http.js";
import { SchemaError } from "../core/errors.js";
import type { Source, FetchContext, NormalizeContext } from "./types.js";
import type { AreaTransactionSummary, AreaProjectSummary } from "../core/types.js";

/**
 * DLD areawise transaction summaries.
 *
 * The one Dubai property source that works from anywhere. Dubai Pulse's portal
 * is geo-fenced to the UAE, but dubailand.gov.ae's own open-data pages call
 * this gateway with no user login, and it answers plain fetches from any
 * network. See docs/ACCESS-FINDINGS.md for how that was established.
 *
 * The trade-off is granularity: this returns totals per area per period rather
 * than individual registrations. In exchange it needs no credentials, no
 * account and no UAE presence — and it carries DLD's own `areaId` next to both
 * name forms, which is the authoritative area identifier this project
 * otherwise declines to assert.
 */

const GATEWAY = "https://gateway.dubailand.gov.ae";

/**
 * Public API key served to every anonymous visitor of DLD's open-data pages.
 *
 * Not a credential belonging to any person or account: the page hands it to
 * unauthenticated browsers so they can render the public dashboards. It is
 * overridable because a public key can still be rotated.
 */
const DEFAULT_CONSUMER_ID = "gkb3WvEG0rY9eilwXC0P2pTz8UzvLj9F";

/** DLD's response envelope. */
interface Envelope {
  responseCode?: number;
  validationErrorsList?: unknown[];
  response?: { result?: RawAreaRow[] };
}

interface LocalisedName {
  englishName?: string;
  arabicName?: string;
}

interface RawAreaRow {
  areaId?: number;
  area?: LocalisedName;
  worth?: number;
  count?: number;
  propertyCount?: number;
  firstSaleCount?: number;
  projects?: Array<{
    projectId?: number;
    name?: LocalisedName;
    worth?: number;
    count?: number;
    propertyCount?: number;
    firstSaleCount?: number;
  }>;
}

/** Window the adapter requests. Overridable so backfills can walk history. */
function periodFromEnv(): { from: string; to: string } {
  const from = process.env["OPENDXB_DLD_FROM"];
  const to = process.env["OPENDXB_DLD_TO"];
  if (from && to) return { from, to };

  // Default to the previous complete calendar month. DLD registrations settle
  // over several days, so the current month is always partial and would make
  // consecutive ingests disagree with each other.
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function buildSource(kind: "sales" | "mortgage"): Source<AreaTransactionSummary, RawAreaRow> {
  const recordKind = kind === "sales" ? "sale" : "mortgage";
  const id = `dld.areawise-${kind}`;
  let period = periodFromEnv();

  return {
    id,
    authority: "DLD",
    title: `Area-level ${recordKind} totals`,
    description:
      `Total registered ${recordKind} value, transaction count and property count per Dubai ` +
      `area for a period, from Dubai Land Department's public gateway.`,
    endpoint: `${GATEWAY}/areawise/transaction/${kind}`,
    requiresAuth: false,
    license: "Dubai Open Data Licence (Dubai Data Law No. 26 of 2015)",
    caveats:
      "Aggregate, not row-level: totals per area per period, so it cannot answer questions " +
      "about individual properties or unit sizes. `worth` is registered consideration, which " +
      "for related-party and portfolio transfers is not the economic price. Defaults to the " +
      "previous complete calendar month, because the current month is still settling; set " +
      "OPENDXB_DLD_FROM and OPENDXB_DLD_TO to query another window.",

    async fetchRaw(context: FetchContext): Promise<string> {
      period = periodFromEnv();
      const consumerId = process.env["OPENDXB_DLD_CONSUMER_ID"] ?? DEFAULT_CONSUMER_ID;
      const url =
        `${GATEWAY}/areawise/transaction/${kind}` +
        `?fromDate=${period.from}&toDate=${period.to}&consumer-id=${consumerId}`;

      return fetchText(url, {
        authority: "DLD",
        timeoutMs: 60_000,
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en",
          // Identify honestly against a public government service.
          "user-agent": "opendxb (+https://github.com/ahmedjola/opendxb) open-data client",
          referer: "https://dubailand.gov.ae/",
          origin: "https://dubailand.gov.ae",
        },
        ...(context.signal ? { signal: context.signal } : {}),
      });
    },

    parse(raw: string): RawAreaRow[] {
      let envelope: Envelope;
      try {
        envelope = JSON.parse(raw) as Envelope;
      } catch {
        throw new SchemaError(id, `expected JSON, got: ${raw.slice(0, 200)}`);
      }
      const result = envelope.response?.result;
      if (!Array.isArray(result)) {
        throw new SchemaError(id, `no response.result array; envelope was ${raw.slice(0, 300)}`);
      }
      return result;
    },

    normalize(row: RawAreaRow, context: NormalizeContext): AreaTransactionSummary | null {
      const areaId = row.areaId;
      const nameEn = row.area?.englishName?.trim() ?? "";
      const nameAr = row.area?.arabicName?.trim() ?? "";
      // Without an id or a name there is nothing to join on, and a row with no
      // value carries no information worth storing.
      if (typeof areaId !== "number" || (!nameEn && !nameAr)) return null;

      // Resolve against the English name first, falling back to Arabic: the
      // registry indexes both, and either alone is enough to find the community.
      const resolution = context.resolver.resolve(nameEn || nameAr);
      let communitySlug = resolution.match?.community.slug ?? null;
      if (!communitySlug && nameEn && nameAr) {
        const arabicAttempt = context.resolver.resolve(nameAr);
        communitySlug = arabicAttempt.match?.community.slug ?? null;
      }
      if (!communitySlug) context.onUnresolved(nameEn || nameAr);

      const transactionCount = row.count ?? 0;
      const totalWorthAed = row.worth ?? 0;

      const projects: AreaProjectSummary[] = (row.projects ?? []).map((project) => ({
        projectId: project.projectId ?? -1,
        nameEn: project.name?.englishName ?? "",
        nameAr: project.name?.arabicName ?? "",
        worthAed: project.worth ?? 0,
        transactionCount: project.count ?? 0,
        propertyCount: project.propertyCount ?? 0,
        firstSaleCount: project.firstSaleCount ?? 0,
      }));

      return {
        source: id,
        authority: "DLD",
        communitySlug,
        rawLocation: nameEn || nameAr,
        id: `${id}:${period.from}:${period.to}:${areaId}`,
        kind: recordKind,
        periodFrom: period.from,
        periodTo: period.to,
        areaId,
        areaNameEn: nameEn,
        areaNameAr: nameAr,
        totalWorthAed,
        transactionCount,
        propertyCount: row.propertyCount ?? 0,
        firstSaleCount: row.firstSaleCount ?? 0,
        meanWorthAed: transactionCount > 0 ? Math.round(totalWorthAed / transactionCount) : null,
        projects,
      };
    },
  };
}

export const dldAreawiseSales = buildSource("sales");
export const dldAreawiseMortgage = buildSource("mortgage");
