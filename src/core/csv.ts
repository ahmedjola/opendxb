import { SchemaError } from "./errors.js";

/**
 * RFC 4180 CSV parser.
 *
 * Dubai Pulse ships most datasets as CSV exports, and they contain the things
 * that break naive `split(",")` parsers: quoted fields with embedded commas,
 * doubled quotes, CRLF line endings, a UTF-8 BOM, and Arabic text in the same
 * cell as Latin. Pulling in a CSV dependency for this would be reasonable;
 * doing it here keeps the install graph at two packages and makes the failure
 * modes ours to fix.
 */

/** Parse CSV text into rows of raw string cells. */
export function parseCsvRows(input: string): string[][] {
  // Strip a UTF-8 BOM; Dubai Pulse exports frequently carry one, and it would
  // otherwise become part of the first header name.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = (): void => {
    row.push(field);
    field = "";
  };
  const endRow = (): void => {
    endField();
    // A trailing newline should not produce a phantom empty row.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === "") { inQuotes = true; i++; continue; }
    if (char === ",") { endField(); i++; continue; }
    if (char === "\r") { i++; continue; }
    if (char === "\n") { endRow(); i++; continue; }

    field += char;
    i++;
  }

  if (inQuotes) throw new SchemaError("csv", "unterminated quoted field at end of input");
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

/** Parse CSV text into objects keyed by header name. */
export function parseCsv(input: string): Array<Record<string, string>> {
  const rows = parseCsvRows(input);
  const header = rows[0];
  if (!header) return [];

  // Authorities are inconsistent about header casing and padding; normalising
  // once here means every adapter can look up a stable key.
  const keys = header.map((name) => name.trim());

  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const values = rows[r]!;
    const record: Record<string, string> = {};
    for (let c = 0; c < keys.length; c++) record[keys[c]!] = (values[c] ?? "").trim();
    out.push(record);
  }
  return out;
}

/**
 * Read a field by any of several candidate header names.
 *
 * The same column is called `AREA_EN`, `area_name_en` and `Area` across DLD
 * exports of different vintages, so adapters declare every spelling they have
 * seen rather than breaking when a column is renamed upstream.
 */
export function field(row: Record<string, string>, ...names: string[]): string | null {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== "") return value;
  }
  // Second pass, case-insensitively, for exports that change casing wholesale.
  const lowered = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const value = lowered.get(name.toLowerCase());
    if (value !== undefined && value !== "") return value;
  }
  return null;
}

/** Parse a numeric cell, tolerating thousands separators and blanks. */
export function numberField(row: Record<string, string>, ...names: string[]): number | null {
  const raw = field(row, ...names);
  if (raw === null) return null;
  const cleaned = raw.replace(/[, ]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a date cell to an ISO date string.
 *
 * Dubai exports mix `DD-MM-YYYY`, `YYYY-MM-DD` and ISO timestamps. Day-first
 * is assumed for the ambiguous slash/dash forms because that is what DLD
 * publishes; guessing month-first would shift a third of all rows.
 */
export function dateField(row: Record<string, string>, ...names: string[]): string | null {
  const raw = field(row, ...names);
  if (raw === null) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dayFirst = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(raw);
  if (dayFirst) {
    const day = dayFirst[1]!.padStart(2, "0");
    const month = dayFirst[2]!.padStart(2, "0");
    if (Number(month) > 12) return null;
    return `${dayFirst[3]}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}
