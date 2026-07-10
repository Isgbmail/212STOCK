import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, Table, Button, SpaceBetween, Box,
  Pagination, StatusIndicator, Modal, Alert,
} from '@cloudscape-design/components';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { SamplingRequest } from '../../../types/marketing';

const STATUS_LABEL: Record<SamplingRequest['status'], { label: string; type: 'success' | 'warning' | 'info' | 'stopped' | 'error' }> = {
  pending:  { label: 'En attente', type: 'warning' },
  approved: { label: 'Approuvée', type: 'success' },
  rejected: { label: 'Rejetée', type: 'error' },
  shipped:  { label: 'Expédiée', type: 'info' },
};

const PAGE_SIZE = 20;

export default function VendorSampling() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SamplingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionTarget, setActionTarget] = useState<{ req: SamplingRequest; action: 'approve' | 'reject' | 'ship' } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, count } = await supabase
      .from('sampling_requests')
      .select('*, profiles(full_name, email), sampling_campaigns(*, products(name, images))', { count: 'exact' })
      .eq('sampling_campaigns.campaigns.seller_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setRequests((data ?? []) as SamplingRequest[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, page]);

  const doAction = async () => {
    if (!actionTarget) return;
    setProcessing(true); setError('');
    const statusMap = { approve: 'approved', reject: 'rejected', ship: 'shipped' } as const;
    const { error: e } = await supabase
      .from('sampling_requests')
      .update({ status: statusMap[actionTarget.action] })
      .eq('id', actionTarget.req.id);
    if (e) setError(e.message);
    else { setActionTarget(null); load(); }
    setProcessing(false);
  };

  const actionLabels = { approve: 'Approuver', reject: 'Rejeter', ship: 'Marquer comme expédiée' };

  return (
    <ContentLayout header={<Header variant="h1">Demandes d'échantillons</Header>}>
      <SpaceBetween size="m">
        <Table
          loading={loading}
          items={requests}
          columnDefinitions={[
            { id: 'buyer', header: 'Acheteur', cell: r => (r.profiles as { full_name: string | null } | null)?.full_name ?? '—' },
            { id: 'product', header: 'Produit', cell: r => (r.sampling_campaigns as SamplingRequest['sampling_campaigns'])?.products?.name ?? '—' },
            { id: 'status', header: 'Statut', cell: r => { const s = STATUS_LABEL[r.status]; return <StatusIndicator type={s.type}>{s.label}</StatusIndicator>; } },
            { id: 'address', header: 'Adresse', cell: r => typeof r.shipping_address === 'object' ? `${r.shipping_address.city ?? ''}, ${r.shipping_address.country ?? ''}` : '—' },
            { id: 'notes', header: 'Notes', cell: r => r.notes ?? '—' },
            { id: 'date', header: 'Demandé le', cell: r => new Date(r.created_at).toLocaleDateString('fr-FR') },
            {
              id: 'actions', header: '',
              cell: r => (
                <SpaceBetween direction="horizontal" size="xs">
                  {r.status === 'pending' && (
                    <>
                      <Button variant="inline-link" onClick={() => setActionTarget({ req: r, action: 'approve' })}>Approuver</Button>
                      <Button variant="inline-link" onClick={() => setActionTarget({ req: r, action: 'reject' })}>Rejeter</Button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <Button variant="inline-link" onClick={() => setActionTarget({ req: r, action: 'ship' })}>Marquer expédiée</Button>
                  )}
                </SpaceBetween>
              ),
            },
          ]}
          pagination={<Pagination currentPageIndex={page} pagesCount={Math.ceil(total / PAGE_SIZE)} onChange={e => setPage(e.detail.currentPageIndex)} />}
          header={<Header counter={`(${total})`} actions={<Button iconName="refresh" onClick={load}>Actualiser</Button>}>Demandes d'échantillons</Header>}
          empty={<Box textAlign="center">Aucune demande d'échantillon</Box>}
        />

        {actionTarget && (
          <Modal
            visible
            header={actionLabels[actionTarget.action]}
            onDismiss={() => setActionTarget(null)}
            footer={<SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setActionTarget(null)}>Annuler</Button>
              <Button variant="primary" loading={processing} onClick={doAction}>Confirmer</Button>
            </SpaceBetween>}
          >
            <SpaceBetween size="s">
              <p>{actionLabels[actionTarget.action]} la demande de <strong>{(actionTarget.req.profiles as { full_name: string | null } | null)?.full_name ?? 'cet acheteur'}</strong> ?</p>
              {error && <Alert type="error">{error}</Alert>}
            </SpaceBetween>
          </Modal>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
