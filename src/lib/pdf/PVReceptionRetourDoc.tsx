import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { DocShell, DocParties, DocFooter, base, COLORS } from './shared';

export interface PVReturnLine {
  product_name: string;
  ref?: string;
  qty_requested: number;
  qty_received?: number;
  condition?: string;
  accepted?: boolean;
  reason_line?: string;
}

export interface PVReceptionData {
  return_number: string;
  order_number: string;
  received_at: string;
  overall_status: 'accepted' | 'partial' | 'rejected';
  notes?: string;
  currency: string;
  buyer:  { name: string; address?: string; city?: string };
  seller: { name: string; address?: string; city?: string };
  lines: PVReturnLine[];
}

const CONDITION_LABELS: Record<string, string> = {
  intact:  'Intact',
  damaged: 'Endommagé',
  expired: 'Périmé',
  other:   'Autre',
};
const OVERALL_COLORS: Record<string, string> = {
  accepted: COLORS.green,
  partial:  COLORS.amber,
  rejected: COLORS.red,
};
const OVERALL_LABELS: Record<string, string> = {
  accepted: 'Retour accepté en totalité',
  partial:  'Retour accepté partiellement',
  rejected: 'Retour refusé',
};

const PV_BLUE = '#1e40af';
const PV_BLUE_BG = '#eff6ff';

const tbl = StyleSheet.create({
  head:   { flexDirection: 'row', backgroundColor: PV_BLUE, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 },
  hTxt:   { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: PV_BLUE_BG },
  c_desc: { flex: 2.5 },
  c_ref:  { flex: 1 },
  c_qreq: { flex: 0.8, textAlign: 'center' },
  c_qrec: { flex: 0.8, textAlign: 'center' },
  c_cond: { flex: 1 },
  c_dec:  { flex: 0.8, textAlign: 'center' },
  c_note: { flex: 1.5 },
});

