import { describe, expect, it } from "vitest";

import { formatMoney, minorToInput, parseMoney, parseQuantity, quantityToInput } from "@/lib/money";
import { percentToBps } from "@/lib/rates";

import { calculateInvoice, lineTotal } from "./calc";

const item = (qty: number, priceMinor: number) => ({ quantityMilli: Math.round(qty * 1000), unitPriceMinor: priceMinor });
const none = { type: null, value: 0 } as const;

describe("lineTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineTotal(2000, 50_000)).toBe(100_000);
  });

  it("handles fractional quantities", () => {
    expect(lineTotal(1500, 1000)).toBe(1500);
    expect(lineTotal(250, 999)).toBe(250); // 0.25 x 9.99 = 2.4975 -> 2.50
  });

  it("rounds half up", () => {
    expect(lineTotal(500, 1)).toBe(1); // 0.5 -> 1
    expect(lineTotal(1500, 1)).toBe(2); // 1.5 -> 2
    expect(lineTotal(2500, 1)).toBe(3); // 2.5 -> 3 (not banker's 2)
    expect(lineTotal(499, 1)).toBe(0); // 0.499 -> 0
  });

  it("is zero for a zero quantity or price", () => {
    expect(lineTotal(0, 12345)).toBe(0);
    expect(lineTotal(3000, 0)).toBe(0);
  });

  it("stays exact for large values", () => {
    expect(lineTotal(999_999_000, 99_999_999)).toBe(99_999_899_000_001);
  });
});

describe("calculateInvoice", () => {
  it("adds up lines with no discount or tax", () => {
    const r = calculateInvoice({ items: [item(2, 50_000), item(1, 25_000)], discount: none, taxRateBps: 0 });
    expect(r).toEqual({ lineTotals: [100_000, 25_000], subtotal: 125_000, discount: 0, taxable: 125_000, tax: 0, total: 125_000 });
  });

  it("applies a percentage discount before tax", () => {
    // 1000.00, 10% off = 900.00, 7.5% VAT = 67.50, total 967.50
    const r = calculateInvoice({ items: [item(1, 100_000)], discount: { type: "percent", value: 1000 }, taxRateBps: 750 });
    expect(r).toMatchObject({ subtotal: 100_000, discount: 10_000, taxable: 90_000, tax: 6_750, total: 96_750 });
  });

  it("applies a fixed discount before tax", () => {
    const r = calculateInvoice({ items: [item(1, 100_000)], discount: { type: "fixed", value: 20_000 }, taxRateBps: 1000 });
    expect(r).toMatchObject({ discount: 20_000, taxable: 80_000, tax: 8_000, total: 88_000 });
  });

  it("never lets a fixed discount push the taxable amount below zero", () => {
    const r = calculateInvoice({ items: [item(1, 5_000)], discount: { type: "fixed", value: 9_000 }, taxRateBps: 750 });
    expect(r).toMatchObject({ subtotal: 5_000, discount: 5_000, taxable: 0, tax: 0, total: 0 });
  });

  it("caps percentage discounts at 100%", () => {
    const r = calculateInvoice({ items: [item(1, 5_000)], discount: { type: "percent", value: 15_000 }, taxRateBps: 0 });
    expect(r.taxable).toBe(0);
  });

  it("rounds the discount and the tax half up", () => {
    // 0.15 at 50% = 0.075 -> 0.08; 0.07 taxable at 50% tax = 0.035 -> 0.04
    const r = calculateInvoice({ items: [item(1, 15)], discount: { type: "percent", value: 5000 }, taxRateBps: 5000 });
    expect(r).toMatchObject({ discount: 8, taxable: 7, tax: 4, total: 11 });
  });

  it("rounds each line before summing", () => {
    // Three lines of 0.333 x 0.01 = 0.00333 each -> 0 each, not 0.01 in total.
    const r = calculateInvoice({ items: [item(0.333, 1), item(0.333, 1), item(0.334, 1)], discount: none, taxRateBps: 0 });
    expect(r.lineTotals).toEqual([0, 0, 0]);
    expect(r.subtotal).toBe(0);
  });

  it("handles an empty invoice", () => {
    expect(calculateInvoice({ items: [], discount: none, taxRateBps: 750 }).total).toBe(0);
  });

  it("supports zero-decimal currencies since everything is minor units", () => {
    // JPY: 3 x 1,999 yen with 10% tax = 5,997 + 600 (599.7 rounded) = 6,597
    const r = calculateInvoice({ items: [item(3, 1_999)], discount: none, taxRateBps: 1000 });
    expect(r).toMatchObject({ subtotal: 5_997, tax: 600, total: 6_597 });
  });

  it("rejects negative quantities, prices and rates", () => {
    expect(() => calculateInvoice({ items: [item(-1, 100)], discount: none, taxRateBps: 0 })).toThrow();
    expect(() => calculateInvoice({ items: [item(1, -100)], discount: none, taxRateBps: 0 })).toThrow();
    expect(() => calculateInvoice({ items: [], discount: { type: "fixed", value: -1 }, taxRateBps: 0 })).toThrow();
    expect(() => calculateInvoice({ items: [], discount: none, taxRateBps: 10_001 })).toThrow();
  });

  it("rejects totals too large to represent exactly", () => {
    const huge = Array.from({ length: 200 }, () => ({ quantityMilli: 1_000_000_000, unitPriceMinor: 1_000_000_000_000 }));
    expect(() => calculateInvoice({ items: huge, discount: none, taxRateBps: 0 })).toThrow(RangeError);
  });
});

describe("money parsing", () => {
  it("parses amounts into minor units without floating point errors", () => {
    expect(parseMoney("1,250.50", 2)).toBe(125_050);
    expect(parseMoney("0.1", 2)).toBe(10);
    expect(parseMoney("19.99", 2)).toBe(1_999);
    expect(parseMoney("1.005", 2)).toBeNull(); // too many decimals
    expect(parseMoney("", 2)).toBe(0);
    expect(parseMoney("-5", 2)).toBeNull();
    expect(parseMoney("abc", 2)).toBeNull();
    expect(parseMoney("1500", 0)).toBe(1_500);
    expect(parseMoney("15.5", 0)).toBeNull();
  });

  it("round-trips to an editable string", () => {
    expect(minorToInput(125_050, 2)).toBe("1250.50");
    expect(minorToInput(5, 2)).toBe("0.05");
    expect(minorToInput(1_500, 0)).toBe("1500");
  });

  it("parses quantities to thousandths", () => {
    expect(parseQuantity("2")).toBe(2_000);
    expect(parseQuantity("1.5")).toBe(1_500);
    expect(parseQuantity("0.125")).toBe(125);
    expect(parseQuantity("1.2345")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(quantityToInput(1_500)).toBe("1.5");
    expect(quantityToInput(2_000)).toBe("2");
  });

  it("parses tax rates to basis points", () => {
    expect(percentToBps("7.5")).toBe(750);
    expect(percentToBps("0")).toBe(0);
    expect(percentToBps("7.555")).toBeNull();
  });

  it("formats with the currency's own decimals", () => {
    expect(formatMoney(125_050, "NGN")).toBe("₦1,250.50");
    expect(formatMoney(1_500, "JPY")).toBe("JP¥1,500");
  });
});
