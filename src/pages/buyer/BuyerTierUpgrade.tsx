import { useEffect, useState } from 'react';
import {
  Box, Button, VStack, HStack, Badge, Text, Heading, Card, CardBody,
  CardHeader, SimpleGrid, Progress, Divider, useToast, Alert, AlertIcon,
} from '@chakra-ui/react';
import StorefrontLayout from '../../layouts/StorefrontLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ensureBuyerSubscription } from '../../lib/marketingHelpers';
import type { Tier, BuyerSubscription } from '../../types/marketing';

export default function BuyerTierUpgrade() {
  const { user } = useAuth();
  const toast = useToast();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sub, setSub] = useState<BuyerSubscription | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await ensureBuyerSubscription(user.id);
      const [t, s] = await Promise.all([
        supabase.from('tiers').select('*').eq('active', true).order('display_order'),
        supabase.from('buyer_subscriptions').select('*, tiers(*)').eq('user_id', user.id).single(),
      ]);
      setTiers((t.data ?? []) as Tier[]);
      setSub(s.data as BuyerSubscription | null);
      setLoading(false);
    };
    load();
  }, [user]);

  const upgrade = async (tier: Tier) => {
    if (!user) return;
    setUpgrading(tier.id);
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
    await supabase.from('buyer_subscriptions').update({
      tier_id: tier.id,
      end_date: tier.monthly_price === 0 ? null : nextMonth.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
    toast({ title: `Passé au tier ${tier.name} !`, status: 'success' });
    // Reload
    const { data } = await supabase.from('buyer_subscriptions').select('*, tiers(*)').eq('user_id', user.id).single();
    setSub(data as BuyerSubscription | null);
    setUpgrading(null);
  };

  const currentTierName = sub?.tiers?.name ?? 'Free';
  const usageItems = sub ? [
    { label: 'Demandes trade', used: sub.requests_used_this_month, limit: sub.tiers?.max_requests_per_month ?? 3 },
    { label: 'Campagnes actives', used: sub.campaigns_used_this_month, limit: sub.tiers?.max_active_campaigns ?? 1 },
    { label: 'Échantillons', used: sub.samples_used_this_month, limit: sub.tiers?.max_samples_per_month ?? 1 },
    { label: 'RFQ publiés', used: sub.rfq_used_this_month, limit: sub.tiers?.max_rfq_per_month ?? 5 },
  ] : [];

  return (
    <StorefrontLayout>
      <Box p={6}>
        <Heading mb={2}>Mon abonnement acheteur</Heading>
        <Text color="gray.500" mb={6}>Gérez votre tier et consultez votre utilisation mensuelle</Text>

        {/* Utilisation actuelle */}
        {sub && (
          <Card mb={6} shadow="sm">
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">Utilisation ce mois — Tier <Badge colorScheme="blue">{currentTierName}</Badge></Heading>
                <Text fontSize="sm" color="gray.500">Points fidélité: <strong>{sub.loyalty_points}</strong></Text>
              </HStack>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                {usageItems.map(item => (
                  <Box key={item.label}>
                    <Text fontSize="sm" fontWeight="medium" mb={1}>{item.label}</Text>
                    <Progress value={(item.used / item.limit) * 100} colorScheme={item.used >= item.limit ? 'red' : 'blue'} size="sm" mb={1} />
                    <Text fontSize="xs" color="gray.500">{item.used} / {item.limit}</Text>
                  </Box>
                ))}
              </SimpleGrid>
            </CardBody>
          </Card>
        )}

        {/* Tiers disponibles */}
        {loading ? <Text>Chargement…</Text> : (
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            {tiers.map(tier => {
              const isCurrent = currentTierName === tier.name;
              const isUpgrade = tiers.findIndex(t => t.name === currentTierName) < tiers.findIndex(t => t.name === tier.name);
              return (
                <Card key={tier.id} borderWidth={isCurrent ? 2 : 1} borderColor={isCurrent ? 'blue.400' : 'gray.200'} shadow={isCurrent ? 'lg' : 'sm'}>
                  <CardHeader>
                    <HStack justify="space-between">
                      <Heading size="md">{tier.name}</Heading>
                      {isCurrent && <Badge colorScheme="blue">Actif</Badge>}
                    </HStack>
                    <Text fontSize="xl" fontWeight="bold" color={tier.monthly_price > 0 ? 'blue.600' : 'gray.600'}>
                      {tier.monthly_price > 0 ? `${tier.monthly_price} €/mois` : 'Gratuit'}
                    </Text>
                  </CardHeader>
                  <CardBody>
                    <VStack align="start" spacing={1} fontSize="sm">
                      <Text>✓ {tier.max_requests_per_month} demandes/mois</Text>
                      <Text>✓ {tier.max_active_campaigns} campagnes actives</Text>
                      <Text>✓ {tier.max_samples_per_month} échantillon(s)/mois</Text>
                      <Text>✓ {tier.max_rfq_per_month} RFQ/mois</Text>
                      {tier.priority_queue && <Text>✓ File prioritaire</Text>}
                      {tier.analytics_access && <Text>✓ Accès analytics avancés</Text>}
                    </VStack>
                    <Divider my={3} />
                    <Button
                      colorScheme={isUpgrade ? 'blue' : isCurrent ? 'gray' : 'orange'}
                      w="full"
                      isLoading={upgrading === tier.id}
                      isDisabled={isCurrent}
                      onClick={() => upgrade(tier)}
                    >
                      {isCurrent ? 'Tier actuel' : isUpgrade ? 'Passer à ce tier' : 'Rétrograder'}
                    </Button>
                  </CardBody>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Box>
    </StorefrontLayout>
  );
}
