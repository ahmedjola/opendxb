/** Dubai government entities this layer draws from. */
export type Authority =
  | "DLD"    // Dubai Land Department
  | "KHDA"   // Knowledge and Human Development Authority
  | "DHA"    // Dubai Health Authority
  | "RTA"    // Roads and Transport Authority
  | "DM"     // Dubai Municipality
  | "DET"    // Dubai Department of Economy and Tourism
  | "DSC";   // Dubai Statistics Centre

/**
 * Fields every record in the layer carries.
 *
 * `communitySlug` is the point of the whole exercise: it is what lets a KHDA
 * school row and a DLD transaction row meet, which neither authority can do
 * for you because each publishes only its own vertical.
 */
export interface DubaiRecord {
  /** Source identifier, e.g. "dld.transactions". */
  readonly source: string;
  readonly authority: Authority;
  /** Canonical community, or null when the row's location could not be resolved. */
  readonly communitySlug: string | null;
  /** The location string exactly as the authority published it, for auditing. */
  readonly rawLocation: string | null;
}

export type TransactionKind = "sale" | "mortgage" | "gift";
export type PropertyType = "apartment" | "villa" | "land" | "building" | "office" | "shop" | "other";

/** A registered property transaction (DLD). */
export interface PropertyTransaction extends DubaiRecord {
  readonly id: string;
  /** ISO date, YYYY-MM-DD. */
  readonly date: string;
  readonly kind: TransactionKind;
  readonly propertyType: PropertyType;
  readonly rooms: string | null;
  readonly areaSqm: number | null;
  readonly amountAed: number;
  /** Derived; null when area is missing or zero. */
  readonly pricePerSqm: number | null;
  readonly projectName: string | null;
  readonly isOffPlan: boolean | null;
}

/** A registered tenancy contract (DLD / Ejari). */
export interface RentalContract extends DubaiRecord {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly annualRentAed: number;
  readonly areaSqm: number | null;
  readonly rooms: string | null;
  readonly propertyType: PropertyType;
  readonly isRenewal: boolean | null;
}

export type KhdaRating =
  | "Outstanding" | "Very Good" | "Good" | "Acceptable" | "Weak" | "Very Weak" | null;

/** A private school inspected by KHDA. */
export interface School extends DubaiRecord {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly curriculum: string | null;
  readonly rating: KhdaRating;
  readonly studentCount: number | null;
  readonly feeMinAed: number | null;
  readonly feeMaxAed: number | null;
}

/** A licensed health facility (DHA). */
export interface HealthFacility extends DubaiRecord {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly facilityType: string | null;
  readonly sector: "public" | "private" | null;
}

/** A metro, tram or bus station (RTA). */
export interface TransitStation extends DubaiRecord {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string | null;
  readonly mode: "metro" | "tram" | "bus" | "ferry";
  readonly line: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
}

/** Union of everything the layer stores. */
export type AnyRecord =
  | PropertyTransaction | RentalContract | School | HealthFacility | TransitStation;
