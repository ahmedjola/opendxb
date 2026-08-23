import { dldTransactions, dldRents } from "./dld.js";
import { khdaSchools } from "./khda.js";
import { dhaFacilities } from "./dha.js";
import { rtaStations } from "./rta.js";
import type { Source } from "./types.js";
import type { DubaiRecord } from "../core/types.js";

export { dldTransactions, dldRents, khdaSchools, dhaFacilities, rtaStations };
export * from "./types.js";
export { csvSource, resolveLocation, classifyPropertyType, endpointEnvVar } from "./base.js";

/** Every source the layer knows how to ingest. */
export const ALL_SOURCES: ReadonlyArray<Source<DubaiRecord>> = [
  dldTransactions as Source<DubaiRecord>,
  dldRents as Source<DubaiRecord>,
  khdaSchools as Source<DubaiRecord>,
  dhaFacilities as Source<DubaiRecord>,
  rtaStations as Source<DubaiRecord>,
];

/** Look up a source by its dotted id. */
export function getSource(id: string): Source<DubaiRecord> | null {
  return ALL_SOURCES.find((source) => source.id === id) ?? null;
}
