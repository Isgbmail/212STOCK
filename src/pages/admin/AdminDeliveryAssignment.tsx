import { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Header, SpaceBetween, StatusIndicator,
  Table, TextFilter, Select, Modal, ColumnLayout,
  Badge, Flashbar, Spinner, Input, Textarea,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingTicket {
  id: string;
  ticket_number: string;
  status: string;
  priority: string;
  pickup_address: Record<string, string>;
  delivery_address: Record<string, string>;
  parcel_details: Record<string, unknown>;
  window_start: string | null;
  window_end: string | null;
  proposed_price: number | null;
  created_at: string;
  delivery_method: string;
  // Joined
  buyer_name: string;
  seller_name: string;
  order_number: string;
  order_id: string | null;
  // Needs
  requires_cold: boolean;
  delivery_pref: string;
}

interface DeliveryActor {
  id: string;          // organisation.id
  name: string;
  delivery_type: string;
  avg_rating: number | null;
  base_rate: number | null;
  zones: string[];
  cold_chain: boolean;
  max_weight_kg: number | null;
}

const PRIORITY_COLOR: Record<string, 'red' | 'blue' | 'grey'> = {
  express: 'red',
  normal: 'blue',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'En attente',
  assigned: 'Assigné',
  picked_up: 'Enlevé',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

const METHOD_LABEL: Record<string, string> = {
  stock212: 'Stock212 (plateforme)',
  partner_carrier: 'Transporteur partenaire',
  seller_fleet: 'Flotte vendeur',
  buyer_managed: 'Géré par acheteur',
};

function addrLine(a: Record<string, string> | null): string {
  if (!a) return '—';
  return [a.line1, a.city, a.postal_code].filter(Boolean).join(', ') || '—';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDeliveryAssignment() {
  const [tickets, setTickets] = useState<PendingTicket[]>([]);
  const [actors, setActors] = useState<DeliveryActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  const [selected, setSelected] = useState<PendingTicket | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState('');
  const [acceptedPrice, setAcceptedPrice] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Load tickets ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);

    // Delivery tickets with order + org join
    type RawTicket = {
      id: string; ticket_number: string; status: string; priority: string;
      pickup_address: Record<string, string>; delivery_address: Record<string, string>;
      parcel_details: Record<string, unknown>;
      window_start: string | null; window_end: string | null;
      proposed_price: number | null; created_at: string;
      orders: {
        id: string; order_number: string; delivery_method: string; delivery_preference: string;
        buyer_org: { name: string } | null;
        seller_org: { name: string } | null;
      } | null;
    };

    const { data: rawTickets } = await supabase
      .from('delivery_tickets')
      .select(`
        id, ticket_number, status, priority,
        pickup_address, delivery_address, parcel_details,
        window_start, window_end, proposed_price, created_at,
        orders(
          id, order_number, delivery_method, delivery_preference,
          buyer_org:buyer_org_id(name),
          seller_org:seller_org_id(name)
        )
      `)
      .in('status', statusFilter === 'all' ? ['open', 'assigned', 'picked_up', 'in_transit'] : [statusFilter])
      .is('assigned_delivery_id', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    const mapped: PendingTicket[] = (rawTickets ?? []).map((t: RawTicket) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      status: t.status,
      priority: t.priority,
      pickup_address: t.pickup_address,
      delivery_address: t.delivery_address,
      parcel_details: t.parcel_details ?? {},
      window_start: t.window_start,
      window_end: t.window_end,
      proposed_price: t.proposed_price,
      created_at: t.created_at,
      order_id: t.orders?.id ?? null,
      order_number: t.orders?.order_number ?? '—',
      delivery_method: t.orders?.delivery_method ?? 'stock212',
      delivery_pref: t.orders?.delivery_preference ?? 'standard',
      buyer_name: (t.orders?.buyer_org as { name: string } | null)?.name ?? '—',
      seller_name: (t.orders?.seller_org as { name: string } | null)?.name ?? '—',
      requires_cold: t.orders?.delivery_preference === 'cold_chain',
    }));

    setTickets(mapped);
    setLoading(false);
  }, [statusFilter]);

  // ── Load validated delivery actors ──────────────────────────────────────────

  const loadActors = useCallback(async () => {
    type RawActor = {
      organisation_id: string;
      avg_rating: number | null;
      base_rate: number | null;
      delivery_type: string;
      organisations: { name: string } | null;
      delivery_capabilities: { cold_chain: boolean; max_weight_kg: number | null }[] | null;
      delivery_zones: { region: string }[] | null;
    };

    const { data } = await supabase
      .from('delivery_profiles')
      .select(`
        organisation_id, avg_rating, base_rate, delivery_type,
        organisations(name),
        delivery_capabilities(cold_chain, max_weight_kg),
        delivery_zones(region)
      `)
      .eq('validation_status', 'validated');

    const list: DeliveryActor[] = (data ?? []).map((a: RawActor) => ({
      id: a.organisation_id,
      name: (a.organisations as { name: string } | null)?.name ?? '—',
      delivery_type: a.delivery_type ?? 'independent',
      avg_rating: a.avg_rating,
      base_rate: a.base_rate,
      zones: (a.delivery_zones ?? []).map((z) => z.region),
      cold_chain: (a.delivery_capabilities ?? []).some((c) => c.cold_chain),
      max_weight_kg: (a.delivery_capabilities ?? [])[0]?.max_weight_kg ?? null,
    }));

    setActors(list);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadActors(); }, [loadActors]);

  // ── Assign action ───────────────────────────────────────────────────────────

  async function handleAssign() {
    if (!selected || !selectedActorId) return;
    setAssigning(true);
    const price = parseFloat(acceptedPrice) || selected.proposed_price || 0;

    const mergedParcel = {
      ...(selected.parcel_details ?? {}),
      ...(assignNote ? { internal_note: assignNote } : {}),
    };

    const { error } = await supabase
      .from('delivery_tickets')
      .update({
        assigned_delivery_id: selectedActorId,
        status:               'assigned',
        assigned_at:          new Date().toISOString(),
        accepted_price:       price || null,
        parcel_details:       mergedParcel,
      })
      .eq('id', selected.id);

    if (error) {
      setFlash({ type: 'error', msg: `Erreur : ${error.message}` });
    } else {
      setFlash({ type: 'success', msg: `Ticket ${selected.ticket_number} assigné avec succès.` });
      setAssignModalOpen(false);
      setSelected(null);
      setSelectedActorId('');
      setAcceptedPrice('');
      setAssignNote('');
      await load();
    }
    setAssigning(false);
  }

  // ── Filtered tickets ─────────────────────────────────────────────────────────

  const filtered = tickets.filter((t) =>
    !filter ||
    t.ticket_number.toLowerCase().includes(filter.toLowerCase()) ||
    t.buyer_name.toLowerCase().includes(filter.toLowerCase()) ||
    t.seller_name.toLowerCase().includes(filter.toLowerCase()) ||
    t.order_number.toLowerCase().includes(filter.toLowerCase())
  );

  // ── Filtered actors for assignment ──────────────────────────────────────────

  const suitableActors = selected
    ? actors.filter((a) =>
        (!selected.requires_cold || a.cold_chain) &&
        (a.zones.length === 0 || a.zones.some((z) =>
          addrLine(selected.delivery_address).toLowerCase().includes(z.toLowerCase())
        ))
      )
    : actors;

  return (
    <Box>
      {flash && (
        <Box mb={3}>
          <Flashbar
            items={[{
              type: flash.type,
              content: flash.msg,
              dismissible: true,
              onDismiss: () => setFlash(null),
              id: 'flash',
            }]}
          />
        </Box>
      )}

      <Table
        header={
          <Header
            counter={`(${filtered.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Select
                  selectedOption={{ value: statusFilter, label: statusFilter === 'all' ? 'Tous les statuts' : STATUS_LABEL[statusFilter] ?? statusFilter }}
                  onChange={({ detail }) => setStatusFilter(detail.selectedOption.value ?? 'open')}
                  options={[
                    { value: 'open', label: 'En attente' },
                    { value: 'assigned', label: 'Assignés' },
                    { value: 'all', label: 'Tous' },
                  ]}
                />
                <Button onClick={load} iconName="refresh">Actualiser</Button>
              </SpaceBetween>
            }
            description="Tickets de livraison sans livreur affecté — assignez un partenaire validé"
          >
            Affectation des livraisons
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filter}
            onChange={({ detail }) => setFilter(detail.filteringText)}
            filteringPlaceholder="Rechercher ticket, acheteur, vendeur…"
          />
        }
        loading={loading}
        loadingText="Chargement des tickets…"
        empty="Aucun ticket en attente d'affectation"
        selectionType="single"
        selectedItems={selected ? [selected] : []}
        onSelectionChange={({ detail }) => setSelected((detail.selectedItems[0] as PendingTicket) ?? null)}
        columnDefinitions={[
          {
            id: 'ticket',
            header: 'Ticket',
            cell: (t) => (
              <Box>
                <Box fontWeight="bold" fontSize="sm">{t.ticket_number}</Box>
                <Badge color={PRIORITY_COLOR[t.priority] ?? 'grey'}>
                  {t.priority === 'express' ? 'Express' : 'Normal'}
                </Badge>
              </Box>
            ),
            width: 130,
          },
          {
            id: 'order',
            header: 'Commande',
            cell: (t) => (
              <Box>
                <Box fontSize="sm">{t.order_number}</Box>
                <Box fontSize="xs" color="#687078">{METHOD_LABEL[t.delivery_method] ?? t.delivery_method}</Box>
              </Box>
            ),
          },
          {
            id: 'parties',
            header: 'Acheteur → Vendeur',
            cell: (t) => (
              <Box>
                <Box fontSize="sm" fontWeight="600">{t.buyer_name}</Box>
                <Box fontSize="xs" color="#687078">depuis {t.seller_name}</Box>
              </Box>
            ),
          },
          {
            id: 'pref',
            header: 'Service',
            cell: (t) => (
              <Box>
                <StatusIndicator type={t.delivery_pref === 'cold_chain' ? 'warning' : t.delivery_pref === 'express' ? 'in-progress' : 'success'}>
                  {t.delivery_pref === 'cold_chain' ? 'Froid' : t.delivery_pref === 'express' ? 'Express' : 'Standard'}
                </StatusIndicator>
              </Box>
            ),
            width: 110,
          },
          {
            id: 'addresses',
            header: 'Enlèvement → Livraison',
            cell: (t) => (
              <Box>
                <Box fontSize="xs">{addrLine(t.pickup_address)}</Box>
                <Box fontSize="xs" color="#687078">{addrLine(t.delivery_address)}</Box>
              </Box>
            ),
          },
          {
            id: 'window',
            header: 'Créneau',
            cell: (t) => t.window_start
              ? new Date(t.window_start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '—',
            width: 110,
          },
          {
            id: 'created',
            header: 'Créé le',
            cell: (t) => new Date(t.created_at).toLocaleDateString('fr-FR'),
            width: 90,
          },
          {
            id: 'action',
            header: 'Action',
            cell: (t) => (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setSelected(t); setAssignModalOpen(true); }}
                iconName="user-profile"
              >
                Affecter
              </Button>
            ),
            width: 110,
          },
        ]}
        items={filtered}
      />

      {/* ── Assignment modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={assignModalOpen}
        onDismiss={() => setAssignModalOpen(false)}
        header={`Affecter un livreur — ${selected?.ticket_number}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setAssignModalOpen(false)}>Annuler</Button>
              <Button
                variant="primary"
                disabled={!selectedActorId || assigning}
                onClick={handleAssign}
                loading={assigning}
                loadingText="Affectation…"
              >
                Confirmer l'affectation
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {selected && (
          <SpaceBetween size="l">
            {/* Ticket summary */}
            <ColumnLayout columns={3} borders="vertical">
              <Box>
                <Box fontSize="xs" color="#687078" mb={1}>COMMANDE</Box>
                <Box fontWeight="bold">{selected.order_number}</Box>
                <Box fontSize="xs">{selected.buyer_name} → {selected.seller_name}</Box>
              </Box>
              <Box>
                <Box fontSize="xs" color="#687078" mb={1}>ENLÈVEMENT</Box>
                <Box fontSize="sm">{addrLine(selected.pickup_address)}</Box>
              </Box>
              <Box>
                <Box fontSize="xs" color="#687078" mb={1}>LIVRAISON</Box>
                <Box fontSize="sm">{addrLine(selected.delivery_address)}</Box>
              </Box>
            </ColumnLayout>

            {/* Actor selection */}
            <Box>
              <Box fontSize="sm" fontWeight="bold" mb={2}>
                Partenaires disponibles ({suitableActors.length})
                {selected.requires_cold && (
                  <Badge color="red" style={{ marginLeft: 8 }}>Chaîne du froid requise</Badge>
                )}
              </Box>
              {suitableActors.length === 0 ? (
                <Box color="#be1c1c" fontSize="sm">
                  Aucun livreur validé ne correspond aux contraintes (zone / chaîne du froid).
                </Box>
              ) : (
                <Table
                  selectionType="single"
                  selectedItems={selectedActorId ? suitableActors.filter((a) => a.id === selectedActorId) : []}
                  onSelectionChange={({ detail }) => {
                    const actor = detail.selectedItems[0] as DeliveryActor | undefined;
                    if (actor) setSelectedActorId(actor.id);
                  }}
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: 'Livreur',
                      cell: (a) => (
                        <Box>
                          <Box fontWeight="600" fontSize="sm">{a.name}</Box>
                          <Box fontSize="xs" color="#687078">{a.delivery_type === 'logistics_company' ? 'Société 3PL' : 'Indépendant'}</Box>
                        </Box>
                      ),
                    },
                    {
                      id: 'rating',
                      header: 'Note',
                      cell: (a) => a.avg_rating ? `${a.avg_rating.toFixed(1)} / 5` : '—',
                      width: 80,
                    },
                    {
                      id: 'rate',
                      header: 'Tarif de base',
                      cell: (a) => a.base_rate ? `${a.base_rate.toFixed(0)} MAD` : '—',
                      width: 110,
                    },
                    {
                      id: 'caps',
                      header: 'Capacités',
                      cell: (a) => (
                        <SpaceBetween direction="horizontal" size="xxs">
                          {a.cold_chain && <Badge color="blue">Froid</Badge>}
                          {a.max_weight_kg && <Badge color="grey">{a.max_weight_kg} kg</Badge>}
                        </SpaceBetween>
                      ),
                    },
                    {
                      id: 'zones',
                      header: 'Zones',
                      cell: (a) => a.zones.slice(0, 3).join(', ') || 'Toutes',
                    },
                  ]}
                  items={suitableActors}
                />
              )}
            </Box>

            {/* Price + note */}
            <ColumnLayout columns={2}>
              <Box>
                <Box fontSize="sm" fontWeight="bold" mb={1}>Prix accepté (MAD)</Box>
                <Input
                  type="number"
                  value={acceptedPrice}
                  onChange={({ detail }) => setAcceptedPrice(detail.value)}
                  placeholder={selected.proposed_price ? `${selected.proposed_price} MAD (proposé)` : 'Saisir le montant'}
                />
              </Box>
              <Box>
                <Box fontSize="sm" fontWeight="bold" mb={1}>Note interne</Box>
                <Textarea
                  value={assignNote}
                  onChange={({ detail }) => setAssignNote(detail.value)}
                  placeholder="Instructions particulières…"
                  rows={2}
                />
              </Box>
            </ColumnLayout>
          </SpaceBetween>
        )}
      </Modal>
    </Box>
  );
}
