import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Download, FileCheck2, Lock, ReceiptText, Users } from "lucide-react";

import { InvoicePreview, type PreviewData } from "@/components/invoices/invoice-preview";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "InvoicePro · Professional invoices in minutes" },
  description: "Create professional invoices, download them as PDFs and keep track of what you're owed.",
};

// Every feature listed here exists in the app. No invented numbers or testimonials.
const FEATURES = [
  { icon: ReceiptText, title: "Professional invoices", body: "Your logo, business details, line items, discounts and tax, laid out cleanly." },
  { icon: Calculator, title: "Totals you can trust", body: "Every total is calculated on the server in whole kobo or cents, so nothing is off by a rounding error." },
  { icon: Download, title: "PDF downloads", body: "Download a print-ready PDF on A4 or US Letter, named after the invoice and client." },
  { icon: FileCheck2, title: "Track every invoice", body: "See what's draft, sent, paid and overdue, with totals for what you're still owed." },
  { icon: Users, title: "Client directory", body: "Save clients once and their details fill in on every invoice." },
  { icon: Lock, title: "Private by default", body: "Your data is only visible to your account, and issued invoices are locked against changes." },
];

const STEPS = [
  { title: "Set up your business", body: "Add your business name, logo, currency and payment details." },
  { title: "Create an invoice", body: "Choose a client, add line items and see a live preview as you type." },
  { title: "Download and send", body: "Issue it, download the PDF and mark it paid when the money arrives." },
];

// Clearly an example: shown to illustrate the layout, not presented as a real customer.
const SAMPLE: PreviewData = {
  business: { name: "Your Business Ltd", email: "hello@yourbusiness.com", address: ["12 Example Street", "Lagos"], logoUrl: null },
  client: { name: "Example Client", company: "Client Company", address: ["4 Sample Road", "Abuja"] },
  number: "INV-001",
  issueDate: "1 Nov 2026",
  dueDate: "15 Nov 2026",
  reference: "",
  currency: "NGN",
  items: [
    { description: "Website design", quantity: "1", unitPriceMinor: 35_000_000, lineTotalMinor: 35_000_000 },
    { description: "Content writing (pages)", quantity: "5", unitPriceMinor: 2_000_000, lineTotalMinor: 10_000_000 },
  ],
  totals: { subtotal: 45_000_000, discount: 0, taxable: 45_000_000, tax: 3_375_000, total: 48_375_000 },
  discountLabel: null,
  taxLabel: "VAT (7.5%)",
  paymentInstructions: "",
  notes: "",
  terms: "",
};

export default async function Home() {
  const user = await getUser();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <ReceiptText className="size-4" aria-hidden />
            </span>
            InvoicePro
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className={buttonVariants()}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
                  Sign in
                </Link>
                <Link href="/signup" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="grid justify-items-start gap-6">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Professional invoices, and a clear view of what you&apos;re owed</h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Create an invoice in minutes, download it as a PDF, and always know which invoices are paid, pending or overdue.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={user ? "/invoices/new" : "/signup"} className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}>
                Create your first invoice
                <ArrowRight aria-hidden />
              </Link>
              {!user && (
                <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-5 text-base" })}>
                  Sign in
                </Link>
              )}
            </div>
          </div>
          <div className="relative" aria-hidden>
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
            <InvoicePreview data={SAMPLE} className="pointer-events-none rotate-1 select-none" />
            <p className="mt-3 text-center text-xs text-muted-foreground">Example invoice</p>
          </div>
        </section>

        <section className="border-y bg-muted/40" aria-labelledby="features">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 id="features" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything you need to invoice clients
            </h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl border bg-card p-5">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20" aria-labelledby="how">
          <h2 id="how" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary px-6 py-8 text-primary-foreground sm:px-10">
            <p className="text-xl font-semibold">Ready to send your first invoice?</p>
            <Link href={user ? "/invoices/new" : "/signup"} className={buttonVariants({ variant: "secondary", size: "lg", className: "h-11 px-5 text-base" })}>
              Create your first invoice
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} InvoicePro</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
