import "server-only";

import { listClients } from "@/lib/clients";
import { addressLines } from "@/lib/invoice/format";
import { getLogoUrl, getProfile } from "@/lib/profile";

import type { EditorClient } from "./invoice-editor";

/** Business details, logo and clients that every editor page needs. */
export async function loadEditorContext() {
  const profile = (await getProfile())!;
  const [logoUrl, clients] = await Promise.all([getLogoUrl(profile.logo_path), listClients()]);

  const editorClients: EditorClient[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    taxId: c.tax_id,
    address: addressLines(c),
  }));

  return {
    profile,
    clients: editorClients,
    business: {
      name: profile.business_name,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      taxId: profile.tax_id,
      address: addressLines(profile),
      logoUrl,
    },
    nextNumberPreview: `${profile.invoice_prefix}${String(profile.next_invoice_number).padStart(3, "0")}`,
  };
}
