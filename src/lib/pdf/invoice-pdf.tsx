import "server-only";

import path from "node:path";

import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { PreviewData, PreviewParty } from "@/components/invoices/invoice-preview";
import { formatMoney } from "@/lib/money";

// Noto Sans covers ₦ and other currency symbols that the PDF base fonts lack.
const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");
Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(FONT_DIR, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "NotoSans-SemiBold.ttf"), fontWeight: 600 },
  ],
});
// Don't break words with hyphens; long strings wrap at any character instead.
Font.registerHyphenationCallback((word) => (word.length > 24 ? word.split("") : [word]));

export type PageSize = "A4" | "LETTER";

const ink = "#18181b";
const muted = "#71717a";
const body = "#3f3f46";
const rule = "#d4d4d8";
const faint = "#f4f4f5";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSans", fontSize: 9, color: body, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  businessCol: { maxWidth: "60%" },
  logo: { maxHeight: 42, maxWidth: 140, objectFit: "contain", marginBottom: 6 },
  businessName: { fontSize: 12, fontWeight: 600, color: ink },
  title: { fontSize: 18, fontWeight: 600, color: ink, textAlign: "right", letterSpacing: 0.5 },
  number: { fontSize: 10, color: muted, textAlign: "right", marginTop: 2 },
  draft: { fontSize: 8, color: "#b45309", textAlign: "right", marginTop: 4, fontWeight: 600 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  label: { fontSize: 7, fontWeight: 600, color: muted, letterSpacing: 0.8, marginBottom: 3 },
  strong: { fontWeight: 600, color: ink },
  line: { color: "#52525b" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  metaLabel: { color: muted, width: 70, textAlign: "right", marginRight: 10 },
  metaValue: { width: 90, textAlign: "right" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: rule, paddingBottom: 5, marginBottom: 2 },
  thText: { fontSize: 7, fontWeight: 600, color: muted, letterSpacing: 0.8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: faint, paddingVertical: 5 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 50, textAlign: "right", paddingHorizontal: 4 },
  cPrice: { width: 90, textAlign: "right", paddingHorizontal: 4 },
  cAmt: { width: 90, textAlign: "right", paddingLeft: 4 },
  totals: { marginTop: 10, marginLeft: "auto", width: 210 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: rule, paddingTop: 6, marginTop: 4, fontSize: 11, fontWeight: 600, color: ink },
  footerBlocks: { marginTop: 26, borderTopWidth: 0.5, borderTopColor: rule, paddingTop: 14 },
  block: { marginBottom: 10 },
  pageFooter: { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: muted },
});

function PartyLines({ party }: { party: PreviewParty }) {
  const lines = [...party.address, party.email, party.phone, party.website, party.taxId && `Tax ID: ${party.taxId}`].filter(
    (l): l is string => !!l,
  );
  return (
    <>
      {lines.map((l, i) => (
        <Text key={i} style={s.line}>
          {l}
        </Text>
      ))}
    </>
  );
}

export function InvoicePdf({
  data,
  logo,
  size,
  isDraft,
}: {
  data: PreviewData;
  logo: Buffer | null;
  size: PageSize;
  isDraft: boolean;
}) {
  const money = (minor: number) => formatMoney(minor, data.currency);
  const { business, client, totals } = data;

  return (
    <Document title={`Invoice ${data.number}`} author={business.name} creator="InvoicePro" producer="InvoicePro">
      <Page size={size} style={s.page}>
        <View style={s.header}>
          <View style={s.businessCol}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt; the business name follows. */}
            {logo && <Image src={logo} style={s.logo} />}
            <Text style={s.businessName}>{business.name}</Text>
            <PartyLines party={business} />
          </View>
          <View>
            <Text style={s.title}>INVOICE</Text>
            <Text style={s.number}>{data.number}</Text>
            {isDraft && <Text style={s.draft}>DRAFT · NOT YET ISSUED</Text>}
          </View>
        </View>

        <View style={s.parties}>
          <View style={{ maxWidth: "55%" }}>
            <Text style={s.label}>BILL TO</Text>
            {client ? (
              <>
                <Text style={s.strong}>{client.name}</Text>
                {client.company && <Text>{client.company}</Text>}
                <PartyLines party={client} />
              </>
            ) : (
              <Text style={{ color: muted }}>No client selected</Text>
            )}
          </View>
          <View>
            <Meta label="Issue date" value={data.issueDate} />
            {data.dueDate && <Meta label="Due date" value={data.dueDate} strong />}
            {data.reference && <Meta label="Reference" value={data.reference} />}
          </View>
        </View>

        {/* `fixed` repeats the header row at the top of every page. */}
        <View style={s.th} fixed>
          <Text style={[s.thText, s.cDesc]}>DESCRIPTION</Text>
          <Text style={[s.thText, s.cQty]}>QTY</Text>
          <Text style={[s.thText, s.cPrice]}>UNIT PRICE</Text>
          <Text style={[s.thText, s.cAmt]}>AMOUNT</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cDesc}>{item.description}</Text>
            <Text style={s.cQty}>{item.quantity}</Text>
            <Text style={s.cPrice}>{money(item.unitPriceMinor)}</Text>
            <Text style={s.cAmt}>{money(item.lineTotalMinor)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <TotalRow label="Subtotal" value={money(totals.subtotal)} />
          {data.discountLabel && <TotalRow label={data.discountLabel} value={`−${money(totals.discount)}`} />}
          {data.taxLabel && <TotalRow label={data.taxLabel} value={money(totals.tax)} />}
          <View style={s.grand}>
            <Text>Total due</Text>
            <Text>{money(totals.total)}</Text>
          </View>
        </View>

        {(data.paymentInstructions || data.notes || data.terms) && (
          <View style={s.footerBlocks}>
            {data.paymentInstructions && <Block title="PAYMENT DETAILS" body={data.paymentInstructions} />}
            {data.notes && <Block title="NOTES" body={data.notes} />}
            {data.terms && <Block title="TERMS" body={data.terms} />}
          </View>
        )}

        <View style={s.pageFooter} fixed>
          <Text>
            {business.name} · Invoice {data.number}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, strong ? s.strong : {}]}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.totalRow}>
      <Text style={{ color: muted }}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Block({ title, body: text }: { title: string; body: string }) {
  return (
    <View style={s.block} wrap={false}>
      <Text style={s.label}>{title}</Text>
      <Text>{text}</Text>
    </View>
  );
}
