/**
 * Dubai, as a stylised strip.
 *
 * This is NOT a survey map and does not claim to be one. It is the city as
 * people describe it to each other — a line of named areas strung along Sheikh
 * Zayed Road, the Creek at one end and the Marina at the other, sea to one side
 * and desert to the other. Distances are compressed to whatever is walkable.
 *
 * Order matters: `x` is in tiles from the north-east end, and the districts are
 * laid out in real geographic sequence, so travelling right takes you the same
 * way down the road that it does in life.
 */

export interface District {
  id: string;
  nameEn: string;
  nameAr: string;
  /**
   * A short label for the map strip.
   *
   * Explicit rather than derived: taking the first word of the full name gave
   * "Bur" for "Bur Dubai & Al Fahidi" and "Business" for "Business Bay & DIFC".
   */
  shortEn: string;
  shortAr: string;
  /** Left edge, in tiles. */
  x: number;
  /** Width, in tiles. */
  width: number;
  /** What you would actually be here for. Shown on the map screen. */
  blurbEn: string;
  /** Landmark sprite key, or null where the area has no single skyline shape. */
  landmark: string | null;
  /** Ground colour band, so each area is recognisable from the minimap alone. */
  tint: number;
  /** Office ids sited in this district. */
  offices: readonly string[];
}

/**
 * The districts, north-east to south-west.
 *
 * Everything a newcomer is sent to in their first weeks happens somewhere on
 * this line, which is why the paperwork and the map can share one geography.
 */
export const DISTRICTS: readonly District[] = [
  {
    id: 'deira',
    nameEn: 'Deira & the Creek',
    nameAr: 'ديرة والخور',
    shortEn: 'Deira',
    shortAr: 'ديرة',
    x: 0,
    width: 34,
    blurbEn: 'The old city. Souks, the abra crossing, and the oldest addresses in Dubai.',
    landmark: 'abra',
    tint: 0x8a6b45,
    offices: ['records-desk'],
  },
  {
    id: 'bur-dubai',
    nameEn: 'Bur Dubai & Al Fahidi',
    nameAr: 'بر دبي والفهيدي',
    shortEn: 'Bur Dubai',
    shortAr: 'بر دبي',
    x: 34,
    width: 30,
    blurbEn: 'Wind towers, the historical quarter, and the other bank of the Creek.',
    landmark: 'wind-tower',
    tint: 0xa8895c,
    offices: ['residency-desk'],
  },
  {
    id: 'downtown',
    nameEn: 'Downtown',
    nameAr: 'وسط المدينة',
    shortEn: 'Downtown',
    shortAr: 'وسط المدينة',
    x: 64,
    width: 34,
    blurbEn: 'The Burj Khalifa, the fountain, and the address everyone recognises.',
    landmark: 'burj-khalifa',
    tint: 0xc4a877,
    offices: ['housing-desk'],
  },
  {
    id: 'business-bay',
    nameEn: 'Business Bay & DIFC',
    nameAr: 'الخليج التجاري ومركز دبي المالي',
    shortEn: 'Business Bay',
    shortAr: 'الخليج التجاري',
    x: 98,
    width: 30,
    blurbEn: 'Offices, banks and the financial district. Where the paperwork gets signed.',
    landmark: 'marina-towers',
    tint: 0xb9b0a0,
    offices: ['utilities-desk'],
  },
  {
    id: 'jumeirah',
    nameEn: 'Jumeirah & the coast',
    nameAr: 'جميرا والساحل',
    shortEn: 'Jumeirah',
    shortAr: 'جميرا',
    x: 128,
    width: 32,
    blurbEn: 'The beach road, low villas, and the Burj Al Arab standing off it.',
    landmark: 'burj-al-arab',
    tint: 0xd9bf8f,
    offices: ['everyday-desk'],
  },
  {
    id: 'marina',
    nameEn: 'Marina & JBR',
    nameAr: 'المارينا وجي بي آر',
    shortEn: 'Marina',
    shortAr: 'المارينا',
    x: 160,
    width: 34,
    blurbEn: 'Towers packed along the water. Where most new arrivals end up renting.',
    landmark: 'marina-towers',
    tint: 0xc3bcab,
    offices: ['roads-desk'],
  },
];

const BY_ID = new Map(DISTRICTS.map((district) => [district.id, district]));

export function getDistrict(id: string): District | undefined {
  return BY_ID.get(id);
}

/** Total world width, in tiles. Derived, so adding a district cannot desync it. */
export const WORLD_TILES = DISTRICTS.reduce(
  (max, district) => Math.max(max, district.x + district.width),
  0,
);

/** Which district a tile column falls in. Null past either end of the strip. */
export function districtAt(tileX: number): District | null {
  for (const district of DISTRICTS) {
    if (tileX >= district.x && tileX < district.x + district.width) return district;
  }
  return null;
}

/** Where fast travel drops you: the middle of the district, on the road. */
export function arrivalTile(district: District): number {
  return district.x + Math.floor(district.width / 2);
}

/** The district holding a given office, for "where do I go for this?". */
export function districtForOffice(officeId: string): District | null {
  return DISTRICTS.find((district) => district.offices.includes(officeId)) ?? null;
}
