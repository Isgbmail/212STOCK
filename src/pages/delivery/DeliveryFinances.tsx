import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Container, ColumnLayout, Box, Table,
  Badge, DateRangePicker, Pagination,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface EarningRow {
  id: string;
  order_number: string | null;
  delivered_at: string | null;
  accepted_price: number | null;
  status: string;
}

export default function DeliveryFinances() {
  const { activeOrg } = useAuth();
  const [loading, setLoading]         = useState(true);
  const [rows, setRows]               = useState<EarningRow[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [pendingEarned, setPendingEarned] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const pageSize = 20;

  // Date range filter — null = all time
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);

  useEffect(() => {
    if (!activeOrg) return;
    async function load() {
      setLoading(true);

      let query = supabase
        .from('delivery_tickets')
        .select('id, accepted_price, status, delivered_at, orders(order_number)', { count: 'exact' })
        .eq('assigned_delivery_id', activeOrg!.id)
        .order('delivered_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (dateRange?.startDate) {
        query = query.gte('delivered_at', dateRange.startDate);
      }
      if (dateRange?.endDate) {
        query = query.lte('delivered_at', dateRange.endDate + 'T23:59:59');
      }

      const { data, count } = await query;
      const rawRows = (data ?? []) as Array<{
        id: string;
        accepted_price: number | null;
        status: string;
        delivered_at: string | null;
        orders: { order_number: string } | null;
      }>;

      const mapped: EarningRow[] = rawRows.map((t) => ({
        id:             t.id,
        order_number:   t.orders?.order_number ?? null,
        delivered_at:   t.delivered_at,
        accepted_price: t.accepted_price,
        status:         t.status,
      }));

      setRows(mapped);
      setTotalPages(Math.ceil((count ?? 0) / pageSize));

      // KPIs — independent from pagination: sum all tickets
      const { data: allTickets } = await supabase
        .from('delivery_tickets')
        .select('accepted_price, status')
        .eq('assigned_delivery_id', activeOrg!.id)
        .in('status', ['delivered', 'in_transit', 'picked_up']);

      if (allTickets) {
        const all = allTickets as Array<{ accepted_price: number | null; status: string }>;
        setTotalEarned(
          all.filter((t) => t.status === 'delivered').reduce((s, t) => s + (t.accepted_price ?? 0), 0)
        );
        setPendingEarned(
          all.filter((t) => t.status !== 'delivered').reduce((s, t) => s + (t.accepted_price ?? 0), 0)
        );
      }

      setLoading(false);
    }
    load();
  }, [activeOrg?.id, currentPage, dateRange]);

  function fmt(n: number) {
    return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { color: 'green' | 'blue' | 'grey'; label: string }> = {
      delivered: { color: 'green', label: 'Livré' },
      in_transit: { color: 'blue', label: 'En transit' },
      picked_up: { color: 'blue', label: 'Collecté' },
      assigned: { color: 'grey', label: 'Assigné' },
      open: { color: 'grey', label: 'Ouvert' },
    };
    const s = map[status] ?? { color: 'grey' as const, label: status };
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Finances & Revenus</Header>

      {/* ── KPI ───────────────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Récapitulatif global</Header>}>
        <ColumnLayout columns={3} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Revenus encaissés</Box>
            <Box fontSize="heading-xl" fontWeight="bold" color="text-status-success">
              {fmt(totalEarned)}
            </Box>
            <Box variant="small" color="text-body-secondary">Missions livrées</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">En attente d'encaissement</Box>
            <Box fontSize="heading-xl" fontWeight="bold" color="text-status-warning">
              {fmt(pendingEarned)}
            </Box>
            <Box variant="small" color="text-body-secondary">Missions en cours</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Total potentiel</Box>
            <Box fontSize="heading-xl" fontWeight="bold">
              {fmt(totalEarned + pendingEarned)}
            </Box>
            <Box variant="small" color="text-body-secondary">Toutes missions assignées</Box>
          </div>
        </ColumnLayout>
      </Container>

      {/* ── Tableau des missions ──────────────────────────────────────── */}
      <Table
        loading={loading}
        loadingText="Chargement des missions…"
        header={
          <Header
            variant="h2"
            actions={
              <DateRangePicker
                value={dateRange
                  ? { type: 'absolute', startDate: dateRange.startDate, endDate: dateRange.endDate }
                  : null
                }
                onChange={({ detail }) => {
                  if (detail.value?.type === 'absolute') {
                    setDateRange({ startDate: detail.value.startDate, endDate: detail.value.endDate });
                  } else {
                    setDateRange(null);
                  }
                  setCurrentPage(1);
                }}
                placeholder="Toutes les dates"
                relativeOptions={[]}
                isValidRange={() => ({ valid: true })}
              />
            }
          >
            Détail des missions
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        items={rows}
        trackBy="id"
        columnDefinitions={[
          {
            id: 'order_number',
            header: 'Commande',
            cell: (r) => r.order_number ?? <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (r) => statusBadge(r.status),
          },
          {
            id: 'delivered_at',
            header: 'Date de livraison',
            cell: (r) => r.delivered_at
              ? new Date(r.delivered_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
              : <Box color="text-body-secondary">—</Box>,
          },
          {
            id: 'accepted_price',
            header: 'Rémunération (MAD)',
            cell: (r) => r.accepted_price != null
              ? <Box fontWeight="bold">{fmt(r.accepted_price)}</Box>
              : <Box color="text-body-secondary">—</Box>,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune mission</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Vous n'avez pas encore de missions assignées.
            </Box>
          </Box>
        }
      />
    </SpaceBetween>
  );
}
