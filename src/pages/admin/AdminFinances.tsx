import { useEffect, useState } from 'react';
import {
  Header, SpaceBetween, Box, Container,
  ColumnLayout, Table, Badge, StatusIndicator,
  Select, Alert, ProgressBar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

const PERIOD_OPTIONS = [
  { label: '30 derniers jours',   value: '30'  },
  { label: '90 derniers jours',   value: '90'  },
  { label: '12 derniers mois',    value: '365' },
  { label: 'Tout (depuis le début)', value: '0' },
];

interface SellerStat {
  seller_org_id: string;
  seller_name: string;
  total_orders: number;
  total_revenue: number;
  cancelled_orders: number;
  delivered_orders: number;
}

export default function AdminFinances() {
  const [loading,       setLoading]      = useState(true);
  const [period,        setPeriod]       = useState('30');
  const [orders,        setOrders]       = useState<any[]>([]);
  const [sellerStats,   setSellerStats]  = useState<SellerStat[]>([]);
  const [error,         setError]        = useState('');

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      let q = supabase
        .from('orders')
        .select(`
          id, status, total_ht, total_ttc, currency,
          created_at, seller_org_id,
          seller:organisations!seller_org_id(name)
        `)
        .order('created_at', { ascending: false });

      if (period !== '0') {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(period));
        q = q.gte('created_at', since.toISOString());
      }

      const { data } = await q;
      const all = (data as any[]) ?? [];
      setOrders(all);

      // Aggregate by seller
      const map = new Map<string, SellerStat>();
      for (const o of all) {
        const sid = o.seller_org_id;
        if (!map.has(sid)) {
          map.set(sid, {
            seller_org_id:   sid,
            seller_name:     o.seller?.name ?? sid,
            total_orders:    0,
            total_revenue:   0,
            cancelled_orders: 0,
            delivered_orders: 0,
          });
        }
        const s = map.get(sid)!;
        s.total_orders++;
        if (o.status !== 'cancelled') s.total_revenue += o.total_ttc ?? 0;
        if (o.status === 'cancelled') s.cancelled_orders++;
        if (o.status === 'delivered') s.delivered_orders++;
      }
      setSellerStats([...map.values()].sort((a, b) => b.total_revenue - a.total_revenue));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    }
    setLoading(false);
  }

  // ── Computed metrics ──────────────────────────────────────────────────────
  const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled');
  const gmv              = nonCancelledOrders.reduce((s, o) => s + (o.total_ttc ?? 0), 0);
  const avgOrderValue    = nonCancelledOrders.length > 0 ? gmv / nonCancelledOrders.length : 0;
  const deliveredOrders  = orders.filter((o) => o.status === 'delivered');
  const cancelledOrders  = orders.filter((o) => o.status === 'cancelled');
  const deliveryRate     = orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0;
  const cancellationRate = orders.length > 0 ? (cancelledOrders.length / orders.length) * 100 : 0;

  // Status breakdown
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const STATUS_LABEL: Record<string, string> = {
    pending: 'En attente', confirmed: 'Confirmée', in_preparation: 'En préparation',
    shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', dispute: 'Litige',
  };
  const statusType = (s: string): 'success' | 'warning' | 'error' | 'info' | 'stopped' => ({
    delivered: 'success', shipped: 'info', confirmed: 'info',
    in_preparation: 'info', pending: 'warning', cancelled: 'stopped', dispute: 'error',
  } as Record<string, 'success' | 'warning' | 'error' | 'info' | 'stopped'>)[s] ?? 'info';

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="Vue financière consolidée de la plateforme"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Select
              selectedOption={PERIOD_OPTIONS.find((o) => o.value === period) ?? PERIOD_OPTIONS[0]}
              options={PERIOD_OPTIONS}
              onChange={({ detail }) => setPeriod(detail.selectedOption.value ?? '30')}
            />
          </SpaceBetween>
        }
      >
        Finances Plateforme
      </Header>

      {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Indicateurs financiers</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">GMV (Volume brut)</Box>
            <Box fontSize="heading-xl" fontWeight="bold" color="text-status-success">
              {loading ? '—' : `${gmv.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`}
            </Box>
            <Box color="text-body-secondary" fontSize="body-s">Commandes non annulées</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Panier moyen</Box>
            <Box fontSize="heading-xl" fontWeight="bold">
              {loading ? '—' : `${avgOrderValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`}
            </Box>
            <Box color="text-body-secondary" fontSize="body-s">Par commande (hors annulées)</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Commandes</Box>
            <Box fontSize="heading-xl" fontWeight="bold">
              {loading ? '—' : orders.length}
            </Box>
            <Box color="text-body-secondary" fontSize="body-s">
              {deliveredOrders.length} livrées · {cancelledOrders.length} annulées
            </Box>
          </div>
        </ColumnLayout>
      </Container>

      {/* ── Taux de livraison / annulation ────────────────────────── */}
      <Container header={<Header variant="h2">Taux de performance</Header>}>
        <ColumnLayout columns={2}>
          <div>
            <ProgressBar
              value={deliveryRate}
              label="Taux de livraison"
              additionalInfo={`${deliveredOrders.length} livrées / ${orders.length} commandes`}
              status={deliveryRate >= 80 ? 'success' : deliveryRate >= 60 ? 'in-progress' : 'error'}
            />
          </div>
          <div>
            <ProgressBar
              value={cancellationRate}
              label="Taux d'annulation"
              additionalInfo={`${cancelledOrders.length} annulées / ${orders.length} commandes`}
              status={cancellationRate <= 10 ? 'success' : cancellationRate <= 20 ? 'in-progress' : 'error'}
            />
          </div>
        </ColumnLayout>
      </Container>

      {/* ── Répartition par statut ─────────────────────────────────── */}
      <Container header={<Header variant="h2">Répartition par statut</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          {Object.entries(statusCounts).sort(([, a], [, b]) => b - a).map(([status, count]) => (
            <div key={status}>
              <Box variant="awsui-key-label">
                <StatusIndicator type={statusType(status)}>{STATUS_LABEL[status] ?? status}</StatusIndicator>
              </Box>
              <Box fontSize="heading-l" fontWeight="bold">{count}</Box>
              <Box color="text-body-secondary" fontSize="body-s">
                {orders.length > 0 ? `${((count / orders.length) * 100).toFixed(1)} %` : '0 %'}
              </Box>
            </div>
          ))}
        </ColumnLayout>
      </Container>

      {/* ── Top vendeurs ───────────────────────────────────────────── */}
      <Table
        header={<Header variant="h2">Classement vendeurs par CA</Header>}
        loading={loading}
        loadingText="Calcul en cours…"
        trackBy="seller_org_id"
        items={sellerStats.slice(0, 20)}
        columnDefinitions={[
          {
            id: 'rank',
            header: '#',
            cell: (_, i) => (
              <Badge color={i === 0 ? 'red' : i === 1 ? 'blue' : i === 2 ? 'green' : 'grey'}>
                #{(i ?? 0) + 1}
              </Badge>
            ),
            width: 60,
          },
          {
            id: 'seller',
            header: 'Vendeur',
            cell: (s) => <Box fontWeight="bold">{s.seller_name}</Box>,
          },
          {
            id: 'revenue',
            header: 'CA HT',
            cell: (s) => (
              <Box fontWeight="bold" color="text-status-success">
                {s.total_revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD
              </Box>
            ),
          },
          {
            id: 'orders',
            header: 'Commandes',
            cell: (s) => s.total_orders,
          },
          {
            id: 'delivered',
            header: 'Livrées',
            cell: (s) => (
              <StatusIndicator type="success">{s.delivered_orders}</StatusIndicator>
            ),
          },
          {
            id: 'cancelled',
            header: 'Annulées',
            cell: (s) => s.cancelled_orders > 0
              ? <StatusIndicator type="stopped">{s.cancelled_orders}</StatusIndicator>
              : <Box color="text-body-secondary">0</Box>,
          },
          {
            id: 'avg',
            header: 'Panier moyen',
            cell: (s) => {
              const effective = s.total_orders - s.cancelled_orders;
              const avg = effective > 0 ? s.total_revenue / effective : 0;
              return `${avg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`;
            },
          },
        ]}
        empty={<Box textAlign="center" color="inherit" padding="l"><b>Aucune donnée</b></Box>}
      />
    </SpaceBetween>
  );
}
