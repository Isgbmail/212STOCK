import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Badge, Box,
  Alert, ColumnLayout, Modal, FormField, Textarea,
  StatusIndicator, Tabs, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type ReturnStatus  = 'pending' | 'approved' | 'rejected' | 'processed';
type ClaimStatus   = 'open' | 'in_progress' | 'resolved';
type DisputeStatus = 'mediation' | 'resolved' | 'litigation';
type ClaimPriority = 'high' | 'normal';

interface ReturnRequest {
  id: string; ref: string; buyer: string; order_ref: string;
  reason: string; amount: number; date: string;
  status: ReturnStatus;
}
interface Claim {
  id: string; ref: string; buyer: string; subject: string;
  description: string; priority: ClaimPriority;
  date: string; status: ClaimStatus;
}
interface Dispute {
  id: string; ref: string; buyer: string; order_ref: string;
  amount: number; reason: string; arbitre: string;
  date: string; status: DisputeStatus;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RETURN_STATUS: Record<ReturnStatus, { label: string; type: 'pending' | 'success' | 'error' | 'in-progress' }> = {
  pending:   { label: 'En attente',  type: 'pending' },
  approved:  { label: 'Approuvé',   type: 'success' },
  rejected:  { label: 'Refusé',     type: 'error' },
  processed: { label: 'Traité',     type: 'in-progress' },
};
const CLAIM_STATUS: Record<ClaimStatus, { label: string; color: 'blue' | 'severity-medium' | 'green' }> = {
  open:        { label: 'Ouvert',    color: 'blue' },
  in_progress: { label: 'En cours', color: 'severity-medium' },
  resolved:    { label: 'Résolu',   color: 'green' },
};
const DISPUTE_STATUS: Record<DisputeStatus, { label: string; type: 'pending' | 'success' | 'error' }> = {
  mediation:  { label: 'Médiation',  type: 'pending' },
  resolved:   { label: 'Résolu',    type: 'success' },
  litigation: { label: 'Contentieux', type: 'error' },
};
function fmt(n: number) { return `${n.toLocaleString('fr-MA')} MAD`; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function returnDbToUI(s: string): ReturnStatus {
  if (s === 'authorized')  return 'approved';
  if (s === 'refunded' || s === 'inspected') return 'processed';
  if (s === 'requested')   return 'pending';
  return 'pending';
}
function disputeDbToUI(s: string): DisputeStatus {
  if (s === 'resolved' || s === 'closed') return 'resolved';
  return 'mediation';
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function VendorSAV() {
  const { activeOrg } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{ type: 'return' | 'claim'; id: string; action: string } | null>(null);
  const [note, setNote] = useState('');
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string }[]>([]);

  function flash(type: 'success' | 'error', content: string) {
    setFlashItems([{ type, content }]);
    setTimeout(() => setFlashItems([]), 4000);
  }

  async function fetchData() {
    if (!activeOrg) return;
    setLoading(true);

    const [dispRes, retRes] = await Promise.all([
      supabase.from('disputes')
        .select(`id, dispute_type, status, buyer_description, refund_amount, opened_at,
                 orders!inner(id, order_number, seller_org_id, total_ttc)`)
        .eq('orders.seller_org_id', activeOrg.id)
        .order('opened_at', { ascending: false }),
      supabase.from('product_returns')
        .select(`id, status, requested_at, order_id,
                 orders!inner(id, order_number, seller_org_id, total_ttc),
                 disputes(id, buyer_description, dispute_type)`)
        .eq('orders.seller_org_id', activeOrg.id)
        .order('requested_at', { ascending: false }),
    ]);

    if (dispRes.data) {
      const uiDisputes: Dispute[] = (dispRes.data as Array<{
        id: string; dispute_type: string; status: string; buyer_description: string | null;
        refund_amount: number | null; opened_at: string;
        orders: { order_number: string; total_ttc: number };
      }>).map((d, i) => ({
        id: d.id,
        ref: `LIT-${String(i + 1).padStart(3, '0')}`,
        buyer: d.orders.order_number,
        order_ref: d.orders.order_number,
        amount: d.refund_amount ?? d.orders.total_ttc,
        reason: d.buyer_description ?? d.dispute_type.replace(/_/g, ' '),
        arbitre: 'Stock212 Admin',
        date: d.opened_at,
        status: disputeDbToUI(d.status),
      }));
      setDisputes(uiDisputes);
    }

    if (retRes.data) {
      const uiReturns: ReturnRequest[] = (retRes.data as Array<{
        id: string; status: string; requested_at: string; order_id: string;
        orders: { order_number: string; total_ttc: number };
        disputes: { buyer_description: string | null; dispute_type: string } | null;
      }>).map((r, i) => ({
        id: r.id,
        ref: `RET-${String(i + 1).padStart(3, '0')}`,
        buyer: r.orders.order_number,
        order_ref: r.orders.order_number,
        reason: r.disputes?.buyer_description ?? (r.disputes?.dispute_type ?? 'Retour produit').replace(/_/g, ' '),
        amount: r.orders.total_ttc,
        date: r.requested_at,
        status: returnDbToUI(r.status),
      }));
      setReturns(uiReturns);
    }

    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [activeOrg]);

  const pendingReturns = returns.filter((r) => r.status === 'pending').length;
  const openClaims = claims.filter((c) => c.status !== 'resolved').length;
  const totalInLitige = disputes.filter((d) => d.status === 'mediation').reduce((s, d) => s + d.amount, 0);

  async function handleReturn(id: string, action: 'approved' | 'rejected') {
    if (action === 'approved') {
      const { error } = await supabase.from('product_returns')
        .update({ status: 'authorized', authorized_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { flash('error', error.message); return; }
    }
    setReturns((prev) => prev.map((r) => r.id === id ? { ...r, status: action } : r));
    setActionTarget(null);
    setNote('');
  }

  async function emitAvoir(id: string) {
    const ret = returns.find((r) => r.id === id);
    if (!ret || !activeOrg) return;

    const ordersRes = await supabase.from('product_returns')
      .select('order_id, orders(buyer_org_id, total_ttc)')
      .eq('id', id)
      .single();

    const orderData = ordersRes.data as { order_id: string; orders: { buyer_org_id: string; total_ttc: number } } | null;
    if (orderData) {
      await Promise.all([
        supabase.from('credits').insert({
          seller_org_id: activeOrg.id,
          buyer_org_id: orderData.orders.buyer_org_id,
          order_id: orderData.order_id,
          amount: ret.amount,
          currency: 'MAD',
          reason: ret.reason,
        }),
        supabase.from('product_returns').update({ status: 'refunded' }).eq('id', id),
      ]);
    }

    setReturns((prev) => prev.map((r) => r.id === id ? { ...r, status: 'processed' } : r));
    setActionTarget(null);
    flash('success', 'Avoir émis avec succès.');
  }

  function resolveClaim(id: string) {
    setClaims((prev) => prev.map((c) => c.id === id ? { ...c, status: 'resolved' } : c));
    setActionTarget(null);
    setNote('');
  }

  function processClaim(id: string) {
    setClaims((prev) => prev.map((c) => c.id === id ? { ...c, status: 'in_progress' } : c));
  }

  return (
    <SpaceBetween size="l">

      {flashItems.length > 0 && (
        <Flashbar items={flashItems.map((f, i) => ({ ...f, id: String(i), dismissible: true, onDismiss: () => setFlashItems([]) }))} />
      )}

      {/* ── ALERTES ───────────────────────────────────────────────── */}
      {pendingReturns > 0 && (
        <Alert type="warning" header={`${pendingReturns} demande${pendingReturns > 1 ? 's' : ''} de retour en attente`}>
          Traitez ces demandes rapidement pour maintenir votre score vendeur.
        </Alert>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <ColumnLayout columns={4} variant="text-grid">
        <Box>
          <Box variant="awsui-key-label">Retours en attente</Box>
          <Box variant="h1" color={pendingReturns > 0 ? 'text-status-warning' : 'text-status-success'}>{pendingReturns}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Réclamations ouvertes</Box>
          <Box variant="h1" color={openClaims > 0 ? 'text-status-warning' : 'text-status-success'}>{openClaims}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Litiges en médiation</Box>
          <Box variant="h1" color={disputes.filter((d) => d.status === 'mediation').length > 0 ? 'text-status-error' : 'text-status-success'}>
            {disputes.filter((d) => d.status === 'mediation').length}
          </Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Montant en litige</Box>
          <Box variant="h1" color="text-status-error">{fmt(totalInLitige)}</Box>
        </Box>
      </ColumnLayout>

      {/* ── TABS ──────────────────────────────────────────────────── */}
      <Tabs
        tabs={[
          {
            id: 'returns',
            label: `Retours & avoirs (${returns.length})`,
            content: (
              <Table
                loading={loading}
                loadingText="Chargement…"
                header={<Header variant="h3">Demandes de retour</Header>}
                columnDefinitions={[
                  { id: 'ref',    header: 'Référence', cell: (r) => <Box fontWeight="bold">{r.ref}</Box> },
                  { id: 'buyer',  header: 'Acheteur',  cell: (r) => r.buyer },
                  { id: 'order',  header: 'Commande',  cell: (r) => r.order_ref },
                  { id: 'reason', header: 'Motif',     cell: (r) => r.reason },
                  { id: 'amount', header: 'Montant',   cell: (r) => <Box fontWeight="bold">{fmt(r.amount)}</Box> },
                  { id: 'date',   header: 'Date',      cell: (r) => new Date(r.date).toLocaleDateString('fr-MA') },
                  { id: 'status', header: 'Statut',    cell: (r) => (
                    <StatusIndicator type={RETURN_STATUS[r.status].type}>{RETURN_STATUS[r.status].label}</StatusIndicator>
                  )},
                  { id: 'actions', header: 'Actions', cell: (r) => (
                    <SpaceBetween direction="horizontal" size="xs">
                      {r.status === 'pending' && (
                        <>
                          <Button variant="primary" onClick={() => { setActionTarget({ type: 'return', id: r.id, action: 'approve' }); setNote(''); }}>Approuver</Button>
                          <Button onClick={() => { setActionTarget({ type: 'return', id: r.id, action: 'reject' }); setNote(''); }}>Refuser</Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <Button variant="primary" onClick={() => emitAvoir(r.id)}>Émettre avoir</Button>
                      )}
                      {r.status === 'processed' && (
                        <Button variant="link" iconName="download">Avoir PDF</Button>
                      )}
                    </SpaceBetween>
                  )},
                ]}
                items={returns}
              />
            ),
          },
          {
            id: 'claims',
            label: `Réclamations (${claims.filter((c) => c.status !== 'resolved').length} actives)`,
            content: (
              <Table
                header={<Header variant="h3">Réclamations acheteurs</Header>}
                columnDefinitions={[
                  { id: 'ref',     header: 'Référence',  cell: (c) => <Box fontWeight="bold">{c.ref}</Box> },
                  { id: 'buyer',   header: 'Acheteur',   cell: (c) => c.buyer },
                  { id: 'subject', header: 'Sujet',      cell: (c) => c.subject, width: 220 },
                  { id: 'priority',header: 'Priorité',   cell: (c) => (
                    <Badge color={c.priority === 'high' ? 'red' : 'severity-medium'}>
                      {c.priority === 'high' ? 'Haute' : 'Normale'}
                    </Badge>
                  )},
                  { id: 'date',    header: 'Date',       cell: (c) => new Date(c.date).toLocaleDateString('fr-MA') },
                  { id: 'status',  header: 'Statut',     cell: (c) => (
                    <Badge color={CLAIM_STATUS[c.status].color}>{CLAIM_STATUS[c.status].label}</Badge>
                  )},
                  { id: 'actions', header: 'Actions', cell: (c) => (
                    <SpaceBetween direction="horizontal" size="xs">
                      {c.status === 'open' && (
                        <Button variant="normal" onClick={() => processClaim(c.id)}>Traiter</Button>
                      )}
                      {c.status === 'in_progress' && (
                        <Button variant="primary" onClick={() => { setActionTarget({ type: 'claim', id: c.id, action: 'resolve' }); setNote(''); }}>Résoudre</Button>
                      )}
                      {c.status === 'resolved' && (
                        <StatusIndicator type="success">Clôturée</StatusIndicator>
                      )}
                    </SpaceBetween>
                  )},
                ]}
                items={claims}
              />
            ),
          },
          {
            id: 'disputes',
            label: `Litiges (${disputes.length})`,
            content: (
              <SpaceBetween size="m">
                {disputes.filter((d) => d.status === 'mediation').length > 0 && (
                  <Alert type="error" header="Litiges en cours de médiation">
                    Ces litiges sont en arbitrage avec l'équipe Stock212. Répondez rapidement aux demandes de l'arbitre.
                  </Alert>
                )}
                <Table
                  header={<Header variant="h3">Litiges</Header>}
                  columnDefinitions={[
                    { id: 'ref',     header: 'Référence',   cell: (d) => <Box fontWeight="bold">{d.ref}</Box> },
                    { id: 'buyer',   header: 'Acheteur',    cell: (d) => d.buyer },
                    { id: 'order',   header: 'Commande',    cell: (d) => d.order_ref },
                    { id: 'amount',  header: 'Montant',     cell: (d) => <Box fontWeight="bold" color="text-status-error">{fmt(d.amount)}</Box> },
                    { id: 'reason',  header: 'Motif',       cell: (d) => d.reason, width: 220 },
                    { id: 'arbitre', header: 'Arbitre',     cell: (d) => d.arbitre },
                    { id: 'date',    header: 'Date',        cell: (d) => new Date(d.date).toLocaleDateString('fr-MA') },
                    { id: 'status',  header: 'Statut',      cell: (d) => (
                      <StatusIndicator type={DISPUTE_STATUS[d.status].type}>{DISPUTE_STATUS[d.status].label}</StatusIndicator>
                    )},
                  ]}
                  items={disputes}
                />
              </SpaceBetween>
            ),
          },
        ]}
      />

      {/* ── MODAL ACTIONS ─────────────────────────────────────────── */}
      {actionTarget && (
        <Modal
          visible
          header={
            actionTarget.action === 'approve' ? 'Approuver le retour' :
            actionTarget.action === 'reject'  ? 'Refuser le retour' :
                                                 'Clôturer la réclamation'
          }
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setActionTarget(null)}>Annuler</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (actionTarget.type === 'return') {
                      handleReturn(actionTarget.id, actionTarget.action === 'approve' ? 'approved' : 'rejected');
                    } else {
                      resolveClaim(actionTarget.id);
                    }
                  }}
                >
                  Confirmer
                </Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setActionTarget(null)}
        >
          <SpaceBetween size="m">
            {actionTarget.action === 'approve' && (
              <Alert type="info">L'approbation du retour générera automatiquement une note d'avoir PDF envoyée à l'acheteur.</Alert>
            )}
            {actionTarget.action === 'reject' && (
              <Alert type="warning">Le refus du retour notifiera l'acheteur. Expliquez le motif dans la note ci-dessous.</Alert>
            )}
            <FormField label="Note interne / message acheteur (optionnel)">
              <Textarea
                value={note}
                onChange={({ detail }) => setNote(detail.value)}
                placeholder="Expliquez votre décision…"
                rows={4}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
