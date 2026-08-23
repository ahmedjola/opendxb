import { csvSource, resolveLocation } from "./base.js";
import { field, numberField } from "../core/csv.js";
import type { School, KhdaRating } from "../core/types.js";
import type { NormalizeContext } from "./types.js";

/**
 * KHDA private school register.
 *
 * KHDA inspects every private school in Dubai and publishes ratings, curricula
 * and enrolment. It is the counterpart most worth joining against DLD: "what
 * does it cost to live within reach of an Outstanding school" is a question
 * neither authority can answer alone.
 */

/** KHDA's six-point inspection scale, normalised from free-text spellings. */
function parseRating(raw: string | null): KhdaRating {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (text.startsWith("outstanding")) return "Outstanding";
  if (text.startsWith("very good")) return "Very Good";
  if (text.startsWith("very weak")) return "Very Weak";
  if (text.startsWith("good")) return "Good";
  if (text.startsWith("acceptable")) return "Acceptable";
  if (text.startsWith("weak")) return "Weak";
  return null;
}

export const khdaSchools = csvSource<School>({
  id: "khda.schools",
  authority: "KHDA",
  title: "Private schools and inspection ratings",
  description:
    "Dubai private schools with KHDA inspection rating, curriculum, enrolment and fee range.",
  endpoint: "https://www.dubaipulse.gov.ae/dataset/khda-private-schools/resource/schools.csv",
  requiresAuth: false,
  license: "Dubai Open Data Licence",
  caveats:
    "Ratings are from the most recent published inspection cycle and schools are not " +
    "all inspected in the same year, so two ratings are not always contemporaneous. " +
    "Fee bands are the approved maxima, not what a given family pays.",

  normalize(row, context: NormalizeContext): School | null {
    const nameEn = field(row, "school_name_en", "name_en", "SCHOOL_NAME", "School Name");
    if (!nameEn) return null;

    const { communitySlug, rawLocation } = resolveLocation(
      row, context, "area_en", "area", "community", "AREA_EN", "location_en",
    );

    return {
      source: "khda.schools",
      authority: "KHDA",
      communitySlug,
      rawLocation,
      id: field(row, "school_id", "id", "SCHOOL_ID") ?? nameEn,
      nameEn,
      nameAr: field(row, "school_name_ar", "name_ar", "SCHOOL_NAME_AR"),
      curriculum: field(row, "curriculum_en", "curriculum", "CURRICULUM"),
      rating: parseRating(field(row, "rating_en", "inspection_rating", "RATING", "dsib_rating")),
      studentCount: numberField(row, "total_students", "students", "STUDENT_COUNT", "enrolment"),
      feeMinAed: numberField(row, "min_fee", "fee_min", "MIN_FEE"),
      feeMaxAed: numberField(row, "max_fee", "fee_max", "MAX_FEE"),
    };
  },
});
