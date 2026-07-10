import { useEffect, useState } from 'react';
import {
  Table, Header, Button, SpaceBetween, Badge, Box,
  Alert, ColumnLayout, Modal, FormField, Input,
  StatusIndicator, TextFilter, Pagination, Tabs,
  ExpandableSection, Flashbar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { type Carrier } from '../../lib/vendorUtils';

// ── Types ─────────────────────────────────────────────────────────────────────
type ShipStatus = 'pending_dispatch' | 'dispatched' | 'in_transit' | 'delivered' | 'failed';

interface Shipment {
  id: string; order_number: string; buyer: string;
  address: string; city: string;
  weight_kg: number; is_cold: boolean; is_urgent: boolean;
  carrier_name: string; tracking_ref: string;
  driver?: string; eta: string;
  cod_amount: number; cod_reconciled: boolean;
  status: ShipStatus; created_at: string;
  order_id?: string;
  rawParcelDetails?: Record<string, unknown>;
}

// ── DB status → UI status ─────────────────────────────────────────────────────
function ticketStatusToUI(s: string): ShipStatus {
  if (s === 'open')       return 'pending_dispatch';
  if (s === 'assigned' || s === 'picked_up') return 'dispatched';
  if (s === 'in_transit') return 'in_transit';
  if (s === 'delivered')  return 'delivered';
  return 'failed';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_INFO: Record<ShipStatus, { label: string; type: 'pending' | 'in-progress' | 'success' | 'error' | 'stopped' }> = {
  pending_dispatch: { label: 'À dispatcher', type: 'pending' },
  dispatched:       { label: 'Dispatché',     type: 'in-progress' },
  in_transit:       { label: 'En transit',    type: 'in-progress' },
  delivered:        { label: 'Livrée',        type: 'success' },
  failed:           { label: 'Échouée',       type: 'error' },
};

function recommend(s: Shipment, carriers: Carrier[]): Carrier | null {
  if (s.is_cold && s.is_urgent) return carriers.find(c => c.name === 'Maroc Cold Chain') ?? carriers.find(c => c.cold_chain && c.urgent) ?? null;
  if (s.is_cold)  return carriers.find(c => c.cold_chain && c.type === 'internal') ?? carriers.find(c => c.cold_chain) ?? null;
  if (s.is_urgent) return carriers.find(c => c.urgent && c.type === 'external') ?? null;
  return carriers.find(c => c.name === 'CTM Cargo') ?? carriers.find(c => c.type === 'external') ?? null;
}

function etaFromDays(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toLocaleDateString('fr-FR');
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function VendorDeliveries() {
  const { activeOrg, user } = useAuth();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dispatchTarget, setDispatchTarget] = useState<Shipment | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [manualTracking, setManualTracking] = useState('');
  const [manual3pl, setManual3pl] = useState({ name: '', phone: '', tracking: '', eta: '' });
  const [reconcileTarget, setReconcileTarget] = useState<Shipment | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string }[]>([]);
  const pageSize = 10;

  function flash(type: 'success' | 'error', content: string) {
    setFlashItems([{ type, content }]);
    setTimeout(() => setFlashItems([]), 4000);
  }

  async function fetchTickets() {
    if (!activeOrg) return;
    setLoading(true);

    // Tickets déjà créés par le vendeur
    const { data: ticketsData } = await supabase
      .from('delivery_tickets')
      .select(`id, ticket_number, status, priority, delivery_address, parcel_details, created_at, order_id,
               orders(id, order_number, total_ttc, payment_terms)`)
      .eq('requester_org_id', activeOrg.id)
      .order('created_at', { ascending: false });

    // Commandes en attente de dispatch (aucun ticket)
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id, order_number, delivery_address, total_ttc, payment_terms')
      .eq('seller_org_id', activeOrg.id)
      .in('status', ['confirmed', 'in_preparation']);

    const ticketOrderIds = new Set(
      ((ticketsData ?? []) as Array<{ order_id: string | null }>)
        .map((t) => t.order_id)
        .filter(Boolean)
    );

    const ticketShipments: Shipment[] = ((ticketsData ?? []) as Array<{
      id: string; ticket_number: string; status: string; priority: string;
      delivery_address: Record<string, string>; parcel_details: Record<string, unknown> | null;
      created_at: string; order_id: string | null;
      orders: { order_number: string; total_ttc: number; payment_terms?: string } | null;
    }>).map((t) => ({
      id: t.id,
      order_number: t.orders?.order_number ?? t.ticket_number,
      buyer: (t.delivery_address?.company ?? t.delivery_address?.name ?? '—') as string,
      address: (t.delivery_address?.line1 ?? '') as string,
      city: (t.delivery_address?.city ?? '') as string,
      weight_kg: (t.parcel_details?.weight_kg as number) ?? 0,
      is_cold: (t.parcel_details?.cold_chain as boolean) ?? false,
      is_urgent: t.priority === 'express',
      carrier_name: (t.parcel_details?.carrier_name as string) ?? '',
      tracking_ref: (t.parcel_details?.tracking_ref as string) ?? '',
      eta: (t.parcel_details?.eta as string) ?? '',
      cod_amount: t.orders?.payment_terms === 'cod' ? (t.orders?.total_ttc ?? 0) : 0,
      cod_reconciled: (t.parcel_details?.cod_reconciled as boolean) ?? false,
      status: ticketStatusToUI(t.status),
      created_at: t.created_at,
      order_id: t.order_id ?? undefined,
      rawParcelDetails: t.parcel_details ?? {},
    }));

    const pendingShipments: Shipment[] = ((pendingOrders ?? []) as Array<{
      id: string; order_number: string; delivery_address: Record<string, string> | null;
      total_ttc: number; payment_terms?: string;
    }>)
      .filter((o) => !ticketOrderIds.has(o.id))
      .map((o) => ({
        id: `pending-${o.id}`,
        order_number: o.order_number,
        buyer: (o.delivery_address?.company ?? o.delivery_address?.name ?? '—') as string,
        address: (o.delivery_address?.line1 ?? '') as string,
        city: (o.delivery_address?.city ?? '') as string,
        weight_kg: 0, is_cold: false, is_urgent: false,
        carrier_name: '', tracking_ref: '', eta: '',
        cod_amount: o.payment_terms === 'cod' ? o.total_ttc : 0,
        cod_reconciled: false,
        status: 'pending_dispatch',
        created_at: new Date().toISOString(),
        order_id: o.id,
      }));

    setShipments([...pendingShipments, ...ticketShipments]);
    setLoading(false);
  }

  useEffect(() => { fetchTickets(); }, [activeOrg]);

  useEffect(() => {
    supabase.from('carriers').select('*').eq('active', true).order('type').order('name')
      .then(({ data }) => setCarriers((data ?? []) as Carrier[]));
  }, []);

  const filtered = shipments.filter((s) =>
    filter === '' ||
    s.order_number.toLowerCase().includes(filter.toLowerCase()) ||
    s.buyer.toLowerCase().includes(filter.toLowerCase())
  );
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // KPIs
  const actives = shipments.filter((s) => ['dispatched', 'in_transit'].includes(s.status)).length;
  const livreesWeek = shipments.filter((s) => s.status === 'delivered').length;
  const codPending = shipments.filter((s) => s.cod_amount > 0 && !s.cod_reconciled).reduce((a, s) => a + s.cod_amount, 0);
  const pendingDispatch = shipments.filter((s) => s.status === 'pending_dispatch').length;

  const rec = dispatchTarget ? recommend(dispatchTarget, carriers) : null;

  async function confirmDispatch() {
    if (!dispatchTarget || !selectedCarrier || !activeOrg) return;
    setDispatching(true);
    const ref = manualTracking || `${selectedCarrier.name.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 90000 + 10000)}`;
    const eta = etaFromDays(selectedCarrier.avg_days);

    if (dispatchTarget.id.startsWith('pending-')) {
      // Créer un nouveau delivery_ticket
      const { error } = await supabase.from('delivery_tickets').insert({
        ticket_number: `TKT-${Date.now()}`,
        created_by: user?.id,
        requester_org_id: activeOrg.id,
        order_id: dispatchTarget.order_id ?? null,
        delivery_address: { city: dispatchTarget.city, line1: dispatchTarget.address },
        parcel_details: {
          carrier_name: selectedCarrier.name,
          tracking_ref: ref,
          eta,
          cod_reconciled: false,
          cold_chain: dispatchTarget.is_cold,
        },
        priority: dispatchTarget.is_urgent ? 'express' : 'normal',
        status: 'assigned',
      });
      if (error) { flash('error', error.message); setDispatching(false); return; }
    } else {
      // Mettre à jour le ticket existant
      const { error } = await supabase.from('delivery_tickets')
        .update({
          status: 'assigned',
          parcel_details: {
            carrier_name: selectedCarrier.name,
            tracking_ref: ref,
            eta,
            cold_chain: dispatchTarget.is_cold,
            cod_reconciled: false,
          },
          assigned_at: new Date().toISOString(),
        })
        .eq('id', dispatchTarget.id);
      if (error) { flash('error', error.message); setDispatching(false); return; }
    }

    setDispatching(false);
    setDispatchTarget(null);
    setSelectedCarrier(null);
    setManualTracking('');
    fetchTickets();
  }

  async function reconcileCOD(id: string) {
    if (!id.startsWith('pending-')) {
      const target = shipments.find((s) => s.id === id);
      const existing = target?.rawParcelDetails ?? {};
      await supabase.from('delivery_tickets').update({
        parcel_details: { ...existing, cod_reconciled: true },
      }).eq('id', id);
    }
    setShipments((prev) => prev.map((s) => s.id === id ? { ...s, cod_reconciled: true } : s));
    setReconcileTarget(null);
  }

  async function advanceTicketStatus(shipment: Shipment) {
    const nextMap: Record<ShipStatus, { dbStatus: string; orderStatus?: string; tsField?: string }> = {
      dispatched:  { dbStatus: 'in_transit' },
      in_transit:  { dbStatus: 'delivered', orderStatus: 'delivered', tsField: 'delivered_at' },
      pending_dispatch: { dbStatus: 'assigned' },
      delivered: { dbStatus: 'delivered' },
      failed:    { dbStatus: 'cancelled' },
    };
    const next = nextMap[shipment.status];
    if (!next || shipment.status === 'delivered') return;

    const updates: Record<string, unknown> = {
      status: next.dbStatus,
      ...(next.tsField ? { [next.tsField]: new Date().toISOString() } : {}),
    };
    const { error } = await supabase.from('delivery_tickets').update(updates).eq('id', shipment.id);
    if (error) { flash('error', error.message); return; }

    if (next.orderStatus && shipment.order_id) {
      await supabase.from('orders').update({ status: next.orderStatus, updated_at: new Date().toISOString() }).eq('id', shipment.order_id);
    }
    flash('success', `Statut mis à jour → ${next.dbStatus}`);
    fetchTickets();
  }

  return (
    <SpaceBetween size="l">

      {flashItems.length > 0 && (
        <Flashbar items={flashItems.map((f, i) => ({ ...f, id: String(i), dismissible: true, onDismiss: () => setFlashItems([]) }))} />
      )}

      {/* ── ALERTE DISPATCH ───────────────────────────────────────── */}
      {pendingDispatch > 0 && (
        <Alert
          type="warning"
          header={`${pendingDispatch} commande${pendingDispatch > 1 ? 's' : ''} en attente de dispatch`}
          action={<Button onClick={() => setFilter('CMD')}>Voir les commandes</Button>}
        >
          Ces commandes sont acceptées mais n'ont pas encore de transporteur assigné.
        </Alert>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <ColumnLayout columns={4} variant="text-grid">
        <Box>
          <Box variant="awsui-key-label">Livraisons actives</Box>
          <Box variant="h1">{actives}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">En attente dispatch</Box>
          <Box variant="h1" color={pendingDispatch > 0 ? 'text-status-warning' : 'text-status-success'}>
            {pendingDispatch}
          </Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">Livrées (total)</Box>
          <Box variant="h1" color="text-status-success">{livreesWeek}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">COD à réconcilier</Box>
          <Box variant="h1" color={codPending > 0 ? 'text-status-warning' : 'text-status-success'}>
            {codPending.toLocaleString('fr-MA')} MAD
          </Box>
        </Box>
      </ColumnLayout>

      {/* ── TABLE LIVRAISONS ──────────────────────────────────────── */}
      <Table
        header={
          <Header variant="h2" counter={`(${filtered.length})`}>
            Expéditions
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            filteringPlaceholder="Rechercher commande ou acheteur…"
            onChange={({ detail }) => { setFilter(detail.filteringText); setCurrentPage(1); }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={[
          {
            id: 'order', header: 'Commande',
            cell: (s) => (
              <SpaceBetween size="xxs">
                <Box fontWeight="bold">{s.order_number}</Box>
                <Box variant="small" color="text-body-secondary">{s.buyer}</Box>
              </SpaceBetween>
            ), width: 180,
          },
          {
            id: 'dest', header: 'Destination',
            cell: (s) => <Box>{s.city}</Box>,
          },
          {
            id: 'flags', header: 'Type',
            cell: (s) => (
              <SpaceBetween size="xxs">
                {s.is_cold && <Badge color="blue">Froid</Badge>}
                {s.is_urgent && <Badge color="red">Urgent</Badge>}
                {!s.is_cold && !s.is_urgent && <Badge color="grey">Standard</Badge>}
              </SpaceBetween>
            ),
          },
          {
            id: 'carrier', header: 'Transporteur',
            cell: (s) => s.carrier_name
              ? <SpaceBetween size="xxs"><Box>{s.carrier_name}</Box><Box variant="small" color="text-body-secondary">{s.tracking_ref}</Box></SpaceBetween>
              : <Box color="text-status-warning">—</Box>,
          },
          {
            id: 'eta', header: 'ETA',
            cell: (s) => s.eta ? new Date(s.eta).toLocaleDateString('fr-MA') : '—',
          },
          {
            id: 'cod', header: 'COD',
            cell: (s) => s.cod_amount > 0
              ? (
                <SpaceBetween size="xxs">
                  <Box fontWeight="bold">{s.cod_amount.toLocaleString('fr-MA')} MAD</Box>
                  {s.cod_reconciled
                    ? <StatusIndicator type="success">Réconcilié</StatusIndicator>
                    : <StatusIndicator type="warning">À réconcilier</StatusIndicator>}
                </SpaceBetween>
              )
              : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'status', header: 'Statut',
            cell: (s) => <StatusIndicator type={STATUS_INFO[s.status].type}>{STATUS_INFO[s.status].label}</StatusIndicator>,
          },
          {
            id: 'actions', header: 'Actions',
            cell: (s) => (
              <SpaceBetween direction="horizontal" size="xs">
                {s.status === 'pending_dispatch' && (
                  <Button variant="primary" onClick={() => { setDispatchTarget(s); setSelectedCarrier(recommend(s)); }}>
                    Dispatcher
                  </Button>
                )}
                {s.status === 'dispatched' && (
                  <Button variant="primary" onClick={() => advanceTicketStatus(s)}>
                    Marquer en transit
                  </Button>
                )}
                {s.status === 'in_transit' && (
                  <Button variant="primary" onClick={() => advanceTicketStatus(s)}>
                    Confirmer livraison
                  </Button>
                )}
                {s.cod_amount > 0 && !s.cod_reconciled && s.status === 'delivered' && (
                  <Button onClick={() => setReconcileTarget(s)}>Réconcilier COD</Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={paginated}
        loading={loading}
        loadingText="Chargement des expéditions…"
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune expédition</b>
          </Box>
        }
      />

      {/* ── PERFORMANCE TRANSPORTEURS ─────────────────────────────── */}
      <ExpandableSection headerText="Performance transporteurs" variant="container">
        <Table
          columnDefinitions={[
            { id: 'name', header: 'Transporteur', cell: (c) => c.name },
            { id: 'type', header: 'Type', cell: (c) => c.type === 'internal' ? <Badge color="green">Flotte interne</Badge> : <Badge color="blue">Externe</Badge> },
            { id: 'cold', header: 'Chaîne du froid', cell: (c) => c.cold_chain ? <StatusIndicator type="success">Oui</StatusIndicator> : <StatusIndicator type="stopped">Non</StatusIndicator> },
            { id: 'price', header: 'Tarif / kg', cell: (c) => c.type === 'internal' ? <Box color="text-status-success">Interne</Box> : `${c.price_per_kg} MAD` },
            { id: 'delay', header: 'Délai moyen', cell: (c) => `J+${c.avg_days}` },
            { id: 'regions', header: 'Zones', cell: (c) => c.regions.join(', ') },
          ]}
          items={carriers.filter((c) => c.type !== '3pl')}
          header={<Header variant="h3">Transporteurs disponibles</Header>}
        />
      </ExpandableSection>

      {/* ── MODAL DISPATCH ────────────────────────────────────────── */}
      {dispatchTarget && (
        <Modal
          visible
          size="large"
          header={`Organiser la livraison — ${dispatchTarget.order_number}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => { setDispatchTarget(null); setSelectedCarrier(null); }}>Annuler</Button>
                <Button variant="primary" disabled={!selectedCarrier} loading={dispatching} onClick={confirmDispatch}>
                  Confirmer le dispatch
                </Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => { setDispatchTarget(null); setSelectedCarrier(null); }}
        >
          <SpaceBetween size="m">
            {/* Recommandation IA */}
            {rec && (
              <Alert type="info" header={`Recommandation IA : ${rec.name}`}>
                {dispatchTarget.is_cold && dispatchTarget.is_urgent
                  ? 'Produit réfrigéré urgent — transporteur avec chaîne du froid et livraison express.'
                  : dispatchTarget.is_cold
                  ? 'Produit réfrigéré — transporteur avec chaîne du froid requis.'
                  : dispatchTarget.is_urgent
                  ? 'Livraison urgente — transporteur express recommandé.'
                  : 'Livraison standard — transporteur économique recommandé.'}
              </Alert>
            )}

            <ColumnLayout columns={3}>
              <FormField label="Acheteur"><Box>{dispatchTarget.buyer}</Box></FormField>
              <FormField label="Destination"><Box>{dispatchTarget.city}</Box></FormField>
              <FormField label="Poids estimé"><Box>{dispatchTarget.weight_kg} kg</Box></FormField>
            </ColumnLayout>

            <Tabs
              tabs={[
                {
                  id: 'external',
                  label: 'Prestataire externe',
                  content: (
                    <SpaceBetween size="m">
                      <Table
                        columnDefinitions={[
                          { id: 'sel', header: '', cell: (c) => (
                            <input type="radio" name="carrier" checked={selectedCarrier?.id === c.id}
                              onChange={() => setSelectedCarrier(c)} />
                          ), width: 40 },
                          { id: 'name', header: 'Transporteur', cell: (c) => (
                            <SpaceBetween size="xxs">
                              <Box fontWeight="bold">{c.name}</Box>
                              {c.id === rec?.id && <Badge color="green">Recommandé IA</Badge>}
                            </SpaceBetween>
                          )},
                          { id: 'cold', header: 'Chaîne froid', cell: (c) => c.cold_chain ? '✓' : '—' },
                          { id: 'urgent', header: 'Express', cell: (c) => c.urgent ? '✓' : '—' },
                          { id: 'price', header: 'Coût estimé', cell: (c) => `${(c.price_per_kg * dispatchTarget.weight_kg).toFixed(0)} MAD` },
                          { id: 'delay', header: 'ETA', cell: (c) => `J+${c.avg_days} — ${etaFromDays(c.avg_days)}` },
                        ]}
                        items={carriers.filter((c) => c.type === 'external').filter((c) =>
                          !dispatchTarget.is_cold || c.cold_chain
                        )}
                        selectionType="single"
                      />
                      <FormField label="N° de suivi (optionnel — généré auto si vide)">
                        <Input value={manualTracking} onChange={({ detail }) => setManualTracking(detail.value)} placeholder="Ex: AMN-12345" />
                      </FormField>
                    </SpaceBetween>
                  ),
                },
                {
                  id: 'internal',
                  label: 'Flotte interne',
                  content: (
                    <Table
                      columnDefinitions={[
                        { id: 'sel', header: '', cell: (c) => (
                          <input type="radio" name="carrier" checked={selectedCarrier?.id === c.id}
                            onChange={() => setSelectedCarrier(c)} />
                        ), width: 40 },
                        { id: 'name', header: 'Chauffeur', cell: (c) => c.driver_name ?? c.name },
                        { id: 'vehicle', header: 'Véhicule', cell: (c) => c.vehicle ?? '—' },
                        { id: 'cold', header: 'Réfrigéré', cell: (c) => c.cold_chain ? '✓' : '—' },
                        { id: 'phone', header: 'Téléphone', cell: (c) => c.phone ?? '—' },
                      ]}
                      items={carriers.filter((c) => c.type === 'internal').filter((c) =>
                        !dispatchTarget.is_cold || c.cold_chain
                      )}
                    />
                  ),
                },
                {
                  id: '3pl',
                  label: 'Entreprise 3PL',
                  content: (
                    <SpaceBetween size="m">
                      <ColumnLayout columns={2}>
                        <FormField label="Nom du prestataire">
                          <Input value={manual3pl.name} onChange={({ detail }) => setManual3pl((p) => ({ ...p, name: detail.value }))} />
                        </FormField>
                        <FormField label="Téléphone contact">
                          <Input value={manual3pl.phone} onChange={({ detail }) => setManual3pl((p) => ({ ...p, phone: detail.value }))} />
                        </FormField>
                        <FormField label="N° de suivi">
                          <Input value={manual3pl.tracking} onChange={({ detail }) => setManual3pl((p) => ({ ...p, tracking: detail.value }))} />
                        </FormField>
                        <FormField label="ETA (AAAA-MM-JJ)">
                          <Input value={manual3pl.eta} placeholder="2025-01-15" onChange={({ detail }) => setManual3pl((p) => ({ ...p, eta: detail.value }))} />
                        </FormField>
                      </ColumnLayout>
                    </SpaceBetween>
                  ),
                },
              ]}
            />
          </SpaceBetween>
        </Modal>
      )}

      {/* ── MODAL RÉCONCILIATION COD ──────────────────────────────── */}
      {reconcileTarget && (
        <Modal
          visible
          header={`Réconciliation COD — ${reconcileTarget.order_number}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setReconcileTarget(null)}>Annuler</Button>
                <Button variant="primary" onClick={() => reconcileCOD(reconcileTarget.id)}>
                  Confirmer la remise d'espèces
                </Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setReconcileTarget(null)}
        >
          <SpaceBetween size="m">
            <Alert type="info">
              Confirmez la réception de <strong>{reconcileTarget.cod_amount.toLocaleString('fr-MA')} MAD</strong> en espèces du transporteur <strong>{reconcileTarget.carrier_name}</strong>.
            </Alert>
            <ColumnLayout columns={2}>
              <FormField label="Acheteur"><Box>{reconcileTarget.buyer}</Box></FormField>
              <FormField label="Montant COD"><Box fontWeight="bold">{reconcileTarget.cod_amount.toLocaleString('fr-MA')} MAD</Box></FormField>
            </ColumnLayout>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
