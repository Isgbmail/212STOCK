import { useEffect, useState } from 'react';
import {
  Box, Button, VStack, HStack, Text, Heading, Card, CardBody, CardHeader,
  Table, Thead, Tbody, Tr, Th, Td, Badge, useToast, Alert, AlertIcon,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  FormControl, FormLabel, Input, Select, Textarea, Progress,
} from '@chakra-ui/react';
import StorefrontLayout from '../../layouts/StorefrontLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { checkBuyerTierLimit, incrementBuyerUsage, ensureBuyerSubscription } from '../../lib/marketingHelpers';
import type { PromotionRequest } from '../../types/marketing';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS: Record<PromotionRequest['status'], string> = {
  pending: 'yellow', approved: 'green', rejected: 'red', auto_created: 'blue',
};
const STATUS_LABELS: Record<PromotionRequest['status'], string> = {
  pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée', auto_created: 'Créée automatiquement',
};

export default function BuyerTradeRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState({ allowed: true, used: 0, limit: 3, tierName: 'Free' });
  const [form, setForm] = useState({ product_id: '', type: 'trade' as 'trade' | 'flash_sale', desired_discount: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    await ensureBuyerSubscription(user.id);
    const [reqRes, lim] = await Promise.all([
      supabase.from('promotion_requests').select('*, products(name), profiles(full_name)').eq('buyer_id', user.id).order('created_at', { ascending: false }),
      checkBuyerTierLimit(user.id, 'requests'),
    ]);
    setRequests((reqRes.data ?? []) as PromotionRequest[]);
    setLimit(lim);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const submit = async () => {
    if (!user || !form.product_id) { toast({ title: 'ID produit requis', status: 'error' }); return; }
    const check = await checkBuyerTierLimit(user.id, 'requests');
    if (!check.allowed) {
      toast({ title: `Limite atteinte (${check.used}/${check.limit} ce mois)`, description: 'Passez à un tier supérieur pour plus de demandes', status: 'warning' });
      onClose(); return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('promotion_requests').insert({
      buyer_id: user.id,
      product_id: form.product_id,
      type: form.type,
      desired_discount: form.desired_discount ? Number(form.desired_discount) : null,
      notes: form.notes || null,
      status: 'pending',
    });
    if (error) {
      toast({ title: 'Erreur lors de la soumission', description: error.message, status: 'error' });
    } else {
      await incrementBuyerUsage(user.id, 'requests');
      toast({ title: 'Demande soumise !', status: 'success' });
      onClose();
      setForm({ product_id: '', type: 'trade', desired_discount: '', notes: '' });
      load();
    }
    setSubmitting(false);
  };

  const usagePct = limit.limit > 0 ? (limit.used / limit.limit) * 100 : 0;

  return (
    <StorefrontLayout>
      <Box p={6}>
        <Heading mb={2}>Mes demandes trade & flash sale</Heading>
        <Text color="gray.500" mb={6}>Soumettez des demandes de remises ou de ventes flash sur des produits spécifiques</Text>

        {/* Usage tier */}
        <Card mb={6} shadow="sm">
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="sm">Utilisation mensuelle — Tier <Badge colorScheme="blue">{limit.tierName}</Badge></Heading>
              <Button size="sm" variant="outline" colorScheme="blue" onClick={() => navigate('/buyer/tier-upgrade')}>Changer de tier</Button>
            </HStack>
          </CardHeader>
          <CardBody>
            <Text fontSize="sm" mb={2}>{limit.used} / {limit.limit} demandes ce mois</Text>
            <Progress value={usagePct} colorScheme={usagePct >= 100 ? 'red' : usagePct >= 80 ? 'yellow' : 'blue'} size="sm" />
            {!limit.allowed && (
              <Alert status="warning" mt={3}>
                <AlertIcon />
                Limite mensuelle atteinte. <Button variant="link" colorScheme="blue" onClick={() => navigate('/buyer/tier-upgrade')}>Passer au tier supérieur</Button> pour plus de demandes.
              </Alert>
            )}
          </CardBody>
        </Card>

        {/* Actions */}
        <HStack justify="flex-end" mb={4}>
          <Button
            colorScheme="blue"
            isDisabled={!limit.allowed}
            onClick={onOpen}
          >
            + Nouvelle demande
          </Button>
        </HStack>

        {/* Tableau */}
        <Card shadow="sm">
          <CardBody overflowX="auto">
            {loading ? <Text>Chargement…</Text> : requests.length === 0 ? (
              <Alert status="info"><AlertIcon />Aucune demande soumise.</Alert>
            ) : (
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Produit</Th>
                    <Th>Type</Th>
                    <Th>Remise souhaitée</Th>
                    <Th>Statut</Th>
                    <Th>Date</Th>
                    <Th>Notes</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {requests.map(r => (
                    <Tr key={r.id}>
                      <Td>{(r.products as { name: string } | null)?.name ?? r.product_id.slice(0, 8)}</Td>
                      <Td><Badge colorScheme={r.type === 'flash_sale' ? 'orange' : 'purple'}>{r.type === 'flash_sale' ? 'Flash sale' : 'Trade deal'}</Badge></Td>
                      <Td>{r.desired_discount ? `${r.desired_discount}%` : '—'}</Td>
                      <Td><Badge colorScheme={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge></Td>
                      <Td>{new Date(r.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td fontSize="xs" color="gray.500">{r.notes ?? '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Modal nouvelle demande */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Nouvelle demande</ModalHeader>
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>ID du produit</FormLabel>
                  <Input value={form.product_id} onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))} placeholder="UUID du produit" />
                </FormControl>
                <FormControl>
                  <FormLabel>Type de demande</FormLabel>
                  <Select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'trade' | 'flash_sale' }))}>
                    <option value="trade">Trade deal</option>
                    <option value="flash_sale">Flash sale</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Remise souhaitée (%)</FormLabel>
                  <Input type="number" value={form.desired_discount} onChange={e => setForm(p => ({ ...p, desired_discount: e.target.value }))} placeholder="Ex: 15" />
                </FormControl>
                <FormControl>
                  <FormLabel>Notes / justification</FormLabel>
                  <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Contexte de la demande..." />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>Annuler</Button>
              <Button colorScheme="blue" isLoading={submitting} onClick={submit}>Soumettre</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </StorefrontLayout>
  );
}
