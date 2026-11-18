import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { getClient } from "@/lib/clients";

import { ClientEditor } from "../client-editor";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const client = await getClient((await params).id);
  return { title: client?.name ?? "Client" };
}

export default async function ClientPage({ params }: Params) {
  // RLS means another user's client ID behaves exactly like a missing one.
  const client = await getClient((await params).id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Clients
      </Link>
      <PageHeader title={client.name} description={client.company ?? undefined} />
      <div className="grid gap-6">
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <ClientEditor client={client} />
        </div>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 p-5 sm:p-6">
          <div className="grid gap-1">
            <h2 className="font-medium">Delete client</h2>
            <p className="text-sm text-muted-foreground">Removes them from your list. Existing invoices aren&apos;t affected.</p>
          </div>
          <DeleteClientButton id={client.id} name={client.name} />
        </section>
      </div>
    </div>
  );
}
