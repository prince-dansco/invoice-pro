"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { InvoicePreview, type PreviewData, type PreviewParty } from "@/components/invoices/invoice-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES } from "@/lib/currencies";
import { addDays, isIsoDate, MAX_ITEMS, parseDraft, type DraftErrors, type DraftInput, type DraftItemInput } from "@/lib/invoice/draft";
import { formatDate, formatQuantity } from "@/lib/invoice/format";
import { currencyDigits, formatMoney, parseQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";

import { saveDraft } from "./actions";

export type EditorClient = PreviewParty & { id: string };

type Row = DraftItemInput & { key: number };

type Props = {
  invoiceId: string | null;
  /** Assigned number, or null for a new invoice (assigned by the database on first save). */
  invoiceNumber: string | null;
  nextNumberPreview: string;
  initial: DraftInput;
  business: PreviewData["business"];
  clients: EditorClient[];
  paymentTermsDays: number;
};

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
const DISCOUNT_OPTIONS = [
  { value: "none", label: "No discount" },
  { value: "percent", label: "Percentage (%)" },
  { value: "fixed", label: "Fixed amount" },
];

let nextKey = 1;
const toRows = (items: DraftItemInput[]): Row[] => items.map((i) => ({ ...i, key: nextKey++ }));
const emptyRow = (): Row => ({ key: nextKey++, description: "", quantity: "1", unit_price: "" });

export function InvoiceEditor(props: Props) {
  const router = useRouter();
  const [id, setId] = useState(props.invoiceId);
  const [number, setNumber] = useState(props.invoiceNumber);
  const [header, setHeader] = useState<Omit<DraftInput, "items">>(() => {
    const { items: _items, ...rest } = props.initial;
    void _items;
    return rest;
  });
  const [rows, setRows] = useState<Row[]>(() => (props.initial.items.length ? toRows(props.initial.items) : [emptyRow()]));
  const [clients, setClients] = useState(props.clients);
  // New invoices follow the payment terms until the due date is edited by hand.
  const [dueTouched, setDueTouched] = useState(props.invoiceId !== null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<DraftErrors | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const draft: DraftInput = useMemo(
    () => ({ ...header, items: rows.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price })) }),
    [header, rows],
  );
  const result = useMemo(() => parseDraft(draft), [draft]);
  const [savedJson, setSavedJson] = useState(() => (props.invoiceId ? JSON.stringify(draft) : ""));
  const dirty = JSON.stringify(draft) !== savedJson;

  // Format problems show as you type; "required"-style problems after the first save attempt.
  const errors = serverErrors ?? result.errors;
  const fieldError = (k: keyof DraftErrors["fields"]) => {
    const e = errors.fields[k];
    if (!e) return undefined;
    return attempted || (header[k as keyof typeof header] as string)?.toString().trim() ? [e] : undefined;
  };
  const itemError = (i: number, k: keyof DraftItemInput) => {
    const e = errors.items[i]?.[k];
    return e && (attempted || rows[i]?.[k].trim()) ? e : undefined;
  };

  const set = <K extends keyof typeof header>(k: K, v: (typeof header)[K]) => {
    setServerErrors(null);
    setHeader((h) => ({ ...h, [k]: v }));
  };

  function setIssueDate(v: string) {
    setServerErrors(null);
    setHeader((h) => ({
      ...h,
      issue_date: v,
      due_date: !dueTouched && isIsoDate(v) ? addDays(v, props.paymentTermsDays) : h.due_date,
    }));
  }

  function setRow(key: number, patch: Partial<DraftItemInput>) {
    setServerErrors(null);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const save = useCallback(() => {
    setAttempted(true);
    setFormError(null);
    if (!result.value) {
      setFormError(result.errors.form ?? "Fix the highlighted fields, then save again.");
      return;
    }
    const snapshot = JSON.stringify(draft);
    startSaving(async () => {
      let res: Awaited<ReturnType<typeof saveDraft>>;
      try {
        res = await saveDraft(id, draft);
      } catch {
        // Network failure or server crash: keep everything on screen so nothing is lost.
        res = { ok: false, error: "Couldn't reach the server. Your changes are still here; check your connection and save again." };
      }
      if (!res.ok) {
        setFormError(res.error);
        if (res.errors) setServerErrors(res.errors);
        toast.error(res.error);
        return;
      }
      setSavedJson(snapshot);
      setServerErrors(null);
      setAttempted(false);
      toast.success(id ? "Draft saved." : `Draft saved as ${res.invoiceNumber}.`);
      if (!id) {
        setId(res.id);
        setNumber(res.invoiceNumber);
        router.replace(`/invoices/${res.id}/edit`, { scroll: false });
      }
    });
  }, [draft, id, result, router]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, saving]);

  // Warn before leaving with unsaved changes.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const digits = currencyDigits(header.currency);
  const money = (minor: number) => formatMoney(minor, header.currency);
  const selectedClient = clients.find((c) => c.id === header.client_id) ?? null;

  const preview: PreviewData = {
    business: props.business,
    client: selectedClient,
    number: number ?? `${props.nextNumberPreview} (on save)`,
    issueDate: formatDate(isIsoDate(header.issue_date) ? header.issue_date : null),
    dueDate: formatDate(isIsoDate(header.due_date) ? header.due_date : null),
    reference: header.reference.trim(),
    currency: header.currency,
    items: rows.map((r, i) => ({
      description: r.description.trim(),
      quantity: formatQuantity(parseQuantity(r.quantity) ?? 0),
      unitPriceMinor: result.value?.items[i]?.unitPriceMinor ?? parseFloatSafe(r.unit_price, digits),
      lineTotalMinor: result.totals.lineTotals[i] ?? 0,
    })),
    totals: result.totals,
    discountLabel:
      header.discount_type === "percent"
        ? `Discount (${header.discount_value || "0"}%)`
        : header.discount_type === "fixed"
          ? "Discount"
          : null,
    taxLabel: header.tax_rate.trim() && Number(header.tax_rate) > 0 ? `Tax (${header.tax_rate.trim()}%)` : null,
    paymentInstructions: header.payment_instructions.trim(),
    notes: header.notes.trim(),
    terms: header.terms.trim(),
  };

  return (
    <div className="grid gap-4">
      {/* Toolbar */}
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{number ?? "New invoice"}</h1>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : id ? "All changes saved" : "Draft not saved yet"}
          </p>
        </div>
        <div className="flex rounded-lg border p-0.5 lg:hidden" role="group" aria-label="View">
          <Button size="sm" variant={view === "edit" ? "secondary" : "ghost"} aria-pressed={view === "edit"} onClick={() => setView("edit")}>
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button size="sm" variant={view === "preview" ? "secondary" : "ghost"} aria-pressed={view === "preview"} onClick={() => setView("preview")}>
            <Eye aria-hidden />
            Preview
          </Button>
        </div>
        <Button variant={id && !dirty ? "outline" : "default"} onClick={save} disabled={saving} title="Save draft (Ctrl+S)">
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Save draft
        </Button>
        {id && !dirty && (
          <Link href={`/invoices/${id}`} className={buttonVariants()}>
            Preview &amp; issue
            <ArrowRight aria-hidden />
          </Link>
        )}
      </div>

      {formError && <FormMessage state={{ error: formError }} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Form */}
        <form
          className={cn("grid gap-6", view === "preview" && "hidden lg:grid")}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
        >
          <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-medium">Client</h2>
            <div className="flex flex-wrap items-end gap-2">
              <SelectField
                className="min-w-0 flex-1"
                label="Bill to"
                value={header.client_id ?? ""}
                onChange={(e) => set("client_id", e.target.value || null)}
                options={[{ value: "", label: clients.length ? "Choose a client…" : "No clients yet" }, ...clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))]}
                errors={fieldError("client_id")}
              />
              <NewClientDialog
                onCreated={(c) => {
                  setClients((cs) => [...cs, { id: c.id, name: c.name, company: c.company, email: c.email, address: [] }].sort((a, b) => a.name.localeCompare(b.name)));
                  set("client_id", c.id);
                }}
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-medium">Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Issue date" type="date" value={header.issue_date} onChange={(e) => setIssueDate(e.target.value)} errors={fieldError("issue_date")} required />
              <Field
                label="Due date"
                type="date"
                value={header.due_date}
                min={header.issue_date || undefined}
                onChange={(e) => {
                  setDueTouched(true);
                  set("due_date", e.target.value);
                }}
                errors={fieldError("due_date")}
                hint={!dueTouched ? `${props.paymentTermsDays} days after the issue date.` : undefined}
              />
              <SelectField label="Currency" value={header.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCY_OPTIONS} errors={fieldError("currency")} />
              <Field label="Reference" placeholder="PO number or project" maxLength={100} value={header.reference} onChange={(e) => set("reference", e.target.value)} errors={fieldError("reference")} />
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-medium">Line items</h2>
            <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_8rem_7.5rem_2rem] gap-2 text-xs font-medium text-muted-foreground sm:grid">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit price</span>
              <span className="text-right">Amount</span>
              <span className="sr-only">Remove</span>
            </div>
            <ol className="grid gap-3">
              {rows.map((row, i) => (
                <li key={row.key} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7.5rem_2rem] sm:items-start sm:border-0 sm:p-0">
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor={`desc-${row.key}`} className="mb-1 sm:sr-only">
                      Description, line {i + 1}
                    </Label>
                    <Textarea
                      id={`desc-${row.key}`}
                      rows={1}
                      maxLength={1000}
                      placeholder="What did you provide?"
                      value={row.description}
                      onChange={(e) => setRow(row.key, { description: e.target.value })}
                      aria-invalid={itemError(i, "description") ? true : undefined}
                      className="min-h-8 py-1"
                    />
                    <ItemError msg={itemError(i, "description")} />
                  </div>
                  <div>
                    <Label htmlFor={`qty-${row.key}`} className="mb-1 sm:sr-only">
                      Quantity, line {i + 1}
                    </Label>
                    <InputCell id={`qty-${row.key}`} inputMode="decimal" value={row.quantity} onChange={(v) => setRow(row.key, { quantity: v })} error={itemError(i, "quantity")} />
                  </div>
                  <div>
                    <Label htmlFor={`price-${row.key}`} className="mb-1 sm:sr-only">
                      Unit price, line {i + 1}
                    </Label>
                    <InputCell
                      id={`price-${row.key}`}
                      inputMode={digits ? "decimal" : "numeric"}
                      placeholder={digits ? "0.00" : "0"}
                      value={row.unit_price}
                      onChange={(v) => setRow(row.key, { unit_price: v })}
                      error={itemError(i, "unit_price")}
                    />
                  </div>
                  <p className="self-center text-right text-sm font-medium tabular-nums sm:h-8 sm:leading-8" aria-label={`Amount, line ${i + 1}`}>
                    {money(result.totals.lineTotals[i] ?? 0)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="justify-self-end"
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    aria-label={`Remove line ${i + 1}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" className="justify-self-start" disabled={rows.length >= MAX_ITEMS} onClick={() => setRows((rs) => [...rs, emptyRow()])}>
              <Plus aria-hidden />
              Add line
            </Button>
          </section>

          <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-medium">Discount and tax</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Discount" value={header.discount_type} onChange={(e) => set("discount_type", e.target.value as DraftInput["discount_type"])} options={DISCOUNT_OPTIONS} />
              {header.discount_type !== "none" && (
                <Field
                  label={header.discount_type === "percent" ? "Discount (%)" : `Discount (${header.currency})`}
                  inputMode="decimal"
                  value={header.discount_value}
                  onChange={(e) => set("discount_value", e.target.value)}
                  errors={fieldError("discount_value")}
                />
              )}
              <Field label="Tax rate (%)" inputMode="decimal" value={header.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} errors={fieldError("tax_rate")} />
            </div>
            <dl className="ml-auto grid w-full max-w-72 gap-1 text-sm tabular-nums">
              <TotalRow label="Subtotal" value={money(result.totals.subtotal)} />
              {header.discount_type !== "none" && <TotalRow label="Discount" value={`−${money(result.totals.discount)}`} />}
              <TotalRow label="Tax" value={money(result.totals.tax)} />
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{money(result.totals.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-medium">Payment and notes</h2>
            <TextareaField
              label="Payment instructions"
              rows={3}
              maxLength={2000}
              value={header.payment_instructions}
              onChange={(e) => set("payment_instructions", e.target.value)}
              errors={fieldError("payment_instructions")}
              hint="Bank details or how to pay. Never include card numbers."
            />
            <TextareaField label="Notes" rows={2} maxLength={2000} value={header.notes} onChange={(e) => set("notes", e.target.value)} errors={fieldError("notes")} />
            <TextareaField label="Terms" rows={2} maxLength={2000} value={header.terms} onChange={(e) => set("terms", e.target.value)} errors={fieldError("terms")} />
          </section>
        </form>

        {/* Preview */}
        <div className={cn("lg:sticky lg:top-32", view === "edit" && "hidden lg:block")}>
          <p className="mb-2 hidden text-xs font-medium text-muted-foreground lg:block">Preview</p>
          <InvoicePreview data={preview} />
        </div>
      </div>
    </div>
  );
}

/** Best-effort minor units for the preview while a price is still invalid. */
function parseFloatSafe(input: string, digits: number) {
  const n = Number(input.replace(/[\s,]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10 ** digits) : 0;
}

function InputCell({
  id,
  value,
  onChange,
  error,
  ...props
}: { id: string; value: string; onChange: (v: string) => void; error?: string } & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  return (
    <div>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-right text-base tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ItemError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
