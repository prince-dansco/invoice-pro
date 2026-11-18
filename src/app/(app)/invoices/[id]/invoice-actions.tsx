"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Pencil, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/forms/field";
import { Button, buttonVariants } from "@/components/ui/button";
import type { DisplayStatus } from "@/lib/invoice/status";

import { deleteDraft, issueInvoice, markPaid, markUnpaid, reopenInvoice, type StatusResult } from "../status-actions";

type Props = { id: string; number: string; status: DisplayStatus; clientName: string | null; total: string; today: string };

export function InvoiceActions({ id, number, status, clientName, total, today }: Props) {
  const router = useRouter();
  const [paidOn, setPaidOn] = useState(today);

  const handle = async (result: StatusResult, then?: () => void) => {
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message);
    if (then) then();
    else router.refresh();
    return true;
  };

  const pdf = `/invoices/${id}/pdf`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={pdf} className={buttonVariants({ variant: status === "draft" ? "outline" : "default" })}>
        <Download aria-hidden />
        Download PDF
      </a>
      <a href={`${pdf}?size=letter`} className={buttonVariants({ variant: "ghost", size: "sm" })} title="Download on US Letter paper">
        US Letter
      </a>

      {status === "draft" && (
        <>
          <Link href={`/invoices/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
            <Pencil aria-hidden />
            Edit
          </Link>
          <ConfirmDialog
            trigger={
              <Button>
                <Send aria-hidden />
                Issue invoice
              </Button>
            }
            title={`Issue ${number}?`}
            description={`This locks the invoice so it can't change after you send it${clientName ? ` to ${clientName}` : ""}. Your business and client details are saved with it as they are now. If you need to make changes later, you can reopen it as a draft.`}
            confirmLabel="Issue invoice"
            onConfirm={async () => handle(await issueInvoice(id))}
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost">
                <Trash2 aria-hidden />
                Delete draft
              </Button>
            }
            title={`Delete draft ${number}?`}
            description="The draft and its line items will be deleted. This can't be undone."
            confirmLabel="Delete draft"
            destructive
            onConfirm={async () => handle(await deleteDraft(id), () => router.push("/invoices"))}
          />
        </>
      )}

      {(status === "sent" || status === "overdue") && (
        <>
          <ConfirmDialog
            trigger={
              <Button variant="outline">
                <CheckCircle2 aria-hidden />
                Mark as paid
              </Button>
            }
            title={`Mark ${number} as paid?`}
            description={`This records full payment of ${total}. Your dashboard totals update straight away.`}
            confirmLabel="Mark as paid"
            onConfirm={async () => handle(await markPaid(id, paidOn))}
          >
            <Field label="Payment date" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
          </ConfirmDialog>
          <ConfirmDialog
            trigger={
              <Button variant="ghost">
                <RotateCcw aria-hidden />
                Reopen as draft
              </Button>
            }
            title={`Reopen ${number} as a draft?`}
            description={`You'll be able to edit it again, and it keeps the number ${number}. If you've already sent it${clientName ? ` to ${clientName}` : ""}, they may have the old version, so let them know about any changes and send the updated copy.`}
            confirmLabel="Reopen as draft"
            onConfirm={async () => handle(await reopenInvoice(id), () => router.push(`/invoices/${id}/edit`))}
          />
        </>
      )}

      {status === "paid" && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost">
              <Undo2 aria-hidden />
              Mark as unpaid
            </Button>
          }
          title={`Mark ${number} as unpaid?`}
          description="Use this if the payment was recorded by mistake. The invoice goes back to sent (or overdue if it's past its due date)."
          confirmLabel="Mark as unpaid"
          onConfirm={async () => handle(await markUnpaid(id))}
        />
      )}
    </div>
  );
}
