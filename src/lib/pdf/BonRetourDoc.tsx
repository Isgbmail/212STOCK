import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { DocShell, DocHeader, DocParties, DocFooter, base, COLORS } from './shared';

export interface ReturnLine {
  product_name: string;
  ref?: string;
  qty_requested: number;
  unit_price_ht?: number;
  reason_line?: string;
}

export interface BonRetourData {
  return_number: string;
  order_number: string;
  requested_at: string;
  reason: string;
  refund_type: string;
  notes?: string;
  currency: string;
  buyer:  { name: string; address?: string; city?: string; ice?: string };
  seller: { name: string; address?: string; city?: string; ice?: string };
  lines: ReturnLine[];
}

const REASON_LABELS: Record<string, string> = {
  damaged:       'Marchandise endommagée',
  wrong_product: 'Produit non conforme à la commande',
  quality_issue: 'Défaut de qualité',
  expired:       'DLC / Péremption dépassée',
  excess:        'Livraison en excès',
  other:         'Autre motif',
};
const REFUND_LABELS: Record<string, string> = {
  avoir:    'Avoir commercial',
  exchange: 'Échange à l\'identique',
  refund:   'Remboursement',
};
const REFUND_COLORS: Record<string, string> = {
  avoir:    COLORS.amber,
  exchange: '#2563eb',
  refund:   COLORS.green,
};

const RETURN_ORANGE = '#c2410c';
const RETURN_ORANGE_BG = '#fff7ed';
const RETURN_ORANGE_BORDER = '#fed7aa';

const tbl = StyleSheet.create({
  head:   { flexDirection: 'row', backgroundColor: RETURN_ORANGE, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 },
  hTxt:   { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: RETURN_ORANGE_BG },
  c_desc: { flex: 3 },
  c_ref:  { flex: 1.2 },
  c_qty:  { flex: 0.7, textAlign: 'center' },
  c_pu:   { flex: 1.2, textAlign: 'right' },
  c_tot:  { flex: 1.2, textAlign: 'right' },
  c_mot:  { flex: 2, color: '#92400e' },
});

