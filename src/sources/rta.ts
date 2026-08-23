import { csvSource, resolveLocation } from "./base.js";
import { field, numberField } from "../core/csv.js";
import type { TransitStation } from "../core/types.js";
import type { NormalizeContext } from "./types.js";

/** RTA public transport station register. */
export const rtaStations = csvSource<TransitStation>({
  id: "rta.stations",
  authority: "RTA",
  title: "Metro, tram and bus stations",
  description: "RTA public transport stations with mode, line and coordinates.",
  endpoint: "https://www.dubaipulse.gov.ae/dataset/rta-transport-stations/resource/stations.csv",
  requiresAuth: false,
  license: "Dubai Open Data Licence",

  normalize(row, context: NormalizeContext): TransitStation | null {
    const nameEn = field(row, "station_name_en", "name_en", "STATION_NAME");
    if (!nameEn) return null;

    const { communitySlug, rawLocation } = resolveLocation(
      row, context, "area_en", "area", "community", "AREA_EN",
    );
    const modeRaw = (field(row, "mode", "type_en", "transport_mode") ?? "").toLowerCase();
    const mode: TransitStation["mode"] =
      modeRaw.includes("tram") ? "tram"
      : modeRaw.includes("bus") ? "bus"
      : modeRaw.includes("ferry") || modeRaw.includes("marine") ? "ferry"
      : "metro";

    return {
      source: "rta.stations",
      authority: "RTA",
      communitySlug,
      rawLocation,
      id: field(row, "station_id", "id", "STATION_ID") ?? nameEn,
      nameEn,
      nameAr: field(row, "station_name_ar", "name_ar"),
      mode,
      line: field(row, "line_en", "line", "LINE"),
      lat: numberField(row, "latitude", "lat", "y"),
      lng: numberField(row, "longitude", "lng", "lon", "x"),
    };
  },
});
