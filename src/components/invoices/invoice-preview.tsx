import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PreviewParty = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  address: string[];
};

export type PreviewData = {
  business: PreviewParty & { logoUrl?: string | null };
  client: PreviewParty | null;
  number: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  currency: string;
  items: { description: string; quantity: string; unitPriceMinor: number; lineTotalMinor: number }[];
  totals: { subtotal: number; discount: number; taxable: number; tax: number; total: number };
  discountLabel: string | null;
  taxLabel: string | null;
  paymentInstructions: string;
  notes: string;
  terms: string;
};

/**
 * The invoice as it will look on paper. Always light, like the PDF, and laid
 * out to match it. Long text wraps; empty optional sections are left out.
 */
export function InvoicePreview({ data, className }: { data: PreviewData; className?: string }) {
  const money = (minor: number) => formatMoney(minor, data.currency);
  const { business, client, totals } = data;
  const hasItems = data.items.some((i) => i.description || i.lineTotalMinor > 0);

  return (
    <article
      aria-label="Invoice preview"
      className={cn(
        "w-full rounded-md bg-white p-4 text-[11px] leading-relaxed text-zinc-800 shadow-sm ring-1 ring-zinc-200 sm:p-10 sm:text-[12px]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="grid min-w-0 max-w-[60%] gap-1">
          {business.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt="" className="mb-2 max-h-14 max-w-44 object-contain object-left" />
          )}
          <p className="text-[15px] font-semibold text-zinc-900 [overflow-wrap:anywhere]">{business.name || "Your business"}</p>
          <PartyLines party={business} />
        </div>
        <div className="grid justify-items-end gap-0.5 text-right">
          <p className="text-[22px] font-semibold tracking-tight text-zinc-900">INVOICE</p>
          <p className="font-medium tabular-nums text-zinc-600">{data.number}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Bill to</p>
          {client ? (
            <>
              <p className="font-semibold text-zinc-900 [overflow-wrap:anywhere]">{client.name}</p>
              {client.company && <p>{client.company}</p>}
              <PartyLines party={client} />
            </>
          ) : (
            <p className="text-zinc-500 italic">No client selected</p>
          )}
        </div>
        <dl className="grid content-start gap-1 sm:justify-self-end">
          <Meta label="Issue date" value={data.issueDate} />
          {data.dueDate && <Meta label="Due date" value={data.dueDate} strong />}
          {data.reference && <Meta label="Reference" value={data.reference} />}
        </dl>
      </section>

      {/* Numeric columns size to their content and never wrap; the description takes the rest. */}
      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-300 text-[10px] tracking-wider whitespace-nowrap text-zinc-500 uppercase">
            <th className="w-full py-2 pr-2 text-left font-semibold">Description</th>
            <th className="py-2 px-1.5 text-right font-semibold sm:px-2">Qty</th>
            <th className="py-2 px-1.5 text-right font-semibold sm:px-2">Unit price</th>
            <th className="py-2 pl-1.5 text-right font-semibold sm:pl-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {hasItems ? (
            data.items.map((item, i) => (
              <tr key={i} className="border-b border-zinc-100 align-top">
                <td className="py-2 pr-2 whitespace-pre-line [overflow-wrap:anywhere]">{item.description || <span className="text-zinc-500 italic">No description</span>}</td>
                <td className="py-2 px-1.5 text-right whitespace-nowrap tabular-nums sm:px-2">{item.quantity}</td>
                <td className="py-2 px-1.5 text-right whitespace-nowrap tabular-nums sm:px-2">{money(item.unitPriceMinor)}</td>
                <td className="py-2 pl-1.5 text-right whitespace-nowrap tabular-nums sm:pl-2">{money(item.lineTotalMinor)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-500 italic">
                Add a line item to get started
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto grid w-full max-w-64 gap-1 tabular-nums">
        <Total label="Subtotal" value={money(totals.subtotal)} />
        {data.discountLabel && <Total label={data.discountLabel} value={`−${money(totals.discount)}`} />}
        {data.taxLabel && <Total label={data.taxLabel} value={money(totals.tax)} />}
        <div className="mt-1 flex justify-between gap-4 border-t border-zinc-300 pt-2 text-[14px] font-semibold text-zinc-900">
          <dt>Total due</dt>
          <dd>{money(totals.total)}</dd>
        </div>
      </dl>

      {(data.paymentInstructions || data.notes || data.terms) && (
        <footer className="mt-10 grid gap-4 border-t border-zinc-200 pt-6">
          {data.paymentInstructions && <Block title="Payment details" body={data.paymentInstructions} />}
          {data.notes && <Block title="Notes" body={data.notes} />}
          {data.terms && <Block title="Terms" body={data.terms} />}
        </footer>
      )}
    </article>
  );
}

function PartyLines({ party }: { party: PreviewParty }) {
  const lines = [...party.address, party.email, party.phone, party.website, party.taxId && `Tax ID: ${party.taxId}`].filter(
    (l): l is string => !!l,
  );
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className="text-zinc-600 [overflow-wrap:anywhere]">
          {line}
        </p>
      ))}
    </>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-6 sm:justify-end">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={cn("min-w-24 text-right", strong && "font-semibold text-zinc-900")}>{value}</dd>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">{title}</p>
      <p className="whitespace-pre-line text-zinc-700 [overflow-wrap:anywhere]">{body}</p>
    </div>
  );
}
