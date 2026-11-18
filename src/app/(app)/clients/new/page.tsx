import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";

import { ClientEditor } from "../client-editor";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Clients
      </Link>
      <PageHeader title="New client" description="Only the name is required." />
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <ClientEditor />
      </div>
    </div>
  );
}
