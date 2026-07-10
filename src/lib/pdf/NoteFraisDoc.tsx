import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { DocShell, DocFooter, base, COLORS } from './shared';

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  fuel:    'Carburant',
  toll:    'Péage',
  parking: 'Parking',
  meal:    'Repas',
  lodging: 'Hébergement',
  other:   'Autre',
};

export interface ExpenseLine {
  date: string;
  expense_type: string;
  description?: string;
  amount_ht: number;
  tva_rate: number;
  receipt_ref?: string;
}

export interface NoteFraisData {
  report_number: string;
  mission_number: string;
  period_start: string;
  period_end: string;
  currency: string;
  company: { name: string; address?: string; city?: string };
  driver: { name: string; phone?: string; org_name?: string };
  expenses: ExpenseLine[];
}

const NDF_TEAL        = '#0f766e';
const NDF_TEAL_BG     = '#f0fdfa';
const NDF_TEAL_BORDER = '#99f6e4';

const tbl = StyleSheet.create({
  head:   { flexDirection: 'row', backgroundColor: NDF_TEAL, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 },
  hTxt:   { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: NDF_TEAL_BG },
  c_date: { flex: 1 },
  c_type: { flex: 1 },
  c_desc: { flex: 2 },
  c_ht:   { flex: 1, textAlign: 'right' },
  c_tva:  { flex: 0.6, textAlign: 'center' },
  c_ttc:  { flex: 1, textAlign: 'right' },
  c_ref:  { flex: 1 },
});

