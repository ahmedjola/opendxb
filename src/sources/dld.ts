import { csvSource, resolveLocation, classifyPropertyType } from "./base.js";
import { field, numberField, dateField } from "../core/csv.js";
import type { PropertyTransaction, RentalContract, TransactionKind } from "../core/types.js";
import type { NormalizeContext } from "./types.js";

/**
 * Dubai Land Department sources.
 *
 * DLD publishes the registry of every property transaction and every
 * registered tenancy contract in the emirate. Column names have drifted across
 * export vintages, so each field is read through a list of every spelling
 * observed in the wild rather than a single key.
 */

const DLD_LICENSE = "Dubai Open Data Licence (Dubai Data Law No. 26 of 2015)";

/** Location columns DLD uses, in decreasing order of specificity. */
const DLD_LOCATION_COLUMNS = [
  "area_name_en", "AREA_EN", "area_en", "Area", "AREA",
  "master_project_en", "nearest_landmark_en",
];

function transactionKind(raw: string | null): TransactionKind {
  if (!raw) return "sale";
  const text = raw.toLowerCase();
  if (text.includes("mortgage")) return "mortgage";
  if (text.includes("gift") || text.includes("grant")) return "gift";
  return "sale";
}

export const dldTransactions = csvSource<PropertyTransaction>({
  id: "dld.transactions",
  authority: "DLD",
  title: "Property transactions",
  description:
    "Every property sale, mortgage and gift registered with Dubai Land Department, " +
    "with amount, area, property type and location.",
  endpoint: "https://www.dubaipulse.gov.ae/dataset/dld_transactions-open/resource/transactions.csv",
  requiresAuth: true,
  license: DLD_LICENSE,
  caveats:
    "DLD publishes the full history in one export rather than a delta feed, so a " +
    "first ingest is large. Amounts are the registered consideration, which is not " +
    "always the economic price — related-party transfers and portfolio deals appear " +
    "at values that will distort a naive average.",

  normalize(row, context: NormalizeContext): PropertyTransaction | null {
    const amountAed = numberField(row, "actual_worth", "amount", "trans_value", "TRANS_VALUE");
    const date = dateField(row, "instance_date", "transaction_date", "DATE", "date");
    // A transaction with no date or no value cannot support any downstream
    // analysis, so it is dropped rather than stored as a partial row.
    if (amountAed === null || amountAed <= 0 || date === null) return null;

    const areaSqm = numberField(row, "procedure_area", "area", "actual_area", "AREA_SQM");
    const { communitySlug, rawLocation } = resolveLocation(row, context, ...DLD_LOCATION_COLUMNS);
    const id =
      field(row, "transaction_id", "trans_id", "TRANSACTION_ID") ??
      `${date}:${amountAed}:${rawLocation ?? "unknown"}`;

    const offPlanRaw = field(row, "reg_type_en", "is_offplan", "REG_TYPE_EN");

    return {
      source: "dld.transactions",
      authority: "DLD",
      communitySlug,
      rawLocation,
      id,
      date,
      kind: transactionKind(field(row, "group_en", "trans_group_en", "procedure_en")),
      propertyType: classifyPropertyType(field(row, "property_type_en", "property_sub_type_en", "PROP_TYPE_EN")),
      rooms: field(row, "rooms_en", "rooms", "ROOMS_EN"),
      areaSqm,
      amountAed,
      pricePerSqm: areaSqm && areaSqm > 0 ? Math.round(amountAed / areaSqm) : null,
      projectName: field(row, "project_name_en", "master_project_en", "PROJECT_EN"),
      isOffPlan: offPlanRaw ? /off.?plan/i.test(offPlanRaw) : null,
    };
  },
});

export const dldRents = csvSource<RentalContract>({
  id: "dld.rents",
  authority: "DLD",
  title: "Registered tenancy contracts (Ejari)",
  description:
    "Registered residential and commercial tenancy contracts, with annual rent, " +
    "area, property type and location.",
  endpoint: "https://www.dubaipulse.gov.ae/dataset/dld_rent_contracts-open/resource/rent_contracts.csv",
  requiresAuth: true,
  license: DLD_LICENSE,
  caveats:
    "Registration is the landlord's obligation and compliance is imperfect, so the " +
    "contract set understates the true rental market, particularly at the low end. " +
    "Rents are as registered and exclude the fees and deposits a tenant actually pays.",

  normalize(row, context: NormalizeContext): RentalContract | null {
    const annualRentAed = numberField(row, "annual_amount", "contract_amount", "ANNUAL_AMOUNT");
    const startDate = dateField(row, "contract_start_date", "start_date", "REGISTRATION_DATE");
    if (annualRentAed === null || annualRentAed <= 0 || startDate === null) return null;

    const { communitySlug, rawLocation } = resolveLocation(row, context, ...DLD_LOCATION_COLUMNS);
    const versionRaw = field(row, "version_en", "contract_type", "VERSION_EN");

    return {
      source: "dld.rents",
      authority: "DLD",
      communitySlug,
      rawLocation,
      id:
        field(row, "contract_id", "ejari_contract_number", "CONTRACT_ID") ??
        `${startDate}:${annualRentAed}:${rawLocation ?? "unknown"}`,
      startDate,
      endDate: dateField(row, "contract_end_date", "end_date"),
      annualRentAed,
      areaSqm: numberField(row, "actual_area", "area", "PROPERTY_SIZE"),
      rooms: field(row, "ejari_property_type_en", "rooms", "ROOMS"),
      propertyType: classifyPropertyType(field(row, "property_type_en", "ejari_property_type_en")),
      isRenewal: versionRaw ? /renew/i.test(versionRaw) : null,
    };
  },
});
