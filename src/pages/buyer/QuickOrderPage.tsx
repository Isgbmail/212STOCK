import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Container, Divider, Flex, Grid, GridItem,
  Heading, HStack, Icon, Input, Radio, RadioGroup,
  SimpleGrid, Spinner, Stack, Tag, TagLabel, Text, Textarea,
  VStack, Tooltip, Collapse, useToast, Badge, IconButton,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Select,
  Alert, AlertIcon, AlertTitle, AlertDescription,
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
} from '@chakra-ui/react';
import {
  FaBarcode, FaSearch, FaCheckCircle, FaShoppingCart,
  FaUpload, FaTimes, FaChevronDown, FaTag, FaTruck, FaGift,
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import {
  parseEanInput,
  optimizeCart,
  addOptimizedLinesToCart,
  getEffectiveUnitPrice,
  fetchDeliveryConfigs,
  computeLandedCost,
  computeDeliveryFee,
} from '../../lib/cartOptimizer';
import type {
  OptimizationResult, OptimizedLine,
  LandedCostResult, DeliveryConfig, ConsolidationOption,
} from '../../lib/cartOptimizer';

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0d1f38', navyMid: '#1a3558',
  amber: '#c97d1a', amberLight: '#fef3c7', amberBorder: '#fbbf24',
  slate: '#334155', muted: '#64748b',
  border: '#e2e8f0', bgAlt: '#f8fafc',
  green: '#1a5c35', greenLight: '#dcfce7',
  red: '#be1c1c', redLight: '#fff1f1',
};

function fmtMAD(n: number) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(n);
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = C.navy }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Box bg="white" border="1px solid" borderColor={C.border} rounded="xl" p={4}>
      <Text fontSize="xs" color={C.muted} fontWeight="600" textTransform="uppercase" letterSpacing="wide" mb={1}>
        {label}
      </Text>
      <Text fontSize="2xl" fontWeight="800" color={color} lineHeight={1}>
        {value}
      </Text>
      {sub && <Text fontSize="xs" color={C.muted} mt={1}>{sub}</Text>}
    </Box>
  );
}

