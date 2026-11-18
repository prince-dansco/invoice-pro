"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { emailInvoice, type EmailResult } from "./email-actions";

type Props = {
  id: string;
  number: string;
  configured: boolean;
  defaults: { to: string; subject: string; message: string };
};

export function EmailInvoiceDialog({ id, number, configured, defaults }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(defaults);
  const [result, setResult] = useState<Extract<EmailResult, { ok: false }> | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await emailInvoice(id, values).catch(
        (): EmailResult => ({ ok: false, error: "Couldn't reach the server. Check your connection and try again." }),
      );
      router.refresh(); // shows the attempt in the delivery history either way
      if (!res.ok) {
        setResult(res);
        return;
      }
      toast.success(res.message);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setValues(defaults);
          setResult(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Mail aria-hidden />
            Email invoice
          </Button>
        }
      />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email {number}</DialogTitle>
          <DialogDescription>
            {configured
              ? "The invoice PDF is attached. Replies go to your business email address."
              : "Email sending isn't set up for this app yet."}
          </DialogDescription>
        </DialogHeader>

        {configured ? (
          <form id="email-invoice" onSubmit={send} className="grid gap-4" noValidate>
            {result && <FormMessage state={{ error: result.error }} />}
            <Field label="To" type="email" autoComplete="email" required value={values.to} onChange={set("to")} errors={result?.fieldErrors?.to} />
            <Field label="Subject" maxLength={200} required value={values.subject} onChange={set("subject")} errors={result?.fieldErrors?.subject} />
            <TextareaField label="Message" rows={7} maxLength={2000} value={values.message} onChange={set("message")} errors={result?.fieldErrors?.message} />
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Download the PDF and send it yourself for now. To send from here, add <code className="text-foreground">RESEND_API_KEY</code> and{" "}
            <code className="text-foreground">EMAIL_FROM</code> to the server&apos;s environment variables (see the README).
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>{configured ? "Cancel" : "Close"}</DialogClose>
          {configured && (
            <Button type="submit" form="email-invoice" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
              {pending ? "Sending…" : "Send email"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
