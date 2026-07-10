import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Box,
  TextFilter, Select, StatusIndicator, Badge,
  Modal, KeyValuePairs, Textarea, Alert, Flashbar,
  ColumnLayout, ExpandableSection,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

const VERDICT_OPTIONS = [
  { value: '',                    label: 'Aucun verdict sélectionné' },
  { value: 'refund_buyer',        label: 'Remboursement acheteur (total)' },
  { value: 'refund_buyer_partial',label: 'Remboursement acheteur (partiel)' },
  { value: 'warning_seller',      label: 'Avertissement vendeur' },
  { value: 'shared',              label: 'Responsabilité partagée' },
  { value: 'no_action',           label: 'Sans suite — injustifié' },
  { value: 'reshipment',          label: 'Réexpédition des marchandises' },
];


const DISPUTE_STATUS_OPTIONS = [
  { label: 'Tous',           value: '' },
  { label: 'Ouvert',         value: 'open'        },
  { label: 'En traitement',  value: 'in_progress' },
  { label: 'Résolu',         value: 'resolved'    },
  { label: 'Fermé',          value: 'closed'      },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert', in_progress: 'En traitement', resolved: 'Résolu', closed: 'Fermé',
};
const statusType = (s: string): 'error' | 'warning' | 'success' | 'stopped' => ({
  open: 'error', in_progress: 'warning', resolved: 'success', closed: 'stopped',
} as Record<string, 'error' | 'warning' | 'success' | 'stopped'>)[s] ?? 'warning';

interface ResolutionTemplate { id: string; label: string; body: string; verdict: string; }

