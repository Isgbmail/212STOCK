import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, Tabs, Table, Button, Modal, SpaceBetween,
  Form, FormField, Input, Select, Textarea, Alert, Box, Pagination,
  ExpandableSection, StatusIndicator,
} from '@cloudscape-design/components';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { LiquidationLot, LiquidationBid, LotSaleType, LotStatus } from '../../../types/marketing';

const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  draft: 'Brouillon', active: 'Active', sold: 'Vendu', unsold: 'Invendu', cancelled: 'Annulé',
};

const PAGE_SIZE = 10;

function LotsTab() {
  const { user } = useAuth();
  const [lots, setLots] = useState<LiquidationLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<LiquidationLot>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bidsTarget, setBidsTarget] = useState<LiquidationLot | null>(null);
  const [bids, setBids] = useState<LiquidationBid[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, count } = await supabase
      .from('liquidation_lots')
      .select('*', { count: 'exact' })
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setLots((data ?? []) as LiquidationLot[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, page]);

  const loadBids = async (lot: LiquidationLot) => {
    setBidsTarget(lot);
    const { data } = await supabase.from('liquidation_bids').select('*, profiles(full_name)').eq('lot_id', lot.id).order('amount', { ascending: false });
    setBids((data ?? []) as LiquidationBid[]);
  };

  const submit = async () => {
    if (!user || !form.title) { setError('Titre obligatoire'); return; }
    setSubmitting(true); setError('');
    const { error: e } = await supabase.from('liquidation_lots').insert({
      seller_id: user.id,
      title: form.title,
      description: form.description ?? null,
      scope: form.scope ?? 'item',
      product_ids: form.product_ids ?? [],
      sale_type: form.sale_type ?? 'auction',
      start_price: form.start_price ?? null,
      buy_now_price: form.buy_now_price ?? null,
      reserve_price: form.reserve_price ?? null,
      auction_end_at: form.auction_end_at ?? null,
      quantity: form.quantity ?? 1,
      currency: 'EUR',
      status: 'active',
    });
    if (e) setError(e.message);
    else { setCreating(false); setForm({}); load(); }
    setSubmitting(false);
  };

  const acceptWinner = async (lot: LiquidationLot, bid: LiquidationBid) => {
    await supabase.from('liquidation_lots').update({ status: 'sold', winner_buyer_id: bid.bidder_id }).eq('id', lot.id);
    await supabase.from('liquidation_bids').update({ is_winning: true }).eq('id', bid.id);
    setBidsTarget(null);
    load();
  };

  return (
    <SpaceBetween size="m">
      <Table
        loading={loading}
        items={lots}
        columnDefinitions={[
          { id: 'title', header: 'Titre', cell: r => r.title },
          { id: 'type', header: 'Type', cell: r => r.sale_type === 'auction' ? '🔨 Enchère' : '🏷️ Prix fixe' },
          { id: 'status', header: 'Statut', cell: r => LOT_STATUS_LABEL[r.status] },
          { id: 'start_price', header: 'Prix départ', cell: r => r.start_price ? `${r.start_price} ${r.currency}` : '—' },
          { id: 'current_bid', header: 'Enchère actuelle', cell: r => r.bid_count > 0 ? `${r.current_bid} ${r.currency} (${r.bid_count})` : '—' },
          { id: 'buy_now', header: 'Prix direct', cell: r => r.buy_now_price ? `${r.buy_now_price} ${r.currency}` : '—' },
          { id: 'end', header: 'Fin', cell: r => r.auction_end_at ? new Date(r.auction_end_at).toLocaleString('fr-FR') : '—' },
          {
            id: 'actions', header: '',
            cell: r => (
              <SpaceBetween direction="horizontal" size="xs">
                {r.sale_type === 'auction' && r.status === 'active' && (
                  <Button variant="inline-link" onClick={() => loadBids(r)}>Voir enchères ({r.bid_count})</Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
        pagination={<Pagination currentPageIndex={page} pagesCount={Math.ceil(total / PAGE_SIZE)} onChange={e => setPage(e.detail.currentPageIndex)} />}
        header={<Header actions={<Button variant="primary" iconName="add-plus" onClick={() => { setCreating(true); setForm({}); }}>Créer un lot</Button>}>Lots de liquidation</Header>}
        empty={<Box textAlign="center">Aucun lot créé</Box>}
      />

      {/* Modal création lot */}
      {creating && (
        <Modal visible header="Créer un lot de liquidation" onDismiss={() => setCreating(false)} size="large"
          footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setCreating(false)}>Annuler</Button><Button variant="primary" loading={submitting} onClick={submit}>Créer</Button></SpaceBetween>}
        >
          <Form errorText={error}>
            <SpaceBetween size="m">
              <FormField label="Titre du lot"><Input value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.detail.value }))} /></FormField>
              <FormField label="Description"><Textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.detail.value }))} /></FormField>
              <FormField label="Type de vente">
                <Select
                  selectedOption={{ label: form.sale_type === 'fixed_price' ? 'Prix fixe' : 'Enchère', value: form.sale_type ?? 'auction' }}
                  options={[{ label: 'Enchère', value: 'auction' }, { label: 'Prix fixe', value: 'fixed_price' }]}
                  onChange={e => setForm(p => ({ ...p, sale_type: e.detail.selectedOption.value as LotSaleType }))}
                />
              </FormField>
              {(form.sale_type ?? 'auction') === 'auction' && (
                <FormField label="Prix de départ (€)"><Input type="number" value={String(form.start_price ?? '')} onChange={e => setForm(p => ({ ...p, start_price: Number(e.detail.value) }))} /></FormField>
              )}
              <FormField label="Prix direct (achat immédiat, €)"><Input type="number" value={String(form.buy_now_price ?? '')} onChange={e => setForm(p => ({ ...p, buy_now_price: Number(e.detail.value) }))} /></FormField>
              <FormField label="Quantité"><Input type="number" value={String(form.quantity ?? 1)} onChange={e => setForm(p => ({ ...p, quantity: Number(e.detail.value) }))} /></FormField>
              <FormField label="Fin de l'enchère (optionnel)"><Input type="datetime-local" value={form.auction_end_at ?? ''} onChange={e => setForm(p => ({ ...p, auction_end_at: e.detail.value }))} /></FormField>
            </SpaceBetween>
          </Form>
        </Modal>
      )}

      {/* Modal enchères */}
      {bidsTarget && (
        <Modal visible header={`Enchères — ${bidsTarget.title}`} onDismiss={() => setBidsTarget(null)} size="large"
          footer={<Button variant="link" onClick={() => setBidsTarget(null)}>Fermer</Button>}
        >
          <Table
            items={bids}
            columnDefinitions={[
              { id: 'bidder', header: 'Acheteur', cell: r => (r.profiles as { full_name: string | null } | null)?.full_name ?? r.bidder_id.slice(0, 8) },
              { id: 'amount', header: 'Montant', cell: r => `${r.amount} ${bidsTarget.currency}` },
              { id: 'date', header: 'Date', cell: r => new Date(r.created_at).toLocaleString('fr-FR') },
              { id: 'winning', header: 'Gagnant', cell: r => r.is_winning ? <StatusIndicator type="success">Gagnant</StatusIndicator> : '—' },
              {
                id: 'actions', header: '',
                cell: r => bidsTarget.status === 'active' && !bidsTarget.winner_buyer_id
                  ? <Button variant="inline-link" onClick={() => acceptWinner(bidsTarget, r)}>Accepter comme gagnant</Button>
                  : null,
              },
            ]}
            empty={<Box textAlign="center">Aucune enchère</Box>}
          />
        </Modal>
      )}
    </SpaceBetween>
  );
}

export default function VendorLiquidation() {
  return (
    <ContentLayout header={<Header variant="h1">Liquidation & Déstockage</Header>}>
      <LotsTab />
    </ContentLayout>
  );
}
