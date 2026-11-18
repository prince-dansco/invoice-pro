import { describe, expect, it } from "vitest";

import { addDays, parseDraft, type DraftInput } from "./draft";

const base: DraftInput = {
  client_id: null,
  issue_date: "2026-11-02",
  due_date: "2026-11-16",
  currency: "NGN",
  reference: "",
  discount_type: "none",
  discount_value: "",
  tax_rate: "7.5",
  notes: "",
  terms: "",
  payment_instructions: "",
  items: [{ description: "Logo design", quantity: "2", unit_price: "50,000" }],
};

describe("parseDraft", () => {
  it("parses a valid draft and calculates totals", () => {
    const r = parseDraft(base);
    expect(r.value?.items[0]).toEqual({ description: "Logo design", quantityMilli: 2000, unitPriceMinor: 5_000_000 });
    expect(r.totals).toMatchObject({ subtotal: 10_000_000, tax: 750_000, total: 10_750_000 });
  });

  it("allows incomplete drafts: no client, empty description and price", () => {
    const r = parseDraft({ ...base, items: [{ description: "", quantity: "1", unit_price: "" }] });
    expect(r.value).toBeDefined();
    expect(r.totals.total).toBe(0);
  });

  it("rejects a due date before the issue date", () => {
    const r = parseDraft({ ...base, due_date: "2026-11-01" });
    expect(r.value).toBeUndefined();
    expect(r.errors.fields.due_date).toMatch(/before the issue date/);
  });

  it("rejects negative quantities and prices per line, but keeps a usable preview", () => {
    const r = parseDraft({
      ...base,
      items: [
        { description: "a", quantity: "-1", unit_price: "10" },
        { description: "b", quantity: "1", unit_price: "-5" },
        { description: "c", quantity: "1", unit_price: "10" },
      ],
    });
    expect(r.value).toBeUndefined();
    expect(r.errors.items[0]?.quantity).toBe("Can't be negative.");
    expect(r.errors.items[1]?.unit_price).toBe("Can't be negative.");
    expect(r.totals.subtotal).toBe(1_000); // only the valid line counts
  });

  it("validates a fixed discount against the subtotal", () => {
    const r = parseDraft({ ...base, discount_type: "fixed", discount_value: "200000" });
    expect(r.errors.fields.discount_value).toMatch(/more than the subtotal/);
  });

  it("uses the currency's decimals for prices", () => {
    const r = parseDraft({ ...base, currency: "JPY", items: [{ description: "x", quantity: "1", unit_price: "10.50" }] });
    expect(r.errors.items[0]?.unit_price).toBe("Enter a whole amount.");
  });

  it("rejects an unknown currency and a malformed client ID", () => {
    const r = parseDraft({ ...base, currency: "XXX", client_id: "not-a-uuid" });
    expect(r.errors.fields.currency).toBeDefined();
    expect(r.errors.fields.client_id).toBeDefined();
  });
});

describe("addDays", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-02", 14)).toBe("2026-11-16");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