export function PVReceptionRetourDoc({ data }: { data: PVReceptionData }) {
  const acceptedCount = data.lines.filter((l) => l.accepted === true).length;
  const rejectedCount = data.lines.filter((l) => l.accepted === false).length;

  return (
    <DocShell>
      {/* En-tête personnalisé */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}>
        <View style={{ flex: 1 }}>
          <View style={{ width: 80, height: 22, backgroundColor: COLORS.navy, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 10, letterSpacing: 1 }}>S212</Text>
          </View>
          <Text style={[base.bold, { fontSize: 11, color: COLORS.navy }]}>{data.seller.name}</Text>
          {data.seller.address && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{data.seller.address}</Text>}
          {data.seller.city && <Text style={[base.small, { color: COLORS.muted }]}>{data.seller.city}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: PV_BLUE, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginBottom: 10 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 0.3 }}>
              PV DE RÉCEPTION RETOUR
            </Text>
          </View>
          <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{data.return_number}</Text>
          <Text style={[base.small, { color: COLORS.muted, marginTop: 4 }]}>
            Réf. commande : {data.order_number}
          </Text>
          <Text style={[base.small, { color: COLORS.muted }]}>
            Réceptionné le {data.received_at}
          </Text>
        </View>
      </View>

      <DocParties
        seller={{ label: 'Réceptionnaire (Vendeur)', ...data.seller }}
        buyer={{ label: 'Expéditeur retour (Acheteur)', ...data.buyer }}
      />

      {/* Décision globale */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: `${OVERALL_COLORS[data.overall_status]}18`,
        borderWidth: 1,
        borderColor: `${OVERALL_COLORS[data.overall_status]}55`,
        borderRadius: 6, padding: 10, marginBottom: 14,
      }}>
        <View style={{
          backgroundColor: OVERALL_COLORS[data.overall_status],
          paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
        }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
            {data.overall_status === 'accepted' ? '✓' : data.overall_status === 'partial' ? '~' : '✗'}
          </Text>
        </View>
        <Text style={[base.bold, { fontSize: 10, color: OVERALL_COLORS[data.overall_status] }]}>
          {OVERALL_LABELS[data.overall_status]}
        </Text>
        <Text style={[base.small, { color: COLORS.muted, marginLeft: 8 }]}>
          {acceptedCount} ligne{acceptedCount > 1 ? 's' : ''} acceptée{acceptedCount > 1 ? 's' : ''}
          {rejectedCount > 0 && ` · ${rejectedCount} rejetée${rejectedCount > 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Tableau d'inspection */}
      <View style={{ marginBottom: 16 }}>
        <View style={tbl.head}>
          <Text style={[tbl.hTxt, tbl.c_desc]}>Désignation</Text>
          <Text style={[tbl.hTxt, tbl.c_ref]}>Réf.</Text>
          <Text style={[tbl.hTxt, tbl.c_qreq]}>Qté renvoyée</Text>
          <Text style={[tbl.hTxt, tbl.c_qrec]}>Qté reçue</Text>
          <Text style={[tbl.hTxt, tbl.c_cond]}>État constaté</Text>
          <Text style={[tbl.hTxt, tbl.c_dec]}>Décision</Text>
          <Text style={[tbl.hTxt, tbl.c_note]}>Observations</Text>
        </View>
        {data.lines.map((l, i) => {
          const decColor = l.accepted == null ? COLORS.muted : l.accepted ? COLORS.green : COLORS.red;
          const decLabel = l.accepted == null ? 'En attente' : l.accepted ? '✓ Accepté' : '✗ Refusé';
          return (
            <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
              <Text style={tbl.c_desc}>{l.product_name}</Text>
              <Text style={[tbl.c_ref, { color: COLORS.muted }]}>{l.ref ?? '—'}</Text>
              <Text style={[tbl.c_qreq, base.small]}>{l.qty_requested}</Text>
              <Text style={[tbl.c_qrec, { fontFamily: 'Helvetica-Bold', color: PV_BLUE }]}>
                {l.qty_received ?? '—'}
              </Text>
              <Text style={[tbl.c_cond, base.small, { color: COLORS.muted }]}>
                {l.condition ? (CONDITION_LABELS[l.condition] ?? l.condition) : '—'}
              </Text>
              <Text style={[tbl.c_dec, { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: decColor }]}>
                {decLabel}
              </Text>
              <Text style={[tbl.c_note, base.small, { color: COLORS.muted }]} numberOfLines={2}>
                {l.reason_line ?? '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Zone notes */}
      {data.notes && (
        <View style={{ backgroundColor: COLORS.bgAlt, borderRadius: 5, padding: 10, marginBottom: 14 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Observations générales de réception</Text>
          <Text style={[base.small, { color: COLORS.muted, lineHeight: 1.6 }]}>{data.notes}</Text>
        </View>
      )}

      {/* Signatures */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 36 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: `${PV_BLUE}44`, borderRadius: 6, padding: 10, backgroundColor: PV_BLUE_BG }}>
          <Text style={[base.label, { marginBottom: 4, color: PV_BLUE }]}>Inspecteur réceptionnaire</Text>
          <Text style={[base.tiny, { color: '#1e40af', marginBottom: 6 }]}>
            Je certifie avoir contrôlé et réceptionné la marchandise retournée dans les conditions indiquées ci-dessus.
          </Text>
          <View style={{ height: 30 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: `${PV_BLUE}44`, paddingTop: 5 }}>
            <Text style={[base.small, { color: '#1e40af' }]}>{data.seller.name}</Text>
            <Text style={[base.tiny, { color: '#1e40af' }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Acheteur — Pour information</Text>
          <View style={{ height: 52 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.muted }]}>{data.buyer.name}</Text>
            <Text style={[base.tiny, { color: COLORS.muted }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
      </View>

      <DocFooter legalNote="Procès-verbal de réception retour · Document contractuel · Stock212 B2B Platform · stock212.ma" />
    </DocShell>
  );
}
