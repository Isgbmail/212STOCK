import { useEffect, useState } from 'react';
import {
  ContentLayout, Header, Tabs, Container, SpaceBetween,
  ColumnLayout, Box, Button, Cards, Alert, Modal,
  Table, StatusIndicator, Pagination,
} from '@cloudscape-design/components';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { getSellerBalance, addSellerCredits } from '../../../lib/marketingHelpers';
import type { CreditPack, CreditPlan, CreditTransaction } from '../../../types/marketing';

function PacksTab() {
  const { user } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [balance, setBalance] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmPack, setConfirmPack] = useState<CreditPack | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.from('credit_packs').select('*').eq('active', true).order('price').then(({ data }) => setPacks((data ?? []) as CreditPack[]));
    if (user) getSellerBalance(user.id).then(setBalance);
  }, [user]);

  const buyPack = async (pack: CreditPack) => {
    if (!user) return;
    setBuying(pack.id);
    const total = pack.credits + pack.bonus_credits;
    await addSellerCredits(user.id, total, 'pack_purchase', pack.id, `Achat pack "${pack.name}" — ${pack.credits}+${pack.bonus_credits} crédits`);
    setBalance(prev => prev + total);
    setSuccess(`Pack "${pack.name}" acheté ! ${total} crédits ajoutés.`);
    setConfirmPack(null);
    setBuying(null);
  };

  return (
    <SpaceBetween size="m">
      <Container>
        <Box variant="awsui-key-label">Solde actuel</Box>
        <Box fontSize="display-l" fontWeight="bold">{balance.toFixed(2)} crédits</Box>
      </Container>
      {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}
      <Cards
        items={packs}
        cardDefinition={{
          header: item => <Box fontWeight="bold" fontSize="heading-m">{item.name}</Box>,
          sections: [
            {
              id: 'credits',
              content: item => (
                <SpaceBetween size="xs">
                  <Box fontSize="display-l" fontWeight="bold">{item.credits} cr.</Box>
                  {item.bonus_credits > 0 && <StatusIndicator type="success">+{item.bonus_credits} crédits bonus</StatusIndicator>}
                  <Box fontSize="heading-xl" color="text-status-info">{item.price} {item.currency}</Box>
                  <Button variant="primary" loading={buying === item.id} onClick={() => setConfirmPack(item)}>Acheter</Button>
                </SpaceBetween>
              ),
            },
          ],
        }}
        header={<Header>Packs de crédits</Header>}
        empty="Aucun pack disponible"
      />
      {confirmPack && (
        <Modal
          visible header="Confirmer l'achat"
          onDismiss={() => setConfirmPack(null)}
          footer={<SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => setConfirmPack(null)}>Annuler</Button>
            <Button variant="primary" loading={buying === confirmPack.id} onClick={() => buyPack(confirmPack)}>Confirmer</Button>
          </SpaceBetween>}
        >
          <p>Acheter le pack <strong>{confirmPack.name}</strong> pour <strong>{confirmPack.price} {confirmPack.currency}</strong> ?<br />
          Vous recevrez <strong>{confirmPack.credits + confirmPack.bonus_credits} crédits</strong>.</p>
        </Modal>
      )}
    </SpaceBetween>
  );
}

