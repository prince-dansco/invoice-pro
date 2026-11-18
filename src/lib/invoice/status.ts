// Invoice status shown to users. "overdue" is derived, never stored: a sent,
// unpaid invoice whose due date has passed.

export type StoredStatus = "draft" | "sent" | "paid";
export type DisplayStatus = StoredStatus | "overdue";

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

/** Today's date as YYYY-MM-DD in the given time zone. */
export function todayIn(timeZone = "Africa/Lagos", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Due today is not overdue; due yesterday is. Paid and draft invoices are never overdue. */
export function displayStatus(status: StoredStatus, dueDate: string | null, today: string): DisplayStatus {
  if (status === "sent" && dueDate && dueDate < today) return "overdue";
  return status;
}

export type SummaryInput = { status: StoredStatus; due_date: string | null; currency: string; total_minor: number };

export type CurrencySummary = {
  currency: string;
  invoiced: number; // sent + paid
  paid: number;
  outstanding: number; // sent, including overdue
  overdue: number;
};

export type DashboardSummary = {
  counts: Record<DisplayStatus, number> & { total: number };
  /** One entry per currency used, the user's main currency first. */
  amounts: CurrencySummary[];
};

/** Dashboard figures from real invoice rows. Amounts are kept per currency, never mixed. */
export function summarize(rows: SummaryInput[], today: string, mainCurrency: string): DashboardSummary {
  const counts = { draft: 0, sent: 0, paid: 0, overdue: 0, total: rows.length };
  const byCurrency = new Map<string, CurrencySummary>();
  const bucket = (currency: string) => {
    let b = byCurrency.get(currency);
    if (!b) byCurrency.set(currency, (b = { currency, invoiced: 0, paid: 0, outstanding: 0, overdue: 0 }));
    return b;
  };
  bucket(mainCurrency);

  for (const row of rows) {
    const s = displayStatus(row.status, row.due_date, today);
    counts[s]++;
    if (s === "draft") continue;
    const b = bucket(row.currency);
    b.invoiced += row.total_minor;
    if (s === "paid") b.paid += row.total_minor;
    else b.outstanding += row.total_minor;
    if (s === "overdue") b.overdue += row.total_minor;
  }

  const amounts = [...byCurrency.values()].filter((b) => b.currency === mainCurrency || b.invoiced > 0);
  amounts.sort((a, b) => (a.currency === mainCurrency ? -1 : b.currency === mainCurrency ? 1 : a.currency.localeCompare(b.currency)));
  return { counts, amounts };
}
