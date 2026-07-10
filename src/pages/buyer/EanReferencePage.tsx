import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Flex, Grid, HStack, VStack, Text, Heading,
  Input, InputGroup, InputLeftElement, InputRightElement, IconButton,
  Badge, Button, Select as ChakraSelect, Spinner, Tag, TagLabel,
  useToast, SimpleGrid, Tooltip, NumberInput, NumberInputField,
  NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  Alert, AlertIcon, Skeleton, SkeletonText, Wrap, WrapItem,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, useDisclosure, Table, Thead, Tbody, Tr, Th, Td,
  TableContainer, Icon, Collapse, Stat, StatLabel, StatNumber,
} from '@chakra-ui/react';
import {
  FaBarcode, FaSearch, FaShoppingCart, FaChevronDown, FaChevronUp,
  FaStar, FaStore, FaCheckCircle, FaTimes, FaBoxes, FaTag,
  FaFilter, FaSortAmountDown, FaCircle, FaList,
} from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getEffectiveUnitPrice, addOptimizedLinesToCart } from '../../lib/cartOptimizer';
import type { OptimizedLine, ProductOffer } from '../../lib/cartOptimizer';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:       '#0d1f38',
  amber:      '#c97d1a',
  amberLight: '#fef3c7',
  amberBorder:'#fbbf24',
  slate:      '#334155',
  muted:      '#64748b',
  border:     '#e2e8f0',
  bgAlt:      '#f8fafc',
  green:      '#1a5c35',
  greenLight: '#dcfce7',
  blue:       '#1d4bca',
  blueLight:  '#dce8ff',
};

function fmtMAD(n: number) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency', currency: 'MAD', maximumFractionDigits: 2,
  }).format(n);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawProduct {
  id: string;
  name: string;
  ean: string;
  seller_org_id: string;
  moq: number;
  category_id: string | null;
  images: string[] | null;
  organisations: { id: string; name: string } | null;
  price_tiers: { qty_min: number; unit_price: number }[];
  categories: { id: string; name: string } | null;
}

interface EanGroup {
  ean: string;
  productName: string;
  categoryId: string | null;
  categoryName: string;
  offers: ProductOffer[];
}

const SORT_OPTIONS = [
  { label: 'Meilleur prix',   value: 'price_asc'    },
  { label: 'Plus vendeurs',   value: 'sellers_desc'  },
  { label: 'Nom (A→Z)',       value: 'name_asc'      },
];

const PAGE_SIZE = 24;

// ── Utilitaire : offres recalculées pour une quantité donnée ──────────────────

function offersForQty(group: EanGroup, qty: number): ProductOffer[] {
  return group.offers
    .map((o) => {
      const unitPrice = getEffectiveUnitPrice(o.priceTiers, qty);
      return { ...o, unitPrice, lineTotal: unitPrice * qty };
    })
    .filter((o) => o.unitPrice > 0)
    .sort((a, b) => a.unitPrice - b.unitPrice);
}

// ── Carte produit EAN ─────────────────────────────────────────────────────────

interface EanCardProps {
  group: EanGroup;
  quantity: number;
  selectedSellerId: string;
  onQtyChange: (ean: string, qty: number) => void;
  onSelectSeller: (ean: string, sellerId: string) => void;
  onAddToCart: (ean: string) => void;
  onOpenDetail: (group: EanGroup) => void;
  adding: boolean;
}

