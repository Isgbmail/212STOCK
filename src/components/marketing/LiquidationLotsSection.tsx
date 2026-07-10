import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, Heading, HStack, VStack, Button, Badge,
  SimpleGrid, useToast, NumberInput, NumberInputField,
} from '@chakra-ui/react';
import { Gavel, Tag, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CountdownTimer from './CountdownTimer';
import type { LiquidationLot } from '../../types/marketing';

const C = { navy: '#0d1f38', amber: '#c97d1a', red: '#dc2626', redLight: '#fef2f2', redBorder: '#fecaca', border: '#e2e8f0', bgAlt: '#f8fafc' };

interface LotCardProps {
  lot: LiquidationLot;
  onBid: (lot: LiquidationLot, amount: number) => Promise<void>;
  onBuyNow: (lot: LiquidationLot) => Promise<void>;
  bidding: string | null;
  buying: string | null;
}

function LotCard({ lot, onBid, onBuyNow, bidding, buying }: LotCardProps) {
  const [bidAmount, setBidAmount] = useState('');
  const minBid = lot.current_bid > 0 ? lot.current_bid + 1 : (lot.start_price ?? 1);

  return (
    <Box
      bg="white" rounded="xl" overflow="hidden"
      style={{ border: `1px solid ${C.border}` }}
      transition="box-shadow 0.2s"
      _hover={{ boxShadow: 'md' }}
    >
      {/* Type badge */}
      <Box px={4} pt={3} pb={2}>
        <HStack justify="space-between" mb={2}>
          <Badge
            colorScheme={lot.sale_type === 'auction' ? 'purple' : 'green'}
            fontSize="9px" fontWeight="800" letterSpacing="0.8px" textTransform="uppercase"
          >
            {lot.sale_type === 'auction' ? '🔨 Enchère' : '🏷️ Prix fixe'}
          </Badge>
          {lot.quantity > 1 && <Badge colorScheme="blue" fontSize="9px">Qté: {lot.quantity}</Badge>}
        </HStack>

        <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }} noOfLines={2} mb={1}>
          {lot.title}
        </Text>
        <Text fontSize="11px" color="gray.400">
          par {(lot.profiles as { full_name: string | null } | null)?.full_name ?? 'Vendeur'}
        </Text>
      </Box>

      {/* Pricing */}
      <Box px={4} pb={3} style={{ borderTop: `1px solid ${C.border}` }} pt={2}>
        {lot.sale_type === 'auction' ? (
          <VStack align="start" spacing={0.5} mb={2}>
            <Text fontSize="10px" color="gray.400" fontWeight="600">Enchère actuelle</Text>
            <Text fontSize="xl" fontWeight="800" style={{ color: lot.bid_count > 0 ? C.red : C.navy }}>
              {lot.current_bid > 0 ? `${lot.current_bid} ${lot.currency}` : `À partir de ${lot.start_price} ${lot.currency}`}
            </Text>
            {lot.bid_count > 0 && <Text fontSize="10px" color="gray.400">{lot.bid_count} offre(s)</Text>}
            {lot.auction_end_at && (
              <HStack spacing={1} mt={0.5}>
                <Clock size={10} color={C.red} />
                <CountdownTimer endsAt={lot.auction_end_at} />
              </HStack>
            )}
          </VStack>
        ) : (
          <VStack align="start" spacing={0.5} mb={2}>
            <Text fontSize="10px" color="gray.400" fontWeight="600">Prix</Text>
            <Text fontSize="xl" fontWeight="800" style={{ color: C.navy }}>
              {lot.buy_now_price} {lot.currency}
            </Text>
          </VStack>
        )}

        {/* CTA */}
        <VStack spacing={1.5}>
          {lot.sale_type === 'auction' && (
            <HStack w="full">
              <NumberInput min={minBid} value={bidAmount} onChange={setBidAmount} size="sm" flex={1}>
                <NumberInputField placeholder={`Min ${minBid} ${lot.currency}`} fontSize="12px" />
              </NumberInput>
              <Button
                size="sm" colorScheme="purple" px={3} fontSize="12px"
                isLoading={bidding === lot.id}
                isDisabled={!bidAmount || Number(bidAmount) < minBid}
                onClick={() => onBid(lot, Number(bidAmount))}
              >
                Enchérir
              </Button>
            </HStack>
          )}
          {lot.buy_now_price && (
            <Button
              w="full" size="sm" colorScheme="green" fontSize="12px"
              isLoading={buying === lot.id}
              onClick={() => onBuyNow(lot)}
            >
              Acheter — {lot.buy_now_price} {lot.currency}
            </Button>
          )}
        </VStack>
      </Box>
    </Box>
  );
}

