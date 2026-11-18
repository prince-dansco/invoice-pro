"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClientForm } from "@/components/clients/client-form";

/** Full-page client form: toasts on save, then returns to the list. */
export function ClientEditor({ client }: { client?: React.ComponentProps<typeof ClientForm>["client"] }) {
  const router = useRouter();
  return (
    <ClientForm
      client={client}
      submitLabel={client ? "Save changes" : "Add client"}
      onSaved={(_, message) => {
        toast.success(message);
        router.push("/clients");
        router.refresh();
      }}
    />
  );
}
