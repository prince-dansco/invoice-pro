import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FilePen, FileText, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { StatusBadge } from "@/components/invoices/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyClients } from "@/lib/clients";
import { formatDate } from "@/lib/invoice/format";
import { filterAndSort, parseListQuery } from "@/lib/invoice/list";
import { summarize, todayIn, type CurrencySummary } from "@/lib/invoice/status";
import { loadInvoiceRows } from "@/lib/invoices-list";
import { formatMoney } from "@/lib/money";
import { getProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [profile, rows, hasClients] = await Promise.all([getProfile(), loadInvoiceRows(), hasAnyClients()]);
  const today = todayIn();
  const main = profile!.currency;
  const { counts, amounts } = summarize(rows, today, main);
  const primary = amounts[0];
  const others = amounts.slice(1);
  const recent = filterAndSort(rows, parseListQuery({}), today).slice(0, 5);
  const overdue = filterAndSort(rows, parseListQuery({ status: "overdue", sort: "due_date", dir: "asc" }), today).slice(0, 5);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Dashboard" description={profile!.business_name ? `Overview for ${profile!.business_name}` : undefined} />
        {rows.length > 0 && (
          <Link href="/invoices/new" className={buttonVariants()}>
            <Plus aria-hidden />
            New invoice
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <GettingStarted hasClients={hasClients} />
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              label="Outstanding"
              value={formatMoney(primary.outstanding, main)}
              detail={`${counts.sent + counts.overdue} unpaid ${counts.sent + counts.overdue === 1 ? "invoice" : "invoices"}`}
              icon={Clock}
              emphasis
            />
            <Card
              label="Overdue"
              value={formatMoney(primary.overdue, main)}
              detail={counts.overdue ? `${counts.overdue} past due` : "Nothing overdue"}
              icon={AlertTriangle}
              tone={counts.overdue ? "danger" : undefined}
              href={counts.overdue ? "/invoices?status=overdue" : undefined}
            />
            <Card label="Paid" value={formatMoney(primary.paid, main)} detail={`${counts.paid} paid`} icon={CheckCircle2} tone="good" href={counts.paid ? "/invoices?status=paid" : undefined} />
            <Card label="Total invoiced" value={formatMoney(primary.invoiced, main)} detail="Sent and paid invoices" icon={FileText} />
            <Card label="Sent" value={String(counts.sent)} detail="Awaiting payment, not yet due" icon={FileText} href={counts.sent ? "/invoices?status=sent" : undefined} />
            <Card label="Drafts" value={String(counts.draft)} detail="Not yet issued" icon={FilePen} href={counts.draft ? "/invoices?status=draft" : undefined} />
          </section>

          {others.length > 0 && <OtherCurrencies rows={others} />}

          {overdue.length > 0 && (
            <InvoiceTable title="Overdue" rows={overdue} link={{ href: "/invoices?status=overdue", label: "All overdue" }} />
          )}
          <InvoiceTable title="Recent invoices" rows={recent} link={{ href: "/invoices", label: "All invoices" }} />
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  emphasis,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger" | "good";
  emphasis?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <Icon className={cn("size-4", tone === "danger" && "text-destructive", tone === "good" && "text-emerald-600 dark:text-emerald-400")} aria-hidden />
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", emphasis && "text-primary", tone === "danger" && "text-destructive")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </>
  );
  const cls = "rounded-xl border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function OtherCurrencies({ rows }: { rows: CurrencySummary[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 text-sm font-medium">Other currencies</h2>
      <p className="mb-3 text-xs text-muted-foreground">Amounts in other currencies are shown separately, not converted.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Currency</th>
              <th className="py-1 pr-4 text-right font-medium">Outstanding</th>
              <th className="py-1 pr-4 text-right font-medium">Overdue</th>
              <th className="py-1 text-right font-medium">Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.currency}>
                <td className="py-1 pr-4">{r.currency}</td>
                <td className="py-1 pr-4 text-right">{formatMoney(r.outstanding, r.currency)}</td>
                <td className="py-1 pr-4 text-right">{formatMoney(r.overdue, r.currency)}</td>
                <td className="py-1 text-right">{formatMoney(r.paid, r.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InvoiceTable({
  title,
  rows,
  link,
}: {
  title: string;
  rows: ReturnType<typeof filterAndSort>;
  link: { href: string; label: string };
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        <Link href={link.href} className="text-sm font-medium text-primary hover:underline">
          {link.label}
        </Link>
      </div>
      <ul className="divide-y border-t">
        {rows.map((inv) => (
          <li key={inv.id}>
            <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
              <span className="w-20 shrink-0 font-medium">{inv.invoice_number}</span>
              <span className="min-w-0 flex-1 truncate">{inv.clientName ?? <span className="text-muted-foreground">No client</span>}</span>
              <span className="hidden text-muted-foreground sm:block">{inv.due_date ? `Due ${formatDate(inv.due_date)}` : formatDate(inv.issue_date)}</span>
              <span className="tabular-nums">{formatMoney(inv.total_minor, inv.currency)}</span>
              <StatusBadge status={inv.displayStatus} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GettingStarted({ hasClients }: { hasClients: boolean }) {
  const steps = [
    { done: true, title: "Set up your business", body: "Done. You can change your details any time in Settings.", href: "/settings", cta: "Settings" },
    { done: hasClients, title: "Add a client", body: "Save who you bill so their details fill in automatically.", href: "/clients/new", cta: "Add client" },
    { done: false, title: "Create your first invoice", body: "Add line items, preview it, then download a PDF.", href: "/invoices/new", cta: "Create invoice" },
  ];
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-medium">Get started</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your totals will appear here once you&apos;ve issued invoices.</p>
      <ol className="mt-5 grid gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                s.done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 text-primary",
              )}
              aria-hidden
            >
              {s.done ? <CheckCircle2 className="size-4" /> : i + 1}
            </span>
            {/* min-w-48 makes the button wrap below on phones instead of squeezing the text. */}
            <div className="min-w-48 flex-1">
              <p className="font-medium">
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
            {!s.done && (
              <Link href={s.href} className={buttonVariants({ variant: i === 2 ? "default" : "outline" })}>
                {i === 1 ? <Users aria-hidden /> : <Plus aria-hidden />}
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
