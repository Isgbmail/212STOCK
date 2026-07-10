import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  DocShell, DocHeader, DocParties, DocLineItems, DocTotals, DocFooter,
  base, COLORS, type DocLine,
} from './shared';

export interface FactureData {
  invoice_number: string;
  order_number: string;
  issued_at: string;
  due_at?: string;
  status: string;
  amount_ht: number;
  amount_tax: number;
  amount_ttc: number;
  amount_paid: number;
  currency: string;
  payment_terms?: string;
  notes?: string;
  seller: { name: string; address?: string; city?: string; ice?: string };
  buyer:  { name: string; address?: string; city?: string; ice?: string };
  lines: DocLine[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};
const STATUS_COLORS: Record<string, string> = {
  paid: COLORS.green,
  overdue: COLORS.red,
  sent: COLORS.navy,
  draft: COLORS.muted,
};

export function FactureDoc({ data }: { data: FactureData }) {
  return (
    <DocShell>
      <DocHeader
        docType="FACTURE"
        docNumber={data.invoice_number}
        issuedAt={data.issued_at}
        dueAt={data.due_at}
        companyName={data.seller.name}
        companyAddress={data.seller.address}
        companyCity={data.seller.city}
        companyIce={data.seller.ice}
      />

      {/* Status badge */}
      <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{
          backgroundColor: STATUS_COLORS[data.status] ?? COLORS.muted,
          paddingHorizontal: 10, paddingVertical: 3,
          borderRadius: 20, alignSelf: 'flex-start',
        }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 8 }}>
            {STATUS_LABELS[data.status] ?? data.status}
          </Text>
        </View>
      </View>

      {/* Ref commande */}
      <View style={{ marginBottom: 12 }}>
        <Text style={[base.small, { color: COLORS.muted }]}>
          Réf. commande : <Text style={[base.bold, { color: COLORS.navy }]}>{data.order_number}</Text>
          {data.payment_terms ? `   ·   Modalités : ${data.payment_terms}` : ''}
        </Text>
      </View>

      <DocParties
        seller={{ label: 'Émetteur (Vendeur)', ...data.seller }}
        buyer={{ label: 'Destinataire (Acheteur)', ...data.buyer }}
      />

      <DocLineItems lines={data.lines} currency={data.currency} />

      <DocTotals
        ht={data.amount_ht}
        taxes={data.amount_tax}
        ttc={data.amount_ttc}
        currency={data.currency}
        amountPaid={data.amount_paid > 0 ? data.amount_paid : undefined}
      />

      <DocFooter notes={data.notes} />
    </DocShell>
  );
}
