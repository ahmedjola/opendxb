#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenDXB, defaultDataDir, credentialsFromEnv } from "../client.js";
import { SampleStore } from "../store/sample.js";
import { FileStore } from "../store/file.js";
import { ALL_SOURCES } from "../sources/index.js";

/**
 * MCP server exposing the Dubai data layer to AI agents.
 *
 * The tools are shaped around the questions people actually ask — "what does
 * it cost to live in JVC", "which communities have Outstanding schools" —
 * rather than mirroring the underlying datasets. An agent should not have to
 * know that DLD calls Dubai Marina "Marsa Dubai" in order to answer a question
 * about Dubai Marina.
 *
 * Every response states its provenance, and sample-backed responses say so in
 * the payload, so a model cannot present synthetic figures as registry data.
 */

const useSample = process.env["OPENDXB_SAMPLE"] === "1";
const credentials = credentialsFromEnv();

const dxb = new OpenDXB({
  store: useSample ? new SampleStore() : new FileStore(defaultDataDir()),
  ...(credentials ? { credentials } : {}),
});

const server = new McpServer({ name: "opendxb", version: "0.1.0" });

/** Wrap a payload as MCP text content, tagging synthetic data unmistakably. */
function reply(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  const body = useSample
    ? { dataSource: "SYNTHETIC SAMPLE — illustrative only, not Dubai registry data", ...(payload as object) }
    : payload;
  return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
}

function fail(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: message }], isError: true };
}

server.registerTool(
  "dubai_resolve_community",
  {
    title: "Resolve a Dubai place name",
    description:
      "Resolve any spelling of a Dubai place name — official DLD name, market name, " +
      "Arabic, abbreviation, or misspelling — to one canonical community. Use this " +
      "whenever a user names a Dubai area, before querying anything else. Returns null " +
      "with candidates rather than guessing when the name is ambiguous.",
    inputSchema: { name: z.string().describe("Any spelling, e.g. 'JVC', 'مرسى دبي', 'Al Barsha 1'") },
  },
  async ({ name }) => {
    try {
      const resolution = dxb.resolve(name);
      return reply({
        query: resolution.query,
        resolved: resolution.match
          ? {
              slug: resolution.match.community.slug,
              nameEn: resolution.match.community.nameEn,
              nameAr: resolution.match.community.nameAr,
              alsoKnownAs: resolution.match.community.marketNames,
              matchKind: resolution.match.kind,
              confidence: resolution.match.score,
            }
          : null,
        ambiguous: resolution.ambiguous,
        candidates: resolution.candidates.map((c) => ({
          slug: c.community.slug, nameEn: c.community.nameEn, score: c.score,
        })),
      });
    } catch (error) { return fail(error); }
  },
);

server.registerTool(
  "dubai_community_profile",
  {
    title: "Cross-authority profile of a Dubai community",
    description:
      "Everything four Dubai authorities know about one community, joined: property " +
      "sale prices and rents (DLD), school count and inspection ratings (KHDA), " +
      "licensed health facilities (DHA), and transit stations (RTA). This join does " +
      "not exist in any single Dubai government portal.",
    inputSchema: { name: z.string().describe("Community name in any spelling") },
  },
  async ({ name }) => {
    try {
      const profile = await dxb.profile(name);
      return reply({
        ...profile,
        note:
          "grossYieldPct is indicative only: it is median rent over median sale price " +
          "across all unit sizes, and excludes service charges, vacancy and transaction costs.",
      });
    } catch (error) { return fail(error); }
  },
);

server.registerTool(
  "dubai_property_transactions",
  {
    title: "Query registered property transactions",
    description:
      "Registered property sales, mortgages and gifts from Dubai Land Department, " +
      "filtered by community, date range, property type and price.",
    inputSchema: {
      community: z.string().optional().describe("Community name in any spelling"),
      from: z.string().optional().describe("ISO date, inclusive lower bound"),
      to: z.string().optional().describe("ISO date, inclusive upper bound"),
      propertyType: z.enum(["apartment", "villa", "land", "building", "office", "shop", "other"]).optional(),
      kind: z.enum(["sale", "mortgage", "gift"]).optional(),
      limit: z.number().int().positive().max(500).default(50),
    },
  },
  async (args) => {
    try {
      const rows = await dxb.transactions(args);
      return reply({ count: rows.length, transactions: rows });
    } catch (error) { return fail(error); }
  },
);

server.registerTool(
  "dubai_schools",
  {
    title: "Query Dubai private schools",
    description:
      "KHDA-inspected private schools, optionally filtered by community and inspection rating.",
    inputSchema: {
      community: z.string().optional(),
      rating: z.enum(["Outstanding", "Very Good", "Good", "Acceptable", "Weak", "Very Weak"]).optional(),
    },
  },
  async (args) => {
    try {
      const rows = await dxb.schools(args);
      return reply({ count: rows.length, schools: rows });
    } catch (error) { return fail(error); }
  },
);

server.registerTool(
  "dubai_list_communities",
  {
    title: "List canonical Dubai communities",
    description:
      "The canonical community registry: official DLD English and Arabic names plus " +
      "the market names residents and portals use for each.",
    inputSchema: {},
  },
  async () => {
    try {
      return reply({
        count: dxb.communities.length,
        communities: dxb.communities.map((c) => ({
          slug: c.slug, nameEn: c.nameEn, nameAr: c.nameAr, alsoKnownAs: c.marketNames,
        })),
      });
    } catch (error) { return fail(error); }
  },
);

server.registerTool(
  "dubai_data_sources",
  {
    title: "List data sources and their freshness",
    description:
      "Which Dubai authorities this layer covers, whether each has been ingested " +
      "locally, when, and the caveats that apply to interpreting it.",
    inputSchema: {},
  },
  async () => {
    try {
      const rows = await Promise.all(
        ALL_SOURCES.map(async (source) => ({
          id: source.id,
          authority: source.authority,
          title: source.title,
          requiresAuth: source.requiresAuth,
          license: source.license,
          caveats: source.caveats ?? null,
          provenance: await dxb.provenance(source.id),
        })),
      );
      return reply({ sources: rows });
    } catch (error) { return fail(error); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
