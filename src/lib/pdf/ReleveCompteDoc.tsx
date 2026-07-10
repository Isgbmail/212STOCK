import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { DocShell, DocParties, DocFooter, base, COLORS } from './shared';

export interface ReleveEntry {
  date: string;
  ref: string;
  type: 'facture' | 'avoir' | 'paiement';
  description: string;
  debit: number;
  credit: number;
}

export interface ReleveCompteData {
  periode_debut: string;
  periode_fin: string;
  generated_at: string;
  currency: string;
  seller: { name: string; address?: string; city?: string; ice?: string };
  buyer:  { name: string; address?: string; city?: string; ice?: string };
  entries: ReleveEntry[];
  solde_ouverture: number;
}

const TYPE_COLOR: Record<string, string> = {
  facture:  COLORS.navy,
  avoir:    '#dc2626',
  paiement: COLORS.green,
};
const TYPE_LABEL: Record<string, string> = {
  facture:  'FAC',
  avoir:    'AV',
  paiement: 'PAIE',
};

const tbl = StyleSheet.create({
  head:   { flexDirection: 'row', backgroundColor: COLORS.navy, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 },
  hTxt:   { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: COLORS.bgAlt },
  c_date: { flex: 1 },
  c_ref:  { flex: 1.4 },
  c_type: { flex: 0.6, alignItems: 'center', justifyContent: 'center' },
  c_desc: { flex: 3 },
  c_deb:  { flex: 1.2, textAlign: 'right' },
  c_cred: { flex: 1.2, textAlign: 'right' },
  c_sol:  { flex: 1.2, textAlign: 'right' },
});

