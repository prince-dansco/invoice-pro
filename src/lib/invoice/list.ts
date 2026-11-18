// Search, filter and sort for the invoice table (IP-192). Pure, so it's tested
// directly and the page stays a thin wrapper.

import { displayStatus, type DisplayStatus, type StoredStatus } from "./status";

export type ListRow = {
  id: string;
  invoice_number: string;
  status: StoredStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  total_minor: number;
  clientName: string | null;
};

export const SORT_KEYS = ["issue_date", "due_date", "total", "client", "number"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type StatusFilter = "all" | DisplayStatus;

export type ListQuery = { q: string; status: StatusFilter; sort: SortKey; dir: "asc" | "desc" };

export function parseListQuery(params: Record<string, string | string[] | undefined>): ListQuery {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) ?? "";
  const status = one("status");
  const sort = one("sort");
  return {
    q: one("q").slice(0, 100),
    status: (["draft", "sent", "paid", "overdue"] as string[]).includes(status) ? (status as DisplayStatus) : "all",
    sort: (SORT_KEYS as readonly string[]).includes(sort) ? (sort as SortKey) : "issue_date",
    dir: one("dir") === "asc" ? "asc" : "desc",
  };
}

export function filterAndSort<T extends ListRow>(rows: T[], query: ListQuery, today: string) {
  const q = query.q.trim().toLowerCase();
  const withStatus = rows.map((r) => ({ ...r, displayStatus: displayStatus(r.status, r.due_date, today) }));

  const filtered = withStatus.filter(
    (r) =>
      (query.status === "all" || r.displayStatus === query.status) &&
      (!q || r.invoice_number.toLowerCase().includes(q) || (r.clientName ?? "").toLowerCase().includes(q)),
  );

  const dir = query.dir === "asc" ? 1 : -1;
  const cmp = (a: (typeof filtered)[number], b: (typeof filtered)[number]): number => {
    switch (query.sort) {
      case "total":
        return a.total_minor - b.total_minor;
      case "client":
        return (a.clientName ?? "").localeCompare(b.clientName ?? "", undefined, { sensitivity: "base" });
      case "due_date":
        // Invoices without a due date sort last either way.
        if (!a.due_date || !b.due_date) return a.due_date ? -dir : b.due_date ? dir : 0;
        return a.due_date.localeCompare(b.due_date);
      case "number":
        return a.invoice_number.localeCompare(b.invoice_number, undefined, { numeric: true });
      default:
        return a.issue_date.localeCompare(b.issue_date);
    }
  };

  // Ties fall back to the invoice number so the order is stable.
  return filtered.sort((a, b) => cmp(a, b) * dir || b.invoice_number.localeCompare(a.invoice_number, undefined, { numeric: true }));
}
