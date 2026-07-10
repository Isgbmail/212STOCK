import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Box,
  TextFilter, Select, StatusIndicator, Badge,
  Modal, KeyValuePairs, ColumnLayout, Alert,
  ButtonDropdown, Container, Pagination, Textarea, FormField,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: '' },
  { label: 'En attente',      value: 'pending'        },
  { label: 'Confirmée',       value: 'confirmed'      },
  { label: 'En préparation',  value: 'in_preparation' },
  { label: 'Expédiée',        value: 'shipped'        },
  { label: 'Livrée',          value: 'delivered'      },
  { label: 'Annulée',         value: 'cancelled'      },
  { label: 'Litige',          value: 'dispute'        },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', in_preparation: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', dispute: 'Litige',
};

const statusType = (s: string): 'success' | 'warning' | 'error' | 'info' | 'stopped' => ({
  delivered: 'success', shipped: 'info', confirmed: 'info',
  in_preparation: 'info', pending: 'warning', cancelled: 'stopped', dispute: 'error',
} as Record<string, 'success' | 'warning' | 'error' | 'info' | 'stopped'>)[s] ?? 'info';

const PAGE_SIZE = 30;

export default function AdminOrders() {
  const [orders,       setOrders]       = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterText,   setFilterText]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected,     setSelected]     = useState<any | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [totalCount,   setTotalCount]   = useState(0);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);

  // Editable notes on selected order
  const [adminNote,    setAdminNote]    = useState('');
  const [savingNote,   setSavingNote]   = useState(false);

  useEffect(() => { loadOrders(); }, [statusFilter, currentPage]);

  async function loadOrders() {
    setLoading(true);
    let q = supabase
      .from('orders')
      .select(`
        id, order_number, status, total_ht, total_ttc, currency,
        created_at, updated_at, payment_terms, notes,
        delivery_address, billing_address,
        organisations!buyer_org_id(name),
        seller:organisations!seller_org_id(name),
        order_lines(id, product_name_snap, quantity, unit_price_ht, line_total_ht)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

    if (statusFilter) q = q.eq('status', statusFilter);

    const { data, count } = await q;
    setOrders((data as any[]) ?? []);
    setTotalCount(count ?? 0);
    setTotalPages(Math.ceil((count ?? 0) / PAGE_SIZE));
    setLoading(false);
  }

  async function saveNote() {
    if (!selected) return;
    setSavingNote(true);
    await supabase.from('orders').update({ notes: adminNote || null }).eq('id', selected.id);
    setSelected((prev: any) => ({ ...prev, notes: adminNote }));
    setSavingNote(false);
  }

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdating(true); setError(''); setSuccess('');
    const { error: err } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    if (err) { setError(err.message); }
    else {
      setSuccess(`Commande mise à jour : ${STATUS_LABEL[newStatus]}`);
      setSelected(null);
      loadOrders();
    }
    setUpdating(false);
  }

  // Client-side filter on the current page only (search across all pages via re-fetch not implemented for brevity)
  const filtered = orders.filter((o) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      (o.organisations as any)?.name?.toLowerCase().includes(q) ||
      (o.seller as any)?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <SpaceBetween size="l">
      <Header variant="h1" description="Toutes les commandes passées sur la plateforme">
        Gestion des commandes
      </Header>

      {error   && <Alert type="error"   dismissible onDismiss={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}

      {/* ── Stats rapides ───────────────────────────────────────── */}
      <Container header={<Header variant="h2">Résumé</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          {(['pending','confirmed','in_preparation','shipped','delivered','cancelled','dispute'] as const).slice(0, 4).map((s) => (
            <div key={s}>
              <Box variant="awsui-key-label">{STATUS_LABEL[s]}</Box>
              <Box fontSize="heading-xl" fontWeight="bold">
                {orders.filter((o) => o.status === s).length}
              </Box>
            </div>
          ))}
        </ColumnLayout>
      </Container>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <Table
        header={
          <Header
            variant="h2"
            counter={`(${filtered.length} / ${totalCount})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Select
                  selectedOption={STATUS_OPTIONS.find((o) => o.value === statusFilter) ?? STATUS_OPTIONS[0]}
                  options={STATUS_OPTIONS}
                  onChange={({ detail }) => { setStatusFilter(detail.selectedOption.value ?? ''); setCurrentPage(1); }}
                />
              </SpaceBetween>
            }
          >
            Commandes
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        loading={loading}
        loadingText="Chargement des commandes…"
        trackBy="id"
        items={filtered}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Rechercher par N° commande, acheteur, vendeur…"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        onRowClick={({ detail }) => { setSelected(detail.item); setAdminNote(detail.item.notes ?? ''); }}
        columnDefinitions={[
          {
            id: 'number',
            header: 'N° Commande',
            cell: (o) => <Box fontWeight="bold">{o.order_number}</Box>,
            sortingField: 'order_number',
          },
          {
            id: 'buyer',
            header: 'Acheteur',
            cell: (o) => o.organisations?.name ?? '—',
          },
          {
            id: 'seller',
            header: 'Vendeur',
            cell: (o) => o.seller?.name ?? '—',
          },
          {
            id: 'total',
            header: 'Total TTC',
            cell: (o) => `${o.total_ttc?.toFixed(2)} ${o.currency}`,
            sortingField: 'total_ttc',
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (o) => (
              <StatusIndicator type={statusType(o.status)}>
                {STATUS_LABEL[o.status] ?? o.status}
              </StatusIndicator>
            ),
          },
          {
            id: 'created',
            header: 'Date',
            cell: (o) => new Date(o.created_at).toLocaleDateString('fr-FR'),
            sortingField: 'created_at',
          },
          {
            id: 'actions',
            header: '',
            cell: (o) => (
              <ButtonDropdown
                items={[
                  { id: 'confirmed',      text: 'Confirmer',      disabled: o.status === 'confirmed'     },
                  { id: 'in_preparation', text: 'En préparation', disabled: o.status === 'in_preparation'},
                  { id: 'shipped',        text: 'Expédiée',       disabled: o.status === 'shipped'       },
                  { id: 'delivered',      text: 'Livrée',         disabled: o.status === 'delivered'     },
                  { id: 'cancelled',      text: 'Annuler',        disabled: o.status === 'cancelled'     },
                ]}
                onItemClick={({ detail }) => updateStatus(o.id, detail.id)}
                expandToViewport
              >
                Action
              </ButtonDropdown>
            ),
          },
        ]}
        empty={<Box textAlign="center" color="inherit" padding="l"><b>Aucune commande</b></Box>}
      />

      {/* ── Order Detail Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        onDismiss={() => setSelected(null)}
        size="large"
        header={`Commande ${selected?.order_number}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setSelected(null)}>Fermer</Button>
              <ButtonDropdown
                variant="primary"
                loading={updating}
                items={[
                  { id: 'confirmed',      text: 'Passer en Confirmée'      },
                  { id: 'in_preparation', text: 'Passer En préparation'    },
                  { id: 'shipped',        text: 'Marquer Expédiée'         },
                  { id: 'delivered',      text: 'Marquer Livrée'           },
                  { id: 'cancelled',      text: 'Annuler la commande'      },
                  { id: 'dispute',        text: 'Ouvrir en litige'         },
                ]}
                onItemClick={({ detail }) => updateStatus(selected.id, detail.id)}
              >
                Changer le statut
              </ButtonDropdown>
            </SpaceBetween>
          </Box>
        }
      >
        {selected && (
          <SpaceBetween size="m">
            <KeyValuePairs
              columns={3}
              items={[
                { label: 'N° Commande', value: selected.order_number },
                { label: 'Statut',      value: <StatusIndicator type={statusType(selected.status)}>{STATUS_LABEL[selected.status] ?? selected.status}</StatusIndicator> },
                { label: 'Date',        value: new Date(selected.created_at).toLocaleDateString('fr-FR') },
                { label: 'Acheteur',    value: selected.organisations?.name ?? '—' },
                { label: 'Vendeur',     value: selected.seller?.name ?? '—' },
                { label: 'Total HT',    value: `${selected.total_ht?.toFixed(2)} ${selected.currency}` },
                { label: 'Total TTC',   value: `${selected.total_ttc?.toFixed(2)} ${selected.currency}` },
                { label: 'Paiement',    value: selected.payment_terms ?? '—' },
              ]}
            />

            {/* ── Adresse de livraison ─────────────────────────── */}
            {selected.delivery_address && (
              <Container header={<Header variant="h3">Adresse de livraison</Header>}>
                <Box color="text-body-secondary">
                  {[
                    selected.delivery_address?.line1,
                    selected.delivery_address?.city,
                    selected.delivery_address?.postal_code,
                    selected.delivery_address?.country,
                  ].filter(Boolean).join(', ') || '—'}
                </Box>
              </Container>
            )}

            {/* ── Lignes de commande ───────────────────────────── */}
            {selected.order_lines?.length > 0 && (
              <Container header={<Header variant="h3">Lignes de commande ({selected.order_lines.length})</Header>}>
                <Table
                  trackBy="id"
                  items={selected.order_lines}
                  columnDefinitions={[
                    { id: 'product', header: 'Produit',   cell: (l: any) => l.product_name_snap },
                    { id: 'qty',     header: 'Qté',       cell: (l: any) => l.quantity },
                    { id: 'pu',      header: 'Prix/u HT', cell: (l: any) => `${l.unit_price_ht?.toFixed(2)} MAD` },
                    { id: 'total',   header: 'Total HT',  cell: (l: any) => `${l.line_total_ht?.toFixed(2)} MAD` },
                  ]}
                />
              </Container>
            )}

            {/* ── Note admin ───────────────────────────────────── */}
            <Container header={<Header variant="h3">Note interne admin</Header>}>
              <SpaceBetween size="xs">
                <FormField description="Visible uniquement par l'équipe d'administration.">
                  <Textarea
                    value={adminNote}
                    onChange={({ detail }) => setAdminNote(detail.value)}
                    rows={3}
                    placeholder="Instructions, observations, suivi interne…"
                  />
                </FormField>
                <Box float="right">
                  <Button loading={savingNote} onClick={saveNote}>Sauvegarder la note</Button>
                </Box>
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        )}
      </Modal>
    </SpaceBetween>
  );
}
