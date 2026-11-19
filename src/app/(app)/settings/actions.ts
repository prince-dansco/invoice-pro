"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { LOGO_MAX_BYTES, sniffImage } from "@/lib/logo";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { formValues, invalid, type FormState } from "@/lib/validation/form-state";
import { SETTINGS_FIELDS, settingsSchema } from "@/lib/validation/profile";

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData, SETTINGS_FIELDS);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ...invalid(parsed.error, values), error: "Check the highlighted fields." };
  }

  // Only the parsed, whitelisted fields are written.
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: "We couldn't save your settings. Please try again.", values };

  revalidatePath("/", "layout");
  return { success: "Settings saved.", values };
}

export async function uploadLogo(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (file.size > LOGO_MAX_BYTES) return { error: "That image is over 1 MB. Choose a smaller one." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { error: "Use a PNG or JPG image." };

  const supabase = await createClient();
  // A new name each time, so cached copies of the old logo are never shown.
  const path = `${user.id}/logo-${Date.now()}.${kind.ext}`;
  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, bytes, { contentType: kind.type, upsert: false });
  if (uploadError) return { error: "We couldn't upload that image. Please try again." };

  const previous = (await getProfile())?.logo_path;
  const { error } = await supabase.from("profiles").update({ logo_path: path }).eq("id", user.id);
  if (error) {
    await supabase.storage.from("logos").remove([path]);
    return { error: "We couldn't save your logo. Please try again." };
  }
  if (previous && previous !== path) await supabase.storage.from("logos").remove([previous]);

  revalidatePath("/settings");
  return { success: "Logo updated." };
}

export async function removeLogo(): Promise<FormState> {
  const user = await requireUser();
  const previous = (await getProfile())?.logo_path;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ logo_path: null }).eq("id", user.id);
  if (error) return { error: "We couldn't remove your logo. Please try again." };
  if (previous) await supabase.storage.from("logos").remove([previous]);

  revalidatePath("/settings");
  return { success: "Logo removed." };
}
