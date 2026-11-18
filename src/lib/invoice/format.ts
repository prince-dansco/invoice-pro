// Presentation helpers shared by the live preview and the PDF.

type AddressFields = {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

/** Non-empty address lines, e.g. ["12 Allen Avenue", "Ikeja, Lagos 100271", "Nigeria"]. */
export function addressLines(a: AddressFields): string[] {
  const cityLine = [[a.city, a.state].filter(Boolean).join(", "), a.postal_code].filter(Boolean).join(" ");
  return [a.address_line1, a.address_line2, cityLine, a.country].map((s) => s?.trim()).filter((s): s is string => !!s);
}

/** "2026-11-02" -> "2 Nov 2026". Dates are calendar dates, so format in UTC to avoid shifting a day. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** 1500 thousandths -> "1.5", 2000 -> "2", formatted with grouping. */
export function formatQuantity(milli: number): string {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 }).format(milli / 1000);
}
