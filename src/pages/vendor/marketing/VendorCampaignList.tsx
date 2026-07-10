import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ContentLayout, Header, Table, Button, Modal, SpaceBetween,
  Box, Pagination, Alert, Select,
} from '@cloudscape-design/components';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { cancelCampaign } from '../../../lib/marketingHelpers';
import CampaignStatusBadge from '../../../components/marketing/CampaignStatusBadge';
import type { Campaign, CampaignStatus } from '../../../types/marketing';

const STATUS_OPTIONS = [
  { label: 'Toutes', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'En pause', value: 'paused' },
  { label: 'Terminée', value: 'completed' },
  { label: 'Annulée', value: 'cancelled' },
];

const PAGE_SIZE = 15;

export default function VendorCampaignList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (statusFilter) q = q.eq('status', statusFilter as CampaignStatus);
    const { data, count } = await q;
    setCampaigns((data ?? []) as Campaign[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, page, statusFilter]);

  const doCancel = async () => {
    if (!cancelTarget || !user) return;
    setCancelling(true); setCancelError('');
    const { success, error } = await cancelCampaign(cancelTarget.id, user.id);
    if (!success) setCancelError(error ?? 'Erreur');
    else { setCancelTarget(null); load(); }
    setCancelling(false);
  };

  const togglePause = async (c: Campaign) => {
    const newStatus: CampaignStatus = c.status === 'paused' ? 'active' : 'paused';
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', c.id);
    load();
  };

  return (
    <ContentLayout header={
      <Header
        variant="h1"
        actions={<Button variant="primary" iconName="add-plus" onClick={() => navigate('/vendor/marketing/campaigns/create')}>Nouvelle campagne</Button>}
      >
        Mes campagnes
      </Header>
    }>
      <SpaceBetween size="m">
        <Table
          loading={loading}
          items={campaigns}
          columnDefinitions={[
            { id: 'name', header: 'Nom', cell: r => r.name },
            { id: 'type', header: 'Type', cell: r => r.type.replace(/_/g, ' ') },
            { id: 'status', header: 'Statut', cell: r => <CampaignStatusBadge status={r.status} /> },
            { id: 'budget', header: 'Budget', cell: r => `${r.budget_credits} cr.` },
            { id: 'spent', header: 'Dépensé', cell: r => `${r.spent_credits} cr. (${r.budget_credits > 0 ? Math.round((r.spent_credits / r.budget_credits) * 100) : 0}%)` },
            { id: 'impressions', header: 'Impressions', cell: r => r.impressions.toLocaleString('fr-FR') },
            { id: 'clicks', header: 'Clics', cell: r => r.clicks.toLocaleString('fr-FR') },
            { id: 'dates', header: 'Période', cell: r => `${r.start_date} → ${r.end_date ?? '∞'}` },
            {
              id: 'actions', header: '',
              cell: r => (
                <SpaceBetween direction="horizontal" size="xs">
                  {['active', 'paused'].includes(r.status) && (
                    <Button variant="inline-link" onClick={() => togglePause(r)}>
                      {r.status === 'paused' ? 'Reprendre' : 'Mettre en pause'}
                    </Button>
                  )}
                  {['active', 'pending', 'paused'].includes(r.status) && (
                    <Button variant="inline-link" onClick={() => setCancelTarget(r)}>Annuler</Button>
                  )}
                </SpaceBetween>
              ),
            },
          ]}
          filter={
            <Select
              selectedOption={STATUS_OPTIONS.find(o => o.value === statusFilter) ?? STATUS_OPTIONS[0]}
              options={STATUS_OPTIONS}
              onChange={e => { setStatusFilter(e.detail.selectedOption.value ?? ''); setPage(1); }}
            />
          }
          pagination={<Pagination currentPageIndex={page} pagesCount={Math.ceil(total / PAGE_SIZE)} onChange={e => setPage(e.detail.currentPageIndex)} />}
          header={<Header counter={`(${total})`}>Campagnes</Header>}
          empty={<Box textAlign="center">Aucune campagne. <Button variant="inline-link" onClick={() => navigate('/vendor/marketing/campaigns/create')}>Créer la première</Button></Box>}
        />

        {cancelTarget && (
          <Modal
            visible header="Annuler la campagne"
            onDismiss={() => setCancelTarget(null)}
            footer={<SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCancelTarget(null)}>Fermer</Button>
              <Button variant="primary" loading={cancelling} onClick={doCancel}>Confirmer l'annulation</Button>
            </SpaceBetween>}
          >
            <SpaceBetween size="s">
              <p>Annuler <strong>{cancelTarget.name}</strong> ?<br />Crédits non utilisés remboursés : <strong>{(cancelTarget.budget_credits - cancelTarget.spent_credits).toFixed(2)} cr.</strong></p>
              {cancelError && <Alert type="error">{cancelError}</Alert>}
            </SpaceBetween>
          </Modal>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