export function BonRetourDoc({ data }: { data: BonRetourData }) {
  const totalQty = data.lines.reduce((s, l) => s + l.qty_requested, 0);
  const totalCredit = data.lines.reduce((s, l) => s + (l.unit_price_ht ?? 0) * l.qty_requested, 0);

  return (
    <DocShell>
      <DocHeader
        docType="BON DE RETOUR"
        docNumber={data.return_number}
        issuedAt={data.requested_at}
        companyName={data.buyer.name}
        companyAddress={data.buyer.address}
        companyCity={data.buyer.city}
        companyIce={data.buyer.ice}
      />

      {/* Motif + réf. + type de remboursement */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Réf. commande</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.order_number}</Text>
        </View>
        <View style={{ flex: 2, backgroundColor: RETURN_ORANGE_BG, padding: 8, borderRadius: 5, borderWidth: 1, borderColor: RETURN_ORANGE_BORDER }}>
          <Text style={[base.label, { marginBottom: 3, color: RETURN_ORANGE }]}>Motif du retour</Text>
          <Text style={[base.bold, { fontSize: 9, color: RETURN_ORANGE }]}>
            {REASON_LABELS[data.reason] ?? data.reason}
          </Text>
        </View>
        <View style={{ flex: 1.5, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Traitement souhaité</Text>
          <Text style={[base.bold, { fontSize: 9, color: REFUND_COLORS[data.refund_type] ?? COLORS.slate }]}>
            {REFUND_LABELS[data.refund_type] ?? data.refund_type}
          </Text>
        </View>
      </View>

      <DocParties
        seller={{ label: 'Destinataire du retour (Vendeur)', ...data.seller }}
        buyer={{ label: 'Expéditeur du retour (Acheteur)', ...data.buyer }}
      />

      {/* Articles retournés */}
      <View style={{ marginBottom: 12 }}>
        <View style={tbl.head}>
          <Text style={[tbl.hTxt, tbl.c_desc]}>Désignation</Text>
          <Text style={[tbl.hTxt, tbl.c_ref]}>Réf.</Text>
          <Text style={[tbl.hTxt, tbl.c_qty]}>Qté</Text>
          <Text style={[tbl.hTxt, tbl.c_pu]}>PU HT</Text>
          <Text style={[tbl.hTxt, tbl.c_tot]}>Crédit HT</Text>
          <Text style={[tbl.hTxt, tbl.c_mot]}>Motif ligne</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
            <Text style={tbl.c_desc}>{l.product_name}</Text>
            <Text style={[tbl.c_ref, { color: COLORS.muted }]}>{l.ref ?? '—'}</Text>
            <Text style={[tbl.c_qty, { fontFamily: 'Helvetica-Bold', color: RETURN_ORANGE }]}>{l.qty_requested}</Text>
            <Text style={[tbl.c_pu, { color: COLORS.muted }]}>
              {l.unit_price_ht != null ? Number(l.unit_price_ht).toFixed(2) : '—'}
            </Text>
            <Text style={[tbl.c_tot, { fontFamily: 'Helvetica-Bold', color: RETURN_ORANGE }]}>
              {l.unit_price_ht != null
                ? `- ${(Number(l.unit_price_ht) * l.qty_requested).toFixed(2)}`
                : '—'
              }
            </Text>
            <Text style={[tbl.c_mot, base.small, { color: '#92400e' }]}>{l.reason_line ?? '—'}</Text>
          </View>
        ))}
        {/* Récap */}
        <View style={{ flexDirection: 'row', backgroundColor: RETURN_ORANGE, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 4, marginTop: 2 }}>
          <Text style={{ flex: 1, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
            Total à retourner : {totalQty} unité{totalQty > 1 ? 's' : ''}
          </Text>
          {totalCredit > 0 && (
            <Text style={{ color: '#fed7aa', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
              Crédit estimé : - {totalCredit.toFixed(2)} {data.currency} HT
            </Text>
          )}
        </View>
      </View>

      {/* Instructions de retour */}
      <View style={{ backgroundColor: RETURN_ORANGE_BG, borderWidth: 1, borderColor: RETURN_ORANGE_BORDER, borderRadius: 6, padding: 10, marginBottom: 14 }}>
        <Text style={[base.bold, { fontSize: 8.5, color: RETURN_ORANGE, marginBottom: 5 }]}>
          Instructions pour le retour
        </Text>
        <Text style={[base.small, { color: '#92400e', lineHeight: 1.6 }]}>
          • Ce bon de retour doit obligatoirement accompagner la marchandise.{'\n'}
          • Emballer soigneusement les articles dans leur emballage d'origine si possible.{'\n'}
          • Indiquer le numéro {data.return_number} sur le colis extérieur.{'\n'}
          • La prise en charge du retour est subordonnée à l'accord écrit du vendeur.
        </Text>
      </View>

      {/* Blocs de signature */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 36 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Acheteur — Émetteur du retour</Text>
          <View style={{ height: 44 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.muted }]}>{data.buyer.name}</Text>
            <Text style={[base.tiny, { color: COLORS.muted }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: RETURN_ORANGE_BORDER, borderRadius: 6, padding: 10, backgroundColor: RETURN_ORANGE_BG }}>
          <Text style={[base.label, { marginBottom: 4, color: RETURN_ORANGE }]}>Vendeur — Bon pour accord retour</Text>
          <Text style={[base.tiny, { color: '#92400e', marginBottom: 4 }]}>
            Je soussigné(e) accepte le retour sous réserve de vérification des articles.
          </Text>
          <View style={{ height: 28 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: RETURN_ORANGE_BORDER, paddingTop: 5 }}>
            <Text style={[base.small, { color: '#92400e' }]}>{data.seller.name}</Text>
            <Text style={[base.tiny, { color: '#92400e' }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
      </View>

      <DocFooter
        notes={data.notes}
        legalNote="Bon de retour marchandise · Valable 30 jours · Stock212 B2B Platform · stock212.ma"
      />
    </DocShell>
  );
}
