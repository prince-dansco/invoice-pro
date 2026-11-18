// Turns the editor's string inputs into validated minor-unit values plus totals.
// Runs in the browser for live feedback and again on the server before saving,
// where its result is the only source of the stored totals.

import { CURRENCY_CODES } from "@/lib/currencies";
import { currencyDigits, parseMoney, parseQuantity } from "@/lib/money";
import { percentToBps } from "@/lib/rates";

import { calculateInvoice, type CalcResult, type DiscountType } from "./calc";

export const MAX_ITEMS = 200;

export type DraftItemInput = { description: string; quantity: string; unit_price: string };

/** Exactly what the editor holds and sends to the server. Totals are deliberately absent. */
export type DraftInput = {
  client_id: string | null;
  issue_date: string;
  due_date: string;
  currency: string;
  reference: string;
  discount_type: "none" | "percent" | "fixed";
  discount_value: string;
  tax_rate: string;
  notes: string;
  terms: string;
  payment_instructions: string;
  items: DraftItemInput[];
};

export type DraftErrors = {
  form?: string;
  fields: Partial<Record<keyof Omit<DraftInput, "items">, string>>;
  items: Record<number, Partial<Record<keyof DraftItemInput, string>>>;
};

export type ParsedDraft = {
  client_id: string | null;
  issue_date: string;
  due_date: string | null;
  currency: string;
  reference: string | null;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate_bps: number;
  notes: string | null;
  terms: string | null;
  payment_instructions: string | null;
  items: { description: string; quantityMilli: number; unitPriceMinor: number }[];
};

export type DraftResult = {
  /** Present only when there are no errors. */
  value?: ParsedDraft;
  errors: DraftErrors;
  /** Always present: invalid numbers count as zero, so the preview keeps working. */
  totals: CalcResult;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIsoDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** "2026-11-02" + 14 -> "2026-11-16" */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const text = (s: string) => s.trim() || null;

export function parseDraft(input: DraftInput): DraftResult {
  const errors: DraftErrors = { fields: {}, items: {} };
  const fieldError = (k: keyof DraftErrors["fields"], msg: string) => (errors.fields[k] ??= msg);
  const itemError = (i: number, k: keyof DraftItemInput, msg: string) => ((errors.items[i] ??= {})[k] = msg);

  const currency = (CURRENCY_CODES as readonly string[]).includes(input.currency) ? input.currency : null;
  if (!currency) fieldError("currency", "Choose a currency.");
  const digits = currencyDigits(currency ?? "USD");

  if (input.client_id !== null && !UUID.test(input.client_id)) fieldError("client_id", "Choose a client.");

  if (!isIsoDate(input.issue_date)) fieldError("issue_date", "Enter the issue date.");
  const due = input.due_date.trim();
  if (due && !isIsoDate(due)) fieldError("due_date", "Enter a valid due date.");
  else if (due && isIsoDate(input.issue_date) && due < input.issue_date) {
    fieldError("due_date", "The due date can't be before the issue date.");
  }

  if (input.reference.trim().length > 100) fieldError("reference", "Use 100 characters or fewer.");
  for (const k of ["notes", "terms", "payment_instructions"] as const) {
    if (input[k].trim().length > 2000) fieldError(k, "Use 2,000 characters or fewer.");
  }

  if (input.items.length > MAX_ITEMS) errors.form = `An invoice can have up to ${MAX_ITEMS} lines.`;

  const items = input.items.slice(0, MAX_ITEMS).map((item, i) => {
    if (item.description.trim().length > 1000) itemError(i, "description", "Use 1,000 characters or fewer.");
    const quantityMilli = parseQuantity(item.quantity);
    if (quantityMilli === null) {
      itemError(i, "quantity", item.quantity.trim().startsWith("-") ? "Can't be negative." : "Enter a quantity, up to 3 decimals.");
    }
    const unitPriceMinor = parseMoney(item.unit_price, digits);
    if (unitPriceMinor === null) {
      itemError(
        i,
        "unit_price",
        item.unit_price.trim().startsWith("-")
          ? "Can't be negative."
          : digits === 0
            ? "Enter a whole amount."
            : `Enter an amount with up to ${digits} decimals.`,
      );
    }
    return { description: item.description.trim(), quantityMilli: quantityMilli ?? 0, unitPriceMinor: unitPriceMinor ?? 0 };
  });

  const taxRateBps = percentToBps(input.tax_rate || "0");
  if (taxRateBps === null || taxRateBps > 10_000) fieldError("tax_rate", "Enter a rate from 0 to 100.");

  let discountType: DiscountType = null;
  let discountValue = 0;
  if (input.discount_type === "percent") {
    discountType = "percent";
    const bps = percentToBps(input.discount_value || "0");
    if (bps === null || bps > 10_000) fieldError("discount_value", "Enter a percentage from 0 to 100.");
    else discountValue = bps;
  } else if (input.discount_type === "fixed") {
    discountType = "fixed";
    const minor = parseMoney(input.discount_value, digits);
    if (minor === null) fieldError("discount_value", "Enter a valid amount.");
    else discountValue = minor;
  }

  let totals: CalcResult;
  try {
    totals = calculateInvoice({ items, discount: { type: discountType, value: discountValue }, taxRateBps: taxRateBps ?? 0 });
  } catch {
    errors.form = "These amounts are too large. Check the quantities and prices.";
    totals = { lineTotals: items.map(() => 0), subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 };
  }

  if (discountType === "fixed" && discountValue > totals.subtotal) {
    fieldError("discount_value", "The discount can't be more than the subtotal.");
  }

  const hasErrors = errors.form || Object.keys(errors.fields).length || Object.keys(errors.items).length;
  if (hasErrors) return { errors, totals };

  return {
    errors,
    totals,
    value: {
      client_id: input.client_id,
      issue_date: input.issue_date,
      due_date: due || null,
      currency: currency!,
      reference: text(input.reference),
      discount_type: discountType,
      discount_value: discountValue,
      tax_rate_bps: taxRateBps!,
      notes: text(input.notes),
      terms: text(input.terms),
      payment_instructions: text(input.payment_instructions),
      items,
    },
  };
}
