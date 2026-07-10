import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { DocShell, DocHeader, DocParties, DocFooter, base, COLORS, type DocLine } from './shared';

export interface AvoirData {
  avoir_number: string;
  invoice_number?: string;
  order_number?: string;
  issued_at: string;
  reason?: string;
  currency: string;
  amount_ht: number;
  amount_tax: number;
  amount_ttc: number;
  notes?: string;
  seller: { name: string; address?: string; city?: string; ice?: string };
  buyer:  { name: string; address?: string; city?: string; ice?: string };
  lines: DocLine[];
}

const AVOIR_RED = '#dc2626';
const AVOIR_RED_BG = '#fef2f2';
const AVOIR_RED_BORDER = '#fecaca';

export function AvoirDoc({ data }: { data: AvoirData }) {
  return (
    <DocShell>
      <DocHeader
        docType="AVOIR"
        docNumber={data.avoir_number}
        issuedAt={data.issued_at}
        companyName={data.seller.name}
        companyAddress={data.seller.address}
        companyCity={data.seller.city}
        companyIce={data.seller.ice}
      />

      {/* Références + motif */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        {data.invoice_number && (
          <View style={{ flex: 1, backgroundColor: AVOIR_RED_BG, padding: 8, borderRadius: 5, borderWidth: 1, borderColor: AVOIR_RED_BORDER }}>
            <Text style={[base.label, { marginBottom: 3, color: AVOIR_RED }]}>Avoir sur facture</Text>
            <Text style={[base.bold, { fontSize: 9, color: AVOIR_RED }]}>{data.invoice_number}</Text>
          </View>
        )}
        {data.order_number && (
          <View style={{ flex: 1, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: 5 }}>
            <Text style={[base.label, { marginBottom: 3 }]}>Réf. commande</Text>
            <Text style={[base.bold, { fontSize: 9, color: COLORS.navy }]}>{data.order_number}</Text>
          </View>
        )}
        {data.reason && (
          <View style={{ flex: 2, backgroundColor: '#fff7ed', padding: 8, borderRadius: 5, borderWidth: 1, borderColor: '#fed7aa' }}>
            <Text style={[base.label, { marginBottom: 3 }]}>Motif de l'avoir</Text>
            <Text style={[base.small, { color: '#92400e' }]}>{data.reason}</Text>
          </View>
        )}
      </View>

      <DocParties
        seller={{ label: 'Émetteur (Vendeur)', ...data.seller }}
        buyer={{ label: 'Bénéficiaire (Acheteur)', ...data.buyer }}
      />

      {/* Tableau lignes créditées */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', backgroundColor: AVOIR_RED, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6 }}>
          <Text style={{ flex: 3,   color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>Désignation</Text>
          <Text style={{ flex: 1.2, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>Réf.</Text>
          <Text style={{ flex: 0.7, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5, textAlign: 'center' }}>Qté</Text>
          <Text style={{ flex: 1.2, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5, textAlign: 'right' }}>PU HT</Text>
          <Text style={{ flex: 1.2, color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5, textAlign: 'right' }}>Crédit HT</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={{
            flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
            borderBottomWidth: 1, borderBottomColor: COLORS.border,
            backgroundColor: i % 2 === 1 ? AVOIR_RED_BG : COLORS.white,
          }}>
            <Text style={{ flex: 3 }}>{l.description}</Text>
            <Text style={{ flex: 1.2, color: COLORS.muted }}>{l.ref ?? '—'}</Text>
            <Text style={{ flex: 0.7, textAlign: 'center' }}>{l.qty}</Text>
            <Text style={{ flex: 1.2, textAlign: 'right', color: AVOIR_RED }}>
              {Number(l.unitPrice).toFixed(2)}
            </Text>
            <Text style={{ flex: 1.2, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: AVOIR_RED }}>
              - {Number(l.total).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {/* Totaux créditeurs */}
      <View style={{ alignItems: 'flex-end', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 230, paddingVertical: 3 }}>
          <Text style={{ color: COLORS.muted, fontSize: 8.5 }}>Total HT crédité</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: AVOIR_RED }}>
            - {Number(data.amount_ht).toFixed(2)} {data.currency}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 230, paddingVertical: 3 }}>
          <Text style={{ color: COLORS.muted, fontSize: 8.5 }}>TVA 20%</Text>
          <Text style={{ fontSize: 8.5, color: COLORS.muted }}>
            - {Number(data.amount_tax).toFixed(2)} {data.currency}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', width: 230,
          backgroundColor: AVOIR_RED, borderRadius: 6,
          paddingHorizontal: 12, paddingVertical: 7, marginTop: 4,
        }}>
          <Text style={{ color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 10 }}>
            Montant à créditer
          </Text>
          <Text style={{ color: '#fca5a5', fontFamily: 'Helvetica-Bold', fontSize: 12 }}>
            - {Number(data.amount_ttc).toFixed(2)} {data.currency}
          </Text>
        </View>
      </View>

      <DocFooter
        notes={data.notes}
        legalNote="Avoir à valoir sur facture(s) ultérieure(s) ou remboursement selon accord — Stock212 B2B Platform"
      />
    </DocShell>
  );
}
