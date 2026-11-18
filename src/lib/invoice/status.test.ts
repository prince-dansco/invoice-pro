import { describe, expect, it } from "vitest";

import { filterAndSort, parseListQuery, type ListRow } from "./list";
import { displayStatus, summarize, todayIn } from "./status";

const TODAY = "2026-11-04";

describe("displayStatus", () => {
  it("marks unpaid sent invoices past their due date as overdue", () => {
    expect(displayStatus("sent", "2026-11-03", TODAY)).toBe("overdue");
  });
  it("doesn't mark an invoice due today as overdue", () => {
    expect(displayStatus("sent", TODAY, TODAY)).toBe("sent");
  });
  it("never marks paid or draft invoices as overdue", () => {
    expect(displayStatus("paid", "2020-01-01", TODAY)).toBe("paid");
    expect(displayStatus("draft", "2020-01-01", TODAY)).toBe("draft");
  });
  it("treats a missing due date as not overdue", () => {
    expect(displayStatus("sent", null, TODAY)).toBe("sent");
  });
});

describe("todayIn", () => {
  it("uses the given time zone, not UTC", () => {
    // 23:30 UTC on 3 Nov is already 4 Nov in Lagos (UTC+1).
    expect(todayIn("Africa/Lagos", new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-04");
    expect(todayIn("UTC", new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-03");
  });
});

describe("summarize", () => {
  const rows = [
    { status: "draft", due_date: null, currency: "NGN", total_minor: 999 },
    { status: "sent", due_date: "2026-11-30", currency: "NGN", total_minor: 1000 },
    { status: "sent", due_date: "2026-10-01", currency: "NGN", total_minor: 2000 },
    { status: "paid", due_date: "2026-10-01", currency: "NGN", total_minor: 4000 },
    { status: "sent", due_date: "2026-10-01", currency: "USD", total_minor: 500 },
  ] as const;

  it("counts each status, with overdue separate from sent", () => {
    expect(summarize([...rows], TODAY, "NGN").counts).toEqual({ draft: 1, sent: 1, paid: 1, overdue: 2, total: 5 });
  });

  it("keeps amounts per currency and excludes drafts", () => {
    const { amounts } = summarize([...rows], TODAY, "NGN");
    expect(amounts).toEqual([
      { currency: "NGN", invoiced: 7000, paid: 4000, outstanding: 3000, overdue: 2000 },
      { currency: "USD", invoiced: 500, paid: 0, outstanding: 500, overdue: 500 },
    ]);
  });

  it("returns zeros for the main currency when there are no invoices", () => {
    expect(summarize([], TODAY, "NGN").amounts).toEqual([{ currency: "NGN", invoiced: 0, paid: 0, outstanding: 0, overdue: 0 }]);
  });
});

describe("filterAndSort", () => {
  const rows: ListRow[] = [
    { id: "1", invoice_number: "INV-001", status: "paid", issue_date: "2026-09-01", due_date: "2026-09-15", currency: "NGN", total_minor: 300, clientName: "Bola" },
    { id: "2", invoice_number: "INV-002", status: "sent", issue_date: "2026-10-01", due_date: "2026-10-15", currency: "NGN", total_minor: 100, clientName: "Ada" },
    { id: "3", invoice_number: "INV-010", status: "draft", issue_date: "2026-11-01", due_date: null, currency: "NGN", total_minor: 200, clientName: null },
  ];
  const q = (p: Record<string, string>) => parseListQuery(p);
  const ids = (p: Record<string, string>) => filterAndSort(rows, q(p), TODAY).map((r) => r.id);

  it("defaults to newest first", () => expect(ids({})).toEqual(["3", "2", "1"]));
  it("searches by number or client", () => {
    expect(ids({ q: "inv-01" })).toEqual(["3"]);
    expect(ids({ q: "ADA" })).toEqual(["2"]);
  });
  it("filters by derived status", () => expect(ids({ status: "overdue" })).toEqual(["2"]));
  it("sorts by total, client and due date", () => {
    expect(ids({ sort: "total", dir: "asc" })).toEqual(["2", "3", "1"]);
    expect(ids({ sort: "client", dir: "asc" })).toEqual(["3", "2", "1"]);
    expect(ids({ sort: "due_date", dir: "asc" })).toEqual(["1", "2", "3"]);
    expect(ids({ sort: "due_date", dir: "desc" })).toEqual(["2", "1", "3"]);
  });
  it("sorts invoice numbers numerically", () => expect(ids({ sort: "number", dir: "desc" })).toEqual(["3", "2", "1"]));
  it("ignores unknown query values", () => expect(q({ status: "bogus", sort: "evil", dir: "x" })).toEqual({ q: "", status: "all", sort: "issue_date", dir: "desc" }));
});
