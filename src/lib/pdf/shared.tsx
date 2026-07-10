import { StyleSheet, Text, View, Page, Document } from '@react-pdf/renderer';

// ── Palette ──────────────────────────────────────────────────────────────────
export const COLORS = {
  navy:       '#0d1f38',
  navyMid:    '#1a3558',
  amber:      '#c97d1a',
  slate:      '#334155',
  muted:      '#64748b',
  border:     '#cbd5e1',
  bgAlt:      '#f1f5f9',
  white:      '#ffffff',
  green:      '#15803d',
  red:        '#dc2626',
};

// ── Base styles (shared across all templates) ────────────────────────────────
export const base = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.slate,
    paddingTop: 44,
    paddingBottom: 60,
    paddingHorizontal: 44,
    backgroundColor: COLORS.white,
  },
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  flex1: { flex: 1 },
  bold: { fontFamily: 'Helvetica-Bold' },
  oblique: { fontFamily: 'Helvetica-Oblique' },
  small: { fontSize: 7.5 },
  tiny: { fontSize: 6.5 },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: COLORS.navy },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.navy },
  h3: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.navy },
  label: { fontSize: 7, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  divider: { borderBottomWidth: 1, borderBottomColor: COLORS.border, marginVertical: 8 },
});

// ── Header ───────────────────────────────────────────────────────────────────
interface DocHeaderProps {
  docType: string;
  docNumber: string;
  issuedAt: string;
  dueAt?: string;
  companyName: string;
  companyAddress?: string;
  companyCity?: string;
  companyIce?: string;
}

export function DocHeader({
  docType, docNumber, issuedAt, dueAt,
  companyName, companyAddress, companyCity, companyIce,
}: DocHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}>
      {/* Left — company */}
      <View style={{ flex: 1 }}>
        <View style={{ width: 80, height: 22, backgroundColor: COLORS.navy, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 10, letterSpacing: 1 }}>
            S212
          </Text>
        </View>
        <Text style={[base.bold, { fontSize: 11, color: COLORS.navy }]}>{companyName}</Text>
        {companyAddress && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{companyAddress}</Text>}
        {companyCity && <Text style={[base.small, { color: COLORS.muted }]}>{companyCity}</Text>}
        {companyIce && <Text style={[base.tiny, { color: COLORS.muted, marginTop: 2 }]}>ICE: {companyIce}</Text>}
      </View>

      {/* Right — document identity */}
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ backgroundColor: COLORS.navy, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginBottom: 10 }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 14, letterSpacing: 1 }}>
            {docType}
          </Text>
        </View>
        <Text style={[base.bold, { fontSize: 12, color: COLORS.navy }]}>{docNumber}</Text>
        <Text style={[base.small, { color: COLORS.muted, marginTop: 4 }]}>
          Émis le {issuedAt}
        </Text>
        {dueAt && (
          <Text style={[base.small, { color: COLORS.muted }]}>
            Échéance : {dueAt}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Parties (buyer / seller) ─────────────────────────────────────────────────
interface PartyBoxProps {
  label: string;
  name: string;
  address?: string;
  city?: string;
  ice?: string;
  email?: string;
}

function PartyBox({ label, name, address, city, ice, email }: PartyBoxProps) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 12, borderRadius: 6 }}>
      <Text style={[base.label, { marginBottom: 5 }]}>{label}</Text>
      <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{name}</Text>
      {address && <Text style={[base.small, { color: COLORS.muted, marginTop: 3 }]}>{address}</Text>}
      {city && <Text style={[base.small, { color: COLORS.muted }]}>{city}</Text>}
      {ice && <Text style={[base.tiny, { color: COLORS.muted, marginTop: 3 }]}>ICE: {ice}</Text>}
      {email && <Text style={[base.tiny, { color: COLORS.muted }]}>{email}</Text>}
    </View>
  );
}

export function DocParties(props: { seller: PartyBoxProps; buyer: PartyBoxProps }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
      <PartyBox {...props.seller} />
      <PartyBox {...props.buyer} />
    </View>
  );
}

// ── Line items table ─────────────────────────────────────────────────────────
export interface DocLine {
  description: string;
  ref?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  total: number;
  currency: string;
}

const tbl = StyleSheet.create({
  container: { marginBottom: 16 },
  head: { flexDirection: 'row', backgroundColor: COLORS.navy, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 },
  headText: { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: COLORS.bgAlt },
  c_desc: { flex: 3 },
  c_ref:  { flex: 1.2 },
  c_qty:  { flex: 0.7, textAlign: 'center' },
  c_unit: { flex: 0.6, textAlign: 'center' },
  c_pu:   { flex: 1.2, textAlign: 'right' },
  c_tot:  { flex: 1.2, textAlign: 'right' },
});

