import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Box,
  ColumnLayout,
  StatusIndicator,
  Table,
  Link,
  Spinner,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ORDER_STATUS_LABELS, orderStatusType, fmtEUR } from '../../lib/vendorUtils';
import type { Order } from '../../types';

interface Stats {
  revenue: number;
  pendingCount: number;
  productCount: number;
  pendingQuotes: number;
}

export default function VendorOverview() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ revenue: 0, pendingCount: 0, productCount: 0, pendingQuotes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;
    async function load() {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [recentRes, productsRes, pendingRes, revenueRes, quotesRes] = await Promise.all([
        // Last 10 orders for display table
        supabase
          .from('orders')
          .select('*')
          .eq('seller_org_id', activeOrg!.id)
          .order('created_at', { ascending: false })
          .limit(10),
        // Active products count (aggregate, no data returned)
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('seller_org_id', activeOrg!.id)
          .eq('status', 'active'),
        // All pending orders count (not limited to 10)
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_org_id', activeOrg!.id)
          .eq('status', 'pending'),
        // CA ce mois (orders confirming revenue, all — not limited)
        supabase
          .from('orders')
          .select('total_ttc')
          .eq('seller_org_id', activeOrg!.id)
          .in('status', ['confirmed', 'in_preparation', 'shipped', 'delivered'])
          .gte('created_at', monthStart),
        // Pending quotes needing response
        supabase
          .from('rfq_items')
          .select('id', { count: 'exact', head: true })
          .eq('seller_org_id', activeOrg!.id)
          .eq('status', 'new'),
      ]);

      const monthRevenue = ((revenueRes.data ?? []) as { total_ttc: number }[])
        .reduce((s, o) => s + (o.total_ttc ?? 0), 0);

      setOrders((recentRes.data as Order[]) ?? []);
      setStats({
        revenue: monthRevenue,
        pendingCount: pendingRes.count ?? 0,
        productCount: productsRes.count ?? 0,
        pendingQuotes: quotesRes.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [activeOrg]);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const kpiCards = [
    {
      title: `CA du mois (${monthLabel})`,
      value: fmtEUR(stats.revenue),
      description: 'Commandes confirmées / expédiées / livrées',
      color: 'text-status-info' as const,
    },
    {
      title: 'Commandes en attente',
      value: String(stats.pendingCount),
      description: 'À confirmer — toutes commandes',
      color: stats.pendingCount > 0 ? 'text-status-warning' as const : 'text-status-success' as const,
    },
    {
      title: 'Produits actifs',
      value: String(stats.productCount),
      description: 'Dans le catalogue',
      color: 'inherit' as const,
    },
    {
      title: 'Devis en attente',
      value: String(stats.pendingQuotes),
      description: 'Demandes sans réponse',
      color: stats.pendingQuotes > 0 ? 'text-status-warning' as const : 'text-status-success' as const,
    },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => navigate('/vendor/catalog/new')}>Nouveau produit</Button>
            <Button variant="primary" onClick={() => navigate('/vendor/orders')}>
              Voir toutes les commandes
            </Button>
          </SpaceBetween>
        }
      >
        Vue d'ensemble
      </Header>

      {/* KPIs */}
      <ColumnLayout columns={4} variant="text-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Container key={i}>
                <Box textAlign="center">
                  <Spinner />
                </Box>
              </Container>
            ))
          : kpiCards.map(({ title, value, description, color }) => (
              <div key={title}>
                <Box variant="awsui-key-label">{title}</Box>
                <Box fontSize="heading-xl" fontWeight="bold" color={color}>
                  {value}
                </Box>
                <Box color="text-body-secondary" fontSize="body-s">
                  {description}
                </Box>
              </div>
            ))}
      </ColumnLayout>

      {/* Recent orders */}
      <Table
        header={
          <Header
            variant="h2"
            actions={<Button onClick={() => navigate('/vendor/orders')}>Voir tout</Button>}
          >
            Commandes récentes
          </Header>
        }
        loading={loading}
        loadingText="Chargement..."
        items={orders}
        columnDefinitions={[
          {
            id: 'number',
            header: 'N° Commande',
            cell: (o: Order) => (
              <Link onFollow={() => navigate(`/vendor/orders/${o.id}`)}>{o.order_number}</Link>
            ),
          },
          {
            id: 'date',
            header: 'Date',
            cell: (o: Order) => new Date(o.created_at).toLocaleDateString('fr-FR'),
          },
          {
            id: 'total',
            header: 'Total TTC',
            cell: (o: Order) => `${o.total_ttc.toFixed(2)} ${o.currency}`,
          },
          {
            id: 'status',
            header: 'Statut',
            cell: (o: Order) => (
              <StatusIndicator type={orderStatusType(o.status)}>
                {ORDER_STATUS_LABELS[o.status] ?? o.status}
              </StatusIndicator>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (o: Order) => (
              <Button variant="inline-link" onClick={() => navigate(`/vendor/orders/${o.id}`)}>
                Détails
              </Button>
            ),
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <b>Aucune commande</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              Les commandes apparaîtront ici.
            </Box>
          </Box>
        }
      />
    </SpaceBetween>
  );
}
