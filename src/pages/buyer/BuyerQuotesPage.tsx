import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, Input, InputGroup,
  InputLeftElement, Drawer, DrawerBody, DrawerHeader, DrawerContent, DrawerOverlay,
  DrawerCloseButton, Select, Textarea, useDisclosure, useToast, Badge,
  Skeleton, FormControl, FormLabel, NumberInput, NumberInputField,
  NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  IconButton, Table, Thead, Tbody, Tr, Th, Td,
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, ModalCloseButton,
} from '@chakra-ui/react';
import {
  Search, FileText, Plus, ChevronRight, Check, X, ArrowLeft, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { generateDevisPDF } from '../../lib/pdf/pdfUtils';
import type { Quote, QuoteLine } from '../../types';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558',
  amber: '#c97d1a', amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b',
  border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#1a5c35', greenLight: '#dcfce7',
  red: '#be1c1c', redLight: '#fff1f1',
};

// ── Status config ─────────────────────────────────────────────────────────────
const QUOTE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Nouveau',   color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'En cours',  color: '#1e40af', bg: '#dbeafe' },
  responded:   { label: 'Répondu',   color: '#4a1d96', bg: '#ede9fe' },
  accepted:    { label: 'Accepté',   color: '#14532d', bg: '#dcfce7' },
  refused:     { label: 'Refusé',    color: '#7f1d1d', bg: '#fee2e2' },
  expired:     { label: 'Expiré',    color: '#6b7280', bg: '#f3f4f6' },
  converted:   { label: 'Converti',  color: '#14532d', bg: '#dcfce7' },
};

const STATUS_FILTERS = [
  { k: 'all',         l: 'Tous' },
  { k: 'new',         l: 'Nouveaux' },
  { k: 'in_progress', l: 'En cours' },
  { k: 'responded',   l: 'Répondus' },
  { k: 'accepted',    l: 'Acceptés' },
  { k: 'refused',     l: 'Refusés' },
  { k: 'converted',   l: 'Convertis' },
];

