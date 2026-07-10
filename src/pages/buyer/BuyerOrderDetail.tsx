import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, VStack, HStack, Text, Heading, Button, Flex,
  Skeleton, Divider, SimpleGrid, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Select, Textarea, Checkbox,
  NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
} from '@chakra-ui/react';
import {
  ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle, AlertTriangle,
  Download, FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateBonCommandePDF, generateBonRetourPDF } from '../../lib/pdf/pdfUtils';
import type { Order, OrderLine, DeliveryTicket } from '../../types';

const C = {
  navy: '#0d1f38', navyMid: '#1a3558',
  slate: '#334155', muted: '#64748b',
  border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#1a5c35', greenLight: '#dcfce7',
  amber: '#92400e', amberLight: '#fef3c7',
  red: '#be1c1c', redLight: '#fff1f1',
  blue: '#1e40af', blueLight: '#dbeafe',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: React.ElementType }> = {
  pending:        { label: 'En attente',      color: C.amber, bg: C.amberLight, dot: '#f59e0b', icon: Clock },
  confirmed:      { label: 'Confirmée',       color: C.blue,  bg: C.blueLight,  dot: '#3b82f6', icon: CheckCircle },
  in_preparation: { label: 'En préparation',  color: '#4a1d96', bg: '#ede9fe',  dot: '#8b5cf6', icon: Package },
  shipped:        { label: 'Expédiée',        color: '#7c2d12', bg: '#ffedd5',  dot: '#f97316', icon: Truck },
  delivered:      { label: 'Livrée',          color: C.green, bg: C.greenLight, dot: '#22c55e', icon: CheckCircle },
  cancelled:      { label: 'Annulée',         color: C.red,   bg: C.redLight,   dot: '#ef4444', icon: XCircle },
  dispute:        { label: 'Litige',          color: C.red,   bg: C.redLight,   dot: '#ef4444', icon: AlertTriangle },
};

