import { useEffect, useState } from 'react';
import {
  SpaceBetween, Header, Container, ColumnLayout, Box, Select,
  Table, Badge, ProgressBar,
} from '@cloudscape-design/components';
import { supabase } from '../../lib/supabase';

interface KpiBlock {
  label: string;
  value: string;
  sub?: string;
  color?: 'text-status-success' | 'text-status-warning' | 'text-status-error';
}

interface TopOrg {
  id: string;
  name: string;
  org_type: string;
  order_count: number;
  gmv: number;
}

interface StatusRow {
  status: string;
  count: number;
}

export default function AdminStats() {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiBlock[]>([]);
  const [topOrgs, setTopOrgs] = useState<TopOrg[]>([]);
  const [byStatus, setByStatus] = useState<StatusRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = days === 'all' ? null : new Date(Date.now() - parseInt(days) * 86400000).toISOString();

      let ordQuery = supabase.from('orders').select('id, total_ttc, status, seller_org_id, buyer_org_id, created_at');
      if (since) ordQuery = ordQuery.gte('created_at', since);
      const { data: orders } = await ordQuery;

      const rows = (orders ?? []) as Array<{
        id: string; total_ttc: number; status: string;
        seller_org_id: string; buyer_org_id: string; created_at: string;
      }>;

      const nonCancelled = rows.filter((r) => r.status !== 'cancelled');
      const gmv          = nonCancelled.reduce((s, r) => s + (r.total_ttc ?? 0), 0);
      const avgCart      = nonCancelled.length ? gmv / nonCancelled.length : 0;
      const delivered    = rows.filter((r) => r.status === 'delivered').length;
      const cancelled    = rows.filter((r) => r.status === 'cancelled').length;
      const cancelRate   = rows.length ? (cancelled / rows.length) * 100 : 0;
      const deliverRate  = rows.length ? (delivered / rows.length) * 100 : 0;

      // Unique buyer / seller IDs
      const buyerIds  = new Set(rows.map((r) => r.buyer_org_id)).size;
      const sellerIds = new Set(rows.map((r) => r.seller_org_id)).size;

      setKpis([
        { label: 'GMV (non annulé)',      value: fmt(gmv),           sub: `${nonCancelled.length} commandes`, color: 'text-status-success' },
        { label: 'Panier moyen',          value: fmt(avgCart),       sub: 'par commande' },
        { label: 'Commandes livrées',     value: `${delivered}`,     sub: `${deliverRate.toFixed(1)} %`, color: delivered > 0 ? 'text-status-success' : undefined },
        { label: 'Commandes annulées',    value: `${cancelled}`,     sub: `${cancelRate.toFixed(1)} %`, color: cancelled > 0 ? 'text-status-error' : undefined },
        { label: 'Acheteurs actifs',      value: `${buyerIds}`,      sub: 'organisations' },
        { label: 'Vendeurs avec ventes',  value: `${sellerIds}`,     sub: 'organisations' },
      ]);

      // By status
      const statusAgg: Record<string, number> = {};
      rows.forEach((r) => { statusAgg[r.status] = (statusAgg[r.status] ?? 0) + 1; });
      setByStatus(Object.entries(statusAgg).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count));

      // Top 10 orgs by order count
      const orgAgg: Record<string, { name?: string; org_type?: string; order_count: number; gmv: number; id: string }> = {};
      rows.forEach((r) => {
        const id = r.seller_org_id;
        if (!orgAgg[id]) orgAgg[id] = { id, order_count: 0, gmv: 0 };
        orgAgg[id].order_count++;
        orgAgg[id].gmv += r.total_ttc ?? 0;
      });
      const topIds = Object.values(orgAgg).sort((a, b) => b.gmv - a.gmv).slice(0, 10).map((o) => o.id);
      if (topIds.length) {
        const { data: orgData } = await supabase.from('organisations').select('id, name, org_type').in('id', topIds);
        (orgData ?? []).forEach((o: { id: string; name: string; org_type: string }) => {
          if (orgAgg[o.id]) { orgAgg[o.id].name = o.name; orgAgg[o.id].org_type = o.org_type; }
        });
      }
      setTopOrgs(
        Object.values(orgAgg)
          .filter((o) => topIds.includes(o.id))
          .sort((a, b) => b.gmv - a.gmv)
          .map((o) => ({ id: o.id, name: o.name ?? o.id, org_type: o.org_type ?? 'seller', order_count: o.order_count, gmv: o.gmv }))
      );

      setLoading(false);
    }
    load();
  }, [days]);

  function fmt(n: number) {
    return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: 'En attente', confirmed: 'Confirmé', in_preparation: 'Préparation',
    shipped: 'Expédié', delivered: 'Livré', cancelled: 'Annulé', dispute: 'Litige',
  };
  const STATUS_COLOR: Record<string, 'blue' | 'green' | 'grey' | 'red'> = {
    pending: 'grey', confirmed: 'blue', in_preparation: 'blue',
    shipped: 'blue', delivered: 'green', cancelled: 'red', dispute: 'red',
  };

  const totalOrders = byStatus.reduce((s, r) => s + r.count, 0);

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <Select
            selectedOption={{ value: days, label: { '7': '7 derniers jours', '30': '30 derniers jours', '90': '90 derniers jours', '365': '12 derniers mois', 'all': 'Tout temps' }[days] ?? days }}
            onChange={({ detail }) => setDays(detail.selectedOption.value ?? '30')}
            options={[
              { value: '7',   label: '7 derniers jours' },
              { value: '30',  label: '30 derniers jours' },
              { value: '90',  label: '90 derniers jours' },
              { value: '365', label: '12 derniers mois' },
              { value: 'all', label: 'Tout temps' },
            ]}
          />
        }
      >
        Statistiques plateforme
      </Header>

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <Container header={<Header variant="h2">Indicateurs clés</Header>}>
        {loading ? (
          <Box>Chargement…</Box>
        ) : (
          <ColumnLayout columns={3} variant="text-grid">
            {kpis.map((k) => (
              <div key={k.label}>
                <Box variant="awsui-key-label">{k.label}</Box>
                <Box fontSize="heading-xl" fontWeight="bold" color={k.color}>{k.value}</Box>
                {k.sub && <Box variant="small" color="text-body-secondary">{k.sub}</Box>}
              </div>
            ))}
          </ColumnLayout>
        )}
      </Container>

      {/* ── Répartition par statut ────────────────────────────────── */}
      <Container header={<Header variant="h2">Répartition des commandes par statut</Header>}>
        <SpaceBetween size="s">
          {byStatus.map((r) => (
            <ProgressBar
              key={r.status}
              value={totalOrders > 0 ? (r.count / totalOrders) * 100 : 0}
              label={
                <SpaceBetween direction="horizontal" size="xs">
                  <Badge color={STATUS_COLOR[r.status] ?? 'grey'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </SpaceBetween>
              }
              additionalInfo={`${r.count} (${totalOrders > 0 ? ((r.count / totalOrders) * 100).toFixed(1) : 0}%)`}
            />
          ))}
          {byStatus.length === 0 && !loading && <Box color="text-body-secondary">Aucune commande sur la période.</Box>}
        </SpaceBetween>
      </Container>

      {/* ── Top vendeurs ──────────────────────────────────────────── */}
      <Table
        loading={loading}
        loadingText="Chargement…"
        header={<Header variant="h2">Top vendeurs par CA (période)</Header>}
        items={topOrgs}
        trackBy="id"
        columnDefinitions={[
          {
            id: 'rank',
            header: '#',
            cell: (_, i) => i + 1,
            width: 40,
          },
          {
            id: 'name',
            header: 'Organisation',
            cell: (o) => <Box fontWeight="bold">{o.name}</Box>,
            minWidth: 180,
          },
          {
            id: 'org_type',
            header: 'Type',
            cell: (o) => (
              <Badge color={o.org_type === 'seller' ? 'green' : 'blue'}>
                {o.org_type === 'seller' ? 'Vendeur' : o.org_type}
              </Badge>
            ),
          },
          {
            id: 'orders',
            header: 'Nb commandes',
            cell: (o) => o.order_count,
          },
          {
            id: 'gmv',
            header: 'CA total (MAD)',
            cell: (o) => <Box fontWeight="bold" color="text-status-success">{fmt(o.gmv)}</Box>,
          },
        ]}
        empty={<Box textAlign="center" color="inherit"><b>Aucune donnée</b></Box>}
      />
    </SpaceBetween>
  );
}