export default function AdminDisputes() {
  const [disputes,     setDisputes]     = useState<any[]>([]);
  const [templates,    setTemplates]    = useState<ResolutionTemplate[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterText,   setFilterText]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected,     setSelected]     = useState<any | null>(null);
  const [resolution,   setResolution]   = useState('');
  const [verdict,      setVerdict]      = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  useEffect(() => { loadDisputes(); }, [statusFilter]);

  useEffect(() => {
    supabase.from('dispute_resolution_templates').select('id, label, body, verdict')
      .eq('active', true).order('created_at')
      .then(({ data }) => setTemplates((data ?? []) as ResolutionTemplate[]));
  }, []);

  async function loadDisputes() {
    setLoading(true);
    let q = supabase
      .from('disputes')
      .select(`
        id, status, dispute_type, buyer_description, resolution, created_at, updated_at,
        orders!order_id(order_number, total_ttc, currency, buyer:organisations!buyer_org_id(name), seller:organisations!seller_org_id(name))
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setDisputes((data as any[]) ?? []);
    setLoading(false);
  }

  async function handleResolve(newStatus: 'in_progress' | 'resolved' | 'closed') {
    if (!selected) return;
    setSaving(true); setError(''); setSuccess('');
    const { error: err } = await supabase
      .from('disputes')
      .update({
        status:     newStatus,
        resolution: resolution || selected.resolution || null,
        ...(verdict ? { verdict } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (err) { setError(err.message); }
    else {
      setSuccess(`Litige mis à jour : ${STATUS_LABEL[newStatus]}`);
      setSelected(null); setResolution(''); setVerdict('');
      loadDisputes();
    }
    setSaving(false);
  }

  const filtered = disputes.filter((d) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      d.dispute_type?.toLowerCase().includes(q) ||
      d.orders?.buyer?.name?.toLowerCase().includes(q) ||
      d.orders?.seller?.name?.toLowerCase().includes(q) ||
      d.orders?.order_number?.toLowerCase().includes(q)
    );
  });

  const openCount     = disputes.filter((d) => d.status === 'open').length;
  const progressCount = disputes.filter((d) => d.status === 'in_progress').length;

  return (
    <SpaceBetween size="l">
      <Header variant="h1" description="Suivi et résolution de tous les litiges plateforme">
        Litiges & SAV
      </Header>

      {error   && <Flashbar items={[{ type: 'error',   content: error,   dismissible: true, onDismiss: () => setError('')   }]} />}
      {success && <Flashbar items={[{ type: 'success', content: success, dismissible: true, onDismiss: () => setSuccess('') }]} />}

      {openCount > 0 && (
        <Alert type="error" header={`${openCount} litige${openCount > 1 ? 's' : ''} ouvert${openCount > 1 ? 's' : ''} nécessitent une action`}>
          {progressCount > 0 && `${progressCount} litige${progressCount > 1 ? 's' : ''} en cours de traitement.`}
        </Alert>
      )}

      <Table
        header={
          <Header
            variant="h2"
            counter={`(${filtered.length})`}
            actions={
              <Select
                selectedOption={DISPUTE_STATUS_OPTIONS.find((o) => o.value === statusFilter) ?? DISPUTE_STATUS_OPTIONS[0]}
                options={DISPUTE_STATUS_OPTIONS}
                onChange={({ detail }) => setStatusFilter(detail.selectedOption.value ?? '')}
              />
            }
          >
            Litiges
          </Header>
        }
        loading={loading}
        loadingText="Chargement…"
        trackBy="id"
        items={filtered}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher par raison, acheteur, vendeur, N° commande…"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        onRowClick={({ detail }) => { setSelected(detail.item); setResolution(detail.item.resolution ?? ''); setVerdict(detail.item.verdict ?? ''); }}
        columnDefinitions={[
          {
            id: 'order',
            header: 'Commande',
            cell: (d) => <Box fontWeight="bold">{d.orders?.order_number ?? '—'}</Box>,
          },
          {
            id: 'buyer',
            header: 'Acheteur',
            cell: (d) => d.orders?.buyer?.name ?? '—',
          },
          {
            id: 'seller',
            header: 'Vendeur',
            cell: (d) => d.orders?.seller?.name ?? '—',
          },
          {
            id: 'reason',
            header: 'Motif',
            cell: (d) => (
              <Box fontSize="body-s">{d.dispute_type ?? '—'}</Box>
            ),
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (d) => (
              <StatusIndicator type={statusType(d.status)}>
                {STATUS_LABEL[d.status] ?? d.status}
              </StatusIndicator>
            ),
          },
          {
            id: 'amount',
            header: 'Montant',
            cell: (d) => d.orders ? `${d.orders.total_ttc?.toFixed(2)} ${d.orders.currency}` : '—',
          },
          {
            id: 'created',
            header: 'Ouvert le',
            cell: (d) => new Date(d.created_at).toLocaleDateString('fr-FR'),
          },
        ]}
        empty={<Box textAlign="center" color="inherit" padding="l"><b>Aucun litige</b></Box>}
      />

      {/* ── Dispute Detail Modal ─────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        onDismiss={() => { setSelected(null); setResolution(''); }}
        size="large"
        header={`Litige — Commande ${selected?.orders?.order_number ?? '?'}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => { setSelected(null); setResolution(''); }}>Fermer</Button>
              {selected?.status === 'open' && (
                <Button onClick={() => handleResolve('in_progress')} loading={saving}>
                  Prendre en charge
                </Button>
              )}
              {selected?.status === 'in_progress' && (
                <Button variant="primary" onClick={() => handleResolve('resolved')} loading={saving}>
                  Marquer Résolu
                </Button>
              )}
              {(selected?.status === 'resolved' || selected?.status === 'in_progress') && (
                <Button onClick={() => handleResolve('closed')} loading={saving}>
                  Fermer le litige
                </Button>
              )}
            </SpaceBetween>
          </Box>
        }
      >
        {selected && (
          <SpaceBetween size="m">
            <KeyValuePairs
              columns={3}
              items={[
                { label: 'Acheteur',   value: selected.orders?.buyer?.name ?? '—'  },
                { label: 'Vendeur',    value: selected.orders?.seller?.name ?? '—' },
                { label: 'Statut',     value: <StatusIndicator type={statusType(selected.status)}>{STATUS_LABEL[selected.status]}</StatusIndicator> },
                { label: 'Commande',   value: selected.orders?.order_number ?? '—' },
                { label: 'Montant',    value: selected.orders ? `${selected.orders.total_ttc?.toFixed(2)} ${selected.orders.currency}` : '—' },
                { label: 'Ouvert le',  value: new Date(selected.created_at).toLocaleDateString('fr-FR') },
                { label: 'Motif',      value: selected.dispute_type ?? '—' },
              ]}
            />
            {selected.buyer_description && (
              <Box>
                <Box fontWeight="bold" margin={{ bottom: 'xs' }}>Description du litige</Box>
                <Box color="text-body-secondary">{selected.buyer_description}</Box>
              </Box>
            )}

            {/* ── Verdict structuré ─────────────────────────────── */}
            <ColumnLayout columns={2}>
              <Box>
                <Box fontWeight="bold" margin={{ bottom: 'xs' }}>Verdict</Box>
                <Select
                  selectedOption={VERDICT_OPTIONS.find((v) => v.value === verdict) ?? VERDICT_OPTIONS[0]}
                  onChange={({ detail }) => setVerdict(detail.selectedOption.value ?? '')}
                  options={VERDICT_OPTIONS}
                />
              </Box>
              <Box>
                <Box fontWeight="bold" margin={{ bottom: 'xs' }}>Templates de résolution rapide</Box>
                <SpaceBetween size="xxs">
                  {templates.map((t) => (
                    <Button
                      key={t.id}
                      variant="inline-link"
                      onClick={() => { setResolution(t.body); setVerdict(t.verdict); }}
                    >
                      {t.label}
                    </Button>
                  ))}
                </SpaceBetween>
              </Box>
            </ColumnLayout>

            {/* ── Résolution texte ──────────────────────────────── */}
            <Box>
              <Box fontWeight="bold" margin={{ bottom: 'xs' }}>Résolution / Décision admin</Box>
              <Textarea
                value={resolution}
                onChange={({ detail }) => setResolution(detail.value)}
                rows={5}
                placeholder="Décrivez les actions prises, la décision et sa justification…"
              />
            </Box>

            {/* ── Historique si déjà traité ─────────────────────── */}
            {selected.resolution && selected.status !== 'open' && (
              <ExpandableSection headerText="Résolution précédente enregistrée">
                <Box color="text-body-secondary">{selected.resolution}</Box>
              </ExpandableSection>
            )}
          </SpaceBetween>
        )}
      </Modal>
    </SpaceBetween>
  );
}