function PlansTab() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [active, setActive] = useState<{ plan_id: string } | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.from('credit_plans').select('*').eq('active', true).order('monthly_price').then(({ data }) => setPlans((data ?? []) as CreditPlan[]));
    if (user) supabase.from('seller_credit_subscriptions').select('plan_id').eq('seller_id', user.id).eq('status', 'active').single().then(({ data }) => setActive(data as { plan_id: string } | null));
  }, [user]);

  const subscribe = async (plan: CreditPlan) => {
    if (!user) return;
    setSubscribing(plan.id);
    // Cancel previous subscription if any
    await supabase.from('seller_credit_subscriptions').update({ status: 'cancelled' }).eq('seller_id', user.id).eq('status', 'active');
    // Create new subscription
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
    await supabase.from('seller_credit_subscriptions').insert({
      seller_id: user.id, plan_id: plan.id, status: 'active',
      next_renewal_date: nextMonth.toISOString().slice(0, 10),
    });
    // Credit immediately
    await addSellerCredits(user.id, plan.monthly_credits, 'subscription_renewal', plan.id, `Abonnement "${plan.name}" — ${plan.monthly_credits} crédits/mois`);
    setActive({ plan_id: plan.id });
    setSuccess(`Abonnement "${plan.name}" activé ! ${plan.monthly_credits} crédits ajoutés.`);
    setSubscribing(null);
  };

  return (
    <SpaceBetween size="m">
      {success && <Alert type="success" dismissible onDismiss={() => setSuccess('')}>{success}</Alert>}
      <Cards
        items={plans}
        cardDefinition={{
          header: item => (
            <SpaceBetween direction="horizontal" size="s">
              <Box fontWeight="bold" fontSize="heading-m">{item.name}</Box>
              {active?.plan_id === item.id && <StatusIndicator type="success">Actif</StatusIndicator>}
            </SpaceBetween>
          ),
          sections: [
            {
              id: 'details',
              content: item => (
                <SpaceBetween size="xs">
                  <Box fontSize="display-l" fontWeight="bold">{item.monthly_credits} cr./mois</Box>
                  <Box fontSize="heading-xl" color="text-status-info">{item.monthly_price} {item.currency}/mois</Box>
                  <Button
                    variant={active?.plan_id === item.id ? 'normal' : 'primary'}
                    loading={subscribing === item.id}
                    disabled={active?.plan_id === item.id}
                    onClick={() => subscribe(item)}
                  >
                    {active?.plan_id === item.id ? 'Abonnement actif' : 'Souscrire'}
                  </Button>
                </SpaceBetween>
              ),
            },
          ],
        }}
        header={<Header>Forfaits mensuels</Header>}
        empty="Aucun forfait disponible"
      />
    </SpaceBetween>
  );
}

function HistoryTab() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      .then(({ data, count }) => {
        setTxns((data ?? []) as CreditTransaction[]);
        setTotal(count ?? 0);
        setLoading(false);
      });
  }, [user, page]);

  return (
    <Table
      loading={loading}
      items={txns}
      columnDefinitions={[
        { id: 'date', header: 'Date', cell: r => new Date(r.created_at).toLocaleString('fr-FR') },
        { id: 'type', header: 'Type', cell: r => r.type.replace(/_/g, ' ') },
        { id: 'amount', header: 'Montant', cell: r => <span style={{ color: r.amount >= 0 ? '#1f8f3f' : '#d91515', fontWeight: 600 }}>{r.amount >= 0 ? '+' : ''}{r.amount} cr.</span> },
        { id: 'balance', header: 'Solde après', cell: r => `${r.balance_after?.toFixed(2) ?? '—'} cr.` },
        { id: 'desc', header: 'Description', cell: r => r.description ?? '—' },
      ]}
      pagination={<Pagination currentPageIndex={page} pagesCount={Math.ceil(total / PAGE_SIZE)} onChange={e => setPage(e.detail.currentPageIndex)} />}
      header={<Header counter={`(${total})`}>Historique des transactions</Header>}
      empty={<Box textAlign="center">Aucune transaction</Box>}
    />
  );
}

export default function VendorCredits() {
  return (
    <ContentLayout header={<Header variant="h1">Crédits Marketing</Header>}>
      <Tabs
        tabs={[
          { id: 'packs', label: 'Packs de crédits', content: <PacksTab /> },
          { id: 'plans', label: 'Forfaits mensuels', content: <PlansTab /> },
          { id: 'history', label: 'Historique', content: <HistoryTab /> },
        ]}
      />
    </ContentLayout>
  );
}
