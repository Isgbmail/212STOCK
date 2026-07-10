import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, Heading, HStack, VStack, Button, Badge,
  Progress, SimpleGrid, Divider,
} from '@chakra-ui/react';
import { Tag, Gavel, Star, TrendingUp, Gift, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ensureBuyerSubscription } from '../../lib/marketingHelpers';
import type { BuyerSubscription } from '../../types/marketing';

const C = { navy: '#0d1f38', amber: '#c97d1a', amberLight: '#fef9ee', amberBorder: '#f5d78e', border: '#e2e8f0' };

interface QuickLink {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
  color: string;
}

export default function BuyerMarketingWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<BuyerSubscription | null>(null);
  const [activeDeals, setActiveDeals] = useState(0);
  const [activeLots, setActiveLots] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await ensureBuyerSubscription(user.id);
      const [subRes, dealsRes, lotsRes] = await Promise.all([
        supabase.from('buyer_subscriptions').select('*, tiers(*)').eq('user_id', user.id).maybeSingle(),
        supabase.from('campaigns').select('id', { count: 'exact' }).eq('status', 'active').in('type', ['flash_sale', 'promo_code', 'volume_deal']),
        supabase.from('liquidation_lots').select('id', { count: 'exact' }).eq('status', 'active'),
      ]);
      setSub(subRes.data as BuyerSubscription | null);
      setActiveDeals(dealsRes.count ?? 0);
      setActiveLots(lotsRes.count ?? 0);
      setLoading(false);
    };
    load();
  }, [user]);

  const tierName = sub?.tiers?.name ?? 'Free';
  const tierColor = tierName === 'Enterprise' ? 'purple' : tierName === 'Pro' ? 'blue' : 'gray';
  const points = sub?.loyalty_points ?? 0;
  const requestsUsed = sub?.requests_used_this_month ?? 0;
  const requestsLimit = sub?.tiers?.max_requests_per_month ?? 3;

  const quickLinks: QuickLink[] = [
    { icon: <Gavel size={15} />, label: 'Enchères en cours', sub: `${activeLots} lot${activeLots > 1 ? 's' : ''} disponible${activeLots > 1 ? 's' : ''}`, href: '/buyer/liquidation', color: '#7c3aed' },
    { icon: <Tag size={15} />, label: 'Codes promo', sub: `${activeDeals} offre${activeDeals > 1 ? 's' : ''} active${activeDeals > 1 ? 's' : ''}`, href: '/', color: C.amber },
    { icon: <Gift size={15} />, label: 'Demandes trade', sub: `${requestsUsed}/${requestsLimit} utilisées`, href: '/buyer/trade-requests', color: '#0891b2' },
    { icon: <Star size={15} />, label: 'Fidélité', sub: `${points} point${points > 1 ? 's' : ''}`, href: '/buyer/loyalty', color: '#d97706' },
  ];

  if (loading) return null;

  return (
    <Box rounded="2xl" overflow="hidden" style={{ border: `1px solid ${C.border}` }} bg="white">
      {/* Header */}
      <Flex align="center" justify="space-between" px={5} py={4} style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #1a3355 100%)` }}>
        <HStack spacing={3}>
          <TrendingUp size={18} color="white" />
          <Heading size="sm" color="white">Mon espace marketing</Heading>
        </HStack>
        <Badge colorScheme={tierColor} fontSize="10px" fontWeight="800" px={2} py={0.5} rounded="full">
          Tier {tierName}
        </Badge>
      </Flex>

      <Box p={5}>
        <VStack spacing={4} align="stretch">
          {/* Tier + usage */}
          <Box>
            <Flex justify="space-between" align="center" mb={1}>
              <Text fontSize="12px" fontWeight="600" color="gray.500">Demandes trade ce mois</Text>
              <Text fontSize="11px" color="gray.400">{requestsUsed}/{requestsLimit}</Text>
            </Flex>
            <Progress
              value={requestsLimit > 0 ? (requestsUsed / requestsLimit) * 100 : 0}
              size="xs"
              colorScheme={requestsUsed >= requestsLimit ? 'red' : requestsUsed / requestsLimit > 0.7 ? 'yellow' : 'blue'}
              rounded="full"
            />
            {requestsUsed >= requestsLimit && (
              <Flex justify="flex-end" mt={1}>
                <Button
                  variant="link" size="xs" color={C.amber} fontWeight="700"
                  rightIcon={<ChevronRight size={10} />}
                  onClick={() => navigate('/buyer/tier-upgrade')}
                >
                  Passer au tier supérieur
                </Button>
              </Flex>
            )}
          </Box>

          {/* Points fidélité */}
          {points > 0 && (
            <>
              <Divider />
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Star size={13} color={C.amber} fill={C.amber} />
                  <Text fontSize="13px" fontWeight="600" color="gray.700">{points} points fidélité</Text>
                </HStack>
                <Button
                  variant="link" size="xs" color={C.amber} fontWeight="700"
                  rightIcon={<ChevronRight size={10} />}
                  onClick={() => navigate('/buyer/loyalty')}
                >
                  Échanger
                </Button>
              </HStack>
            </>
          )}

          <Divider />

          {/* Quick links */}
          <SimpleGrid columns={2} spacing={2}>
            {quickLinks.map(link => (
              <Flex
                key={link.href} align="center" gap={2} p={3} rounded="lg" cursor="pointer"
                style={{ border: `1px solid ${C.border}`, background: '#fafafa' }}
                _hover={{ bg: '#f0f4ff', borderColor: '#c7d7ff' }}
                transition="all 0.15s"
                onClick={() => navigate(link.href)}
              >
                <Box color={link.color}>{link.icon}</Box>
                <Box overflow="hidden">
                  <Text fontSize="11px" fontWeight="700" color="gray.700" noOfLines={1}>{link.label}</Text>
                  <Text fontSize="10px" color="gray.400" noOfLines={1}>{link.sub}</Text>
                </Box>
              </Flex>
            ))}
          </SimpleGrid>
        </VStack>
      </Box>
    </Box>
  );
}
