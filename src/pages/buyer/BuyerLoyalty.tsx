import { useEffect, useState } from 'react';
import {
  Box, Button, VStack, HStack, Text, Heading, Card, CardBody, CardHeader,
  Table, Thead, Tbody, Tr, Th, Td, Badge, Divider, useToast, Alert, AlertIcon,
  SimpleGrid, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, NumberInput, NumberInputField, FormControl, FormLabel,
} from '@chakra-ui/react';
import StorefrontLayout from '../../layouts/StorefrontLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { addLoyaltyPoints } from '../../lib/marketingHelpers';
import type { LoyaltyTransaction } from '../../types/marketing';

const REDEEM_OPTIONS = [
  { label: '50 pts → 1 demande supplémentaire', points: 50, type: 'redeem_requests' as const, benefit: '1 demande' },
  { label: '100 pts → 5 crédits marketing vendeur', points: 100, type: 'redeem_credits' as const, benefit: '5 crédits' },
  { label: '200 pts → 3 demandes supplémentaires', points: 200, type: 'redeem_requests' as const, benefit: '3 demandes' },
];

export default function BuyerLoyalty() {
  const { user } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<typeof REDEEM_OPTIONS[0] | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [sub, txns] = await Promise.all([
      supabase.from('buyer_subscriptions').select('loyalty_points').eq('user_id', user.id).single(),
      supabase.from('loyalty_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setBalance((sub.data as { loyalty_points: number } | null)?.loyalty_points ?? 0);
    setHistory((txns.data ?? []) as LoyaltyTransaction[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const redeem = async () => {
    if (!user || !selectedOption) return;
    if (balance < selectedOption.points) {
      toast({ title: 'Points insuffisants', status: 'error' }); return;
    }
    setRedeeming(selectedOption.label);
    await addLoyaltyPoints(user.id, -selectedOption.points, selectedOption.type, undefined, `Échange: ${selectedOption.benefit}`);
    if (selectedOption.type === 'redeem_requests') {
      const inc = selectedOption.points === 50 ? 1 : 3;
      const { data: sub } = await supabase.from('buyer_subscriptions').select('requests_used_this_month').eq('user_id', user.id).single();
      const current = (sub as { requests_used_this_month: number } | null)?.requests_used_this_month ?? 0;
      await supabase.from('buyer_subscriptions').update({ requests_used_this_month: Math.max(0, current - inc) }).eq('user_id', user.id);
    }
    toast({ title: `Échange réussi ! ${selectedOption.benefit} obtenu(e)`, status: 'success' });
    setRedeeming(null); onClose(); setSelectedOption(null); load();
  };

  const txTypeLabel: Record<LoyaltyTransaction['type'], string> = {
    earn_order: 'Commande',
    redeem_requests: 'Échange demandes',
    redeem_credits: 'Échange crédits',
    admin_adjust: 'Ajustement admin',
  };

  return (
    <StorefrontLayout>
      <Box p={6}>
        <Heading mb={2}>Programme de fidélité</Heading>
        <Text color="gray.500" mb={6}>Gagnez des points sur vos commandes et échangez-les contre des avantages</Text>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
          {/* Solde */}
          <Card shadow="md" borderRadius="lg">
            <CardHeader><Heading size="md">Votre solde</Heading></CardHeader>
            <CardBody>
              <VStack align="start" spacing={2}>
                <HStack align="baseline">
                  <Text fontSize="4xl" fontWeight="bold" color="gold">{loading ? '…' : balance}</Text>
                  <Text fontSize="lg" color="gray.500">points</Text>
                </HStack>
                <Text fontSize="sm" color="gray.400">Chaque € dépensé = points fidélité</Text>
                <Button colorScheme="yellow" onClick={onOpen} isDisabled={balance < 50}>Échanger des points</Button>
              </VStack>
            </CardBody>
          </Card>

          {/* Comment gagner */}
          <Card shadow="sm">
            <CardHeader><Heading size="md">Comment gagner des points ?</Heading></CardHeader>
            <CardBody>
              <VStack align="start" spacing={2} fontSize="sm">
                <Text>🛒 Commandes validées → points calculés automatiquement</Text>
                <Text>📦 Réception confirmée → bonus fidélité</Text>
                <Text>⭐ Avis produit → bonus ponctuel</Text>
                <Divider />
                <Text fontWeight="medium">Taux : configuré par l'admin dans les paramètres marketing</Text>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Historique */}
        <Card shadow="sm">
          <CardHeader><Heading size="md">Historique des transactions</Heading></CardHeader>
          <CardBody overflowX="auto">
            {loading ? <Text>Chargement…</Text> : history.length === 0 ? (
              <Alert status="info"><AlertIcon />Aucune transaction de fidélité pour l'instant.</Alert>
            ) : (
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Points</Th>
                    <Th>Solde après</Th>
                    <Th>Description</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {history.map(t => (
                    <Tr key={t.id}>
                      <Td>{new Date(t.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td><Badge colorScheme={t.points > 0 ? 'green' : 'red'}>{txTypeLabel[t.type]}</Badge></Td>
                      <Td fontWeight="bold" color={t.points > 0 ? 'green.500' : 'red.500'}>{t.points > 0 ? '+' : ''}{t.points}</Td>
                      <Td>{t.balance_after ?? '—'}</Td>
                      <Td fontSize="xs" color="gray.500">{t.description ?? '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Modal échange */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Échanger des points</ModalHeader>
            <ModalBody>
              <VStack spacing={3}>
                <Text>Votre solde : <strong>{balance} points</strong></Text>
                {REDEEM_OPTIONS.map(opt => (
                  <Button
                    key={opt.label}
                    w="full"
                    variant={selectedOption?.label === opt.label ? 'solid' : 'outline'}
                    colorScheme="yellow"
                    isDisabled={balance < opt.points}
                    onClick={() => setSelectedOption(opt)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>Annuler</Button>
              <Button colorScheme="yellow" isLoading={!!redeeming} isDisabled={!selectedOption} onClick={redeem}>Confirmer l'échange</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </StorefrontLayout>
  );
}