export function DocLineItems({ lines, currency }: { lines: DocLine[]; currency: string }) {
  return (
    <View style={tbl.container}>
      {/* Header row */}
      <View style={tbl.head}>
        <Text style={[tbl.headText, tbl.c_desc]}>Désignation</Text>
        <Text style={[tbl.headText, tbl.c_ref]}>Réf.</Text>
        <Text style={[tbl.headText, tbl.c_qty]}>Qté</Text>
        <Text style={[tbl.headText, tbl.c_unit]}>U.</Text>
        <Text style={[tbl.headText, tbl.c_pu]}>PU HT</Text>
        <Text style={[tbl.headText, tbl.c_tot]}>Total HT</Text>
      </View>

      {lines.map((l, i) => (
        <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
          <Text style={[tbl.c_desc]}>{l.description}</Text>
          <Text style={[tbl.c_ref, { color: COLORS.muted }]}>{l.ref ?? '—'}</Text>
          <Text style={[tbl.c_qty]}>{l.qty}</Text>
          <Text style={[tbl.c_unit, { color: COLORS.muted }]}>{l.unit ?? 'U'}</Text>
          <Text style={[tbl.c_pu]}>{Number(l.unitPrice).toFixed(2)}</Text>
          <Text style={[tbl.c_tot, { fontFamily: 'Helvetica-Bold' }]}>{Number(l.total).toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Totals block ─────────────────────────────────────────────────────────────
const tot = StyleSheet.create({
  container: { alignItems: 'flex-end', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: 220, paddingVertical: 3 },
  label: { color: COLORS.muted, fontSize: 8.5 },
  value: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: COLORS.slate },
  ttcRow: { backgroundColor: COLORS.navy, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 },
  ttcLabel: { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  ttcValue: { color: COLORS.amber, fontFamily: 'Helvetica-Bold', fontSize: 12 },
});

export function DocTotals({
  ht, taxes, ttc, taxRate = 20, currency, amountPaid,
}: {
  ht: number; taxes: number; ttc: number;
  taxRate?: number; currency: string; amountPaid?: number;
}) {
  const remaining = amountPaid !== undefined ? ttc - amountPaid : undefined;
  return (
    <View style={tot.container}>
      <View style={tot.row}>
        <Text style={tot.label}>Total HT</Text>
        <Text style={tot.value}>{Number(ht).toFixed(2)} {currency}</Text>
      </View>
      <View style={tot.row}>
        <Text style={tot.label}>TVA {taxRate}%</Text>
        <Text style={tot.value}>{Number(taxes).toFixed(2)} {currency}</Text>
      </View>
      {amountPaid !== undefined && (
        <View style={tot.row}>
          <Text style={tot.label}>Déjà réglé</Text>
          <Text style={[tot.value, { color: COLORS.green }]}>- {Number(amountPaid).toFixed(2)} {currency}</Text>
        </View>
      )}
      <View style={[tot.row, tot.ttcRow]}>
        <Text style={tot.ttcLabel}>{remaining !== undefined ? 'Restant dû' : 'Total TTC'}</Text>
        <Text style={tot.ttcValue}>{Number(remaining !== undefined ? remaining : ttc).toFixed(2)} {currency}</Text>
      </View>
    </View>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
export function DocFooter({ notes, legalNote }: { notes?: string; legalNote?: string }) {
  return (
    <View style={{ position: 'absolute', bottom: 28, left: 44, right: 44 }}>
      {notes && (
        <View style={{ marginBottom: 8, padding: 10, backgroundColor: COLORS.bgAlt, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Notes</Text>
          <Text style={[base.small, { color: COLORS.muted }]}>{notes}</Text>
        </View>
      )}
      <View style={base.divider} />
      <Text style={[base.tiny, { color: COLORS.muted, textAlign: 'center' }]}>
        {legalNote ?? 'Document généré électroniquement — Stock212 B2B Platform · stock212.ma · contact@stock212.ma'}
      </Text>
    </View>
  );
}

// ── Wrapper Document shell ────────────────────────────────────────────────────
export function DocShell({ children }: { children: React.ReactNode }) {
  return (
    <Document>
      <Page size="A4" style={base.page}>
        {children}
      </Page>
    </Document>
  );
}