export function ReleveCompteDoc({ data }: { data: ReleveCompteData }) {
  let balance = data.solde_ouverture;
  const rows = data.entries.map((e) => {
    balance = balance + e.debit - e.credit;
    return { ...e, solde: balance };
  });

  const totalDebit  = data.entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = data.entries.reduce((s, e) => s + e.credit, 0);
  const soldeFinal  = data.solde_ouverture + totalDebit - totalCredit;

  return (
    <DocShell>
      {/* En-tête personnalisé sans numéro de document */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}>
        <View style={{ flex: 1 }}>
          <View style={{ width: 80, height: 22, backgroundColor: COLORS.navy, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 10, letterSpacing: 1 }}>S212</Text>
          </View>
          <Text style={[base.bold, { fontSize: 11, color: COLORS.navy }]}>{data.seller.name}</Text>
          {data.seller.address && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{data.seller.address}</Text>}
          {data.seller.city && <Text style={[base.small, { color: COLORS.muted }]}>{data.seller.city}</Text>}
          {data.seller.ice && <Text style={[base.tiny, { color: COLORS.muted, marginTop: 2 }]}>ICE: {data.seller.ice}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: COLORS.navy, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginBottom: 10 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 12, letterSpacing: 0.5 }}>
              RELEVÉ DE COMPTE
            </Text>
          </View>
          <Text style={[base.small, { color: COLORS.muted }]}>
            Période : {data.periode_debut} — {data.periode_fin}
          </Text>
          <Text style={[base.tiny, { color: COLORS.muted, marginTop: 3 }]}>
            Édité le {data.generated_at}
          </Text>
        </View>
      </View>

      <DocParties
        seller={{ label: 'Émetteur', ...data.seller }}
        buyer={{ label: 'Compte client', ...data.buyer }}
      />

      {/* Solde d'ouverture */}
      {data.solde_ouverture !== 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5, marginBottom: 8 }}>
          <Text style={[base.small, { color: COLORS.muted }]}>
            Solde d'ouverture au {data.periode_debut}
          </Text>
          <Text style={[base.bold, { fontSize: 8.5, color: data.solde_ouverture > 0 ? COLORS.navy : COLORS.green }]}>
            {data.solde_ouverture > 0 ? '+' : ''}{Number(data.solde_ouverture).toFixed(2)} {data.currency}
          </Text>
        </View>
      )}

      {/* Tableau des mouvements */}
      <View style={{ marginBottom: 12 }}>
        <View style={tbl.head}>
          <Text style={[tbl.hTxt, tbl.c_date]}>Date</Text>
          <Text style={[tbl.hTxt, tbl.c_ref]}>Référence</Text>
          <Text style={[tbl.hTxt, { flex: 0.6, textAlign: 'center', color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>Type</Text>
          <Text style={[tbl.hTxt, tbl.c_desc]}>Description</Text>
          <Text style={[tbl.hTxt, tbl.c_deb]}>Débit</Text>
          <Text style={[tbl.hTxt, tbl.c_cred]}>Crédit</Text>
          <Text style={[tbl.hTxt, tbl.c_sol]}>Solde</Text>
        </View>

        {rows.map((row, i) => (
          <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
            <Text style={[tbl.c_date, base.small]}>{row.date}</Text>
            <Text style={{
              flex: 1.4, fontSize: 7.5,
              fontFamily: 'Helvetica-Bold',
              color: TYPE_COLOR[row.type] ?? COLORS.slate,
            }}>
              {row.ref}
            </Text>
            <View style={{ flex: 0.6, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                backgroundColor: TYPE_COLOR[row.type] ?? COLORS.muted,
                paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3,
              }}>
                <Text style={{ color: COLORS.white, fontSize: 6, fontFamily: 'Helvetica-Bold' }}>
                  {TYPE_LABEL[row.type] ?? row.type.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[tbl.c_desc, base.small, { color: COLORS.muted }]} numberOfLines={1}>
              {row.description}
            </Text>
            <Text style={[tbl.c_deb, {
              fontSize: 8,
              fontFamily: row.debit > 0 ? 'Helvetica-Bold' : 'Helvetica',
              color: row.debit > 0 ? COLORS.navy : COLORS.muted,
            }]}>
              {row.debit > 0 ? Number(row.debit).toFixed(2) : '—'}
            </Text>
            <Text style={[tbl.c_cred, {
              fontSize: 8,
              fontFamily: row.credit > 0 ? 'Helvetica-Bold' : 'Helvetica',
              color: row.credit > 0 ? COLORS.green : COLORS.muted,
            }]}>
              {row.credit > 0 ? Number(row.credit).toFixed(2) : '—'}
            </Text>
            <Text style={[tbl.c_sol, {
              fontSize: 8,
              fontFamily: 'Helvetica-Bold',
              color: row.solde > 0 ? COLORS.navy : COLORS.green,
            }]}>
              {Number(row.solde).toFixed(2)}
            </Text>
          </View>
        ))}

        {/* Ligne de total */}
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.bgAlt, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, marginTop: 2 }}>
          <Text style={{ flex: 5.6, fontFamily: 'Helvetica-Bold', fontSize: 8, color: COLORS.slate }}>
            {data.entries.length} mouvement{data.entries.length > 1 ? 's' : ''}
          </Text>
          <Text style={{ flex: 1.2, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8, color: COLORS.navy }}>
            {Number(totalDebit).toFixed(2)}
          </Text>
          <Text style={{ flex: 1.2, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 8, color: COLORS.green }}>
            {Number(totalCredit).toFixed(2)}
          </Text>
          <Text style={{ flex: 1.2 }} />
        </View>
      </View>

      {/* Solde final */}
      <View style={{ alignItems: 'flex-end', marginBottom: 16 }}>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', width: 270,
          backgroundColor: soldeFinal > 0 ? COLORS.navy : COLORS.green,
          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
        }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 11 }}>
            {soldeFinal > 0 ? 'Solde dû' : 'Solde créditeur'}
          </Text>
          <Text style={{
            color: soldeFinal > 0 ? COLORS.amber : '#86efac',
            fontFamily: 'Helvetica-Bold', fontSize: 13,
          }}>
            {Math.abs(soldeFinal).toFixed(2)} {data.currency}
          </Text>
        </View>
        {soldeFinal > 0 && (
          <Text style={[base.small, { color: COLORS.muted, marginTop: 5 }]}>
            Merci de régulariser selon les conditions de paiement convenues.
          </Text>
        )}
      </View>

      <DocFooter legalNote="Relevé de compte à titre informatif · Non exigible · Stock212 B2B Platform · stock212.ma" />
    </DocShell>
  );
}
