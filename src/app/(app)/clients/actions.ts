"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_FIELDS, clientSchema } from "@/lib/validation/client";
import { formValues, invalid, type FormState } from "@/lib/validation/form-state";

export type SavedClient = { id: string; name: string; company: string | null; email: string | null };
export type ClientFormState = FormState & { client?: SavedClient };

const idSchema = z.uuid();

/** Creates a client, or updates one when the form includes an `id`. */
export async function saveClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const user = await requireUser();
  const values = formValues(formData, CLIENT_FIELDS);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const rawId = formData.get("id");
  const supabase = await createClient();

  if (rawId) {
    const id = idSchema.safeParse(rawId);
    if (!id.success) return { error: "That client couldn't be found.", values };
    // Only whitelisted fields; RLS plus the explicit user_id filter keep it to the user's own row.
    const { data, error } = await supabase
      .from("clients")
      .update(parsed.data)
      .eq("id", id.data)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id, name, company, email")
      .maybeSingle<SavedClient>();
    if (error) return { error: "We couldn't save this client. Please try again.", values };
    if (!data) return { error: "That client couldn't be found. It may have been deleted.", values };
    revalidatePath("/clients");
    return { success: "Client saved.", client: data };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id, name, company, email")
    .single<SavedClient>();
  if (error) return { error: "We couldn't add this client. Please try again.", values };

  revalidatePath("/clients");
  return { success: `${data.name} added.`, client: data };
}

/**
 * Soft delete: the row is hidden from lists and pickers but kept, so existing
 * invoices still link to it. Invoices also keep their own client snapshot.
 */
export async function deleteClient(id: string): Promise<FormState> {
  const user = await requireUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "That client couldn't be found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("name")
    .maybeSingle<{ name: string }>();
  if (error) return { error: "We couldn't delete this client. Please try again." };
  if (!data) return { error: "That client couldn't be found." };

  revalidatePath("/clients");
  return { success: `${data.name} deleted.` };
}
