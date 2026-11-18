import { CheckCircle2, XCircle } from "lucide-react";

export type Delivery = {
  id: string;
  recipient: string;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Every attempt to email this invoice, newest first (IP-223). */
export function DeliveryHistory({ deliveries }: { deliveries: Delivery[] }) {
  if (deliveries.length === 0) return null;
  return (
    <section aria-labelledby="email-history" className="rounded-xl border bg-card p-4">
      <h2 id="email-history" className="mb-2 text-sm font-medium">
        Email history
      </h2>
      <ul className="grid gap-2 text-sm">
        {deliveries.map((d) => (
          <li key={d.id} className="flex items-start gap-2">
            {d.status === "sent" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            )}
            <div className="min-w-0">
              <p>
                {d.status === "sent" ? "Sent to " : "Couldn't send to "}
                <span className="font-medium [overflow-wrap:anywhere]">{d.recipient}</span>
                <span className="text-muted-foreground"> · {when(d.created_at)}</span>
              </p>
              {d.error && <p className="text-xs text-muted-foreground">{d.error}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
