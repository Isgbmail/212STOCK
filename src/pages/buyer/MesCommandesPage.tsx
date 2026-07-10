import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, Input, InputGroup,
  InputLeftElement, SimpleGrid, Skeleton, Drawer, DrawerBody, DrawerHeader,
  DrawerContent, DrawerOverlay, DrawerCloseButton, Textarea, useDisclosure,
  useToast, Tooltip,
} from '@chakra-ui/react';
import {
  Search, ShoppingBag, RefreshCw, AlertTriangle, ChevronRight,
  Truck, Download, ArrowLeft, Package,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { generateBonCommandePDF } from '../../lib/pdf/pdfUtils';
import type { Order } from '../../types';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558',
  amber: '#c97d1a', amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b',
  border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#1a5c35', greenLight: '#dcfce7',
  red: '#be1c1c', redLight: '#fff1f1', redBorder: '#fca5a5',
};

// ── Status map ────────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:        { label: 'En attente',      color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  confirmed:      { label: 'Confirmée',       color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
  in_preparation: { label: 'En préparation',  color: '#4a1d96', bg: '#ede9fe', dot: '#8b5cf6' },
  shipped:        { label: 'Expédiée',        color: '#7c2d12', bg: '#ffedd5', dot: '#f97316' },
  delivered:      { label: 'Livrée',          color: '#14532d', bg: '#dcfce7', dot: '#22c55e' },
  cancelled:      { label: 'Annulée',         color: '#7f1d1d', bg: '#fee2e2', dot: '#ef4444' },
  dispute:        { label: 'Litige',          color: '#7f1d1d', bg: '#fee2e2', dot: '#ef4444' },
};

// dispute_type values match the DB CHECK constraint in disputes table
const SAV_TYPES = [
  { value: 'damaged',          label: 'Produit cassé / endommagé' },
  { value: 'partial_delivery', label: 'Quantité manquante' },
  { value: 'non_conforming',   label: 'Non conforme (DLC, mauvais produit)' },
  { value: 'late',             label: 'Livraison en retard' },
  { value: 'billing_error',    label: 'Erreur de facturation' },
];

const STATUS_FILTERS = [
  { k: 'all',            l: 'Toutes' },
  { k: 'pending',        l: 'En attente' },
  { k: 'confirmed',      l: 'Confirmées' },
  { k: 'in_preparation', l: 'Préparation' },
  { k: 'shipped',        l: 'Expédiées' },
  { k: 'delivered',      l: 'Livrées' },
  { k: 'cancelled',      l: 'Annulées' },
  { k: 'dispute',        l: 'Litiges' },
];

