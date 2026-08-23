import { csvSource, resolveLocation } from "./base.js";
import { field } from "../core/csv.js";
import type { HealthFacility } from "../core/types.js";
import type { NormalizeContext } from "./types.js";

/** Dubai Health Authority licensed facility register. */
export const dhaFacilities = csvSource<HealthFacility>({
  id: "dha.facilities",
  authority: "DHA",
  title: "Licensed health facilities",
  description: "Hospitals, clinics, pharmacies and diagnostic centres licensed by DHA.",
  endpoint: "https://www.dubaipulse.gov.ae/dataset/dha-health-facilities/resource/facilities.csv",
  requiresAuth: false,
  license: "Dubai Open Data Licence",
  caveats:
    "A licence record says a facility is permitted to operate, not that it is open, " +
    "accepting patients, or covered by any given insurance network.",

  normalize(row, context: NormalizeContext): HealthFacility | null {
    const nameEn = field(row, "facility_name_en", "name_en", "FACILITY_NAME");
    if (!nameEn) return null;

    const { communitySlug, rawLocation } = resolveLocation(
      row, context, "area_en", "area", "community_en", "AREA_EN", "location",
    );
    const sectorRaw = field(row, "sector", "facility_sector", "SECTOR");

    return {
      source: "dha.facilities",
      authority: "DHA",
      communitySlug,
      rawLocation,
      id: field(row, "facility_id", "license_number", "id") ?? nameEn,
      nameEn,
      nameAr: field(row, "facility_name_ar", "name_ar"),
      facilityType: field(row, "facility_type_en", "type_en", "category"),
      sector: sectorRaw ? (/public|government/i.test(sectorRaw) ? "public" : "private") : null,
    };
  },
});
