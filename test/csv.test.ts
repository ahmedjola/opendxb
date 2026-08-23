import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvRows, field, numberField, dateField } from "../src/core/csv.js";

describe("parseCsvRows", () => {
  it("handles quoted fields containing commas and newlines", () => {
    const rows = parseCsvRows('a,"b,c",d\n1,"line1\nline2",3\n');
    expect(rows[0]).toEqual(["a", "b,c", "d"]);
    expect(rows[1]).toEqual(["1", "line1\nline2", "3"]);
  });

  it("handles doubled quotes as an escaped quote", () => {
    expect(parseCsvRows('a,"say ""hi""",c')[0]).toEqual(["a", 'say "hi"', "c"]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("strips a UTF-8 BOM so the first header is not corrupted", () => {
    const rows = parseCsvRows("﻿area_name_en,amount\nDubai Marina,100");
    expect(rows[0]?.[0]).toBe("area_name_en");
  });

  it("does not emit a phantom row for a trailing newline", () => {
    expect(parseCsvRows("a,b\n1,2\n").length).toBe(2);
  });

  it("preserves Arabic cells", () => {
    expect(parseCsvRows("name\nمرسى دبي")[1]).toEqual(["مرسى دبي"]);
  });

  it("throws on an unterminated quoted field rather than silently truncating", () => {
    expect(() => parseCsvRows('a,"unterminated')).toThrow(/unterminated/);
  });

  it("returns empty for empty input", () => {
    expect(parseCsvRows("")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("keys rows by trimmed header names", () => {
    const rows = parseCsv(" area , amount \nDubai Marina, 1000 ");
    expect(rows[0]).toEqual({ area: "Dubai Marina", amount: "1000" });
  });

  it("pads short rows rather than misaligning columns", () => {
    const rows = parseCsv("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("field", () => {
  const row = { AREA_EN: "Dubai Marina", amount: "100", blank: "" };

  it("returns the first non-empty candidate", () => {
    expect(field(row, "missing", "AREA_EN")).toBe("Dubai Marina");
    expect(field(row, "blank", "amount")).toBe("100");
  });

  it("falls back to a case-insensitive match, since exports rename columns", () => {
    expect(field(row, "area_en")).toBe("Dubai Marina");
  });

  it("returns null when nothing matches", () => {
    expect(field(row, "nope")).toBeNull();
  });
});

describe("numberField", () => {
  it("strips thousands separators", () => {
    expect(numberField({ a: "1,250,000" }, "a")).toBe(1250000);
  });

  it("returns null for blank and non-numeric cells", () => {
    expect(numberField({ a: "" }, "a")).toBeNull();
    expect(numberField({ a: "N/A" }, "a")).toBeNull();
  });
});

describe("dateField", () => {
  it("accepts ISO dates and timestamps", () => {
    expect(dateField({ d: "2026-03-04" }, "d")).toBe("2026-03-04");
    expect(dateField({ d: "2026-03-04T10:00:00Z" }, "d")).toBe("2026-03-04");
  });

  it("reads ambiguous slash dates as day-first, which is what DLD publishes", () => {
    expect(dateField({ d: "04-03-2026" }, "d")).toBe("2026-03-04");
    expect(dateField({ d: "4/3/2026" }, "d")).toBe("2026-03-04");
  });

  it("rejects an impossible month rather than silently swapping the parts", () => {
    expect(dateField({ d: "04-13-2026" }, "d")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(dateField({ d: "not a date" }, "d")).toBeNull();
  });
});
