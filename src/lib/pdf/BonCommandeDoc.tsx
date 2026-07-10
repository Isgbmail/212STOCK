import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  DocShell, DocHeader, DocParties, DocLineItems, DocTotals, DocFooter,
  base, COLORS, type DocLine,
} from './shared';

export interface BonCommandeData {
  order_number: string;
  created_at: string;
  delivery_preference: string;
  payment_terms?: string;
  delivery_address?: Record<string, string>;
  notes?: string;
  currency: string;
  total_ht: number;
  total_taxes: number;
  total_ttc: number;
  seller: { name: string; address?: string; city?: string; ice?: string };
  buyer:  { name: string; address?: string; city?: string; ice?: string };
  lines: DocLine[];
}

const DELIVERY_LABELS: Record<string, string> = {
  standard:   'Standard — 3 à 5 jours ouvrés',
  express:    'Express — 24 à 48h',
  cold_chain: 'Chaîne du froid — camion frigorifique ATP',
};

export function BonCommandeDoc({ data }: { data: BonCommandeData }) {
  const delivAddr = data.delivery_address ?? {};
  const addrStr = [delivAddr.line1, delivAddr.city, delivAddr.postal_code, delivAddr.country]
    .filter(Boolean).join(', ');

  return (
    <DocShell>
      <DocHeader
        docType="BON DE COMMANDE"
        docNumber={data.order_number}
        issuedAt={data.created_at}
        companyName={data.buyer.name}
        companyAddress={data.buyer.address}
        companyCity={data.buyer.city}
        companyIce={data.buyer.ice}
      />

      {/* Conditions */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        {data.payment_terms && (
          <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
            <Text style={[base.label, { marginBottom: 3 }]}>Modalités de paiement</Text>
            <Text style={[base.bold, { fontSize: 9 }]}>{data.payment_terms}</Text>
          </View>
        )}
        <View style={{ flex: 2, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
          <Text style={[base.label, { marginBottom: 3 }]}>Mode de livraison</Text>
          <Text style={[base.bold, { fontSize: 9 }]}>
            {DELIVERY_LABELS[data.delivery_preference] ?? data.delivery_preference}
          </Text>
        </View>
        {addrStr && (
          <View style={{ flex: 2, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
            <Text style={[base.label, { marginBottom: 3 }]}>Adresse de livraison</Text>
            <Text style={[base.small, { color: COLORS.muted }]}>{addrStr}</Text>
          </View>
        )}
      </View>

      <DocParties
        seller={{ label: 'Fournisseur', ...data.seller }}
        buyer={{ label: 'Acheteur', ...data.buyer }}
      />

      <DocLineItems lines={data.lines} currency={data.currency} />

      <DocTotals
        ht={data.total_ht}
        taxes={data.total_taxes}
        ttc={data.total_ttc}
        currency={data.currency}
      />

      {/* Signature block */}
      <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 40, gap: 20 }}>
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 }}>
          <Text style={[base.label]}>Signature acheteur — Bon pour accord</Text>
          <View style={{ height: 36 }} />
          <Text style={[base.small, { color: COLORS.muted }]}>{data.buyer.name}</Text>
        </View>
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 }}>
          <Text style={[base.label]}>Cachet & signature vendeur</Text>
          <View style={{ height: 36 }} />
          <Text style={[base.small, { color: COLORS.muted }]}>{data.seller.name}</Text>
        </View>
      </View>

      <DocFooter notes={data.notes} />
    </DocShell>
  );
}