const DELIVERY_PREF_LABELS: Record<string, string> = {
  standard:   'Standard — 3–5 jours ouvrés',
  express:    'Express — 24–48h',
  cold_chain: 'Chaîne du froid — camion frigorifique ATP',
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'En attente de livreur',
  assigned: 'Livreur assigné',
  picked_up: 'Colis enlevé',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

export default function BuyerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [ticket, setTicket] = useState<DeliveryTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('damaged');
  const [returnRefundType, setReturnRefundType] = useState('avoir');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnItems, setReturnItems] = useState<{
    order_line_id: string; product_name_snap: string; product_id: string;
    max_qty: number; qty_return: number; unit_price_ht: number; selected: boolean;
  }[]>([]);
  const [returnLoading, setReturnLoading] = useState(false);

  useEffect(() => {
    setReturnItems(lines.map((l) => ({
      order_line_id: l.id,
      product_name_snap: l.product_name_snap,
      product_id: l.product_id,
      max_qty: l.quantity,
      qty_return: l.quantity,
      unit_price_ht: Number(l.unit_price_ht),
      selected: false,
    })));
  }, [lines]);

  async function handleDownloadBC() {
    if (!id) return;
    setPdfLoading(true);
    try {
      await generateBonCommandePDF(id);
    } catch (e) {
      toast({ title: 'Erreur PDF', description: e instanceof Error ? e.message : 'Erreur inconnue', status: 'error', duration: 3000, position: 'bottom-right' });
    } finally {
      setPdfLoading(false);
    }
  }

  async function requestReturn() {
    if (!order) return;
    setReturnLoading(true);
    try {
      const selected = returnItems.filter((l) => l.selected && l.qty_return > 0);
      if (selected.length === 0) {
        toast({ title: 'Aucun article sélectionné', status: 'warning', duration: 3000, position: 'bottom-right' });
        setReturnLoading(false);
        return;
      }
      const returnNumber = `BRM-${Date.now().toString().slice(-8)}`;
      const { data: ret, error: retErr } = await supabase
        .from('order_returns')
        .insert({
          return_number: returnNumber,
          order_id: order.id,
          buyer_org_id: (order as any).buyer_org_id,
          seller_org_id: (order as any).seller_org_id,
          reason: returnReason,
          refund_type: returnRefundType,
          notes: returnNotes || null,
        })
        .select('id')
        .single();
      if (retErr) throw retErr;
      const { error: linesErr } = await supabase.from('return_lines').insert(
        selected.map((l) => ({
          return_id: (ret as any).id,
          product_name_snap: l.product_name_snap,
          product_id: l.product_id,
          quantity_requested: l.qty_return,
          unit_price_ht: l.unit_price_ht,
        }))
      );
      if (linesErr) throw linesErr;
      await generateBonRetourPDF((ret as any).id);
      setReturnModal(false);
      toast({ title: 'Retour soumis', description: `Référence : ${returnNumber}`, status: 'success', duration: 4000, position: 'bottom-right' });
    } catch (e: unknown) {
      toast({ title: 'Erreur retour', description: (e as { message?: string })?.message ?? 'Erreur', status: 'error', duration: 5000, position: 'bottom-right' });
    } finally {
      setReturnLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      const [orderRes, linesRes, ticketRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, organisations!seller_org_id(id, name, org_type)')
          .eq('id', id)
          .single(),
        supabase
          .from('order_lines')
          .select('*, products(name, ean)')
          .eq('order_id', id)
          .order('created_at'),
        supabase
          .from('delivery_tickets')
          .select('*')
          .eq('order_id', id)
          .not('status', 'eq', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setOrder((orderRes.data as Order) ?? null);
      setLines((linesRes.data as OrderLine[]) ?? []);
      setTicket((ticketRes.data as DeliveryTicket) ?? null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <VStack spacing={4} align="stretch" maxW="800px" mx="auto" px={4} py={8}>
        <Skeleton h="32px" w="200px" />
        <Skeleton h="200px" rounded="2xl" />
        <Skeleton h="300px" rounded="2xl" />
      </VStack>
    );
  }

  if (!order) {
    return (
      <Flex direction="column" align="center" justify="center" minH="60vh" gap={4}>
        <Text color={C.muted} fontWeight="medium">Commande introuvable.</Text>
        <Button size="sm" onClick={() => navigate('/buyer/orders')}
          style={{ background: C.navy, color: 'white' }} rounded="full">
          Retour aux commandes
        </Button>
      </Flex>
    );
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const seller = (order as any).organisations;
  const delivAddr = order.delivery_address as Record<string, string>;

  return (
    <VStack spacing={6} align="stretch" maxW="800px" mx="auto" px={{ base: 4, md: 6 }} py={8}>
      {/* Header */}
      <Flex align="flex-start" justify="space-between" gap={3}>
        <Box>
          <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
            style={{ color: C.muted }} mb={2} onClick={() => navigate('/buyer/orders')}>
            Mes commandes
          </Button>
          <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>
            {order.order_number}
          </Heading>
          <Text fontSize="sm" style={{ color: C.muted }}>
            {new Date(order.created_at).toLocaleString('fr-FR')}
          </Text>
        </Box>
        <VStack spacing={2} align="flex-end">
          {/* Status badge */}
          <Flex align="center" gap={2} px={4} py={2.5} rounded="xl"
            style={{ background: cfg.bg, border: `1.5px solid ${cfg.dot}55` }}>
            <StatusIcon size={16} color={cfg.color} />
            <Text fontWeight="700" fontSize="sm" style={{ color: cfg.color }}>{cfg.label}</Text>
          </Flex>
          {/* Download buttons */}
          <HStack spacing={2} flexWrap="wrap" justify="flex-end">
            <Button
              size="xs" variant="outline" rounded="lg"
              leftIcon={<FileText size={12} />}
              isLoading={pdfLoading}
              onClick={handleDownloadBC}
              style={{ borderColor: C.border, color: C.slate }}
              _hover={{ background: C.bgAlt }}
            >
              Bon de commande
            </Button>
            {order.status === 'delivered' && (
              <Button
                size="xs" rounded="lg"
                leftIcon={<Package size={12} />}
                onClick={() => setReturnModal(true)}
                style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', color: '#c2410c' }}
                _hover={{ background: '#ffedd5' }}
              >
                Retourner des articles
              </Button>
            )}
          </HStack>
        </VStack>
      </Flex>

      {/* Infos générales */}
      <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
        <Text fontWeight="800" fontSize="sm" textTransform="uppercase" letterSpacing="0.5px"
          style={{ color: C.muted }} mb={4}>
          Informations de commande
        </Text>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <Box>
            <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Vendeur</Text>
            <Text fontWeight="600" style={{ color: C.navy }}>{seller?.name ?? '—'}</Text>
          </Box>
          <Box>
            <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Mode de paiement</Text>
            <Text style={{ color: C.slate }}>{order.payment_terms ?? '—'}</Text>
          </Box>
          <Box>
            <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Livraison</Text>
            <Text style={{ color: C.slate }}>{DELIVERY_PREF_LABELS[order.delivery_preference] ?? order.delivery_preference}</Text>
          </Box>
          {order.notes && (
            <Box>
              <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Notes</Text>
              <Text fontSize="sm" style={{ color: C.slate }}>{order.notes}</Text>
            </Box>
          )}
        </SimpleGrid>

        {Object.keys(delivAddr ?? {}).length > 0 && (
          <Box mt={4} pt={4} style={{ borderTop: `1px solid ${C.border}` }}>
            <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Adresse de livraison</Text>
            <Text style={{ color: C.slate }}>
              {[delivAddr.line1, delivAddr.city, delivAddr.postal_code, delivAddr.country].filter(Boolean).join(', ')}
            </Text>
          </Box>
        )}
      </Box>

      {/* Suivi livraison */}
      {ticket && (
        <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
          <HStack spacing={2} mb={4}>
            <Truck size={16} color={C.navy} />
            <Text fontWeight="800" fontSize="sm" textTransform="uppercase" letterSpacing="0.5px"
              style={{ color: C.muted }}>
              Suivi de livraison
            </Text>
          </HStack>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
            <Box>
              <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>N° Ticket</Text>
              <Text fontWeight="600" style={{ color: C.navy }}>{ticket.ticket_number}</Text>
            </Box>
            <Box>
              <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Statut transport</Text>
              <Text fontWeight="600" style={{ color: C.slate }}>{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</Text>
            </Box>
            <Box>
              <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Priorité</Text>
              <Text style={{ color: ticket.priority === 'express' ? C.red : C.slate }}>
                {ticket.priority === 'express' ? '⚡ Express' : 'Normal'}
              </Text>
            </Box>
            {(ticket.parcel_details as Record<string, string>)?.tracking_ref && (
              <Box>
                <Text fontSize="11px" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1}>Réf. de suivi</Text>
                <Text fontFamily="mono" fontSize="sm" style={{ color: C.navy }}>
                  {(ticket.parcel_details as Record<string, string>).tracking_ref}
                </Text>
              </Box>
            )}
          </SimpleGrid>
        </Box>
      )}

      {/* Lignes de commande */}
      <Box bg="white" rounded="2xl" p={6} style={{ border: `1px solid ${C.border}` }}>
        <Text fontWeight="800" fontSize="sm" textTransform="uppercase" letterSpacing="0.5px"
          style={{ color: C.muted }} mb={4}>
          Articles commandés ({lines.length})
        </Text>

        {lines.length === 0 ? (
          <Text fontSize="sm" style={{ color: C.muted }}>
            Détail des articles non disponible pour cette commande.
          </Text>
        ) : (
          <VStack spacing={0} align="stretch">
            {/* Header */}
            <Flex px={3} py={2} style={{ background: C.bgAlt, borderRadius: '8px 8px 0 0', borderBottom: `1px solid ${C.border}` }}>
              <Text flex={3} fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.8px" style={{ color: C.muted }}>Produit</Text>
              <Text flex={1} fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.8px" style={{ color: C.muted }} textAlign="center">Qté</Text>
              <Text flex={1} fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.8px" style={{ color: C.muted }} textAlign="right">PU HT</Text>
              <Text flex={1} fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.8px" style={{ color: C.muted }} textAlign="right">Total HT</Text>
            </Flex>
            {lines.map((line, idx) => (
              <Flex key={line.id} px={3} py={3} align="center"
                style={{ borderBottom: idx < lines.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <Box flex={3}>
                  <Text fontWeight="600" fontSize="sm" style={{ color: C.navy }} noOfLines={1}>
                    {line.product_name_snap}
                  </Text>
                  {(line.products as any)?.ean && (
                    <Text fontSize="10px" style={{ color: C.muted }}>
                      EAN: {(line.products as any).ean}
                    </Text>
                  )}
                </Box>
                <Text flex={1} textAlign="center" fontWeight="600" style={{ color: C.slate }}>{line.quantity}</Text>
                <Text flex={1} textAlign="right" fontSize="sm" style={{ color: C.slate }}>
                  {Number(line.unit_price_ht).toFixed(2)} {order.currency}
                </Text>
                <Text flex={1} textAlign="right" fontWeight="700" fontSize="sm" style={{ color: C.navy }}>
                  {Number(line.line_total_ht).toFixed(2)} {order.currency}
                </Text>
              </Flex>
            ))}
          </VStack>
        )}

        <Divider mt={4} mb={3} style={{ borderColor: C.border }} />

        <VStack spacing={1.5} align="stretch">
          <HStack justify="space-between">
            <Text fontSize="sm" style={{ color: C.muted }}>Total HT</Text>
            <Text fontWeight="600" style={{ color: C.slate }}>{order.total_ht.toFixed(2)} {order.currency}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" style={{ color: C.muted }}>TVA 20%</Text>
            <Text fontSize="sm" style={{ color: C.muted }}>{order.total_taxes.toFixed(2)} {order.currency}</Text>
          </HStack>
          <HStack justify="space-between" px={3} py={2.5} rounded="xl"
            style={{ background: '#f0f4ff', border: `1px solid #c7d7fd` }}>
            <Text fontWeight="800" style={{ color: C.navy }}>Total TTC</Text>
            <Text fontWeight="900" fontSize="lg" style={{ color: C.navy }}>
              {order.total_ttc.toFixed(2)} {order.currency}
            </Text>
          </HStack>
        </VStack>
      </Box>
      {/* Modal — demande de retour */}
      <Modal isOpen={returnModal} onClose={() => setReturnModal(false)} size="xl">
        <ModalOverlay />
        <ModalContent rounded="2xl">
          <ModalHeader style={{ color: C.navy }} fontSize="md" fontWeight="800">
            Demande de retour — {order.order_number}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <VStack spacing={4} align="stretch">
              {/* Motif + traitement */}
              <HStack spacing={3} align="flex-start">
                <Box flex={1}>
                  <Text fontSize="xs" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1.5}>
                    Motif du retour
                  </Text>
                  <Select size="sm" rounded="lg" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
                    <option value="damaged">Marchandise endommagée</option>
                    <option value="wrong_product">Produit non conforme</option>
                    <option value="quality_issue">Défaut de qualité</option>
                    <option value="expired">DLC dépassée</option>
                    <option value="excess">Livraison en excès</option>
                    <option value="other">Autre motif</option>
                  </Select>
                </Box>
                <Box flex={1}>
                  <Text fontSize="xs" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1.5}>
                    Traitement souhaité
                  </Text>
                  <Select size="sm" rounded="lg" value={returnRefundType} onChange={(e) => setReturnRefundType(e.target.value)}>
                    <option value="avoir">Avoir commercial</option>
                    <option value="exchange">Échange à l'identique</option>
                    <option value="refund">Remboursement</option>
                  </Select>
                </Box>
              </HStack>

              {/* Articles à retourner */}
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1.5}>
                  Articles à retourner
                </Text>
                <VStack spacing={0} align="stretch" style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                  {returnItems.map((item, idx) => (
                    <Flex key={item.order_line_id} px={3} py={2.5} align="center" gap={3}
                      style={{
                        borderBottom: idx < returnItems.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: item.selected ? '#fff7ed' : 'white',
                        transition: 'background 0.15s',
                      }}>
                      <Checkbox
                        isChecked={item.selected}
                        colorScheme="orange"
                        onChange={(e) => setReturnItems((prev) =>
                          prev.map((i, ii) => ii === idx ? { ...i, selected: e.target.checked } : i)
                        )}
                      />
                      <Text flex={1} fontSize="sm" fontWeight="600" noOfLines={1} style={{ color: C.navy }}>
                        {item.product_name_snap}
                      </Text>
                      <Text fontSize="xs" style={{ color: C.muted }}>max {item.max_qty}</Text>
                      <Box w="88px">
                        <NumberInput
                          size="xs" min={1} max={item.max_qty} value={item.qty_return}
                          isDisabled={!item.selected}
                          onChange={(_s, v) => setReturnItems((prev) =>
                            prev.map((i, ii) => ii === idx ? { ...i, qty_return: isNaN(v) ? 1 : Math.min(v, item.max_qty) } : i)
                          )}
                        >
                          <NumberInputField rounded="md" textAlign="center" fontFamily="mono" />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </Box>
                      <Text fontSize="xs" fontFamily="mono" style={{ color: '#c2410c' }} w="64px" textAlign="right">
                        {item.selected
                          ? `- ${(item.unit_price_ht * item.qty_return).toFixed(2)} ${order.currency}`
                          : '—'}
                      </Text>
                    </Flex>
                  ))}
                </VStack>
              </Box>

              {/* Notes */}
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase" style={{ color: C.muted }} mb={1.5}>
                  Observations (optionnel)
                </Text>
                <Textarea
                  size="sm" rounded="lg" rows={3}
                  placeholder="Décrivez le problème constaté…"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" size="sm" rounded="lg" onClick={() => setReturnModal(false)}>
              Annuler
            </Button>
            <Button
              size="sm" rounded="lg"
              isLoading={returnLoading}
              onClick={requestReturn}
              style={{ background: '#c2410c', color: 'white' }}
              _hover={{ background: '#9a3412' }}
            >
              Soumettre & générer BRM
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
