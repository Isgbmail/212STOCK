import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { DocShell, DocFooter, base, COLORS } from './shared';

export interface OrdreMissionOrder {
  order_number: string;
  buyer_name: string;
  total_items?: number;
}

export interface OrdreMissionData {
  mission_number: string;
  issued_at: string;
  company: { name: string; address?: string; city?: string };
  driver: { name: string; phone?: string; vehicle?: string; carrier_type?: string };
  route: {
    pickup:   { address: string; city?: string };
    delivery: { address: string; city?: string };
  };
  orders: OrdreMissionOrder[];
  priority: string;
  tracking_ref?: string;
  notes?: string;
}

const tbl = StyleSheet.create({
  head:   { flexDirection: 'row', backgroundColor: COLORS.navy, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5 },
  hTxt:   { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  row:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowAlt: { backgroundColor: COLORS.bgAlt },
  c_num:  { flex: 1.5 },
  c_buy:  { flex: 2 },
  c_items:{ flex: 0.7, textAlign: 'center' },
});

export function OrdreMissionDoc({ data }: { data: OrdreMissionData }) {
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
          <View style={{ backgroundColor: COLORS.navy, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginBottom: 10 }}>
            <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 0.3 }}>
              ORDRE DE MISSION
            </Text>
          </View>
          <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{data.mission_number}</Text>
          <Text style={[base.small, { color: COLORS.muted, marginTop: 4 }]}>Émis le {data.issued_at}</Text>
          {data.priority === 'express' && (
            <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 6 }}>
              <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>MISSION EXPRESS</Text>
            </View>
          )}
        </View>
      </View>

      {/* Parties */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Donneur d'ordre</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.company.name}</Text>
          {data.company.address && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{data.company.address}</Text>}
          {data.company.city    && <Text style={[base.small, { color: COLORS.muted }]}>{data.company.city}</Text>}
        </View>
        <View style={{ flex: 1, borderWidth: 1.5, borderColor: `${COLORS.navy}55`, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Exécutant (Livreur)</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.driver.name}</Text>
          {data.driver.phone   && <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>Tél. : {data.driver.phone}</Text>}
          {data.driver.vehicle && <Text style={[base.small, { color: COLORS.muted }]}>Véhicule : {data.driver.vehicle}</Text>}
        </View>
      </View>

      {/* Itinéraire */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0f4ff', borderRadius: 6, padding: 10, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={[base.label, { marginBottom: 3, color: COLORS.navyMid }]}>Point d'enlèvement</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.route.pickup.address}</Text>
          {data.route.pickup.city && <Text style={[base.small, { color: COLORS.muted }]}>{data.route.pickup.city}</Text>}
        </View>
        <Text style={{ fontSize: 16, color: COLORS.navyMid, paddingHorizontal: 4 }}>→</Text>
        <View style={{ flex: 1 }}>
          <Text style={[base.label, { marginBottom: 3, color: COLORS.navyMid }]}>Destination</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.route.delivery.address}</Text>
          {data.route.delivery.city && <Text style={[base.small, { color: COLORS.muted }]}>{data.route.delivery.city}</Text>}
        </View>
      </View>

      {/* Commandes à livrer */}
      {data.orders.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={[base.label, { marginBottom: 6 }]}>Commandes à livrer</Text>
          <View style={tbl.head}>
            <Text style={[tbl.hTxt, tbl.c_num]}>N° Commande</Text>
            <Text style={[tbl.hTxt, tbl.c_buy]}>Destinataire</Text>
            <Text style={[tbl.hTxt, tbl.c_items]}>Articles</Text>
          </View>
          {data.orders.map((o, i) => (
            <View key={i} style={[tbl.row, i % 2 === 1 ? tbl.rowAlt : {}]}>
              <Text style={[tbl.c_num, base.bold, { fontSize: 8.5 }]}>{o.order_number}</Text>
              <Text style={[tbl.c_buy, { fontSize: 8.5 }]}>{o.buyer_name}</Text>
              <Text style={[tbl.c_items, { fontSize: 8.5, color: COLORS.muted }]}>{o.total_items ?? '—'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Réf. de suivi */}
      {data.tracking_ref && (
        <View style={{ backgroundColor: COLORS.bgAlt, borderRadius: 5, padding: 8, marginBottom: 12 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Référence de suivi</Text>
          <Text style={{ fontFamily: 'Courier', fontSize: 9, color: COLORS.navy }}>{data.tracking_ref}</Text>
        </View>
      )}

      {/* Instructions */}
      {data.notes && (
        <View style={{ backgroundColor: '#fef9c3', borderRadius: 5, padding: 8, borderWidth: 1, borderColor: '#fde047', marginBottom: 14 }}>
          <Text style={[base.label, { marginBottom: 3, color: '#92400e' }]}>Instructions particulières</Text>
          <Text style={[base.small, { color: '#92400e', lineHeight: 1.6 }]}>{data.notes}</Text>
        </View>
      )}

      {/* Signatures */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 36 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10 }}>
          <Text style={[base.label, { marginBottom: 4 }]}>Autorisé par (Donneur d'ordre)</Text>
          <View style={{ height: 40 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.muted }]}>{data.company.name}</Text>
            <Text style={[base.tiny, { color: COLORS.muted }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
        <View style={{ flex: 1, borderWidth: 1.5, borderColor: `${COLORS.navy}55`, borderRadius: 6, padding: 10, backgroundColor: '#f0f4ff' }}>
          <Text style={[base.label, { marginBottom: 4, color: COLORS.navy }]}>Lu et accepté (Livreur)</Text>
          <Text style={[base.tiny, { color: COLORS.navyMid, marginBottom: 6 }]}>
            Je soussigné(e) atteste avoir pris connaissance du présent ordre de mission et m'engage à l'exécuter dans les conditions définies.
          </Text>
          <View style={{ height: 18 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: `${COLORS.navy}44`, paddingTop: 5 }}>
            <Text style={[base.small, { color: COLORS.navyMid }]}>{data.driver.name}</Text>
            <Text style={[base.tiny, { color: COLORS.navyMid }]}>Date : ______ / ______ / ______</Text>
          </View>
        </View>
      </View>

      <DocFooter legalNote="Ordre de mission · Document interne · Stock212 B2B Platform · stock212.ma" />
    </DocShell>
  );
}
