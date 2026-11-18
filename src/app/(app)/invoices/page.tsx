import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, FileText, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { SearchInput } from "@/components/forms/search-input";
import { StatusBadge } from "@/components/invoices/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/invoice/format";
import { filterAndSort, parseListQuery, type ListQuery, type SortKey, type StatusFilter } from "@/lib/invoice/list";
import { todayIn } from "@/lib/invoice/status";
import { loadInvoiceRows } from "@/lib/invoices-list";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** URL for the list with some query values changed; defaults are left out. */
function href(query: ListQuery, patch: Partial<ListQuery>) {
  const next = { ...query, ...patch };
  const p = new URLSearchParams();
  if (next.q) p.set("q", next.q);
  if (next.status !== "all") p.set("status", next.status);
  if (next.sort !== "issue_date") p.set("sort", next.sort);
  if (next.dir !== "desc") p.set("dir", next.dir);
  return `/invoices${p.size ? `?${p}` : ""}`;
}

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseListQuery(await searchParams);
  const today = todayIn();
  const rows = await loadInvoiceRows();
  const invoices = filterAndSort(rows, query, today);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Invoices" description="Create, track and download your invoices." />
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <FileText className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-medium">No invoices yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">Create your first invoice. You can save it as a draft and finish it later.</p>
          <Link href="/invoices/new" className={buttonVariants({ size: "lg", className: "mt-2" })}>
            <Plus aria-hidden />
            Create your first invoice
          </Link>
        </div>
      </div>
    );
  }

  const SortHeader = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => {
    const active = query.sort === k;
    const dir = active && query.dir === "desc" ? "asc" : active ? "desc" : k === "client" || k === "number" ? "asc" : "desc";
    return (
      <th className={cn("px-4 py-2.5 font-medium", className)} aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link href={href(query, { sort: k, dir })} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")} scroll={false}>
          {label}
          {active && (query.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
        </Link>
      </th>
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Invoices" description="Create, track and download your invoices." />
        <Link href="/invoices/new" className={buttonVariants()}>
          <Plus aria-hidden />
          New invoice
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search number or client" label="Search invoices" />
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={href(query, { status: f.value })}
              scroll={false}
              aria-current={query.status === f.value ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition-colors",
                query.status === f.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No invoices match these filters.{" "}
          <Link href="/invoices" className="font-medium text-primary hover:underline">
            Show all invoices
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <SortHeader k="number" label="Number" />
                <SortHeader k="client" label="Client" />
                <SortHeader k="issue_date" label="Issued" className="hidden sm:table-cell" />
                <SortHeader k="due_date" label="Due" className="hidden md:table-cell" />
                <SortHeader k="total" label="Total" className="text-right [&>a]:justify-end" />
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id} className="relative hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {/* The link covers the whole row for easy tapping. */}
                    <Link href={`/invoices/${inv.id}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="max-w-48 truncate px-4 py-3">{inv.clientName ?? <span className="text-muted-foreground">No client</span>}</td>
                  <td className="hidden px-4 py-3 whitespace-nowrap sm:table-cell">{formatDate(inv.issue_date)}</td>
                  <td className={cn("hidden px-4 py-3 whitespace-nowrap md:table-cell", inv.displayStatus === "overdue" && "font-medium text-destructive")}>
                    {formatDate(inv.due_date) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(inv.total_minor, inv.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.displayStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Showing {invoices.length} of {rows.length} {rows.length === 1 ? "invoice" : "invoices"}
      </p>
    </div>
  );
}