interface Props {
  lots: LiquidationLot[];
}

export default function LiquidationLotsSection({ lots }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [bidding, setBidding] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [localLots, setLocalLots] = useState<LiquidationLot[]>(lots);

  const handleBid = async (lot: LiquidationLot, amount: number) => {
    if (!user) { navigate('/auth'); return; }
    const minBid = lot.current_bid > 0 ? lot.current_bid + 1 : (lot.start_price ?? 1);
    if (amount < minBid) { toast({ title: `Enchère min: ${minBid} ${lot.currency}`, status: 'error' }); return; }
    setBidding(lot.id);
    await supabase.from('liquidation_bids').insert({ lot_id: lot.id, bidder_id: user.id, amount, is_winning: false });
    await supabase.from('liquidation_lots').update({ current_bid: amount, bid_count: lot.bid_count + 1 }).eq('id', lot.id);
    setLocalLots(prev => prev.map(l => l.id === lot.id ? { ...l, current_bid: amount, bid_count: l.bid_count + 1 } : l));
    toast({ title: 'Enchère placée !', description: `${amount} ${lot.currency}`, status: 'success', duration: 3000 });
    setBidding(null);
  };

  const handleBuyNow = async (lot: LiquidationLot) => {
    if (!user) { navigate('/auth'); return; }
    setBuying(lot.id);
    await supabase.from('liquidation_lots').update({ status: 'sold', winner_buyer_id: user.id }).eq('id', lot.id);
    setLocalLots(prev => prev.filter(l => l.id !== lot.id));
    toast({ title: 'Achat confirmé !', description: `"${lot.title}" vous appartient`, status: 'success', duration: 4000 });
    setBuying(null);
  };

  const displayLots = localLots.length > 0 ? localLots : lots;
  if (displayLots.length === 0) return null;

  return (
    <Box pt={8} pb={6} style={{ background: '#f5f0ff', borderBottom: `8px solid ${C.bgAlt}` }}>
      <Box maxW="1400px" mx="auto" px={5}>
        {/* Header */}
        <Flex align="center" justify="space-between" mb={6}>
          <HStack spacing={3}>
            <Box
              w={9} h={9} rounded="lg" display="flex" alignItems="center" justifyContent="center"
              style={{ background: '#7c3aed' }}
            >
              <Gavel size={18} color="white" />
            </Box>
            <Box>
              <Text fontSize="10px" fontWeight="800" letterSpacing="2px" textTransform="uppercase" mb={0.5} style={{ color: '#7c3aed' }}>
                Liquidation & Déstockage
              </Text>
              <Heading size="md" fontWeight="800" style={{ color: C.navy }}>
                Lots disponibles maintenant
              </Heading>
            </Box>
          </HStack>
          <Button
            variant="ghost" size="sm" fontWeight="600" fontSize="sm" color="gray.500"
            rightIcon={<ChevronRight size={13} />}
            _hover={{ color: '#7c3aed', bg: 'transparent' }}
            onClick={() => navigate('/buyer/liquidation')}
          >
            Voir tout
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
          {displayLots.slice(0, 8).map(lot => (
            <LotCard
              key={lot.id} lot={lot}
              onBid={handleBid} onBuyNow={handleBuyNow}
              bidding={bidding} buying={buying}
            />
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