// ── EAN row (one product line in the results table) ───────────────────────────
function EanRow({
  line,
  index,
  onChangeOffer,
}: {
  line: OptimizedLine;
  index: number;
  onChangeOffer: (lineIndex: number, sellerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const saving = line.offers.length > 1
    ? ((line.offers[line.offers.length - 1].unitPrice - line.selected.unitPrice) / line.offers[line.offers.length - 1].unitPrice * 100).toFixed(0)
    : null;

  return (
    <>
      <Tr bg={index % 2 === 0 ? 'white' : C.bgAlt} _hover={{ bg: '#f0f4ff' }}>
        <Td>
          <Text fontFamily="mono" fontSize="sm" fontWeight="600" color={C.slate}>
            {line.ean}
          </Text>
        </Td>
        <Td>
          <VStack align="start" spacing={0}>
            <Text fontWeight="600" fontSize="sm" color={C.navy} noOfLines={1}>
              {line.selected.productName}
            </Text>
            {line.selected.moq > 1 && (
              <Text fontSize="xs" color={C.muted}>MOQ : {line.selected.moq}</Text>
            )}
          </VStack>
        </Td>
        <Td isNumeric>
          <Text fontWeight="700" color={C.slate}>{line.quantity}</Text>
        </Td>
        <Td isNumeric>
          <VStack align="end" spacing={0}>
            <HStack spacing={1}>
              <Text fontWeight="700" color={C.green} fontSize="sm">
                {fmtMAD(line.selected.unitPrice)}
              </Text>
              {saving && Number(saving) > 0 && (
                <Tag size="sm" colorScheme="green" rounded="full">
                  <TagLabel>-{saving}%</TagLabel>
                </Tag>
              )}
            </HStack>
            <Text fontSize="xs" color={C.muted}>/ unité</Text>
          </VStack>
        </Td>
        <Td>
          <VStack align="start" spacing={0}>
            <Text fontWeight="600" fontSize="sm" color={C.navy} noOfLines={1}>
              {line.selected.sellerName}
            </Text>
            {line.offers.length > 1 && (
              <Button
                variant="link"
                size="xs"
                color="blue.500"
                onClick={() => setExpanded((p) => !p)}
                rightIcon={<Icon as={FaChevronDown} transform={expanded ? 'rotate(180deg)' : undefined} transition="0.2s" />}
              >
                {line.offers.length - 1} autre{line.offers.length > 2 ? 's' : ''} offre{line.offers.length > 2 ? 's' : ''}
              </Button>
            )}
          </VStack>
        </Td>
        <Td isNumeric>
          <Text fontWeight="800" color={C.navy} fontSize="sm">
            {fmtMAD(line.selected.lineTotal)}
          </Text>
        </Td>
      </Tr>

      {/* Alternatives row */}
      {expanded && (
        <Tr>
          <Td colSpan={6} bg="#f0f7ff" py={2} px={4}>
            <VStack align="start" spacing={1} w="full">
              <Text fontSize="xs" fontWeight="700" color={C.muted} mb={1}>
                ALTERNATIVES DISPONIBLES
              </Text>
              {line.offers.map((offer, i) => (
                <Flex
                  key={offer.productId}
                  w="full"
                  justify="space-between"
                  align="center"
                  py={1}
                  px={2}
                  rounded="md"
                  bg={offer.sellerId === line.selected.sellerId ? '#e0edff' : 'white'}
                  border="1px solid"
                  borderColor={offer.sellerId === line.selected.sellerId ? 'blue.200' : C.border}
                  cursor={offer.sellerId === line.selected.sellerId ? 'default' : 'pointer'}
                  _hover={offer.sellerId !== line.selected.sellerId ? { borderColor: 'blue.300' } : {}}
                  onClick={() => {
                    if (offer.sellerId !== line.selected.sellerId) {
                      onChangeOffer(index, offer.sellerId);
                    }
                  }}
                >
                  <HStack spacing={3}>
                    <Icon
                      as={FaCheckCircle}
                      color={offer.sellerId === line.selected.sellerId ? 'blue.500' : 'gray.200'}
                      boxSize={4}
                    />
                    <Text fontSize="sm" fontWeight={offer.sellerId === line.selected.sellerId ? '700' : '500'} color={C.navy}>
                      {offer.sellerName}
                    </Text>
                    {i === 0 && (
                      <Badge colorScheme="green" fontSize="2xs" rounded="full">Meilleur prix</Badge>
                    )}
                  </HStack>
                  <HStack spacing={4}>
                    <Text fontSize="sm" fontWeight="700" color={i === 0 ? C.green : C.slate}>
                      {fmtMAD(offer.unitPrice)} / u
                    </Text>
                    <Text fontSize="sm" color={C.muted} w="24" textAlign="right">
                      {fmtMAD(offer.lineTotal)}
                    </Text>
                  </HStack>
                </Flex>
              ))}
            </VStack>
          </Td>
        </Tr>
      )}
    </>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function QuickOrderPage() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const toast = useToast({ position: 'top-right', duration: 3500 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawInput, setRawInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [lines, setLines] = useState<OptimizedLine[]>([]);   // mutable copy of result.lines
  const [mode, setMode] = useState<'optimal' | 'single'>('optimal');
  const [selectedSingleVendor, setSelectedSingleVendor] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [landedResult, setLandedResult] = useState<LandedCostResult | null>(null);
  const [deliveryConfigs, setDeliveryConfigs] = useState<Map<string, DeliveryConfig>>(new Map());

  // ── Analyse ──────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    const inputs = parseEanInput(rawInput);
    if (inputs.length === 0) {
      toast({ status: 'warning', title: 'Aucun code EAN valide détecté.', description: 'Format attendu : CODE_EAN [QUANTITÉ] par ligne.' });
      return;
    }
    setAnalyzing(true);
    try {
      const res = await optimizeCart(inputs);
      setResult(res);
      setLines(res.lines.map((l) => ({ ...l }))); // mutable copy
      setMode('optimal');
      setSelectedSingleVendor(res.singleVendorOptions.find((v) => v.coversAll)?.sellerId ?? '');

      // Fetch delivery configs once, pass to landed cost to avoid double fetch
      const allVendorIds = [...new Set(res.vendorBundles.map((b) => b.sellerId))];
      const cfgMap = await fetchDeliveryConfigs(allVendorIds);
      setDeliveryConfigs(cfgMap);
      const landed = await computeLandedCost(res, cfgMap);
      setLandedResult(landed);
    } catch (e) {
      toast({ status: 'error', title: 'Erreur lors de l\'analyse.', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Changement d'offre pour une ligne ─────────────────────────────────────

  function handleChangeOffer(lineIndex: number, sellerId: string) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== lineIndex) return line;
        const offer = line.offers.find((o) => o.sellerId === sellerId);
        if (!offer) return line;
        return { ...line, selected: offer };
      }),
    );
  }

  // ── Application d'un vendeur unique ──────────────────────────────────────

  function applyVendor(vendorId: string) {
    if (!result) return;
    setSelectedSingleVendor(vendorId);
    setLines((prev) =>
      prev.map((line) => {
        const offer = line.offers.find((o) => o.sellerId === vendorId);
        return offer ? { ...line, selected: offer } : line;
      }),
    );
  }

  // ── Consolidation livraison ───────────────────────────────────────────────

  function applyConsolidation(opt: ConsolidationOption) {
    setLines((prev) =>
      prev.map((line) => {
        if (!opt.eansToMove.includes(line.ean)) return line;
        const offer = line.offers.find((o) => o.sellerId === opt.absorbVendorId);
        return offer ? { ...line, selected: offer } : line;
      })
    );
    setMode('optimal');
    toast({
      status: 'success',
      title: 'Consolidation appliquée',
      description: `${opt.eansToMove.length} EAN${opt.eansToMove.length > 1 ? 's' : ''} déplacé${opt.eansToMove.length > 1 ? 's' : ''} vers ${opt.absorbVendorName}. Économie nette estimée : ${fmtMAD(opt.netSaving)}.`,
      duration: 4500,
    });
  }

  // ── CSV import ────────────────────────────────────────────────────────────

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      // Accept CSV: first two columns are EAN, QTY (skip header if it contains letters)
      const csvLines = text.split('\n').filter((l) => /\d{8,}/.test(l));
      const normalized = csvLines
        .map((l) => l.split(/[,;\t]+/).slice(0, 2).join(' '))
        .join('\n');
      setRawInput(normalized);
    };
    reader.readAsText(file);
  }

  // ── Ajout au panier ──────────────────────────────────────────────────────

  async function handleAddToCart() {
    if (!activeOrg || lines.length === 0) return;
    setAddingToCart(true);
    const { error } = await addOptimizedLinesToCart(lines, activeOrg.id);
    if (error) {
      toast({ status: 'error', title: 'Erreur', description: error });
    } else {
      toast({
        status: 'success',
        title: `${lines.length} produit${lines.length > 1 ? 's' : ''} ajouté${lines.length > 1 ? 's' : ''} au panier.`,
        description: 'Accédez à vos paniers pour finaliser la commande.',
      });
      navigate('/buyer/carts');
    }
    setAddingToCart(false);
  }

  // ── Calculs dérivés ───────────────────────────────────────────────────────

  const currentTotal = lines.reduce((s, l) => s + l.selected.lineTotal, 0);

  const vendorBundlesCurrent = (() => {
    const map = new Map<string, { sellerName: string; lines: OptimizedLine[]; subtotal: number }>();
    for (const line of lines) {
      const { sellerId, sellerName } = line.selected;
      if (!map.has(sellerId)) map.set(sellerId, { sellerName, lines: [], subtotal: 0 });
      const vb = map.get(sellerId)!;
      vb.lines.push(line);
      vb.subtotal += line.selected.lineTotal;
    }
    return Array.from(map.entries()).map(([id, vb]) => ({ sellerId: id, ...vb }));
  })();

  // Augment with real-time delivery costs (pure function — no extra DB call)
  const currentLandedBundles = vendorBundlesCurrent.map((vb) => {
    const cfg = deliveryConfigs.get(vb.sellerId) ?? null;
    const deliveryCost = computeDeliveryFee(cfg, vb.subtotal);
    const threshold = cfg?.free_threshold_mad ?? 1000;
    return {
      ...vb,
      deliveryCost,
      landedTotal: vb.subtotal + deliveryCost,
      isFreeDelivery: deliveryCost === 0,
      remainingToFreeDelivery:
        deliveryCost > 0 && (!cfg || cfg.delivery_mode === 'free_above_threshold')
          ? Math.max(0, threshold - vb.subtotal)
          : null,
    };
  });
  const currentDeliveryCost = currentLandedBundles.reduce((s, b) => s + b.deliveryCost, 0);
  const currentLandedCost = currentTotal + currentDeliveryCost;

  const savings = result ? result.cheapestTotal - currentTotal : 0;

  return (
    <Box bg={C.bgAlt} minH="100vh" pb={20}>
      <Container maxW="6xl" pt={10}>

        {/* Header */}
        <VStack align="start" spacing={1} mb={8}>
          <HStack spacing={3}>
            <Flex w={10} h={10} bg={C.navy} rounded="lg" align="center" justify="center">
              <Icon as={FaBarcode} color="white" boxSize={5} />
            </Flex>
            <Heading fontSize="2xl" fontWeight="800" color={C.navy}>
              Quick Order — Code EAN
            </Heading>
          </HStack>
          <Text color={C.muted} fontSize="sm">
            Collez vos codes EAN, l'algorithme trouve automatiquement la combinaison la moins chère sur l'ensemble de votre commande.
          </Text>
        </VStack>

        <Grid templateColumns={{ base: '1fr', xl: result ? '1fr 320px' : '1fr' }} gap={6} alignItems="start">

          {/* ── Zone principale ─────────────────────────────────────────── */}
          <GridItem>

            {/* Input panel */}
            <Box bg="white" border="1px solid" borderColor={C.border} rounded="2xl" p={6} mb={6}>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="700" fontSize="sm" color={C.navy}>
                  CODES EAN
                </Text>
                <HStack spacing={2}>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileImport}
                  />
                  <Button
                    size="sm" variant="ghost" leftIcon={<Icon as={FaUpload} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Importer CSV
                  </Button>
                  {rawInput && (
                    <Button
                      size="sm" variant="ghost" colorScheme="red"
                      leftIcon={<Icon as={FaTimes} />}
                      onClick={() => { setRawInput(''); setResult(null); setLines([]); }}
                    >
                      Effacer
                    </Button>
                  )}
                </HStack>
              </HStack>

              <Textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Un code EAN par ligne, quantité optionnelle :\n\n7622300489124 24\n3228857000756 12\n5900259128159\n8000500037560 6`}
                fontFamily="mono"
                fontSize="sm"
                rows={8}
                resize="vertical"
                borderColor={C.border}
                focusBorderColor="blue.400"
                _placeholder={{ color: C.muted, fontSize: 'xs' }}
              />

              <HStack justify="space-between" align="center" mt={3}>
                <Text fontSize="xs" color={C.muted}>
                  Format : <code>EAN [QTÉ]</code> — séparateur espace, virgule ou ×
                </Text>
                <Button
                  colorScheme="blue"
                  size="md"
                  px={8}
                  leftIcon={analyzing ? <Spinner size="xs" /> : <Icon as={FaSearch} />}
                  isLoading={analyzing}
                  loadingText="Analyse en cours..."
                  onClick={handleAnalyze}
                  isDisabled={!rawInput.trim()}
                >
                  Analyser les prix
                </Button>
              </HStack>
            </Box>

            {/* Résultats */}
            {result && lines.length >= 0 && (
              <>
                {/* Stats */}
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={6}>
                  <StatCard
                    label="EANs analysés"
                    value={lines.length + result.notFound.length}
                    sub={`dont ${result.notFound.length} non trouvé${result.notFound.length !== 1 ? 's' : ''}`}
                  />
                  <StatCard
                    label="Total optimal"
                    value={fmtMAD(result.cheapestTotal)}
                    sub={`${result.vendorBundles.length} vendeur${result.vendorBundles.length !== 1 ? 's' : ''}`}
                    color={C.green}
                  />
                  <StatCard
                    label="Configuration actuelle"
                    value={fmtMAD(currentTotal)}
                    sub={`${vendorBundlesCurrent.length} vendeur${vendorBundlesCurrent.length !== 1 ? 's' : ''}`}
                    color={savings > 0 ? C.amber : C.navy}
                  />
                  <StatCard
                    label="Produits en panier"
                    value={lines.length}
                    sub="prêts à commander"
                  />
                </SimpleGrid>

                {/* EANs non trouvés */}
                {result.notFound.length > 0 && (
                  <Alert status="warning" rounded="xl" mb={4} fontSize="sm">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>EAN{result.notFound.length > 1 ? 's' : ''} non trouvé{result.notFound.length > 1 ? 's' : ''} dans le catalogue</AlertTitle>
                      <AlertDescription color={C.slate}>
                        {result.notFound.join(' · ')}
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}

                {/* Tableau des résultats */}
                {lines.length > 0 && (
                  <Box bg="white" border="1px solid" borderColor={C.border} rounded="2xl" overflow="hidden" mb={6}>
                    <HStack justify="space-between" px={5} py={4} borderBottom="1px solid" borderColor={C.border}>
                      <Text fontWeight="700" fontSize="sm" color={C.navy}>
                        RÉSULTATS ({lines.length} produit{lines.length !== 1 ? 's' : ''})
                      </Text>
                      <RadioGroup value={mode} onChange={(v) => setMode(v as 'optimal' | 'single')}>
                        <HStack spacing={4} fontSize="sm">
                          <Radio value="optimal" colorScheme="blue" size="sm">
                            <Text fontSize="sm">Prix optimal</Text>
                          </Radio>
                          <Radio
                            value="single"
                            colorScheme="blue"
                            size="sm"
                            isDisabled={!result.singleVendorOptions.some((v) => v.coversAll)}
                          >
                            <Tooltip
                              label={
                                !result.singleVendorOptions.some((v) => v.coversAll)
                                  ? "Aucun vendeur ne propose l'intégralité des produits."
                                  : "Un seul vendeur, une seule facture."
                              }
                            >
                              <Text fontSize="sm">Vendeur unique</Text>
                            </Tooltip>
                          </Radio>
                        </HStack>
                      </RadioGroup>
                    </HStack>

                    {/* Sélection vendeur unique */}
                    <Collapse in={mode === 'single'}>
                      <Box px={5} py={3} bg="#f0f7ff" borderBottom="1px solid" borderColor="blue.100">
                        <HStack spacing={3} flexWrap="wrap">
                          <Text fontSize="xs" fontWeight="700" color={C.navy} whiteSpace="nowrap">
                            Vendeur :
                          </Text>
                          {result.singleVendorOptions.filter((v) => v.coversAll).map((v) => (
                            <Button
                              key={v.sellerId}
                              size="xs"
                              variant={selectedSingleVendor === v.sellerId ? 'solid' : 'outline'}
                              colorScheme="blue"
                              onClick={() => applyVendor(v.sellerId)}
                            >
                              {v.sellerName} — {fmtMAD(v.total)}
                            </Button>
                          ))}
                        </HStack>
                      </Box>
                    </Collapse>

                    <TableContainer>
                      <Table variant="simple" size="sm">
                        <Thead bg={C.bgAlt}>
                          <Tr>
                            <Th color={C.muted} fontSize="xs">CODE EAN</Th>
                            <Th color={C.muted} fontSize="xs">PRODUIT</Th>
                            <Th color={C.muted} fontSize="xs" isNumeric>QTÉ</Th>
                            <Th color={C.muted} fontSize="xs" isNumeric>PRIX UNIT.</Th>
                            <Th color={C.muted} fontSize="xs">VENDEUR</Th>
                            <Th color={C.muted} fontSize="xs" isNumeric>TOTAL</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {lines.map((line, i) => (
                            <EanRow
                              key={line.ean}
                              line={line}
                              index={i}
                              onChangeOffer={handleChangeOffer}
                            />
                          ))}
                          <Tr bg={C.navy}>
                            <Td colSpan={5}>
                              <Text fontWeight="700" color="white" fontSize="sm">
                                TOTAL COMMANDE
                              </Text>
                            </Td>
                            <Td isNumeric>
                              <Text fontWeight="800" color="white" fontSize="md">
                                {fmtMAD(currentTotal)}
                              </Text>
                            </Td>
                          </Tr>
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                {/* Résumé par vendeur */}
                {currentLandedBundles.length > 1 && (
                  <Box bg="white" border="1px solid" borderColor={C.border} rounded="2xl" overflow="hidden" mb={6}>
                    <HStack px={5} py={4} borderBottom="1px solid" borderColor={C.border} justify="space-between">
                      <Text fontWeight="700" fontSize="sm" color={C.navy}>
                        RÉPARTITION PAR VENDEUR — {currentLandedBundles.length} LIVRAISONS
                      </Text>
                      {currentDeliveryCost > 0 && (
                        <Badge colorScheme="orange" rounded="full" fontSize="xs" px={2}>
                          {fmtMAD(currentDeliveryCost)} livraison
                        </Badge>
                      )}
                    </HStack>
                    <Accordion allowToggle>
                      {currentLandedBundles.map((vb) => (
                        <AccordionItem key={vb.sellerId} border="none" borderBottom="1px solid" borderColor={C.border}>
                          <AccordionButton px={5} py={3} _hover={{ bg: C.bgAlt }}>
                            <Flex flex="1" justify="space-between" align="center">
                              <HStack spacing={3}>
                                <Text fontWeight="700" fontSize="sm" color={C.navy}>{vb.sellerName}</Text>
                                <Tag size="sm" colorScheme="blue" rounded="full">
                                  <TagLabel>{vb.lines.length} produit{vb.lines.length !== 1 ? 's' : ''}</TagLabel>
                                </Tag>
                                <Tag size="sm" colorScheme={vb.isFreeDelivery ? 'green' : 'orange'} rounded="full">
                                  <TagLabel>
                                    {vb.isFreeDelivery ? 'Livraison offerte' : `Livraison ${fmtMAD(vb.deliveryCost)}`}
                                  </TagLabel>
                                </Tag>
                              </HStack>
                              <VStack align="end" spacing={0} mr={2}>
                                <Text fontWeight="800" color={C.green} fontSize="sm">
                                  {fmtMAD(vb.subtotal)}
                                </Text>
                                <Text fontSize="10px" color={C.muted}>
                                  livré {fmtMAD(vb.landedTotal)}
                                </Text>
                              </VStack>
                            </Flex>
                            <AccordionIcon />
                          </AccordionButton>
                          <AccordionPanel px={5} pb={3}>
                            <VStack align="start" spacing={1}>
                              {vb.lines.map((l) => (
                                <Flex key={l.ean} w="full" justify="space-between">
                                  <Text fontSize="sm" color={C.slate} noOfLines={1} flex="1">
                                    {l.selected.productName}
                                  </Text>
                                  <HStack spacing={4} flexShrink={0}>
                                    <Text fontSize="xs" color={C.muted}>{l.quantity} × {fmtMAD(l.selected.unitPrice)}</Text>
                                    <Text fontSize="sm" fontWeight="600" color={C.navy} w="20" textAlign="right">
                                      {fmtMAD(l.selected.lineTotal)}
                                    </Text>
                                  </HStack>
                                </Flex>
                              ))}
                              {/* Delivery line */}
                              <Flex w="full" justify="space-between" pt={1} mt={1}
                                borderTop="1px dashed" borderColor={C.border}>
                                <HStack spacing={2}>
                                  <Icon as={vb.isFreeDelivery ? FaGift : FaTruck}
                                    color={vb.isFreeDelivery ? C.green : C.amber} boxSize={3} />
                                  <Text fontSize="xs" color={vb.isFreeDelivery ? C.green : C.amber} fontWeight="600">
                                    Frais de livraison
                                  </Text>
                                </HStack>
                                <Text fontSize="xs" fontWeight="700" color={vb.isFreeDelivery ? C.green : C.amber}>
                                  {vb.isFreeDelivery ? 'OFFERTE' : fmtMAD(vb.deliveryCost)}
                                </Text>
                              </Flex>
                              {vb.remainingToFreeDelivery != null && vb.remainingToFreeDelivery > 0 && (
                                <Text fontSize="xs" color={C.muted} pl={5}>
                                  Ajoutez {fmtMAD(vb.remainingToFreeDelivery)} pour obtenir la livraison offerte
                                </Text>
                              )}
                            </VStack>
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </Box>
                )}
              </>
            )}
          </GridItem>

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          {result && lines.length > 0 && (
            <GridItem>
              <Box
                bg="white"
                border="1px solid"
                borderColor={C.border}
                rounded="2xl"
                overflow="hidden"
                position="sticky"
                top="24px"
              >
                <Box px={5} py={4} bg={C.navy}>
                  <Text fontWeight="700" color="white" fontSize="sm">
                    RÉCAPITULATIF
                  </Text>
                </Box>

                <VStack align="stretch" spacing={0} divider={<Divider />}>
                  {/* Résumé produits */}
                  <Box px={5} py={4}>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color={C.muted}>Prix optimal catalogue</Text>
                      <Text fontSize="sm" fontWeight="700" color={C.green}>
                        {fmtMAD(result.cheapestTotal)}
                      </Text>
                    </HStack>
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="sm" color={C.muted}>Sélection actuelle</Text>
                      <Text fontSize="sm" fontWeight="700" color={C.navy}>
                        {fmtMAD(currentTotal)}
                      </Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color={C.muted}>Fournisseurs</Text>
                      <Text fontSize="sm" fontWeight="700" color={C.slate}>
                        {currentLandedBundles.length}
                      </Text>
                    </HStack>
                  </Box>

                  {/* Livraisons par fournisseur */}
                  {currentLandedBundles.length > 0 && (
                    <Box px={5} py={4}>
                      <HStack mb={3}>
                        <Icon as={FaTruck} color={C.muted} boxSize={3} />
                        <Text fontSize="xs" fontWeight="700" color={C.muted} textTransform="uppercase" letterSpacing="wide">
                          Livraisons ({currentLandedBundles.length} envoi{currentLandedBundles.length > 1 ? 's' : ''})
                        </Text>
                      </HStack>
                      <VStack spacing={2} align="stretch">
                        {currentLandedBundles.map((vb) => (
                          <Box key={vb.sellerId}>
                            <HStack justify="space-between">
                              <HStack spacing={2}>
                                <Icon
                                  as={vb.isFreeDelivery ? FaGift : FaTruck}
                                  color={vb.isFreeDelivery ? C.green : C.amber}
                                  boxSize={3}
                                />
                                <Text fontSize="xs" color={C.slate} noOfLines={1} maxW="140px">
                                  {vb.sellerName}
                                </Text>
                              </HStack>
                              <Text fontSize="xs" fontWeight="700" color={vb.isFreeDelivery ? C.green : C.amber}>
                                {vb.isFreeDelivery ? 'Gratuite' : fmtMAD(vb.deliveryCost)}
                              </Text>
                            </HStack>
                            {vb.remainingToFreeDelivery != null && vb.remainingToFreeDelivery > 0 && (
                              <Text fontSize="9px" color={C.muted} pl={5} mt={0.5}>
                                + {fmtMAD(vb.remainingToFreeDelivery)} pour livraison offerte
                              </Text>
                            )}
                          </Box>
                        ))}
                      </VStack>
                      {currentDeliveryCost > 0 && (
                        <HStack justify="space-between" mt={3} pt={2} borderTop="1px solid" borderColor={C.border}>
                          <Text fontSize="xs" fontWeight="700" color={C.muted}>Livraison totale</Text>
                          <Text fontSize="xs" fontWeight="700" color={C.amber}>
                            {fmtMAD(currentDeliveryCost)}
                          </Text>
                        </HStack>
                      )}
                    </Box>
                  )}

                  {/* Total produits + livraison */}
                  <Box px={5} py={4}>
                    <HStack justify="space-between" mb={currentDeliveryCost > 0 ? 1 : 0}>
                      <Text fontWeight="700" color={C.navy}>Produits HT</Text>
                      <Text fontSize="lg" fontWeight="800" color={C.navy}>
                        {fmtMAD(currentTotal)}
                      </Text>
                    </HStack>
                    {currentDeliveryCost > 0 && (
                      <>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="sm" color={C.amber}>+ Livraison estimée</Text>
                          <Text fontSize="sm" fontWeight="600" color={C.amber}>
                            {fmtMAD(currentDeliveryCost)}
                          </Text>
                        </HStack>
                        <HStack justify="space-between" pt={2} borderTop="1px dashed" borderColor={C.border}>
                          <Text fontWeight="700" color={C.navy} fontSize="sm">TOTAL LIVRÉ</Text>
                          <Text fontSize="xl" fontWeight="900" color={C.navy}>
                            {fmtMAD(currentLandedCost)}
                          </Text>
                        </HStack>
                      </>
                    )}
                    {currentDeliveryCost === 0 && currentLandedBundles.length > 0 && (
                      <Text fontSize="xs" color={C.green} mt={1}>Toutes les livraisons sont gratuites</Text>
                    )}
                  </Box>

                  <Box px={5} py={4}>
                    <Button
                      w="full"
                      colorScheme="blue"
                      size="lg"
                      leftIcon={<Icon as={FaShoppingCart} />}
                      isLoading={addingToCart}
                      loadingText="Ajout en cours..."
                      onClick={handleAddToCart}
                      mb={2}
                    >
                      Ajouter au panier
                    </Button>
                    <Text fontSize="xs" color={C.muted} textAlign="center">
                      {lines.length} produit{lines.length !== 1 ? 's' : ''} · {vendorBundlesCurrent.length} fournisseur{vendorBundlesCurrent.length !== 1 ? 's' : ''}
                    </Text>
                  </Box>
                </VStack>
              </Box>

              {/* Options vendeur unique */}
              {result.singleVendorOptions.filter((v) => v.coversAll).length > 0 && (
                <Box
                  mt={4}
                  bg="white"
                  border="1px solid"
                  borderColor={C.border}
                  rounded="2xl"
                  overflow="hidden"
                >
                  <Box px={5} py={3} borderBottom="1px solid" borderColor={C.border}>
                    <Text fontWeight="700" fontSize="xs" color={C.muted} textTransform="uppercase" letterSpacing="wide">
                      Alternatives vendeur unique
                    </Text>
                  </Box>
                  <VStack align="stretch" spacing={0} divider={<Divider />} px={0}>
                    {result.singleVendorOptions.filter((v) => v.coversAll).map((v) => {
                      const extra = v.total - result.cheapestTotal;
                      return (
                        <Box
                          key={v.sellerId}
                          px={5}
                          py={3}
                          cursor="pointer"
                          _hover={{ bg: C.bgAlt }}
                          bg={selectedSingleVendor === v.sellerId && mode === 'single' ? '#e8f0fe' : 'white'}
                          onClick={() => { setMode('single'); applyVendor(v.sellerId); }}
                        >
                          <HStack justify="space-between">
                            <VStack align="start" spacing={0}>
                              <Text fontSize="sm" fontWeight="700" color={C.navy}>{v.sellerName}</Text>
                              <Text fontSize="xs" color={C.muted}>
                                1 facture · tous produits
                              </Text>
                            </VStack>
                            <VStack align="end" spacing={0}>
                              <Text fontSize="sm" fontWeight="800" color={C.slate}>
                                {fmtMAD(v.total)}
                              </Text>
                              {extra > 0 && (
                                <Text fontSize="xs" color={C.amber}>+{fmtMAD(extra)}</Text>
                              )}
                            </VStack>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>
                </Box>
              )}
              {/* Consolidation livraison */}
              {landedResult && landedResult.consolidationOptions.length > 0 && (
                <Box
                  mt={4} bg="white" border="1px solid" borderColor={C.amberBorder}
                  rounded="2xl" overflow="hidden"
                >
                  <Box px={5} py={3} bg={C.amberLight} borderBottom="1px solid" borderColor={C.amberBorder}>
                    <HStack spacing={2}>
                      <Icon as={FaTruck} color={C.amber} boxSize={3} />
                      <Text fontWeight="700" fontSize="xs" color="#92400e" textTransform="uppercase" letterSpacing="wide">
                        Optimiser les livraisons
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="#92400e" mt={0.5}>
                      Regroupez les commandes pour réduire le total livré
                    </Text>
                  </Box>
                  <VStack align="stretch" spacing={0} divider={<Divider />}>
                    {landedResult.consolidationOptions.slice(0, 3).map((opt) => (
                      <Box
                        key={opt.dropVendorId}
                        px={5} py={3}
                        cursor="pointer"
                        _hover={{ bg: C.bgAlt }}
                        onClick={() => applyConsolidation(opt)}
                      >
                        <Text fontSize="xs" fontWeight="700" color={C.navy} mb={0.5}>
                          Tout commander chez {opt.absorbVendorName}
                        </Text>
                        <Text fontSize="xs" color={C.muted} mb={2}>
                          Déplace {opt.eansToMove.length} EAN{opt.eansToMove.length > 1 ? 's' : ''} depuis {opt.dropVendorName}
                        </Text>
                        <HStack spacing={3} flexWrap="wrap">
                          <Text fontSize="xs" color={opt.productCostIncrease > 0 ? C.amber : C.green}>
                            Produits : {opt.productCostIncrease >= 0 ? '+' : ''}{fmtMAD(opt.productCostIncrease)}
                          </Text>
                          <Text fontSize="xs" color={C.green}>
                            Livraison : -{fmtMAD(opt.deliverySaving)}
                          </Text>
                          <Badge
                            colorScheme={opt.netSaving > 0 ? 'green' : 'orange'}
                            rounded="full" fontSize="2xs" px={2}
                          >
                            Net {opt.netSaving >= 0 ? '-' : '+'}{fmtMAD(Math.abs(opt.netSaving))}
                          </Badge>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}
            </GridItem>
          )}
        </Grid>
      </Container>
    </Box>
  );
}