// ── QuoteLine extended ────────────────────────────────────────────────────────
type QuoteLineWithProduct = QuoteLine & { products?: { name: string } };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BuyerQuotesPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const toast = useToast();
  const { activeOrg } = useAuth();

  // ── Quote list ─────────────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // ── Quote detail ───────────────────────────────────────────────────────────
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteLines, setQuoteLines] = useState<QuoteLineWithProduct[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { isOpen: isDetailOpen, onOpen: openDetail, onClose: closeDetail } = useDisclosure();

  // ── New quote form ─────────────────────────────────────────────────────────
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ seller_org_id: '', notes: '', desired_delivery_date: '' });
  const [lines, setLines] = useState<{
    product_id: string; quantity: number; requested_price: string; description: string;
  }[]>([]);
  const [creating, setCreating] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { isOpen: isCreateOpen, onOpen: openCreate, onClose: closeCreate } = useDisclosure();

  // ── Fetch quotes ───────────────────────────────────────────────────────────
  async function fetchQuotes() {
    if (!activeOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select('*, quote_lines(*, products(name))')
      .eq('buyer_org_id', activeOrg.id)
      .order('requested_at', { ascending: false });
    setQuotes((data as Quote[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchQuotes(); }, [activeOrg]);

  // Auto-open detail if navigated from /buyer/quotes/:id
  useEffect(() => {
    if (!routeId || quotes.length === 0) return;
    const target = quotes.find(q => q.id === routeId);
    if (target) openQuoteDetail(target);
  }, [routeId, quotes.length]);

  // ── Fetch sellers for create form ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('organisations')
      .select('id, name')
      .eq('org_type', 'seller')
      .eq('validation_status', 'active')
      .then(({ data }) => setSellers(data ?? []));
  }, []);

  async function onSellerChange(sellerId: string) {
    setForm(f => ({ ...f, seller_org_id: sellerId }));
    setLines([]);
    if (!sellerId) { setProducts([]); return; }
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('seller_org_id', sellerId)
      .eq('status', 'active')
      .order('name');
    setProducts(data ?? []);
  }

  function addLine() {
    setLines(prev => [...prev, { product_id: '', quantity: 1, requested_price: '', description: '' }]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateLine<K extends 'product_id' | 'quantity' | 'requested_price' | 'description'>(
    i: number, field: K, value: (typeof lines[0])[K]
  ) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  // ── Submit new quote ───────────────────────────────────────────────────────
  async function submitQuote() {
    if (!activeOrg || !form.seller_org_id) {
      toast({ title: 'Sélectionnez un fournisseur', status: 'warning', duration: 3000, position: 'bottom-right' });
      return;
    }
    const validLines = lines.filter(l => l.product_id && l.quantity >= 1);
    if (validLines.length === 0) {
      toast({ title: 'Ajoutez au moins une ligne produit', status: 'warning', duration: 3000, position: 'bottom-right' });
      return;
    }
    setCreating(true);
    try {
      const quoteNumber = `DEV-${Date.now().toString().slice(-8)}`;
      const { data: q, error: qErr } = await supabase
        .from('quotes')
        .insert({
          quote_number: quoteNumber,
          buyer_org_id: activeOrg.id,
          seller_org_id: form.seller_org_id,
          notes: form.notes || null,
          desired_delivery_date: form.desired_delivery_date || null,
        })
        .select('id')
        .single();
      if (qErr) throw qErr;

      const { error: lErr } = await supabase.from('quote_lines').insert(
        validLines.map(l => ({
          quote_id: (q as { id: string }).id,
          product_id: l.product_id,
          quantity: l.quantity,
          requested_price: l.requested_price ? parseFloat(l.requested_price) : null,
          product_description: l.description || null,
        }))
      );
      if (lErr) throw lErr;

      toast({ title: 'Demande de devis envoyée', status: 'success', duration: 3000, position: 'top-right' });
      closeCreate();
      setForm({ seller_org_id: '', notes: '', desired_delivery_date: '' });
      setLines([]);
      setProducts([]);
      fetchQuotes();
    } catch (e) {
      toast({
        title: 'Erreur lors de la création',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        status: 'error', duration: 4000, isClosable: true, position: 'bottom-right',
      });
    } finally {
      setCreating(false);
    }
  }

  // ── Open quote detail ──────────────────────────────────────────────────────
  async function openQuoteDetail(quote: Quote) {
    setSelectedQuote(quote);
    setDetailLoading(true);
    openDetail();
    const { data } = await supabase
      .from('quote_lines')
      .select('*, products(name, short_description)')
      .eq('quote_id', quote.id);
    setQuoteLines((data as QuoteLineWithProduct[]) ?? []);
    setDetailLoading(false);
    if (quote.status === 'new') {
      await supabase.from('quotes').update({ status: 'in_progress' }).eq('id', quote.id);
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'in_progress' } : q));
    }
  }

  // ── Accept / Refuse ────────────────────────────────────────────────────────
  async function handleAccept() {
    if (!selectedQuote) return;
    setActionLoading(true);
    try {
      await supabase.from('quotes').update({ status: 'accepted' }).eq('id', selectedQuote.id);
      toast({ title: 'Devis accepté', status: 'success', duration: 3000, position: 'top-right' });
      closeDetail();
      fetchQuotes();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRefuse() {
    if (!selectedQuote) return;
    setActionLoading(true);
    try {
      await supabase.from('quotes').update({ status: 'refused' }).eq('id', selectedQuote.id);
      toast({ title: 'Devis refusé', status: 'info', duration: 3000, position: 'top-right' });
      closeDetail();
      fetchQuotes();
    } finally {
      setActionLoading(false);
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = quotes.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (search && !q.quote_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <VStack spacing={6} align="stretch">

      {/* Header */}
      <Flex align="flex-start" justify="space-between" flexWrap="wrap" gap={3}>
        <Box>
          <Button variant="ghost" size="xs" leftIcon={<ArrowLeft size={12} />}
            style={{ color: C.muted }} mb={1} onClick={() => navigate('/buyer')}>
            Tableau de bord
          </Button>
          <Heading size="lg" fontWeight="900" style={{ color: C.navy }}>Mes devis</Heading>
          <Text fontSize="sm" style={{ color: C.muted }}>
            Demandes de cotation auprès de vos fournisseurs
          </Text>
        </Box>
        <Button size="sm" fontWeight="700" rounded="full"
          style={{ background: C.navy, color: 'white' }}
          leftIcon={<Plus size={14} />} _hover={{ opacity: 0.9 }}
          onClick={openCreate}>
          Nouvelle demande
        </Button>
      </Flex>

      {/* Filters */}
      <HStack spacing={2} flexWrap="wrap" gap={2}>
        <InputGroup size="sm" maxW="260px">
          <InputLeftElement pointerEvents="none">
            <Search size={14} color={C.muted} />
          </InputLeftElement>
          <Input
            placeholder="Référence devis…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            rounded="full"
            style={{ borderColor: C.border }}
            _focus={{ borderColor: C.navy, boxShadow: 'none' }}
          />
        </InputGroup>
        {STATUS_FILTERS.map(f => (
          <Button key={f.k} size="xs" rounded="full"
            style={{
              background: statusFilter === f.k ? C.navy : 'white',
              color: statusFilter === f.k ? 'white' : C.slate,
              border: `1px solid ${statusFilter === f.k ? C.navy : C.border}`,
            }}
            onClick={() => setStatusFilter(f.k)}>
            {f.l}
            {f.k !== 'all' && quotes.filter(q => q.status === f.k).length > 0 && (
              <Box as="span" ml={1} opacity={0.75}>
                ({quotes.filter(q => q.status === f.k).length})
              </Box>
            )}
          </Button>
        ))}
      </HStack>

      {/* List */}
      {loading ? (
        <VStack spacing={3} align="stretch">
          {[1, 2, 3].map(i => <Skeleton key={i} height="80px" rounded="2xl" />)}
        </VStack>
      ) : filtered.length === 0 ? (
        <Flex direction="column" align="center" py={16} gap={4}
          bg="white" rounded="2xl" style={{ border: `1px solid ${C.border}` }}>
          <Box p={5} rounded="full" style={{ background: C.bgAlt }}>
            <FileText size={36} color={C.border} />
          </Box>
          <Box textAlign="center">
            <Text fontWeight="700" style={{ color: C.slate }}>
              {statusFilter !== 'all' ? 'Aucun devis dans cette catégorie' : 'Aucun devis'}
            </Text>
            <Text fontSize="sm" style={{ color: C.muted }} mt={1}>
              Créez votre première demande de cotation auprès d'un fournisseur
            </Text>
          </Box>
          <Button size="sm" fontWeight="700" rounded="full"
            style={{ background: C.navy, color: 'white' }}
            leftIcon={<Plus size={14} />}
            onClick={openCreate}>
            Nouvelle demande
          </Button>
        </Flex>
      ) : (
        <VStack spacing={3} align="stretch">
          {filtered.map(q => {
            const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.new;
            const lineCount = (q as any).quote_lines?.length ?? 0;
            return (
              <Box
                key={q.id}
                bg="white"
                rounded="2xl"
                style={{ border: `1px solid ${C.border}` }}
                _hover={{ shadow: 'md', borderColor: C.amberBorder }}
                transition="all 0.15s"
                cursor="pointer"
                onClick={() => openQuoteDetail(q)}
              >
                <Flex px={5} py={4} justify="space-between" align="center">
                  <HStack spacing={4}>
                    <Box p={2.5} rounded="lg" style={{ background: C.bgAlt }}>
                      <FileText size={18} color={C.navy} />
                    </Box>
                    <VStack align="start" spacing={0.5}>
                      <Text fontWeight="800" fontSize="sm" style={{ color: C.navy }}>
                        {q.quote_number}
                      </Text>
                      <Text fontSize="xs" style={{ color: C.muted }}>
                        {new Date(q.requested_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                        {lineCount > 0 && ` · ${lineCount} ligne${lineCount > 1 ? 's' : ''}`}
                        {q.notes && ` · ${q.notes.slice(0, 40)}${q.notes.length > 40 ? '…' : ''}`}
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack spacing={3}>
                    <Badge
                      px={2} py={0.5} rounded="md" fontSize="10px" fontWeight="700"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </Badge>
                    <ChevronRight size={16} color={C.muted} />
                  </HStack>
                </Flex>
              </Box>
            );
          })}
        </VStack>
      )}

      {/* ── Create drawer ────────────────────────────────────────────────── */}
      <Drawer isOpen={isCreateOpen} placement="right" onClose={closeCreate} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton top={4} right={4} />
          <DrawerHeader style={{ borderBottom: `1px solid ${C.border}` }}>
            <HStack spacing={3}>
              <Box p={2} style={{ background: C.amberLight }} rounded="lg">
                <FileText size={16} color={C.amber} />
              </Box>
              <Box>
                <Text fontWeight="800" fontSize="sm" style={{ color: C.navy }}>
                  Nouvelle demande de devis
                </Text>
                <Text fontSize="xs" style={{ color: C.muted }}>RFQ — Request for Quotation</Text>
              </Box>
            </HStack>
          </DrawerHeader>
          <DrawerBody pt={5}>
            <VStack spacing={5} align="stretch">

              {/* Seller */}
              <FormControl isRequired>
                <FormLabel fontSize="sm" fontWeight="600" style={{ color: C.slate }}>
                  Fournisseur
                </FormLabel>
                <Select
                  placeholder="Sélectionner un fournisseur…"
                  value={form.seller_org_id}
                  onChange={e => onSellerChange(e.target.value)}
                  rounded="lg"
                  style={{ borderColor: C.border }}
                  _focus={{ borderColor: C.navy, boxShadow: 'none' }}
                >
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormControl>

              {/* Product lines */}
              <Box>
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" fontWeight="700" style={{ color: C.navy }}>
                    Lignes produits
                  </Text>
                  <Button
                    size="xs" variant="outline" rounded="full"
                    leftIcon={<Plus size={11} />}
                    isDisabled={!form.seller_org_id}
                    onClick={addLine}
                    style={{ borderColor: C.border, color: C.slate }}
                    _hover={{ borderColor: C.navy, color: C.navy }}
                  >
                    Ajouter une ligne
                  </Button>
                </Flex>

                {lines.length === 0 ? (
                  <Box
                    rounded="xl" p={4} textAlign="center"
                    style={{ border: `2px dashed ${C.border}`, background: C.bgAlt }}
                  >
                    <Text fontSize="sm" style={{ color: C.muted }}>
                      {form.seller_org_id
                        ? 'Cliquez sur "Ajouter une ligne" pour sélectionner des produits'
                        : 'Sélectionnez d\'abord un fournisseur'}
                    </Text>
                  </Box>
                ) : (
                  <VStack spacing={3} align="stretch">
                    {lines.map((line, i) => (
                      <Box
                        key={i} rounded="xl" p={4}
                        style={{ border: `1px solid ${C.border}`, background: C.bgAlt }}
                      >
                        <Flex justify="space-between" align="center" mb={3}>
                          <Text fontSize="11px" fontWeight="700" style={{ color: C.amber }}>
                            Ligne {i + 1}
                          </Text>
                          <IconButton
                            aria-label="Supprimer la ligne"
                            icon={<Trash2 size={12} />}
                            size="xs" variant="ghost"
                            style={{ color: C.red }}
                            _hover={{ bg: C.redLight }}
                            onClick={() => removeLine(i)}
                          />
                        </Flex>
                        <VStack spacing={3}>
                          <FormControl isRequired>
                            <FormLabel fontSize="11px" style={{ color: C.muted }}>Produit</FormLabel>
                            <Select
                              size="sm" rounded="lg"
                              placeholder="Choisir un produit…"
                              value={line.product_id}
                              onChange={e => updateLine(i, 'product_id', e.target.value)}
                            >
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <HStack spacing={3}>
                            <FormControl isRequired flex={1}>
                              <FormLabel fontSize="11px" style={{ color: C.muted }}>Quantité</FormLabel>
                              <NumberInput
                                size="sm" min={1} value={line.quantity}
                                onChange={(_, n) => updateLine(i, 'quantity', isNaN(n) ? 1 : n)}
                              >
                                <NumberInputField rounded="lg" />
                                <NumberInputStepper>
                                  <NumberIncrementStepper />
                                  <NumberDecrementStepper />
                                </NumberInputStepper>
                              </NumberInput>
                            </FormControl>
                            <FormControl flex={1}>
                              <FormLabel fontSize="11px" style={{ color: C.muted }}>
                                Prix cible HT (opt.)
                              </FormLabel>
                              <Input
                                size="sm" rounded="lg" placeholder="0.00"
                                value={line.requested_price}
                                onChange={e => updateLine(i, 'requested_price', e.target.value)}
                              />
                            </FormControl>
                          </HStack>
                          <FormControl>
                            <FormLabel fontSize="11px" style={{ color: C.muted }}>
                              Précisions / description
                            </FormLabel>
                            <Input
                              size="sm" rounded="lg"
                              placeholder="Spécifications, conditionnement, qualité…"
                              value={line.description}
                              onChange={e => updateLine(i, 'description', e.target.value)}
                            />
                          </FormControl>
                        </VStack>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>

              {/* Delivery date */}
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600" style={{ color: C.slate }}>
                  Date de livraison souhaitée
                </FormLabel>
                <Input
                  type="date" rounded="lg"
                  value={form.desired_delivery_date}
                  onChange={e => setForm(f => ({ ...f, desired_delivery_date: e.target.value }))}
                  style={{ borderColor: C.border }}
                  _focus={{ borderColor: C.navy, boxShadow: 'none' }}
                />
              </FormControl>

              {/* Notes */}
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600" style={{ color: C.slate }}>
                  Notes additionnelles
                </FormLabel>
                <Textarea
                  rows={3} rounded="lg" resize="none"
                  placeholder="Conditions particulières, délais, qualité requise, incoterm souhaité…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ borderColor: C.border }}
                  _focus={{ borderColor: C.navy, boxShadow: 'none' }}
                />
              </FormControl>

              <Button
                isLoading={creating} loadingText="Envoi en cours…"
                size="lg" fontWeight="700" rounded="xl"
                style={{ background: C.navy, color: 'white' }}
                _hover={{ opacity: 0.9 }}
                leftIcon={<Check size={16} />}
                onClick={submitQuote}
              >
                Envoyer la demande de devis
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selectedQuote && (
        <Modal isOpen={isDetailOpen} onClose={closeDetail} size="3xl">
          <ModalOverlay />
          <ModalContent rounded="2xl">
            <ModalHeader style={{ borderBottom: `1px solid ${C.border}` }}>
              <HStack spacing={3}>
                <FileText size={18} color={C.navy} />
                <Box>
                  <Text fontWeight="800" style={{ color: C.navy }}>
                    {selectedQuote.quote_number}
                  </Text>
                  <Text fontSize="xs" style={{ color: C.muted }} fontWeight="normal">
                    {new Date(selectedQuote.requested_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Text>
                </Box>
                <Badge
                  ml={2} px={2} py={0.5} rounded="md" fontSize="11px" fontWeight="700"
                  style={{
                    background: (QUOTE_STATUS[selectedQuote.status] ?? QUOTE_STATUS.new).bg,
                    color: (QUOTE_STATUS[selectedQuote.status] ?? QUOTE_STATUS.new).color,
                  }}
                >
                  {(QUOTE_STATUS[selectedQuote.status] ?? QUOTE_STATUS.new).label}
                </Badge>
              </HStack>
            </ModalHeader>
            <ModalCloseButton />

            <ModalBody py={5}>
              {detailLoading ? (
                <VStack spacing={3}>
                  {[1, 2, 3].map(i => <Skeleton key={i} height="48px" rounded="lg" />)}
                </VStack>
              ) : (
                <VStack spacing={5} align="stretch">
                  {/* Notes */}
                  {selectedQuote.notes && (
                    <Box
                      rounded="xl" p={4}
                      style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}
                    >
                      <Text fontSize="11px" fontWeight="700" style={{ color: C.muted }} mb={1}>
                        Notes de la demande
                      </Text>
                      <Text fontSize="sm" style={{ color: C.slate }}>{selectedQuote.notes}</Text>
                    </Box>
                  )}

                  {/* Lines table */}
                  <Box rounded="xl" overflow="hidden" style={{ border: `1px solid ${C.border}` }}>
                    <Box px={4} py={2.5} style={{ background: C.navy }}>
                      <Text fontSize="11px" fontWeight="700" style={{ color: 'white' }}>
                        Lignes de devis ({quoteLines.length})
                      </Text>
                    </Box>
                    {quoteLines.length === 0 ? (
                      <Box p={5} textAlign="center">
                        <Text fontSize="sm" style={{ color: C.muted }}>Aucune ligne</Text>
                      </Box>
                    ) : (
                      <Box overflowX="auto">
                        <Table size="sm">
                          <Thead style={{ background: C.bgAlt }}>
                            <Tr>
                              <Th fontSize="10px" style={{ color: C.muted }}>Produit</Th>
                              <Th fontSize="10px" style={{ color: C.muted }} isNumeric>Qté</Th>
                              <Th fontSize="10px" style={{ color: C.muted }} isNumeric>Prix demandé</Th>
                              <Th fontSize="10px" style={{ color: C.muted }} isNumeric>Prix proposé</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {quoteLines.map(l => (
                              <Tr key={l.id}>
                                <Td>
                                  <Text fontSize="sm" fontWeight="600" style={{ color: C.navy }}>
                                    {l.products?.name ?? '—'}
                                  </Text>
                                  {l.product_description && (
                                    <Text fontSize="11px" style={{ color: C.muted }}>
                                      {l.product_description}
                                    </Text>
                                  )}
                                </Td>
                                <Td isNumeric fontWeight="700" style={{ color: C.navy }}>
                                  {l.quantity}
                                </Td>
                                <Td isNumeric style={{ color: C.muted }}>
                                  {l.requested_price
                                    ? `${Number(l.requested_price).toFixed(2)}`
                                    : '—'}
                                </Td>
                                <Td isNumeric>
                                  <Text
                                    fontWeight="700"
                                    style={{ color: l.proposed_price ? C.green : C.muted }}
                                  >
                                    {l.proposed_price
                                      ? `${Number(l.proposed_price).toFixed(2)}`
                                      : '—'}
                                  </Text>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    )}
                  </Box>

                  {/* Responded banner */}
                  {selectedQuote.status === 'responded' && quoteLines.some(l => l.proposed_price) && (
                    <Box
                      rounded="xl" p={4}
                      style={{ background: '#f0fdf4', border: '1px solid #86efac' }}
                    >
                      <Text fontSize="sm" fontWeight="700" style={{ color: C.green }} mb={1}>
                        Le vendeur a répondu à votre demande
                      </Text>
                      <Text fontSize="sm" style={{ color: '#166534' }}>
                        Vérifiez les prix proposés ci-dessus puis acceptez ou refusez le devis.
                      </Text>
                    </Box>
                  )}

                  {/* Accepted / refused info */}
                  {(selectedQuote.status === 'accepted' || selectedQuote.status === 'converted') && (
                    <Box
                      rounded="xl" p={4}
                      style={{ background: C.greenLight, border: '1px solid #86efac' }}
                    >
                      <Text fontSize="sm" fontWeight="700" style={{ color: C.green }}>
                        Devis accepté — en attente de confirmation vendeur
                      </Text>
                    </Box>
                  )}
                  {selectedQuote.status === 'refused' && (
                    <Box
                      rounded="xl" p={4}
                      style={{ background: C.redLight, border: `1px solid #fca5a5` }}
                    >
                      <Text fontSize="sm" fontWeight="700" style={{ color: C.red }}>
                        Devis refusé
                      </Text>
                    </Box>
                  )}
                </VStack>
              )}
            </ModalBody>

            <ModalFooter style={{ borderTop: `1px solid ${C.border}` }} gap={3} justifyContent="space-between">
              <Button
                variant="outline" rounded="xl" leftIcon={<FileText size={14} />}
                style={{ borderColor: C.border, color: C.slate }}
                _hover={{ bg: C.bgAlt }}
                isLoading={pdfLoading}
                loadingText="PDF…"
                onClick={async () => {
                  setPdfLoading(true);
                  try { await generateDevisPDF(selectedQuote.id); }
                  catch { /* silencieux */ }
                  finally { setPdfLoading(false); }
                }}
              >
                Télécharger PDF
              </Button>
              {selectedQuote.status === 'responded' && (
                <HStack spacing={3}>
                  <Button
                    variant="outline" rounded="xl" leftIcon={<X size={15} />}
                    style={{ borderColor: C.red, color: C.red }}
                    _hover={{ bg: C.redLight }}
                    isLoading={actionLoading}
                    onClick={handleRefuse}
                  >
                    Refuser
                  </Button>
                  <Button
                    rounded="xl" leftIcon={<Check size={15} />}
                    style={{ background: C.green, color: 'white' }}
                    _hover={{ opacity: 0.9 }}
                    isLoading={actionLoading}
                    onClick={handleAccept}
                  >
                    Accepter le devis
                  </Button>
                </HStack>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </VStack>
  );
}
