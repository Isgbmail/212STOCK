import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, SpaceBetween, Container,
  ColumnLayout, Box, Button, StatusIndicator, Link,
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { getSellerBalance } from '../../../lib/marketingHelpers';

interface Stats {
  balance: number;
  activeCampaigns: number;
  totalSpent: number;
  loyaltyPoints: number;
}

export default function VendorMarketingHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [balance, campaigns] = await Promise.all([
        getSellerBalance(user.id),
        supabase.from('campaigns').select('id, spent_credits, status').eq('seller_id', user.id),
      ]);
      const active = (campaigns.data ?? []).filter((c: { status: string }) => c.status === 'active').length;
      const spent = (campaigns.data ?? []).reduce((s: number, c: { spent_credits: number }) => s + c.spent_credits, 0);
      setStats({ balance, activeCampaigns: active, totalSpent: Math.round(spent), loyaltyPoints: 0 });
      setLoading(false);
    };
    load();
  }, [user]);

  const links = [
    { label: 'Mes crédits', path: '/vendor/marketing/credits', icon: '💳', desc: 'Acheter des crédits ou souscrire un forfait mensuel' },
    { label: 'Créer une campagne', path: '/vendor/marketing/campaigns/create', icon: '🚀', desc: 'Lancer une nouvelle campagne sponsorisée ou promotionnelle' },
    { label: 'Mes campagnes', path: '/vendor/marketing/campaigns', icon: '📊', desc: 'Suivre et gérer vos campagnes en cours' },
    { label: 'Liquidation', path: '/vendor/marketing/liquidation', icon: '🏷️', desc: 'Créer des lots de déstockage (enchères ou prix fixe)' },
    { label: 'Échantillons', path: '/vendor/marketing/sampling', icon: '📦', desc: 'Gérer les demandes d\'échantillons de vos campagnes' },
  ];

  return (
    <ContentLayout header={<Header variant="h1">Hub Marketing Vendeur</Header>}>
      <SpaceBetween size="l">
        {/* KPIs */}
        <Container header={<Header variant="h2">Aperçu</Header>}>
          <ColumnLayout columns={4} borders="vertical">
            <div>
              <Box variant="awsui-key-label">Solde crédits</Box>
              <Box fontSize="display-l" fontWeight="bold" color={stats && stats.balance < 10 ? 'text-status-error' : 'text-status-success'}>
                {loading ? '…' : `${stats?.balance.toFixed(2) ?? 0} cr.`}
              </Box>
              {stats && stats.balance < 10 && <StatusIndicator type="warning">Solde faible</StatusIndicator>}
            </div>
            <div>
              <Box variant="awsui-key-label">Campagnes actives</Box>
              <Box fontSize="display-l" fontWeight="bold">{loading ? '…' : stats?.activeCampaigns ?? 0}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Total dépensé</Box>
              <Box fontSize="display-l" fontWeight="bold">{loading ? '…' : `${stats?.totalSpent ?? 0} cr.`}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Points fidélité</Box>
              <Box fontSize="display-l" fontWeight="bold">{loading ? '…' : stats?.loyaltyPoints ?? 0}</Box>
            </div>
          </ColumnLayout>
        </Container>

        {/* Accès rapide */}
        <Container header={<Header variant="h2">Accès rapide</Header>}>
          <ColumnLayout columns={3}>
            {links.map(l => (
              <div key={l.path} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }} onClick={() => navigate(l.path)}>
                <Box fontSize="heading-xl">{l.icon}</Box>
                <Box fontWeight="bold">{l.label}</Box>
                <Box color="text-body-secondary" fontSize="body-s">{l.desc}</Box>
              </div>
            ))}
          </ColumnLayout>
        </Container>

        {/* Bouton crédit si faible */}
        {stats && stats.balance < 10 && (
          <Container>
            <SpaceBetween direction="horizontal" size="m">
              <StatusIndicator type="error">Votre solde est faible. Rechargez des crédits pour continuer vos campagnes.</StatusIndicator>
              <Button variant="primary" onClick={() => navigate('/vendor/marketing/credits')}>Recharger maintenant</Button>
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
