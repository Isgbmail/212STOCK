import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  DocShell, DocHeader, DocParties, DocLineItems, DocFooter,
  base, COLORS, type DocLine,
} from './shared';

export interface OrdreLivraisonData {
  ticket_number: string;
  order_number: string;
  created_at: string;
  priority: 'normal' | 'express';
  status: string;
  parcel_details?: Record<string, string>;
  pickup_address?: Record<string, string>;
  delivery_address?: Record<string, string>;
  notes?: string;
  currency: string;
  sender: { name: string; address?: string; city?: string };
  recipient: { name: string; address?: string; city?: string };
  lines: DocLine[];
}

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Standard', express: 'Express ⚡',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'En attente livreur',
  assigned: 'Livreur assigné',
  picked_up: 'Colis enlevé',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

function addrStr(addr?: Record<string, string>): string {
  if (!addr) return '—';
  return [addr.line1, addr.city, addr.postal_code, addr.country].filter(Boolean).join(', ');
}

export function OrdreLivraisonDoc({ data }: { data: OrdreLivraisonData }) {
  const parcel = data.parcel_details ?? {};

  return (
    <DocShell>
      <DocHeader
        docType="ORDRE DE LIVRAISON"
        docNumber={data.ticket_number}
        issuedAt={data.created_at}
        companyName={data.sender.name}
        companyAddress={data.sender.address}
        companyCity={data.sender.city}
      />

      {/* Ref commande + priorité + statut */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Réf. commande</Text>
          <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{data.order_number}</Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: data.priority === 'express' ? '#fff7ed' : COLORS.bgAlt,
          padding: 8, borderRadius: 5,
          borderLeftWidth: data.priority === 'express' ? 3 : 0,
          borderLeftColor: '#f97316',
        }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Priorité</Text>
          <Text style={[base.bold, { fontSize: 10, color: data.priority === 'express' ? '#ea580c' : COLORS.slate }]}>
            {PRIORITY_LABELS[data.priority]}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Statut</Text>
          <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{STATUS_LABELS[data.status] ?? data.status}</Text>
        </View>
        {parcel.tracking_ref && (
          <View style={{ flex: 1.5, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
            <Text style={[base.label, { marginBottom: 3 }]}>N° de suivi</Text>
            <Text style={{ fontFamily: 'Courier', fontSize: 9, color: COLORS.navy }}>{parcel.tracking_ref}</Text>
          </View>
        )}
      </View>

      {/* Adresses */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: COLORS.green }}>
          <Text style={[base.label, { marginBottom: 4, color: COLORS.green }]}>Point d'enlèvement</Text>
          <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{data.sender.name}</Text>
          <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{addrStr(data.pickup_address)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#eff6ff', padding: 12, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: COLORS.navy }}>
          <Text style={[base.label, { marginBottom: 4, color: COLORS.navy }]}>Adresse de livraison</Text>
          <Text style={[base.bold, { fontSize: 10, color: COLORS.navy }]}>{data.recipient.name}</Text>
          <Text style={[base.small, { color: COLORS.muted, marginTop: 2 }]}>{addrStr(data.delivery_address)}</Text>
        </View>
      </View>

      {/* Transporteur */}
      {(parcel.carrier_name || parcel.driver_name || parcel.name) && (
        <View style={{ backgroundColor: COLORS.bgAlt, padding: 10, borderRadius: 5, marginBottom: 14 }}>
          <Text style={[base.label, { marginBottom: 5 }]}>Transporteur / Livreur</Text>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {(parcel.carrier_name || parcel.name) && (
              <View>
                <Text style={[base.tiny, { color: COLORS.muted }]}>Entreprise</Text>
                <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{parcel.carrier_name ?? parcel.name}</Text>
              </View>
            )}
            {parcel.driver_name && (
              <View>
                <Text style={[base.tiny, { color: COLORS.muted }]}>Chauffeur</Text>
                <Text style={[base.bold, { fontSize: 9 }]}>{parcel.driver_name}</Text>
              </View>
            )}
            {parcel.phone && (
              <View>
                <Text style={[base.tiny, { color: COLORS.muted }]}>Téléphone</Text>
                <Text style={[base.bold, { fontSize: 9 }]}>{parcel.phone}</Text>
              </View>
            )}
            {parcel.eta && (
              <View>
                <Text style={[base.tiny, { color: COLORS.muted }]}>ETA</Text>
                <Text style={[base.bold, { fontSize: 9 }]}>{parcel.eta}</Text>
              </View>
            )}
            {parcel.cold_chain === 'true' && (
              <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                <Text style={[base.bold, { fontSize: 8, color: '#1e40af' }]}>❄ Chaîne du froid</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Articles */}
      {data.lines.length > 0 && (
        <>
          <Text style={[base.label, { marginBottom: 6 }]}>Détail du colis</Text>
          <DocLineItems lines={data.lines} currency={data.currency} />
        </>
      )}

      {/* Récépissé de livraison */}
      <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 40, gap: 20 }}>
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 }}>
          <Text style={[base.label]}>Signature livreur — Prise en charge</Text>
          <View style={{ height: 36 }} />
          <Text style={[base.small, { color: COLORS.muted }]}>Date : _______________</Text>
        </View>
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 }}>
          <Text style={[base.label]}>Signature destinataire — Réception</Text>
          <View style={{ height: 36 }} />
          <Text style={[base.small, { color: COLORS.muted }]}>Date : _______________</Text>
        </View>
      </View>

      <DocFooter notes={data.notes} />
    </DocShell>
  );
}
