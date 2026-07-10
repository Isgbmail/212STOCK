import { useEffect, useState, useRef } from 'react';
import {
  Table,
  Header,
  Button,
  SpaceBetween,
  StatusIndicator,
  TextFilter,
  Pagination,
  Box,
  Select,
  Link,
  Modal,
  Alert,
  ColumnLayout,
  Tabs,
  Input,
  FormField,
  Flashbar,
  Badge,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  type Carrier,
  ORDER_STATUS_LABELS as STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS as STATUS_TRANSITIONS,
  orderStatusType as statusType,
  RETURN_REASON_LABELS,
  RETURN_REFUND_LABELS,
  RETURN_STATUS_LABELS,
  returnStatusType,
} from '../../lib/vendorUtils';
import { routeDelivery, DELIVERY_METHOD_LABELS } from '../../hooks/useDeliveryRouter';
import {
  generateBonCommandePDF, generateBonLivraisonFromOrderPDF,
  generateBonRetourPDF, generatePVReceptionPDF, generateInvoicePDF,
} from '../../lib/pdf/pdfUtils';
import type { Order, OrderLine } from '../../types';

interface OrderReturn {
  id: string;
  return_number: string;
  order_id: string;
  reason: string;
  refund_type: string;
  status: string;
  requested_at: string;
  return_lines?: { id: string }[];
}

