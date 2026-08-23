import { dldTransactions, dldRents } from "./dld.js";
import { dldAreawiseSales, dldAreawiseMortgage } from "./dld-areawise.js";
import { khdaSchools } from "./khda.js";
import { dhaFacilities } from "./dha.js";
import { rtaStations } from "./rta.js";
import type { Source } from "./types.js";
import type { DubaiRecord } from "../core/types.js";

export { dldTransactions, dldRents, dldAreawiseSales, dldAreawiseMortgage, khdaSchools, dhaFacilities, rtaStations };
export * from "./types.js";
export { csvSource, resolveLocation, classifyPropertyType, endpointEnvVar } from "./base.js";

/**
 * Every source the layer knows how to ingest.
 *
 * The areawise pair comes first because they are the only property sources
 * that work without credentials or a UAE IP — for most users they are the
 * ones that will actually run.
 */
export const ALL_SOURCES: ReadonlyArray<Source<DubaiRecord, any>> = [
  dldAreawiseSales as Source<DubaiRecord, any>,
  dldAreawiseMortgage as Source<DubaiRecord, any>,
  dldTransactions as Source<DubaiRecord, any>,
  dldRents as Source<DubaiRecord, any>,
  khdaSchools as Source<DubaiRecord, any>,
  dhaFacilities as Source<DubaiRecord, any>,
  rtaStations as Source<DubaiRecord, any>,
];

/** Look up a source by its dotted id. */
export function getSource(id: string): Source<DubaiRecord, any> | null {
  return ALL_SOURCES.find((source) => source.id === id) ?? null;
}
