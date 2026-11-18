import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyClients, listClients } from "@/lib/clients";

import { SearchInput } from "@/components/forms/search-input";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const clients = await listClients(q);
  const searching = q.trim().length > 0;
  const empty = !searching && clients.length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Clients" description="The people and businesses you bill." />
        {!empty && (
          <Link href="/clients/new" className={buttonVariants()}>
            <Plus aria-hidden />
            New client
          </Link>
        )}
      </div>

      {empty ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          <SearchInput placeholder="Search name, company or email" label="Search clients" />
          {clients.length === 0 ? (
            <NoMatches q={q} />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
                      {c.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[1fr_1fr] sm:gap-4">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        {c.company && <span className="block truncate text-sm text-muted-foreground">{c.company}</span>}
                      </span>
                      <span className="min-w-0 truncate text-sm text-muted-foreground sm:self-center">
                        {c.email ?? c.phone ?? ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "client" : "clients"}
            {searching && " found"}
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Users className="size-6" aria-hidden />
      </span>
      <h2 className="text-lg font-medium">No clients yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add the people and businesses you work with, and their details fill in automatically on every invoice.
      </p>
      <Link href="/clients/new" className={buttonVariants({ size: "lg", className: "mt-2" })}>
        <Plus aria-hidden />
        Add your first client
      </Link>
    </div>
  );
}

async function NoMatches({ q }: { q: string }) {
  const any = await hasAnyClients();
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
      No clients match &ldquo;{q}&rdquo;.{" "}
      {any && (
        <Link href="/clients" className="font-medium text-primary hover:underline">
          Clear search
        </Link>
      )}
    </div>
  );
}