export default function VendorOrders() {
  const { activeOrg, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [showDispatch, setShowDispatch] = useState(false);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [manualTracking, setManualTracking] = useState('');
  const [manual3pl, setManual3pl] = useState({ name: '', phone: '', tracking: '', eta: '' });
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [globalStats, setGlobalStats] = useState({ pending: 0, inDelivery: 0, caDelivered: 0 });
  const [flashItems, setFlashItems] = useState<{ type: 'success' | 'error'; content: string; id: string }[]>([]);
  const [newOrderBadge, setNewOrderBadge] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pageSize = 20;

  async function fetchOrders() {
    if (!activeOrg) return;
    setLoading(true);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    let pageQuery = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('seller_org_id', activeOrg.id)
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    if (filterText) pageQuery = pageQuery.ilike('order_number', `%${filterText}%`);
    if (statusFilter) pageQuery = pageQuery.eq('status', statusFilter);

    const [pageRes, pendingRes, inDeliveryRes, caRes] = await Promise.all([
      pageQuery,
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_org_id', activeOrg.id).eq('status', 'pending'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_org_id', activeOrg.id).in('status', ['shipped', 'in_preparation']),
      supabase.from('orders').select('total_ttc').eq('seller_org_id', activeOrg.id).eq('status', 'delivered').gte('created_at', monthStart),
    ]);

    setOrders((pageRes.data as Order[]) ?? []);
    setTotalPages(Math.ceil((pageRes.count ?? 0) / pageSize));
    setGlobalStats({
      pending: pendingRes.count ?? 0,
      inDelivery: inDeliveryRes.count ?? 0,
      caDelivered: ((caRes.data ?? []) as { total_ttc: number }[]).reduce((s, o) => s + o.total_ttc, 0),
    });
    setNewOrderBadge(false);
    setLoading(false);
  }

  async function fetchOrderLines(orderId: string) {
    setLinesLoading(true);
    const { data } = await supabase
      .from('order_lines')
      .select('*, products(name, ean)')
      .eq('order_id', orderId)
      .order('created_at');
    setOrderLines((data as OrderLine[]) ?? []);
    setLinesLoading(false);
  }

  async function fetchReturns(orderId: string) {
    setReturnsLoading(true);
    const { data } = await supabase
      .from('order_returns')
      .select('*, return_lines(*)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    setReturns(data ?? []);
    setReturnsLoading(false);
  }

  useEffect(() => { fetchOrders(); }, [activeOrg, currentPage, filterText, statusFilter]);

  useEffect(() => {
    supabase.from('carriers').select('*').eq('active', true).order('type').order('name')
      .then(({ data }) => {
        const list = (data ?? []) as Carrier[];
        setCarriers(list);
        if (list.length > 0 && !selectedCarrierId) setSelectedCarrierId(list[0].id);
      });
  }, []);

  // Realtime subscription — notify when new pending orders arrive
  useEffect(() => {
    if (!activeOrg) return;
    const channel = supabase
      .channel(`vendor-orders-${activeOrg.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `seller_org_id=eq.${activeOrg.id}`,
        },
        () => {
          setNewOrderBadge(true);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [activeOrg]);

  function openOrderModal(order: Order) {
    setSelectedOrder(order);
    setUpdateError('');
    setReturns([]);
    fetchOrderLines(order.id);
    fetchReturns(order.id);
  }

  async function handleStatusUpdate(order: Order, newStatus: string) {
    setUpdatingStatus(true);
    setUpdateError('');
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    if (error) {
      setUpdateError(error.message);
      setUpdatingStatus(false);
      return;
    }

    // When seller confirms → auto-route delivery ticket
    if (newStatus === 'confirmed' && user) {
      const { error: routeErr } = await routeDelivery(
        {
          id:                  order.id,
          order_number:        order.order_number,
          seller_org_id:       order.seller_org_id,
          delivery_method:     order.delivery_method ?? 'stock212',
          carrier_org_id:      order.carrier_org_id ?? null,
          delivery_address:    order.delivery_address,
          delivery_preference: order.delivery_preference,
        },
        user.id
      );
      if (routeErr) {
        setFlashItems([{ type: 'error', content: `Commande confirmée mais erreur ticket : ${routeErr.message}`, id: Date.now().toString() }]);
      } else {
        const method = order.delivery_method ?? 'stock212';
        const methodLabel = DELIVERY_METHOD_LABELS[method as keyof typeof DELIVERY_METHOD_LABELS]?.label ?? method;
        setFlashItems([{
          type: 'success',
          content: `Commande ${order.order_number} confirmée — ticket de livraison créé (${methodLabel}).`,
          id: Date.now().toString(),
        }]);
      }
    }

    setSelectedOrder(null);
    fetchOrders();
    setUpdatingStatus(false);
  }

  const { pending: pendingCount, inDelivery: shippedCount, caDelivered } = globalStats;

  async function confirmDispatch() {
    if (!selectedOrder || !activeOrg) return;
    setDispatchLoading(true);

    const carrier = carriers.find((c) => c.id === selectedCarrierId);
    const trackingRef = manualTracking || `TKT-${Date.now().toString(36).toUpperCase()}`;
    const deliveryPref = selectedOrder.delivery_preference;
    const priority: 'normal' | 'express' = deliveryPref === 'express' ? 'express' : 'normal';

    const parcelDetails = carrier?.type === 'internal'
      ? { carrier_type: 'internal', driver_name: carrier.driver_name ?? carrier.name, vehicle: carrier.vehicle ?? '', phone: carrier.phone ?? '', tracking_ref: trackingRef, cold_chain: carrier.cold_chain ?? false }
      : manual3pl.name
        ? { carrier_type: '3pl', name: manual3pl.name, phone: manual3pl.phone, tracking_ref: manual3pl.tracking || trackingRef, eta: manual3pl.eta }
        : { carrier_type: 'external', carrier_name: carrier?.name ?? '', tracking_ref: trackingRef, eta: carrier?.avg_days ? `J+${carrier.avg_days}` : '', cold_chain: carrier?.cold_chain ?? false };

    const pickupAddress = { line1: 'Entrepôt vendeur', city: 'Casablanca', country: 'MA' };
    const deliveryAddress = selectedOrder.delivery_address ?? {};

    // Update the existing delivery ticket (created by routeDelivery at confirmation)
    // with carrier/tracking info — do NOT create a duplicate ticket.
    const { data: existingTicket, error: fetchErr } = await supabase
      .from('delivery_tickets')
      .select('id, parcel_details')
      .eq('order_id', selectedOrder.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !existingTicket) {
      setFlashItems([{ type: 'error', content: 'Ticket de livraison introuvable pour cette commande.', id: Date.now().toString() }]);
      setDispatchLoading(false);
      return;
    }

    const mergedParcel = { ...(existingTicket.parcel_details as Record<string, unknown>), ...parcelDetails };
    const { error: ticketErr } = await supabase
      .from('delivery_tickets')
      .update({
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        parcel_details: mergedParcel,
        priority,
      })
      .eq('id', existingTicket.id);

    if (ticketErr) {
      setFlashItems([{ type: 'error', content: `Erreur ticket : ${ticketErr.message}`, id: Date.now().toString() }]);
      setDispatchLoading(false);
      return;
    }

    // Move order to in_preparation
    await supabase
      .from('orders')
      .update({ status: 'in_preparation', updated_at: new Date().toISOString() })
      .eq('id', selectedOrder.id);

    setFlashItems([{ type: 'success', content: `Ticket de livraison créé — commande ${selectedOrder.order_number} en préparation.`, id: Date.now().toString() }]);
    setShowDispatch(false);
    setSelectedOrder(null);
    setManualTracking('');
    setManual3pl({ name: '', phone: '', tracking: '', eta: '' });
    fetchOrders();
    setDispatchLoading(false);
  }

  return (
    <SpaceBetween size="l">

      {flashItems.length > 0 && (
        <Flashbar
          items={flashItems.map((f) => ({
            type: f.type,
            content: f.content,
            id: f.id,
            dismissible: true,
            onDismiss: () => setFlashItems((prev) => prev.filter((x) => x.id !== f.id)),
          }))}
        />
      )}

      {/* ── ALERTE COMMANDES EN ATTENTE ───────────────────────────── */}
      {pendingCount > 0 && (
        <Alert
          type="error"
          header={`${pendingCount} commande${pendingCount > 1 ? 's' : ''} en attente — délai max 2h`}
          action={<Button onClick={() => setStatusFilter('pending')}>Voir les commandes</Button>}
        >
          Confirmez ou refusez ces commandes rapidement pour maintenir votre taux d'acceptation.
        </Alert>
      )}

      {newOrderBadge && (
        <Alert
          type="info"
          header="Nouvelle commande reçue"
          action={<Button onClick={fetchOrders}>Actualiser</Button>}
        >
          Une nouvelle commande vient d'arriver. Cliquez sur Actualiser pour la voir.
        </Alert>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <ColumnLayout columns={4} variant="text-grid">
        <Box>
          <Box variant="awsui-key-label">Total commandes</Box>
          <Box variant="h1">{loading ? '—' : orders.length}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">En attente</Box>
          <Box variant="h1" color={pendingCount > 0 ? 'text-status-error' : 'text-status-success'}>
            {loading ? '—' : pendingCount}
          </Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">En livraison</Box>
          <Box variant="h1">{loading ? '—' : shippedCount}</Box>
        </Box>
        <Box>
          <Box variant="awsui-key-label">CA livré ce mois</Box>
          <Box variant="h1" color="text-status-success">
            {loading ? '—' : `${caDelivered.toFixed(0)} €`}
          </Box>
        </Box>
      </ColumnLayout>

      <Table
        header={
          <Header variant="h1" counter={`(${orders.length})`}>
            Gestion des commandes
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="N° de commande..."
              onChange={({ detail }) => { setFilterText(detail.filteringText); setCurrentPage(1); }}
            />
            <Select
              selectedOption={statusFilter ? { value: statusFilter, label: STATUS_LABELS[statusFilter] } : { value: '', label: 'Tous les statuts' }}
              onChange={({ detail }) => { setStatusFilter(detail.selectedOption.value ?? ''); setCurrentPage(1); }}
              options={[
                { value: '', label: 'Tous les statuts' },
                ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
              ]}
              placeholder="Filtrer par statut"
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        loading={loading}
        loadingText="Chargement des commandes..."
        trackBy="id"
        items={orders}
        columnDefinitions={[
          {
            id: 'number',
            header: 'N° Commande',
            cell: (o: Order) => (
              <Link onFollow={() => openOrderModal(o)}>{o.order_number}</Link>
            ),
          },
          {
            id: 'date',
            header: 'Date',
            cell: (o: Order) => new Date(o.created_at).toLocaleDateString('fr-FR'),
          },
          {
            id: 'lines',
            header: 'Articles',
            cell: (o: Order) => (o.order_lines?.length ?? '—'),
          },
          {
            id: 'total_ht',
            header: 'Total HT',
            cell: (o: Order) => `${o.total_ht.toFixed(2)} ${o.currency}`,
          },
          {
            id: 'total_ttc',
            header: 'Total TTC',
            cell: (o: Order) => `${o.total_ttc.toFixed(2)} ${o.currency}`,
          },
          {
            id: 'delivery',
            header: 'Service',
            cell: (o: Order) => (
              <Badge color={o.delivery_preference === 'express' ? 'red' : o.delivery_preference === 'cold_chain' ? 'blue' : 'grey'}>
                {o.delivery_preference === 'express' ? 'Express' : o.delivery_preference === 'cold_chain' ? 'Froid' : 'Standard'}
              </Badge>
            ),
          },
          {
            id: 'delivery_method',
            header: 'Opérateur',
            cell: (o: Order) => {
              const method = (o.delivery_method ?? 'stock212') as keyof typeof DELIVERY_METHOD_LABELS;
              const meta = DELIVERY_METHOD_LABELS[method];
              const colorMap: Record<string, string> = {
                partner_carrier: 'blue',
                stock212:        'green',
                seller_fleet:    'grey',
                buyer_managed:   'severity-low',
              };
              return (
                <Badge color={colorMap[method] ?? 'grey'}>
                  {meta?.icon} {meta?.label ?? method}
                </Badge>
              );
            },
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (o: Order) => (
              <StatusIndicator type={statusType(o.status)}>
                {STATUS_LABELS[o.status] ?? o.status}
              </StatusIndicator>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (o: Order) => (
              <Button
                variant="inline-link"
                onClick={() => openOrderModal(o)}
              >
                Gérer
              </Button>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune commande</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Les commandes de vos acheteurs apparaîtront ici.
            </Box>
          </Box>
        }
      />

      {/* ── MODAL DÉTAIL COMMANDE ─────────────────────────────────── */}
      {selectedOrder && !showDispatch && (
        <Modal
          visible
          onDismiss={() => setSelectedOrder(null)}
          header={`Commande ${selectedOrder.order_number}`}
          size="large"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setSelectedOrder(null)}>Fermer</Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="l">
            {updateError && <Alert type="error">{updateError}</Alert>}

            {/* Bon de préparation + dispatch */}
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                iconName="download"
                loading={pdfLoading}
                onClick={async () => {
                  if (!selectedOrder) return;
                  setPdfLoading(true);
                  try { await generateBonCommandePDF(selectedOrder.id); }
                  catch (e) { setFlashItems([{ type: 'error', content: `PDF : ${e instanceof Error ? e.message : 'Erreur'}`, id: Date.now().toString() }]); }
                  finally { setPdfLoading(false); }
                }}
              >
                Bon de commande
              </Button>
              {['in_preparation', 'shipped', 'delivered'].includes(selectedOrder.status) && (
                <Button
                  iconName="download"
                  loading={pdfLoading}
                  onClick={async () => {
                    if (!selectedOrder) return;
                    setPdfLoading(true);
                    try { await generateBonLivraisonFromOrderPDF(selectedOrder.id); }
                    catch (e) { setFlashItems([{ type: 'error', content: `BL : ${e instanceof Error ? e.message : 'Erreur'}`, id: Date.now().toString() }]); }
                    finally { setPdfLoading(false); }
                  }}
                >
                  Bon de livraison
                </Button>
              )}
              {/* Émettre / télécharger la facture */}
              {['confirmed', 'in_preparation', 'shipped', 'delivered'].includes(selectedOrder.status) && (
                <Button
                  iconName="file"
                  loading={invoiceLoading}
                  onClick={async () => {
                    if (!selectedOrder) return;
                    setInvoiceLoading(true);
                    try {
                      // Chercher une facture existante pour cette commande
                      const { data: existing } = await supabase
                        .from('invoices')
                        .select('id')
                        .eq('order_id', selectedOrder.id)
                        .maybeSingle();

                      let invoiceId: string;
                      if (existing) {
                        invoiceId = (existing as { id: string }).id;
                      } else {
                        // Créer la facture
                        const invoiceNumber = `FACT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selectedOrder.order_number ?? selectedOrder.id.slice(0, 6).toUpperCase()}`;
                        const issuedAt = new Date().toISOString().slice(0, 10);
                        const termDays = parseInt(selectedOrder.payment_terms ?? '30', 10);
                        const dueAt = new Date(Date.now() + (isNaN(termDays) ? 30 : termDays) * 86400000).toISOString().slice(0, 10);
                        const totalHt = Number(selectedOrder.total_ht ?? 0);
                        const totalTtc = Number(selectedOrder.total_ttc ?? 0);

                        const { data: created, error } = await supabase
                          .from('invoices')
                          .insert({
                            order_id: selectedOrder.id,
                            invoice_number: invoiceNumber,
                            issued_at: issuedAt,
                            due_at: dueAt,
                            status: 'pending',
                            amount_ht: totalHt,
                            amount_tax: totalTtc - totalHt,
                            amount_ttc: totalTtc,
                            amount_paid: 0,
                          })
                          .select('id')
                          .single();

                        if (error) throw new Error(error.message);
                        invoiceId = (created as { id: string }).id;
                      }
                      await generateInvoicePDF(invoiceId);
                    } catch (e) {
                      setFlashItems([{ type: 'error', content: `Facture : ${e instanceof Error ? e.message : 'Erreur'}`, id: Date.now().toString() }]);
                    } finally {
                      setInvoiceLoading(false);
                    }
                  }}
                >
                  Émettre la facture
                </Button>
              )}

              {/* Dispatch button — only for seller_fleet (partner/stock212 auto-routed, buyer_managed = buyer handles) */}
              {['confirmed', 'in_preparation'].includes(selectedOrder.status) &&
               (selectedOrder.delivery_method ?? 'stock212') === 'seller_fleet' && (
                <Button variant="primary" onClick={() => setShowDispatch(true)}>
                  Assigner un chauffeur
                </Button>
              )}
              {selectedOrder.status === 'confirmed' &&
               (selectedOrder.delivery_method ?? 'stock212') === 'stock212' && (
                <Alert type="info">
                  Ticket ouvert dans le réseau Stock212 — un livreur indépendant va prendre en charge votre commande.
                </Alert>
              )}
              {selectedOrder.status === 'confirmed' &&
               (selectedOrder.delivery_method ?? 'stock212') === 'partner_carrier' && (
                <Alert type="success">
                  Ticket envoyé au transporteur partenaire — il prendra contact pour organiser l'enlèvement.
                </Alert>
              )}
              {selectedOrder.status === 'confirmed' &&
               (selectedOrder.delivery_method ?? 'stock212') === 'buyer_managed' && (
                <Alert type="info">
                  L'acheteur gère sa propre livraison. Préparez la marchandise pour l'enlèvement.
                </Alert>
              )}
            </SpaceBetween>

            <ColumnLayout columns={3} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Statut actuel</Box>
                <StatusIndicator type={statusType(selectedOrder.status)}>
                  {STATUS_LABELS[selectedOrder.status]}
                </StatusIndicator>
              </div>
              <div>
                <Box variant="awsui-key-label">Total TTC</Box>
                <Box>{selectedOrder.total_ttc.toFixed(2)} {selectedOrder.currency}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Modalités de paiement</Box>
                <Box>{selectedOrder.payment_terms ?? '—'}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Niveau de service</Box>
                <Box>{selectedOrder.delivery_preference}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Opérateur de livraison</Box>
                <Box>
                  {(() => {
                    const method = (selectedOrder.delivery_method ?? 'stock212') as keyof typeof DELIVERY_METHOD_LABELS;
                    const meta = DELIVERY_METHOD_LABELS[method];
                    return `${meta?.icon ?? ''} ${meta?.label ?? method}`;
                  })()}
                </Box>
              </div>
              <div>
                <Box variant="awsui-key-label">Date de commande</Box>
                <Box>{new Date(selectedOrder.created_at).toLocaleString('fr-FR')}</Box>
              </div>
              {selectedOrder.notes && (
                <div>
                  <Box variant="awsui-key-label">Notes</Box>
                  <Box>{selectedOrder.notes}</Box>
                </div>
              )}
            </ColumnLayout>

            {/* Adresse de livraison */}
            {selectedOrder.delivery_address && Object.keys(selectedOrder.delivery_address).length > 0 && (
              <div>
                <Box variant="awsui-key-label">Adresse de livraison</Box>
                <Box>
                  {Object.values(selectedOrder.delivery_address).filter(Boolean).join(', ')}
                </Box>
              </div>
            )}

            {/* Lignes de commande */}
            <div>
              <Box variant="awsui-key-label" padding={{ bottom: 'xs' }}>Articles commandés</Box>
              <Table
                loading={linesLoading}
                loadingText="Chargement des articles..."
                trackBy="id"
                items={orderLines}
                columnDefinitions={[
                  {
                    id: 'product',
                    header: 'Produit',
                    cell: (l: OrderLine) => l.product_name_snap,
                  },
                  {
                    id: 'sku',
                    header: 'EAN',
                    cell: (l: OrderLine) => l.products?.ean ?? '—',
                  },
                  {
                    id: 'qty',
                    header: 'Qté',
                    cell: (l: OrderLine) => l.quantity,
                  },
                  {
                    id: 'unit',
                    header: 'PU HT',
                    cell: (l: OrderLine) => `${Number(l.unit_price_ht).toFixed(2)} ${selectedOrder.currency}`,
                  },
                  {
                    id: 'total',
                    header: 'Total HT',
                    cell: (l: OrderLine) => `${Number(l.line_total_ht).toFixed(2)} ${selectedOrder.currency}`,
                  },
                ]}
                empty={
                  <Box textAlign="center" color="inherit">
                    {linesLoading ? '' : 'Aucun article — commande créée avant mise à jour du système.'}
                  </Box>
                }
              />
            </div>

            {/* Status transitions */}
            {STATUS_TRANSITIONS[selectedOrder.status]?.length > 0 && (
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">Changer le statut</Box>
                <SpaceBetween direction="horizontal" size="xs">
                  {STATUS_TRANSITIONS[selectedOrder.status].map((next) => (
                    <Button
                      key={next}
                      variant={next === 'cancelled' ? 'normal' : 'primary'}
                      loading={updatingStatus}
                      onClick={() => handleStatusUpdate(selectedOrder, next)}
                    >
                      → {STATUS_LABELS[next]}
                    </Button>
                  ))}
                </SpaceBetween>
              </SpaceBetween>
            )}

            {/* Demandes de retour */}
            {(returnsLoading || returns.length > 0) && (
              <SpaceBetween size="s">
                <Box variant="awsui-key-label">
                  Demandes de retour ({returns.length})
                </Box>
                <Table
                  loading={returnsLoading}
                  loadingText="Chargement des retours..."
                  trackBy="id"
                  items={returns}
                  columnDefinitions={[
                    {
                      id: 'number',
                      header: 'Référence',
                      cell: (r: OrderReturn) => r.return_number,
                    },
                    {
                      id: 'reason',
                      header: 'Motif',
                      cell: (r: OrderReturn) => RETURN_REASON_LABELS[r.reason] ?? r.reason,
                    },
                    {
                      id: 'refund_type',
                      header: 'Traitement',
                      cell: (r: OrderReturn) => RETURN_REFUND_LABELS[r.refund_type] ?? r.refund_type,
                    },
                    {
                      id: 'status',
                      header: 'Statut',
                      cell: (r: OrderReturn) => (
                        <StatusIndicator type={returnStatusType(r.status)}>
                          {RETURN_STATUS_LABELS[r.status] ?? r.status}
                        </StatusIndicator>
                      ),
                    },
                    {
                      id: 'lines',
                      header: 'Articles',
                      cell: (r: OrderReturn) => r.return_lines?.length ?? '—',
                    },
                    {
                      id: 'date',
                      header: 'Date',
                      cell: (r: OrderReturn) => new Date(r.requested_at).toLocaleDateString('fr-FR'),
                    },
                    {
                      id: 'actions',
                      header: 'Documents',
                      cell: (r: OrderReturn) => (
                        <SpaceBetween direction="horizontal" size="xs">
                          <Button
                            iconName="download"
                            variant="inline-link"
                            onClick={async () => {
                              try { await generateBonRetourPDF(r.id); }
                              catch (e) { setFlashItems([{ type: 'error', content: `BRM : ${e instanceof Error ? e.message : 'Erreur'}`, id: Date.now().toString() }]); }
                            }}
                          >
                            BRM
                          </Button>
                          {['in_transit', 'received', 'completed'].includes(r.status) && (
                            <Button
                              iconName="download"
                              variant="inline-link"
                              onClick={async () => {
                                try { await generatePVReceptionPDF(r.id); }
                                catch (e) { setFlashItems([{ type: 'error', content: `PV : ${e instanceof Error ? e.message : 'Erreur'}`, id: Date.now().toString() }]); }
                              }}
                            >
                              PV Réception
                            </Button>
                          )}
                        </SpaceBetween>
                      ),
                    },
                  ]}
                  empty={
                    <Box textAlign="center" color="inherit">Aucun retour pour cette commande.</Box>
                  }
                />
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Modal>
      )}

      {/* ── MODAL DISPATCH ────────────────────────────────────────── */}
      {showDispatch && selectedOrder && (
        <Modal
          visible
          size="large"
          header={`Organiser la livraison — ${selectedOrder.order_number}`}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDispatch(false)}>Annuler</Button>
                <Button variant="primary" onClick={confirmDispatch} loading={dispatchLoading}>
                  Créer le ticket de livraison
                </Button>
              </SpaceBetween>
            </Box>
          }
          onDismiss={() => setShowDispatch(false)}
        >
          <SpaceBetween size="m">
            <Alert type="info" header="Préférence de livraison de l'acheteur">
              {selectedOrder.delivery_preference === 'express'
                ? 'Express — transporteur rapide recommandé.'
                : selectedOrder.delivery_preference === 'cold_chain'
                ? 'Chaîne du froid — camion frigorifique ATP obligatoire.'
                : 'Standard — transporteur économique recommandé.'}
            </Alert>

            <Tabs
              tabs={[
                {
                  id: 'external',
                  label: 'Prestataire externe',
                  content: (
                    <SpaceBetween size="m">
                      <Table
                        columnDefinitions={[
                          {
                            id: 'sel',
                            header: '',
                            cell: (c) => (
                              <input
                                type="radio"
                                name="carrier"
                                checked={selectedCarrierId === c.id}
                                onChange={() => setSelectedCarrierId(c.id)}
                              />
                            ),
                            width: 40,
                          },
                          { id: 'name',   header: 'Transporteur', cell: (c) => c.name },
                          { id: 'cold',   header: 'Chaîne froid', cell: (c) => c.cold_chain ? '✓' : '—' },
                          { id: 'urgent', header: 'Express',      cell: (c) => c.urgent ? '✓' : '—' },
                          { id: 'price',  header: 'Tarif / kg',   cell: (c) => c.price_per_kg ? `${c.price_per_kg} MAD` : 'Flotte' },
                          { id: 'delay',  header: 'ETA',          cell: (c) => `J+${c.avg_days}` },
                        ]}
                        items={carriers.filter((c) => c.type === 'external')}
                      />
                      <FormField label="N° de suivi (optionnel — généré auto si vide)">
                        <Input
                          value={manualTracking}
                          onChange={({ detail }) => setManualTracking(detail.value)}
                          placeholder="Ex: AMN-12345"
                        />
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
                        {
                          id: 'sel',
                          header: '',
                          cell: (d) => (
                            <input
                              type="radio"
                              name="carrier"
                              checked={selectedCarrierId === d.id}
                              onChange={() => setSelectedCarrierId(d.id)}
                            />
                          ),
                          width: 40,
                        },
                        { id: 'name',    header: 'Chauffeur',  cell: (d) => d.driver_name ?? d.name },
                        { id: 'vehicle', header: 'Véhicule',   cell: (d) => d.vehicle ?? '—' },
                        { id: 'cold',    header: 'Réfrigéré',  cell: (d) => d.cold_chain ? '✓' : '—' },
                        { id: 'phone',   header: 'Tél.',       cell: (d) => d.phone },
                      ]}
                      items={carriers.filter((c) => c.type === 'internal')}
                    />
                  ),
                },
                {
                  id: '3pl',
                  label: 'Entreprise 3PL',
                  content: (
                    <ColumnLayout columns={2}>
                      <FormField label="Nom prestataire">
                        <Input value={manual3pl.name} onChange={({ detail }) => setManual3pl((p) => ({ ...p, name: detail.value }))} />
                      </FormField>
                      <FormField label="Téléphone">
                        <Input value={manual3pl.phone} onChange={({ detail }) => setManual3pl((p) => ({ ...p, phone: detail.value }))} />
                      </FormField>
                      <FormField label="N° de suivi">
                        <Input value={manual3pl.tracking} onChange={({ detail }) => setManual3pl((p) => ({ ...p, tracking: detail.value }))} />
                      </FormField>
                      <FormField label="ETA (AAAA-MM-JJ)">
                        <Input value={manual3pl.eta} placeholder="2025-01-15" onChange={({ detail }) => setManual3pl((p) => ({ ...p, eta: detail.value }))} />
                      </FormField>
                    </ColumnLayout>
                  ),
                },
              ]}
            />
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}
