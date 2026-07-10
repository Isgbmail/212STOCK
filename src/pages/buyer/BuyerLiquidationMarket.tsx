import { useEffect, useState } from 'react';
import { Box, Button, Input, SimpleGrid, VStack, HStack, Badge, Text, Heading, Card, CardBody, CardFooter, Divider, useToast, Alert, AlertIcon, NumberInput, NumberInputField } from '@chakra-ui/react';
import StorefrontLayout from '../../layouts/StorefrontLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CountdownTimer from '../../components/marketing/CountdownTimer';
import type { LiquidationLot } from '../../types/marketing';

export default function BuyerLiquidationMarket() {
  const { user } = useAuth();
  const toast = useToast();
  const [lots, setLots] = useState<LiquidationLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [bidding, setBidding] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('liquidation_lots')
      .select('*, profiles(full_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setLots((data ?? []) as LiquidationLot[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const placeBid = async (lot: LiquidationLot) => {
    if (!user) return;
    const amount = Number(bidAmounts[lot.id]);
    const minBid = lot.current_bid > 0 ? lot.current_bid + 1 : (lot.start_price ?? 1);
    if (!amount || amount < minBid) {
      toast({ title: `L'enchère minimum est ${minBid} ${lot.currency}`, status: 'error' });
      return;
    }
    setBidding(lot.id);
    const { error } = await supabase.from('liquidation_bids').insert({
      lot_id: lot.id, bidder_id: user.id, amount, is_winning: false,
    });
    if (error) {
      toast({ title: 'Erreur lors de l\'enchère', description: error.message, status: 'error' });
    } else {
      await supabase.from('liquidation_lots').update({ current_bid: amount, bid_count: lot.bid_count + 1 }).eq('id', lot.id);
      toast({ title: 'Enchère placée !', description: `Vous avez enchéri ${amount} ${lot.currency}`, status: 'success' });
      load();
    }
    setBidding(null);
  };

  const buyNow = async (lot: LiquidationLot) => {
    if (!user || !lot.buy_now_price) return;
    setBuying(lot.id);
    await supabase.from('liquidation_lots').update({ status: 'sold', winner_buyer_id: user.id }).eq('id', lot.id);
    toast({ title: 'Achat confirmé !', description: `Vous avez acheté "${lot.title}" pour ${lot.buy_now_price} ${lot.currency}`, status: 'success' });
    load();
    setBuying(null);
  };

  return (
    <StorefrontLayout>
      <Box p={6}>
        <Heading mb={4}>Marché de liquidation</Heading>
        <Text color="gray.500" mb={6}>Profitez d'offres exceptionnelles sur des lots en déstockage</Text>
        {loading ? (
          <Text>Chargement…</Text>
        ) : lots.length === 0 ? (
          <Alert status="info"><AlertIcon />Aucun lot disponible en ce moment. Revenez bientôt !</Alert>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {lots.map(lot => (
              <Card key={lot.id} shadow="md" borderRadius="lg">
                <CardBody>
                  <VStack align="start" spacing={2}>
                    <HStack justify="space-between" w="full">
                      <Badge colorScheme={lot.sale_type === 'auction' ? 'purple' : 'green'}>
                        {lot.sale_type === 'auction' ? '🔨 Enchère' : '🏷️ Prix fixe'}
                      </Badge>
                      {lot.quantity > 1 && <Badge colorScheme="blue">Qté: {lot.quantity}</Badge>}
                    </HStack>
                    <Heading size="sm">{lot.title}</Heading>
                    {lot.description && <Text fontSize="sm" color="gray.600" noOfLines={2}>{lot.description}</Text>}
                    <Text fontSize="xs" color="gray.500">Vendeur: {(lot.profiles as { full_name: string | null } | null)?.full_name ?? '—'}</Text>
                    <Divider />
                    {lot.sale_type === 'auction' && (
                      <VStack align="start" w="full" spacing={1}>
                        <Text fontSize="sm" color="gray.500">Enchère actuelle</Text>
                        <Text fontWeight="bold" fontSize="xl">{lot.current_bid > 0 ? `${lot.current_bid} ${lot.currency}` : `Départ: ${lot.start_price} ${lot.currency}`}</Text>
                        <Text fontSize="xs" color="gray.400">{lot.bid_count} enchère(s)</Text>
                        {lot.auction_end_at && (
                          <HStack><Text fontSize="xs">Fin dans:</Text><CountdownTimer endsAt={lot.auction_end_at} onExpire={load} /></HStack>
                        )}
                      </VStack>
                    )}
                    {lot.buy_now_price && (
                      <Text><Text as="span" fontSize="sm" color="gray.500">Prix direct:</Text> <Text as="span" fontWeight="bold" color="green.500">{lot.buy_now_price} {lot.currency}</Text></Text>
                    )}
                  </VStack>
                </CardBody>
                <CardFooter>
                  <VStack w="full" spacing={2}>
                    {lot.sale_type === 'auction' && (
                      <HStack w="full">
                        <NumberInput min={0} value={bidAmounts[lot.id] ?? ''} onChange={val => setBidAmounts(p => ({ ...p, [lot.id]: val }))} flex={1}>
                          <NumberInputField placeholder={`Min ${lot.current_bid > 0 ? lot.current_bid + 1 : lot.start_price ?? 1} ${lot.currency}`} />
                        </NumberInput>
                        <Button colorScheme="purple" loading={bidding === lot.id} onClick={() => placeBid(lot)} size="sm">Enchérir</Button>
                      </HStack>
                    )}
                    {lot.buy_now_price && (
                      <Button colorScheme="green" w="full" isLoading={buying === lot.id} onClick={() => buyNow(lot)}>
                        Acheter maintenant — {lot.buy_now_price} {lot.currency}
                      </Button>
                    )}
                  </VStack>
                </CardFooter>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </StorefrontLayout>
  );
}
