/** Supported invoice currencies. `digits` is the number of minor-unit decimals. */
export const CURRENCIES = [
  { code: "NGN", name: "Nigerian naira", digits: 2 },
  { code: "USD", name: "US dollar", digits: 2 },
  { code: "EUR", name: "Euro", digits: 2 },
  { code: "GBP", name: "British pound", digits: 2 },
  { code: "CAD", name: "Canadian dollar", digits: 2 },
  { code: "AUD", name: "Australian dollar", digits: 2 },
  { code: "GHS", name: "Ghanaian cedi", digits: 2 },
  { code: "KES", name: "Kenyan shilling", digits: 2 },
  { code: "ZAR", name: "South African rand", digits: 2 },
  { code: "INR", name: "Indian rupee", digits: 2 },
  { code: "AED", name: "UAE dirham", digits: 2 },
  { code: "JPY", name: "Japanese yen", digits: 0 },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];