export function NoteFraisDoc({ data }: { data: NoteFraisData }) {
  const totalHt  = data.expenses.reduce((s, e) => s + e.amount_ht, 0);
  const totalTtc = data.expenses.reduce((s, e) => s + e.amount_ht * (1 + e.tva_rate / 100), 0);
  const totalTva = totalTtc - totalHt;

  return (
    <DocShell>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <View style={{ width: 80, height: 22, backgroundColor: COLORS.navy, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 10, letterSpacing: 1 }}>S212</Text>
          </View>
          <Text style={[base.bold, { fontSize: 11, color: COLORS.navy }]}>{data.company.name}</Text>
          {data.company.address && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{data.company.address}</Text>}
          {data.company.city    && <Text style={[base.small, { color: COLORS.muted }]}>{data.company.city}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: NDF_TEAL, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginBottom: 10 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 0.3 }}>
              NOTE DE FRAIS
            </Text>
          </View>
          <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{data.report_number}</Text>
          <Text style={[base.small, { color: COLORS.muted, marginTop: 4 }]}>
            Réf. mission : {data.mission_number}
          </Text>
          <Text style={[base.small, { color: COLORS.muted }]}>
            Période : {data.period_start} → {data.period_end}
          </Text>
        </View>
      </View>

      {/* Demandeur + synthèse */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Demandeur de remboursement</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.driver.name}</Text>
          {data.driver.org_name && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{data.driver.org_name}</Text>}
          {data.driver.phone    && <Text style={[base.small, { color: COLORS.muted }]}>Tél. : {data.driver.phone}</Text>}
        </View>
        <View style={{ flex: 1, backgroundColor: NDF_TEAL_BG, borderRadius: 6, padding: 10, borderWidth: 1, borderColor: NDF_TEAL_BORDER }}>
          <Text style={[base.label, { marginBottom: 4, color: NDF_TEAL }]}>Synthèse</Text>
          <Text style={[base.small, { color: COLORS.muted }]}>
            {data.expenses.length} ligne{data.expenses.length !== 1 ? 's' : ''} de frais
          </Text>
          <Text style={[base.bold, { fontSize: 9, color: NDF_TEAL, marginTop: 3 }]}>
            Total : {totalTtc.toFixed(2)} {data.currency} TTC
          </Text>
        </View>
      </View>

      {/* Tableau des dépenses */}
      <View style={{ marginBottom: 14 }}>
        <View style={tbl.head}>
          <Text style={[tbl.hTxt, tbl.c_date]}>Date</Text>
          <Text style={[tbl.hTxt, tbl.c_type]}>Nature</Text>
          <Text style={[tbl.hTxt, tbl.c_desc]}>Description</Text>
          <Text style={[tbl.hTxt, tbl.c_ht]}>Montant HT</Text>
          <Text style={[tbl.hTxt, tbl.c_tva]}>TVA</Text>
          <Text style={[tbl.hTxt, tbl.c_ttc]}>Montant TTC</Text>
          <Text style={[tbl.hTxt, tbl.c_ref]}>Justificatif</Text>
        </View>
        {data.expenses.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={[base.small, { color: COLORS.muted }]}>Aucune dépense enregistrée.</Text>
          </View>
        ) : (
          data.expenses.map((e, i) => {
            const ttc = e.amount_ht * (1 + e.tva_rate / 100);
            return (
              <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
                <Text style={[tbl.c_date, base.small]}>{e.date}</Text>
                <Text style={{ ...tbl.c_type, fontSize: 8, fontFamily: 'Helvetica-Bold', color: NDF_TEAL }}>
                  {EXPENSE_TYPE_LABELS[e.expense_type] ?? e.expense_type}
                </Text>
                <Text style={[tbl.c_desc, base.small, { color: COLORS.muted }]}>{e.description || '—'}</Text>
                <Text style={[tbl.c_ht, { fontSize: 8.5, fontFamily: 'Helvetica-Bold' }]}>
                  {e.amount_ht.toFixed(2)}
                </Text>
                <Text style={[tbl.c_tva, { fontSize: 8.5, color: COLORS.muted }]}>{e.tva_rate}%</Text>
                <Text style={[tbl.c_ttc, { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: NDF_TEAL }]}>
                  {ttc.toFixed(2)}
                </Text>
                <Text style={[tbl.c_ref, base.tiny, { color: COLORS.muted }]}>{e.receipt_ref || '—'}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Totaux */}
      <View style={{ alignSelf: 'flex-end', width: 230, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={[base.small, { color: COLORS.muted }]}>Total HT</Text>
          <Text style={[base.bold, { fontSize: 8.5 }]}>{totalHt.toFixed(2)} {data.currency}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={[base.small, { color: COLORS.muted }]}>TVA</Text>
          <Text style={[base.small, { color: COLORS.muted }]}>{totalTva.toFixed(2)} {data.currency}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: NDF_TEAL, borderRadius: 5, marginTop: 4 }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 9 }}>Total à rembourser TTC</Text>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 9.5 }}>
            {totalTtc.toFixed(2)} {data.currency}
          </Text>
        </View>
      </View>

      {/* Signatures */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 36 }}>
        <View style={{ flex: 1, borderWidth: 1.5, borderColor: `${NDF_TEAL}55`, borderRadius: 6, padding: 10, backgroundColor: NDF_TEAL_BG }}>
          <Text style={[base.label, { marginBottom: 4, color: NDF_TEAL }]}>Déclaration du demandeur</Text>
          <Text style={[base.tiny, { color: NDF_TEAL, marginBottom: 6 }]}>
            Je certifie l'exactitude des frais déclarés ci-dessus et leur conformité à l'activité professionnelle.
          </Text>
          <View style={{ height: 22 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: `${NDF_TEAL}44`, paddingTop: 5 }}>
            <Text style={[base.small, { color: NDF_TEAL }]}>{data.driver.name}</Text>
            <Text style={[base.tiny, { color: NDF_TEAL }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Validation (responsable)</Text>
          <View style={{ height: 50 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.muted }]}>{data.company.name}</Text>
            <Text style={[base.tiny, { color: COLORS.muted }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
      </View>

      <DocFooter legalNote="Note de frais mission · Document comptable · Stock212 B2B Platform · stock212.ma" />
    </DocShell>
  );
}
