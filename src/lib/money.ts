import { CURRENCIES } from "@/lib/currencies";

/** Largest amount accepted anywhere, in minor units. Keeps all maths exact in a JS number. */
export const MAX_MINOR = 1_000_000_000_000_000; // 10 trillion in a 2-decimal currency

/** Number of minor-unit decimals for a currency (2 for NGN/USD, 0 for JPY). */
export function currencyDigits(code: string): number {
  return CURRENCIES.find((c) => c.code === code)?.digits ?? 2;
}

/**
 * Parses user input like "1,250.50" into minor units without floating point.
 * Empty input is 0. Returns null for anything that isn't a non-negative amount
 * with at most `digits` decimals.
 */
export function parseMoney(input: string, digits: number): number | null {
  const s = input.replace(/[\s,]/g, "");
  if (s === "") return 0;
  const pattern = digits > 0 ? new RegExp(`^\\d{1,13}(\\.\\d{0,${digits}})?$`) : /^\d{1,15}$/;
  if (!pattern.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const minor = Number(whole) * 10 ** digits + Number(frac.padEnd(digits, "0") || "0");
  return minor <= MAX_MINOR ? minor : null;
}

/** 125050 (NGN) -> "1250.50": an editable string, no grouping or symbol. */
export function minorToInput(minor: number, digits: number): string {
  if (digits === 0) return String(minor);
  const whole = Math.floor(minor / 10 ** digits);
  const frac = String(minor % 10 ** digits).padStart(digits, "0");
  return `${whole}.${frac}`;
}

/** 125050, "NGN" -> "₦1,250.50" */
export function formatMoney(minor: number, currency: string, locale = "en-NG"): string {
  const digits = currencyDigits(currency);
  // Divide by a power of ten only for display; all arithmetic stays in integers.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

/** Quantities are stored with up to three decimals; in code they're integer thousandths. */
export const QTY_SCALE = 1000;
export const MAX_QTY_MILLI = 1_000_000 * QTY_SCALE;

/** "1.5" -> 1500. Empty is invalid here: a line needs a quantity. */
export function parseQuantity(input: string): number | null {
  const s = input.replace(/[\s,]/g, "");
  if (!/^\d{1,7}(\.\d{0,3})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const milli = Number(whole) * QTY_SCALE + Number(frac.padEnd(3, "0") || "0");
  return milli <= MAX_QTY_MILLI ? milli : null;
}

/** 1500 -> "1.5" */
export function quantityToInput(milli: number): string {
  const whole = Math.floor(milli / QTY_SCALE);
  const frac = String(milli % QTY_SCALE).padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}
