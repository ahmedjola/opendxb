import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CommunityResolver, type ResolverOptions } from "./resolver.js";
import type { Community } from "./types.js";

interface RawCommunity {
  slug: string;
  nameEn: string;
  nameAr: string;
  marketNames?: string[];
  marketNamesAr?: string[];
  communityNumber?: number | null;
  sectorNumber?: number | null;
}

interface RegistryFile {
  version: string;
  communities: RawCommunity[];
}

/**
 * Locate `data/communities.json` by walking up from this module.
 *
 * The same code runs from `src/geo/` under vitest and from `dist/geo/` once
 * published, and the data directory sits beside both. Walking up is more
 * robust than a relative path that has to be right in two different layouts.
 */
function findRegistryFile(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(dir, "data", "communities.json");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "opendxb: could not locate data/communities.json. If you are consuming this " +
      "package from a bundler, ensure the `data` directory ships alongside `dist`.",
  );
}

let cached: Community[] | null = null;

/** The bundled canonical community registry. Parsed once per process. */
export function loadCommunities(): readonly Community[] {
  if (cached) return cached;
  const parsed = JSON.parse(readFileSync(findRegistryFile(), "utf8")) as RegistryFile;
  cached = parsed.communities.map((raw) => ({
    slug: raw.slug,
    nameEn: raw.nameEn,
    nameAr: raw.nameAr,
    marketNames: raw.marketNames ?? [],
    marketNamesAr: raw.marketNamesAr ?? [],
    communityNumber: raw.communityNumber ?? null,
    sectorNumber: raw.sectorNumber ?? null,
  }));
  return cached;
}

let defaultResolver: CommunityResolver | null = null;

/** Shared resolver over the bundled registry. */
export function getResolver(options?: ResolverOptions): CommunityResolver {
  if (options) return new CommunityResolver(loadCommunities(), options);
  defaultResolver ??= new CommunityResolver(loadCommunities());
  return defaultResolver;
}
