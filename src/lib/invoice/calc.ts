// Invoice maths, shared by the editor preview, the server and the PDF so they
// always agree. Everything is integer minor units; BigInt is used internally so
// intermediate products can't lose precision.
//
// Order (spec §9.3): line totals -> subtotal -> discount -> taxable amount -> tax -> total.
// Rounding: half-up to the nearest minor unit, applied once per line, once to
// the discount and once to the tax. All inputs are non-negative.

import { MAX_MINOR, QTY_SCALE } from "@/lib/money";

export type DiscountType = "percent" | "fixed" | null;

export type CalcInput = {
  items: { quantityMilli: number; unitPriceMinor: number }[];
  /** Percent discounts in basis points (1000 = 10%), fixed discounts in minor units. */
  discount: { type: DiscountType; value: number };
  taxRateBps: number;
};

export type CalcResult = {
  lineTotals: number[];
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
};

// BigInt(...) rather than 0n-style literals, which need an ES2020 compile target.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const BPS = BigInt(10_000);

/** round(n / d), halves rounded up. n >= 0, d > 0. */
function divHalfUp(n: bigint, d: bigint): bigint {
  return (n * TWO + d) / (d * TWO);
}

function toSafeNumber(n: bigint): number {
  if (n > BigInt(MAX_MINOR)) throw new RangeError("Amount is too large.");
  return Number(n);
}

export function lineTotal(quantityMilli: number, unitPriceMinor: number): number {
  return toSafeNumber(divHalfUp(BigInt(quantityMilli) * BigInt(unitPriceMinor), BigInt(QTY_SCALE)));
}

export function calculateInvoice({ items, discount, taxRateBps }: CalcInput): CalcResult {
  for (const { quantityMilli, unitPriceMinor } of items) {
    if (quantityMilli < 0 || unitPriceMinor < 0) throw new RangeError("Quantities and prices can't be negative.");
  }
  if (discount.value < 0 || taxRateBps < 0 || taxRateBps > 10_000) throw new RangeError("Invalid rate.");

  const lineTotals = items.map((i) => lineTotal(i.quantityMilli, i.unitPriceMinor));
  const subtotal = lineTotals.reduce((sum, n) => sum + BigInt(n), ZERO);

  let discountAmount = ZERO;
  if (discount.type === "percent") {
    discountAmount = divHalfUp(subtotal * BigInt(Math.min(discount.value, 10_000)), BPS);
  } else if (discount.type === "fixed") {
    discountAmount = BigInt(discount.value);
  }
  // A discount can never take the taxable amount below zero.
  if (discountAmount > subtotal) discountAmount = subtotal;

  const taxable = subtotal - discountAmount;
  const tax = divHalfUp(taxable * BigInt(taxRateBps), BPS);

  return {
    lineTotals,
    subtotal: toSafeNumber(subtotal),
    discount: toSafeNumber(discountAmount),
    taxable: toSafeNumber(taxable),
    tax: toSafeNumber(tax),
    total: toSafeNumber(taxable + tax),
  };
}
