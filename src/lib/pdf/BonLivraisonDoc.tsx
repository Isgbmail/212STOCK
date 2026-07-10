import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { DocShell, DocHeader, DocParties, DocFooter, base, COLORS } from './shared';

export interface BonLivraisonLine {
  description: string;
  ref?: string;
  qty: number;
  unit?: string;
  lot_number?: string;
  temperature?: string;
}

export interface BonLivraisonData {
  bl_number: string;
  order_number: string;
  created_at: string;
  priority: string;
  notes?: string;
  pickup_address?: Record<string, string>;
  delivery_address?: Record<string, string>;
  sender:    { name: string; address?: string; city?: string };
  recipient: { name: string; address?: string; city?: string };
  lines: BonLivraisonLine[];
}

const TEMP_LABELS: Record<string, string> = {
  ambient: 'Ambiant', refrigerated: 'Réfrig.', fresh: 'Frais', frozen: 'Surgelé',
};

const tbl = StyleSheet.create({
  head:   { flexDirection: 'row', backgroundColor: COLORS.navy, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 },
  hTxt:   { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: COLORS.bgAlt },
  c_desc: { flex: 3 },
  c_ref:  { flex: 1.2 },
  c_qty:  { flex: 0.8, textAlign: 'center' },
  c_unit: { flex: 0.6, textAlign: 'center' },
  c_lot:  { flex: 1.5 },
  c_temp: { flex: 0.9, textAlign: 'center' },
});

export function BonLivraisonDoc({ data }: { data: BonLivraisonData }) {
  const totalQty  = data.lines.reduce((s, l) => s + l.qty, 0);
  const pickupAddr = data.pickup_address ?? {};
  const delivAddr  = data.delivery_address ?? {};

  return (
    <DocShell>
      <DocHeader
        docType="BON DE LIVRAISON"
        docNumber={data.bl_number}
        issuedAt={data.created_at}
        companyName={data.sender.name}
        companyAddress={data.sender.address}
        companyCity={data.sender.city}
      />

      {/* Ref + priorité + adresses */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Réf. commande</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.order_number}</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: data.priority === 'express' ? '#fef2f2' : COLORS.bgAlt,
          padding: 8, borderRadius: 5,
        }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Priorité</Text>
          <Text style={[base.bold, { fontSize: 9, color: data.priority === 'express' ? COLORS.red : COLORS.slate }]}>
            {data.priority === 'express' ? '⚡ Express' : 'Normal'}
          </Text>
        </View>
        <View style={{ flex: 2, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Point d'enlèvement</Text>
          <Text style={[base.small, { color: COLORS.muted }]}>
            {[pickupAddr.line1, pickupAddr.city].filter(Boolean).join(', ') || data.sender.address || '—'}
          </Text>
        </View>
        <View style={{ flex: 2, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Adresse de livraison</Text>
          <Text style={[base.small, { color: COLORS.muted }]}>
            {[delivAddr.line1, delivAddr.city, delivAddr.postal_code].filter(Boolean).join(', ') || data.recipient.address || '—'}
          </Text>
        </View>
      </View>

      <DocParties
        seller={{ label: 'Expéditeur', ...data.sender }}
        buyer={{ label: 'Destinataire', ...data.recipient }}
      />

      {/* Articles — sans prix */}
      <View style={{ marginBottom: 16 }}>
        <View style={tbl.head}>
          <Text style={[tbl.hTxt, tbl.c_desc]}>Désignation</Text>
          <Text style={[tbl.hTxt, tbl.c_ref]}>Réf. / SKU</Text>
          <Text style={[tbl.hTxt, tbl.c_qty]}>Qté</Text>
          <Text style={[tbl.hTxt, tbl.c_unit]}>U.</Text>
          <Text style={[tbl.hTxt, tbl.c_lot]}>N° Lot / DLC</Text>
          <Text style={[tbl.hTxt, tbl.c_temp]}>Temp.</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
            <Text style={tbl.c_desc}>{l.description}</Text>
            <Text style={[tbl.c_ref, { color: COLORS.muted }]}>{l.ref ?? '—'}</Text>
            <Text style={[tbl.c_qty, { fontFamily: 'Helvetica-Bold' }]}>{l.qty}</Text>
            <Text style={[tbl.c_unit, { color: COLORS.muted }]}>{l.unit ?? 'U'}</Text>
            <Text style={[tbl.c_lot, { color: COLORS.muted, fontSize: 7.5 }]}>{l.lot_number ?? '—'}</Text>
            <Text style={[tbl.c_temp, { color: COLORS.muted, fontSize: 7.5 }]}>
              {l.temperature ? (TEMP_LABELS[l.temperature] ?? l.temperature) : '—'}
            </Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.navyMid, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 4, marginTop: 2 }}>
          <Text style={{ flex: 1, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
            Total : {data.lines.length} référence{data.lines.length > 1 ? 's' : ''} · {totalQty} unité{totalQty > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Blocs de signature — élément distinctif du BL */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 40 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Émetteur — Signature & cachet</Text>
          <View style={{ height: 52 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.muted }]}>{data.sender.name}</Text>
            <Text style={[base.tiny, { color: COLORS.muted }]}>Date : ________ / ________ / ________</Text>
          </View>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Réceptionnaire — Bon pour réception</Text>
          <Text style={[base.tiny, { color: COLORS.muted, marginBottom: 6 }]}>
            Je soussigné(e) certifie avoir reçu les marchandises désignées ci-dessus en bon état et quantité conforme.
          </Text>
          <View style={{ height: 30 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.muted }]}>{data.recipient.name}</Text>
            <Text style={[base.tiny, { color: COLORS.muted }]}>Date : ________ / ________ / ________</Text>
          </View>
        </View>
      </View>

      <DocFooter
        notes={data.notes}
        legalNote="Bon de livraison non payable · Conserver pour vos archives · Stock212 B2B Platform"
      />
    </DocShell>
  );
}
