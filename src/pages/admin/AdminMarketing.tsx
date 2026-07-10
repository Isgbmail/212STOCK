import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, SpaceBetween, Container,
  ColumnLayout, Box, Button, StatusIndicator,
  BarChart, LineChart,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

interface KPI {
  activeCampaigns: number;
  totalSellers: number;
  totalRevenue: number;
  avgBalance: number;
  unreadNotifs: number;
  inventoryFill: number;
  buyerFreeCount: number;
  buyerProCount: number;
  buyerEnterpriseCount: number;
}

export default function AdminMarketing() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [campaignsRes, profilesRes, notifsRes, invRes, subsRes] = await Promise.all([
      supabase.from('campaigns').select('id, status, spent_credits', { count: 'exact' }).eq('status', 'active'),
      supabase.from('profiles').select('seller_credits_balance'),
      supabase.from('admin_marketing_notifications').select('id', { count: 'exact' }).eq('is_read', false),
      supabase.from('ad_inventory').select('total_slots, reserved_slots'),
      supabase.from('buyer_subscriptions').select('tiers(name)'),
    ]);

    const balances = (profilesRes.data ?? []).map((p: { seller_credits_balance: number }) => p.seller_credits_balance);
    const totalRevenue = (campaignsRes.data ?? []).reduce((sum: number, c: { spent_credits: number }) => sum + c.spent_credits, 0);
    const invData = invRes.data ?? [];
    const totalSlots = invData.reduce((s: number, r: { total_slots: number }) => s + r.total_slots, 0);
    const reservedSlots = invData.reduce((s: number, r: { reserved_slots: number }) => s + r.reserved_slots, 0);
    const inventoryFill = totalSlots > 0 ? Math.round((reservedSlots / totalSlots) * 100) : 0;

    const subs = subsRes.data ?? [];
    const tierCount = (name: string) => subs.filter((s: { tiers: { name: string } | null }) => s.tiers?.name === name).length;

    setKpi({
      activeCampaigns: campaignsRes.count ?? 0,
      totalSellers: profilesRes.data?.length ?? 0,
      totalRevenue: Math.round(totalRevenue),
      avgBalance: balances.length > 0 ? Math.round(balances.reduce((a, b) => a + b, 0) / balances.length) : 0,
      unreadNotifs: notifsRes.count ?? 0,
      inventoryFill,
      buyerFreeCount: tierCount('Free'),
      buyerProCount: tierCount('Pro'),
      buyerEnterpriseCount: tierCount('Enterprise'),
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <ContentLayout header={<Header variant="h1" actions={<Button iconName="refresh" onClick={load} loading={loading}>Actualiser</Button>}>Marketing — Dashboard</Header>}>
      <SpaceBetween size="l">
        {/* KPIs */}
        <Container header={<Header variant="h2">Indicateurs clés</Header>}>
          <ColumnLayout columns={4} borders="vertical">
            <div>
              <Box variant="awsui-key-label">Campagnes actives</Box>
              <Box fontSize="display-l" fontWeight="bold" color="text-status-success">{kpi?.activeCampaigns ?? '—'}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Crédits dépensés (total)</Box>
              <Box fontSize="display-l" fontWeight="bold">{kpi ? `${kpi.totalRevenue.toLocaleString('fr-FR')} cr.` : '—'}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Solde moyen vendeur</Box>
              <Box fontSize="display-l" fontWeight="bold">{kpi ? `${kpi.avgBalance.toLocaleString('fr-FR')} cr.` : '—'}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Inventaire rempli</Box>
              <Box fontSize="display-l" fontWeight="bold" color={kpi && kpi.inventoryFill > 80 ? 'text-status-error' : 'text-label'}>
                {kpi ? `${kpi.inventoryFill}%` : '—'}
              </Box>
            </div>
          </ColumnLayout>
        </Container>

        {/* Tiers acheteurs */}
        <Container header={<Header variant="h2">Répartition tiers acheteurs</Header>}>
          <ColumnLayout columns={3} borders="vertical">
            <div>
              <Box variant="awsui-key-label">Free</Box>
              <Box fontSize="heading-xl" fontWeight="bold">{kpi?.buyerFreeCount ?? '—'}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Pro</Box>
              <Box fontSize="heading-xl" fontWeight="bold" color="text-status-info">{kpi?.buyerProCount ?? '—'}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Enterprise</Box>
              <Box fontSize="heading-xl" fontWeight="bold" color="text-status-success">{kpi?.buyerEnterpriseCount ?? '—'}</Box>
            </div>
          </ColumnLayout>
        </Container>

        {/* Notifications admin non lues */}
        {kpi && kpi.unreadNotifs > 0 && (
          <Container>
            <StatusIndicator type="warning">
              {kpi.unreadNotifs} notification(s) admin non lue(s) — <a href="/admin/marketing/notifications">Voir</a>
            </StatusIndicator>
          </Container>
        )}

        {/* Graphique placeholder inventaire */}
        <Container header={<Header variant="h2">Utilisation inventaire (aujourd'hui)</Header>}>
          <BarChart
            series={[
              {
                title: 'Réservé',
                type: 'bar',
                data: [{ x: new Date(), y: kpi?.inventoryFill ?? 0 }],
                color: '#0073bb',
              },
              {
                title: 'Libre',
                type: 'bar',
                data: [{ x: new Date(), y: 100 - (kpi?.inventoryFill ?? 0) }],
                color: '#d1d5db',
              },
            ]}
            xDomain={[new Date()]}
            yDomain={[0, 100]}
            height={120}
            xTitle="Aujourd'hui"
            yTitle="Slots (%)"
            stackedBars
            hideFilter
            hideLegend={false}
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
