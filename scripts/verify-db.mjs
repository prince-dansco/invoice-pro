// Checks row-level security and invoice numbering against the real Supabase
// project. Creates two throwaway users, runs the checks as each of them, then
// deletes the users (which cascades to their data).
//
//   node --env-file=.env.local scripts/verify-db.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase env vars. Run with --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function makeUser(label) {
  const email = `rls-check-${label}-${Date.now()}@example.com`;
  const password = `Pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`);
  return { id: data.user.id, client };
}

const created = [];
try {
  const a = await makeUser("a");
  created.push(a.id);
  const b = await makeUser("b");
  created.push(b.id);

  // Profiles are created by the sign-up trigger.
  const { data: profA } = await a.client.from("profiles").select("id").maybeSingle();
  check("profile created on sign-up", profA?.id === a.id);
  const { data: allProfiles } = await a.client.from("profiles").select("id");
  check("user sees only their own profile", allProfiles?.length === 1);

  // User A creates data.
  const { data: clientA, error: cErr } = await a.client
    .from("clients").insert({ name: "Client of A", email: "a@example.com" }).select().single();
  check("user can create a client", !cErr && clientA, cErr?.message);

  const { data: invA, error: iErr } = await a.client
    .from("invoices").insert({ client_id: clientA.id, invoice_number: "HACKED-1" }).select().single();
  check("user can create an invoice", !iErr && invA, iErr?.message);
  check("invoice number assigned by the database", invA?.invoice_number === "INV-001", invA?.invoice_number);

  const { error: itemErr } = await a.client
    .from("invoice_items").insert({ invoice_id: invA.id, description: "Design work", quantity: 2, unit_price_minor: 50000 });
  check("user can add items to their invoice", !itemErr, itemErr?.message);

  // User B can't see or change A's data.
  for (const table of ["clients", "invoices", "invoice_items"]) {
    const { data } = await b.client.from(table).select("id");
    check(`other user can't read ${table}`, Array.isArray(data) && data.length === 0, `${data?.length} rows`);
  }
  const { data: profB } = await b.client.from("profiles").select("id").eq("id", a.id);
  check("other user can't read profile", profB?.length === 0);

  const { data: upd } = await b.client.from("invoices").update({ notes: "pwned" }).eq("id", invA.id).select();
  check("other user can't update invoice", upd?.length === 0);
  const { data: del } = await b.client.from("clients").delete().eq("id", clientA.id).select();
  check("other user can't delete client", del?.length === 0);
  const { data: updProf } = await b.client.from("profiles").update({ business_name: "pwned" }).eq("id", a.id).select();
  check("other user can't update profile", updProf?.length === 0);

  const { error: spoofErr } = await b.client.from("clients").insert({ name: "Spoof", user_id: a.id });
  check("other user can't insert rows as someone else", !!spoofErr);

  const { data: invB } = await b.client.from("invoices").insert({}).select().single();
  const { error: crossItemErr } = await b.client
    .from("invoice_items").insert({ invoice_id: invA.id, description: "x" });
  check("other user can't add items to someone else's invoice", !!crossItemErr);
  const { error: crossClientErr } = await b.client
    .from("invoices").update({ client_id: clientA.id }).eq("id", invB.id);
  check("other user can't attach someone else's client", !!crossClientErr);
  check("numbering is per user", invB?.invoice_number === "INV-001", invB?.invoice_number);

  // Anonymous visitors get nothing.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const table of ["profiles", "clients", "invoices", "invoice_items"]) {
    const { data, error } = await anon.from(table).select("id");
    check(`anonymous can't read ${table}`, !!error || data.length === 0);
  }

  // Numbers are permanent.
  const { error: renumberErr } = await a.client.from("invoices").update({ invoice_number: "INV-999" }).eq("id", invA.id);
  check("invoice number can't be changed", !!renumberErr);

  // Concurrent creation never produces duplicates.
  const results = await Promise.all(
    Array.from({ length: 20 }, () => a.client.from("invoices").insert({}).select("invoice_number").single()),
  );
  const numbers = results.map((r) => r.data?.invoice_number).filter(Boolean);
  check("20 concurrent invoices all created", numbers.length === 20, results.find((r) => r.error)?.error?.message);
  check("concurrent invoice numbers are unique", new Set(numbers).size === numbers.length);

  // A lowered start number skips numbers already taken.
  await a.client.from("profiles").update({ next_invoice_number: 1 }).eq("id", a.id);
  const { data: afterReset } = await a.client.from("invoices").insert({}).select("invoice_number").single();
  check("lowered start number skips used numbers", afterReset?.invoice_number === "INV-022", afterReset?.invoice_number);

  // Logo storage (IP-132). A 1x1 PNG.
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (ch) => ch.charCodeAt(0));
  const { data: bucket } = await admin.storage.getBucket("logos");
  if (!bucket) {
    check("logos bucket exists (run the logo storage migration)", false);
  } else {
    check("logos bucket is private", bucket.public === false);
    const own = await a.client.storage.from("logos").upload(`${a.id}/check.png`, png, { contentType: "image/png" });
    check("user can upload to their own logo folder", !own.error, own.error?.message);
    const other = await b.client.storage.from("logos").upload(`${a.id}/evil.png`, png, { contentType: "image/png" });
    check("user can't upload into someone else's folder", !!other.error);
    const read = await b.client.storage.from("logos").download(`${a.id}/check.png`);
    check("other user can't read someone else's logo", !!read.error);
    const anonRead = await anon.storage.from("logos").download(`${a.id}/check.png`);
    check("anonymous can't read logos", !!anonRead.error);
    const del = await b.client.storage.from("logos").remove([`${a.id}/check.png`]);
    const stillThere = await a.client.storage.from("logos").download(`${a.id}/check.png`);
    check("other user can't delete someone else's logo", !stillThere.error, del.error?.message);
    const svg = await a.client.storage.from("logos").upload(`${a.id}/x.svg`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
    check("bucket rejects non-image types like SVG", !!svg.error);
    const big = await a.client.storage.from("logos").upload(`${a.id}/big.png`, new Uint8Array(1024 * 1024 + 1), { contentType: "image/png" });
    check("bucket rejects files over 1 MB", !!big.error);
    await a.client.storage.from("logos").remove([`${a.id}/check.png`]);
  }

  // save_invoice (IP-164): atomic save of an invoice and its items.
  const fields = { issue_date: "2026-11-02", due_date: "2026-11-16", currency: "NGN", discount_value: 0, tax_rate_bps: 750, subtotal_minor: 3000, discount_minor: 0, taxable_minor: 3000, tax_minor: 225, total_minor: 3225 };
  const twoItems = [
    { description: "First", quantity: "1.000", unit_price_minor: 1000, line_total_minor: 1000 },
    { description: "Second", quantity: "2.000", unit_price_minor: 1000, line_total_minor: 2000 },
  ];
  const saved = await a.client.rpc("save_invoice", { p_id: null, p_invoice: { ...fields, invoice_number: "HACK", status: "paid", user_id: b.id }, p_items: twoItems }).single();
  if (saved.error) {
    check("save_invoice exists (run the save_invoice migration)", false, saved.error.message);
  } else {
    const { data: row } = await a.client.from("invoices").select("status, user_id, total_minor").eq("id", saved.data.saved_id).single();
    check("save_invoice creates a draft owned by the caller", row?.status === "draft" && row?.user_id === a.id, JSON.stringify(row));
    const { data: items1 } = await a.client.from("invoice_items").select("description, position").eq("invoice_id", saved.data.saved_id).order("position");
    check("save_invoice stores items in order", items1?.map((i) => i.description).join() === "First,Second");

    const replaced = await a.client.rpc("save_invoice", { p_id: saved.data.saved_id, p_invoice: fields, p_items: [twoItems[1]] }).single();
    const { data: items2 } = await a.client.from("invoice_items").select("description").eq("invoice_id", saved.data.saved_id);
    check("save_invoice replaces items", !replaced.error && items2?.length === 1 && items2[0].description === "Second");

    const badItems = await a.client.rpc("save_invoice", { p_id: saved.data.saved_id, p_invoice: fields, p_items: [{ description: "x", quantity: "1", unit_price_minor: -5, line_total_minor: 0 }] }).single();
    const { data: items3 } = await a.client.from("invoice_items").select("description").eq("invoice_id", saved.data.saved_id);
    check("a failed save leaves the previous items intact", !!badItems.error && items3?.length === 1 && items3[0].description === "Second");

    const hijack = await b.client.rpc("save_invoice", { p_id: saved.data.saved_id, p_invoice: fields, p_items: [] }).single();
    const { data: items4 } = await a.client.from("invoice_items").select("id").eq("invoice_id", saved.data.saved_id);
    check("other user can't save over someone else's invoice", !!hijack.error && items4?.length === 1);

    // Issued invoices must carry snapshots (status migration), so set them too.
    await admin.from("invoices").update({ status: "sent", business_snapshot: {}, client_snapshot: {} }).eq("id", saved.data.saved_id);
    const locked = await a.client.rpc("save_invoice", { p_id: saved.data.saved_id, p_invoice: fields, p_items: [] }).single();
    check("issued invoices can't be saved as drafts", locked.error?.code === "P0002", locked.error?.message);

    const anonSave = await anon.rpc("save_invoice", { p_id: null, p_invoice: fields, p_items: [] });
    check("anonymous can't call save_invoice", !!anonSave.error);
  }

  // Status changes and the edit lock (IP-201 to IP-204).
  const probe = await a.client.rpc("issue_invoice", { p_id: "00000000-0000-0000-0000-000000000000" });
  if (probe.error?.message?.includes("Could not find the function")) {
    check("issue_invoice exists (run the invoice status migration)", false, probe.error.message);
  } else {
    const draftFields = { issue_date: "2026-11-02", due_date: "2026-11-16", currency: "NGN", discount_value: 0, tax_rate_bps: 0, subtotal_minor: 1000, discount_minor: 0, taxable_minor: 1000, tax_minor: 0, total_minor: 1000 };
    const line = [{ description: "Work", quantity: "1.000", unit_price_minor: 1000, line_total_minor: 1000 }];
    const { data: noClient } = await a.client.rpc("save_invoice", { p_id: null, p_invoice: draftFields, p_items: line }).single();
    const r1 = await a.client.rpc("issue_invoice", { p_id: noClient.saved_id });
    check("can't issue without a client", r1.error?.message === "no_client", r1.error?.message);

    const { data: st } = await a.client.rpc("save_invoice", { p_id: null, p_invoice: { ...draftFields, client_id: clientA.id }, p_items: line }).single();
    const r2 = await a.client.rpc("issue_invoice", { p_id: st.saved_id });
    const { data: issued } = await a.client.from("invoices").select("status, issued_at, client_snapshot, business_snapshot").eq("id", st.saved_id).single();
    check("issuing sets sent, issued_at and snapshots", !r2.error && issued.status === "sent" && !!issued.issued_at && issued.client_snapshot?.name === "Client of A" && !!issued.business_snapshot, r2.error?.message);

    const edit = await a.client.from("invoices").update({ total_minor: 1 }).eq("id", st.saved_id);
    check("issued invoice content can't be changed directly", edit.error?.message === "invoice_locked", edit.error?.message);
    const itemEdit = await a.client.from("invoice_items").insert({ invoice_id: st.saved_id, description: "sneaky" });
    check("issued invoice items can't be changed", !!itemEdit.error);
    const skip = await a.client.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", noClient.saved_id);
    check("draft can't jump straight to paid", skip.error?.message === "invalid_status_change", skip.error?.message);
    const delIssued = await a.client.from("invoices").delete().eq("id", st.saved_id).select();
    check("issued invoices can't be deleted", delIssued.data?.length === 0);

    const future = await a.client.rpc("mark_invoice_paid", { p_id: st.saved_id, p_paid_on: "2099-01-01" });
    check("payment date can't be in the future", future.error?.message === "invalid_paid_date");
    const paid = await a.client.rpc("mark_invoice_paid", { p_id: st.saved_id, p_paid_on: "2026-11-03" });
    const { data: paidRow } = await a.client.from("invoices").select("status, paid_at").eq("id", st.saved_id).single();
    check("mark as paid records the payment", !paid.error && paidRow.status === "paid" && paidRow.paid_at?.startsWith("2026-11-03"), paid.error?.message);
    const reopenPaid = await a.client.rpc("reopen_invoice", { p_id: st.saved_id });
    check("paid invoices can't be reopened", reopenPaid.error?.message === "not_sent");
    const unpaid = await a.client.rpc("mark_invoice_unpaid", { p_id: st.saved_id });
    const reopen = await a.client.rpc("reopen_invoice", { p_id: st.saved_id });
    const { data: reopened } = await a.client.from("invoices").select("status, invoice_number").eq("id", st.saved_id).single();
    check("unpaid then reopen returns to draft and keeps the number", !unpaid.error && !reopen.error && reopened.status === "draft" && reopened.invoice_number === st.saved_number, reopen.error?.message);

    const otherIssue = await b.client.rpc("issue_invoice", { p_id: st.saved_id });
    check("other user can't issue someone else's invoice", otherIssue.error?.message === "not_found");
    const anonIssue = await anon.rpc("issue_invoice", { p_id: st.saved_id });
    check("anonymous can't change invoice status", !!anonIssue.error);
  }

  // Email delivery records (IP-223): append-only, private to the owner.
  const delProbe = await a.client.from("invoice_email_deliveries").select("id").limit(1);
  if (delProbe.error?.message?.includes("invoice_email_deliveries")) {
    check("invoice_email_deliveries exists (run the email deliveries migration)", false, delProbe.error.message);
  } else {
    const { data: inv } = await a.client.rpc("save_invoice", { p_id: null, p_invoice: { issue_date: "2026-11-13", currency: "NGN", discount_value: 0, tax_rate_bps: 0, subtotal_minor: 0, discount_minor: 0, taxable_minor: 0, tax_minor: 0, total_minor: 0 }, p_items: [] }).single();
    const rec = await a.client.from("invoice_email_deliveries").insert({ invoice_id: inv.saved_id, recipient: "c@example.com", subject: "Invoice", status: "failed", error: "test" }).select("id").single();
    check("user can record an email attempt", !rec.error, rec.error?.message);
    const bad = await a.client.from("invoice_email_deliveries").insert({ invoice_id: inv.saved_id, recipient: "c@example.com", subject: "Invoice", status: "sent" });
    check("a 'sent' record needs the provider's message ID", !!bad.error);
    const { data: otherRead } = await b.client.from("invoice_email_deliveries").select("id");
    check("other user can't read email records", otherRead?.length === 0);
    const forge = await b.client.from("invoice_email_deliveries").insert({ invoice_id: inv.saved_id, user_id: b.id, recipient: "x@example.com", subject: "x", status: "failed", error: "x" });
    check("other user can't add records to someone else's invoice", !!forge.error);
    const edit = await a.client.from("invoice_email_deliveries").update({ status: "sent", provider_id: "fake" }).eq("id", rec.data.id).select();
    check("email records can't be edited", !!edit.error || edit.data?.length === 0);
    const del = await a.client.from("invoice_email_deliveries").delete().eq("id", rec.data.id).select();
    check("email records can't be deleted", !!del.error || del.data?.length === 0);
    const { data: anonRead, error: anonErr } = await anon.from("invoice_email_deliveries").select("id");
    check("anonymous can't read email records", !!anonErr || anonRead.length === 0);
  }

  // Constraints.
  const { error: dateErr } = await a.client
    .from("invoices").insert({ issue_date: "2026-10-10", due_date: "2026-10-01" });
  check("due date before issue date is rejected", !!dateErr);
  const { error: negErr } = await a.client
    .from("invoice_items").insert({ invoice_id: invA.id, unit_price_minor: -1 });
  check("negative prices are rejected", !!negErr);
} catch (e) {
  failures++;
  console.error("ERROR", e.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`\nCleaned up ${created.length} test users.`);
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
