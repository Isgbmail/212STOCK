import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  DocShell, DocHeader, DocParties, DocLineItems, DocTotals, DocFooter,
  base, COLORS, type DocLine,
} from './shared';

export interface DevisData {
  quote_number: string;
  requested_at: string;
  expires_at?: string;
  status: string;
  incoterm?: string;
  notes?: string;
  currency: string;
  total_ht: number;
  total_taxes: number;
  total_ttc: number;
  seller: { name: string; address?: string; city?: string; ice?: string };
  buyer:  { name: string; address?: string; city?: string; ice?: string };
  lines: DocLine[];
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau', in_progress: 'En traitement', responded: 'Répondu',
  accepted: 'Accepté', refused: 'Refusé', expired: 'Expiré', converted: 'Converti en BC',
};
const STATUS_COLORS: Record<string, string> = {
  accepted: COLORS.green, refused: COLORS.red, responded: COLORS.navy,
  converted: COLORS.green, expired: COLORS.muted,
};

export function DevisDoc({ data }: { data: DevisData }) {
  return (
    <DocShell>
      <DocHeader
        docType="DEVIS"
        docNumber={data.quote_number}
        issuedAt={data.requested_at}
        dueAt={data.expires_at ? `Valide jusqu'au ${data.expires_at}` : undefined}
        companyName={data.seller.name}
        companyAddress={data.seller.address}
        companyCity={data.seller.city}
        companyIce={data.seller.ice}
      />

      {/* Status + incoterm */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{
          backgroundColor: STATUS_COLORS[data.status] ?? COLORS.muted,
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
        }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
            {STATUS_LABELS[data.status] ?? data.status}
          </Text>
        </View>
        {data.incoterm && (
          <View style={{ backgroundColor: COLORS.bgAlt, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
            <Text style={[base.bold, { fontSize: 8, color: COLORS.navy }]}>Incoterm : {data.incoterm}</Text>
          </View>
        )}
      </View>

      <DocParties
        seller={{ label: 'Vendeur (Émetteur du devis)', ...data.seller }}
        buyer={{ label: 'Acheteur (Demandeur)', ...data.buyer }}
      />

      {/* Notice de validité */}
      {data.expires_at && (
        <View style={{ backgroundColor: '#fef3c7', borderLeftWidth: 3, borderLeftColor: '#f59e0b', padding: 8, borderRadius: 4, marginBottom: 12 }}>
          <Text style={[base.small, { color: '#92400e' }]}>
            ⚠ Ce devis est valable jusqu'au {data.expires_at}. Passé ce délai, les prix et disponibilités ne sont plus garantis.
          </Text>
        </View>
      )}

      <DocLineItems lines={data.lines} currency={data.currency} />

      <DocTotals
        ht={data.total_ht}
        taxes={data.total_taxes}
        ttc={data.total_ttc}
        currency={data.currency}
      />

      {/* Bon pour accord */}
      <View style={{ flexDirection: 'row', marginTop: 8, marginBottom: 40, gap: 20 }}>
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 }}>
          <Text style={[base.label]}>Signature acheteur — Bon pour accord</Text>
          <View style={{ height: 36 }} />
          <Text style={[base.small, { color: COLORS.muted }]}>Date : _______________</Text>
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