// ── SAV Drawer ────────────────────────────────────────────────────────────────
function SavDrawer({ order, isOpen, onClose }: { order: Order | null; isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const [savType, setSavType] = useState('');
  const [savNote, setSavNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!order || !savType) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('disputes').insert({
        order_id: order.id,
        dispute_type: savType,
        buyer_description: savNote || null,
        status: 'open',
      });
      if (error) throw error;
      toast({
        title: 'Réclamation envoyée',
        description: 'Notre équipe traitera votre demande sous 24h.',
        status: 'success', duration: 4000, isClosable: true, position: 'top-right',
      });
      setSavType(''); setSavNote(''); onClose();
    } catch (e) {
      toast({
        title: 'Erreur lors de l\'envoi',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        status: 'error', duration: 4000, isClosable: true, position: 'bottom-right',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent rounded="0">
        <DrawerCloseButton top={4} right={4} />
        <DrawerHeader style={{ borderBottom: `1px solid ${C.border}` }}>
          <HStack spacing={3}>
            <Box p={2} style={{ background: C.redLight }} rounded="lg">
              <AlertTriangle size={16} color={C.red} />
            </Box>
            <Box>
              <Text fontWeight="800" fontSize="sm" style={{ color: C.navy }}>SAV — Réclamation</Text>
              <Text fontSize="xs" style={{ color: C.muted }}>{order?.order_number}</Text>
            </Box>
          </HStack>
        </DrawerHeader>
        <DrawerBody pt={6}>
          <VStack spacing={6} align="stretch">
            <Box>
              <Text fontSize="11px" fontWeight="700" letterSpacing="1px" textTransform="uppercase"
                mb={3} style={{ color: C.muted }}>Type de problème *</Text>
              <VStack spacing={2} align="stretch">
                {SAV_TYPES.map(({ value, label }) => (
                  <Flex key={value} align="center" gap={3} p={3.5} rounded="xl" cursor="pointer"
                    style={{
                      border: `1.5px solid ${savType === value ? C.red : C.border}`,
                      background: savType === value ? C.redLight : 'white',
                    }}
                    _hover={{ borderColor: C.red }} transition="all 0.15s"
                    onClick={() => setSavType(value)}>
                    <Box w={4} h={4} rounded="full" flexShrink={0} transition="all 0.15s"
                      style={{
                        border: `2px solid ${savType === value ? C.red : C.border}`,
                        background: savType === value ? C.red : 'white',
                      }} />
                    <Text fontSize="sm" fontWeight={savType === value ? '700' : '500'}
                      style={{ color: savType === value ? C.red : C.slate }}>
                      {label}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            </Box>
            <Box>
              <Text fontSize="11px" fontWeight="700" letterSpacing="1px" textTransform="uppercase"
                mb={2} style={{ color: C.muted }}>Détails (optionnel)</Text>
              <Textarea value={savNote} onChange={(e) => setSavNote(e.target.value)}
                placeholder="Décrivez le problème en détail…" rows={4} fontSize="sm" rounded="xl"
                style={{ borderColor: C.border }} resize="none"
                _focus={{ borderColor: C.navy, boxShadow: 'none' }} />
            </Box>
            <Button isDisabled={!savType} isLoading={submitting} loadingText="Envoi…"
              onClick={handleSubmit} size="lg" fontWeight="700" rounded="xl"
              style={{ background: savType ? C.navy : undefined, color: savType ? 'white' : undefined }}
              _hover={{ opacity: 0.9 }}>
              Envoyer la réclamation
            </Button>
            <Text fontSize="xs" textAlign="center" style={{ color: C.muted }}>
              Traitement garanti sous 24h — résolution par avoir ou réapprovisionnement
            </Text>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MesCommandesPage() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { isOpen: isSavOpen, onOpen: openSav, onClose: closeSav } = useDisclosure();

  useEffect(() => {
    if (!activeOrg) return;
    supabase.from('orders')
      .select('*, organisations!seller_org_id(id, name, org_type)')
      .eq('buyer_org_id', activeOrg.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOrders((data as Order[]) ?? []); setLoading(false); });
  }, [activeOrg]);

  // Filtered
  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || o.order_number.toLowerCase().includes(q)
      || (o.organisations?.name ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // KPIs
  const totalSpend = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.total_ttc ?? 0), 0);
  const pending = orders.filter((o) => ['pending', 'confirmed', 'in_preparation'].includes(o.status)).length;
  const disputes = orders.filter((o) => o.status === 'dispute').length;

  function handleReorder(order: Order) {
    toast({
      title: 'Réordre',
      description: 'Redirection vers le catalogue pour sélectionner vos produits.',
      status: 'info', duration: 3000, position: 'top-right',
    });
    navigate('/catalog');
  }

  async function handlePDF(order: Order) {
    try {
      await generateBonCommandePDF(order.id);
    } catch (e) {
      toast({
        title: 'Erreur PDF',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        status: 'error', duration: 3000, position: 'bottom-right',
      });
    }
  }

  return (
    <VStack spacing={6} align="stretch">

      {/* ── EN-TÊTE ──────────────────────────────────────────────────── */}
      <Flex align="flex-start" justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
            style={{ color: C.muted }} mb={1} onClick={() => navigate('/buyer')}>
            Tableau de bord
          </Button>
          <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>Mes commandes</Heading>
          <Text fontSize="sm" style={{ color: C.muted }}>Historique, suivi et SAV</Text>
        </Box>
        <Button size="sm" fontWeight="700" rounded="full"
          style={{ background: C.navy, color: 'white' }}
          leftIcon={<ShoppingBag size={14} />} _hover={{ opacity: 0.9 }}
          onClick={() => navigate('/catalog')}>
          Nouvelle commande
        </Button>
      </Flex>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        {[
          { label: 'Total commandes', value: loading ? '—' : String(orders.length),        dot: C.navy,  bg: '#f0f4ff' },
          { label: 'Livrées',         value: loading ? '—' : String(orders.filter((o) => o.status === 'delivered').length), dot: C.green, bg: C.greenLight },
          { label: 'En cours',        value: loading ? '—' : String(pending),               dot: C.amber, bg: C.amberLight },
          { label: 'Total dépensé',   value: loading ? '—' : `${totalSpend.toFixed(0)} €`, dot: C.navy,  bg: '#f0f4ff' },
        ].map(({ label, value, dot, bg }) => (
          <Box key={label} rounded="xl" p={4} style={{ background: bg, border: `1px solid ${dot}20` }}>
            <HStack spacing={1.5} mb={1}>
              <Box w={2} h={2} rounded="full" style={{ background: dot }} />
              <Text fontSize="11px" fontWeight="700" style={{ color: dot }}>{label}</Text>
            </HStack>
            <Text fontSize="2xl" fontWeight="900" style={{ color: dot }} lineHeight={1}>{value}</Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* ── FILTRES ──────────────────────────────────────────────────── */}
      <Flex gap={3} flexWrap="wrap" align="center">
        <InputGroup maxW="260px" size="sm">
          <InputLeftElement h="36px" w="36px" pointerEvents="none">
            <Search size={13} color={C.muted} />
          </InputLeftElement>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} h="36px"
            placeholder="Rechercher…" pl="36px" fontSize="sm" rounded="lg" bg="white"
            style={{ borderColor: C.border }} _focus={{ borderColor: C.navy, boxShadow: 'none' }} />
        </InputGroup>
        <Flex gap={1.5} flexWrap="wrap">
          {STATUS_FILTERS.map(({ k, l }) => {
            const active = statusFilter === k;
            const cfg = STATUS[k];
            const count = k !== 'all' ? orders.filter((o) => o.status === k).length : null;
            return (
              <Box key={k} px={3} py="5px" rounded="full" cursor="pointer" fontSize="11px"
                fontWeight={active ? '700' : '500'} transition="all 0.14s"
                style={{
                  background: active ? (cfg?.bg ?? '#f0f4ff') : 'white',
                  color: active ? (cfg?.color ?? C.navy) : C.muted,
                  border: `1px solid ${active ? (cfg?.dot ?? C.navy) + '55' : C.border}`,
                }}
                _hover={{ opacity: 0.8 }} onClick={() => setStatusFilter(k)}>
                {l}{!loading && count !== null && count > 0 && (
                  <Box as="span" ml={1} fontWeight="800">({count})</Box>
                )}
              </Box>
            );
          })}
        </Flex>
      </Flex>

      {/* ── LISTE ────────────────────────────────────────────────────── */}
      <Box bg="white" rounded="2xl" overflow="hidden"
        style={{ border: `1px solid ${C.border}` }}>

        {/* Thead */}
        <Flex px={5} py={3} style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
          {[
            { l: 'Commande',   flex: 2 },
            { l: 'Vendeur',    flex: 1.5, hide: true },
            { l: 'Date',       flex: 1,   hide: true },
            { l: 'Montant',    flex: 1 },
            { l: 'Statut',     flex: 1 },
          ].map(({ l, flex, hide }) => (
            <Text key={l} fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.8px"
              style={{ color: C.muted, flex }} display={hide ? { base: 'none', md: 'block' } : undefined}>
              {l}
            </Text>
          ))}
          <Text fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.8px"
            style={{ color: C.muted, minWidth: '160px' }} textAlign="right">
            Actions
          </Text>
        </Flex>

        {/* Rows */}
        {loading ? (
          <VStack spacing={0} align="stretch">
            {Array.from({ length: 5 }).map((_, i) => (
              <Box key={i} px={5} py={4} style={{ borderBottom: `1px solid ${C.border}` }}>
                <Skeleton h="40px" rounded="lg" />
              </Box>
            ))}
          </VStack>
        ) : filtered.length === 0 ? (
          <Flex direction="column" align="center" py={16} gap={3}>
            <Box p={4} style={{ background: C.bgAlt }} rounded="full">
              <Package size={32} color={C.border} />
            </Box>
            <Text fontWeight="700" style={{ color: C.slate }}>
              {search || statusFilter !== 'all' ? 'Aucun résultat' : 'Aucune commande'}
            </Text>
            <Text fontSize="sm" style={{ color: C.muted }}>
              {search || statusFilter !== 'all'
                ? 'Essayez de modifier vos filtres'
                : 'Vos commandes apparaîtront ici'}
            </Text>
            {!search && statusFilter === 'all' && (
              <Button size="sm" mt={1} fontWeight="700" rounded="full"
                style={{ background: C.navy, color: 'white' }} onClick={() => navigate('/catalog')}>
                Parcourir le catalogue
              </Button>
            )}
          </Flex>
        ) : (
          <VStack spacing={0} align="stretch">
            {filtered.map((order) => {
              const cfg = STATUS[order.status] ?? { label: order.status, color: C.slate, bg: C.bgAlt, dot: C.border };
              const isActionable = ['delivered', 'cancelled', 'dispute', 'pending', 'confirmed'].includes(order.status);
              return (
                <Flex key={order.id} px={5} py={4} align="center"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                  _hover={{ background: C.bgAlt }} transition="background 0.12s">
                  {/* Commande */}
                  <Box flex={2} minW={0}>
                    <Text fontWeight="700" fontSize="sm" style={{ color: C.navy }} noOfLines={1}>
                      {order.order_number}
                    </Text>
                    <HStack spacing={1} mt={0.5}>
                      <Truck size={10} color={C.muted} />
                      <Text fontSize="10px" style={{ color: C.muted }}>
                        {order.delivery_preference === 'express' ? 'Express J+1'
                          : order.delivery_preference === 'cold_chain' ? 'Chaîne du froid'
                          : 'Standard J+2'}
                      </Text>
                    </HStack>
                  </Box>
                  {/* Vendeur */}
                  <Text fontSize="sm" style={{ color: C.slate }} noOfLines={1}
                    flex={1.5} display={{ base: 'none', md: 'block' }}>
                    {order.organisations?.name ?? '—'}
                  </Text>
                  {/* Date */}
                  <Box flex={1} display={{ base: 'none', md: 'block' }}>
                    <Text fontSize="sm" style={{ color: C.slate }}>
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                    <Text fontSize="10px" style={{ color: C.muted }}>
                      {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Box>
                  {/* Montant */}
                  <Box flex={1}>
                    <Text fontWeight="800" fontSize="sm" style={{ color: C.navy }}>
                      {(order.total_ttc ?? 0).toFixed(2)} {order.currency}
                    </Text>
                    <Text fontSize="10px" style={{ color: C.muted }}>
                      HT {(order.total_ht ?? 0).toFixed(2)}
                    </Text>
                  </Box>
                  {/* Statut */}
                  <Box flex={1}>
                    <HStack spacing={1.5}>
                      <Box w={2} h={2} rounded="full" flexShrink={0} style={{ background: cfg.dot }} />
                      <Text fontSize="11px" fontWeight="700" style={{ color: cfg.color }}>
                        {cfg.label}
                      </Text>
                    </HStack>
                  </Box>
                  {/* Actions */}
                  <HStack spacing={1} minW="160px" justify="flex-end">
                    {order.status === 'delivered' && (
                      <>
                        <Tooltip label="Télécharger la facture PDF" placement="top">
                          <Button size="xs" variant="ghost" rounded="lg"
                            style={{ color: C.slate }} _hover={{ background: C.bgAlt }}
                            onClick={() => handlePDF(order)}>
                            <Download size={13} />
                          </Button>
                        </Tooltip>
                        <Tooltip label="Recommander les mêmes produits" placement="top">
                          <Button size="xs" variant="ghost" rounded="lg"
                            style={{ color: C.green }} _hover={{ background: C.greenLight }}
                            onClick={() => handleReorder(order)}>
                            <RefreshCw size={13} />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                    {isActionable && (
                      <Tooltip label="Déposer une réclamation SAV" placement="top">
                        <Button size="xs" variant="ghost" rounded="lg"
                          style={{ color: C.red }} _hover={{ background: C.redLight }}
                          onClick={() => { setSelectedOrder(order); openSav(); }}>
                          <AlertTriangle size={13} />
                        </Button>
                      </Tooltip>
                    )}
                    <Button size="xs" variant="ghost" rounded="lg"
                      style={{ color: C.navy }} _hover={{ background: C.bgAlt }}
                      rightIcon={<ChevronRight size={12} />}
                      onClick={() => navigate(`/buyer/orders/${order.id}`)}>
                      Détail
                    </Button>
                  </HStack>
                </Flex>
              );
            })}
          </VStack>
        )}
      </Box>

      {/* Alerte litiges */}
      {disputes > 0 && (
        <Box rounded="xl" p={4} style={{ background: C.redLight, border: `1px solid ${C.redBorder}` }}>
          <HStack spacing={3}>
            <AlertTriangle size={18} color={C.red} />
            <Box>
              <Text fontWeight="700" fontSize="sm" style={{ color: C.red }}>
                {disputes} commande{disputes > 1 ? 's' : ''} en litige
              </Text>
              <Text fontSize="xs" style={{ color: '#9b1c1c' }}>
                Notre équipe traite votre dossier — contacté sous 24–48h.
              </Text>
            </Box>
          </HStack>
        </Box>
      )}

      <SavDrawer order={selectedOrder} isOpen={isSavOpen} onClose={closeSav} />
    </VStack>
  );
}
