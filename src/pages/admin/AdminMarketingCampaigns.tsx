import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, Table, Button, Modal,
  SpaceBetween, FormField, Input, Alert, Box,
  TextFilter, Pagination, Select,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { cancelCampaign, addSellerCredits } from '../../lib/marketingHelpers';
import CampaignStatusBadge from '../../components/marketing/CampaignStatusBadge';
import type { Campaign, CampaignStatus } from '../../types/marketing';

const STATUS_OPTIONS = [
  { label: 'Tous', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'En attente', value: 'pending' },
  { label: 'En pause', value: 'paused' },
  { label: 'Terminée', value: 'completed' },
  { label: 'Annulée', value: 'cancelled' },
];

const PAGE_SIZE = 20;

export default function AdminMarketingCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<Campaign | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('campaigns')
      .select('*, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (statusFilter) q = q.eq('status', statusFilter as CampaignStatus);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data, count } = await q;
    setCampaigns((data ?? []) as Campaign[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true); setCancelError('');
    const { success, error } = await cancelCampaign(cancelTarget.id, cancelTarget.seller_id);
    if (!success) setCancelError(error ?? 'Erreur inconnue');
    else { setCancelTarget(null); load(); }
    setCancelling(false);
  };

  const doAdjust = async () => {
    if (!adjustTarget) return;
    const amount = Number(adjustAmount);
    if (!amount || isNaN(amount)) return;
    setAdjusting(true);
    await addSellerCredits(adjustTarget.seller_id, amount, 'admin_adjustment', adjustTarget.id, adjustNote || 'Ajustement admin');
    setAdjustTarget(null); setAdjustAmount(''); setAdjustNote('');
    setAdjusting(false);
    load();
  };

  return (
    <ContentLayout header={<Header variant="h1">Marketing — Campagnes</Header>}>
      <SpaceBetween size="m">
        <Table
          loading={loading}
          items={campaigns}
          columnDefinitions={[
            { id: 'name', header: 'Nom', cell: r => r.name },
            { id: 'type', header: 'Type', cell: r => r.type.replace(/_/g, ' ') },
            { id: 'seller', header: 'Vendeur', cell: r => (r.profiles as { full_name: string | null } | null)?.full_name ?? r.seller_id.slice(0, 8) },
            { id: 'budget', header: 'Budget', cell: r => `${r.budget_credits} cr.` },
            { id: 'spent', header: 'Dépensé', cell: r => `${r.spent_credits} cr.` },
            { id: 'status', header: 'Statut', cell: r => <CampaignStatusBadge status={r.status} /> },
            { id: 'start', header: 'Début', cell: r => r.start_date },
            { id: 'end', header: 'Fin', cell: r => r.end_date ?? '—' },
            {
              id: 'actions', header: '',
              cell: r => (
                <SpaceBetween direction="horizontal" size="xs">
                  {['active','pending','paused'].includes(r.status) && (
                    <Button variant="inline-link" onClick={() => setCancelTarget(r)}>Annuler</Button>
                  )}
                  <Button variant="inline-link" onClick={() => { setAdjustTarget(r); setAdjustAmount(''); setAdjustNote(''); }}>Ajuster crédits</Button>
                </SpaceBetween>
              ),
            },
          ]}
          filter={
            <SpaceBetween direction="horizontal" size="s">
              <TextFilter filteringText={filter} onChange={e => setFilter(e.detail.filteringText)} filteringPlaceholder="Rechercher par nom..." onDelayedChange={load} />
              <Select
                selectedOption={STATUS_OPTIONS.find(o => o.value === statusFilter) ?? STATUS_OPTIONS[0]}
                options={STATUS_OPTIONS}
                onChange={e => { setStatusFilter(e.detail.selectedOption.value ?? ''); setPage(1); }}
              />
            </SpaceBetween>
          }
          pagination={<Pagination currentPageIndex={page} pagesCount={Math.ceil(total / PAGE_SIZE)} onChange={e => setPage(e.detail.currentPageIndex)} />}
          header={<Header counter={`(${total})`}>Toutes les campagnes</Header>}
          empty={<Box textAlign="center">Aucune campagne</Box>}
        />

        {/* Modal annulation */}
        {cancelTarget && (
          <Modal
            visible header="Annuler la campagne"
            onDismiss={() => setCancelTarget(null)}
            footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setCancelTarget(null)}>Fermer</Button><Button variant="primary" loading={cancelling} onClick={doCancel}>Confirmer l'annulation</Button></SpaceBetween>}
          >
            <SpaceBetween size="s">
              <p>Annuler <strong>{cancelTarget.name}</strong> ? Les crédits non utilisés ({(cancelTarget.budget_credits - cancelTarget.spent_credits).toFixed(2)} cr.) seront remboursés au vendeur.</p>
              {cancelError && <Alert type="error">{cancelError}</Alert>}
            </SpaceBetween>
          </Modal>
        )}

        {/* Modal ajustement crédits */}
        {adjustTarget && (
          <Modal
            visible header="Ajustement de crédits vendeur"
            onDismiss={() => setAdjustTarget(null)}
            footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setAdjustTarget(null)}>Annuler</Button><Button variant="primary" loading={adjusting} onClick={doAdjust}>Appliquer</Button></SpaceBetween>}
          >
            <SpaceBetween size="m">
              <Alert type="info">L'ajustement sera crédité sur le solde du vendeur (montant positif = crédit, montant négatif = débit).</Alert>
              <FormField label="Montant (crédits)"><Input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.detail.value)} /></FormField>
              <FormField label="Note"><Input value={adjustNote} onChange={e => setAdjustNote(e.detail.value)} /></FormField>
            </SpaceBetween>
          </Modal>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