function EanCard({
  group, quantity, selectedSellerId, onQtyChange, onSelectSeller,
  onAddToCart, onOpenDetail, adding,
}: EanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const computed   = useMemo(() => offersForQty(group, quantity), [group, quantity]);
  const best       = computed[0];
  const selected   = computed.find((o) => o.sellerId === selectedSellerId) ?? best;
  const multiSeller = group.offers.length > 1;

  if (!best || !selected) return null;

  const isBest  = selected.sellerId === best.sellerId;
  const saving  = multiSeller
    ? ((computed[computed.length - 1].unitPrice - best.unitPrice) /
        computed[computed.length - 1].unitPrice * 100)
    : 0;

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor={expanded ? 'blue.200' : C.border}
      rounded="xl"
      overflow="hidden"
      transition="box-shadow 0.15s, border-color 0.15s"
      _hover={{ boxShadow: 'md' }}
      display="flex"
      flexDir="column"
    >
      {/* Corps */}
      <Box px={4} pt={4} pb={2} flex="1">

        {/* EAN + catégorie + multi-vendeurs */}
        <Flex justify="space-between" align="flex-start" mb={2} flexWrap="wrap" gap={1}>
          <HStack spacing={1.5} flexWrap="wrap">
            <Badge
              fontFamily="mono"
              fontSize="10px"
              px={2}
              py={0.5}
              bg={C.bgAlt}
              color={C.slate}
              border="1px solid"
              borderColor={C.border}
              rounded="md"
              letterSpacing="wide"
            >
              {group.ean}
            </Badge>
            {group.categoryName && (
              <Badge
                fontSize="10px"
                px={2}
                py={0.5}
                bg={C.blueLight}
                color={C.blue}
                rounded="md"
                fontWeight="600"
              >
                {group.categoryName}
              </Badge>
            )}
          </HStack>
          {multiSeller && (
            <Badge
              colorScheme="purple"
              fontSize="10px"
              rounded="full"
              px={2}
              py={0.5}
            >
              {group.offers.length} vendeurs
            </Badge>
          )}
        </Flex>

        {/* Nom */}
        <Text fontWeight="700" fontSize="sm" color={C.navy} mb={3} lineHeight={1.4} noOfLines={2}>
          {group.productName}
        </Text>

        {/* Recommandation optimiseur */}
        <Box
          bg={isBest ? C.greenLight : C.amberLight}
          border="1px solid"
          borderColor={isBest ? '#86efac' : C.amberBorder}
          rounded="lg"
          px={3}
          py={2}
          mb={multiSeller ? 2 : 3}
        >
          <Flex justify="space-between" align="center">
            <VStack align="start" spacing={0} flex="1" minW={0}>
              <HStack spacing={1.5}>
                <Icon as={FaStar} color={isBest ? C.green : C.amber} boxSize={3} />
                <Text
                  fontSize="10px"
                  fontWeight="700"
                  color={isBest ? C.green : C.amber}
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {isBest ? 'Meilleur prix' : 'Sélectionné'}
                </Text>
              </HStack>
              <Text fontSize="xs" color={C.slate} noOfLines={1} w="full">
                {selected.sellerName}
              </Text>
              {selected.moq > 1 && (
                <Text fontSize="10px" color={C.muted}>MOQ : {selected.moq}</Text>
              )}
            </VStack>
            <VStack align="end" spacing={0} flexShrink={0}>
              <Text fontWeight="800" fontSize="lg" color={C.navy} lineHeight={1}>
                {fmtMAD(selected.unitPrice)}
              </Text>
              <Text fontSize="10px" color={C.muted}>/ unité</Text>
              {saving > 2 && isBest && (
                <Badge colorScheme="green" fontSize="9px" rounded="full">
                  -{saving.toFixed(0)}% vs pire
                </Badge>
              )}
            </VStack>
          </Flex>
        </Box>

        {/* Offres alternatives */}
        {multiSeller && (
          <>
            <Button
              variant="ghost"
              size="xs"
              color="blue.600"
              w="full"
              justifyContent="space-between"
              rightIcon={<Icon as={expanded ? FaChevronUp : FaChevronDown} />}
              onClick={() => setExpanded((p) => !p)}
              _hover={{ bg: C.blueLight }}
              fontSize="xs"
              mb={1}
            >
              {expanded ? 'Masquer les offres' : `${group.offers.length} offres disponibles`}
            </Button>

            <Collapse in={expanded} animateOpacity>
              <VStack align="stretch" spacing={1} bg={C.bgAlt} rounded="lg" p={2} mb={2}
                border="1px solid" borderColor={C.border}>
                {computed.map((offer, i) => {
                  const isSel = offer.sellerId === selected.sellerId;
                  return (
                    <Flex
                      key={offer.productId}
                      justify="space-between"
                      align="center"
                      px={2.5}
                      py={1.5}
                      rounded="md"
                      bg={isSel ? C.blueLight : 'white'}
                      border="1px solid"
                      borderColor={isSel ? 'blue.200' : C.border}
                      cursor="pointer"
                      _hover={!isSel ? { borderColor: 'blue.200', bg: '#f0f7ff' } : {}}
                      onClick={() => onSelectSeller(group.ean, offer.sellerId)}
                      transition="all 0.12s"
                    >
                      <HStack spacing={2} flex="1" minW={0}>
                        <Icon
                          as={isSel ? FaCheckCircle : FaCircle}
                          color={isSel ? 'blue.400' : 'gray.200'}
                          boxSize={3}
                          flexShrink={0}
                        />
                        <Text
                          fontSize="xs"
                          fontWeight={isSel ? '700' : '500'}
                          color={C.navy}
                          noOfLines={1}
                        >
                          {offer.sellerName}
                        </Text>
                        {i === 0 && !isSel && (
                          <Badge colorScheme="green" fontSize="9px" rounded="full" flexShrink={0}>
                            Meilleur
                          </Badge>
                        )}
                      </HStack>
                      <VStack align="end" spacing={0} flexShrink={0}>
                        <Text fontSize="sm" fontWeight="700" color={i === 0 ? C.green : C.slate}>
                          {fmtMAD(offer.unitPrice)}
                        </Text>
                        <Text fontSize="9px" color={C.muted}>{fmtMAD(offer.lineTotal)}</Text>
                      </VStack>
                    </Flex>
                  );
                })}
              </VStack>
            </Collapse>
          </>
        )}
      </Box>

      {/* Pied : quantité + actions */}
      <Box px={4} pb={4} pt={1}>
        <Flex gap={2} align="flex-end">
          <Box>
            <Text fontSize="10px" color={C.muted} mb={0.5} fontWeight="600">QTÉ</Text>
            <NumberInput
              size="sm"
              min={selected.moq || 1}
              step={selected.moq || 1}
              value={quantity}
              onChange={(_, val) => onQtyChange(group.ean, isNaN(val) ? 1 : Math.max(1, val))}
              w="88px"
            >
              <NumberInputField
                fontFamily="mono"
                fontWeight="700"
                textAlign="center"
                fontSize="sm"
                borderColor={C.border}
                _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
              />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </Box>

          <Button
            flex="1"
            size="sm"
            colorScheme="blue"
            leftIcon={<Icon as={FaShoppingCart} />}
            isLoading={adding}
            loadingText=""
            onClick={() => onAddToCart(group.ean)}
            fontWeight="700"
          >
            Ajouter
          </Button>

          {multiSeller && (
            <Tooltip label="Comparer toutes les offres">
              <IconButton
                aria-label="Détails"
                icon={<Icon as={FaList} />}
                size="sm"
                variant="outline"
                colorScheme="gray"
                onClick={() => onOpenDetail(group)}
              />
            </Tooltip>
          )}
        </Flex>

        {quantity > 1 && (
          <Text fontSize="xs" color={C.muted} mt={1} textAlign="right">
            Sous-total : {fmtMAD(selected.unitPrice * quantity)}
          </Text>
        )}
      </Box>
    </Box>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function EanCardSkeleton() {
  return (
    <Box bg="white" border="1px solid" borderColor={C.border} rounded="xl" p={4}>
      <Skeleton height="16px" mb={3} />
      <SkeletonText noOfLines={2} spacing={2} mb={4} />
      <Skeleton height="72px" rounded="lg" mb={3} />
      <Skeleton height="32px" />
    </Box>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function EanReferencePage() {
  const { activeOrg } = useAuth();
  const navigate      = useNavigate();
  const toast         = useToast({ position: 'top-right', duration: 3000 });

  // ── Data ────────────────────────────────────────────────────────────────
  const [loading,    setLoading]    = useState(true);
  const [eanGroups,  setEanGroups]  = useState<EanGroup[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // ── Filtres ──────────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [sortBy,    setSortBy]    = useState('price_asc');
  const [page,      setPage]      = useState(1);

  // ── États par EAN ────────────────────────────────────────────────────────
  const [quantities,     setQuantities]     = useState<Record<string, number>>({});
  const [selectedOffers, setSelectedOffers] = useState<Record<string, string>>({});
  const [adding,         setAdding]         = useState<Set<string>>(new Set());

  // ── Modal détail ─────────────────────────────────────────────────────────
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [detailGroup, setDetailGroup] = useState<EanGroup | null>(null);

  // ── Chargement ────────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from('products')
        .select(`
          id, name, ean, seller_org_id, moq, category_id, images,
          organisations!seller_org_id(id, name),
          price_tiers(qty_min, unit_price),
          categories!category_id(id, name)
        `)
        .eq('status', 'active')
        .not('ean', 'is', null)
        .order('name'),
      supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name'),
    ]);

    const raw = (prodRes.data ?? []) as RawProduct[];
    setCategories((catRes.data as { id: string; name: string }[]) ?? []);

    const groupMap = new Map<string, EanGroup>();

    for (const p of raw) {
      const ean = p.ean?.trim();
      if (!ean) continue;
      const unitPrice1 = getEffectiveUnitPrice(p.price_tiers ?? [], 1);
      const offer: ProductOffer = {
        productId:   p.id,
        ean,
        productName: p.name,
        sellerId:    p.seller_org_id,
        sellerName:  (p.organisations as { id: string; name: string } | null)?.name ?? 'Vendeur inconnu',
        moq:         p.moq ?? 1,
        priceTiers:  p.price_tiers ?? [],
        unitPrice:   unitPrice1,
        lineTotal:   unitPrice1,
      };

      if (!groupMap.has(ean)) {
        groupMap.set(ean, {
          ean,
          productName: p.name,
          categoryId:  p.category_id,
          categoryName: (p.categories as { id: string; name: string } | null)?.name ?? '',
          offers: [],
        });
      }
      groupMap.get(ean)!.offers.push(offer);
    }

    const groups: EanGroup[] = [];
    const defaultQtys: Record<string, number>  = {};
    const defaultSel:  Record<string, string>  = {};

    for (const g of groupMap.values()) {
      g.offers.sort((a, b) => a.unitPrice - b.unitPrice);
      groups.push(g);
      defaultQtys[g.ean] = g.offers[0]?.moq ?? 1;
      defaultSel[g.ean]  = g.offers[0]?.sellerId ?? '';
    }

    setEanGroups(groups);
    setQuantities(defaultQtys);
    setSelectedOffers(defaultSel);
    setLoading(false);
  }

  // ── Filtrage + tri ────────────────────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    let r = eanGroups;

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (g) =>
          g.ean.includes(q) ||
          g.productName.toLowerCase().includes(q) ||
          g.offers.some((o) => o.sellerName.toLowerCase().includes(q)),
      );
    }

    if (catFilter) r = r.filter((g) => g.categoryId === catFilter);

    if (sortBy === 'price_asc')    r = [...r].sort((a, b) => (a.offers[0]?.unitPrice ?? 0) - (b.offers[0]?.unitPrice ?? 0));
    if (sortBy === 'sellers_desc') r = [...r].sort((a, b) => b.offers.length - a.offers.length);
    if (sortBy === 'name_asc')     r = [...r].sort((a, b) => a.productName.localeCompare(b.productName, 'fr'));

    return r;
  }, [eanGroups, search, catFilter, sortBy]);

  const totalPages = Math.ceil(filteredSorted.length / PAGE_SIZE);
  const paginated  = filteredSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => setPage(1), [search, catFilter, sortBy]);

  const totalSellers = useMemo(
    () => new Set(eanGroups.flatMap((g) => g.offers.map((o) => o.sellerId))).size,
    [eanGroups],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleQtyChange = useCallback((ean: string, qty: number) => {
    setQuantities((p) => ({ ...p, [ean]: qty }));
    setEanGroups((groups) => {
      const g = groups.find((gr) => gr.ean === ean);
      if (!g) return groups;
      const best = offersForQty(g, qty)[0];
      if (best) setSelectedOffers((p) => ({ ...p, [ean]: best.sellerId }));
      return groups;
    });
  }, []);

  const handleSelectSeller = useCallback((ean: string, sellerId: string) => {
    setSelectedOffers((p) => ({ ...p, [ean]: sellerId }));
  }, []);

  const handleAddToCart = useCallback(async (ean: string) => {
    if (!activeOrg) {
      toast({ status: 'warning', title: 'Connexion requise' });
      return;
    }
    setAdding((p) => new Set([...p, ean]));

    const group = eanGroups.find((g) => g.ean === ean);
    if (!group) { setAdding((p) => { const n = new Set(p); n.delete(ean); return n; }); return; }

    const qty      = quantities[ean] ?? 1;
    const computed = offersForQty(group, qty);
    const offer    = computed.find((o) => o.sellerId === selectedOffers[ean]) ?? computed[0];

    if (!offer) { setAdding((p) => { const n = new Set(p); n.delete(ean); return n; }); return; }

    const line: OptimizedLine = {
      ean,
      quantity: qty,
      offers:   computed,
      selected: { ...offer, lineTotal: offer.unitPrice * qty },
    };

    const { error } = await addOptimizedLinesToCart([line], activeOrg.id);

    if (error) {
      toast({ status: 'error', title: 'Erreur', description: error });
    } else {
      toast({
        status: 'success',
        title: 'Ajouté au panier',
        description: `${group.productName} · ${qty} u · ${offer.sellerName}`,
        duration: 2500,
      });
    }
    setAdding((p) => { const n = new Set(p); n.delete(ean); return n; });
  }, [activeOrg, eanGroups, quantities, selectedOffers, toast]);

  const handleAddAllVisible = useCallback(async () => {
    if (!activeOrg || filteredSorted.length === 0) return;

    toast({ status: 'info', title: `Ajout de ${filteredSorted.length} produits…`, duration: 2500 });

    const lines: OptimizedLine[] = filteredSorted.flatMap((g) => {
      const qty      = quantities[g.ean] ?? 1;
      const computed = offersForQty(g, qty);
      const offer    = computed.find((o) => o.sellerId === selectedOffers[g.ean]) ?? computed[0];
      if (!offer) return [];
      return [{
        ean:      g.ean,
        quantity: qty,
        offers:   computed,
        selected: { ...offer, lineTotal: offer.unitPrice * qty },
      }];
    });

    const { error } = await addOptimizedLinesToCart(lines, activeOrg.id);

    if (error) {
      toast({ status: 'error', title: 'Erreur', description: error });
    } else {
      toast({
        status: 'success',
        title: `${lines.length} produits ajoutés au panier`,
        description: 'Prix optimal sélectionné pour chaque article.',
        duration: 4000,
      });
      navigate('/buyer/carts');
    }
  }, [activeOrg, filteredSorted, quantities, selectedOffers, toast, navigate]);

  const openDetailModal = useCallback((group: EanGroup) => {
    setDetailGroup(group);
    onOpen();
  }, [onOpen]);

  // ── Données modal ────────────────────────────────────────────────────────
  const detailQty    = detailGroup ? (quantities[detailGroup.ean] ?? 1) : 1;
  const detailOffers = detailGroup ? offersForQty(detailGroup, detailQty) : [];

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <Box bg={C.bgAlt} minH="100vh" pb={20}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Box bg={C.navy} py={10}>
        <Container maxW="6xl">
          <VStack align="start" spacing={5}>
            <HStack spacing={3}>
              <Flex w={10} h={10} bg="rgba(255,255,255,0.12)" rounded="lg" align="center" justify="center">
                <Icon as={FaBarcode} color="white" boxSize={5} />
              </Flex>
              <Box>
                <Heading fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800" color="white">
                  Référence EAN
                </Heading>
                <Text color="rgba(255,255,255,0.60)" fontSize="sm" mt={0.5}>
                  Catalogue unifié par code EAN — l'optimiseur recommande automatiquement le meilleur vendeur
                </Text>
              </Box>
            </HStack>

            {/* KPIs */}
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
              {[
                { label: 'EAN uniques',      value: loading ? '…' : eanGroups.length,                                          icon: FaBarcode },
                { label: 'Vendeurs actifs',   value: loading ? '…' : totalSellers,                                             icon: FaStore   },
                { label: 'Multi-vendeurs',    value: loading ? '…' : eanGroups.filter((g) => g.offers.length > 1).length,      icon: FaTag     },
                { label: 'Résultats filtrés', value: loading ? '…' : filteredSorted.length,                                    icon: FaFilter  },
              ].map(({ label, value, icon }) => (
                <Stat key={label} bg="rgba(255,255,255,0.06)" rounded="xl" p={3}>
                  <StatLabel color="rgba(255,255,255,0.55)" fontSize="xs" fontWeight="600">
                    <HStack spacing={1.5}><Icon as={icon} boxSize={3} /><Text>{label}</Text></HStack>
                  </StatLabel>
                  <StatNumber color="white" fontSize="2xl" fontWeight="800">{value}</StatNumber>
                </Stat>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* ── Barre de filtres (sticky) ──────────────────────────────────────── */}
      <Box
        bg="white"
        borderBottom="1px solid"
        borderColor={C.border}
        py={3}
        position="sticky"
        top={0}
        zIndex={100}
        shadow="sm"
      >
        <Container maxW="6xl">
          <Flex gap={3} flexWrap="wrap" align="center">

            {/* Recherche */}
            <InputGroup size="sm" maxW="300px" flex="1">
              <InputLeftElement pointerEvents="none">
                <Icon as={FaSearch} color="gray.400" boxSize={3.5} />
              </InputLeftElement>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Produit, EAN ou vendeur…"
                borderColor={C.border}
                rounded="lg"
                _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                pr={search ? '32px' : undefined}
              />
              {search && (
                <InputRightElement>
                  <IconButton aria-label="Effacer" icon={<Icon as={FaTimes} />}
                    size="xs" variant="ghost" onClick={() => setSearch('')} />
                </InputRightElement>
              )}
            </InputGroup>

            {/* Catégorie */}
            <ChakraSelect
              size="sm"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              borderColor={C.border}
              rounded="lg"
              maxW="190px"
              flex="1"
              _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
              color={catFilter ? C.navy : 'gray.400'}
              fontWeight={catFilter ? '600' : 'normal'}
            >
              <option value="">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </ChakraSelect>

            {/* Tri */}
            <ChakraSelect
              size="sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              borderColor={C.border}
              rounded="lg"
              maxW="170px"
              _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </ChakraSelect>

            <Box flex="1" display={{ base: 'none', md: 'block' }} />

            {/* Tout ajouter */}
            {filteredSorted.length > 0 && (
              <Tooltip label={`Ajouter les ${filteredSorted.length} EAN affichés avec prix optimal`}>
                <Button
                  size="sm"
                  colorScheme="blue"
                  leftIcon={<Icon as={FaBoxes} />}
                  onClick={handleAddAllVisible}
                  isDisabled={!activeOrg || loading}
                  fontWeight="700"
                >
                  Tout ajouter ({filteredSorted.length})
                </Button>
              </Tooltip>
            )}
          </Flex>
        </Container>
      </Box>

      {/* ── Grille principale ─────────────────────────────────────────────── */}
      <Container maxW="6xl" pt={6}>

        {loading ? (
          <Grid
            templateColumns={{
              base: '1fr',
              sm:   'repeat(2, 1fr)',
              lg:   'repeat(3, 1fr)',
              xl:   'repeat(4, 1fr)',
            }}
            gap={4}
          >
            {Array.from({ length: 12 }).map((_, i) => <EanCardSkeleton key={i} />)}
          </Grid>

        ) : filteredSorted.length === 0 ? (
          <Flex direction="column" align="center" py={24} gap={4}>
            <Icon as={FaBarcode} boxSize={14} color="gray.200" />
            <Text fontWeight="700" color={C.slate} fontSize="lg">Aucun produit trouvé</Text>
            <Text color={C.muted} fontSize="sm">Essayez d'élargir les filtres.</Text>
            <Button size="sm" variant="outline" onClick={() => { setSearch(''); setCatFilter(''); }}>
              Réinitialiser les filtres
            </Button>
          </Flex>

        ) : (
          <>
            {/* Tags de filtres actifs */}
            {(search || catFilter) && (
              <HStack mb={4} flexWrap="wrap" spacing={2}>
                <Text fontSize="sm" color={C.muted}>Filtre :</Text>
                {search && (
                  <Tag colorScheme="blue" size="sm" rounded="full" cursor="pointer" onClick={() => setSearch('')}>
                    <TagLabel>{search}</TagLabel>
                    <Icon as={FaTimes} boxSize={2.5} ml={1} />
                  </Tag>
                )}
                {catFilter && (
                  <Tag colorScheme="purple" size="sm" rounded="full" cursor="pointer" onClick={() => setCatFilter('')}>
                    <TagLabel>{categories.find((c) => c.id === catFilter)?.name}</TagLabel>
                    <Icon as={FaTimes} boxSize={2.5} ml={1} />
                  </Tag>
                )}
                <Text fontSize="xs" color={C.muted}>— {filteredSorted.length} EAN</Text>
              </HStack>
            )}

            {/* Grille */}
            <Grid
              templateColumns={{
                base: '1fr',
                sm:   'repeat(2, 1fr)',
                lg:   'repeat(3, 1fr)',
                xl:   'repeat(4, 1fr)',
              }}
              gap={4}
              mb={8}
            >
              {paginated.map((group) => (
                <EanCard
                  key={group.ean}
                  group={group}
                  quantity={quantities[group.ean] ?? 1}
                  selectedSellerId={selectedOffers[group.ean] ?? group.offers[0]?.sellerId ?? ''}
                  onQtyChange={handleQtyChange}
                  onSelectSeller={handleSelectSeller}
                  onAddToCart={handleAddToCart}
                  onOpenDetail={openDetailModal}
                  adding={adding.has(group.ean)}
                />
              ))}
            </Grid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="center" align="center" gap={3} mb={8}>
                <Button
                  size="sm" variant="outline"
                  isDisabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Précédent
                </Button>

                <Wrap spacing={1}>
                  {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                    <WrapItem key={p}>
                      <Button
                        size="sm"
                        variant={p === page ? 'solid' : 'ghost'}
                        colorScheme={p === page ? 'blue' : 'gray'}
                        onClick={() => setPage(p)}
                        minW={8}
                      >
                        {p}
                      </Button>
                    </WrapItem>
                  ))}
                  {totalPages > 10 && (
                    <WrapItem>
                      <Text fontSize="sm" color={C.muted} alignSelf="center">…{totalPages}</Text>
                    </WrapItem>
                  )}
                </Wrap>

                <Button
                  size="sm" variant="outline"
                  isDisabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant →
                </Button>
              </Flex>
            )}
          </>
        )}
      </Container>

      {/* ── Modal comparatif vendeurs ──────────────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent rounded="2xl">
          <ModalHeader borderBottom="1px solid" borderColor={C.border} pb={4}>
            <VStack align="start" spacing={1}>
              <HStack>
                <Icon as={FaBarcode} color={C.navy} />
                <Text color={C.navy} fontWeight="800" noOfLines={1}>
                  {detailGroup?.productName}
                </Text>
              </HStack>
              <Badge fontFamily="mono" fontSize="xs" px={2} py={0.5} bg={C.bgAlt} color={C.slate}>
                EAN : {detailGroup?.ean}
              </Badge>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={5}>
            {detailGroup && (
              <VStack align="stretch" spacing={4}>

                {/* Sélecteur de quantité */}
                <HStack bg={C.bgAlt} rounded="lg" p={3}>
                  <Text fontSize="sm" fontWeight="600" color={C.slate} flex="1">
                    Quantité pour comparer les prix :
                  </Text>
                  <NumberInput
                    size="sm"
                    min={1}
                    value={detailQty}
                    onChange={(_, val) =>
                      handleQtyChange(detailGroup.ean, isNaN(val) ? 1 : Math.max(1, val))
                    }
                    w="110px"
                  >
                    <NumberInputField
                      fontFamily="mono" fontWeight="700" textAlign="center"
                    />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </HStack>

                {/* Tableau comparatif */}
                <TableContainer rounded="xl" border="1px solid" borderColor={C.border} overflow="hidden">
                  <Table size="sm">
                    <Thead bg={C.bgAlt}>
                      <Tr>
                        <Th color={C.muted} fontSize="xs">RANG</Th>
                        <Th color={C.muted} fontSize="xs">VENDEUR</Th>
                        <Th color={C.muted} fontSize="xs" isNumeric>MOQ</Th>
                        <Th color={C.muted} fontSize="xs" isNumeric>PRIX UNIT.</Th>
                        <Th color={C.muted} fontSize="xs" isNumeric>TOTAL ({detailQty} u)</Th>
                        <Th color={C.muted} fontSize="xs"></Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {detailOffers.map((offer, i) => {
                        const isSel = offer.sellerId === selectedOffers[detailGroup.ean];
                        return (
                          <Tr
                            key={offer.productId}
                            bg={isSel ? C.blueLight : i % 2 === 0 ? 'white' : C.bgAlt}
                            cursor="pointer"
                            _hover={{ bg: '#f0f7ff' }}
                            onClick={() => handleSelectSeller(detailGroup.ean, offer.sellerId)}
                          >
                            <Td>
                              <Badge
                                colorScheme={i === 0 ? 'green' : i === 1 ? 'blue' : 'gray'}
                                rounded="full" fontSize="xs"
                              >
                                {i === 0 ? '★ #1' : `#${i + 1}`}
                              </Badge>
                            </Td>
                            <Td>
                              <HStack spacing={2}>
                                <Icon
                                  as={isSel ? FaCheckCircle : FaCircle}
                                  color={isSel ? 'blue.500' : 'gray.200'}
                                  boxSize={3.5}
                                />
                                <Text
                                  fontSize="sm"
                                  fontWeight={isSel ? '700' : '500'}
                                  color={C.navy}
                                >
                                  {offer.sellerName}
                                </Text>
                              </HStack>
                            </Td>
                            <Td isNumeric>
                              <Text fontSize="xs" color={C.muted} fontFamily="mono">{offer.moq}</Text>
                            </Td>
                            <Td isNumeric>
                              <Text
                                fontWeight="700"
                                color={i === 0 ? C.green : C.slate}
                                fontFamily="mono"
                                fontSize="sm"
                              >
                                {fmtMAD(offer.unitPrice)}
                              </Text>
                            </Td>
                            <Td isNumeric>
                              <Text fontWeight="600" color={C.navy} fontFamily="mono" fontSize="sm">
                                {fmtMAD(offer.lineTotal)}
                              </Text>
                            </Td>
                            <Td>
                              <Button
                                size="xs"
                                colorScheme="blue"
                                variant={isSel ? 'solid' : 'outline'}
                                leftIcon={<Icon as={FaShoppingCart} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSeller(detailGroup.ean, offer.sellerId);
                                  handleAddToCart(detailGroup.ean).then(onClose);
                                }}
                                isLoading={adding.has(detailGroup.ean)}
                              >
                                {isSel ? 'Ajouter' : 'Choisir'}
                              </Button>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>

                {/* Alerte économie */}
                {detailOffers.length > 1 && (
                  <Alert status="success" rounded="xl" fontSize="sm">
                    <AlertIcon />
                    <Box>
                      <Text fontWeight="700">Économie potentielle</Text>
                      <Text>
                        {fmtMAD(
                          (detailOffers[detailOffers.length - 1].unitPrice - detailOffers[0].unitPrice) *
                            detailQty,
                        )}{' '}
                        de différence entre le vendeur le moins cher et le plus cher
                        pour {detailQty} unité{detailQty > 1 ? 's' : ''}.
                      </Text>
                    </Box>
                  </Alert>
                )}

              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
